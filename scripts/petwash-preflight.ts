#!/usr/bin/env tsx
/**
 * PetWash™ Preflight Guardian - ENHANCED CONTENT SCANNER
 * MANDATORY PRE-BUILD VERIFICATION
 * 
 * Enforces 100% Luxury UI - ZERO tolerance for parallel systems
 * 
 * HARD FAIL CONDITIONS:
 * - Any file with forbidden names: old, legacy, v1, backup, temp, copy
 * - Any file CONTAINING forbidden identifiers: EnterpriseLayout, BrandHeader, GlobalNavigation
 * - Any unapproved CSS file
 * - Multiple layout files (only Layout.tsx allowed)
 * 
 * ENHANCED: Now scans FILE CONTENTS for forbidden identifiers!
 * 
 * Usage:
 *   npm run preflight
 *   This MUST pass before build/deploy
 */

import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { exit } from 'process';

interface GuardResult {
  passed: boolean;
  errors: string[];
  warnings: string[];
}

// Forbidden file name patterns
const FORBIDDEN_FILE_PATTERNS = [
  /\.old\./i,
  /legacy/i,
  /-v1\./i,
  /backup/i,
  /\.temp\./i,
  /\.copy\./i,
  /-test-ui/i,
  /apple-package/i,
  /header-old/i,
  /footer-old/i,
];

// Forbidden identifiers in file CONTENT (component names, exports, imports)
const FORBIDDEN_CONTENT_IDENTIFIERS = [
  'EnterpriseLayout',
  'BrandHeader',
  'GlobalNavigation',
  'MultiLayerNavigation',
  'OldLayout',
  'LegacyLayout',
  'ApplePackage',
  'HeaderLegacy',
];

// Forbidden exact file names (not patterns - exact matches)
const FORBIDDEN_EXACT_FILES = [
  'Header.tsx', // Only PetWashHeader and Layout allowed
  'HeaderLegacy.tsx',
];

const APPROVED_LUXURY_CSS = [
  'index.css',
  'petwash-header.css',
  'override-2025.css',
  'responsive-tokens.css',
  'floating-stack.css',
  'ai-chat.css',
  'NewHumanAvatar.css',
  'luxury-system-2025.css', // Centralized luxury design system - architect approved
];

async function scanDirectory(dir: string, results: string[] = [], depth = 0): Promise<string[]> {
  if (depth > 10) return results;
  
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
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

async function checkForbiddenFileNames(): Promise<GuardResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  console.log('🔍 Scanning for forbidden file names...\n');
  
  const files = await scanDirectory('./client/src');
  
  for (const file of files) {
    const fileName = file.split('/').pop() || '';
    const relativePath = file.replace('./client/src/', '');
    
    // Check exact file name matches
    if (FORBIDDEN_EXACT_FILES.includes(fileName)) {
      errors.push(`❌ FORBIDDEN FILE (EXACT): ${relativePath} - "${fileName}" is not allowed`);
    }
    
    // Check pattern matches
    for (const pattern of FORBIDDEN_FILE_PATTERNS) {
      if (pattern.test(fileName) || pattern.test(relativePath)) {
        errors.push(`❌ FORBIDDEN FILE NAME: ${relativePath} (matches pattern: ${pattern})`);
      }
    }
  }
  
  return {
    passed: errors.length === 0,
    errors,
    warnings,
  };
}

async function checkForbiddenContent(): Promise<GuardResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  console.log('📖 Scanning file CONTENTS for forbidden identifiers (comprehensive)...\n');
  
  const files = await scanDirectory('./client/src');
  const codeFiles = files.filter(f => f.endsWith('.tsx') || f.endsWith('.ts'));
  
  for (const file of codeFiles) {
    try {
      const content = await readFile(file, 'utf-8');
      const relativePath = file.replace('./client/src/', '');
      
      for (const identifier of FORBIDDEN_CONTENT_IDENTIFIERS) {
        // Use word boundary to catch ALL occurrences: declarations, exports, imports, JSX, etc.
        // This catches: function X, const X, class X, export X, import X, <X>, { X }, etc.
        const wordBoundaryPattern = new RegExp(`\\b${identifier}\\b`, 'g');
        
        if (wordBoundaryPattern.test(content)) {
          // Find line number for better error reporting
          const lines = content.split('\n');
          const lineNumbers: number[] = [];
          lines.forEach((line, idx) => {
            if (new RegExp(`\\b${identifier}\\b`).test(line)) {
              lineNumbers.push(idx + 1);
            }
          });
          
          errors.push(
            `❌ FORBIDDEN IDENTIFIER: ${relativePath} contains "${identifier}" (lines: ${lineNumbers.slice(0, 3).join(', ')}${lineNumbers.length > 3 ? '...' : ''})`
          );
          break; // Only report once per file
        }
      }
    } catch (error) {
      // Skip files that can't be read
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
  
  console.log('🎨 Verifying CSS files (HARD FAIL)...\n');
  
  const cssFiles = await scanDirectory('./client/src');
  const foundCSS = cssFiles.filter(f => f.endsWith('.css'));
  
  for (const cssFile of foundCSS) {
    const fileName = cssFile.split('/').pop() || '';
    
    if (!APPROVED_LUXURY_CSS.includes(fileName)) {
      errors.push(`❌ UNAPPROVED CSS FILE: ${cssFile.replace('./client/src/', '')} (not in approved luxury CSS list)`);
    }
  }
  
  return {
    passed: errors.length === 0,
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
  
  const APPROVED_LAYOUTS = ['Layout.tsx'];
  
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
  console.log('🛡️  PETWASH™ PREFLIGHT GUARDIAN v2 - CONTENT SCANNER\n');
  console.log('================================\n');
  
  const results: GuardResult[] = [];
  
  // Run all guards
  results.push(await checkForbiddenFileNames());
  results.push(await checkForbiddenContent());
  results.push(await checkCSSFiles());
  results.push(await checkParallelLayouts());
  
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
    console.log('💡 TIP: Parallel UI systems are FORBIDDEN in PetWash production\n');
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
