import fs from 'fs/promises';
import { PDFDocument } from 'pdf-lib';
import { PDFExtract } from 'pdf.js-extract';
import { convertPDFToImages, isPDFScanned, cleanupImages } from './imageProcessor.js';
import { performOCROnMultipleImages, performAdaptiveOCR, validateOCRResults } from './ocrService.js';

const pdfExtract = new PDFExtract();

/**
 * Parse PDF and extract text content
 * Automatically detects and handles scanned PDFs with OCR
 */
export const parsePDF = async (filePath) => {
  try {
    console.log('\n=== Starting PDF Parsing ===');
    console.log(`📄 File: ${filePath}`);
    
    // First, try standard text extraction using pdf.js-extract
    const data = await pdfExtract.extract(filePath);
    
    // Extract text from all pages
    let text = '';
    data.pages.forEach(page => {
      page.content.forEach(item => {
        if (item.str) {
          text += item.str + ' ';
        }
      });
      text += '\n';
    });
    
    console.log(`📊 PDF Pages: ${data.pages.length}`);
    console.log(`📝 Extracted text length: ${text.trim().length} characters`);
    
    // Check if we got meaningful text (text-based PDF)
    const isScanned = isPDFScanned(text, { numPages: data.pages.length });
    
    if (!isScanned && text.trim().length > 100) {
      console.log('✅ Text-based PDF detected - Using direct extraction');
      console.log('=== PDF Parsing Complete ===\n');
      
      return {
        text: text.trim(),
        numPages: data.pages.length,
        isScanned: false,
        extractionMethod: 'direct',
        metadata: data.meta,
      };
    }
    
    // PDF is scanned or has minimal text - use OCR
    console.log('⚠️  Scanned PDF detected - Switching to OCR mode');
    return await parsePDFWithOCR(filePath, data);
    
  } catch (error) {
    console.error('❌ PDF Parsing Error:', error);
    throw new Error(`Failed to parse PDF: ${error.message}`);
  }
};

/**
 * Parse scanned PDF using OCR
 */
const parsePDFWithOCR = async (filePath, pdfData) => {
  let imagePaths = [];
  
  try {
    console.log('\n--- Starting OCR Process ---');
    
    // Convert PDF pages to images
    const conversionResult = await convertPDFToImages(filePath);
    imagePaths = conversionResult.imagePaths;
    
    if (imagePaths.length === 0) {
      throw new Error('No images generated from PDF');
    }
    
    // Perform OCR on all pages
    console.log(`\n🔍 Running OCR on ${imagePaths.length} page(s)...`);
    
    let ocrResult;
    if (imagePaths.length === 1) {
      // Single page - use adaptive OCR for best results
      ocrResult = await performAdaptiveOCR(imagePaths[0]);
      ocrResult = {
        text: ocrResult.text,
        averageConfidence: ocrResult.confidence,
        totalPages: 1,
        pages: [{ page: 1, ...ocrResult }],
      };
    } else {
      // Multiple pages
      ocrResult = await performOCROnMultipleImages(imagePaths);
    }
    
    // Validate OCR results
    const validation = validateOCRResults({
      text: ocrResult.text,
      confidence: ocrResult.averageConfidence,
    });
    
    console.log(`\n✅ OCR Process Complete`);
    console.log(`   Average Confidence: ${ocrResult.averageConfidence.toFixed(2)}%`);
    console.log(`   Text Extracted: ${ocrResult.text.length} characters`);
    
    if (validation.warning) {
      console.log(`   ⚠️  Warning: ${validation.warning}`);
      console.log(`   💡 ${validation.suggestion}`);
    }
    
    // Clean up temporary images
    console.log(`\n🗑️  Cleaning up temporary files...`);
    await cleanupImages(imagePaths);
    console.log('=== PDF Parsing Complete ===\n');
    
    return {
      text: ocrResult.text,
      numPages: ocrResult.totalPages,
      isScanned: true,
      extractionMethod: 'ocr',
      ocrConfidence: ocrResult.averageConfidence,
      ocrValidation: validation,
      ocrPages: ocrResult.pages.map(p => ({
        page: p.page,
        confidence: p.confidence,
        lines: p.lines,
        words: p.words,
      })),
      metadata: pdfData.meta,
    };
    
  } catch (error) {
    console.error('❌ OCR Process Error:', error);
    
    // Clean up images even on error
    if (imagePaths.length > 0) {
      console.log('🗑️  Cleaning up after error...');
      await cleanupImages(imagePaths);
    }
    
    throw new Error(`OCR processing failed: ${error.message}`);
  }
};

/**
 * Extract additional metadata from PDF
 */
export const extractPDFMetadata = async (filePath) => {
  try {
    const dataBuffer = await fs.readFile(filePath);
    const pdfDoc = await PDFDocument.load(dataBuffer);
    
    return {
      pageCount: pdfDoc.getPageCount(),
      title: pdfDoc.getTitle(),
      author: pdfDoc.getAuthor(),
      subject: pdfDoc.getSubject(),
      creator: pdfDoc.getCreator(),
      producer: pdfDoc.getProducer(),
      creationDate: pdfDoc.getCreationDate(),
      modificationDate: pdfDoc.getModificationDate(),
    };
  } catch (error) {
    console.error('Metadata extraction error:', error);
    return null;
  }
};