import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';
import { logger } from './logger';

interface OptimizationOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'webp' | 'jpeg' | 'png';
}

/**
 * Vital Algorithm: Automatic Image Optimization
 * Compresses images to WebP format for 60-80% size reduction
 * Ensures fast page loads and mobile performance
 */
export async function optimizeImage(
  inputPath: string,
  outputPath: string,
  options: OptimizationOptions = {}
): Promise<{ originalSize: number; optimizedSize: number; savings: string }> {
  const {
    maxWidth = 1920,
    maxHeight = 1080,
    quality = 85,
    format = 'webp'
  } = options;

  try {
    // Get original file size
    const originalStats = await fs.stat(inputPath);
    const originalSize = originalStats.size;

    // Optimize image
    const pipeline = sharp(inputPath);
    
    // Get metadata
    const metadata = await pipeline.metadata();
    
    // Resize if needed (maintain aspect ratio)
    if (metadata.width && metadata.width > maxWidth || 
        metadata.height && metadata.height > maxHeight) {
      pipeline.resize(maxWidth, maxHeight, {
        fit: 'inside',
        withoutEnlargement: true
      });
    }

    // Convert to optimized format
    if (format === 'webp') {
      pipeline.webp({ quality, effort: 6 });
    } else if (format === 'jpeg') {
      pipeline.jpeg({ quality, mozjpeg: true });
    } else if (format === 'png') {
      pipeline.png({ quality, compressionLevel: 9 });
    }

    // Save optimized image
    await pipeline.toFile(outputPath);

    // Get optimized file size
    const optimizedStats = await fs.stat(outputPath);
    const optimizedSize = optimizedStats.size;

    const savingsPercent = ((originalSize - optimizedSize) / originalSize * 100).toFixed(1);
    const savings = `${savingsPercent}% (${(originalSize / 1024 / 1024).toFixed(2)}MB → ${(optimizedSize / 1024 / 1024).toFixed(2)}MB)`;

    logger.info('Image optimized successfully', {
      inputPath,
      outputPath,
      originalSize,
      optimizedSize,
      savings
    });

    return { originalSize, optimizedSize, savings };
  } catch (error) {
    logger.error('Image optimization failed', { inputPath, error });
    throw error;
  }
}

/**
 * Batch optimize all images in a directory
 */
export async function batchOptimizeImages(
  inputDir: string,
  outputDir: string,
  options: OptimizationOptions = {}
): Promise<{ total: number; success: number; failed: number; totalSavings: string }> {
  try {
    // Ensure output directory exists
    await fs.mkdir(outputDir, { recursive: true });

    // Get all image files
    const files = await fs.readdir(inputDir);
    const imageFiles = files.filter(file => 
      /\.(jpg|jpeg|png|webp)$/i.test(file)
    );

    let success = 0;
    let failed = 0;
    let totalOriginalSize = 0;
    let totalOptimizedSize = 0;

    for (const file of imageFiles) {
      try {
        const inputPath = path.join(inputDir, file);
        const outputFileName = file.replace(/\.(jpg|jpeg|png)$/i, '.webp');
        const outputPath = path.join(outputDir, outputFileName);

        const result = await optimizeImage(inputPath, outputPath, options);
        totalOriginalSize += result.originalSize;
        totalOptimizedSize += result.optimizedSize;
        success++;
      } catch (error) {
        logger.error('Failed to optimize image', { file, error });
        failed++;
      }
    }

    const totalSavingsPercent = totalOriginalSize > 0
      ? ((totalOriginalSize - totalOptimizedSize) / totalOriginalSize * 100).toFixed(1)
      : '0';
    
    const totalSavings = `${totalSavingsPercent}% (${(totalOriginalSize / 1024 / 1024).toFixed(2)}MB → ${(totalOptimizedSize / 1024 / 1024).toFixed(2)}MB)`;

    logger.info('Batch optimization complete', {
      total: imageFiles.length,
      success,
      failed,
      totalSavings
    });

    return {
      total: imageFiles.length,
      success,
      failed,
      totalSavings
    };
  } catch (error) {
    logger.error('Batch optimization failed', { inputDir, error });
    throw error;
  }
}

/**
 * Middleware for automatic upload optimization
 */
export function optimizeUploadedImage(file: Express.Multer.File): Promise<Buffer> {
  return sharp(file.buffer)
    .resize(1920, 1080, {
      fit: 'inside',
      withoutEnlargement: true
    })
    .webp({ quality: 85, effort: 6 })
    .toBuffer();
}
