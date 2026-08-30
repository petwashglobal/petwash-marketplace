/**
 * PrestigeBenefitEvaluator — Program 20.
 */
import { describe, it, expect } from 'vitest';
import { benefitsForContext } from '../services/marketplace/PrestigeBenefitEvaluator';

describe('PrestigeBenefitEvaluator', () => {
  it('CUSTOMER leg, NONE tier → no benefits', () => {
    expect(benefitsForContext({ tier: 'NONE', actorLeg: 'CUSTOMER' })).toEqual([]);
  });

  it('CUSTOMER leg, BRONZE → 5% discount', () => {
    const out = benefitsForContext({ tier: 'BRONZE', actorLeg: 'CUSTOMER' });
    expect(out.find((b) => b.code === 'DISCOUNT_PCT')?.valueNumeric).toBe(5);
  });

  it('CUSTOMER leg, GOLD → 12% discount + FREE_WASH_PER_MONTH=1 + priority + birthday', () => {
    const out = benefitsForContext({ tier: 'GOLD', actorLeg: 'CUSTOMER' });
    expect(out.find((b) => b.code === 'DISCOUNT_PCT')?.valueNumeric).toBe(12);
    expect(out.find((b) => b.code === 'FREE_WASH_PER_MONTH')?.valueNumeric).toBe(1);
    expect(out.some((b) => b.code === 'PRIORITY_SUPPORT')).toBe(true);
    expect(out.some((b) => b.code === 'BIRTHDAY_GIFT')).toBe(true);
  });

  it('CUSTOMER leg, PLATINUM → 15% + concierge + 2 free washes', () => {
    const out = benefitsForContext({ tier: 'PLATINUM', actorLeg: 'CUSTOMER' });
    expect(out.find((b) => b.code === 'DISCOUNT_PCT')?.valueNumeric).toBe(15);
    expect(out.find((b) => b.code === 'FREE_WASH_PER_MONTH')?.valueNumeric).toBe(2);
    expect(out.some((b) => b.code === 'CONCIERGE_ACCESS')).toBe(true);
  });

  it('PROVIDER leg, GOLD → NO benefits (do not alter provider earnings)', () => {
    expect(benefitsForContext({ tier: 'GOLD', actorLeg: 'PROVIDER' })).toEqual([]);
  });

  it('PROVIDER leg at every tier returns []', () => {
    for (const tier of ['NONE', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM'] as const) {
      expect(benefitsForContext({ tier, actorLeg: 'PROVIDER' })).toEqual([]);
    }
  });
});
