import { getGmailClient } from '../config/gmail.js';
import fs from 'fs/promises';
import path from 'path';

/**
 * Enhanced credit card statement keywords - MORE PRECISE
 */
const CREDIT_CARD_KEYWORDS = {
  // Primary statement indicators (used in Gmail search)
  primary: [
    'credit card statement',
    'card statement',
    'statement of account',
    'billing statement',
    'monthly statement',
  ],
  
  // Secondary indicators for subject validation
  subjects: [
    'credit card statement',
    'card statement',
    'statement of account',
    'billing statement',
    'monthly statement',
    'account statement',
    'e-statement',
    'estatement',
    'your statement',
    'statement is ready',
    'statement available',
  ],
  
  bankNames: [
    'hdfc',
    'icici',
    'axis',
    'sbi',
    'kotak',
    'yes bank',
    'indusind',
    'standard chartered',
    'citibank',
    'hsbc',
    'american express',
    'amex',
    'rbl',
    'idfc',
    'au bank',
    'bob', // Bank of Baroda
    'pnb', // Punjab National Bank
    'chase',
    'bank of america',
    'wells fargo',
    'capital one',
    'discover',
  ],
  
  // STRICT exclusions
  exclude: [
    'invoice',
    'receipt',
    'payment confirmation',
    'transaction alert',
    'transaction notification',
    'otp',
    'password',
    'welcome',
    'activated',
    'registration',
    'kyc',
    'promotional',
    'offer',
    'cashback credited',
    'reward points credited',
    'payment received',
    'payment successful',
    'autopay',
  ],
};

/**
 * Known bank email domains - EXPANDED LIST
 */
const BANK_DOMAINS = [
  // Indian Banks
  'hdfcbank.com', 'hdfcbank.net',
  'icicibank.com',
  'sbi.co.in', 'onlinesbi.com',
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
  'bobfinancial.com', // Bank of Baroda
  'pnbcards.com', // Punjab National Bank
  
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
 * Build OPTIMIZED Gmail search query for ONLY credit card statements
 * Uses Gmail's advanced search operators for maximum precision
 */
const buildSearchQuery = (filters = {}) => {
  const queries = [];
  
  // MANDATORY: Must have PDF attachment
  queries.push('has:attachment');
  queries.push('filename:pdf');
  
  // CRITICAL: Must contain "statement" + "credit card" OR specific bank names
  // Using OR logic with parentheses for precise matching
  const statementTerms = [
    '"credit card statement"',
    '"card statement"',
    '"billing statement"',
    '"monthly statement"',
    '("statement" AND ("credit card" OR "card account"))',
  ];
  
  queries.push(`(${statementTerms.join(' OR ')})`);
  
  // EXCLUSIONS: Remove non-statement emails (very important)
  const exclusions = [
    '-"transaction alert"',
    '-"payment confirmation"',
    '-"payment received"',
    '-"payment successful"',
    '-"otp"',
    '-"one time password"',
    '-"welcome"',
    '-"activated"',
    '-"registration"',
    '-"promotional"',
    '-"offer"',
    '-invoice',
    '-receipt',
  ];
  
  queries.push(...exclusions);
  
  // Date filters (if provided)
  if (filters.after) {
    queries.push(`after:${filters.after}`);
  }
  if (filters.before) {
    queries.push(`before:${filters.before}`);
  }
  
  // Sender filter (if provided)
  if (filters.from) {
    queries.push(`from:${filters.from}`);
  } else {
    // Optional: Filter by known bank domains (can be too restrictive)
    // Uncomment if you want to ONLY search emails from known banks
    // const bankDomainQuery = BANK_DOMAINS.map(d => `from:*@${d}`).join(' OR ');
    // queries.push(`(${bankDomainQuery})`);
  }
  
  return queries.join(' ');
};

/**
 * Check if email sender is from a known bank domain
 */
const isFromBankDomain = (fromEmail) => {
  if (!fromEmail) return false;
  
  const emailLower = fromEmail.toLowerCase();
  return BANK_DOMAINS.some(domain => emailLower.includes(domain));
};

/**
 * ENHANCED: Validate email subject for credit card statement indicators
 * Returns confidence score (0-100)
 */
const validateStatementSubject = (subject) => {
  if (!subject) return { isValid: false, score: 0, reason: 'No subject' };
  
  const subjectLower = subject.toLowerCase();
  let score = 0;
  const reasons = [];
  
  // MUST contain statement keywords (high weight)
  const hasStatementKeyword = CREDIT_CARD_KEYWORDS.subjects.some(keyword => {
    if (subjectLower.includes(keyword)) {
      score += 40;
      reasons.push(`Contains: "${keyword}"`);
      return true;
    }
    return false;
  });
  
  if (!hasStatementKeyword) {
    return { 
      isValid: false, 
      score: 0, 
      reason: 'Missing statement keywords in subject' 
    };
  }
  
  // Bonus: Contains bank name (medium weight)
  const hasBankName = CREDIT_CARD_KEYWORDS.bankNames.some(bank => {
    if (subjectLower.includes(bank)) {
      score += 30;
      reasons.push(`Bank: ${bank}`);
      return true;
    }
    return false;
  });
  
  // Bonus: Contains "credit" or "card" (medium weight)
  if (subjectLower.includes('credit') || subjectLower.includes('card')) {
    score += 20;
    reasons.push('Contains credit/card');
  }
  
  // PENALTY: Contains exclusion keywords (severe)
  const hasExclusion = CREDIT_CARD_KEYWORDS.exclude.some(keyword => {
    if (subjectLower.includes(keyword)) {
      score -= 80; // Heavy penalty
      reasons.push(`EXCLUDED: "${keyword}"`);
      return true;
    }
    return false;
  });
  
  // Final validation
  const isValid = score >= 40 && !hasExclusion;
  
  return {
    isValid,
    score: Math.max(0, Math.min(100, score)),
    reasons: reasons.join(', '),
    hasBankName,
  };
};

/**
 * ENHANCED: Validate PDF filename
 */
const validateStatementFilename = (filename) => {
  if (!filename) return { isValid: false, score: 0 };
  
  const filenameLower = filename.toLowerCase();
  let score = 0;
  
  // Must be PDF
  if (!filenameLower.endsWith('.pdf')) {
    return { isValid: false, score: 0, reason: 'Not a PDF file' };
  }
  
  // Positive indicators
  const positiveKeywords = [
    'statement',
    'credit',
    'card',
    'billing',
    'account',
    'estatement',
    'e-statement',
  ];
  
  positiveKeywords.forEach(keyword => {
    if (filenameLower.includes(keyword)) {
      score += 20;
    }
  });
  
  // Negative indicators
  const negativeKeywords = [
    'invoice',
    'receipt',
    'payment_confirmation',
    'transaction',
    'alert',
  ];
  
  const hasNegative = negativeKeywords.some(keyword => 
    filenameLower.includes(keyword)
  );
  
  if (hasNegative) {
    score -= 50;
  }
  
  return {
    isValid: score >= 20,
    score: Math.max(0, score),
  };
};

/**
 * Search for credit card statement emails with OPTIMIZED filtering
 */
export const searchStatementEmails = async (filters = {}) => {
  try {
    const gmail = await getGmailClient();
    
    const query = buildSearchQuery(filters);
    
    console.log('📧 Gmail Search Query:', query);
    console.log('📧 Query breakdown:');
    console.log('   ✓ Attachments: PDF files only');
    console.log('   ✓ Keywords: Statement + Credit Card');
    console.log('   ✓ Exclusions: Alerts, OTPs, Invoices, Receipts');
    
    const response = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: filters.maxResults || 100, // Increased for better coverage
    });
    
    const messages = response.data.messages || [];
    console.log(`✅ Gmail returned ${messages.length} potential emails`);
    
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
 * ENHANCED: Extract and validate PDF attachments from email
 * Returns detailed validation results
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
    
    // VALIDATION STEP 1: Check email metadata
    const subjectValidation = validateStatementSubject(subject);
    const isFromBank = isFromBankDomain(from);
    
    console.log(`\n📨 Email: "${subject}"`);
    console.log(`   From: ${from}`);
    console.log(`   Subject validation: ${subjectValidation.isValid ? '✅' : '❌'} (Score: ${subjectValidation.score})`);
    console.log(`   Bank domain: ${isFromBank ? '✅' : '❌'}`);
    
    // Skip if subject validation fails
    if (!subjectValidation.isValid) {
      console.log(`   ⏭️  SKIPPED: ${subjectValidation.reason}`);
      return {
        messageId,
        subject,
        from,
        date,
        attachments: [],
        skipped: true,
        reason: subjectValidation.reason,
        validation: subjectValidation,
      };
    }
    
    // Recursive function to find attachments in parts
    const findAttachments = (parts) => {
      if (!parts) return;
      
      for (const part of parts) {
        if (part.filename && part.filename.toLowerCase().endsWith('.pdf')) {
          // VALIDATION STEP 2: Check filename
          const filenameValidation = validateStatementFilename(part.filename);
          
          if (filenameValidation.isValid) {
            attachments.push({
              filename: part.filename,
              mimeType: part.mimeType,
              attachmentId: part.body.attachmentId,
              size: part.body.size,
              validation: filenameValidation,
            });
            console.log(`   📎 PDF found: "${part.filename}" (Score: ${filenameValidation.score})`);
          } else {
            console.log(`   ⏭️  PDF skipped: "${part.filename}" (Score: ${filenameValidation.score})`);
          }
        }
        
        // Recursively check nested parts
        if (part.parts) {
          findAttachments(part.parts);
        }
      }
    };
    
    findAttachments([message.payload]);
    
    // VALIDATION STEP 3: Check attachment count
    if (attachments.length === 0) {
      console.log(`   ⏭️  No valid statement PDFs found`);
      return {
        messageId,
        subject,
        from,
        date,
        attachments: [],
        skipped: true,
        reason: 'No valid PDF attachments',
        validation: subjectValidation,
      };
    }
    
    if (attachments.length > 3) {
      console.log(`   ⚠️  Warning: ${attachments.length} PDFs found (unusual for statement)`);
    }
    
    console.log(`   ✅ ${attachments.length} valid PDF(s) to process`);
    
    return {
      messageId,
      subject,
      from,
      date,
      attachments,
      skipped: false,
      validation: subjectValidation,
      isFromBank,
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
    const safeFilename = `gmail-${timestamp}-${filename.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const filePath = path.join(uploadsDir, safeFilename);
    
    await fs.writeFile(filePath, data);
    
    const sizeKB = (data.length / 1024).toFixed(2);
    console.log(`💾 Downloaded: ${filename} (${sizeKB} KB)`);
    
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
 * MAIN FUNCTION: Fetch and filter all credit card statements
 * With comprehensive logging and statistics
 */
export const fetchAllStatements = async (filters = {}) => {
  try {
    console.log('\n🔍 Starting Credit Card Statement Search...');
    console.log('━'.repeat(60));
    
    const messages = await searchStatementEmails(filters);
    
    if (!messages || messages.length === 0) {
      console.log('❌ No emails found matching search criteria');
      return {
        success: true,
        count: 0,
        message: 'No credit card statements found',
        statements: [],
        statistics: {
          searched: 0,
          skippedBySubject: 0,
          skippedByAttachment: 0,
          downloaded: 0,
          errors: 0,
        },
      };
    }
    
    const results = [];
    const statistics = {
      searched: messages.length,
      skippedBySubject: 0,
      skippedByAttachment: 0,
      downloaded: 0,
      errors: 0,
    };
    
    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      
      try {
        console.log(`\n[${i + 1}/${messages.length}] Processing email...`);
        
        const emailData = await extractPDFAttachments(message.id);
        
        // Skip if validation failed
        if (emailData.skipped) {
          if (emailData.reason.includes('subject')) {
            statistics.skippedBySubject++;
          } else {
            statistics.skippedByAttachment++;
          }
          continue;
        }
        
        // Download each valid attachment
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
            validation: {
              subjectScore: emailData.validation.score,
              filenameScore: attachment.validation.score,
              isFromBank: emailData.isFromBank,
            },
          });
          
          statistics.downloaded++;
        }
      } catch (error) {
        console.error(`❌ Error processing message ${message.id}:`, error.message);
        statistics.errors++;
      }
    }
    
    // Print summary
    console.log('\n' + '━'.repeat(60));
    console.log('📊 SEARCH SUMMARY:');
    console.log('━'.repeat(60));
    console.log(`📧 Total emails searched:           ${statistics.searched}`);
    console.log(`⏭️  Skipped (invalid subject):       ${statistics.skippedBySubject}`);
    console.log(`⏭️  Skipped (no valid attachments):  ${statistics.skippedByAttachment}`);
    console.log(`✅ Valid statements downloaded:     ${statistics.downloaded}`);
    console.log(`❌ Errors:                          ${statistics.errors}`);
    console.log('━'.repeat(60));
    
    return {
      success: true,
      count: results.length,
      statements: results,
      filtered: statistics.skippedBySubject + statistics.skippedByAttachment,
      total: messages.length,
      statistics,
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
  return BANK_DOMAINS;
};