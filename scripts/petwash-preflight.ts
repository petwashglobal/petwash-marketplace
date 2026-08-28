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
  'luxury-dark-2025.css', // Ultra-luxury dark theme 2025 - architect approved
  'my-account-luxury.css', // MyAccount noir/gold luxury styles - architect approved
  'petwash-brand-tokens.css', // Brand design tokens (white/black/gold) - CEO-locked 2026-06-16
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

/**
 * CEO §73 (2026-08-28): runtime CTA anchors on the signup + onboarding
 * surfaces. Prior audit history: refactors dropped the data-testid on
 * the continue buttons, E2E tests started passing against DOM that no
 * longer existed, and the "wrong OTP silent-continue" bug shipped for
 * weeks before it was caught by a customer report. Pin the anchors the
 * signup + provider onboarding + ChooseMode surfaces MUST expose so a
 * rename trips the scanner.
 */
async function checkSignupOnboardingCTAs(): Promise<GuardResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  console.log('🎯 Checking signup + onboarding CTA anchors...\n');

  // Pinned surface → list of anchors that MUST exist (as data-testid or
  // a distinct source-visible constant). Anchor is the raw string; we
  // grep the file contents.
  const SURFACES: { path: string; anchors: { key: string; why: string }[] }[] = [
    {
      path: './client/src/pages/SignUpLuxury.tsx',
      anchors: [
        { key: 'data-testid="button-continue-mobile"',   why: 'mobile-continue CTA (E2E anchor + accessibility)' },
        { key: 'data-testid="button-continue-email"',    why: 'email-continue CTA (E2E anchor + accessibility)' },
        { key: 'data-testid="checkbox-ageConfirmed18Plus"', why: 'new-user 18+ consent (PR-AUTH-SIGNUP-2)' },
        { key: 'data-testid="checkbox-agreedTerms"',     why: 'new-user Terms consent (PR-AUTH-SIGNUP-2)' },
        { key: 'data-testid="checkbox-acceptedMarketing"', why: 'new-user Marketing consent (must be SEPARATE from Terms)' },
        { key: 'data-testid="button-resend-code-mobile"', why: 'mobile-OTP resend affordance (dead-end fix)' },
        { key: 'data-testid="button-change-number-mobile"', why: 'wrong-number affordance on OTP step (CEO §43)' },
        { key: 'data-testid="button-change-email"',      why: 'wrong-email affordance on OTP step (CEO §43)' },
      ],
    },
    {
      path: './client/src/pages/ProviderOnboarding.tsx',
      anchors: [
        { key: 'data-testid="button-submit-application"', why: 'submit CTA on step 3' },
        { key: 'data-testid="checkbox-background-consent"', why: 'background-check consent (§73 #10)' },
        { key: 'data-testid="section-bank-payout"',      why: 'bank / payout section (§73 #12)' },
        { key: 'data-testid="input-bank-iban"',          why: 'IBAN input (§73 #12)' },
        // CEO §35 (2026-08-28) — driving-license inputs must remain
        // present for driver applicants; a refactor that drops the
        // section leaves drivers submitting empty licence data again.
        { key: 'data-testid="section-driving-license"',        why: 'driver-only licence section (§35)' },
        { key: 'data-testid="input-driving-license-number"',   why: 'driver licence number input (§35)' },
        { key: 'data-testid="input-driving-license-expiry"',   why: 'driver licence expiry input (§35)' },
      ],
    },
    {
      path: './client/src/pages/Pets.tsx',
      anchors: [
        // CEO §22 (2026-08-28) — owner medical-share consent toggle.
        // The whole KYA server enforcement chain is inert if this
        // control disappears from the pet card.
        { key: 'data-testid={`consent-toggle-${pet.id}`}', why: 'medical-share consent toggle (§22)' },
        { key: 'data-testid={`consent-row-${pet.id}`}',    why: 'consent row anchor (§22 E2E)' },
      ],
    },
    {
      path: './client/src/pages/walk-my-pet/BookingFlow.tsx',
      anchors: [
        // CEO §5 (2026-08-28) — booking-scoped medical share checkbox.
        { key: 'data-testid="section-booking-scoped-share-walker"',  why: 'booking-scoped share section (§5)' },
        { key: 'data-testid="checkbox-booking-scoped-share-walker"', why: 'booking-scoped share checkbox (§5)' },
      ],
    },
    {
      path: './client/src/pages/sitter-suite/BookingFlow.tsx',
      anchors: [
        { key: 'data-testid="section-booking-scoped-share-sitter"',  why: 'booking-scoped share section (§5)' },
        { key: 'data-testid="checkbox-booking-scoped-share-sitter"', why: 'booking-scoped share checkbox (§5)' },
      ],
    },
    {
      // CEO §46 (2026-08-28) — per-section state list on the
      // applicant's status page. Without this the applicant loses
      // section-by-section visibility and reverts to a single opaque
      // "under review" state.
      path: './client/src/pages/ProviderApplicationStatus.tsx',
      anchors: [
        { key: 'data-testid="section-status-list"', why: 'per-section state list (§46)' },
        { key: 'data-testid={`section-status-row-${key}`}', why: 'per-row section state anchor (§46)' },
      ],
    },
    {
      path: './client/src/pages/ChooseMode.tsx',
      anchors: [
        // Prestige is an ENTITLEMENT, not a workspace. The customer
        // fallback MUST NOT be /prestige/home — that regression shipped
        // and was fixed in commit 3b22621a8+. Pin the correct string.
        { key: "'/pet-parent/home'", why: 'CUSTOMER_FALLBACK must be /pet-parent/home (CEO product model)' },
      ],
    },
  ];

  for (const surface of SURFACES) {
    let content: string;
    try {
      content = await readFile(surface.path, 'utf8');
    } catch (err: any) {
      errors.push(`❌ CTA-SCANNER: could not read ${surface.path.replace('./client/src/', '')} — ${err?.message || err}`);
      continue;
    }
    for (const { key, why } of surface.anchors) {
      if (!content.includes(key)) {
        errors.push(
          `❌ CTA-SCANNER: ${surface.path.replace('./client/src/', '')} MISSING anchor \`${key}\` (${why})`,
        );
      }
    }
    // Regression on ChooseMode: /prestige/home MUST NOT be the customer
    // fallback anywhere in the file. A conditional prestige route on
    // an OWNED prestige member surface is allowed elsewhere.
    if (surface.path.endsWith('ChooseMode.tsx')) {
      const badFallback = /CUSTOMER_FALLBACK\s*=\s*['"]\/prestige\/home['"]/;
      if (badFallback.test(content)) {
        errors.push(
          `❌ CTA-SCANNER: ChooseMode.tsx has CUSTOMER_FALLBACK = '/prestige/home' — must be '/pet-parent/home' (Prestige is an entitlement, not a workspace)`,
        );
      }
    }
  }

  return { passed: errors.length === 0, errors, warnings };
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
  results.push(await checkSignupOnboardingCTAs());
  
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
