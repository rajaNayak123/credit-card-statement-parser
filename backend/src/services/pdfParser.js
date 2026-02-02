import fs from 'fs/promises';
import { PDFDocument } from 'pdf-lib';
import { PDFExtract } from 'pdf.js-extract';

const pdfExtract = new PDFExtract();

/**
 * Parse PDF and extract text content
 * Handles both text-based and scanned PDFs
 */
export const parsePDF = async (filePath) => {
  try {
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
    
    // Check if we got meaningful text (text-based PDF)
    if (text.trim().length > 100) {
      return {
        text: text.trim(),
        numPages: data.pages.length,
        isScanned: false,
        metadata: data.meta,
      };
    }
    
    // If very little text, might be scanned PDF
    return {
      text: text.trim() || 'Scanned PDF - No text extracted. Image data present.',
      numPages: data.pages.length,
      isScanned: true,
      metadata: data.meta,
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