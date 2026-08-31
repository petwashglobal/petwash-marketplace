/**
 * PayoutJourneyLoader behavior — CEO DEEP-LOGIC §84.
 *
 * Reads provider_payout_entries by numeric id, enforces
 * earning-provider-only visibility, maps free-text status onto
 * the tighter PayoutStatus enum, and safely returns NOT_FOUND
 * for a non-numeric id.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = vi.hoisted(() => ({
  rows: [] as Array<{
    id: number;
    providerUid: string;
    status: string | null;
    netCents: number | null;
  }>,
}));

vi.mock('@shared/schema', () => ({
  providerPayoutEntries: { id: { name: 'id' } },
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

const { payoutJourneyLoader } = await import(
  '../services/marketplace/loaders/PayoutJourneyLoader'
);

beforeEach(() => { state.rows.length = 0; });

const baseRow = {
  id: 42,
  providerUid: 'maya',
  status: 'earned',
  netCents: 15000,
};

describe('PayoutJourneyLoader', () => {
  it('missing → NOT_FOUND', async () => {
    const out = await payoutJourneyLoader({ id: '42', actorUid: 'maya' });
    expect(out.code).toBe('NOT_FOUND');
  });

  it('non-numeric id → NOT_FOUND (never crashes)', async () => {
    const out = await payoutJourneyLoader({ id: 'not-a-number', actorUid: 'maya' });
    expect(out.code).toBe('NOT_FOUND');
  });

  it('zero or negative id → NOT_FOUND', async () => {
    expect((await payoutJourneyLoader({ id: '0', actorUid: 'maya' })).code).toBe('NOT_FOUND');
    expect((await payoutJourneyLoader({ id: '-1', actorUid: 'maya' })).code).toBe('NOT_FOUND');
  });

  it('third party (not the earning provider) → NOT_A_PARTY', async () => {
    state.rows.push({ ...baseRow });
    const out = await payoutJourneyLoader({ id: '42', actorUid: 'stranger' });
    expect(out.code).toBe('NOT_A_PARTY');
  });

  it('earning provider sees PROVIDER projection', async () => {
    state.rows.push({ ...baseRow });
    const out = await payoutJourneyLoader({ id: '42', actorUid: 'maya' });
    expect(out.code).toBe('OK');
    if (out.code !== 'OK') throw new Error();
    expect(out.journey.actor.role).toBe('PROVIDER');
    expect(out.journey.entityRef).toEqual({ kind: 'payout', id: '42' });
    expect(out.journey.money?.amountCents).toBe(15000);
  });

  it('DB status mapping — every family lands on the right enum', async () => {
    const cases: Array<[string, string]> = [
      ['earned', 'PENDING_HOLD'],
      ['held', 'PENDING_HOLD'],
      ['pending', 'PENDING_HOLD'],
      ['ready', 'READY_TO_TRANSFER'],
      ['ready_to_transfer', 'READY_TO_TRANSFER'],
      ['transferring', 'TRANSFERRING'],
      ['in_flight', 'TRANSFERRING'],
      ['paid', 'PAID'],
      ['settled', 'PAID'],
      ['failed', 'FAILED'],
      ['rejected', 'FAILED'],
      ['reconciling', 'RECONCILING'],
    ];
    for (const [dbStatus, expected] of cases) {
      state.rows.length = 0;
      state.rows.push({ ...baseRow, status: dbStatus });
      const out = await payoutJourneyLoader({ id: '42', actorUid: 'maya' });
      expect(out.code, `${dbStatus}`).toBe('OK');
      if (out.code !== 'OK') throw new Error();
      expect(out.journey.currentStateCode, `${dbStatus}`).toBe(expected);
    }
  });

  it('unknown DB status → fallback PENDING_HOLD (safest — no user action expected)', async () => {
    state.rows.push({ ...baseRow, status: 'brand_new_status' });
    const out = await payoutJourneyLoader({ id: '42', actorUid: 'maya' });
    expect(out.code).toBe('OK');
    if (out.code !== 'OK') throw new Error();
    expect(out.journey.currentStateCode).toBe('PENDING_HOLD');
  });

  it('netCents null → 0, does not crash', async () => {
    state.rows.push({ ...baseRow, netCents: null });
    const out = await payoutJourneyLoader({ id: '42', actorUid: 'maya' });
    expect(out.code).toBe('OK');
    if (out.code !== 'OK') throw new Error();
    expect(out.journey.money?.amountCents).toBe(0);
  });
});
