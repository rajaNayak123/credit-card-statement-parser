import Statement from '../models/Statement.js';
import { parsePDF, extractPDFMetadata } from '../services/pdfParser.js';
import { extractRewardPoints, validateExtractedData } from '../services/geminiService.js';
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
        error: 'No file uploaded' 
      });
    }
    
    filePath = req.file.path;
    
    // Create initial statement record
    const statement = new Statement({
      fileName: req.file.originalname,
      processingStatus: 'processing',
    });
    await statement.save();
    
    // Step 1: Parse PDF
    const pdfData = await parsePDF(filePath);
    const metadata = await extractPDFMetadata(filePath);
    
    // Update statement with raw text
    statement.rawExtractedText = pdfData.text;
    await statement.save();
    
    // Step 2: Send to Gemini for extraction
    const geminiResult = await extractRewardPoints(pdfData.text, pdfData);
    
    // Step 3: Validate extracted data
    const validation = validateExtractedData(geminiResult);
    if (!validation.valid) {
      throw new Error(validation.error);
    }
    
    // Step 4: Update statement with results
    statement.bankName = geminiResult.bankName || 'Unknown';
    statement.statementPeriod = geminiResult.statementPeriod;
    statement.rewardPoints = geminiResult.rewardPoints;
    statement.geminiResponse = geminiResult;
    statement.processingStatus = 'completed';
    await statement.save();
    
    // Clean up uploaded file
    await fs.unlink(filePath);
    
    res.status(200).json({
      success: true,
      data: statement,
      message: 'Statement processed successfully',
    });
    
  } catch (error) {
    console.error('Upload Statement Error:', error);
    
    // Clean up file if exists
    if (filePath) {
      try {
        await fs.unlink(filePath);
      } catch (unlinkError) {
        console.error('Error deleting file:', unlinkError);
      }
    }
    
    // Update statement status to failed if it exists
    if (req.file) {
      try {
        await Statement.findOneAndUpdate(
          { fileName: req.file.originalname },
          { 
            processingStatus: 'failed',
            errorMessage: error.message 
          }
        );
      } catch (updateError) {
        console.error('Error updating statement status:', updateError);
      }
    }
    
    next(error);
  }
};

/**
 * Get all statements
 */
export const getAllStatements = async (req, res, next) => {
  try {
    const statements = await Statement.find()
      .sort({ uploadDate: -1 })
      .select('-rawExtractedText -geminiResponse');
    
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
    const statement = await Statement.findById(req.params.id);
    
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
    const statement = await Statement.findByIdAndDelete(req.params.id);
    
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