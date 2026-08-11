/**
 * Money constant / formula corrections (CEO audit 2026-08-11).
 * Four verified divergences where a hand-typed copy disagreed with the canonical:
 *   · admin-escrow-reconciliation wrote VAT as fee*0.18 (additive) into the escrow
 *     ledger — should EXTRACT 18/118 from the VAT-inclusive commission.
 *   · qr-activation gave platinum 15% wash discount, above the enforced 10% cap.
 *   · unified-vouchers wash-price allow-list was missing the live ₪48/₪55 prices.
 *   · nayaxFirestore legacy voucher rail defaulted the wash to ₪50, not ₪55.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { vatFromInclusive } from '@shared/money';

const R = (p: string) => readFileSync(resolve(__dirname, '..', '..', p), 'utf8');

describe('escrow reconciliation VAT extracts 18/118 (not * 0.18)', () => {
  const src = R('server/routes/admin-escrow-reconciliation.ts');
  it('uses vatFromInclusive, not the additive * 0.18', () => {
    expect(src).toMatch(/vatCents\s*=\s*vatFromInclusive\(platformFeeCents\)/);
    expect(src).not.toMatch(/vatCents\s*=\s*Math\.round\(platformFeeCents\s*\*\s*0\.18\)/);
  });
  it('the two formulas genuinely differ (proves it was a real bug)', () => {
    const fee = 1500;
    expect(Math.round(fee * 0.18)).toBe(270);   // old, wrong
    expect(vatFromInclusive(fee)).toBe(229);     // new, correct
  });
});

describe('qr-activation clamps the wash discount to the 10% cap', () => {
  const src = R('server/routes/qr-activation.ts');
  it('imports the canonical cap and clamps to it', () => {
    expect(src).toMatch(/MEMBER_DISCOUNT_MAX_PERCENT/);
    expect(src).toMatch(/Math\.min\(raw,\s*MEMBER_DISCOUNT_MAX_PERCENT\s*\/\s*100\)/);
  });
});

describe('wash-price allow-lists include the live ₪48/₪55 prices', () => {
  it('unified-vouchers now accepts 48 and 55', () => {
    const src = R('server/routes/unified-vouchers.ts');
    expect(src).toMatch(/VALID_WASH_PRICES_ILS\s*=\s*\[45,\s*48,\s*55,/);
  });
});

describe('legacy Firestore voucher rail default wash price is the canonical ₪55', () => {
  it('defaults to 55, not 50', () => {
    const src = R('server/nayaxFirestoreService.ts');
    expect(src).toMatch(/K9000_WASH_PRICE\s*=\s*parseFloat\(process\.env\.K9000_WASH_PRICE\s*\|\|\s*'55'\)/);
  });
});
