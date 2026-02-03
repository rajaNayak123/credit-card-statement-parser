import Tesseract from 'tesseract.js';
import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';

/**
 * Preprocess image for better OCR results
 */
const preprocessImage = async (imagePath) => {
  try {
    const processedPath = imagePath.replace(/\.(png|jpg|jpeg)$/, '_processed.png');
    
    // Optimize image for OCR
    await sharp(imagePath)
      .greyscale() // Convert to grayscale
      .normalize() // Normalize contrast
      .sharpen() // Sharpen edges
      .threshold(128) // Apply threshold for better text detection
      .png({ quality: 100 })
      .toFile(processedPath);
    
    return processedPath;
  } catch (error) {
    console.error('Image preprocessing error:', error);
    // Return original path if preprocessing fails
    return imagePath;
  }
};

/**
 * Perform OCR on a single image
 */
export const performOCR = async (imagePath, options = {}) => {
  const {
    lang = 'eng',
    preprocessImage: shouldPreprocess = true,
    psm = 3, // Page segmentation mode (3 = Fully automatic page segmentation)
  } = options;

  try {
    console.log(`🔍 Starting OCR on image: ${path.basename(imagePath)}`);
    
    // Preprocess image if enabled
    const imageToProcess = shouldPreprocess 
      ? await preprocessImage(imagePath)
      : imagePath;
    
    // Perform OCR with Tesseract
    const worker = await Tesseract.createWorker(lang, 1, {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          console.log(`   OCR Progress: ${Math.round(m.progress * 100)}%`);
        }
      },
    });

    // Set page segmentation mode and character whitelist
    await worker.setParameters({
      tessedit_pageseg_mode: psm,
      tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz .,:-/$%₹@#&()[]',
    });

    const { data } = await worker.recognize(imageToProcess);
    await worker.terminate();

    // Clean up processed image if it was created
    if (shouldPreprocess && imageToProcess !== imagePath) {
      try {
        await fs.unlink(imageToProcess);
      } catch (err) {
        // Ignore cleanup errors
      }
    }

    console.log(`✅ OCR completed - Confidence: ${data.confidence.toFixed(2)}%`);

    return {
      text: data.text,
      confidence: data.confidence,
      lines: data.lines.length,
      words: data.words.length,
    };
  } catch (error) {
    console.error('❌ OCR Error:', error);
    throw new Error(`OCR failed: ${error.message}`);
  }
};

/**
 * Perform OCR on multiple images and combine results
 */
export const performOCROnMultipleImages = async (imagePaths, options = {}) => {
  try {
    console.log(`📄 Processing ${imagePaths.length} pages with OCR`);
    
    const results = [];
    let combinedText = '';
    let totalConfidence = 0;

    for (let i = 0; i < imagePaths.length; i++) {
      console.log(`\n📑 Processing page ${i + 1}/${imagePaths.length}`);
      
      const result = await performOCR(imagePaths[i], options);
      results.push({
        page: i + 1,
        ...result,
      });
      
      combinedText += `\n--- Page ${i + 1} ---\n${result.text}\n`;
      totalConfidence += result.confidence;
    }

    const averageConfidence = totalConfidence / imagePaths.length;

    console.log(`\n✅ Multi-page OCR completed - Average confidence: ${averageConfidence.toFixed(2)}%`);

    return {
      text: combinedText.trim(),
      pages: results,
      averageConfidence,
      totalPages: imagePaths.length,
    };
  } catch (error) {
    console.error('❌ Multi-page OCR Error:', error);
    throw new Error(`Multi-page OCR failed: ${error.message}`);
  }
};

/**
 * Adaptive OCR - tries different settings if confidence is low
 */
export const performAdaptiveOCR = async (imagePath) => {
  try {
    console.log('🔄 Running adaptive OCR...');
    
    // First attempt with default settings
    let result = await performOCR(imagePath, { preprocessImage: true });
    let bestResult = { ...result };
    
    // If confidence is low, try different page segmentation modes
    if (result.confidence < 70) {
      console.log('⚠️  Low confidence detected, trying alternative settings...');
      
      // Try PSM mode 6 (Assume a single uniform block of text)
      console.log('   Trying PSM mode 6...');
      const altResult = await performOCR(imagePath, { 
        preprocessImage: true,
        psm: 6,
      });
      
      if (altResult.confidence > bestResult.confidence) {
        bestResult = altResult;
        console.log(`   ✅ Better result with PSM 6: ${altResult.confidence.toFixed(2)}%`);
      }
    }
    
    // If still low confidence, try without preprocessing
    if (bestResult.confidence < 60) {
      console.log('   Trying without preprocessing...');
      
      const rawResult = await performOCR(imagePath, { 
        preprocessImage: false,
      });
      
      if (rawResult.confidence > bestResult.confidence) {
        bestResult = rawResult;
        console.log(`   ✅ Better result without preprocessing: ${rawResult.confidence.toFixed(2)}%`);
      }
    }

    console.log(`🎯 Best OCR confidence achieved: ${bestResult.confidence.toFixed(2)}%`);
    return bestResult;
  } catch (error) {
    console.error('❌ Adaptive OCR Error:', error);
    throw error;
  }
};

/**
 * Validate OCR results
 */
export const validateOCRResults = (ocrResult) => {
  const { text, confidence } = ocrResult;
  
  // Check if text was extracted
  if (!text || text.trim().length < 10) {
    return {
      valid: false,
      reason: 'Insufficient text extracted',
      suggestion: 'Image may be too low quality or blank',
    };
  }
  
  // Check confidence level
  if (confidence < 40) {
    return {
      valid: true,
      warning: 'Low OCR confidence',
      confidence,
      suggestion: 'Results may be inaccurate. Consider using a higher quality scan.',
    };
  }
  
  if (confidence < 70) {
    return {
      valid: true,
      warning: 'Moderate OCR confidence',
      confidence,
      suggestion: 'Some text may be inaccurate',
    };
  }
  
  return {
    valid: true,
    confidence,
    quality: 'good',
  };
};