/**
 * PR-PET-7 — pet onboarding accessibility + mobile polish regression suite.
 *
 * CEO directive (2026-05-10) for PR-PET-7 SAFE HIGH-VELOCITY model
 * Lane C:
 *   • mobile / RTL / keyboard / tap-target polish only
 *   • no finance / backend / schema / storage / upload service /
 *     provider payout / payments
 *   • feature flag still OFF (parent shell controls; no new flag)
 *   • source-pin tested
 *   • single-revert
 *
 * What this suite source-pins:
 *   A. Files exist + structure unchanged at the high level
 *   B. Scope guards — same money / API / persistence firewall as
 *      PR-PET-4..6 (non-regression of the existing invariants)
 *   C. Accessibility attributes — aria-* on inputs, radiogroup,
 *      listbox / combobox, image alt, progressbar with min+max
 *   D. Keyboard handlers attached — onKeyDown on inputs that need
 *      arrow nav / cropper / radiogroup
 *   E. Tap-target invariants — min-h-[44px] (or larger) on every
 *      interactive surface in the new components
 *   F. Input font ≥ 16px (iOS auto-zoom prevention)
 *   G. RTL safety — no hardcoded `dir="ltr"`; no text-left where
 *      text-start should appear in changed files; no left-/right-
 *      tailwind classes that would break RTL
 *   H. Reduced-motion — motion-reduce:transition-none on
 *      animated transitions in the shell
 *   I. Feature-flag chain still gated by parent shell
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..');

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), 'utf8');
}

function codeOnly(src: string): string {
  let out = src;
  out = out.replace(/\/\*[\s\S]*?\*\//g, '');
  out = out.replace(/(^|[^:])\/\/.*$/gm, '$1');
  out = out.replace(/'(?:\\.|[^'\\])*'/g, "''");
  out = out.replace(/"(?:\\.|[^"\\])*"/g, '""');
  out = out.replace(/`(?:\\.|[^`\\])*`/g, '``');
  return out;
}

const PR7_TOUCHED = [
  'client/src/pages/onboarding/PetOnboardingShell.tsx',
  'client/src/pages/onboarding/components/BreedAutocomplete.tsx',
  'client/src/pages/onboarding/components/PhotoCropper.tsx',
  'client/src/pages/onboarding/components/PhotoUploader.tsx',
  'client/src/pages/onboarding/steps/NameStep.tsx',
  'client/src/pages/onboarding/steps/SpeciesStep.tsx',
  'client/src/pages/onboarding/steps/PhotoStep.tsx',
  'client/src/pages/onboarding/steps/ReviewStep.tsx',
];

// ─────────────────────────────────────────────────────────────────────────
// A. File existence
// ─────────────────────────────────────────────────────────────────────────
describe('PR-PET-7 — A. file presence (non-regression)', () => {
  it('A1. all PR-PET-4..6 onboarding files still present', () => {
    for (const rel of PR7_TOUCHED) {
      const src = read(rel); // throws if missing
      expect(src.length).toBeGreaterThan(0);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────
// B. Scope guards — money / persistence firewall preserved
// ─────────────────────────────────────────────────────────────────────────
describe('PR-PET-7 — B. money + persistence firewall (non-regression)', () => {
  const FORBIDDEN_KEYWORDS: ReadonlyArray<RegExp> = [
    /\bStripe\b/,
    /\bTranzila\b/,
    /\bNayax\b/,
    /\bUPay\b/i,
    /\bSUMIT\b/i,
    /\bMasav\b/i,
    /\bWallet\b/,
    /\bPayout\b/i,
    /\bBilling\b/,
    /\bPayment(s|Provider|Method)\b/,
    /\bIBAN\b/,
  ];
  const FORBIDDEN_RUNTIME: ReadonlyArray<RegExp> = [
    /\bfetch\s*\(/,
    /\bnew\s+FormData\b/,
    /apiRequest\(/,
    /localStorage\.(set|remove|clear)/,
    /sessionStorage\.(set|remove|clear)/,
    /document\.cookie\s*=/,
    /\/api\/uploads?\b/,
    /\/api\/pets\b(?!-breeds)/,
    /\/api\/wallet/,
    /\/api\/payments?/,
    /\/api\/payouts?/,
    /indexedDB/,
  ];
  for (const rel of PR7_TOUCHED) {
    it(`B[${rel}] no money / vendor identifiers in live code`, () => {
      const src = codeOnly(read(rel));
      for (const rx of FORBIDDEN_KEYWORDS) {
        expect(rx.test(src), `${rel} contains forbidden ${rx}`).toBe(false);
      }
    });
    it(`B[${rel}] no runtime persistence / fetch / FormData`, () => {
      const src = codeOnly(read(rel));
      for (const rx of FORBIDDEN_RUNTIME) {
        expect(rx.test(src), `${rel} violates ${rx}`).toBe(false);
      }
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// C. Accessibility attributes
// ─────────────────────────────────────────────────────────────────────────
describe('PR-PET-7 — C. aria attributes', () => {
  it('C1. NameStep input has aria-required + aria-invalid + aria-label', () => {
    const src = read('client/src/pages/onboarding/steps/NameStep.tsx');
    expect(src.includes('aria-required="true"')).toBe(true);
    expect(src.includes('aria-invalid=')).toBe(true);
    expect(src.includes('aria-label=')).toBe(true);
  });

  it('C2. SpeciesStep radiogroup is labelled + required', () => {
    const src = read('client/src/pages/onboarding/steps/SpeciesStep.tsx');
    expect(src.includes('role="radiogroup"')).toBe(true);
    expect(src.includes('aria-required="true"')).toBe(true);
    expect(src.includes('aria-label=')).toBe(true);
    // Each card carries role="radio" + aria-checked.
    expect(src.includes('role="radio"')).toBe(true);
    expect(src.includes('aria-checked')).toBe(true);
  });

  it('C3. BreedAutocomplete combobox has aria-controls + aria-activedescendant + aria-expanded + aria-autocomplete', () => {
    const src = read('client/src/pages/onboarding/components/BreedAutocomplete.tsx');
    expect(src.includes('role="combobox"')).toBe(true);
    expect(src.includes('aria-controls=')).toBe(true);
    expect(src.includes('aria-activedescendant=')).toBe(true);
    expect(src.includes('aria-expanded=')).toBe(true);
    expect(src.includes('aria-autocomplete=')).toBe(true);
    expect(src.includes('role="listbox"')).toBe(true);
    expect(src.includes('role="option"')).toBe(true);
  });

  it('C4. PhotoCropper viewport is keyboard-focusable + role="application" + labelled', () => {
    const src = read('client/src/pages/onboarding/components/PhotoCropper.tsx');
    expect(src.includes('role="application"')).toBe(true);
    expect(src.includes('aria-label=')).toBe(true);
    expect(src.includes('aria-roledescription=')).toBe(true);
    expect(src.includes('tabIndex={0}')).toBe(true);
  });

  it('C5. ReviewStep + PhotoStep image alt attributes derived from pet name (not empty)', () => {
    const review = read('client/src/pages/onboarding/steps/ReviewStep.tsx');
    expect(review.includes('alt={draft.name')).toBe(true);
    const photo = read('client/src/pages/onboarding/steps/PhotoStep.tsx');
    expect(photo.includes('alt={draft.name')).toBe(true);
  });

  it('C6. Shell progress-bar has aria-valuemin AND aria-valuemax AND aria-valuenow', () => {
    const src = read('client/src/pages/onboarding/PetOnboardingShell.tsx');
    expect(src.includes('role="progressbar"')).toBe(true);
    expect(src.includes('aria-valuenow=')).toBe(true);
    expect(src.includes('aria-valuemin={0}')).toBe(true);
    expect(src.includes('aria-valuemax={100}')).toBe(true);
  });

  it('C7. Shell main landmark is keyboard-focusable for step-change focus', () => {
    const src = read('client/src/pages/onboarding/PetOnboardingShell.tsx');
    expect(/tabIndex=\{-1\}/.test(src)).toBe(true);
    expect(src.includes('aria-live="polite"')).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// D. Keyboard handlers attached
// ─────────────────────────────────────────────────────────────────────────
describe('PR-PET-7 — D. keyboard handlers', () => {
  it('D1. BreedAutocomplete input handles ArrowUp / ArrowDown / Enter / Escape / Home / End', () => {
    const src = read('client/src/pages/onboarding/components/BreedAutocomplete.tsx');
    expect(src.includes('onKeyDown=')).toBe(true);
    for (const key of ['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', 'Escape']) {
      expect(src.includes(`'${key}'`), `BreedAutocomplete missing ${key}`).toBe(true);
    }
  });

  it('D2. PhotoCropper viewport handles Arrow + zoom keys', () => {
    const src = read('client/src/pages/onboarding/components/PhotoCropper.tsx');
    expect(src.includes('onKeyDown=')).toBe(true);
    for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']) {
      expect(src.includes(`'${key}'`), `PhotoCropper missing ${key}`).toBe(true);
    }
    // Zoom + reset:
    expect(src.includes("'+'")).toBe(true);
    expect(src.includes("'-'")).toBe(true);
    expect(src.includes("'0'")).toBe(true);
  });

  it('D3. SpeciesStep radio cards handle Arrow nav + Home + End', () => {
    const src = read('client/src/pages/onboarding/steps/SpeciesStep.tsx');
    expect(src.includes('onKeyDown=')).toBe(true);
    for (const key of ['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End']) {
      expect(src.includes(`'${key}'`), `SpeciesStep missing ${key}`).toBe(true);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────
// E. Tap-target invariants
// ─────────────────────────────────────────────────────────────────────────
describe('PR-PET-7 — E. 44px tap target invariants', () => {
  it('E1. BreedAutocomplete option carries min-h-[44px]', () => {
    const src = read('client/src/pages/onboarding/components/BreedAutocomplete.tsx');
    expect(src.includes('min-h-[44px]')).toBe(true);
  });

  it('E2. PhotoUploader CTA min-h ≥ 44px', () => {
    const src = read('client/src/pages/onboarding/components/PhotoUploader.tsx');
    expect(/min-h-\[(44|48|5\d|6\d|7\d|8\d|9\d)px\]/.test(src)).toBe(true);
  });

  it('E3. PhotoCropper bottom buttons min-h ≥ 44px', () => {
    const src = read('client/src/pages/onboarding/components/PhotoCropper.tsx');
    expect(/min-h-\[(44|48|5\d|6\d|7\d|8\d|9\d)px\]/.test(src)).toBe(true);
  });

  it('E4. SpeciesStep cards min-h-[88px] (master-plan luxury target)', () => {
    const src = read('client/src/pages/onboarding/steps/SpeciesStep.tsx');
    expect(src.includes('min-h-[88px]')).toBe(true);
  });

  it('E5. NameStep input min-h-[44px]', () => {
    const src = read('client/src/pages/onboarding/steps/NameStep.tsx');
    expect(src.includes('min-h-[44px]')).toBe(true);
  });

  it('E6. PhotoStep change-photo affordance min-h-[44px]', () => {
    const src = read('client/src/pages/onboarding/steps/PhotoStep.tsx');
    expect(src.includes('min-h-[44px]')).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// F. Input font ≥ 16px (iOS auto-zoom prevention)
// ─────────────────────────────────────────────────────────────────────────
describe('PR-PET-7 — F. input font ≥ 16px', () => {
  it('F1. NameStep input fontSize ≥ 16px (no auto-zoom on iOS)', () => {
    const src = read('client/src/pages/onboarding/steps/NameStep.tsx');
    // Either an explicit 16px style or any larger value.
    const m = src.match(/fontSize:\s*'(\d+)px'/);
    expect(m, 'NameStep input must declare an explicit fontSize style').toBeTruthy();
    const px = m ? parseInt(m[1], 10) : 0;
    expect(px).toBeGreaterThanOrEqual(16);
  });

  it('F2. BreedAutocomplete search input fontSize ≥ 16px', () => {
    const src = read('client/src/pages/onboarding/components/BreedAutocomplete.tsx');
    const m = src.match(/fontSize:\s*'(\d+)px'/);
    expect(m).toBeTruthy();
    const px = m ? parseInt(m[1], 10) : 0;
    expect(px).toBeGreaterThanOrEqual(16);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// G. RTL safety
// ─────────────────────────────────────────────────────────────────────────
describe('PR-PET-7 — G. RTL safety', () => {
  it('G1. no `dir="ltr"` hardcoded in any onboarding file', () => {
    for (const rel of PR7_TOUCHED) {
      const src = read(rel);
      expect(src.includes('dir="ltr"'), `${rel} hardcodes dir=ltr`).toBe(false);
    }
  });

  it('G2. BreedAutocomplete option uses text-start (not text-left)', () => {
    const src = read('client/src/pages/onboarding/components/BreedAutocomplete.tsx');
    expect(src.includes('text-start')).toBe(true);
    // text-left should not appear in live code (RTL-unsafe).
    const code = codeOnly(src);
    expect(/\btext-left\b/.test(code), 'BreedAutocomplete uses text-left (RTL-unsafe)').toBe(false);
  });

  it('G3. SpeciesStep card uses text-start (not text-left)', () => {
    const src = read('client/src/pages/onboarding/steps/SpeciesStep.tsx');
    const code = codeOnly(src);
    expect(/\btext-left\b/.test(code), 'SpeciesStep uses text-left (RTL-unsafe)').toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// H. Reduced-motion preference
// ─────────────────────────────────────────────────────────────────────────
describe('PR-PET-7 — H. prefers-reduced-motion respect', () => {
  it('H1. Shell progress + buttons respect motion-reduce', () => {
    const src = read('client/src/pages/onboarding/PetOnboardingShell.tsx');
    // At least one motion-reduce:transition-none must appear; expect
    // multiple occurrences to cover both progress + button transitions.
    const matches = src.match(/motion-reduce:transition-none/g) || [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// I. Feature-flag chain still gated
// ─────────────────────────────────────────────────────────────────────────
describe('PR-PET-7 — I. feature-flag chain unchanged', () => {
  it('I1. PR-PET-7 introduces NO new feature flag in any touched file', () => {
    for (const rel of PR7_TOUCHED) {
      const src = codeOnly(read(rel));
      expect(/import\.meta\.env\.VITE_PET_/i.test(src),
        `${rel} introduces a new VITE_PET_* flag`).toBe(false);
    }
  });

  it('I2. App.tsx still gates the shell on VITE_PET_ONBOARDING_SHELL_ENABLED', () => {
    const app = read('client/src/App.tsx');
    expect(app.includes("VITE_PET_ONBOARDING_SHELL_ENABLED === 'true'"))
      .toBe(true);
  });

  it('I3. immersive-routes still lists /onboarding/pet', () => {
    const src = read('client/src/lib/immersive-routes.ts');
    expect(src.includes("'/onboarding/pet'")).toBe(true);
  });
});
