/**
 * Walk commission is a single 15% (disclosed-agent), CEO-confirmed.
 *
 * Was a 30% double-take: owner charged +15% AND walker docked 15%. Now: owner
 * pays the rate, walker gets 85%, PetWash keeps 15% (VAT extracted from the
 * commission). Real unit test (calculateWalkFees is pure).
 */
import { describe, it, expect } from 'vitest';
import {
  calculateWalkFees,
  validateWalkFeeCalculation,
  getWalkCommissionBreakdown,
} from '../utils/walkFeeCalculator';

describe('calculateWalkFees — single 15% commission (₪100 base)', () => {
  const f = calculateWalkFees(10000); // ₪100

  it('owner pays exactly the rate (no +15% surcharge)', () => {
    expect(f.totalChargeCents).toBe(10000);
    expect(f.totalChargeWithVATCents).toBe(10000); // VAT is inside the commission
    expect(f.platformServiceFeeOwnerCents).toBe(0);
  });

  it('walker receives 85%', () => {
    expect(f.walkerPayoutCents).toBe(8500);
    expect(f.walkerFeeCents).toBe(1500);
  });

  it('PetWash keeps 15% commission, with VAT extracted (18/118)', () => {
    expect(f.platformCommissionTotalCents).toBe(1500);
    expect(f.vatCents).toBe(Math.round(1500 * (0.18 / 1.18))); // 229 = ₪2.29
    expect(f.vatCents).toBeLessThanOrEqual(f.platformCommissionTotalCents);
  });

  it('platform take is 15% of base, NOT 30%', () => {
    const platformTake = f.totalChargeCents - f.walkerPayoutCents; // 10000 - 8500
    expect(platformTake).toBe(1500);
    expect(platformTake / f.basePriceCents).toBe(0.15);
  });

  it('passes its own validator', () => {
    expect(validateWalkFeeCalculation(f)).toBe(true);
  });

  it('breakdown reports 0 owner-fee + 15% commission', () => {
    const b = getWalkCommissionBreakdown();
    expect(b.platformCommissionTotalRate).toBe(0.15);
    expect(b.ownerFeeRate).toBe(0);
    expect(b.walkerPayoutRate).toBe(0.85);
  });
});
