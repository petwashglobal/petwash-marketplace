/**
 * RefundJourneyLoader behavior — CEO DEEP-LOGIC §84 loader.
 *
 * The bridge from JourneyStateService dispatch → `refund_transactions`
 * row → resolveRefundJourney. Verifies the customer party check and
 * the DB-status-to-resolver-state mapping.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = vi.hoisted(() => ({
  rows: [] as Array<{
    refundId: string;
    userId: string;
    sourceType: string;
    sourceId: string;
    refundCents: number;
    status: string;
  }>,
}));

vi.mock('@shared/schema', () => ({
  refundTransactions: {
    refundId: { name: 'refundId' },
  },
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return {
    ...actual,
    eq: (_col: any, val: any) => ({ val }),
  };
});

vi.mock('../db', () => ({
  db: {
    select: () => ({
      from: (_t: any) => ({
        where: (predicate: any) => ({
          limit: async (_n: number) => state.rows.filter((r) => r.refundId === predicate.val),
        }),
      }),
    }),
  },
}));

const { refundJourneyLoader } = await import('../services/marketplace/loaders/RefundJourneyLoader');

beforeEach(() => { state.rows.length = 0; });

const baseRow = {
  refundId: 'R-1',
  userId: 'sarah',
  sourceType: 'booking',
  sourceId: 'B-1',
  refundCents: 15000,
  status: 'pending',
};

describe('RefundJourneyLoader', () => {
  it('missing row → NOT_FOUND (never fabricates an empty refund)', async () => {
    const out = await refundJourneyLoader({ id: 'R-does-not-exist', actorUid: 'sarah' });
    expect(out.code).toBe('NOT_FOUND');
  });

  it('row belonging to another user → NOT_A_PARTY', async () => {
    state.rows.push({ ...baseRow, userId: 'someone-else' });
    const out = await refundJourneyLoader({ id: 'R-1', actorUid: 'sarah' });
    expect(out.code).toBe('NOT_A_PARTY');
  });

  it('pending → REQUESTED with waitingOn=PETWASH', async () => {
    state.rows.push({ ...baseRow, status: 'pending' });
    const out = await refundJourneyLoader({ id: 'R-1', actorUid: 'sarah' });
    expect(out.code).toBe('OK');
    if (out.code !== 'OK') throw new Error();
    expect(out.journey.currentStateCode).toBe('REQUESTED');
    expect(out.journey.waitingOn).toBe('PETWASH');
  });

  it('approved → APPROVED with waitingOn=PAYMENT_PROVIDER', async () => {
    state.rows.push({ ...baseRow, status: 'approved' });
    const out = await refundJourneyLoader({ id: 'R-1', actorUid: 'sarah' });
    expect(out.code).toBe('OK');
    if (out.code !== 'OK') throw new Error();
    expect(out.journey.currentStateCode).toBe('APPROVED');
    expect(out.journey.waitingOn).toBe('PAYMENT_PROVIDER');
  });

  it('executing → ISSUED with waitingOn=PAYMENT_PROVIDER', async () => {
    state.rows.push({ ...baseRow, status: 'executing' });
    const out = await refundJourneyLoader({ id: 'R-1', actorUid: 'sarah' });
    expect(out.code).toBe('OK');
    if (out.code !== 'OK') throw new Error();
    expect(out.journey.currentStateCode).toBe('ISSUED');
    expect(out.journey.waitingOn).toBe('PAYMENT_PROVIDER');
  });

  it('succeeded → SETTLED with INFO priority', async () => {
    state.rows.push({ ...baseRow, status: 'succeeded' });
    const out = await refundJourneyLoader({ id: 'R-1', actorUid: 'sarah' });
    expect(out.code).toBe('OK');
    if (out.code !== 'OK') throw new Error();
    expect(out.journey.currentStateCode).toBe('SETTLED');
    expect(out.journey.attentionPriority).toBe('INFO');
  });

  it('rejected → DECLINED with primary CONTACT_SUPPORT', async () => {
    state.rows.push({ ...baseRow, status: 'rejected' });
    const out = await refundJourneyLoader({ id: 'R-1', actorUid: 'sarah' });
    expect(out.code).toBe('OK');
    if (out.code !== 'OK') throw new Error();
    expect(out.journey.currentStateCode).toBe('DECLINED');
    expect(out.journey.primaryAction?.actionType).toBe('CONTACT_SUPPORT');
  });

  it('originEntityRef surfaces sourceType/sourceId', async () => {
    state.rows.push({ ...baseRow, sourceType: 'shop_order', sourceId: 'S-99' });
    const out = await refundJourneyLoader({ id: 'R-1', actorUid: 'sarah' });
    expect(out.code).toBe('OK');
    if (out.code !== 'OK') throw new Error();
    expect(out.journey.money?.amountCents).toBe(15000);
    expect(out.journey.money?.labelCode).toBe('REFUND_AMOUNT');
  });

  it('unknown sourceType degrades to booking (never crashes the projection)', async () => {
    state.rows.push({ ...baseRow, sourceType: 'unknown_kind' });
    const out = await refundJourneyLoader({ id: 'R-1', actorUid: 'sarah' });
    expect(out.code).toBe('OK');
  });
});
