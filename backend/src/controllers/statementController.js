import Statement from '../models/Statement.js';
import { parsePDF, extractPDFMetadata } from '../services/pdfParser.js';
import { extractRewardPoints, validateExtractedData } from '../services/groqService.js';
import fs from 'fs/promises';

/**
 * Upload and process credit card statement
 */
export const uploadStatement = async (req, res, next) => {
  let filePath = null;
  
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded',
      });
    }

    const userId = req.user.id; // 👈 from Better Auth
    filePath = req.file.path;
    
    // Create initial statement record
    const statement = new Statement({
      userId,
      fileName: req.file.originalname,
      processingStatus: 'processing',
    });
    await statement.save();
    
    // Step 1: Parse PDF
    const pdfData = await parsePDF(filePath);
    const metadata = await extractPDFMetadata(filePath);
    
    
    // LOG RAW PDF DATA
    console.log('--- Raw PDF Data Extracted ---');
    console.log('Text Length:', pdfData.text.length);
    console.log('Is Scanned:', pdfData.isScanned);
    console.log('Page Count:', pdfData.numPages);

    // Update statement with raw text

    // LOG RAW PDF DATA
    console.log('--- Raw PDF Data Extracted ---');
    console.log('Text Length:', pdfData.text.length);
    console.log('Is Scanned:', pdfData.isScanned);
    console.log('Page Count:', pdfData.numPages);

    // Update statement with raw text
    statement.rawExtractedText = pdfData.text;
    await statement.save();
    
    // Step 2: Send to Groq for extraction
    const groqResult = await extractRewardPoints(pdfData.text, pdfData);
    
    // LOG GROQ ANALYSIS RESULT
    console.log('--- Groq Extracted Data ---');
    console.log(JSON.stringify(groqResult, null, 2));
    
    // Step 3: Validate extracted data
    const validation = validateExtractedData(groqResult);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

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
    
    // Clean up uploaded file
    await fs.unlink(filePath);

    res.status(200).json({
      success: true,
      data: statement,
    });
  } catch (error) {
    if (filePath) await fs.unlink(filePath).catch(() => {});
    next(error);
  }
};

/**
 * Get all statements
 */
export const getAllStatements = async (req, res, next) => {
  try {
    const statements = await Statement.find({ userId: req.user.id })
      .sort({ uploadDate: -1 })
      .select('-rawExtractedText -aiResponse');
    
    res.status(200).json({
      success: true,
      count: statements.length,
      data: statements,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get single statement by ID
 */
export const getStatementById = async (req, res, next) => {
  try {
    const statement = await Statement.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!statement) {
      return res.status(404).json({
        success: false,
        error: 'Statement not found',
      });
    }
    
    res.status(200).json({
      success: true,
      data: statement,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete statement
 */
export const deleteStatement = async (req, res, next) => {
  try {
    const statement = await Statement.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!statement) {
      return res.status(404).json({
        success: false,
        error: 'Statement not found',
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Statement deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};