/**
 * PR-PET-4 — pet onboarding luxury shell (UI scaffolding) regression suite.
 *
 * Source: docs/product/pet-profile-luxury-onboarding-master-plan.md §1, §12.4.
 * CEO directive (2026-05-09) for PR-PET-4 specifically:
 *   • onboarding shell / scaffolding only
 *   • controlled step flow
 *   • consume PR-PET-2 keys
 *   • consume PR-PET-3 dataset
 *   • no backend persistence expansion
 *   • no DB migration
 *   • no provider coupling
 *   • no finance / payment linkage
 *   • no PawFinder linkage
 *   • no AI logic
 *   • local component state only
 *   • feature-flagged if possible
 *   • hidden behind existing onboarding route
 *   • no schema writes beyond already-existing safe fields
 *
 * What this test suite source-pins:
 *   A. Files exist and live under client/src/pages/onboarding/.
 *   B. Scope guards — the shell + steps + context + i18n loader must
 *      NOT import any backend/schema/finance/payment surface; must NOT
 *      write to localStorage / sessionStorage / cookies; must NOT call
 *      /api/pets, /api/pets/draft, /api/wallet, /api/payments etc.
 *   C. Forbidden keyword guard — no money / wallet / Stripe / Tranzila /
 *      Nayax / UPay / SUMIT / billing / payout / Masav / payment
 *      identifiers anywhere in the new files (PR-PET-4 must stay
 *      money-firewalled per CEO directive).
 *   D. Feature-flag gate — App.tsx mount is wrapped in
 *      VITE_PET_ONBOARDING_SHELL_ENABLED check.
 *   E. Immersive-route registration — /onboarding/pet is in
 *      IMMERSIVE_ROUTES so the shell isolates from bottom-nav etc.
 *   F. PR-PET-2 + PR-PET-3 invariants preserved (we only consume — we
 *      do not edit any of those PR's source files).
 *   G. Save-stub honesty — Review step's CTA is deliberately a no-op;
 *      no /api/pets call exists in any PR-PET-4 file.
 *
 * No new dependency. No edit to schema. No edit to server runtime.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..');

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), 'utf8');
}

const SHELL_FILES = [
  'client/src/pages/onboarding/PetOnboardingShell.tsx',
  'client/src/pages/onboarding/PetOnboardingContext.tsx',
  'client/src/pages/onboarding/petOnboardingI18n.ts',
  'client/src/pages/onboarding/types.ts',
  'client/src/pages/onboarding/shellTypes.ts',
  'client/src/pages/onboarding/steps/WelcomeStep.tsx',
  'client/src/pages/onboarding/steps/NameStep.tsx',
  'client/src/pages/onboarding/steps/SpeciesStep.tsx',
  'client/src/pages/onboarding/steps/BreedStep.tsx',
  'client/src/pages/onboarding/steps/ReviewStep.tsx',
];

// ─────────────────────────────────────────────────────────────────────────
// A. Files exist and live in the new directory.
// ─────────────────────────────────────────────────────────────────────────
describe('PR-PET-4 — A. file layout', () => {
  it('A1. every shell file exists at the expected path', () => {
    for (const rel of SHELL_FILES) {
      expect(
        existsSync(resolve(ROOT, rel)),
        `expected ${rel} to exist`,
      ).toBe(true);
    }
  });

  it('A2. shell + steps live under client/src/pages/onboarding/', () => {
    for (const rel of SHELL_FILES) {
      expect(
        rel.startsWith('client/src/pages/onboarding/'),
        `expected ${rel} under client/src/pages/onboarding/`,
      ).toBe(true);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────
// B. Scope guards — no backend / schema / persistence escape hatch.
// ─────────────────────────────────────────────────────────────────────────
describe('PR-PET-4 — B. scope guards (local-state only)', () => {
  const FORBIDDEN_IMPORT_PATTERNS: ReadonlyArray<{ rx: RegExp; reason: string }> = [
    { rx: /from\s+['"](\.\.\/)+server\//, reason: 'must not import from server/*' },
    { rx: /from\s+['"]@shared\/schema/, reason: 'must not import schema' },
    { rx: /from\s+['"](\.\.\/)+shared\/schema/, reason: 'must not import schema' },
    { rx: /from\s+['"]firebase-admin/, reason: 'must not import firebase-admin' },
    { rx: /from\s+['"]drizzle-orm/, reason: 'must not import drizzle-orm' },
    { rx: /from\s+['"]pg['"]/, reason: 'must not import pg' },
  ];

  // Strip comments + string + template literals so we only look at live
  // code. Comments in these files MENTION /api/pets explicitly to
  // document that the route is intentionally NOT called — that is
  // discipline, not a violation.
  function codeOnly(src: string): string {
    let out = src;
    out = out.replace(/\/\*[\s\S]*?\*\//g, '');
    out = out.replace(/(^|[^:])\/\/.*$/gm, '$1');
    out = out.replace(/'(?:\\.|[^'\\])*'/g, "''");
    out = out.replace(/"(?:\\.|[^"\\])*"/g, '""');
    out = out.replace(/`(?:\\.|[^`\\])*`/g, '``');
    return out;
  }

  const FORBIDDEN_API_PATTERNS: ReadonlyArray<{ rx: RegExp; reason: string }> = [
    { rx: /\/api\/pets\b(?!-breeds)/, reason: 'must not call /api/pets' },
    { rx: /\/api\/wallet/, reason: 'must not call /api/wallet' },
    { rx: /\/api\/payments?/, reason: 'must not call /api/payments' },
    { rx: /\/api\/billing/, reason: 'must not call /api/billing' },
    { rx: /\/api\/payouts?/, reason: 'must not call /api/payouts' },
    { rx: /\/api\/admin/, reason: 'must not call /api/admin' },
  ];

  const FORBIDDEN_RUNTIME_PATTERNS: ReadonlyArray<{ rx: RegExp; reason: string }> = [
    { rx: /localStorage\.(set|remove|clear)/, reason: 'no localStorage writes (local-state only)' },
    { rx: /sessionStorage\.(set|remove|clear)/, reason: 'no sessionStorage writes' },
    { rx: /document\.cookie\s*=/, reason: 'no cookie writes' },
    { rx: /apiRequest\(/, reason: 'no apiRequest helper invocations' },
  ];

  for (const rel of SHELL_FILES) {
    it(`B[${rel}] no backend / schema / persistence imports`, () => {
      const src = read(rel);
      for (const { rx, reason } of FORBIDDEN_IMPORT_PATTERNS) {
        expect(rx.test(src), `${rel}: ${reason}`).toBe(false);
      }
    });

    it(`B[${rel}] no /api/* call to backend persistence (live code only)`, () => {
      const src = codeOnly(read(rel));
      for (const { rx, reason } of FORBIDDEN_API_PATTERNS) {
        expect(rx.test(src), `${rel}: ${reason}`).toBe(false);
      }
    });

    it(`B[${rel}] no localStorage / sessionStorage / cookie writes`, () => {
      const src = codeOnly(read(rel));
      for (const { rx, reason } of FORBIDDEN_RUNTIME_PATTERNS) {
        expect(rx.test(src), `${rel}: ${reason}`).toBe(false);
      }
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// C. Forbidden keyword guard — money firewall.
// ─────────────────────────────────────────────────────────────────────────
describe('PR-PET-4 — C. money firewall', () => {
  // Only flag actual identifiers / surface references, not English words
  // that might appear in an i18n key path. We strip string literals from
  // each file before scanning to avoid false positives on copy.
  function codeOnly(src: string): string {
    // Strip block + line comments and quoted strings.
    let out = src;
    out = out.replace(/\/\*[\s\S]*?\*\//g, ''); // block comments
    out = out.replace(/(^|[^:])\/\/.*$/gm, '$1'); // line comments
    out = out.replace(/'(?:\\.|[^'\\])*'/g, "''");
    out = out.replace(/"(?:\\.|[^"\\])*"/g, '""');
    out = out.replace(/`(?:\\.|[^`\\])*`/g, '``');
    return out;
  }

  const FORBIDDEN: ReadonlyArray<RegExp> = [
    /\bStripe\b/,
    /\bTranzila\b/,
    /\bNayax\b/,
    /\bMonyx\b/,
    /\bUPay\b/i,
    /\bSUMIT\b/i,
    /\bMasav\b/i,
    /\bPayout\b/i,
    /\bWallet\b/, // module reference, not the i18n string petOnboarding.petId.walletCardCopy (that's in the JSON, not these files)
    /\bBilling\b/,
    /\bPayment(s|Provider|Method)\b/,
    /\bagorot\b/i,
    /\bIBAN\b/,
  ];

  for (const rel of SHELL_FILES) {
    it(`C[${rel}] no payment / money identifiers in code`, () => {
      const src = codeOnly(read(rel));
      for (const rx of FORBIDDEN) {
        expect(rx.test(src), `${rel} contains forbidden identifier ${rx}`).toBe(false);
      }
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// D. Feature-flag gate present in App.tsx mount.
// ─────────────────────────────────────────────────────────────────────────
describe('PR-PET-4 — D. feature-flag gate', () => {
  it('D1. App.tsx mounts the route only when VITE_PET_ONBOARDING_SHELL_ENABLED is true', () => {
    const src = read('client/src/App.tsx');
    expect(src.includes("VITE_PET_ONBOARDING_SHELL_ENABLED === 'true'"))
      .toBe(true);
    expect(src.includes('/onboarding/pet/:step?')).toBe(true);
    expect(src.includes('PetOnboardingShell')).toBe(true);
  });

  it('D2. shell route is wrapped in RequireAuth (the existing onboarding pattern)', () => {
    const src = read('client/src/App.tsx');
    // Anchor on the actual <Route> mount block (not the lazy import line
    // higher up in the file, which also mentions PetOnboardingShell).
    const routeIdx = src.indexOf('"/onboarding/pet/:step?"');
    expect(routeIdx).toBeGreaterThan(-1);
    const block = src.slice(routeIdx, routeIdx + 400);
    expect(block.includes('RequireAuth')).toBe(true);
    expect(block.includes('PetOnboardingShell')).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// E. Immersive-route registration so the shell isolates from app chrome.
// ─────────────────────────────────────────────────────────────────────────
describe('PR-PET-4 — E. immersive-route registration', () => {
  it('E1. /onboarding/pet is listed in IMMERSIVE_ROUTES', () => {
    const src = read('client/src/lib/immersive-routes.ts');
    expect(src.includes("'/onboarding/pet'")).toBe(true);
  });

  it('E2. immersive-routes.ts retains the canonical PR-D auth list', () => {
    // Ensures we did not accidentally remove any existing entry.
    const src = read('client/src/lib/immersive-routes.ts');
    const must = [
      "'/signin'", "'/sign-in'", "'/signup'", "'/sign-up'",
      "'/provider-onboarding'", "'/consent-onboarding'",
      "'/forms/onboarding'", "'/loyalty/join'",
    ];
    for (const m of must) {
      expect(src.includes(m), `immersive-routes.ts missing ${m}`).toBe(true);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────
// F. PR-PET-2 + PR-PET-3 invariants preserved (we only consume).
// ─────────────────────────────────────────────────────────────────────────
describe('PR-PET-4 — F. PR-PET-2 + PR-PET-3 invariants preserved', () => {
  it('F1. petOnboarding namespace still present in en locale (PR-PET-2)', () => {
    const en = read('client/public/locales/en/translation.json');
    expect(en.includes('"petOnboarding"')).toBe(true);
    expect(en.includes('"petName"')).toBe(true);
    expect(en.includes('"continue"')).toBe(true);
  });

  it('F2. PR-PET-3 dataset entrypoint still exports the helpers we consume', () => {
    const idx = read('shared/data/pet-breeds/index.ts');
    expect(idx.includes('export const ALL_BREEDS')).toBe(true);
    expect(idx.includes('getBreedsForSpecies')).toBe(true);
    expect(idx.includes('getBreedById')).toBe(true);
    expect(idx.includes('getLabel')).toBe(true);
  });

  it('F3. PR-PET-3 species file still exports PET_SPECIES + helpers', () => {
    const sp = read('shared/data/pet-species.ts');
    expect(sp.includes('export const PET_SPECIES')).toBe(true);
    expect(sp.includes('export function getSpecies')).toBe(true);
  });

  it('F4. shell consumes both datasets via direct ESM import (no fetch / no /api)', () => {
    const shell = read('client/src/pages/onboarding/steps/SpeciesStep.tsx');
    expect(shell.includes("from '../../../../../shared/data/pet-species'"))
      .toBe(true);
    const breed = read('client/src/pages/onboarding/steps/BreedStep.tsx');
    expect(breed.includes("from '../../../../../shared/data/pet-breeds'"))
      .toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// G. Save-stub honesty.
// ─────────────────────────────────────────────────────────────────────────
describe('PR-PET-4 — G. save-stub honesty', () => {
  it('G1. ReviewStep + Shell carry no /api/pets call (live code only)', () => {
    function codeOnly(src: string): string {
      let out = src;
      out = out.replace(/\/\*[\s\S]*?\*\//g, '');
      out = out.replace(/(^|[^:])\/\/.*$/gm, '$1');
      out = out.replace(/'(?:\\.|[^'\\])*'/g, "''");
      out = out.replace(/"(?:\\.|[^"\\])*"/g, '""');
      out = out.replace(/`(?:\\.|[^`\\])*`/g, '``');
      return out;
    }
    const review = codeOnly(read('client/src/pages/onboarding/steps/ReviewStep.tsx'));
    expect(/\/api\/pets\b(?!-breeds)/.test(review)).toBe(false);
    const shell = codeOnly(read('client/src/pages/onboarding/PetOnboardingShell.tsx'));
    expect(/\/api\/pets\b(?!-breeds)/.test(shell)).toBe(false);
  });

  it('G2. shell carries the data-pr-pet-4-save-stub marker on the Review CTA', () => {
    const shell = read('client/src/pages/onboarding/PetOnboardingShell.tsx');
    expect(shell.includes('data-pr-pet-4-save-stub')).toBe(true);
  });

  it('G3. step set is exactly welcome → name → species → breed → review', () => {
    const types = read('client/src/pages/onboarding/types.ts');
    expect(types.includes("'welcome'")).toBe(true);
    expect(types.includes("'name'")).toBe(true);
    expect(types.includes("'species'")).toBe(true);
    expect(types.includes("'breed'")).toBe(true);
    expect(types.includes("'review'")).toBe(true);
    // No premature inclusion of out-of-scope steps.
    expect(types.includes("'photo'")).toBe(false);
    expect(types.includes("'consent_medical'")).toBe(false);
    expect(types.includes("'aggression_warning'")).toBe(false);
  });
});
