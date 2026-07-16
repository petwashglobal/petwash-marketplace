import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock the data layer. Status-guarded UPDATE ... RETURNING is the heart of
//    the fulfillment service, so the mock exposes a queue of returning() rows:
//    an empty array simulates losing the guard (row not pending / not found).
const updateReturningQueue: any[][] = [];
const selectQueue: any[][] = [];
const updates: { vals: any }[] = [];
const inserts: { vals: any }[] = [];

vi.mock('../db', () => {
  const dbObj: any = {
    select: () => {
      const chain: any = {
        from: () => chain,
        where: () => chain,
        limit: () => Promise.resolve(selectQueue.shift() ?? []),
      };
      return chain;
    },
    update: () => ({
      set: (vals: any) => ({
        where: () => ({
          returning: () => {
            updates.push({ vals });
            return Promise.resolve(updateReturningQueue.shift() ?? []);
          },
        }),
      }),
    }),
    insert: () => ({
      values: (vals: any) => {
        inserts.push({ vals });
        return Promise.resolve([]);
      },
    }),
    transaction: async (fn: any) => fn(dbObj),
  };
  return { db: dbObj };
});

vi.mock('../lib/logger', () => ({ logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } }));

import {
  fulfillRedemption,
  cancelRedemptionWithRefund,
  redemptionEffectiveStatus,
} from '../services/rewardFulfillment';

const FUTURE = new Date(Date.now() + 86_400_000);
const PAST = new Date(Date.now() - 86_400_000);

const pendingRow = {
  id: 9,
  userId: 'user-1',
  rewardId: 3,
  pointsCost: 550,
  status: 'pending',
  voucherCode: 'REWARD-123-ABCDE',
  expiresAt: FUTURE,
};

beforeEach(() => {
  updateReturningQueue.length = 0;
  selectQueue.length = 0;
  updates.length = 0;
  inserts.length = 0;
});

describe('redemptionEffectiveStatus — expiry is computed, never stored', () => {
  it('reports a pending row past its expiry as expired', () => {
    expect(redemptionEffectiveStatus({ status: 'pending', expiresAt: PAST } as any)).toBe('expired');
  });
  it('keeps a pending row before expiry pending', () => {
    expect(redemptionEffectiveStatus({ status: 'pending', expiresAt: FUTURE } as any)).toBe('pending');
  });
  it('never relabels terminal states, even past expiry', () => {
    expect(redemptionEffectiveStatus({ status: 'fulfilled', expiresAt: PAST } as any)).toBe('fulfilled');
    expect(redemptionEffectiveStatus({ status: 'cancelled', expiresAt: PAST } as any)).toBe('cancelled');
  });
});


// Flatten a drizzle SQL fragment's chunks to the strings/params it carries
// (the fragment also embeds the column object, which is circular — skip it).
function sqlText(fragment: any): string {
  const chunks = fragment?.queryChunks ?? [];
  return chunks
    .map((c: any) => {
      if (c instanceof String || typeof c === 'string') return String(c); // boxed param
      if (Array.isArray(c?.value)) return c.value.join('');               // StringChunk
      return '';                                                          // column object etc.
    })
    .join('|');
}

describe('fulfillRedemption — pending → fulfilled, exactly once', () => {
  it('fulfills a pending, unexpired redemption', async () => {
    const fulfilled = { ...pendingRow, status: 'fulfilled' };
    updateReturningQueue.push([fulfilled]);

    const result = await fulfillRedemption(9, 'handed over at station');

    expect(result).toEqual({ ok: true, redemption: fulfilled });
    expect(updates[0].vals.status).toBe('fulfilled');
    expect(updates[0].vals.fulfilledAt).toBeInstanceOf(Date);
    // Notes are APPENDED via SQL (gift lines from redeem time must survive) —
    // assert the fragment carries the admin note as a bound param.
    expect(sqlText(updates[0].vals.notes)).toContain('handed over at station');
  });

  it('reports not_found when the redemption does not exist', async () => {
    updateReturningQueue.push([]); // guard lost
    selectQueue.push([]);          // and no such row
    expect(await fulfillRedemption(999)).toEqual({ ok: false, reason: 'not_found' });
  });

  it('refuses a second fulfill (double-click / concurrent admin)', async () => {
    updateReturningQueue.push([]); // guard lost — row no longer pending
    selectQueue.push([{ ...pendingRow, status: 'fulfilled' }]);
    expect(await fulfillRedemption(9)).toEqual({ ok: false, reason: 'not_pending' });
  });

  it('refuses to fulfill an expired voucher', async () => {
    updateReturningQueue.push([]); // guard lost — expiry clause excluded it
    selectQueue.push([{ ...pendingRow, expiresAt: PAST }]);
    expect(await fulfillRedemption(9)).toEqual({ ok: false, reason: 'expired' });
  });
});

describe('cancelRedemptionWithRefund — pending → cancelled + audited points refund', () => {
  it('cancels and refunds the exact points spent, writing a ledger row', async () => {
    const cancelled = { ...pendingRow, status: 'cancelled' };
    updateReturningQueue.push([cancelled]);      // redemption transition wins
    updateReturningQueue.push([{ points: 650 }]); // profile balance after refund

    const result = await cancelRedemptionWithRefund(9, 'partner unavailable');

    expect(result).toEqual({
      ok: true,
      redemption: cancelled,
      refundedPoints: 550,
      newBalance: 650,
    });
    expect(updates[0].vals.status).toBe('cancelled');
    expect(sqlText(updates[0].vals.notes)).toContain('partner unavailable');
    expect(inserts).toHaveLength(1);
    expect(inserts[0].vals).toMatchObject({
      userId: 'user-1',
      type: 'refund',
      amount: 550,
      balance: 650,
      source: 'reward_redemption_cancelled',
      sourceId: '9',
    });
  });

  it('refunds at most once — a second cancel loses the status guard and refunds nothing', async () => {
    updateReturningQueue.push([]); // guard lost — already cancelled
    selectQueue.push([{ ...pendingRow, status: 'cancelled' }]);

    const result = await cancelRedemptionWithRefund(9, 'again');

    expect(result).toEqual({ ok: false, reason: 'not_pending' });
    expect(updates).toHaveLength(1); // only the failed transition attempt
    expect(inserts).toHaveLength(0); // no second ledger row
  });

  it('reports not_found for a missing redemption', async () => {
    updateReturningQueue.push([]);
    selectQueue.push([]);
    expect(await cancelRedemptionWithRefund(999, 'x')).toEqual({ ok: false, reason: 'not_found' });
  });

  it('still cancels when the member has no loyalty profile, refunding nothing', async () => {
    const cancelled = { ...pendingRow, status: 'cancelled' };
    updateReturningQueue.push([cancelled]);
    updateReturningQueue.push([]); // no profile row to refund into

    const result = await cancelRedemptionWithRefund(9, 'account deleted');

    expect(result).toEqual({ ok: true, redemption: cancelled, refundedPoints: 0, newBalance: null });
    expect(inserts).toHaveLength(0); // no ledger row invented for a missing profile
  });
});
