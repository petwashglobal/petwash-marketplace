#!/usr/bin/env tsx

import fs from 'fs';
import path from 'path';
import { gzipSync } from 'zlib';

interface SizeCheck {
  path: string;
  size: number;
  limit: number;
  type: string;
}

const KB = 1024;
const BRAND_DIR = path.join(process.cwd(), 'client/public/brand');
const checks: SizeCheck[] = [];
let failed = false;

// Helper to get file size in KB
function getFileSize(filePath: string): number {
  const stats = fs.statSync(filePath);
  return stats.size / KB;
}

// Helper to get gzipped size in KB
function getGzipSize(filePath: string): number {
  const content = fs.readFileSync(filePath);
  const gzipped = gzipSync(content);
  return gzipped.length / KB;
}

// Check 1: Brand assets must be < 24KB
console.log('🔍 Checking brand assets...');
if (fs.existsSync(BRAND_DIR)) {
  const files = fs.readdirSync(BRAND_DIR);
  files.forEach(file => {
    const filePath = path.join(BRAND_DIR, file);
    if (fs.statSync(filePath).isFile()) {
      const size = getFileSize(filePath);
      const limit = 24;
      const check: SizeCheck = { path: filePath, size, limit, type: 'brand-asset' };
      checks.push(check);
      
      if (size > limit) {
        console.error(`❌ ${file}: ${size.toFixed(2)} KB (limit: ${limit} KB)`);
        failed = true;
      } else {
        console.log(`✅ ${file}: ${size.toFixed(2)} KB (limit: ${limit} KB)`);
      }
    }
  });
}

// Check 2: Header logo specific limits
console.log('\n🔍 Checking header logo...');
const logoSvg = path.join(BRAND_DIR, 'petwash-logo.svg');
const logoWebp = path.join(BRAND_DIR, 'petwash-logo@2x.webp');

if (fs.existsSync(logoSvg)) {
  const size = getFileSize(logoSvg);
  const limit = 12;
  const check: SizeCheck = { path: logoSvg, size, limit, type: 'logo-svg' };
  checks.push(check);
  
  if (size > limit) {
    console.error(`❌ SVG Logo: ${size.toFixed(2)} KB (limit: ${limit} KB)`);
    failed = true;
  } else {
    console.log(`✅ SVG Logo: ${size.toFixed(2)} KB (limit: ${limit} KB)`);
  }
}

if (fs.existsSync(logoWebp)) {
  const size = getFileSize(logoWebp);
  const limit = 20;
  const check: SizeCheck = { path: logoWebp, size, limit, type: 'logo-webp' };
  checks.push(check);
  
  if (size > limit) {
    console.error(`❌ WebP Logo: ${size.toFixed(2)} KB (limit: ${limit} KB)`);
    failed = true;
  } else {
    console.log(`✅ WebP Logo: ${size.toFixed(2)} KB (limit: ${limit} KB)`);
  }
}

// Check 3: Login page bundle size (would need Vite build output)
// This check runs during build, checking dist folder
console.log('\n🔍 Checking login page bundle size...');
const distClient = path.join(process.cwd(), 'dist/client');
if (fs.existsSync(distClient)) {
  const files = fs.readdirSync(distClient, { recursive: true }) as string[];
  const jsFiles = files.filter(f => f.endsWith('.js') && !f.includes('node_modules'));
  
  let totalGzipSize = 0;
  jsFiles.forEach(file => {
    const filePath = path.join(distClient, file);
    if (fs.statSync(filePath).isFile()) {
      totalGzipSize += getGzipSize(filePath);
    }
  });
  
  const limit = 120;
  if (totalGzipSize > limit) {
    console.error(`❌ Login bundle (gzipped): ${totalGzipSize.toFixed(2)} KB (limit: ${limit} KB)`);
    failed = true;
  } else {
    console.log(`✅ Login bundle (gzipped): ${totalGzipSize.toFixed(2)} KB (limit: ${limit} KB)`);
  }
}

// Summary
console.log('\n📊 Asset Size Check Summary:');
console.log(`Total checks: ${checks.length}`);
console.log(`Passed: ${checks.filter(c => c.size <= c.limit).length}`);
console.log(`Failed: ${checks.filter(c => c.size > c.limit).length}`);

if (failed) {
  console.error('\n❌ Asset size check FAILED. Please optimize your assets.');
  process.exit(1);
} else {
  console.log('\n✅ All asset size checks PASSED!');
  process.exit(0);
}
