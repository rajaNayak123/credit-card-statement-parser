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
import { isLikelyCreditCardStatement } from '../services/pdfValidator.js';
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
 * Fetch statements from Gmail using new decision flow
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
    
    // Get filters from query params (optional overrides)
    const filters = {
      after: req.query.after,
      before: req.query.before,
      maxResults: parseInt(req.query.maxResults) || 500,
    };
    
    console.log('\n🚀 Starting Gmail fetch for user:', userId);
    console.log('📋 Filters:', JSON.stringify(filters, null, 2));
    
    // Step 1: Fetch statements using decision flow
    const result = await fetchAllStatements(filters);
    
    if (result.count === 0) {
      console.log('\n⚠️  No statements found to process');
      return res.json({
        success: true,
        message: 'No credit card statements found matching criteria',
        processed: 0,
        failed: 0,
        statistics: result.statistics,
        statements: [],
      });
    }
    
    console.log('\n' + '─'.repeat(70));
    console.log('📋 PROCESSING DOWNLOADED STATEMENTS');
    console.log('─'.repeat(70));
    
    // Step 2: Process each statement
    const processed = [];
    const failed = [];
    const duplicates = [];
    
    for (let i = 0; i < result.statements.length; i++) {
      const stmt = result.statements[i];
      
      try {
        console.log(`\n[${i + 1}/${result.statements.length}] 📄 Processing: ${stmt.file.originalFilename}`);
        console.log(`   Decision: ${stmt.decisionCase} - ${stmt.reason}`);
        console.log(`   Subject: ${stmt.subject}`);
        console.log(`   From: ${stmt.from}`);
        
        // Check for duplicates
        const existing = await Statement.findOne({
          userId,
          fileName: stmt.file.originalFilename,
          'metadata.gmailMessageId': stmt.messageId,
        });
        
        if (existing) {
          console.log(`   ⭐️ Already processed (duplicate), skipping`);
          duplicates.push({
            filename: stmt.file.originalFilename,
            subject: stmt.subject,
          });
          await fs.unlink(stmt.file.filePath).catch(() => {});
          continue;
        }
        
        // For Case 3, we already have PDF analysis
        let pdfData;
        let contentValidation;
        
        if (stmt.decisionCase === 'Case 3' && stmt.pdfAnalysis) {
          // Already analyzed in decision flow
          pdfData = stmt.pdfAnalysis.pdfData;
          contentValidation = {
            isStatement: stmt.pdfAnalysis.isBankRelated,
            confidence: stmt.pdfAnalysis.confidence,
            score: stmt.pdfAnalysis.score,
          };
          console.log('   ✅ Using PDF analysis from decision flow');
        } else {
          // Parse and validate for Cases 1 and 2
          console.log('   📖 Step 1/3: Parsing PDF...');
          pdfData = await parsePDF(stmt.file.filePath);
          console.log(`   ✅ Extracted ${pdfData.text.length} characters from ${pdfData.numPages} page(s)`);
          
          console.log('   🔍 Step 2/3: Validating content...');
          contentValidation = isLikelyCreditCardStatement(pdfData.text);
          
          if (!contentValidation.isStatement) {
            console.log(`   ⚠️  Warning: Content validation failed for ${stmt.decisionCase}`);
            console.log(`   Reason: ${contentValidation.reason}`);
            console.log(`   Confidence: ${contentValidation.confidence}`);
            // Continue anyway since it passed decision flow
          } else {
            console.log(`   ✅ Content validated (Confidence: ${contentValidation.confidence})`);
          }
        }
        
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
            senderDomain: stmt.senderDomain,
            decisionCase: stmt.decisionCase,
            decisionReason: stmt.reason,
            validationConfidence: contentValidation?.confidence,
            validationScore: contentValidation?.score,
          },
        });
        await statement.save();
        
        // Save raw text
        statement.rawExtractedText = pdfData.text;
        await statement.save();
        
        // Extract with AI
        console.log('   🤖 Step 3/3: Extracting reward points with AI...');
        const groqResult = await extractRewardPoints(pdfData.text, pdfData);
        
        console.log(`   ✅ AI extraction complete`);
        console.log(`   Bank: ${groqResult.bankName || 'Unknown'}`);
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
        console.log(`   ✅ Successfully processed and saved`);
        
        // Clean up file
        await fs.unlink(stmt.file.filePath).catch(() => {});
        
      } catch (error) {
        console.error(`   ❌ Error processing ${stmt.file.originalFilename}:`, error.message);
        
        failed.push({
          filename: stmt.file.originalFilename,
          error: error.message,
          subject: stmt.subject,
        });
        
        // Update statement status
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
    console.log('\n╔' + '═'.repeat(68) + '╗');
    console.log('║  ✅ GMAIL FETCH COMPLETE' + ' '.repeat(43) + '║');
    console.log('╠' + '═'.repeat(68) + '╣');
    console.log('║  📊 STATISTICS:' + ' '.repeat(53) + '║');
    console.log('╠' + '═'.repeat(68) + '╣');
    console.log(`║  📧 Total emails searched:           ${String(result.statistics.totalEmails).padStart(4)} ` + ' '.repeat(26) + '║');
    console.log(`║  ✅ Case 1 (Bank domain):            ${String(result.statistics.case1).padStart(4)} ` + ' '.repeat(26) + '║');
    console.log(`║  ✅ Case 2 (Keywords):               ${String(result.statistics.case2).padStart(4)} ` + ' '.repeat(26) + '║');
    console.log(`║  ✅ Case 3 (PDF analysis):           ${String(result.statistics.case3).padStart(4)} ` + ' '.repeat(26) + '║');
    console.log(`║  ⏭️  Ignored emails:                  ${String(result.statistics.ignored).padStart(4)} ` + ' '.repeat(26) + '║');
    console.log(`║  📥 PDFs downloaded:                 ${String(result.count).padStart(4)} ` + ' '.repeat(26) + '║');
    console.log(`║  ⭐️ Duplicates skipped:              ${String(duplicates.length).padStart(4)} ` + ' '.repeat(26) + '║');
    console.log(`║  ✅ Successfully processed:          ${String(processed.length).padStart(4)} ` + ' '.repeat(26) + '║');
    console.log(`║  ❌ Failed:                           ${String(failed.length).padStart(4)} ` + ' '.repeat(26) + '║');
    console.log('╚' + '═'.repeat(68) + '╝\n');
    
    res.json({
      success: true,
      message: `Successfully processed ${processed.length} credit card statement(s)`,
      processed: processed.length,
      failed: failed.length,
      duplicates: duplicates.length,
      statistics: {
        ...result.statistics,
        duplicates: duplicates.length,
        successfullyProcessed: processed.length,
        failed: failed.length,
      },
      statements: processed,
      errors: failed.length > 0 ? failed : undefined,
      duplicateFiles: duplicates.length > 0 ? duplicates : undefined,
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