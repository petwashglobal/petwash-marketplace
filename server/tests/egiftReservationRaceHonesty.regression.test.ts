/**
 * MONEY-CRITICAL — eGift reservation commit()/release() race honesty.
 *
 * commitReservation() and releaseByReservationId() each do:
 *   1. SELECT the reservation row.
 *   2. Check row.status === 'RESERVED' (sequential guard).
 *   3. UPDATE … WHERE status = 'RESERVED' (conditional write).
 *   4. INSERT the mirror egift_events row and return ok:true.
 *
 * The conditional WHERE makes the UPDATE itself safe (a second writer
 * can't flip an already-COMMITTED row back), but the OLD code never
 * looked at how many rows the UPDATE actually touched — it inserted
 * the event and returned ok:true unconditionally.
 *
 * That is a real race, not a theoretical one: commit() and release()
 * can be invoked concurrently on the SAME reservationId (e.g. a
 * checkout flow's "confirm" and a timeout-triggered "cancel" firing
 * together). Both read status='RESERVED' before either write lands.
 * Whichever UPDATE loses the race matches ZERO rows — but the old
 * code still wrote its own event and told the caller it succeeded.
 * For release() specifically that means a caller is told "hold
 * released — not a refund" for an eGift that a concurrent commit()
 * had *already captured* — the exact shape of a caller believing no
 * charge occurred when one did.
 *
 * Fix: both functions now call `.returning()` on the conditional
 * UPDATE and only report success (and only write the mirror event)
 * when a row actually flipped. The loser gets the honest
 * RESERVATION_NOT_ACTIVE, never a false COMMITTED/RELEASED.
 *
 * This test drives the real service functions through a mocked
 * drizzle db so the race can be deterministically forced without a
 * live Postgres: the initial SELECT reports 'RESERVED' (as it would
 * for both racing callers), but the conditional UPDATE is made to
 * return zero rows (as it would for whichever caller lost the race).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

let selectRow: any;
let updateReturns: any[];
const insertedEvents: any[] = [];

vi.mock('../db', () => {
  function selectChain() {
    const chain: any = {
      from() { return chain; },
      where() { return chain; },
      limit() { return Promise.resolve(selectRow ? [selectRow] : []); },
    };
    return chain;
  }
  function updateChain() {
    const chain: any = {
      set() { return chain; },
      where() { return chain; },
      returning() { return Promise.resolve(updateReturns); },
    };
    return chain;
  }
  function insertChain() {
    const chain: any = {
      values(v: any) { insertedEvents.push(v); return chain; },
      onConflictDoNothing() { return Promise.resolve(); },
    };
    return chain;
  }
  return {
    db: {
      select: () => selectChain(),
      update: () => updateChain(),
      insert: () => insertChain(),
    },
    pool: {},
  };
});

// egiftReservationService only touches these two table objects as opaque
// drizzle-orm handles passed into eq()/and() — the mock never inspects
// their shape, so plain markers are enough.
vi.mock('@shared/schema', () => ({
  egiftEvents: { egiftId: 'egiftId', eventType: 'eventType' },
  egiftReservations: {
    id: 'id',
    reservationId: 'reservationId',
    egiftId: 'egiftId',
    status: 'status',
  },
}));

import { commitReservation, releaseByReservationId } from '../services/egift/egiftReservationService';

describe('MONEY-CRITICAL — commit()/release() race honesty (closure sprint)', () => {
  beforeEach(() => {
    insertedEvents.length = 0;
    selectRow = {
      reservationId: 'RES-ABC123',
      egiftId: 'EG-1',
      status: 'RESERVED',
      amountCents: 5000,
      userId: 'user-A',
      walletId: null,
      intendedCommercial: 'K9000_WASH',
      reservedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    };
  });

  it('commit() reports ok:true and writes REDEEMED when the UPDATE actually flips the row', async () => {
    updateReturns = [{ id: 1 }]; // the UPDATE matched — this caller won the race
    const result = await commitReservation({ reservationId: 'RES-ABC123', egiftId: 'EG-1' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.reservation.status).toBe('COMMITTED');
    expect(insertedEvents).toHaveLength(1);
    expect(insertedEvents[0].eventType).toBe('REDEEMED');
  });

  it('commit() LOSING the race (UPDATE matches zero rows) returns RESERVATION_NOT_ACTIVE and writes NO event', async () => {
    // Simulates: a concurrent release() (or another commit()) already
    // flipped this row's status away from RESERVED between this call's
    // SELECT and its UPDATE. The conditional WHERE correctly matches
    // nothing — the bug was treating that as success anyway.
    updateReturns = [];
    const result = await commitReservation({ reservationId: 'RES-ABC123', egiftId: 'EG-1' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorCode).toBe('RESERVATION_NOT_ACTIVE');
    // The old bug: an unconditional REDEEMED insert here would silently
    // double-count redeemed value in the balance projection even though
    // this specific request never actually captured anything.
    expect(insertedEvents).toHaveLength(0);
  });

  it('release() reports ok:true and writes RESERVATION_RELEASED when the UPDATE actually flips the row', async () => {
    updateReturns = [{ id: 1 }];
    const result = await releaseByReservationId('RES-ABC123', 'EG-1');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.reservation.status).toBe('RELEASED');
    expect(insertedEvents).toHaveLength(1);
    expect(insertedEvents[0].eventType).toBe('RESERVATION_RELEASED');
  });

  it('release() LOSING the race to a concurrent commit() must NOT report success — money-critical', async () => {
    // This is the dangerous direction: a caller asking to cancel a hold
    // races a concurrent commit() that captures the money first. Before
    // the fix, this call still returned {ok:true, status:'RELEASED'} —
    // "not a refund" — for an eGift that had just been debited elsewhere.
    // A checkout flow trusting that response could treat the purchase as
    // unpaid (fall back to another payment method, or ship the service
    // as free) while the eGift ledger shows the value already REDEEMED.
    updateReturns = [];
    const result = await releaseByReservationId('RES-ABC123', 'EG-1');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorCode).toBe('RESERVATION_NOT_ACTIVE');
    expect(insertedEvents).toHaveLength(0);
  });

  it('release() is scoped to the authorised egiftId even under this new returning() check', async () => {
    updateReturns = [{ id: 1 }];
    selectRow = null; // cross-eGift id: SELECT filtered on the wrong egiftId finds nothing
    const result = await releaseByReservationId('RES-ABC123', 'SOMEONE-ELSES-EGIFT');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorCode).toBe('RESERVATION_NOT_FOUND');
    expect(insertedEvents).toHaveLength(0);
  });
});
