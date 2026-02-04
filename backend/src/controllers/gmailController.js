import {
  getAuthUrl,
  getTokensFromCode,
  isAuthenticated,
  revokeToken,
} from '../config/gmail.js';
import {
  fetchAllStatements,
  getBankEmailDomains,
} from '../services/gmailService.js';
import { parsePDF } from '../services/pdfParser.js';
import { extractRewardPoints } from '../services/groqService.js';
import { isLikelyCreditCardStatement, hasCardNumberPattern } from '../services/pdfValidator.js';
import Statement from '../models/Statement.js';
import fs from 'fs/promises';

/**
 * Get Gmail OAuth URL
 */
export const getGmailAuthUrl = async (req, res, next) => {
  try {
    const authUrl = getAuthUrl();
    res.json({
      success: true,
      authUrl,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Handle OAuth callback
 */
export const handleOAuthCallback = async (req, res, next) => {
  try {
    const { code } = req.query;
    
    if (!code) {
      return res.status(400).json({
        success: false,
        error: 'Authorization code not provided',
      });
    }
    
    await getTokensFromCode(code);
    
    // Redirect to frontend with success
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}?gmail_auth=success`);
  } catch (error) {
    console.error('❌ OAuth callback error:', error);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}?gmail_auth=failed`);
  }
};

/**
 * Check Gmail authentication status
 */
export const checkAuthStatus = async (req, res, next) => {
  try {
    const authenticated = await isAuthenticated();
    res.json({
      success: true,
      authenticated,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Disconnect Gmail
 */
export const disconnectGmail = async (req, res, next) => {
  try {
    await revokeToken();
    res.json({
      success: true,
      message: 'Gmail disconnected successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Fetch statements from Gmail with enhanced filtering and validation
 */
export const fetchStatementsFromGmail = async (req, res, next) => {
  try {
    const authenticated = await isAuthenticated();
    
    if (!authenticated) {
      return res.status(401).json({
        success: false,
        error: 'Gmail not connected. Please authorize first.',
      });
    }

    const userId = req.user.id;
    
    // Get filters from query params
    const filters = {
      after: req.query.after,
      before: req.query.before,
      from: req.query.from,
      maxResults: parseInt(req.query.maxResults) || 100,
    };
    
    console.log('\n' + '═'.repeat(70));
    console.log('🚀 STARTING CREDIT CARD STATEMENT FETCH FROM GMAIL');
    console.log('═'.repeat(70));
    console.log('👤 User ID:', userId);
    console.log('🔍 Filters:', JSON.stringify(filters, null, 2));
    
    // Step 1: Fetch statements from Gmail with smart filtering
    const result = await fetchAllStatements(filters);
    
    if (result.count === 0) {
      console.log('\n⚠️  No credit card statements found');
      return res.json({
        success: true,
        message: result.statistics.searched > 0 
          ? `Searched ${result.statistics.searched} emails, but none were valid credit card statements`
          : 'No credit card statements found in Gmail',
        processed: 0,
        failed: 0,
        rejected: 0,
        totalSearched: result.statistics?.searched || 0,
        statistics: result.statistics,
        statements: [],
      });
    }
    
    console.log('\n' + '─'.repeat(70));
    console.log('📋 PROCESSING DOWNLOADED STATEMENTS');
    console.log('─'.repeat(70));
    
    // Step 2: Process each statement with validation and AI extraction
    const processed = [];
    const failed = [];
    const rejected = [];
    
    for (let i = 0; i < result.statements.length; i++) {
      const stmt = result.statements[i];
      
      try {
        console.log(`\n[${i + 1}/${result.statements.length}] 📄 Processing: ${stmt.file.originalFilename}`);
        console.log(`   Subject: ${stmt.subject}`);
        console.log(`   From: ${stmt.from}`);
        console.log(`   Validation scores: Subject=${stmt.validation.subjectScore}, Filename=${stmt.validation.filenameScore}`);
        
        // Check if already processed (avoid duplicates)
        const existing = await Statement.findOne({
          userId,
          fileName: stmt.file.originalFilename,
          'metadata.gmailMessageId': stmt.messageId,
        });
        
        if (existing) {
          console.log(`   ⏭️  Already processed (duplicate), skipping`);
          rejected.push({
            filename: stmt.file.originalFilename,
            reason: 'Already processed',
            subject: stmt.subject,
          });
          await fs.unlink(stmt.file.filePath).catch(() => {});
          continue;
        }
        
        // Step 2.1: Parse PDF (quick extraction)
        console.log('   📖 Step 1/3: Parsing PDF...');
        const pdfData = await parsePDF(stmt.file.filePath);
        console.log(`   ✅ Extracted ${pdfData.text.length} characters from ${pdfData.numPages} page(s)`);
        
        // Step 2.2: Content validation
        console.log('   🔍 Step 2/3: Validating content...');
        const validation = isLikelyCreditCardStatement(pdfData.text);
        
        if (!validation.isStatement) {
          console.log(`   ❌ REJECTED: ${validation.reason}`);
          console.log(`   Confidence: ${validation.confidence}, Score: ${validation.score}`);
          
          rejected.push({
            filename: stmt.file.originalFilename,
            reason: validation.reason,
            confidence: validation.confidence,
            score: validation.score,
            subject: stmt.subject,
          });
          
          await fs.unlink(stmt.file.filePath).catch(() => {});
          continue;
        }
        
        console.log(`   ✅ Content validated (Confidence: ${validation.confidence}, Score: ${validation.score})`);
        
        // Step 2.3: Check for card number pattern
        const hasCardNumber = hasCardNumberPattern(pdfData.text);
        console.log(`   💳 Card number pattern: ${hasCardNumber ? '✅ Found' : '⚠️  Not found'}`);
        
        // Create initial statement record
        const statement = new Statement({
          userId,
          fileName: stmt.file.originalFilename,
          processingStatus: 'processing',
          source: 'gmail',
          metadata: {
            gmailMessageId: stmt.messageId,
            gmailSubject: stmt.subject,
            gmailFrom: stmt.from,
            gmailDate: stmt.date,
            validationConfidence: validation.confidence,
            validationScore: validation.score,
            subjectScore: stmt.validation.subjectScore,
            filenameScore: stmt.validation.filenameScore,
            isFromBank: stmt.validation.isFromBank,
          },
        });
        await statement.save();
        
        // Update with raw text
        statement.rawExtractedText = pdfData.text;
        await statement.save();
        
        // Step 2.4: Extract with Groq AI
        console.log('   🤖 Step 3/3: Extracting reward points with AI...');
        const groqResult = await extractRewardPoints(pdfData.text, pdfData);
        
        console.log(`   ✅ AI extraction complete (Bank: ${groqResult.bankName || 'Unknown'})`);
        console.log(`   Confidence: ${groqResult.confidence}`);
        
        // Update statement with results
        const rp = groqResult.rewardPoints || {};
        
        statement.bankName = groqResult.bankName || 'Unknown';
        statement.statementPeriod = groqResult.statementPeriod;
        statement.rewardPoints = {
          opening: rp.opening ?? null,
          earned: rp.earned ?? null,
          redeemed: rp.redeemed ?? null,
          adjustedLapsed: rp.adjustedLapsed ?? null,
          closing: rp.closing ?? null,
          breakdown: Array.isArray(rp.breakdown) ? rp.breakdown : null,
        };
        statement.aiResponse = groqResult;
        statement.processingStatus = 'completed';
        
        await statement.save();
        
        processed.push(statement);
        console.log(`   ✅ Successfully processed and saved to database`);
        
        // Clean up file
        await fs.unlink(stmt.file.filePath).catch(() => {});
        
      } catch (error) {
        console.error(`   ❌ Error processing ${stmt.file.originalFilename}:`, error.message);
        
        failed.push({
          filename: stmt.file.originalFilename,
          error: error.message,
          subject: stmt.subject,
        });
        
        // Update statement status to failed
        try {
          await Statement.findOneAndUpdate(
            {
              userId,
              fileName: stmt.file.originalFilename,
              'metadata.gmailMessageId': stmt.messageId,
            },
            {
              processingStatus: 'failed',
              errorMessage: error.message,
            }
          );
        } catch (updateError) {
          console.error('   ⚠️  Error updating failed statement:', updateError.message);
        }
        
        // Clean up file
        await fs.unlink(stmt.file.filePath).catch(() => {});
      }
    }
    
    // Final summary
    console.log('\n' + '═'.repeat(70));
    console.log('✅ GMAIL FETCH COMPLETE');
    console.log('═'.repeat(70));
    console.log('📊 STATISTICS:');
    console.log('   📧 Emails searched:              ', result.statistics?.searched || 0);
    console.log('   ⏭️  Filtered by Gmail query:      ', result.statistics?.skippedBySubject || 0);
    console.log('   📥 PDFs downloaded:              ', result.statistics?.downloaded || 0);
    console.log('   ❌ Rejected by content validation:', rejected.length);
    console.log('   ✅ Successfully processed:       ', processed.length);
    console.log('   ⚠️  Failed during processing:    ', failed.length);
    console.log('═'.repeat(70) + '\n');
    
    res.json({
      success: true,
      message: `Successfully processed ${processed.length} credit card statement(s)`,
      processed: processed.length,
      failed: failed.length,
      rejected: rejected.length,
      totalSearched: result.statistics?.searched || 0,
      totalDownloaded: result.statistics?.downloaded || 0,
      statistics: {
        searched: result.statistics?.searched || 0,
        skippedByGmailQuery: result.statistics?.skippedBySubject || 0,
        downloaded: result.statistics?.downloaded || 0,
        rejectedByContent: rejected.length,
        processed: processed.length,
        failed: failed.length,
      },
      statements: processed,
      errors: failed.length > 0 ? failed : undefined,
      rejectedFiles: rejected.length > 0 ? rejected : undefined,
    });
    
  } catch (error) {
    console.error('\n❌ FATAL ERROR in fetch statements:', error);
    next(error);
  }
};

/**
 * Get bank email domains
 */
export const getBankDomains = async (req, res, next) => {
  try {
    const domains = getBankEmailDomains();
    res.json({
      success: true,
      count: domains.length,
      domains,
    });
  } catch (error) {
    next(error);
  }
};