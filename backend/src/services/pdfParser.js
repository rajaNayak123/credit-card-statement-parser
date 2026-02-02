import fs from 'fs/promises';
import pdfParse from 'pdf-parse';
import { PDFDocument } from 'pdf-lib';

/**
 * Parse PDF and extract text content
 * Handles both text-based and scanned PDFs
 */
export const parsePDF = async (filePath) => {
  try {
    const dataBuffer = await fs.readFile(filePath);
    
    // First, try standard text extraction
    const pdfData = await pdfParse(dataBuffer);
    
    // Check if we got meaningful text (text-based PDF)
    if (pdfData.text && pdfData.text.trim().length > 100) {
      return {
        text: pdfData.text,
        numPages: pdfData.numpages,
        isScanned: false,
        metadata: pdfData.info,
      };
    }
    
    // If very little text, might be scanned PDF
    // For scanned PDFs, we'll still send whatever text we got
    // Gemini can handle both scenarios
    return {
      text: pdfData.text || 'Scanned PDF - No text extracted. Image data present.',
      numPages: pdfData.numpages,
      isScanned: true,
      metadata: pdfData.info,
      note: 'This appears to be a scanned PDF. Consider using OCR for better results.',
    };
    
  } catch (error) {
    console.error('PDF Parsing Error:', error);
    throw new Error(`Failed to parse PDF: ${error.message}`);
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