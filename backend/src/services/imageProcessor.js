import { convert } from 'pdf-poppler';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Convert PDF to images (one image per page)
 */
export const convertPDFToImages = async (pdfPath, outputDir = null) => {
  try {
    // Create temp directory if not provided
    if (!outputDir) {
      const tempDir = path.join(process.cwd(), 'temp');
      await fs.mkdir(tempDir, { recursive: true });
      outputDir = path.join(tempDir, `pdf_${Date.now()}`);
      await fs.mkdir(outputDir, { recursive: true });
    }

    const pdfName = path.basename(pdfPath, '.pdf');
    
    const options = {
      format: 'png',
      out_dir: outputDir,
      out_prefix: pdfName,
      page: null, // Convert all pages
      scale: 2048, // Higher scale for better OCR
      single_file: false,
    };

    console.log(`📄 Converting PDF to images: ${path.basename(pdfPath)}`);
    await convert(pdfPath, options);

    // Get all generated image files
    const files = await fs.readdir(outputDir);
    const imageFiles = files
      .filter(file => file.startsWith(pdfName) && file.endsWith('.png'))
      .sort((a, b) => {
        // Sort by page number
        const pageA = parseInt(a.match(/-(\d+)\.png$/)?.[1] || '0');
        const pageB = parseInt(b.match(/-(\d+)\.png$/)?.[1] || '0');
        return pageA - pageB;
      })
      .map(file => path.join(outputDir, file));

    console.log(`✅ Converted ${imageFiles.length} pages to images`);

    return {
      imagePaths: imageFiles,
      outputDir,
      totalPages: imageFiles.length,
    };
  } catch (error) {
    console.error('❌ PDF to Image conversion error:', error);
    throw new Error(`Failed to convert PDF to images: ${error.message}`);
  }
};

/**
 * Check if PDF is likely scanned (image-based)
 */
export const isPDFScanned = (pdfText, metadata = {}) => {
  // If very little text extracted, likely scanned
  if (!pdfText || pdfText.trim().length < 100) {
    return true;
  }
  
  // Check for typical indicators of scanned PDFs
  const textDensity = pdfText.trim().length / (metadata.numPages || 1);
  
  // Less than 200 characters per page suggests scanned document
  if (textDensity < 200) {
    return true;
  }
  
  // Check for gibberish or encoding issues
  const gibberishRatio = (pdfText.match(/[^\x20-\x7E]/g) || []).length / pdfText.length;
  if (gibberishRatio > 0.3) {
    return true;
  }
  
  return false;
};

/**
 * Optimize image for OCR
 */
export const optimizeImageForOCR = async (imagePath) => {
  try {
    const sharp = (await import('sharp')).default;
    const optimizedPath = imagePath.replace(/\.png$/, '_optimized.png');
    
    await sharp(imagePath)
      .resize(3000, 4000, { // Standard A4 size at high DPI
        fit: 'inside',
        withoutEnlargement: true,
      })
      .greyscale()
      .normalize()
      .sharpen()
      .png({ quality: 100, compressionLevel: 6 })
      .toFile(optimizedPath);
    
    return optimizedPath;
  } catch (error) {
    console.error('Image optimization error:', error);
    return imagePath; // Return original if optimization fails
  }
};

/**
 * Clean up temporary images
 */
export const cleanupImages = async (imagePaths) => {
  try {
    for (const imagePath of imagePaths) {
      try {
        await fs.unlink(imagePath);
      } catch (err) {
        console.error(`Failed to delete image: ${imagePath}`, err);
      }
    }
    
    // Try to remove the directory if empty
    if (imagePaths.length > 0) {
      const dir = path.dirname(imagePaths[0]);
      try {
        const files = await fs.readdir(dir);
        if (files.length === 0) {
          await fs.rmdir(dir);
          console.log(`🗑️  Cleaned up temp directory: ${dir}`);
        }
      } catch (err) {
        // Directory not empty or already deleted
      }
    }
  } catch (error) {
    console.error('Cleanup error:', error);
  }
};

/**
 * Get image metadata
 */
export const getImageMetadata = async (imagePath) => {
  try {
    const sharp = (await import('sharp')).default;
    const metadata = await sharp(imagePath).metadata();
    
    return {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      space: metadata.space,
      channels: metadata.channels,
      depth: metadata.depth,
      density: metadata.density,
      hasAlpha: metadata.hasAlpha,
    };
  } catch (error) {
    console.error('Failed to get image metadata:', error);
    return null;
  }
};