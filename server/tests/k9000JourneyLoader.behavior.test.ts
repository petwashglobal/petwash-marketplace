/**
 * K9000JourneyLoader behavior — CEO DEEP-LOGIC §84 loader.
 *
 * K9000 wash event → JourneyState projection with party discipline
 * (only the wash's customer sees it). Verifies the compact
 * (completed | failed | reversed) DB status maps onto the resolver's
 * full station-payment enum, and that a walk-up Nayax wash (no
 * userId) is refused to every actor.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = vi.hoisted(() => ({
  rows: [] as Array<{
    id: string;
    userId: string | null;
    status: string;
    stationId: string | null;
    amountCents: number | null;
  }>,
}));

vi.mock('@shared/schema', () => ({
  k9000WashEvents: { id: { name: 'id' } },
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, eq: (_c: any, val: any) => ({ val }) };
});

vi.mock('../db', () => ({
  db: {
    select: () => ({
      from: (_t: any) => ({
        where: (predicate: any) => ({
          limit: async (_n: number) => state.rows.filter((r) => r.id === predicate.val),
        }),
      }),
    }),
  },
}));

const { k9000JourneyLoader } = await import('../services/marketplace/loaders/K9000JourneyLoader');

beforeEach(() => { state.rows.length = 0; });

const baseRow = {
  id: 'K-1',
  userId: 'sarah',
  status: 'completed',
  stationId: 'kfar-saba-north',
  amountCents: 4500,
};

describe('K9000JourneyLoader', () => {
  it('missing → NOT_FOUND', async () => {
    const out = await k9000JourneyLoader({ id: 'K-none', actorUid: 'sarah' });
    expect(out.code).toBe('NOT_FOUND');
  });

  it('third party (not the wash customer) → NOT_A_PARTY', async () => {
    state.rows.push({ ...baseRow });
    const out = await k9000JourneyLoader({ id: 'K-1', actorUid: 'nosy-neighbor' });
    expect(out.code).toBe('NOT_A_PARTY');
  });

  it('walk-up Nayax wash (no userId) is refused to every actor', async () => {
    state.rows.push({ ...baseRow, userId: null });
    const outSarah = await k9000JourneyLoader({ id: 'K-1', actorUid: 'sarah' });
    const outAnon = await k9000JourneyLoader({ id: 'K-1', actorUid: '' });
    expect(outSarah.code).toBe('NOT_A_PARTY');
    expect(outAnon.code).toBe('NOT_A_PARTY');
  });

  it('customer sees CUSTOMER projection', async () => {
    state.rows.push({ ...baseRow });
    const out = await k9000JourneyLoader({ id: 'K-1', actorUid: 'sarah' });
    expect(out.code).toBe('OK');
    if (out.code !== 'OK') throw new Error();
    expect(out.journey.actor.role).toBe('CUSTOMER');
    expect(out.journey.entityRef).toEqual({ kind: 'k9000_session', id: 'K-1' });
  });

  it('DB "completed" maps to resolver vend_success', async () => {
    state.rows.push({ ...baseRow, status: 'completed' });
    const out = await k9000JourneyLoader({ id: 'K-1', actorUid: 'sarah' });
    expect(out.code).toBe('OK');
    if (out.code !== 'OK') throw new Error();
    expect(out.journey.currentStateCode).toBe('vend_success');
  });

  it('DB "failed" maps to resolver failed', async () => {
    state.rows.push({ ...baseRow, status: 'failed' });
    const out = await k9000JourneyLoader({ id: 'K-1', actorUid: 'sarah' });
    expect(out.code).toBe('OK');
    if (out.code !== 'OK') throw new Error();
    expect(out.journey.currentStateCode).toBe('failed');
  });

  it('DB "reversed" maps to resolver refunded', async () => {
    state.rows.push({ ...baseRow, status: 'reversed' });
    const out = await k9000JourneyLoader({ id: 'K-1', actorUid: 'sarah' });
    expect(out.code).toBe('OK');
    if (out.code !== 'OK') throw new Error();
    expect(out.journey.currentStateCode).toBe('refunded');
  });

  it('unknown DB status → fallback initiated (honest surface, no crash)', async () => {
    state.rows.push({ ...baseRow, status: 'some_new_status' });
    const out = await k9000JourneyLoader({ id: 'K-1', actorUid: 'sarah' });
    expect(out.code).toBe('OK');
    if (out.code !== 'OK') throw new Error();
    expect(out.journey.currentStateCode).toBe('initiated');
  });

  it('amountCents null → 0, does not crash', async () => {
    state.rows.push({ ...baseRow, amountCents: null });
    const out = await k9000JourneyLoader({ id: 'K-1', actorUid: 'sarah' });
    expect(out.code).toBe('OK');
    if (out.code !== 'OK') throw new Error();
    expect(out.journey.money?.amountCents).toBe(0);
  });
});
