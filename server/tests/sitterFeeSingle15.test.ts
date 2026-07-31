import { describe, it, expect } from 'vitest';
import { calculateTransparentFees, validateFeeCalculation } from '../utils/sitterFeeCalculator';

/**
 * Pins the 2026-07-31 sitter pricing fix: a SINGLE 15% disclosed-agent commission
 * (customer pays the sitter's rate, sitter nets 85%, VAT extracted 18/118) — matching
 * Walk My Pet. Guards against a regression back to the old ~30% double-take (owner paid
 * base + 15% + VAT AND sitter kept 100%) which also double-charged at capture.
 */
describe('sitter fees — single 15% disclosed-agent (matches Walk)', () => {
  it('₪150/day × 3 days: customer pays the rate, sitter nets 85%, VAT extracted', () => {
    const f = calculateTransparentFees(15000, 3); // ₪150/day × 3

    expect(f.basePriceCents).toBe(45000);          // ₪450 base
    expect(f.totalChargeCents).toBe(45000);        // customer pays EXACTLY the rate (no on-top)
    expect(f.platformServiceFeeCents).toBe(6750);  // 15% commission = ₪67.50
    expect(f.brokerCutCents).toBe(6750);
    expect(f.sitterPayoutCents).toBe(38250);       // 85% = ₪382.50
    // VAT extracted from the commission (18/118): 6750 × 18/118 = 1029.6 → 1030
    expect(f.vatCents).toBe(1030);
  });

  it('customer total NEVER exceeds the base (no owner surcharge, no VAT on top)', () => {
    for (const [rate, days] of [[6000, 1], [20000, 5], [9900, 2], [30000, 7]] as const) {
      const f = calculateTransparentFees(rate, days);
      expect(f.totalChargeCents).toBe(f.basePriceCents);        // pays the rate, nothing more
      expect(f.sitterPayoutCents + f.brokerCutCents).toBe(f.basePriceCents); // 85% + 15% = 100%
      expect(f.vatCents).toBeLessThanOrEqual(f.platformServiceFeeCents);     // VAT extracted, not added
      expect(validateFeeCalculation(f)).toBe(true);
    }
  });

  it('commission is exactly 15% of the base and sitter payout is exactly 85%', () => {
    const f = calculateTransparentFees(10000, 1); // ₪100
    expect(f.platformServiceFeeCents).toBe(1500);  // ₪15
    expect(f.sitterPayoutCents).toBe(8500);        // ₪85
    expect(f.totalChargeCents).toBe(10000);        // customer pays ₪100
  });
});
