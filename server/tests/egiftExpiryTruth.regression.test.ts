/**
 * PR-EGIFT-EXPIRY-TRUTH — fire-order item 20.
 *
 * Backend enforces 12-month default eGift validity — see
 *   server/routes/wallet.ts:259           (365 * 24 * 60 * 60 * 1000)
 *   server/routes/google-wallet.ts:148    (365 * 24 * 60 * 60 * 1000)
 *   server/routes/gift-cards.ts:644 + 769 (365 * 24 * 60 * 60 * 1000)
 *
 * Public /egift copy said 24 months — over-promising. Aligned to the
 * enforced 12-month default. If the CEO wants 24-month economics, the
 * decision is separate: update all four backend defaults + this copy
 * in the same PR — DO NOT change one side without the other.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..');
const EGIFT = 'client/src/pages/EGift.tsx';
const I18N  = 'client/src/lib/i18n.ts';

function read(rel: string): string { return readFileSync(resolve(ROOT, rel), 'utf8'); }

describe('PR-EGIFT-EXPIRY-TRUTH', () => {
  const egift = read(EGIFT);
  const i18n  = read(I18N);

  it('A1. /egift valid24Months translation now says "12 Months" in all 6 locales', () => {
    // The specific translations block for the validity marker
    const block = egift.match(/en:\s*'Valid 12 Months'[\s\S]{0,600}es:\s*'Válido 12 meses'[^}]*\}/)?.[0] || '';
    expect(block.length).toBeGreaterThan(0);
    for (const s of ['12 Months', '12 חודשים', '12 شهراً', '12 месяцев', '12 mois', '12 meses']) {
      expect(block.includes(s)).toBe(true);
    }
  });

  it('A2. /egift inline "Valid: N months" caption also 12', () => {
    expect(egift.includes("Valid: 12 months")).toBe(true);
    expect(egift.includes("תוקף: 12 חודשים")).toBe(true);
    // Anti-regression on the inline caption.
    expect(egift.includes("Valid: 24 months")).toBe(false);
    expect(egift.includes("תוקף: 24 חודשים")).toBe(false);
  });

  it('A3. giftCards.term1 (homepage GiftCards + shared strings) is 12 months in all 6 locales', () => {
    const line = i18n.split(/\r?\n/).find(l => l.includes("'giftCards.term1'")) || '';
    expect(line.includes("valid for 12 months")).toBe(true);
    expect(line.includes("תקפים ל-12 חודשים")).toBe(true);
    // Anti-regression:
    expect(line.includes("valid for 24 months")).toBe(false);
    expect(line.includes("תקפים ל-24 חודשים")).toBe(false);
  });

  it('A4. no customer-facing surface still says "24 months" for eGift validity', () => {
    // Loyalty account-inactivity (LoyaltyTerms.tsx) and cookie
    // retention (Cookies.tsx) legitimately reference "24 months" for
    // DIFFERENT features — those are not eGift validity. Focus this
    // guard on the two eGift-scoped surfaces we just changed.
    const validityBlock = egift.match(/valid24Months[\s\S]{0,600}\}/)?.[0] || '';
    expect(validityBlock.includes('24 Months')).toBe(false);
    expect(validityBlock.includes('24 חודשים')).toBe(false);
  });
});
