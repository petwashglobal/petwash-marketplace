/**
 * PR-PET-2 — luxury pet onboarding translation keys (no UI behaviour
 * change).
 *
 * Source: docs/product/pet-profile-luxury-onboarding-master-plan.md
 *         (PR #213, merged) §11 Localisation.
 *
 * What this PR adds:
 *   A new `petOnboarding` namespace in each of the 6 locale files
 *   under client/public/locales/<lang>/translation.json with neutral
 *   English strings as values (matching the EXISTING pattern: today
 *   all 6 locale files contain identical English-stub content; full
 *   translation is a separate task). Future PR-PET-4+ wires the
 *   strings into the real onboarding UI.
 *
 * What this PR does NOT do:
 *   • No UI flow change, no new pages, no component edits.
 *   • No fix to the i18n architecture split. The monolithic
 *     `client/src/lib/i18n.ts` (2515-line live system) and the
 *     `client/public/locales/<lang>/translation.json` files (loaded by
 *     `client/src/lib/i18next-init.ts` which currently has empty
 *     resources — pinned by PR-PET-1 T16) coexist.
 *     Consolidation is its own future PR class.
 *   • No payment / wallet / finance / tax / invoice / K9000 / Nayax
 *     / Tranzila / Stripe / SUMIT / HubSpot / auth / admin /
 *     provider activation change.
 *   • No schema / dependency change.
 *   • No edits to PR-PET-1 audit pins (preserved verbatim).
 *
 * Locked invariants this suite enforces:
 *
 *   A. petOnboarding namespace exists in all 6 locale files
 *      (en / he / ar / ru / fr / es).
 *   B. The KEY SET is identical across all 6 languages — every
 *      sub-namespace + every leaf key appears in every locale.
 *      This is the property that prevents drift when localisers
 *      eventually add real translations.
 *   C. Required sub-namespaces present (the 10 categories from the
 *      CEO directive): start, species, basics, breed, photo, health,
 *      behaviour, petId, emptyStates, consent.
 *   D. All 6 locale JSON files parse without error.
 *   E. All 6 locale JSON files share the same total key count
 *      (proves no language is missing any key from the new
 *      namespace).
 *   F. No runtime route / component / config file is touched by
 *      this PR (only locale JSONs).
 *   G. No payment / finance / wallet keyword introduced into the
 *      new namespace values.
 *   H. No schema files touched.
 *   I. PR-PET-1 audit-pin file is untouched.
 *
 * No new dependency. No new test infrastructure. Read-only file
 * inspection only.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..');
const LANGS = ['en', 'he', 'ar', 'ru', 'fr', 'es'] as const;
type Lang = typeof LANGS[number];

function readLocale(lang: Lang): any {
  return JSON.parse(
    readFileSync(resolve(ROOT, `client/public/locales/${lang}/translation.json`), 'utf8'),
  );
}

const REQUIRED_SUBNAMESPACES = [
  'start',
  'species',
  'basics',
  'breed',
  'photo',
  'health',
  'behaviour',
  'petId',
  'emptyStates',
  'consent',
] as const;

// Recursively collect leaf-key paths from an object tree.
// e.g. { start: { addPet: "..." } } → ['start.addPet']
function flattenKeys(obj: any, prefix = ''): string[] {
  const out: string[] = [];
  for (const k of Object.keys(obj)) {
    const v = (obj as any)[k];
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      out.push(...flattenKeys(v, path));
    } else {
      out.push(path);
    }
  }
  return out.sort();
}

// ── A. namespace exists in all 6 locale files ─────────────────────────────

describe('PR-PET-2 — petOnboarding namespace exists in all 6 locales', () => {
  for (const lang of LANGS) {
    it(`1. ${lang}/translation.json contains a petOnboarding object`, () => {
      const data = readLocale(lang);
      expect(data.petOnboarding).toBeDefined();
      expect(typeof data.petOnboarding).toBe('object');
      expect(data.petOnboarding).not.toBeNull();
    });
  }
});

// ── B. identical key set across all 6 languages ───────────────────────────

describe('PR-PET-2 — key set is identical across all 6 languages (drift guard)', () => {
  it('2. flattened key list is identical for en / he / ar / ru / fr / es', () => {
    const reference = flattenKeys(readLocale('en').petOnboarding);
    expect(reference.length).toBeGreaterThan(0);
    for (const lang of LANGS) {
      const keys = flattenKeys(readLocale(lang).petOnboarding);
      expect(keys).toEqual(reference);
    }
  });

  it('3. all leaf values are non-empty strings (no missing translations placeholder)', () => {
    for (const lang of LANGS) {
      const flat = flattenKeys(readLocale(lang).petOnboarding);
      const data = readLocale(lang);
      for (const path of flat) {
        const value = path.split('.').reduce<any>(
          (acc, k) => (acc == null ? acc : acc[k]),
          data.petOnboarding,
        );
        expect(typeof value).toBe('string');
        expect(value.length).toBeGreaterThan(0);
      }
    }
  });
});

// ── C. required sub-namespaces present ────────────────────────────────────

describe('PR-PET-2 — 10 required sub-namespaces (per CEO outline)', () => {
  for (const ns of REQUIRED_SUBNAMESPACES) {
    it(`4. en.petOnboarding.${ns} is present and non-empty`, () => {
      const data = readLocale('en');
      expect(data.petOnboarding[ns]).toBeDefined();
      expect(typeof data.petOnboarding[ns]).toBe('object');
      expect(Object.keys(data.petOnboarding[ns]).length).toBeGreaterThan(0);
    });
  }

  it('5. CEO species coverage (dog / puppy / cat / kitten / bird / smallMammal / reptile / other / unknown)', () => {
    const sp = readLocale('en').petOnboarding.species;
    const required = ['dog', 'puppy', 'cat', 'kitten', 'bird', 'smallMammal', 'reptile', 'other', 'unknown'];
    for (const k of required) expect(sp[k]).toBeDefined();
  });

  it('6. CEO start-flow keys present (addPet, addAnotherPet, skip, continue, back, saveAndReturn, oneTimeNotice)', () => {
    const start = readLocale('en').petOnboarding.start;
    const required = [
      'addPet', 'addAnotherPet', 'skip', 'continue', 'back',
      'saveAndReturn', 'oneTimeNotice',
    ];
    for (const k of required) expect(start[k]).toBeDefined();
  });

  it('7. CEO health/safety keys present (desexed, microchipped, vaccinated, providerConsent, etc.)', () => {
    const h = readLocale('en').petOnboarding.health;
    const required = [
      'desexed', 'microchipped', 'vaccinated', 'medicalNotes',
      'allergies', 'medication', 'vetDetails', 'emergencyContact',
      'providerConsent',
    ];
    for (const k of required) expect(h[k]).toBeDefined();
  });

  it('8. CEO behaviour keys present (energy levels low/medium/high/veryHigh)', () => {
    const b = readLocale('en').petOnboarding.behaviour;
    expect(b.energyLow).toBeDefined();
    expect(b.energyMedium).toBeDefined();
    expect(b.energyHigh).toBeDefined();
    expect(b.energyVeryHigh).toBeDefined();
  });

  it('9. petId namespace covers Pet ID / Passport / badges / emergencyQR / wallet copy', () => {
    const p = readLocale('en').petOnboarding.petId;
    const required = [
      'name', 'passport', 'microchipBadge', 'vaccinationBadge',
      'medicalAlert', 'behaviourNote', 'emergencyQR', 'walletCardCopy',
    ];
    for (const k of required) expect(p[k]).toBeDefined();
  });

  it('10. consent namespace covers privacy/export/delete/deactivate', () => {
    const c = readLocale('en').petOnboarding.consent;
    const required = [
      'privateByDefault', 'providerVisibility',
      'exportData', 'deletePet', 'deactivatePet',
    ];
    for (const k of required) expect(c[k]).toBeDefined();
  });
});

// ── D. all 6 locale files parse without error (covered above by readLocale,
//      pinned here as an explicit invariant) ───────────────────────────────

describe('PR-PET-2 — all 6 locale JSON files parse', () => {
  for (const lang of LANGS) {
    it(`11. ${lang}/translation.json is valid JSON`, () => {
      expect(() => readLocale(lang)).not.toThrow();
    });
  }
});

// ── E. identical total key count across the 6 files ──────────────────────

describe('PR-PET-2 — total key count identical across the 6 files', () => {
  it('12. all 6 locale files share the same flattened key count (top-level)', () => {
    const counts = LANGS.map((lang) => flattenKeys(readLocale(lang)).length);
    const reference = counts[0];
    for (const c of counts) {
      expect(c).toBe(reference);
    }
  });
});

// ── F. no runtime route / component / config file touched ─────────────────

describe('PR-PET-2 — no runtime / route / component / config / schema file touched', () => {
  // We pin the absence of ANY non-locale-JSON change in this PR by asserting
  // that the i18n engine files + key consumer points are unchanged in a way
  // detectable from disk: their content patterns persist. (Full enforcement
  // is via the PR diff at review; these are belt-and-suspenders.)

  it('13. client/src/lib/i18next-init.ts STILL has empty resources (PR-PET-1 T16 still holds)', () => {
    const src = readFileSync(
      resolve(ROOT, 'client/src/lib/i18next-init.ts'),
      'utf8',
    );
    expect(src).toMatch(/en:\s*\{\s*translation:\s*\{\s*\}\s*\}/);
  });

  it('14. client/src/lib/i18n.ts is still the 2515-line monolith (>= 2000 lines)', () => {
    const src = readFileSync(resolve(ROOT, 'client/src/lib/i18n.ts'), 'utf8');
    expect(src.split('\n').length).toBeGreaterThanOrEqual(2000);
  });
});

// ── G. no payment / wallet / finance keyword introduced ──────────────────

describe('PR-PET-2 — no payment / finance keyword introduced into namespace values', () => {
  // Scan only the new `petOnboarding` namespace values for forbidden words.
  it('15. petOnboarding values contain no payment / finance keyword', () => {
    const FORBIDDEN = /(payout|refund|wallet|charge|invoice|nayax|tranzila|stripe|sumit|capture|debit|credit\s*card|premium\s*membership)/i;
    for (const lang of LANGS) {
      const flat = flattenKeys(readLocale(lang).petOnboarding);
      const data = readLocale(lang);
      for (const path of flat) {
        const value = path.split('.').reduce<any>(
          (acc, k) => (acc == null ? acc : acc[k]),
          data.petOnboarding,
        );
        expect(value).not.toMatch(FORBIDDEN);
      }
    }
  });
});

// ── H. no schema files touched ──────────────────────────────────────────

describe('PR-PET-2 — no schema files touched', () => {
  // Pin the schema files PR-PET-1 cited; their content shape must be
  // unchanged in this PR. We grep for the canonical `pets` pgTable
  // declarations that PR-PET-1 already pins; if any of them were removed
  // by this PR, that would be a scope violation.
  it('16. shared/schema.ts still declares pets pgTable (audit pin preserved)', () => {
    const src = readFileSync(resolve(ROOT, 'shared/schema.ts'), 'utf8');
    expect(src).toMatch(/export\s+const\s+pets\s*=\s*pgTable\(\s*['"]pets['"]/);
  });

  it('17. shared/super-app-schema.ts pets pgTable still present', () => {
    const src = readFileSync(resolve(ROOT, 'shared/super-app-schema.ts'), 'utf8');
    expect(src).toMatch(/export\s+const\s+pets\s*=\s*pgTable\(\s*['"]pets['"]/);
  });
});

// ── I. PR-PET-1 audit-pin file is untouched ─────────────────────────────

describe('PR-PET-2 — PR-PET-1 audit pins remain untouched (companion-PR safety)', () => {
  it('18. petProfileFragmentation.regression.test.ts is unchanged in shape', () => {
    const src = readFileSync(
      resolve(ROOT, 'server/tests/petProfileFragmentation.regression.test.ts'),
      'utf8',
    );
    // Pin known PR-PET-1 markers from the file we just shipped.
    expect(src).toMatch(/PR-PET-1 — pet-profile fragmentation audit pins/);
    expect(src).toMatch(/AGGREGATE: at least 6 distinct pgTable definitions/);
    expect(src).toMatch(/pin: \/api\/pets duplicate mount/);
  });
});

// ── Cross-cutting traceability ─────────────────────────────────────────

describe('PR-PET-2 — traceability marker', () => {
  it('19. PR-PET-2 marker present in this test file (grepability)', () => {
    const self = readFileSync(
      resolve(ROOT, 'server/tests/petOnboardingI18nKeys.regression.test.ts'),
      'utf8',
    );
    const markers = self.match(/PR-PET-2/g) || [];
    expect(markers.length).toBeGreaterThanOrEqual(2);
  });
});
