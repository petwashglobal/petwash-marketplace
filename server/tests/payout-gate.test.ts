import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Fail-CLOSED payout gate chain tests.
 *
 * The db query builder is mocked. Each gate queries a different table object;
 * we key the mock's returned rows off the table identity passed to .from().
 */

// Distinct sentinel table objects + shared mutable state, hoisted so the vi.mock
// factories (which are themselves hoisted) can safely reference them.
const H = vi.hoisted(() => {
  const BOOKINGS = { __t: 'bookings' };
  const BOOKING_REQUESTS = { __t: 'booking_requests' };
  const PROVIDERS = { __t: 'providers' };
  const BOOKING_DISPUTES = { __t: 'booking_disputes' };
  return {
    BOOKINGS, BOOKING_REQUESTS, PROVIDERS, BOOKING_DISPUTES,
    tableRows: new Map<any, any[]>(),
    svc: { result: { ok: true, status: 'approved_for_payout' } as { ok: boolean; status: string | null; reason?: string } },
    reconfirm: { overdue: false },
  };
});
const { BOOKINGS, BOOKING_REQUESTS, PROVIDERS, BOOKING_DISPUTES } = H;

vi.mock('@shared/schema', () => ({
  bookings: H.BOOKINGS,
  bookingRequests: H.BOOKING_REQUESTS,
  providers: H.PROVIDERS,
  bookingDisputes: H.BOOKING_DISPUTES,
}));

// drizzle helpers are no-ops in the mock (we route by table, not by predicate).
vi.mock('drizzle-orm', () => ({ and: (...a: any[]) => a, eq: (...a: any[]) => a }));

vi.mock('../db', () => ({
  db: {
    select: () => ({
      from: (table: any) => ({
        where: () => ({
          limit: async () => H.tableRows.get(table) ?? [],
        }),
      }),
    }),
  },
  pool: {},
}));

// Mock the per-service approval gate so we control gate (e) independently.
vi.mock('../services/providerServiceApproval', () => ({
  assertServiceApproved: vi.fn(async () => H.svc.result),
}));

// Mock the reconfirmation engine so we control gate (g) independently.
vi.mock('../services/reconfirmationService', () => ({
  isReconfirmationOverdue: vi.fn(async () => H.reconfirm.overdue),
}));

import { checkPayoutGates } from '../services/payoutGate';

const HOURS = 60 * 60 * 1000;
const longAgo = new Date(Date.now() - 100 * HOURS); // refund window cleared
const recent = new Date(Date.now() - 1 * HOURS);    // refund window still open

function setupHappyPath() {
  H.tableRows.clear();
  // unified bookings: completed, cleared refund window
  H.tableRows.set(BOOKINGS, [{ status: 'completed', serviceType: 'pet_sitting', completedAt: longAgo }]);
  H.tableRows.set(BOOKING_REQUESTS, []);
  H.tableRows.set(BOOKING_DISPUTES, []); // no dispute
  H.tableRows.set(PROVIDERS, [{ verificationStatus: 'verified' }]);
  H.svc.result = { ok: true, status: 'approved_for_payout' };
  H.reconfirm.overdue = false;
  delete process.env.RECONFIRMATION_ENFORCE;
}

describe('checkPayoutGates — fail-CLOSED chain', () => {
  beforeEach(() => setupHappyPath());

  it('PASSES when every gate is satisfied', async () => {
    const r = await checkPayoutGates({ providerUid: 'uid1', bookingId: 'bk1' });
    expect(r).toMatchObject({ ok: true, reason: 'OK' });
  });

  it('HOLDS when no provider UID', async () => {
    const r = await checkPayoutGates({ providerUid: '', bookingId: 'bk1' });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('NO_PROVIDER_UID');
  });

  it('HOLDS when booking not found (cannot prove completion)', async () => {
    H.tableRows.set(BOOKINGS, []);
    H.tableRows.set(BOOKING_REQUESTS, []);
    const r = await checkPayoutGates({ providerUid: 'uid1', bookingId: 'missing' });
    expect(r).toMatchObject({ ok: false, reason: 'BOOKING_NOT_FOUND' });
  });

  it('HOLDS when booking not completed (gate a)', async () => {
    H.tableRows.set(BOOKINGS, [{ status: 'in_progress', serviceType: 'pet_sitting', completedAt: null }]);
    const r = await checkPayoutGates({ providerUid: 'uid1', bookingId: 'bk1' });
    expect(r).toMatchObject({ ok: false, reason: 'NOT_COMPLETED' });
  });

  it('HOLDS when refund window still open (gate b)', async () => {
    H.tableRows.set(BOOKINGS, [{ status: 'completed', serviceType: 'pet_sitting', completedAt: recent }]);
    const r = await checkPayoutGates({ providerUid: 'uid1', bookingId: 'bk1' });
    expect(r).toMatchObject({ ok: false, reason: 'REFUND_WINDOW_OPEN' });
  });

  it('HOLDS when completed but no completion timestamp (cannot verify window)', async () => {
    H.tableRows.set(BOOKINGS, [{ status: 'completed', serviceType: 'pet_sitting', completedAt: null }]);
    const r = await checkPayoutGates({ providerUid: 'uid1', bookingId: 'bk1' });
    expect(r).toMatchObject({ ok: false, reason: 'NO_COMPLETION_TIMESTAMP' });
  });

  it('HOLDS when an OPEN dispute exists (gate d)', async () => {
    H.tableRows.set(BOOKING_DISPUTES, [{ status: 'open' }]);
    const r = await checkPayoutGates({ providerUid: 'uid1', bookingId: 'bk1' });
    expect(r).toMatchObject({ ok: false, reason: 'OPEN_DISPUTE' });
  });

  it('HOLDS when provider tax not verified (gate c)', async () => {
    H.tableRows.set(PROVIDERS, [{ verificationStatus: 'pending' }]);
    const r = await checkPayoutGates({ providerUid: 'uid1', bookingId: 'bk1' });
    expect(r).toMatchObject({ ok: false, reason: 'TAX_NOT_VERIFIED' });
  });

  it('HOLDS when provider record missing (cannot verify tax)', async () => {
    H.tableRows.set(PROVIDERS, []);
    const r = await checkPayoutGates({ providerUid: 'uid1', bookingId: 'bk1' });
    expect(r).toMatchObject({ ok: false, reason: 'PROVIDER_NOT_FOUND' });
  });

  it('PASSES (shadow) when reconfirmation overdue but RECONFIRMATION_ENFORCE off (gate g)', async () => {
    H.reconfirm.overdue = true;
    delete process.env.RECONFIRMATION_ENFORCE;
    const r = await checkPayoutGates({ providerUid: 'uid1', bookingId: 'bk1' });
    expect(r).toMatchObject({ ok: true, reason: 'OK' });
  });

  it('HOLDS when reconfirmation overdue and RECONFIRMATION_ENFORCE on (gate g)', async () => {
    H.reconfirm.overdue = true;
    process.env.RECONFIRMATION_ENFORCE = 'on';
    const r = await checkPayoutGates({ providerUid: 'uid1', bookingId: 'bk1' });
    expect(r).toMatchObject({ ok: false, reason: 'RECONFIRMATION_OVERDUE' });
    delete process.env.RECONFIRMATION_ENFORCE;
  });

  it('HOLDS when service not approved for payout (gate e)', async () => {
    H.svc.result = { ok: false, status: 'approved_for_booking', reason: 'PAYOUT_NOT_ENABLED' };
    const r = await checkPayoutGates({ providerUid: 'uid1', bookingId: 'bk1' });
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('SERVICE_NOT_APPROVED_FOR_PAYOUT');
  });

  it('resolves marketplace booking_requests when not in unified bookings', async () => {
    H.tableRows.set(BOOKINGS, []);
    H.tableRows.set(BOOKING_REQUESTS, [{ status: 'completed', serviceType: 'walking', completedAt: longAgo, ownerConfirmedAt: null }]);
    const r = await checkPayoutGates({ providerUid: 'uid1', bookingId: 'req1' });
    expect(r.ok).toBe(true);
  });
});
