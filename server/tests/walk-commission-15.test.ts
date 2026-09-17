/**
 * Walk pricing — ONE 15% fee, on top, and only one.
 *
 * 2026-09-17: the CEO's one money model (shared/marketplaceMoney.ts, "same as
 * Mad Paws, Rover"): owner pays the walker's rate + a 15% Pet Wash fee, the
 * walker is owed the whole rate, and the 18% VAT is INSIDE the fee. Replaces
 * the 2026-06-15 version (fee out of the rate, walker netted 85%).
 *
 * Still forbidden: the pre-06-15 30% double take (owner +15% AND walker −15%).
 */
import { describe, it, expect } from 'vitest';
import {
  calculateWalkFees,
  validateWalkFeeCalculation,
  getWalkCommissionBreakdown,
} from '../utils/walkFeeCalculator';

describe('calculateWalkFees — one 15% fee on top (₪100 rate)', () => {
  const f = calculateWalkFees(10000); // ₪100

  it('owner pays the rate + the fee: ₪115', () => {
    expect(f.totalChargeCents).toBe(11500);
    expect(f.totalChargeWithVATCents).toBe(11500); // VAT is inside the fee, not added
    expect(f.platformServiceFeeOwnerCents).toBe(1500);
  });

  it('walker is owed the whole ₪100 — nothing is taken from them', () => {
    expect(f.walkerPayoutCents).toBe(10000);
    expect(f.walkerFeeCents).toBe(0);
  });

  it('Pet Wash keeps ₪15, with its VAT inside (18/118)', () => {
    expect(f.platformCommissionTotalCents).toBe(1500);
    expect(f.vatCents).toBe(Math.round(1500 * (0.18 / 1.18))); // 229 = ₪2.29
    expect(f.vatCents).toBeLessThan(f.platformCommissionTotalCents);
  });

  it('platform take is exactly one 15% — NOT 30%', () => {
    const platformTake = f.totalChargeCents - f.walkerPayoutCents; // 11500 − 10000
    expect(platformTake).toBe(1500);
    expect(platformTake / f.basePriceCents).toBe(0.15);
  });

  it('passes its own validator, and the validator rejects both old models', () => {
    expect(validateWalkFeeCalculation(f)).toBe(true);
    // fee taken out of the walker (06-15 → 09-17)
    expect(validateWalkFeeCalculation({ ...f, walkerPayoutCents: 8500, walkerFeeCents: 1500, totalChargeCents: 10000, totalChargeWithVATCents: 10000, platformServiceFeeOwnerCents: 0 })).toBe(false);
    // the double take (pre 06-15)
    expect(validateWalkFeeCalculation({ ...f, walkerPayoutCents: 8500, walkerFeeCents: 1500 })).toBe(false);
  });

  it('breakdown reports the fee on the owner and nothing from the walker', () => {
    const b = getWalkCommissionBreakdown();
    expect(b.platformCommissionTotalRate).toBe(0.15);
    expect(b.ownerFeeRate).toBe(0.15);
    expect(b.walkerFeeRate).toBe(0);
    expect(b.walkerPayoutRate).toBe(1);
  });
});
