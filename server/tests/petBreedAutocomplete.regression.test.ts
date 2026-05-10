/**
 * PR-PET-5 — pet onboarding breed autocomplete UX regression suite.
 *
 * Source: docs/product/pet-profile-luxury-onboarding-master-plan.md
 *         §1.2 step 3 + §3 (breed autocomplete).
 * CEO directive (2026-05-10) for PR-PET-5 SAFE HIGH-VELOCITY model
 * Lane A:
 *   • breed autocomplete UI only
 *   • feature flag OFF (parent shell controls)
 *   • no backend
 *   • no schema
 *   • no payment / wallet / payout / refund / invoice
 *   • no provider activation
 *   • no auth / admin changes
 *   • source-pin tests
 *
 * What this suite source-pins:
 *   A. Files exist at expected paths
 *   B. Scope guards — no /api/* or backend/schema/persistence escape
 *   C. Money firewall — no Stripe / Tranzila / Nayax / UPay / SUMIT /
 *      Masav / Wallet / Billing / Payment identifiers in live code
 *   D. PR-PET-3 dataset consumption — direct ESM import of helpers
 *   E. Mixed / Unknown / Other placeholders are part of the render
 *      path (always-visible invariant)
 *   F. Feature-flag chain unchanged — parent shell still gates the
 *      route via VITE_PET_ONBOARDING_SHELL_ENABLED
 *   G. PR-PET-2 i18n key consumption preserved
 *   H. Save-stub honesty — no /api/pets call, no localStorage write,
 *      no apiRequest helper
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..');

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), 'utf8');
}

const PR5_FILES = [
  'client/src/pages/onboarding/components/BreedAutocomplete.tsx',
  'client/src/pages/onboarding/steps/BreedStep.tsx',
];

// Strip comments + string literals before scanning live code.
function codeOnly(src: string): string {
  let out = src;
  out = out.replace(/\/\*[\s\S]*?\*\//g, '');
  out = out.replace(/(^|[^:])\/\/.*$/gm, '$1');
  out = out.replace(/'(?:\\.|[^'\\])*'/g, "''");
  out = out.replace(/"(?:\\.|[^"\\])*"/g, '""');
  out = out.replace(/`(?:\\.|[^`\\])*`/g, '``');
  return out;
}

// ─────────────────────────────────────────────────────────────────────────
// A. File layout
// ─────────────────────────────────────────────────────────────────────────
describe('PR-PET-5 — A. file layout', () => {
  it('A1. BreedAutocomplete component exists at the expected path', () => {
    expect(
      existsSync(
        resolve(ROOT, 'client/src/pages/onboarding/components/BreedAutocomplete.tsx'),
      ),
    ).toBe(true);
  });

  it('A2. BreedStep exists and was updated to consume the new component', () => {
    const step = read('client/src/pages/onboarding/steps/BreedStep.tsx');
    expect(step.includes("from '../components/BreedAutocomplete'"))
      .toBe(true);
    expect(step.includes('BreedAutocomplete')).toBe(true);
    // The native <select>+<optgroup> from PR-PET-4 is gone — check
    // only live code, since the JSDoc still references the old shape
    // for context.
    const stepCode = codeOnly(step);
    expect(stepCode.includes('<select')).toBe(false);
    expect(stepCode.includes('<optgroup')).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// B. Scope guards — no backend / persistence escape
// ─────────────────────────────────────────────────────────────────────────
describe('PR-PET-5 — B. scope guards (UI only; no backend)', () => {
  const FORBIDDEN_IMPORT_PATTERNS: ReadonlyArray<{ rx: RegExp; reason: string }> = [
    { rx: /from\s+['"](\.\.\/)+server\//, reason: 'must not import from server/*' },
    { rx: /from\s+['"]@shared\/schema/, reason: 'must not import schema' },
    { rx: /from\s+['"](\.\.\/)+shared\/schema/, reason: 'must not import schema' },
    { rx: /from\s+['"]firebase-admin/, reason: 'must not import firebase-admin' },
    { rx: /from\s+['"]drizzle-orm/, reason: 'must not import drizzle-orm' },
    { rx: /from\s+['"]pg['"]/, reason: 'must not import pg' },
    { rx: /from\s+['"]@\/lib\/queryClient['"]/, reason: 'must not pull react-query (no API)' },
  ];

  const FORBIDDEN_API_PATTERNS: ReadonlyArray<{ rx: RegExp; reason: string }> = [
    { rx: /\/api\/pets\b(?!-breeds)/, reason: 'must not call /api/pets' },
    { rx: /\/api\/wallet/, reason: 'must not call /api/wallet' },
    { rx: /\/api\/payments?/, reason: 'must not call /api/payments' },
    { rx: /\/api\/billing/, reason: 'must not call /api/billing' },
    { rx: /\/api\/payouts?/, reason: 'must not call /api/payouts' },
    { rx: /\/api\/admin/, reason: 'must not call /api/admin' },
  ];

  const FORBIDDEN_RUNTIME_PATTERNS: ReadonlyArray<{ rx: RegExp; reason: string }> = [
    { rx: /localStorage\.(set|remove|clear)/, reason: 'no localStorage writes (UI only)' },
    { rx: /sessionStorage\.(set|remove|clear)/, reason: 'no sessionStorage writes' },
    { rx: /document\.cookie\s*=/, reason: 'no cookie writes' },
    { rx: /apiRequest\(/, reason: 'no apiRequest helper invocations' },
    { rx: /\bfetch\(/, reason: 'no fetch — no network call from this PR' },
  ];

  for (const rel of PR5_FILES) {
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

    it(`B[${rel}] no localStorage / sessionStorage / cookie / fetch / apiRequest`, () => {
      const src = codeOnly(read(rel));
      for (const { rx, reason } of FORBIDDEN_RUNTIME_PATTERNS) {
        expect(rx.test(src), `${rel}: ${reason}`).toBe(false);
      }
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// C. Money firewall — no payment / accounting / vendor identifiers
// ─────────────────────────────────────────────────────────────────────────
describe('PR-PET-5 — C. money firewall', () => {
  const FORBIDDEN: ReadonlyArray<RegExp> = [
    /\bStripe\b/,
    /\bTranzila\b/,
    /\bNayax\b/,
    /\bMonyx\b/,
    /\bUPay\b/i,
    /\bSUMIT\b/i,
    /\bMasav\b/i,
    /\bPayout\b/i,
    /\bWallet\b/,
    /\bBilling\b/,
    /\bPayment(s|Provider|Method)\b/,
    /\bIBAN\b/,
    /\bagorot\b/i,
  ];

  for (const rel of PR5_FILES) {
    it(`C[${rel}] no payment / money identifiers in live code`, () => {
      const src = codeOnly(read(rel));
      for (const rx of FORBIDDEN) {
        expect(rx.test(src), `${rel} contains forbidden identifier ${rx}`).toBe(false);
      }
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// D. PR-PET-3 dataset consumption (direct ESM, no hardcoded list)
// ─────────────────────────────────────────────────────────────────────────
describe('PR-PET-5 — D. PR-PET-3 dataset consumption', () => {
  it('D1. BreedAutocomplete imports the canonical helpers via ESM', () => {
    const src = read('client/src/pages/onboarding/components/BreedAutocomplete.tsx');
    expect(src.includes("from '../../../../../shared/data/pet-breeds'"))
      .toBe(true);
    // Helpers consumed from the dataset module:
    expect(src.includes('getBreedsForSpecies')).toBe(true);
    expect(src.includes('getPlaceholderBreeds')).toBe(true);
    expect(src.includes('getPopularBreeds')).toBe(true);
    expect(src.includes('getBreedById')).toBe(true);
    expect(src.includes('getLabel')).toBe(true);
  });

  it('D2. component does NOT hardcode any breed identifier', () => {
    // Spot-check: no live-code reference to specific breed ids that
    // ship in the dataset (e.g. dog-labrador-retriever). The
    // component must obtain them from the dataset, not embed them.
    const src = codeOnly(
      read('client/src/pages/onboarding/components/BreedAutocomplete.tsx'),
    );
    const breedIdLike = /\bdog-[a-z]+(?:-[a-z]+)+\b|\bcat-[a-z]+(?:-[a-z]+)+\b/;
    expect(breedIdLike.test(src), 'no hardcoded breed id in component code').toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// E. Always-visible placeholder invariant
// ─────────────────────────────────────────────────────────────────────────
describe('PR-PET-5 — E. mixed/unknown/other always visible', () => {
  it('E1. component renders the placeholders unconditionally on the open panel', () => {
    const src = read('client/src/pages/onboarding/components/BreedAutocomplete.tsx');
    // Pattern: getPlaceholderBreeds(speciesId) result is passed to a
    // ResultSection that renders before the conditional sections
    // (popular when query empty; matches when query non-empty).
    const idxPlaceholder = src.indexOf('getPlaceholderBreeds(speciesId)');
    expect(idxPlaceholder).toBeGreaterThan(-1);
    // The placeholders ResultSection invocation must appear BEFORE
    // any `trimmedQuery.length === 0` or `trimmedQuery.length > 0`
    // gate in the rendered tree.
    const placeholderRenderIdx = src.indexOf('items={placeholders}');
    expect(placeholderRenderIdx).toBeGreaterThan(-1);
    const queryEmptyGateIdx = src.indexOf('trimmedQuery.length === 0 && popular');
    const queryNonEmptyGateIdx = src.indexOf('trimmedQuery.length > 0 && (');
    expect(queryEmptyGateIdx).toBeGreaterThan(-1);
    expect(queryNonEmptyGateIdx).toBeGreaterThan(-1);
    expect(placeholderRenderIdx).toBeLessThan(queryEmptyGateIdx);
    expect(placeholderRenderIdx).toBeLessThan(queryNonEmptyGateIdx);
  });

  it('E2. placeholder section carries the data-placeholder marker on its options', () => {
    const src = read('client/src/pages/onboarding/components/BreedAutocomplete.tsx');
    expect(src.includes('isPlaceholderSection')).toBe(true);
    expect(src.includes("data-placeholder=")).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// F. Feature-flag chain preserved — parent shell still gates the route
// ─────────────────────────────────────────────────────────────────────────
describe('PR-PET-5 — F. feature flag chain preserved', () => {
  it('F1. PR-PET-5 introduces NO new feature flag (parent shell flag stands)', () => {
    for (const rel of PR5_FILES) {
      const src = codeOnly(read(rel));
      // No new VITE_PET_* flag is introduced in this PR.
      expect(/import\.meta\.env\.VITE_PET_/i.test(src)).toBe(false);
    }
  });

  it('F2. App.tsx still gates the shell on VITE_PET_ONBOARDING_SHELL_ENABLED', () => {
    const app = read('client/src/App.tsx');
    expect(app.includes("VITE_PET_ONBOARDING_SHELL_ENABLED === 'true'"))
      .toBe(true);
    expect(app.includes('PetOnboardingShell')).toBe(true);
  });

  it('F3. immersive-routes still lists /onboarding/pet', () => {
    const src = read('client/src/lib/immersive-routes.ts');
    expect(src.includes("'/onboarding/pet'")).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// G. PR-PET-2 i18n key consumption preserved
// ─────────────────────────────────────────────────────────────────────────
describe('PR-PET-5 — G. PR-PET-2 i18n keys preserved', () => {
  it('G1. component consumes petOnboarding.breed.* keys via injected t()', () => {
    const src = read('client/src/pages/onboarding/components/BreedAutocomplete.tsx');
    expect(src.includes("'petOnboarding.breed.search'")).toBe(true);
    expect(src.includes("'petOnboarding.breed.popular'")).toBe(true);
    expect(src.includes("'petOnboarding.breed.cantFind'")).toBe(true);
  });

  it('G2. PR-PET-2 en locale still ships the breed keys (PR-PET-2 invariant)', () => {
    const en = read('client/public/locales/en/translation.json');
    expect(en.includes('"breed"')).toBe(true);
    expect(en.includes('"search"')).toBe(true);
    expect(en.includes('"popular"')).toBe(true);
    expect(en.includes('"cantFind"')).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// H. PR-PET-3 + PR-PET-4 invariants preserved
// ─────────────────────────────────────────────────────────────────────────
describe('PR-PET-5 — H. PR-PET-3 + PR-PET-4 invariants preserved', () => {
  it('H1. PR-PET-3 dataset entrypoint still exports getPopularBreeds + getPlaceholderBreeds + getBreedsForSpecies', () => {
    const idx = read('shared/data/pet-breeds/index.ts');
    expect(idx.includes('getPopularBreeds')).toBe(true);
    expect(idx.includes('getPlaceholderBreeds')).toBe(true);
    expect(idx.includes('getBreedsForSpecies')).toBe(true);
    expect(idx.includes('getBreedById')).toBe(true);
    expect(idx.includes('getLabel')).toBe(true);
  });

  it('H2. PR-PET-4 onboarding shell + context unchanged in this PR', () => {
    // The shell + context files must NOT be edited by PR-PET-5.
    // We do not source-diff against main here (would require git
    // shell-out); instead we pin the expected exports +
    // file presence so future PR-PET-* drift is caught.
    expect(
      existsSync(resolve(ROOT, 'client/src/pages/onboarding/PetOnboardingShell.tsx')),
    ).toBe(true);
    expect(
      existsSync(resolve(ROOT, 'client/src/pages/onboarding/PetOnboardingContext.tsx')),
    ).toBe(true);
    const ctx = read('client/src/pages/onboarding/PetOnboardingContext.tsx');
    expect(ctx.includes('PetOnboardingProvider')).toBe(true);
    expect(ctx.includes('usePetOnboarding')).toBe(true);
  });
});
