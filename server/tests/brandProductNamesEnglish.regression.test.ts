/**
 * Brand rule 3 pin — product names stay in ENGLISH, in every language.
 *
 * petwash-visual-design SKILL §0.3 + memory `brand-language-platform-names`:
 * a product name is a name, not a word. Hebrew UI keeps `PetFinder`,
 * `PetTrek`, `Pet Sitter`, `PetWash Smart Hub`, `Prestige` in Latin script —
 * transliterating them ("פטפיינדר", "סמארט האב", "פרסטיז'") reads as a
 * different, cheaper product.
 *
 * These three files each held a transliterated `he` value while their own
 * siblings kept English (platformCards' smart-hub/academy, PetWashDivisions'
 * `The Sitter Suite™`) — drift, not a decision. This test pins the fix so a
 * future translation pass can't quietly re-Hebraise them.
 *
 * NOT pinned here (they need CEO sign-off, see the 2026-09-10 brand sweep):
 * the header nav dictionary's "מרכז PetWash™" / "אקדמיית PetWash™", which
 * translate Hub/Academy across all six languages at once.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const ROOT = path.resolve(__dirname, '..', '..', 'client', 'src');
const read = (...p: string[]) => fs.readFileSync(path.join(ROOT, ...p), 'utf8');

const CARDS = read('content', 'platformCards.ts');
const DIVISIONS = read('components', 'PetWashDivisions.tsx');
const DISCOUNT = read('components', 'WashDiscountNote.tsx');

// Hebrew transliterations that must never come back.
const FORBIDDEN: Array<[string, string]> = [
  ['פטפיינדר', 'PetFinder'],
  ['פטטרק', 'PetTrek'],
  ['סמארט האב', 'Smart Hub'],
  ['פרסטיז', 'Prestige'],
  ['פרסטיג', 'Prestige'],
];

describe('brand rule 3 — product names stay English in Hebrew UI', () => {
  for (const [source, name] of [
    [CARDS, 'platformCards.ts'],
    [DIVISIONS, 'PetWashDivisions.tsx'],
    [DISCOUNT, 'WashDiscountNote.tsx'],
  ] as Array<[string, string]>) {
    for (const [translit, english] of FORBIDDEN) {
      it(`${name} carries no "${translit}" (must read "${english}")`, () => {
        expect(source).not.toContain(translit);
      });
    }
  }

  it('platformCards keeps every he title in Latin script', () => {
    // Each card's `title` block is `he: '…'` immediately followed by `en: '…'`.
    const titles = [...CARDS.matchAll(/(?<!sub)title:\s*\{\s*\n\s*he:\s*'([^']*)',\s*\n\s*en:\s*'([^']*)',/g)];
    expect(titles.length).toBeGreaterThanOrEqual(6);
    for (const [, he, en] of titles) {
      expect(he, `he title "${he}" should equal the English name "${en}"`).toBe(en);
    }
  });

  it('PetWashDivisions keeps every nameHe identical to its English name', () => {
    const names = [...DIVISIONS.matchAll(/name:\s*'([^']*)',\s*\n\s*nameHe:\s*'([^']*)',/g)];
    expect(names.length).toBeGreaterThanOrEqual(3);
    for (const [, en, he] of names) {
      expect(he, `nameHe "${he}" should equal the English name "${en}"`).toBe(en);
    }
  });
});
