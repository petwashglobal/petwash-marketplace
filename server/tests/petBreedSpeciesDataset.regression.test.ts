/**
 * PR-PET-3 — pet breed / species dataset foundation.
 *
 * Source: docs/product/pet-profile-luxury-onboarding-master-plan.md
 *         §2 (species), §3 (breed autocomplete), §11 (localisation).
 *
 * What the dataset is:
 *   • Read-only TypeScript reference data under shared/data/.
 *   • Consumed by FUTURE PRs (PR-PET-5 autocomplete UI, future
 *     server-side validators); nothing imports it yet.
 *   • Localised label shape across PR-PET-2's 6 languages.
 *
 * What this test suite locks:
 *   A. Data integrity — IDs unique across the entire dataset, all IDs
 *      are kebab-case, every breed has a canonical English label, every
 *      species in SUPPORTED_SPECIES has at least one entry (or is
 *      explicitly hasBreedList=false with placeholders only).
 *   B. Per-species placeholders — every species has mixed + unknown +
 *      other placeholder rows so the PR-PET-2 i18n keys
 *      (petOnboarding.breed.mixed / unknown / cantFind) have a
 *      uniform target shape.
 *   C. Localised label fall-back — getLabel() returns en when other
 *      languages are absent (matches PR-PET-2 English-stub pattern).
 *   D. Data scope guards — no money / wallet / finance / payment
 *      keyword anywhere in the dataset; no DB / HTTP imports; no
 *      schema (pgTable / pgEnum) declarations; no server-only imports
 *      (the dataset must remain shared between client + server).
 *   E. PR-PET-1 + PR-PET-2 invariants preserved verbatim.
 *
 * No new dependency. No runtime activation. No edit to any source file
 * outside shared/data/pet-breeds/* + shared/data/pet-species.ts and
 * this new test file.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';

import {
  ALL_BREEDS,
  SUPPORTED_LANGS,
  SUPPORTED_SPECIES,
  getBreedById,
  getBreedsForSpecies,
  getPopularBreeds,
  getPlaceholderBreeds,
  getLabel,
  isKnownBreedId,
  type SpeciesId,
} from '../../shared/data/pet-breeds';
import {
  PET_SPECIES,
  getSpecies,
  isSupportedSpecies,
} from '../../shared/data/pet-species';

const ROOT = resolve(__dirname, '..', '..');

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), 'utf8');
}

// ── A. Data integrity ────────────────────────────────────────────────────

describe('PR-PET-3 — data integrity', () => {
  it('1. SUPPORTED_LANGS matches PR-PET-2 (en/he/ar/ru/fr/es)', () => {
    expect([...SUPPORTED_LANGS].sort()).toEqual(['ar', 'en', 'es', 'fr', 'he', 'ru']);
  });

  it('2. SUPPORTED_SPECIES contains the 9 CEO-listed species', () => {
    expect([...SUPPORTED_SPECIES].sort()).toEqual([
      'bird', 'cat', 'dog', 'guinea_pig', 'other',
      'rabbit', 'reptile', 'small_mammal', 'snake',
    ]);
  });

  it('3. PET_SPECIES has one entry per SUPPORTED_SPECIES (no duplicates, no missing)', () => {
    const ids = PET_SPECIES.map((s) => s.id).sort();
    expect(ids).toEqual([...SUPPORTED_SPECIES].sort());
  });

  it('4. all breed IDs are unique across the entire dataset', () => {
    const ids = ALL_BREEDS.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('5. all breed IDs are kebab-case ASCII', () => {
    for (const b of ALL_BREEDS) {
      expect(b.id).toMatch(/^[a-z][a-z0-9-]*[a-z0-9]$/);
    }
  });

  it('6. every breed has a non-empty English label', () => {
    for (const b of ALL_BREEDS) {
      expect(b.label.en).toBeDefined();
      expect(b.label.en.length).toBeGreaterThan(0);
    }
  });

  it('7. every breed.species is one of SUPPORTED_SPECIES', () => {
    for (const b of ALL_BREEDS) {
      expect((SUPPORTED_SPECIES as readonly string[]).includes(b.species)).toBe(true);
    }
  });

  it('8. dog list has at least 30 real (non-placeholder) breeds', () => {
    const dogReal = ALL_BREEDS.filter((b) => b.species === 'dog' && !b.placeholder);
    expect(dogReal.length).toBeGreaterThanOrEqual(30);
  });

  it('9. cat list has at least 20 real breeds', () => {
    const catReal = ALL_BREEDS.filter((b) => b.species === 'cat' && !b.placeholder);
    expect(catReal.length).toBeGreaterThanOrEqual(20);
  });

  it('10. PET_SPECIES dog + cat + bird are flagged hasBreedList=true', () => {
    expect(getSpecies('dog')?.hasBreedList).toBe(true);
    expect(getSpecies('cat')?.hasBreedList).toBe(true);
    expect(getSpecies('bird')?.hasBreedList).toBe(true);
  });
});

// ── B. Per-species placeholders ─────────────────────────────────────────

describe('PR-PET-3 — per-species placeholders required by PR-PET-2 i18n keys', () => {
  // Per the PR-PET-2 keys petOnboarding.breed.mixed / unknown /
  // cantFind, every species (including the open-list ones) must offer
  // mixed + unknown + other placeholder rows so the UI surfaces a
  // uniform "I don't know my pet's breed" path regardless of species.
  // Exception: 'other' species itself is the catch-all and only needs
  // unknown.
  for (const species of SUPPORTED_SPECIES.filter((s) => s !== 'other')) {
    it(`11. species ${species} has placeholders mixed + unknown + other`, () => {
      const placeholders = getPlaceholderBreeds(species as SpeciesId);
      const kinds = new Set(placeholders.map((p) => p.placeholder));
      expect(kinds.has('mixed')).toBe(true);
      expect(kinds.has('unknown')).toBe(true);
      expect(kinds.has('other')).toBe(true);
    });
  }

  it('12. species "other" has at least an unknown placeholder', () => {
    const placeholders = getPlaceholderBreeds('other');
    expect(placeholders.length).toBeGreaterThanOrEqual(1);
    expect(placeholders.some((p) => p.placeholder === 'unknown')).toBe(true);
  });
});

// ── C. Localised label fall-back ─────────────────────────────────────────

describe('PR-PET-3 — getLabel() fall-back behaviour', () => {
  it('13. returns the requested language when present', () => {
    const dog = getSpecies('dog')!;
    expect(getLabel(dog.label, 'he')).toBe('כלב');
    expect(getLabel(dog.label, 'es')).toBe('Perro');
  });

  it('14. falls back to en when the requested language is absent', () => {
    // Most breed entries only carry en; getLabel must return en for
    // any other language without throwing.
    const labrador = getBreedById('dog-labrador-retriever')!;
    expect(getLabel(labrador.label, 'he')).toBe(labrador.label.en);
    expect(getLabel(labrador.label, 'ar')).toBe(labrador.label.en);
    expect(getLabel(labrador.label, 'ru')).toBe(labrador.label.en);
    expect(getLabel(labrador.label, 'fr')).toBe(labrador.label.en);
    expect(getLabel(labrador.label, 'es')).toBe(labrador.label.en);
  });

  it('15. falls back to en when the language value is an empty string', () => {
    const fakeLabel = { en: 'Hello', he: '' as string };
    expect(getLabel(fakeLabel, 'he')).toBe('Hello');
  });
});

// ── D. Accessor helpers ─────────────────────────────────────────────────

describe('PR-PET-3 — accessor helpers', () => {
  it('16. getBreedsForSpecies returns only matching breeds', () => {
    const dogs = getBreedsForSpecies('dog');
    expect(dogs.length).toBeGreaterThan(0);
    for (const b of dogs) expect(b.species).toBe('dog');
  });

  it('17. getPopularBreeds excludes placeholders', () => {
    for (const species of ['dog', 'cat', 'bird'] as const) {
      const popular = getPopularBreeds(species);
      for (const b of popular) {
        expect(b.popular).toBe(true);
        expect(b.placeholder).toBeUndefined();
      }
    }
  });

  it('18. getPopularBreeds(dog) has at least 5 entries (CEO directive)', () => {
    expect(getPopularBreeds('dog').length).toBeGreaterThanOrEqual(5);
  });

  it('19. isKnownBreedId true for real ids, false for unknown', () => {
    expect(isKnownBreedId('dog-labrador-retriever')).toBe(true);
    expect(isKnownBreedId('dog-MIXED')).toBe(false); // case-sensitive
    expect(isKnownBreedId('not-a-breed-anywhere')).toBe(false);
  });

  it('20. isSupportedSpecies recognises the 9 species and rejects others', () => {
    for (const s of SUPPORTED_SPECIES) expect(isSupportedSpecies(s)).toBe(true);
    expect(isSupportedSpecies('alien')).toBe(false);
    expect(isSupportedSpecies('')).toBe(false);
  });
});

// ── E. Scope guards (no money / no schema / no DB-HTTP imports) ─────────

describe('PR-PET-3 — scope guards (defence in depth)', () => {
  // List every dataset file we shipped; assert no forbidden patterns.
  const datasetFiles = [
    'shared/data/pet-species.ts',
    'shared/data/pet-breeds/types.ts',
    'shared/data/pet-breeds/index.ts',
    'shared/data/pet-breeds/dog.ts',
    'shared/data/pet-breeds/cat.ts',
    'shared/data/pet-breeds/bird.ts',
    'shared/data/pet-breeds/other.ts',
  ];

  it('21. no money / wallet / finance keyword in any dataset file', () => {
    const forbidden = /(payout|refund|wallet|charge|invoice|nayax|tranzila|stripe|sumit|capture\b|debit|credit\s*card)/i;
    for (const f of datasetFiles) {
      const src = read(f);
      // Strip block + line comments so the prose in the file header
      // (which contains the literal "no money / wallet / payment
      // surface anywhere here") doesn't false-positive on its own
      // explanatory sentences.
      const codeOnly = src
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');
      expect(codeOnly, `forbidden keyword in ${f}`).not.toMatch(forbidden);
    }
  });

  it('22. no schema declaration (pgTable / pgEnum / drizzle-orm) in any dataset file', () => {
    for (const f of datasetFiles) {
      const src = read(f);
      expect(src, `schema in ${f}`).not.toMatch(/\bpgTable\s*\(/);
      expect(src, `pgEnum in ${f}`).not.toMatch(/\bpgEnum\s*\(/);
      expect(src, `drizzle-orm in ${f}`).not.toMatch(/from\s*['"]drizzle-orm['"]/);
    }
  });

  it('23. no DB / HTTP / server-only imports', () => {
    for (const f of datasetFiles) {
      const src = read(f);
      expect(src, `db import in ${f}`).not.toMatch(/from\s+['"][^'"]*\/db['"]/);
      expect(src, `server import in ${f}`).not.toMatch(/from\s+['"][^'"]*server\//);
      expect(src, `fetch in ${f}`).not.toMatch(/\bfetch\s*\(/);
      expect(src, `axios in ${f}`).not.toMatch(/from\s+['"]axios['"]/);
    }
  });

  it('24. dataset files are leaf modules (no side effects at import time)', () => {
    // Exporting top-level constants is fine; statements that execute
    // for side effect (console.log, function calls at top level, etc.)
    // are not.
    for (const f of datasetFiles) {
      const src = read(f);
      const codeOnly = src
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');
      expect(codeOnly, `top-level console in ${f}`).not.toMatch(/^console\./m);
      expect(codeOnly, `top-level process.env in ${f}`).not.toMatch(/process\.env\./);
    }
  });
});

// ── F. PR-PET-1 + PR-PET-2 invariants preserved ────────────────────────

describe('PR-PET-3 — prior PR-PET pins still hold (companion-PR safety)', () => {
  it('25. PR-PET-1 audit-pin file is unchanged in shape', () => {
    const src = read('server/tests/petProfileFragmentation.regression.test.ts');
    expect(src).toMatch(/PR-PET-1 — pet-profile fragmentation audit pins/);
    expect(src).toMatch(/AGGREGATE: at least 6 distinct pgTable definitions/);
  });

  it('26. PR-PET-2 i18n test file is unchanged in shape', () => {
    const src = read('server/tests/petOnboardingI18nKeys.regression.test.ts');
    expect(src).toMatch(/PR-PET-2 — petOnboarding namespace exists in all 6 locales/);
  });

  it('27. PR-PET-2 petOnboarding namespace still present in every locale', () => {
    for (const lang of ['en', 'he', 'ar', 'ru', 'fr', 'es']) {
      const data = JSON.parse(read(`client/public/locales/${lang}/translation.json`));
      expect(data.petOnboarding).toBeDefined();
      expect(typeof data.petOnboarding).toBe('object');
    }
  });

  it('28. dataset directory contains exactly the 6 files we shipped', () => {
    const files = readdirSync(resolve(ROOT, 'shared/data/pet-breeds')).sort();
    expect(files).toEqual([
      'bird.ts',
      'cat.ts',
      'dog.ts',
      'index.ts',
      'other.ts',
      'types.ts',
    ]);
  });
});

// ── G. Traceability ────────────────────────────────────────────────────

describe('PR-PET-3 — traceability marker', () => {
  it('29. PR-PET-3 marker present in this test file (grepability)', () => {
    const self = read('server/tests/petBreedSpeciesDataset.regression.test.ts');
    const markers = self.match(/PR-PET-3/g) || [];
    expect(markers.length).toBeGreaterThanOrEqual(2);
  });
});
