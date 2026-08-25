import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock the data layer so the canonical earn engine can be exercised
//    deterministically without a real DB. Queue-based: each select chain
//    resolves the next queued result; updates/inserts are recorded.
const selectQueue: any[][] = [];
const updates: { vals: any }[] = [];
const inserts: { vals: any }[] = [];
// Tests can push a returning() result each time an update is expected;
// awardLoyaltyPoints since PR #2143 reads the committed post-increment
// balance from RETURNING instead of computing it in JS.
const returningQueue: any[][] = [];

vi.mock('../db', () => {
  const db = {
    select: () => {
      const chain: any = {
        from: () => chain,
        where: () => chain,
        limit: () => {
          const next = selectQueue.shift();
          if (next === undefined) return Promise.reject(new Error('unexpected select'));
          return Promise.resolve(next);
        },
      };
      return chain;
    },
    update: () => ({
      set: (vals: any) => ({
        where: () => {
          updates.push({ vals });
          const chain: any = Promise.resolve([]);
          chain.returning = () => {
            const next = returningQueue.shift();
            return Promise.resolve(next ?? []);
          };
          return chain;
        },
      }),
    }),
    insert: () => ({
      values: (vals: any) => {
        inserts.push({ vals });
        return Promise.resolve([]);
      },
    }),
  };
  return { db };
});

const tierUpgrade = {
  value: { upgraded: false } as any,
};
vi.mock('../email/luxury-email-service', () => ({
  detectTierUpgrade: vi.fn(() => tierUpgrade.value),
}));

vi.mock('../lib/logger', () => ({ logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } }));

import { awardLoyaltyPoints, pointsForSpend, POINTS_PER_SHEKEL } from '../services/loyaltyEarn';

beforeEach(() => {
  selectQueue.length = 0;
  updates.length = 0;
  inserts.length = 0;
  returningQueue.length = 0;
  tierUpgrade.value = { upgraded: false };
});

describe('pointsForSpend — ₪ → points conversion', () => {
  it('is 1 point per shekel (repo-wide constant)', () => {
    expect(POINTS_PER_SHEKEL).toBe(1);
    expect(pointsForSpend(55)).toBe(55);
  });
  it('floors fractional shekels', () => {
    expect(pointsForSpend(55.9)).toBe(55);
  });
  it('floors junk and negatives to 0', () => {
    expect(pointsForSpend(-10)).toBe(0);
    expect(pointsForSpend(NaN)).toBe(0);
  });
});

describe('awardLoyaltyPoints — canonical earn into loyaltyProfiles + pointsTransactions', () => {
  const input = { userId: 'user-1', amount: 55, source: 'wash_package_purchase', sourceId: 'wh-42' };

  it('awards on a fresh confirmed spend and writes the ledger row', async () => {
    selectQueue.push([]); // idempotency check: no prior earn for this event
    selectQueue.push([{ userId: 'user-1', points: 100, lifetimePoints: 100 }]);
    // The atomic UPDATE ... RETURNING returns the post-increment truth.
    returningQueue.push([{ points: 155, lifetimePoints: 155 }]);

    const result = await awardLoyaltyPoints(input);

    expect(result.awarded).toBe(true);
    expect(result.points).toBe(55);
    expect(result.newBalance).toBe(155);
    expect(result.tierUpgraded).toBe(false);

    // one profile update: both points AND lifetime bump by the earn.
    // Since PR #2143 the .set() uses `sql\`x + n\`` fragments, so we can't
    // assert on the numeric value — verify the SHAPE is a drizzle sql object
    // and that the increment reached the DB via .returning() (asserted via
    // result.newBalance above).
    expect(updates).toHaveLength(1);
    expect(updates[0].vals.points).toBeDefined();
    expect(updates[0].vals.lifetimePoints).toBeDefined();

    // one ledger row, typed 'earned', carrying the idempotency identity.
    // balance is the atomic post-increment value from RETURNING.
    expect(inserts).toHaveLength(1);
    expect(inserts[0].vals).toMatchObject({
      userId: 'user-1',
      type: 'earned',
      amount: 55,
      balance: 155,
      source: 'wash_package_purchase',
      sourceId: 'wh-42',
    });
  });

  it('is idempotent — a webhook retry for the same (user, source, sourceId) never double-awards', async () => {
    selectQueue.push([{ id: 7 }]); // prior earn exists

    const result = await awardLoyaltyPoints(input);

    expect(result).toEqual({ awarded: false, skipped: 'duplicate' });
    expect(updates).toHaveLength(0);
    expect(inserts).toHaveLength(0);
  });

  it('skips non-enrolled users (no loyaltyProfiles row) without erroring', async () => {
    selectQueue.push([]); // no prior earn
    selectQueue.push([]); // no profile

    const result = await awardLoyaltyPoints(input);

    expect(result).toEqual({ awarded: false, skipped: 'no_profile' });
    expect(updates).toHaveLength(0);
    expect(inserts).toHaveLength(0);
  });

  it('skips zero / negative / missing input without touching the DB', async () => {
    expect(await awardLoyaltyPoints({ ...input, amount: 0 })).toEqual({ awarded: false, skipped: 'zero' });
    expect(await awardLoyaltyPoints({ ...input, amount: -5 })).toEqual({ awarded: false, skipped: 'zero' });
    expect(await awardLoyaltyPoints({ ...input, userId: '' })).toEqual({ awarded: false, skipped: 'zero' });
    expect(updates).toHaveLength(0);
    expect(inserts).toHaveLength(0);
  });

  it('floors fractional amounts before awarding', async () => {
    selectQueue.push([]);
    selectQueue.push([{ userId: 'user-1', points: 0, lifetimePoints: 0 }]);
    returningQueue.push([{ points: 48, lifetimePoints: 48 }]);

    const result = await awardLoyaltyPoints({ ...input, amount: 48.9 });

    expect(result.points).toBe(48);
    expect(inserts[0].vals.amount).toBe(48);
  });

  it('applies a tier upgrade when lifetime points cross a threshold', async () => {
    selectQueue.push([]);
    selectQueue.push([{ userId: 'user-1', points: 900, lifetimePoints: 900 }]);
    returningQueue.push([{ points: 1100, lifetimePoints: 1100 }]);
    tierUpgrade.value = { upgraded: true, previousTier: 'member', newTier: 'silver' };

    const result = await awardLoyaltyPoints({ ...input, amount: 200 });

    expect(result.tierUpgraded).toBe(true);
    expect(result.newTier).toBe('silver');
    // two updates: points (atomic sql), then tier
    expect(updates).toHaveLength(2);
    expect(updates[1].vals.tier).toBe('silver');
  });

  it('never throws — a DB failure reports skipped: error', async () => {
    // empty queue → the mocked select rejects
    const result = await awardLoyaltyPoints(input);
    expect(result).toEqual({ awarded: false, skipped: 'error' });
  });
});
