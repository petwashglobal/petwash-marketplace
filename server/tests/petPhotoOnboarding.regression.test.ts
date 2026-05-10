/**
 * PR-PET-6 — pet onboarding photo + cropper UX regression suite.
 *
 * Source: docs/product/pet-profile-luxury-onboarding-master-plan.md
 *         §1.2 row 24 + §4 (pet photo onboarding).
 * CEO directive (2026-05-10) for PR-PET-6 SAFE HIGH-VELOCITY model
 * Lane B:
 *   • photo onboarding + cropper UI only
 *   • feature-flagged via parent shell (no new flag)
 *   • no backend upload
 *   • no storage wiring
 *   • no payments / wallet / payout / refund / invoice
 *   • no provider activation
 *   • source-pin tests
 *   • single revert
 *
 * What this suite source-pins:
 *   A. Files exist at expected paths
 *   B. Scope guards — no upload / fetch / storage / API calls
 *   C. Money firewall — no payment / vendor identifiers in live code
 *   D. Step set extended ('photo' between 'breed' and 'review')
 *   E. Photo storage = in-memory only (no localStorage / sessionStorage
 *      / IndexedDB / cookie write)
 *   F. Feature-flag chain unchanged (parent shell still gates)
 *   G. PR-PET-2 i18n key consumption (petOnboarding.photo.*)
 *   H. PR-PET-1..5 invariants preserved
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..');

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), 'utf8');
}

const PR6_FILES = [
  'client/src/pages/onboarding/components/PhotoUploader.tsx',
  'client/src/pages/onboarding/components/PhotoCropper.tsx',
  'client/src/pages/onboarding/steps/PhotoStep.tsx',
  'client/src/pages/onboarding/types.ts',
  'client/src/pages/onboarding/PetOnboardingShell.tsx',
  'client/src/pages/onboarding/steps/ReviewStep.tsx',
];

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
describe('PR-PET-6 — A. file layout', () => {
  it('A1. PhotoUploader, PhotoCropper, PhotoStep all exist', () => {
    for (const rel of [
      'client/src/pages/onboarding/components/PhotoUploader.tsx',
      'client/src/pages/onboarding/components/PhotoCropper.tsx',
      'client/src/pages/onboarding/steps/PhotoStep.tsx',
    ]) {
      expect(
        existsSync(resolve(ROOT, rel)),
        `expected ${rel} to exist`,
      ).toBe(true);
    }
  });

  it('A2. shell lazy-imports the new PhotoStep', () => {
    const shell = read('client/src/pages/onboarding/PetOnboardingShell.tsx');
    expect(shell.includes("import('./steps/PhotoStep')")).toBe(true);
    expect(shell.includes("step === 'photo'")).toBe(true);
    expect(shell.includes('PhotoStep')).toBe(true);
  });

  it('A3. ReviewStep renders the photo thumbnail when present', () => {
    const review = read('client/src/pages/onboarding/steps/ReviewStep.tsx');
    expect(review.includes('draft.photoDataUrl')).toBe(true);
    expect(review.includes('data-pr-pet-6-review-thumb')).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// B. Scope guards — no upload / no storage / no API
// ─────────────────────────────────────────────────────────────────────────
describe('PR-PET-6 — B. scope guards (UI only; no backend)', () => {
  const FORBIDDEN_IMPORT_PATTERNS: ReadonlyArray<{ rx: RegExp; reason: string }> = [
    { rx: /from\s+['"](\.\.\/)+server\//, reason: 'must not import from server/*' },
    { rx: /from\s+['"]@shared\/schema/, reason: 'must not import schema' },
    { rx: /from\s+['"](\.\.\/)+shared\/schema/, reason: 'must not import schema' },
    { rx: /from\s+['"]firebase-admin/, reason: 'must not import firebase-admin' },
    { rx: /from\s+['"]firebase\/storage/, reason: 'must not import firebase storage' },
    { rx: /from\s+['"]@aws-sdk/, reason: 'must not import AWS SDK' },
    { rx: /from\s+['"]cloudinary/, reason: 'must not import cloudinary' },
    { rx: /from\s+['"]@\/lib\/queryClient['"]/, reason: 'must not pull react-query (no API)' },
  ];

  const FORBIDDEN_API_PATTERNS: ReadonlyArray<{ rx: RegExp; reason: string }> = [
    { rx: /\/api\/uploads?\b/, reason: 'must not call /api/upload(s)' },
    { rx: /\/api\/pets\b(?!-breeds)/, reason: 'must not call /api/pets' },
    { rx: /\/api\/wallet/, reason: 'must not call /api/wallet' },
    { rx: /\/api\/payments?/, reason: 'must not call /api/payments' },
    { rx: /\/api\/admin/, reason: 'must not call /api/admin' },
    { rx: /\bnew\s+FormData\b/, reason: 'must not construct FormData (no upload)' },
    { rx: /\bfetch\s*\(/, reason: 'must not fetch — no network call from this PR' },
    { rx: /apiRequest\(/, reason: 'must not invoke apiRequest helper' },
  ];

  for (const rel of PR6_FILES) {
    it(`B[${rel}] no backend / storage / persistence imports`, () => {
      const src = read(rel);
      for (const { rx, reason } of FORBIDDEN_IMPORT_PATTERNS) {
        expect(rx.test(src), `${rel}: ${reason}`).toBe(false);
      }
    });

    it(`B[${rel}] no upload / API call / FormData / fetch (live code)`, () => {
      const src = codeOnly(read(rel));
      for (const { rx, reason } of FORBIDDEN_API_PATTERNS) {
        expect(rx.test(src), `${rel}: ${reason}`).toBe(false);
      }
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// C. Money firewall
// ─────────────────────────────────────────────────────────────────────────
describe('PR-PET-6 — C. money firewall', () => {
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

  for (const rel of PR6_FILES) {
    it(`C[${rel}] no payment / money identifiers in live code`, () => {
      const src = codeOnly(read(rel));
      for (const rx of FORBIDDEN) {
        expect(rx.test(src), `${rel} contains forbidden identifier ${rx}`).toBe(false);
      }
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// D. Step set extended — 'photo' lands between 'breed' and 'review'
// ─────────────────────────────────────────────────────────────────────────
describe('PR-PET-6 — D. step set extended', () => {
  it('D1. types.ts step union includes photo', () => {
    const types = read('client/src/pages/onboarding/types.ts');
    expect(types.includes("'photo'")).toBe(true);
  });

  it('D2. PET_ONBOARDING_STEP_ORDER places photo BETWEEN breed and review', () => {
    const types = read('client/src/pages/onboarding/types.ts');
    const orderBlockMatch = types.match(/PET_ONBOARDING_STEP_ORDER[\s\S]*?\] as const;/);
    expect(orderBlockMatch).toBeTruthy();
    const orderText = orderBlockMatch![0];
    const breedIdx = orderText.indexOf("'breed'");
    const photoIdx = orderText.indexOf("'photo'");
    const reviewIdx = orderText.indexOf("'review'");
    expect(breedIdx).toBeGreaterThan(-1);
    expect(photoIdx).toBeGreaterThan(-1);
    expect(reviewIdx).toBeGreaterThan(-1);
    expect(breedIdx).toBeLessThan(photoIdx);
    expect(photoIdx).toBeLessThan(reviewIdx);
  });

  it('D3. PetOnboardingDraft adds photoDataUrl: string | null', () => {
    const types = read('client/src/pages/onboarding/types.ts');
    expect(types.includes('photoDataUrl: string | null')).toBe(true);
  });

  it('D4. EMPTY_PET_DRAFT initialises photoDataUrl to null', () => {
    const types = read('client/src/pages/onboarding/types.ts');
    expect(/photoDataUrl:\s*null/.test(types)).toBe(true);
  });

  it('D5. isStepId accepts "photo"', () => {
    const ctx = read('client/src/pages/onboarding/PetOnboardingContext.tsx');
    expect(ctx.includes("value === 'photo'")).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// E. Photo storage = in-memory only
// ─────────────────────────────────────────────────────────────────────────
describe('PR-PET-6 — E. photo storage in-memory only', () => {
  const FORBIDDEN: ReadonlyArray<{ rx: RegExp; reason: string }> = [
    { rx: /localStorage\.(set|remove|clear)/, reason: 'no localStorage writes' },
    { rx: /sessionStorage\.(set|remove|clear)/, reason: 'no sessionStorage writes' },
    { rx: /document\.cookie\s*=/, reason: 'no cookie writes' },
    { rx: /indexedDB/, reason: 'no IndexedDB' },
    { rx: /window\.caches/, reason: 'no Cache API write' },
  ];

  for (const rel of PR6_FILES) {
    it(`E[${rel}] no persistent storage write`, () => {
      const src = codeOnly(read(rel));
      for (const { rx, reason } of FORBIDDEN) {
        expect(rx.test(src), `${rel}: ${reason}`).toBe(false);
      }
    });
  }

  it('E2. PhotoUploader uses FileReader (in-memory data URL)', () => {
    const src = read('client/src/pages/onboarding/components/PhotoUploader.tsx');
    expect(src.includes('FileReader')).toBe(true);
    expect(src.includes('readAsDataURL')).toBe(true);
  });

  it('E3. PhotoCropper outputs via canvas.toDataURL (no upload)', () => {
    const src = read('client/src/pages/onboarding/components/PhotoCropper.tsx');
    expect(src.includes('toDataURL')).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// F. Feature-flag chain unchanged
// ─────────────────────────────────────────────────────────────────────────
describe('PR-PET-6 — F. feature flag chain preserved', () => {
  it('F1. PR-PET-6 introduces NO new feature flag', () => {
    for (const rel of PR6_FILES) {
      const src = codeOnly(read(rel));
      expect(/import\.meta\.env\.VITE_PET_/i.test(src)).toBe(false);
    }
  });

  it('F2. App.tsx still gates the shell on VITE_PET_ONBOARDING_SHELL_ENABLED', () => {
    const app = read('client/src/App.tsx');
    expect(app.includes("VITE_PET_ONBOARDING_SHELL_ENABLED === 'true'"))
      .toBe(true);
  });

  it('F3. immersive-routes still lists /onboarding/pet', () => {
    const src = read('client/src/lib/immersive-routes.ts');
    expect(src.includes("'/onboarding/pet'")).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// G. PR-PET-2 i18n key consumption preserved + extended
// ─────────────────────────────────────────────────────────────────────────
describe('PR-PET-6 — G. PR-PET-2 i18n keys preserved + extended', () => {
  it('G1. PhotoUploader consumes petOnboarding.photo.* keys', () => {
    const src = read('client/src/pages/onboarding/components/PhotoUploader.tsx');
    expect(src.includes("'petOnboarding.photo.upload'")).toBe(true);
    expect(src.includes("'petOnboarding.photo.privacyNote'")).toBe(true);
  });

  it('G2. PhotoCropper consumes confirmCrop + slideZoom keys', () => {
    const src = read('client/src/pages/onboarding/components/PhotoCropper.tsx');
    expect(src.includes("'petOnboarding.photo.confirmCrop'")).toBe(true);
    expect(src.includes("'petOnboarding.photo.slideZoom'")).toBe(true);
  });

  it('G3. PR-PET-2 en locale still ships the photo keys', () => {
    const en = read('client/public/locales/en/translation.json');
    expect(en.includes('"photo"')).toBe(true);
    expect(en.includes('"upload"')).toBe(true);
    expect(en.includes('"confirmCrop"')).toBe(true);
    expect(en.includes('"slideZoom"')).toBe(true);
    expect(en.includes('"privacyNote"')).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// H. PR-PET-1..5 invariants preserved
// ─────────────────────────────────────────────────────────────────────────
describe('PR-PET-6 — H. prior PR-PET invariants preserved', () => {
  it('H1. PR-PET-3 dataset entrypoint helpers still exported', () => {
    const idx = read('shared/data/pet-breeds/index.ts');
    expect(idx.includes('getBreedsForSpecies')).toBe(true);
    expect(idx.includes('getBreedById')).toBe(true);
    expect(idx.includes('getLabel')).toBe(true);
    expect(idx.includes('getPopularBreeds')).toBe(true);
    expect(idx.includes('getPlaceholderBreeds')).toBe(true);
  });

  it('H2. PR-PET-4 shell + context still present', () => {
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

  it('H3. PR-PET-5 BreedAutocomplete still present + still consumed by BreedStep', () => {
    expect(
      existsSync(
        resolve(ROOT, 'client/src/pages/onboarding/components/BreedAutocomplete.tsx'),
      ),
    ).toBe(true);
    const breedStep = read('client/src/pages/onboarding/steps/BreedStep.tsx');
    expect(breedStep.includes('BreedAutocomplete')).toBe(true);
  });

  it('H4. shell render branches preserve order: welcome → name → species → breed → photo → review', () => {
    const shell = read('client/src/pages/onboarding/PetOnboardingShell.tsx');
    const order = ['welcome', 'name', 'species', 'breed', 'photo', 'review'];
    let lastIdx = -1;
    for (const id of order) {
      const needle = `step === '${id}'`;
      const idx = shell.indexOf(needle);
      expect(idx, `expected step branch for ${id}`).toBeGreaterThan(-1);
      expect(idx, `step ${id} must follow earlier steps`).toBeGreaterThan(lastIdx);
      lastIdx = idx;
    }
  });
});
