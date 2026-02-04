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
   * Fetch statements from Gmail
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
  
      const userId = req.user.id; // From Better Auth
      
      // Get filters from query params
      const filters = {
        after: req.query.after, // Format: YYYY/MM/DD
        before: req.query.before,
        from: req.query.from,
        maxResults: parseInt(req.query.maxResults) || 20,
      };
      
      console.log('\n=== Starting Gmail Statement Fetch ===');
      console.log('User ID:', userId);
      console.log('Filters:', filters);
      
      // Fetch statements
      const result = await fetchAllStatements(filters);
      
      if (result.count === 0) {
        return res.json({
          success: true,
          message: 'No statements found',
          processed: 0,
          failed: 0,
          statements: [],
        });
      }
      
      // Process each statement
      const processed = [];
      const failed = [];
      
      for (const stmt of result.statements) {
        try {
          console.log(`\n📄 Processing: ${stmt.file.originalFilename}`);
          
          // Check if already processed (avoid duplicates)
          const existing = await Statement.findOne({
            userId,
            fileName: stmt.file.originalFilename,
            'metadata.gmailMessageId': stmt.messageId,
          });
          
          if (existing) {
            console.log(`   ⏭️  Already processed, skipping`);
            continue;
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
            },
          });
          await statement.save();
          
          // Parse PDF
          const pdfData = await parsePDF(stmt.file.filePath);
          
          // Update with raw text
          statement.rawExtractedText = pdfData.text;
          await statement.save();
          
          // Extract with Groq
          const groqResult = await extractRewardPoints(pdfData.text, pdfData);
          
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
          console.log(`   ✅ Successfully processed`);
          
          // Clean up file
          await fs.unlink(stmt.file.filePath);
          
        } catch (error) {
          console.error(`   ❌ Error processing ${stmt.file.originalFilename}:`, error);
          
          failed.push({
            filename: stmt.file.originalFilename,
            error: error.message,
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
            console.error('Error updating failed statement:', updateError);
          }
          
          // Clean up file
          try {
            await fs.unlink(stmt.file.filePath);
          } catch (unlinkError) {
            console.error('Error deleting file:', unlinkError);
          }
        }
      }
      
      console.log('\n=== Gmail Fetch Complete ===');
      console.log(`✅ Processed: ${processed.length}`);
      console.log(`❌ Failed: ${failed.length}`);
      
      res.json({
        success: true,
        message: `Processed ${processed.length} statement(s)`,
        processed: processed.length,
        failed: failed.length,
        statements: processed,
        errors: failed,
      });
      
    } catch (error) {
      console.error('❌ Fetch statements error:', error);
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
        domains,
      });
    } catch (error) {
      next(error);
    }
  };