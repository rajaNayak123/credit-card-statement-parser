import { getGmailClient } from '../config/gmail.js';
import fs from 'fs/promises';
import path from 'path';

/**
 * Search for emails with credit card statements
 * @param {Object} filters - Search filters
 * @returns {Array} List of message IDs
 */
export const searchStatementEmails = async (filters = {}) => {
  try {
    const gmail = await getGmailClient();
    
    // Build search query
    const searchQueries = [
      'has:attachment',
      'filename:pdf',
    ];
    
    // Common credit card statement keywords
    const statementKeywords = [
      'credit card statement',
      'statement of account',
      'monthly statement',
      'card statement',
      'billing statement',
      'reward points',
      'hdfc bank',
      'icici bank',
      'axis bank',
      'sbi card',
      'kotak mahindra',
    ];
    
    // Add keyword search (OR condition)
    const keywordQuery = statementKeywords
      .map(keyword => `"${keyword}"`)
      .join(' OR ');
    searchQueries.push(`(${keywordQuery})`);
    
    // Add date filter if provided
    if (filters.after) {
      searchQueries.push(`after:${filters.after}`);
    }
    if (filters.before) {
      searchQueries.push(`before:${filters.before}`);
    }
    
    // Add sender filter if provided
    if (filters.from) {
      searchQueries.push(`from:${filters.from}`);
    }
    
    const query = searchQueries.join(' ');
    
    console.log('📧 Gmail Search Query:', query);
    
    const response = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: filters.maxResults || 20,
    });
    
    console.log(`✅ Found ${response.data.messages?.length || 0} emails`);
    
    return response.data.messages || [];
  } catch (error) {
    console.error('❌ Error searching emails:', error);
    throw new Error(`Failed to search emails: ${error.message}`);
  }
};

/**
 * Get email details by message ID
 */
export const getEmailDetails = async (messageId) => {
  try {
    const gmail = await getGmailClient();
    
    const response = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full',
    });
    
    return response.data;
  } catch (error) {
    console.error('❌ Error getting email details:', error);
    throw new Error(`Failed to get email: ${error.message}`);
  }
};

/**
 * Extract PDF attachments from email
 */
export const extractPDFAttachments = async (messageId) => {
  try {
    const gmail = await getGmailClient();
    const message = await getEmailDetails(messageId);
    
    const attachments = [];
    
    // Get email headers
    const headers = message.payload.headers;
    const subject = headers.find(h => h.name === 'Subject')?.value || 'No Subject';
    const from = headers.find(h => h.name === 'From')?.value || 'Unknown';
    const date = headers.find(h => h.name === 'Date')?.value || '';
    
    // Recursive function to find attachments in parts
    const findAttachments = (parts) => {
      if (!parts) return;
      
      for (const part of parts) {
        if (part.filename && part.filename.toLowerCase().endsWith('.pdf')) {
          attachments.push({
            filename: part.filename,
            mimeType: part.mimeType,
            attachmentId: part.body.attachmentId,
            size: part.body.size,
          });
        }
        
        // Recursively check nested parts
        if (part.parts) {
          findAttachments(part.parts);
        }
      }
    };
    
    findAttachments([message.payload]);
    
    return {
      messageId,
      subject,
      from,
      date,
      attachments,
    };
  } catch (error) {
    console.error('❌ Error extracting attachments:', error);
    throw new Error(`Failed to extract attachments: ${error.message}`);
  }
};

/**
 * Download attachment
 */
export const downloadAttachment = async (messageId, attachmentId, filename) => {
  try {
    const gmail = await getGmailClient();
    
    const response = await gmail.users.messages.attachments.get({
      userId: 'me',
      messageId: messageId,
      id: attachmentId,
    });
    
    // Decode base64 data
    const data = Buffer.from(response.data.data, 'base64');
    
    // Save to uploads directory
    const uploadsDir = path.join(process.cwd(), 'uploads');
    await fs.mkdir(uploadsDir, { recursive: true });
    
    const timestamp = Date.now();
    const safeFilename = `gmail-${timestamp}-${filename}`;
    const filePath = path.join(uploadsDir, safeFilename);
    
    await fs.writeFile(filePath, data);
    
    console.log(`💾 Downloaded: ${filename} (${(data.length / 1024).toFixed(2)} KB)`);
    
    return {
      filePath,
      filename: safeFilename,
      originalFilename: filename,
      size: data.length,
    };
  } catch (error) {
    console.error('❌ Error downloading attachment:', error);
    throw new Error(`Failed to download attachment: ${error.message}`);
  }
};

/**
 * Fetch and process all statement PDFs
 */
export const fetchAllStatements = async (filters = {}) => {
  try {
    const messages = await searchStatementEmails(filters);
    
    if (!messages || messages.length === 0) {
      return {
        success: true,
        count: 0,
        message: 'No credit card statements found',
        statements: [],
      };
    }
    
    const results = [];
    
    for (const message of messages) {
      try {
        const emailData = await extractPDFAttachments(message.id);
        
        if (emailData.attachments.length > 0) {
          for (const attachment of emailData.attachments) {
            const downloadedFile = await downloadAttachment(
              message.id,
              attachment.attachmentId,
              attachment.filename
            );
            
            results.push({
              messageId: message.id,
              subject: emailData.subject,
              from: emailData.from,
              date: emailData.date,
              file: downloadedFile,
            });
          }
        }
      } catch (error) {
        console.error(`❌ Error processing message ${message.id}:`, error);
        // Continue with next message
      }
    }
    
    console.log(`✅ Successfully downloaded ${results.length} statement(s)`);
    
    return {
      success: true,
      count: results.length,
      statements: results,
    };
  } catch (error) {
    console.error('❌ Error fetching statements:', error);
    throw error;
  }
};

/**
 * Get list of common bank email domains
 */
export const getBankEmailDomains = () => {
  return [
    // Indian Banks
    'hdfcbank.com',
    'hdfcbank.net',
    'icicibank.com',
    'sbi.co.in',
    'onlinesbi.com',
    'axisbank.com',
    'kotak.com',
    'yesbank.in',
    'indusind.com',
    'sc.com', // Standard Chartered
    'citi.com',
    'citibank.com',
    'hsbc.co.in',
    'rbl.co.in',
    'idfcfirstbank.com',
    'aubank.in',
    'americanexpress.com',
    // US Banks
    'chase.com',
    'bankofamerica.com',
    'wellsfargo.com',
    'capitalone.com',
    'discover.com',
    'usbank.com',
  ];
};