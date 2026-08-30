/**
 * PrestigeJourneyLoader behavior — CEO DEEP-LOGIC §84 loader.
 *
 * Verifies the bridge from JourneyStateService dispatch → durable
 * `privilege_members` row → resolvePrestigeJourney.
 *
 * The db module is fully mocked; the resolver itself is exercised
 * live so the wiring is real end-to-end apart from the SQL.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = vi.hoisted(() => ({
  // In-memory table backing the mock; each test resets it.
  rows: [] as Array<{ memberId: string; firebaseUid: string | null; status: string | null; tier: string | null }>,
  // Track which column the last where() targeted so the mock can filter appropriately.
  lastWhereColumn: 'firebaseUid' as 'firebaseUid' | 'memberId',
}));

vi.mock('@shared/schema', () => ({
  privilegeMembers: {
    firebaseUid: { name: 'firebaseUid' },
    memberId: { name: 'memberId' },
  },
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return {
    ...actual,
    eq: (col: any, val: any) => {
      state.lastWhereColumn = col?.name === 'memberId' ? 'memberId' : 'firebaseUid';
      return { col, val };
    },
  };
});

vi.mock('../db', () => ({
  db: {
    select: () => ({
      from: (_table: any) => ({
        where: (predicate: any) => ({
          limit: async (_n: number) => {
            const col = state.lastWhereColumn;
            return state.rows.filter((r: any) => r[col] === predicate.val);
          },
        }),
      }),
    }),
  },
}));

// Note: the loader lives at server/services/marketplace/loaders/
// but the db mock path above uses '../../db' — resolved from the
// loader file, that's the correct server/db module.
const { prestigeJourneyLoader } = await import('../services/marketplace/loaders/PrestigeJourneyLoader');

beforeEach(() => {
  state.rows.length = 0;
});

describe('PrestigeJourneyLoader', () => {
  it('self-lookup with no row → OK with NONE (the actor gets an honest empty projection)', async () => {
    const out = await prestigeJourneyLoader({ id: 'me', actorUid: 'sarah' });
    expect(out.code).toBe('OK');
    if (out.code !== 'OK') throw new Error();
    expect(out.journey.currentStateCode).toBe('NONE');
    expect(out.journey.primaryAction?.actionType).toBe('PRESTIGE_JOIN');
  });

  it('self-lookup with ACTIVE row → OK with ACTIVE projection', async () => {
    state.rows.push({ memberId: 'PWP-42', firebaseUid: 'sarah', status: 'active', tier: 'gold' });
    const out = await prestigeJourneyLoader({ id: 'me', actorUid: 'sarah' });
    expect(out.code).toBe('OK');
    if (out.code !== 'OK') throw new Error();
    expect(out.journey.currentStateCode).toBe('ACTIVE');
    expect(out.journey.primaryAction?.actionType).toBe('VIEW_PRESTIGE_BENEFITS');
    expect(out.journey.entityRef).toEqual({ kind: 'prestige_member', id: 'PWP-42' });
  });

  it('memberId lookup for a row belonging to a different actor → NOT_A_PARTY', async () => {
    state.rows.push({ memberId: 'PWP-42', firebaseUid: 'someone-else', status: 'active', tier: 'gold' });
    const out = await prestigeJourneyLoader({ id: 'PWP-42', actorUid: 'sarah' });
    expect(out.code).toBe('NOT_A_PARTY');
  });

  it('memberId lookup for a matching row → OK', async () => {
    state.rows.push({ memberId: 'PWP-42', firebaseUid: 'sarah', status: 'active', tier: 'gold' });
    const out = await prestigeJourneyLoader({ id: 'PWP-42', actorUid: 'sarah' });
    expect(out.code).toBe('OK');
  });

  it('memberId lookup for a non-existent member → NOT_FOUND', async () => {
    const out = await prestigeJourneyLoader({ id: 'PWP-does-not-exist', actorUid: 'sarah' });
    expect(out.code).toBe('NOT_FOUND');
  });

  it('actorUid passed as id is treated as self (equivalent to "me")', async () => {
    state.rows.push({ memberId: 'PWP-42', firebaseUid: 'sarah', status: 'active', tier: 'gold' });
    const out = await prestigeJourneyLoader({ id: 'sarah', actorUid: 'sarah' });
    expect(out.code).toBe('OK');
    if (out.code !== 'OK') throw new Error();
    expect(out.journey.currentStateCode).toBe('ACTIVE');
  });

  it('DB status=pending → PENDING_VERIFICATION resolver state', async () => {
    state.rows.push({ memberId: 'PWP-42', firebaseUid: 'sarah', status: 'pending', tier: null });
    const out = await prestigeJourneyLoader({ id: 'me', actorUid: 'sarah' });
    expect(out.code).toBe('OK');
    if (out.code !== 'OK') throw new Error();
    expect(out.journey.currentStateCode).toBe('PENDING_VERIFICATION');
  });

  it('DB status=cancelled → CANCELLED resolver state (also accepts US spelling)', async () => {
    state.rows.push({ memberId: 'PWP-42', firebaseUid: 'sarah', status: 'canceled', tier: null });
    const out = await prestigeJourneyLoader({ id: 'me', actorUid: 'sarah' });
    expect(out.code).toBe('OK');
    if (out.code !== 'OK') throw new Error();
    expect(out.journey.currentStateCode).toBe('CANCELLED');
  });
});
