import { describe, it, expect } from 'vitest';
import { calculateTransparentFees, validateFeeCalculation } from '../utils/sitterFeeCalculator';

/**
 * Sitter pricing — ONE 15% fee, and only one.
 *
 * 2026-09-17: the CEO's one money model (shared/marketplaceMoney.ts, "same as
 * Mad Paws, Rover"): the owner pays the sitter's rate + a 15% Pet Wash fee on
 * top, the sitter is owed the whole rate, and the 18% VAT is INSIDE the fee.
 * This replaces the 2026-07-31 version (fee taken out of the rate, sitter
 * netted 85%), which disagreed with booking_requests.
 *
 * What these pins still forbid is the pre-2026-07-31 leak: owner paid
 * base + 15% + VAT on top AND the sitter lost 15% — a ~30% real take. Exactly
 * one 15% may exist, VAT is never added on top of it, and nothing comes out of
 * the sitter.
 */
describe('sitter fees — one 15% fee on top, sitter keeps the whole rate', () => {
  it('₪150/day × 3 days: customer pays ₪517.50, sitter is owed ₪450, Pet Wash ₪67.50', () => {
    const f = calculateTransparentFees(15000, 3); // ₪150/day × 3

    expect(f.basePriceCents).toBe(45000);          // ₪450 — the sitter's rate
    expect(f.platformServiceFeeCents).toBe(6750);  // 15% fee = ₪67.50
    expect(f.brokerCutCents).toBe(6750);
    expect(f.totalChargeCents).toBe(51750);        // rate + fee
    expect(f.sitterPayoutCents).toBe(45000);       // the whole rate
    // VAT extracted from the fee (18/118): 6750 × 18/118 = 1029.6 → 1030
    expect(f.vatCents).toBe(1030);
    expect(f.subtotalBeforeVatCents).toBe(51750 - 1030);
  });

  it('exactly ONE fee, VAT never on top, nothing taken from the sitter', () => {
    for (const [rate, days] of [[6000, 1], [20000, 5], [9900, 2], [30000, 7]] as const) {
      const f = calculateTransparentFees(rate, days);
      expect(f.sitterPayoutCents).toBe(f.basePriceCents);                             // sitter keeps 100%
      expect(f.totalChargeCents).toBe(f.basePriceCents + f.platformServiceFeeCents);  // ONE fee
      expect(f.platformServiceFeeCents).toBe(Math.round(f.basePriceCents * 0.15));
      expect(f.vatCents).toBeLessThan(f.platformServiceFeeCents);                     // VAT inside the fee
      // The old ~30% leak would put the customer above rate × 1.15.
      expect(f.totalChargeCents).toBeLessThanOrEqual(Math.round(f.basePriceCents * 1.15) + 1);
      expect(validateFeeCalculation(f)).toBe(true);
    }
  });

  it('₪100: fee ₪15, sitter ₪100, customer ₪115', () => {
    const f = calculateTransparentFees(10000, 1);
    expect(f.platformServiceFeeCents).toBe(1500);
    expect(f.sitterPayoutCents).toBe(10000);
    expect(f.totalChargeCents).toBe(11500);
  });

  it('the validator rejects the old models', () => {
    const good = calculateTransparentFees(10000, 1);
    // Fee taken out of the sitter (the 2026-07-31 → 09-17 model).
    expect(validateFeeCalculation({ ...good, sitterPayoutCents: 8500, totalChargeCents: 10000 })).toBe(false);
    // Fee on top AND taken from the sitter (the pre-07-31 double take).
    expect(validateFeeCalculation({ ...good, sitterPayoutCents: 8500 })).toBe(false);
  });
});
