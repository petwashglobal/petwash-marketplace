/**
 * acceptWalkBookingCore — extracted walk accept invariants.
 *
 * Load-bearing pins (§24 payment-rail-missing honesty):
 *   • Only the assigned walker can accept (FORBIDDEN otherwise).
 *   • Atomic claim: pending_provider → payment_pending in one UPDATE;
 *     loser sees ALREADY_CLAIMED.
 *   • Escrow failure → ESCROW_HOLD_FAILED (never confirms).
 *   • On success: status → 'payment_pending', paymentRail marker MUST equal
 *     'AWAITING_CUSTOMER_CARD' (the card rail landed 2026-09-18: accept
 *     confirms nothing; the verified payment does. Was 'MISSING' — accept
 *     used to confirm a walk with an escrow document and no money at all.
 *     The old note read: preserving the
 *     compliance-gap honesty so the dispatcher can refuse).
 *   • Octopus goes DRAFT → CONFIRMED but writes NO PAYMENT_CAPTURED
 *     ledger entry (no money was captured).
 *
 * DB / services stubbed in-memory. No real DB, no real Firestore,
 * no real notification dispatcher.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const confirmBookingMock = vi.fn(async () => {});
vi.mock('../services/booking-engines/walk/WalkEliteBookingEngine', () => ({
  walkEliteBookingEngine: { confirmBooking: (...a: any[]) => confirmBookingMock(...a) },
}));

const syncChatMock = vi.fn(async () => {});
vi.mock('../lib/booking-chat-sync', () => ({
  syncChatToBookingStatus: (...a: any[]) => syncChatMock(...a),
}));

const calendarMock = vi.fn(() => Promise.resolve());
vi.mock('../services/CalendarIntegrationService', () => ({
  calendarIntegrationService: { createBookingEvent: (...a: any[]) => calendarMock(...a) },
}));

const backupFinancialMock = vi.fn(async () => {});
vi.mock('../services/gcsBackupService', () => ({
  backupFinancialDocument: (...a: any[]) => backupFinancialMock(...a),
}));

const dispatchNotificationMock = vi.fn(async () => {});
vi.mock('../lib/notificationDispatcher', () => ({
  dispatchNotification: (...a: any[]) => dispatchNotificationMock(...a),
}));

vi.mock('drizzle-orm', () => ({
  eq: (col: any, val: any) => ({ _t: 'eq', col, val }),
  and: (...parts: any[]) => ({ _t: 'and', parts }),
}));

interface WalkBookingRow {
  bookingId: string; walkerId: number; ownerId: string;
  status: string; updatedAt?: Date | null;
  walkerRate: string; platformFeeOwner: string; platformFeeSitter: string;
  walkerPayout: string; totalCost: string; currency: string;
  scheduledDate: Date; durationMinutes: number;
}
interface WalkerProfileRow { walkerId: number; userId: string; businessName?: string; }
interface OctopusBookingRow { id: number; idempotencyKey: string; status: string; }

const state = {
  walkBookings: [] as WalkBookingRow[],
  walkerProfiles: [] as WalkerProfileRow[],
  octopusBookings: [] as OctopusBookingRow[],
  octopusLedger: [] as any[],
};

vi.mock('@shared/schema', () => ({
  walkBookings: {
    bookingId: { _col: 'bookingId' },
    status: { _col: 'status' },
    id: { _col: 'id' },
    _table: 'walkBookings',
  },
  walkerProfiles: { walkerId: { _col: 'walkerId' }, _table: 'walkerProfiles' },
  octopusBookings: { id: { _col: 'id' }, idempotencyKey: { _col: 'idempotencyKey' }, _table: 'octopusBookings' },
}));

function matches(where: any): (r: any) => boolean {
  if (!where) return () => true;
  if (where._t === 'and') {
    const preds = where.parts.map(matches);
    return (r) => preds.every((fn: any) => fn(r));
  }
  if (where._t === 'eq') {
    const key = where.col?._col;
    return (r) => r[key] === where.val;
  }
  return () => true;
}

vi.mock('../db', () => {
  const table = (t: any) => {
    if (t?._table === 'walkBookings') return state.walkBookings;
    if (t?._table === 'walkerProfiles') return state.walkerProfiles;
    if (t?._table === 'octopusBookings') return state.octopusBookings;
    return [];
  };
  const db = {
    select: () => ({
      from: (t: any) => ({
        where: (w: any) => {
          const arr = table(t).filter(matches(w));
          const p: any = Promise.resolve(arr);
          p.limit = (_n: number) => Promise.resolve(arr);
          return p;
        },
      }),
    }),
    update: (t: any) => ({
      set: (vals: any) => ({
        where: (w: any) => {
          const arr = table(t);
          const matched = arr.filter(matches(w));
          matched.forEach((r) => Object.assign(r, vals));
          const result: any = Promise.resolve();
          result.returning = (_cols?: any) => Promise.resolve(matched.map((r) => ({ id: (r as any).id ?? 'x' })));
          return result;
        },
      }),
    }),
    insert: (t: any) => ({
      values: (vals: any) => {
        if (t?._table === 'octopusBookings') { state.octopusBookings.push(vals); }
        else { state.octopusLedger.push(vals); }
        return Promise.resolve();
      },
    }),
  };
  // pool is only used inside the customer-notification branch to
  // fetch email/phone. Stub with a fixed row so the notification
  // dispatcher (also stubbed) sees a valid owner.
  const pool = { query: vi.fn(async () => ({ rows: [{ email: 'owner@petwash.co.il', phone: '+972500000000' }] })) };
  return { db, pool };
});

import { acceptWalkBookingCore } from '../services/booking-response/acceptWalkBookingCore';

function seed(overrides: Partial<WalkBookingRow> = {}, profile: Partial<WalkerProfileRow> = {}) {
  const row: WalkBookingRow = {
    bookingId: overrides.bookingId ?? 'WALK-ACC-1',
    walkerId: overrides.walkerId ?? 1,
    ownerId: overrides.ownerId ?? 'owner-uid',
    status: overrides.status ?? 'pending_provider',
    walkerRate: '50', platformFeeOwner: '5', platformFeeSitter: '5',
    walkerPayout: '40', totalCost: '60', currency: 'ILS',
    scheduledDate: new Date('2026-09-01T10:00:00Z'),
    durationMinutes: 60,
    ...overrides,
  };
  state.walkBookings.push(row);
  state.walkerProfiles.push({
    walkerId: profile.walkerId ?? 1,
    userId: profile.userId ?? 'walker-uid',
    businessName: profile.businessName,
  });
  return row;
}

beforeEach(() => {
  state.walkBookings = [];
  state.walkerProfiles = [];
  state.octopusBookings = [];
  state.octopusLedger = [];
  confirmBookingMock.mockReset();
  confirmBookingMock.mockResolvedValue(undefined);
  syncChatMock.mockClear();
  calendarMock.mockClear();
  backupFinancialMock.mockClear();
  dispatchNotificationMock.mockClear();
});

describe('acceptWalkBookingCore — refusal paths', () => {
  it('booking not found → BOOKING_NOT_FOUND, no escrow attempt', async () => {
    const r = await acceptWalkBookingCore({ bookingId: 'missing', providerUid: 'walker-uid' });
    expect(r).toEqual({ ok: false, errorCode: 'BOOKING_NOT_FOUND', message: 'Booking not found' });
    expect(confirmBookingMock).not.toHaveBeenCalled();
  });

  it('wrong status → BOOKING_WRONG_STATE, no escrow, no confirm', async () => {
    const row = seed({ status: 'confirmed' });
    const r = await acceptWalkBookingCore({ bookingId: row.bookingId, providerUid: 'walker-uid' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errorCode).toBe('BOOKING_WRONG_STATE');
    expect(confirmBookingMock).not.toHaveBeenCalled();
  });

  it('wrong provider → FORBIDDEN, row untouched', async () => {
    const row = seed({}, { userId: 'walker-uid' });
    const r = await acceptWalkBookingCore({ bookingId: row.bookingId, providerUid: 'someone-else' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errorCode).toBe('FORBIDDEN');
    expect(row.status).toBe('pending_provider');
    expect(confirmBookingMock).not.toHaveBeenCalled();
  });
});

describe('acceptWalkBookingCore — accept places no hold at all', () => {
  it('never calls the escrow engine: the hold belongs to the verified payment', async () => {
    const row = seed({});
    const r = await acceptWalkBookingCore({ bookingId: row.bookingId, providerUid: 'walker-uid' });
    expect(r.ok).toBe(true);
    // The escrow hold (and any failure of it) now lives in the /sumit-return
    // handler, which runs only after SUMIT confirms the charge.
    expect(confirmBookingMock).not.toHaveBeenCalled();
    expect(row.status).toBe('payment_pending');
  });
});

describe('acceptWalkBookingCore — happy path (accept ends at payment_pending)', () => {
  it('claims the booking, asks for payment, and confirms NOTHING', async () => {
    // THE load-bearing pin. A walk may only read 'confirmed' after a payment
    // was verified server-side; accept must never do it.
    const row = seed({});
    const r = await acceptWalkBookingCore({ bookingId: row.bookingId, providerUid: 'walker-uid' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.status).toBe('payment_pending');
      expect(r.paymentRail).toBe('AWAITING_CUSTOMER_CARD');
      expect(r.amountDueCents).toBeGreaterThan(0);
      expect(r.bookingId).toBe(row.bookingId);
    }
    expect(row.status).toBe('payment_pending');
    expect(confirmBookingMock).not.toHaveBeenCalled();
    expect(syncChatMock).toHaveBeenCalledWith(row.bookingId, 'payment_pending', 'walk_my_pet');
  });

  it('tells the customer what to pay, with the payment link', async () => {
    const row = seed({});
    await acceptWalkBookingCore({ bookingId: row.bookingId, providerUid: 'walker-uid' });
    expect(dispatchNotificationMock).toHaveBeenCalledTimes(1);
    const sent = dispatchNotificationMock.mock.calls[0][0];
    expect(sent.ctaUrl).toContain(`/walk-my-pet/bookings/${row.bookingId}/pay`);
    expect(`${sent.bodyText}`).toMatch(/₪/);
  });

  it('octopus stays DRAFT and no PAYMENT_CAPTURED is written', async () => {
    // Money-invariants: neither a CONFIRMED booking nor a capture entry may
    // exist before the money does.
    seed({});
    state.octopusBookings.push({ id: 77, idempotencyKey: 'WALK-ACC-1', status: 'DRAFT' });
    await acceptWalkBookingCore({ bookingId: 'WALK-ACC-1', providerUid: 'walker-uid' });
    const octo = state.octopusBookings.find((b) => b.id === 77);
    expect(octo?.status).toBe('DRAFT');
    const paymentCaptured = state.octopusLedger.find((l: any) => l.type === 'PAYMENT_CAPTURED');
    expect(paymentCaptured).toBeUndefined();
  });
});
