/**
 * PR-EGIFT-1000-PRODUCT-NAME — the ₪1000 top card is labelled
 * consistently as "Luxury / יוקרה" everywhere.
 *
 * Fire-order item 4. Pre-fix the /egift page showed the ₪1000 card
 * as `en:'Maison', he:'מזון'` — the Hebrew was a mistranslation
 * (`מזון` = "food"). The homepage GiftCards component showed
 * `en:'Maison', he:'יוקרה'` — Hebrew was correct but English was
 * "Maison". Two different display strings for the same product plus
 * a broken Hebrew label on the /egift page.
 *
 * Fix: unify the ELITE tier's display label across BOTH surfaces on
 * the Luxury/יוקרה family. Internal tier key `ELITE` is unchanged
 * (used for card image lookup + backend SKU mapping).
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..');
const EGIFT = 'client/src/pages/EGift.tsx';
const GIFTCARDS = 'client/src/components/GiftCards.tsx';

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), 'utf8');
}

describe('PR-EGIFT-1000-PRODUCT-NAME', () => {
  it('A1. /egift page ELITE tier: English is "Luxury", Hebrew is "יוקרה" (never "מזון" = food)', () => {
    const src = read(EGIFT);
    const line = src.split(/\r?\n/).find(l => /ELITE\s*:\s*\{\s*en\s*:/.test(l)) || '';
    expect(line.length).toBeGreaterThan(0);
    expect(line.includes("en: 'Luxury'")).toBe(true);
    expect(line.includes("he: 'יוקרה'")).toBe(true);
    // Anti-regression: the pre-fix broken values must not reappear.
    expect(line.includes("he: 'מזון'")).toBe(false);
    expect(line.includes("en: 'Maison'")).toBe(false);
  });

  it('A2. homepage GiftCards ELITE tier matches (same Luxury/יוקרה family)', () => {
    const src = read(GIFTCARDS);
    const line = src.split(/\r?\n/).find(l => /ELITE\s*:\s*\{\s*en\s*:/.test(l)) || '';
    expect(line.length).toBeGreaterThan(0);
    expect(line.includes("en: 'Luxury'")).toBe(true);
    expect(line.includes("he: 'יוקרה'")).toBe(true);
    expect(line.includes("en: 'Maison'")).toBe(false);
  });

  it('A3. internal ELITE tier key preserved (backend SKU + card image lookups unchanged)', () => {
    // The tier key `ELITE` is what maps to card images (cardImages.ELITE)
    // and the backend SKU (EGIFT_1000). This fix must not alter the key,
    // only the display string.
    const egift = read(EGIFT);
    expect(/tier:\s*['"]ELITE['"]/.test(egift)).toBe(true);
    expect(/EGIFT_1000/.test(egift)).toBe(true);
  });

  it('A4. no customer-facing surface renders "מזון" as an eGift product label', () => {
    // The Hebrew word for "food" — using it as a top-tier gift product
    // label was the exact pre-fix bug. Guard against reintroduction.
    const egift = read(EGIFT);
    const giftcards = read(GIFTCARDS);
    // In the tierLabels blocks specifically — not elsewhere on the pages
    // that might legitimately reference food (e.g. sitter description).
    const egiftLabelBlock = egift.match(/tierLabels\s*:[\s\S]*?\}\s*;/)?.[0] || egift;
    const gcLabelBlock = giftcards.match(/tierLabels\s*:[\s\S]*?\}\s*;/)?.[0] || giftcards;
    expect(egiftLabelBlock.includes("'מזון'")).toBe(false);
    expect(gcLabelBlock.includes("'מזון'")).toBe(false);
  });
});
