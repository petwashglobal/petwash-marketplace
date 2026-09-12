/**
 * Two CEO standing rules, re-applied 2026-09-13 after the PRs that fixed them
 * (#2351, #2356, both opened 2026-09-09) went conflicting and never merged.
 *
 * 1. A PRODUCT NAME IS A NAME. PetFinder / PetTrek / Smart Hub / Academy /
 *    Prestige stay English in every language — never transliterated into
 *    Hebrew letters. (Standing brand rule; the marketing surface is the CEO's.)
 *
 * 2. `dir="rtl"` mirrors the LAYOUT, never the GLYPH. A lucide <ArrowRight/>
 *    still draws an arrow pointing RIGHT on a Hebrew page, so a
 *    "next / learn more" affordance points BACKWARDS for the default reader
 *    on petwash.co.il. Flip the glyph (`rtl:rotate-180`) or swap the icon.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const R = (p: string) => readFileSync(resolve(__dirname, '..', '..', p), 'utf8');

describe('product names stay English in Hebrew', () => {
  const TRANSLITERATIONS: Array<[string, string]> = [
    ['פטפיינדר', 'PetFinder'],
    ['פטטרק', 'PetTrek'],
    ['סמארט האב', 'Smart Hub'],
    ["פרסטיז'", 'Prestige'],
  ];
  const SURFACES = [
    'client/src/content/platformCards.ts',
    'client/src/components/PetWashDivisions.tsx',
    'client/src/components/WashDiscountNote.tsx',
  ];
  for (const file of SURFACES) {
    it(`${file} spells every product name in English`, () => {
      const src = R(file);
      for (const [bad, good] of TRANSLITERATIONS) {
        expect(src, `${file} still transliterates "${bad}" — use "${good}"`).not.toContain(bad);
      }
    });
  }
  it('the Academy division is not transliterated either', () => {
    expect(R('client/src/components/PetWashDivisions.tsx')).not.toContain('אקדמיית ⁦Pet Wash™⁩');
  });
});

describe('forward arrows are not backwards in Hebrew', () => {
  const SURFACES = [
    'client/src/components/GiftCards.tsx',
    'client/src/components/WashPackages.tsx',
    'client/src/pages/k9000/Overview.tsx',
  ];
  for (const file of SURFACES) {
    it(`${file} mirrors every raw <ArrowRight/> glyph`, () => {
      const src = R(file);
      // Every rendered <ArrowRight … /> must carry an RTL flip, unless the file
      // swaps the icon instead (const X = isRtl ? ArrowRight : ArrowLeft).
      const rendered = [...src.matchAll(/<ArrowRight\b[^>]*\/>/g)].map((m) => m[0]);
      expect(rendered.length, `${file} renders no ArrowRight — pin is stale`).toBeGreaterThan(0);
      for (const tag of rendered) {
        expect(tag, `${file}: this arrow points backwards in Hebrew → add rtl:rotate-180`)
          .toMatch(/rtl:rotate-180|rotate-180/);
      }
    });
  }
});
