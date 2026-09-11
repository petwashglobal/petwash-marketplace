import { describe, it, expect, vi } from 'vitest';
import { MEMBER_DISCOUNT_MAX_PERCENT } from '@shared/schema-member-discount';

/**
 * THE STALE LOYALTY TABLE CANNOT BREACH THE DISCOUNT CAP (2026-09-11)
 *
 * server/services/loyalty.ts carries a stale five-tier table (BRONZE..DIAMOND,
 * 0-20%) that matches no surface we ship. The canonical ladder is
 * shared/schema-loyalty.ts; the real charge caps at MEMBER_DISCOUNT_MAX_PERCENT.
 *
 * Nothing charges off it today — verified end to end. `getLoyaltyStatus` puts
 * it on `LoyaltyUser.discount`, and the only consumers read the object as an
 * existence check or ignore the field entirely. It is a phantom field.
 *
 * It is pinned rather than deleted because the comment in routes.ts already
 * warns it "should be deleted before someone wires it" — and the day someone
 * does, the cap must hold. Advertising a bigger discount than is charged is a
 * false-discount promise.
 *
 * Behavioural: the function is called and its OUTPUT asserted.
 */
vi.mock('../db', () => ({ db: { execute: async () => ({ rows: [] }) } }));
vi.mock('../lib/firebase-admin', () => ({ default: {} }));
vi.mock('../lib/logger', () => ({ logger: { info: () => {}, warn: () => {}, error: () => {} } }));

const load = async () => await import('../services/loyalty');

describe('getTierDiscount can never exceed the member discount cap', () => {
  it('every tier in the table is at or below the cap', async () => {
    const { getTierDiscount } = await load();
    for (const tier of ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND'] as const) {
      const pct = getTierDiscount(tier);
      expect(pct, `${tier} exceeds the cap`).toBeLessThanOrEqual(MEMBER_DISCOUNT_MAX_PERCENT);
    }
  });

  it('DIAMOND specifically — the raw table says 20, the cap says otherwise', async () => {
    // This is the exact value that would have shipped a false-discount promise.
    const { getTierDiscount } = await load();
    expect(getTierDiscount('DIAMOND')).toBe(MEMBER_DISCOUNT_MAX_PERCENT);
  });

  it('lower tiers are untouched — clamping must not flatten the ladder', async () => {
    const { getTierDiscount } = await load();
    expect(getTierDiscount('BRONZE')).toBe(0);
    expect(getTierDiscount('SILVER')).toBe(5);
  });

  it('an unknown tier yields zero, never a default discount', async () => {
    const { getTierDiscount } = await load();
    expect(getTierDiscount('NOT_A_TIER' as any)).toBe(0);
  });
});
