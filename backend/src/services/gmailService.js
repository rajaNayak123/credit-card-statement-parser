import { getGmailClient } from '../config/gmail.js';
import { parsePDF } from './pdfParser.js';
import { isLikelyCreditCardStatement } from './pdfValidator.js';
import fs from 'fs/promises';
import path from 'path';

/**
 * Known bank email domains
 */
const BANK_DOMAINS = [
  // Indian Banks
  'hdfcbank.com', 'hdfcbank.net',
  'icicibank.com',
  'sbi.co.in', 'onlinesbi.com', 'sbicard.com',
  'axisbank.com',
  'kotak.com',
  'yesbank.in',
  'indusind.com',
  'sc.com', 'standardchartered.com',
  'citi.com', 'citibank.com',
  'hsbc.co.in', 'hsbc.com',
  'rbl.co.in', 'rblbank.com',
  'idfcfirstbank.com',
  'aubank.in',
  'americanexpress.com', 'aexp.com',
  'bobfinancial.com', 'bankofbaroda.com',
  'pnbcards.com',
  
  // International Banks
  'chase.com',
  'bankofamerica.com',
  'wellsfargo.com',
  'capitalone.com',
  'discover.com',
  'barclays.com',
  'visa.com',
  'mastercard.com',
];

/**
 * Bank-related keywords for subject and body
 */
const BANK_KEYWORDS = [
  'credit card',
  'statement',
  'e-statement',
  'estatement',
  'card statement',
  'billing statement',
  'account summary',
  'reward points',
  'payment due',
  'monthly statement',
  'statement of account',
  'billing cycle',
  'credit limit',
  'total amount due',
  'minimum payment',
];

/**
 * Get date range for last 2 months
 */
const getLast2MonthsDateRange = () => {
  const now = new Date();
  const twoMonthsAgo = new Date();
  twoMonthsAgo.setMonth(now.getMonth() - 2);
  
  // Gmail date format: YYYY/MM/DD
  const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}/${month}/${day}`;
  };
  
  return {
    after: formatDate(twoMonthsAgo),
    before: formatDate(now),
  };
};

/**
 * Build Gmail search query
 * Step 1: Fetch emails from last 2 months with PDF attachments only
 */
const buildSearchQuery = (filters = {}) => {
  const queries = [];
  
  // MANDATORY: Must have PDF attachment (Step 2)
  queries.push('has:attachment');
  queries.push('filename:pdf');
  
  // Date range: Last 2 months (Step 1)
  const dateRange = getLast2MonthsDateRange();
  queries.push(`after:${filters.after || dateRange.after}`);
  queries.push(`before:${filters.before || dateRange.before}`);
  
  return queries.join(' ');
};

/**
 * Check if sender domain is from a known bank
 * Step 3 - Case 1
 */
const isFromBankDomain = (fromEmail) => {
  if (!fromEmail) return false;
  
  const emailLower = fromEmail.toLowerCase();
  return BANK_DOMAINS.some(domain => emailLower.includes(domain));
};

/**
 * Check if text contains bank-related keywords
 * Step 3 - Case 2
 */
const containsBankKeywords = (text) => {
  if (!text) return false;
  
  const textLower = text.toLowerCase();
  return BANK_KEYWORDS.some(keyword => textLower.includes(keyword));
};

/**
 * Extract email body text from message payload
 */
const getEmailBody = (payload) => {
  let body = '';
  
  const extractText = (part) => {
    if (part.mimeType === 'text/plain' || part.mimeType === 'text/html') {
      if (part.body && part.body.data) {
        const decoded = Buffer.from(part.body.data, 'base64').toString('utf-8');
        body += decoded + ' ';
      }
    }
    
    if (part.parts) {
      part.parts.forEach(extractText);
    }
  };
  
  extractText(payload);
  return body.trim();
};

/**
 * Search emails with PDF attachments from last 2 months
 */
export const searchStatementEmails = async (filters = {}) => {
  try {
    const gmail = await getGmailClient();
    const query = buildSearchQuery(filters);
    
    console.log('🔍 Gmail Search Query:', query);
    
    const response = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: filters.maxResults || 500,
    });
    
    const messages = response.data.messages || [];
    console.log(`📧 Found ${messages.length} emails with PDF attachments from last 2 months`);
    
    return messages;
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
 * Download attachment to temporary location
 */
const downloadAttachment = async (messageId, attachmentId, filename) => {
  try {
    const gmail = await getGmailClient();
    
    const response = await gmail.users.messages.attachments.get({
      userId: 'me',
      messageId: messageId,
      id: attachmentId,
    });
    
    // Decode base64 data
    const data = Buffer.from(response.data.data, 'base64');
    
    // Save to temp directory
    const uploadsDir = path.join(process.cwd(), 'uploads');
    await fs.mkdir(uploadsDir, { recursive: true });
    
    const timestamp = Date.now();
    const safeFilename = `gmail-${timestamp}-${filename.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const filePath = path.join(uploadsDir, safeFilename);
    
    await fs.writeFile(filePath, data);
    
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
 * Analyze PDF content to check if it's bank-related
 * Step 3 - Case 3
 */
const analyzePDFContent = async (filePath) => {
  try {
    console.log('      📖 Analyzing PDF content...');
    
    // Parse PDF
    const pdfData = await parsePDF(filePath);
    
    if (!pdfData.text || pdfData.text.length < 100) {
      console.log('      ❌ PDF has insufficient text');
      return { isBankRelated: false, reason: 'Insufficient text in PDF' };
    }
    
    // Use existing validator
    const validation = isLikelyCreditCardStatement(pdfData.text);
    
    console.log(`      ${validation.isStatement ? '✅' : '❌'} PDF Analysis: ${validation.isStatement ? 'Bank-related' : 'Not bank-related'}`);
    console.log(`      Confidence: ${validation.confidence}, Score: ${validation.score}`);
    
    return {
      isBankRelated: validation.isStatement,
      confidence: validation.confidence,
      score: validation.score,
      reason: validation.reason || 'Content analysis',
      pdfData,
    };
  } catch (error) {
    console.error('      ❌ Error analyzing PDF:', error.message);
    return { 
      isBankRelated: false, 
      reason: `PDF analysis failed: ${error.message}` 
    };
  }
};

/**
 * Process single email following the exact decision flow
 */
const processEmail = async (messageId, index, total) => {
  console.log(`\n[${ index}/${total}] 📨 Processing email...`);
  
  try {
    // Get email details
    const message = await getEmailDetails(messageId);
    const headers = message.payload.headers;
    
    const subject = headers.find(h => h.name === 'Subject')?.value || 'No Subject';
    const from = headers.find(h => h.name === 'From')?.value || 'Unknown';
    const date = headers.find(h => h.name === 'Date')?.value || '';
    const body = getEmailBody(message.payload);
    
    console.log(`   Subject: "${subject}"`);
    console.log(`   From: ${from}`);
    
    // Find PDF attachments
    const pdfAttachments = [];
    const findPDFs = (parts) => {
      if (!parts) return;
      
      for (const part of parts) {
        if (part.filename && part.filename.toLowerCase().endsWith('.pdf')) {
          pdfAttachments.push({
            filename: part.filename,
            mimeType: part.mimeType,
            attachmentId: part.body.attachmentId,
            size: part.body.size,
          });
        }
        
        if (part.parts) {
          findPDFs(part.parts);
        }
      }
    };
    
    findPDFs([message.payload]);
    
    // Step 2: Ignore emails without PDF attachments
    if (pdfAttachments.length === 0) {
      console.log('   ⏭️  IGNORED: No PDF attachments found');
      return { 
        skipped: true, 
        reason: 'No PDF attachments',
        messageId,
        subject,
        from,
      };
    }
    
    console.log(`   📎 Found ${pdfAttachments.length} PDF attachment(s)`);
    
    // Step 3: Extract sender domain
    const senderDomain = from.match(/@([^\s>]+)/)?.[1]?.toLowerCase() || '';
    console.log(`   🏦 Sender domain: ${senderDomain}`);
    
    // DECISION LOGIC
    let shouldProcess = false;
    let decisionCase = '';
    let reason = '';
    
    // Case 1: Sender domain is a known bank domain
    if (isFromBankDomain(from)) {
      shouldProcess = true;
      decisionCase = 'Case 1';
      reason = 'Known bank domain';
      console.log(`   ✅ CASE 1: Known bank domain - PROCESS`);
    }
    // Case 2: Not a bank domain, but subject OR body contains bank keywords
    else if (containsBankKeywords(subject) || containsBankKeywords(body)) {
      shouldProcess = true;
      decisionCase = 'Case 2';
      const inSubject = containsBankKeywords(subject);
      const inBody = containsBankKeywords(body);
      reason = `Bank keywords in ${inSubject ? 'subject' : ''} ${inSubject && inBody ? 'and' : ''} ${inBody ? 'body' : ''}`;
      console.log(`   ✅ CASE 2: ${reason} - PROCESS`);
    }
    // Case 3: Need to analyze PDF content
    else {
      console.log('   🔍 CASE 3: Checking PDF content...');
      
      // Download and analyze first PDF
      const firstPDF = pdfAttachments[0];
      console.log(`      📥 Downloading: ${firstPDF.filename}`);
      
      const downloadedFile = await downloadAttachment(
        messageId,
        firstPDF.attachmentId,
        firstPDF.filename
      );
      
      // Analyze content
      const analysis = await analyzePDFContent(downloadedFile.filePath);
      
      if (analysis.isBankRelated) {
        shouldProcess = true;
        decisionCase = 'Case 3';
        reason = `PDF content is bank-related (${analysis.confidence} confidence)`;
        console.log(`   ✅ CASE 3: ${reason} - PROCESS`);
        
        // Keep the downloaded file for processing
        // Return it immediately
        return {
          skipped: false,
          decisionCase,
          reason,
          messageId,
          subject,
          from,
          date,
          senderDomain,
          attachments: [{
            ...firstPDF,
            downloadedFile,
            analysis,
          }],
        };
      } else {
        shouldProcess = false;
        reason = `PDF content not bank-related: ${analysis.reason}`;
        console.log(`   ❌ CASE 3: ${reason} - IGNORE`);
        
        // Clean up downloaded file
        await fs.unlink(downloadedFile.filePath).catch(() => {});
      }
    }
    
    // Final decision
    if (!shouldProcess) {
      console.log(`   ⏭️  IGNORED: ${reason}`);
      return {
        skipped: true,
        reason,
        messageId,
        subject,
        from,
        decisionCase: 'Rejected',
      };
    }
    
    // Download all PDFs for processing (Cases 1 and 2)
    const downloadedAttachments = [];
    for (const attachment of pdfAttachments) {
      console.log(`   📥 Downloading: ${attachment.filename}`);
      const downloadedFile = await downloadAttachment(
        messageId,
        attachment.attachmentId,
        attachment.filename
      );
      
      downloadedAttachments.push({
        ...attachment,
        downloadedFile,
      });
    }
    
    console.log(`   ✅ Ready to process ${downloadedAttachments.length} PDF(s)`);
    
    return {
      skipped: false,
      decisionCase,
      reason,
      messageId,
      subject,
      from,
      date,
      senderDomain,
      attachments: downloadedAttachments,
    };
    
  } catch (error) {
    console.error(`   ❌ Error processing email:`, error.message);
    return {
      skipped: true,
      reason: `Error: ${error.message}`,
      messageId,
      error: error.message,
    };
  }
};

/**
 * MAIN FUNCTION: Fetch all credit card statements following exact decision flow
 */
export const fetchAllStatements = async (filters = {}) => {
  try {
    console.log('\n╔' + '═'.repeat(68) + '╗');
    console.log('║' + ' '.repeat(68) + '║');
    console.log('║  🚀 CREDIT CARD STATEMENT FETCH - DECISION FLOW' + ' '.repeat(19) + '║');
    console.log('║' + ' '.repeat(68) + '║');
    console.log('╚' + '═'.repeat(68) + '╝');
    
    console.log('\n📋 DECISION FLOW:');
    console.log('   1️⃣  Fetch emails from last 2 months with PDF attachments');
    console.log('   2️⃣  Ignore emails without PDF attachments');
    console.log('   3️⃣  Decision logic:');
    console.log('       Case 1: Known bank domain → Process');
    console.log('       Case 2: Bank keywords in subject/body → Process');
    console.log('       Case 3: Analyze PDF content → Process if bank-related');
    console.log('   4️⃣  Ignore if none of the above\n');
    
    // Step 1: Search emails
    const messages = await searchStatementEmails(filters);
    
    if (!messages || messages.length === 0) {
      console.log('❌ No emails found in last 2 months with PDF attachments');
      return {
        success: true,
        count: 0,
        message: 'No emails found',
        statements: [],
        statistics: {
          totalEmails: 0,
          case1: 0,
          case2: 0,
          case3: 0,
          ignored: 0,
          processed: 0,
          errors: 0,
        },
      };
    }
    
    const results = [];
    const statistics = {
      totalEmails: messages.length,
      case1: 0,
      case2: 0,
      case3: 0,
      ignored: 0,
      processed: 0,
      errors: 0,
    };
    
    // Process each email
    for (let i = 0; i < messages.length; i++) {
      const result = await processEmail(messages[i].id, i + 1, messages.length);
      
      if (result.skipped) {
        statistics.ignored++;
        if (result.error) {
          statistics.errors++;
        }
      } else {
        // Count by decision case
        if (result.decisionCase === 'Case 1') statistics.case1++;
        else if (result.decisionCase === 'Case 2') statistics.case2++;
        else if (result.decisionCase === 'Case 3') statistics.case3++;
        
        statistics.processed++;
        
        // Add to results for further processing
        for (const attachment of result.attachments) {
          results.push({
            messageId: result.messageId,
            subject: result.subject,
            from: result.from,
            date: result.date,
            senderDomain: result.senderDomain,
            file: attachment.downloadedFile,
            decisionCase: result.decisionCase,
            reason: result.reason,
            pdfAnalysis: attachment.analysis,
          });
        }
      }
    }
    
    // Print summary
    console.log('\n╔' + '═'.repeat(68) + '╗');
    console.log('║  📊 PROCESSING SUMMARY' + ' '.repeat(45) + '║');
    console.log('╠' + '═'.repeat(68) + '╣');
    console.log(`║  Total emails searched:              ${String(statistics.totalEmails).padStart(4)} ` + ' '.repeat(26) + '║');
    console.log(`║  ✅ Case 1 (Bank domain):             ${String(statistics.case1).padStart(4)} ` + ' '.repeat(26) + '║');
    console.log(`║  ✅ Case 2 (Keywords in sub/body):    ${String(statistics.case2).padStart(4)} ` + ' '.repeat(26) + '║');
    console.log(`║  ✅ Case 3 (PDF content analysis):    ${String(statistics.case3).padStart(4)} ` + ' '.repeat(26) + '║');
    console.log(`║  ⏭️  Ignored:                          ${String(statistics.ignored).padStart(4)} ` + ' '.repeat(26) + '║');
    console.log(`║  📥 Total PDFs to process:            ${String(statistics.processed).padStart(4)} ` + ' '.repeat(26) + '║');
    console.log(`║  ❌ Errors:                            ${String(statistics.errors).padStart(4)} ` + ' '.repeat(26) + '║');
    console.log('╚' + '═'.repeat(68) + '╝\n');
    
    return {
      success: true,
      count: results.length,
      statements: results,
      statistics,
    };
  } catch (error) {
    console.error('❌ Fatal error in fetchAllStatements:', error);
    throw error;
  }
};

/**
 * Get list of bank email domains
 */
export const getBankEmailDomains = () => {
  return BANK_DOMAINS;
};