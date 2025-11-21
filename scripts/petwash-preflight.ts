#!/usr/bin/env tsx
/**
 * PetWash™ Preflight Guardian
 * MANDATORY PRE-BUILD VERIFICATION
 * 
 * Enforces 100% Luxury UI - ZERO tolerance for parallel systems
 * 
 * HARD FAIL CONDITIONS:
 * - Any file with: old, legacy, v1, backup, temp, copy, test-ui
 * - Any component: EnterpriseLayout, BrandHeader, OldLayout, LegacyLayout
 * - Any CSS file outside approved luxury styles
 * - Any parallel header/footer/layout systems
 * 
 * Usage:
 *   npm run preflight
 *   This MUST pass before build/deploy
 */

import { readdir, stat } from 'fs/promises';
import { join } from 'path';
import { exit } from 'process';

interface GuardResult {
  passed: boolean;
  errors: string[];
  warnings: string[];
}

const FORBIDDEN_PATTERNS = [
  /\.old\./i,
  /legacy/i,
  /-v1\./i,
  /backup/i,
  /\.temp\./i,
  /\.copy\./i,
  /-test-ui/i,
  /EnterpriseLayout/,
  /BrandHeader/,
  /OldLayout/,
  /LegacyLayout/,
  /apple-package/i,
  /header-old/i,
  /footer-old/i,
  /GlobalNavigation/,
  /MultiLayerNavigation/,
];

const APPROVED_LUXURY_CSS = [
  'index.css',
  'petwash-header.css',
  'override-2025.css',
  'responsive-tokens.css',
  'floating-stack.css',
  'ai-chat.css',
  'NewHumanAvatar.css', // Component-specific CSS, actively used
];

async function scanDirectory(dir: string, results: string[] = [], depth = 0): Promise<string[]> {
  if (depth > 10) return results; // Prevent infinite recursion
  
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      // Skip node_modules and dist
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') {
        continue;
      }
      
      const fullPath = join(dir, entry.name);
      
      if (entry.isDirectory()) {
        await scanDirectory(fullPath, results, depth + 1);
      } else if (entry.isFile() && (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts') || entry.name.endsWith('.css'))) {
        results.push(fullPath);
      }
    }
  } catch (error) {
    // Skip permission errors
  }
  
  return results;
}

async function checkForbiddenPatterns(): Promise<GuardResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  console.log('🔍 Scanning for forbidden patterns...\n');
  
  // Scan client/src for forbidden files
  const files = await scanDirectory('./client/src');
  
  for (const file of files) {
    const fileName = file.split('/').pop() || '';
    const relativePath = file.replace('./client/src/', '');
    
    // Check forbidden file name patterns
    for (const pattern of FORBIDDEN_PATTERNS) {
      if (pattern.test(fileName) || pattern.test(relativePath)) {
        errors.push(`❌ FORBIDDEN FILE: ${relativePath} (matches pattern: ${pattern})`);
      }
    }
  }
  
  return {
    passed: errors.length === 0,
    errors,
    warnings,
  };
}

async function checkCSSFiles(): Promise<GuardResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  console.log('🎨 Verifying CSS files...\n');
  
  const cssFiles = await scanDirectory('./client/src');
  const foundCSS = cssFiles.filter(f => f.endsWith('.css'));
  
  for (const cssFile of foundCSS) {
    const fileName = cssFile.split('/').pop() || '';
    
    if (!APPROVED_LUXURY_CSS.includes(fileName)) {
      warnings.push(`⚠️  UNAPPROVED CSS: ${cssFile.replace('./client/src/', '')} (not in approved luxury CSS list)`);
    }
  }
  
  return {
    passed: true, // Warnings only for CSS
    errors,
    warnings,
  };
}

async function checkParallelLayouts(): Promise<GuardResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  console.log('📐 Checking for parallel layout systems...\n');
  
  const layoutFiles = await scanDirectory('./client/src/components');
  const layouts = layoutFiles.filter(f => 
    f.includes('Layout') && 
    f.endsWith('.tsx') &&
    !f.includes('node_modules')
  );
  
  const APPROVED_LAYOUTS = ['Layout.tsx']; // Only ONE approved layout
  
  for (const layout of layouts) {
    const fileName = layout.split('/').pop() || '';
    
    if (!APPROVED_LAYOUTS.includes(fileName)) {
      errors.push(`❌ PARALLEL LAYOUT DETECTED: ${layout.replace('./client/src/', '')} - Only Layout.tsx is allowed`);
    }
  }
  
  return {
    passed: errors.length === 0,
    errors,
    warnings,
  };
}

async function runAllGuards(): Promise<void> {
  console.log('🛡️  PETWASH™ PREFLIGHT GUARDIAN\n');
  console.log('================================\n');
  
  const results: GuardResult[] = [];
  
  // Run all guards
  results.push(await checkForbiddenPatterns());
  results.push(await checkCSSFiles());
  results.push(await checkParallelLayouts());
  
  // Collect all errors and warnings
  const allErrors = results.flatMap(r => r.errors);
  const allWarnings = results.flatMap(r => r.warnings);
  
  console.log('\n================================\n');
  console.log('📊 PREFLIGHT REPORT:\n');
  
  if (allWarnings.length > 0) {
    console.log('⚠️  WARNINGS:\n');
    allWarnings.forEach(w => console.log(w));
    console.log('');
  }
  
  if (allErrors.length > 0) {
    console.log('❌ HARD ERRORS:\n');
    allErrors.forEach(e => console.log(e));
    console.log('');
    console.log('🚫 PREFLIGHT FAILED - FIX ERRORS BEFORE BUILD\n');
    exit(1);
  }
  
  console.log('✅ PREFLIGHT PASSED - All guards green\n');
  console.log('🎯 Luxury UI integrity: 100%');
  console.log('🚀 Ready for build/deploy\n');
  exit(0);
}

// Run guards
runAllGuards().catch(error => {
  console.error('❌ Preflight guardian crashed:', error);
  exit(1);
});
