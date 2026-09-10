/**
 * lib/memberTier — the one truth for the tier a member is shown/reported as.
 *
 * users.loyaltyTier is 'bronze' for every signup, so the Apple/Google Wallet
 * pass, /update-vip, /pass/:linkId, /email-cards, /admin-send and the two
 * Nayax loyalty routes all called a non-enrolled member "BRONZE" (and
 * admin-send even defaulted to "gold"). Tier = 'new' unless an active
 * privilegeMembers row exists; passes print MEMBER for it.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const h = vi.hoisted(() => ({ rows: [] as any[], throwNext: false }));
vi.mock('../db', () => ({
  db: {
    select: () => ({ from: () => ({ where: () => ({ limit: async () => { if (h.throwNext) { h.throwNext = false; throw new Error('pg down'); } return h.rows; } }) }) }),
  },
}));
vi.mock('../lib/logger', () => ({ logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

import { resolveMemberTier, isPrestigeEnrolled, tierLabel } from '../lib/memberTier';

describe('memberTier', () => {
  beforeEach(() => { h.rows = []; h.throwNext = false; });

  it("not enrolled → 'new' even when loyaltyTier says bronze", async () => {
    expect(await resolveMemberTier('bronze', 'a@petwash.invalid')).toBe('new');
  });
  it('enrolled → the recorded tier, lower-cased, bronze when unset', async () => {
    h.rows = [{ status: 'active' }];
    expect(await resolveMemberTier('GOLD', 'a@petwash.invalid')).toBe('gold');
    expect(await resolveMemberTier(null, 'a@petwash.invalid')).toBe('bronze');
  });
  it("no email → 'new' without touching the database", async () => {
    expect(await isPrestigeEnrolled(undefined)).toBe(false);
    expect(await resolveMemberTier('bronze', null)).toBe('new');
  });
  it("database error → fails closed to 'new'", async () => {
    h.throwNext = true;
    expect(await resolveMemberTier('gold', 'a@petwash.invalid')).toBe('new');
  });
  it('inactive membership row is not enrolled', async () => {
    h.rows = [{ status: 'cancelled' }];
    expect(await isPrestigeEnrolled('a@petwash.invalid')).toBe(false);
  });
  it('labels: new prints MEMBER, never a raw NEW', () => {
    expect(tierLabel('new')).toBe('MEMBER');
    expect(tierLabel(undefined)).toBe('MEMBER');
    expect(tierLabel('bronze')).toBe('BRONZE');
    expect(tierLabel('black')).toBe('BLACK RESERVE');
  });
});
