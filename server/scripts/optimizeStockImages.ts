#!/usr/bin/env tsx
/**
 * Optimize all stock images for production
 * Run: tsx server/scripts/optimizeStockImages.ts
 */

import { batchOptimizeImages } from '../lib/imageOptimization';
import path from 'path';

async function main() {
  console.log('🖼️  Starting stock image optimization...\n');

  const inputDir = path.join(process.cwd(), 'attached_assets', 'stock_images');
  const outputDir = path.join(process.cwd(), 'attached_assets', 'stock_images_optimized');

  const result = await batchOptimizeImages(inputDir, outputDir, {
    maxWidth: 1200,
    maxHeight: 800,
    quality: 85,
    format: 'webp'
  });

  console.log('\n✅ Optimization Complete!');
  console.log(`   Total Images: ${result.total}`);
  console.log(`   Success: ${result.success}`);
  console.log(`   Failed: ${result.failed}`);
  console.log(`   Total Savings: ${result.totalSavings}\n`);
}

main().catch(console.error);
