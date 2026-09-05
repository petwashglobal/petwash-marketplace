import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock the data layer so the canonical earn engine can be exercised
//    deterministically without a real DB. Queue-based: each select chain
//    resolves the next queued result. The profile UPDATE + ledger INSERT now
//    run inside db.transaction() (R8 fix), so the mock exposes a `tx` with the
//    same insert/update shape and an UPDATE …RETURNING that yields the
//    post-write balance. `insertError` lets a test simulate the unique-index
//    (23505) race the DB backstop raises.
const selectQueue: any[][] = [];
const updates: { vals: any }[] = [];
const inserts: { vals: any }[] = [];
const returningQueue: any[][] = [];
const hooks: { insertError: any } = { insertError: null };

function makeTx() {
  return {
    insert: () => ({
      values: (vals: any) => {
        inserts.push({ vals });
        if (hooks.insertError) return Promise.reject(hooks.insertError);
        return Promise.resolve([]);
      },
    }),
    update: () => ({
      set: (vals: any) => ({
        where: () => ({
          returning: () => {
            updates.push({ vals });
            const next = returningQueue.shift();
            return Promise.resolve(next ?? []);
          },
        }),
      }),
    }),
  };
}

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
    transaction: (fn: any) => fn(makeTx()),
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

import { awardLoyaltyPoints, reverseLoyaltyPoints, pointsForSpend, POINTS_PER_SHEKEL } from '../services/loyaltyEarn';

beforeEach(() => {
  selectQueue.length = 0;
  updates.length = 0;
  inserts.length = 0;
  returningQueue.length = 0;
  hooks.insertError = null;
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
    returningQueue.push([{ points: 155 }]); // profile UPDATE …RETURNING new balance

    const result = await awardLoyaltyPoints(input);

    expect(result.awarded).toBe(true);
    expect(result.points).toBe(55);
    expect(result.newBalance).toBe(155);
    expect(result.tierUpgraded).toBe(false);

    // exactly one profile update inside the transaction
    expect(updates).toHaveLength(1);

    // the ledger row is written FIRST (before the balance moves) so the unique
    // index can trip before any points change — typed 'earned', carrying the
    // idempotency identity.
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

  it('treats a losing unique-index race (23505) as a duplicate, not an error', async () => {
    selectQueue.push([]); // fast-path idempotency check clears
    selectQueue.push([{ userId: 'user-1', points: 100, lifetimePoints: 100 }]);
    hooks.insertError = Object.assign(new Error('duplicate key'), { code: '23505' });

    const result = await awardLoyaltyPoints(input);

    // The DB backstop blocked the second insert → reported as duplicate, and
    // because the insert is inside the transaction the balance never moved.
    expect(result).toEqual({ awarded: false, skipped: 'duplicate' });
    expect(updates).toHaveLength(0);
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
    returningQueue.push([{ points: 48 }]);

    const result = await awardLoyaltyPoints({ ...input, amount: 48.9 });

    expect(result.points).toBe(48);
    expect(inserts[0].vals.amount).toBe(48);
  });

  it('applies a tier upgrade in the SAME profile update when lifetime crosses a threshold', async () => {
    selectQueue.push([]);
    selectQueue.push([{ userId: 'user-1', points: 900, lifetimePoints: 900 }]);
    returningQueue.push([{ points: 1100 }]);
    tierUpgrade.value = { upgraded: true, previousTier: 'member', newTier: 'silver' };

    const result = await awardLoyaltyPoints({ ...input, amount: 200 });

    expect(result.tierUpgraded).toBe(true);
    expect(result.newTier).toBe('silver');
    // ONE update now — tier is folded into the same balance UPDATE, not a
    // second separate write.
    expect(updates).toHaveLength(1);
    expect(updates[0].vals.tier).toBe('silver');
  });

  it('never throws — a DB failure reports skipped: error', async () => {
    // empty queue → the mocked select rejects
    const result = await awardLoyaltyPoints(input);
    expect(result).toEqual({ awarded: false, skipped: 'error' });
  });
});

describe('reverseLoyaltyPoints — canonical refund from loyaltyProfiles', () => {
  const input = { userId: 'user-1', source: 'nayax_kiosk', sourceId: 'tx-9' };

  it('reverses a prior earn and writes a type=reversed audit row in one transaction', async () => {
    selectQueue.push([{ amount: 55 }]); // the original earn exists
    selectQueue.push([]);               // no prior reversal
    selectQueue.push([{ userId: 'user-1', points: 155 }]); // profile
    returningQueue.push([{ points: 100 }]); // UPDATE …RETURNING new balance

    const result = await reverseLoyaltyPoints(input);

    expect(result).toEqual({ reversed: true, points: 55 });
    expect(updates).toHaveLength(1);
    // ledger row is the reversal, negative amount, typed 'reversed'
    expect(inserts).toHaveLength(1);
    expect(inserts[0].vals).toMatchObject({ type: 'reversed', amount: -55, source: 'nayax_kiosk', sourceId: 'tx-9' });
  });

  it('is idempotent — a second reversal reports already_reversed, no writes', async () => {
    selectQueue.push([{ amount: 55 }]); // original earn exists
    selectQueue.push([{ id: 3 }]);      // a reversal already exists

    const result = await reverseLoyaltyPoints(input);

    expect(result).toEqual({ reversed: false, skipped: 'already_reversed' });
    expect(updates).toHaveLength(0);
    expect(inserts).toHaveLength(0);
  });

  it('treats a losing unique-index race (23505) as already_reversed', async () => {
    selectQueue.push([{ amount: 55 }]);
    selectQueue.push([]);
    selectQueue.push([{ userId: 'user-1', points: 155 }]);
    hooks.insertError = Object.assign(new Error('duplicate key'), { code: '23505' });

    const result = await reverseLoyaltyPoints(input);

    expect(result).toEqual({ reversed: false, skipped: 'already_reversed' });
    expect(updates).toHaveLength(0); // balance never moved — insert-first guard
  });

  it('reports not_found when there was no original earn to reverse', async () => {
    selectQueue.push([]); // no earn

    const result = await reverseLoyaltyPoints(input);
    expect(result).toEqual({ reversed: false, skipped: 'not_found' });
  });
});
