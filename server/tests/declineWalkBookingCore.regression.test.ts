/**
 * declineWalkBookingCore — extracted walk decline invariants (Lane C).
 *
 * Same shape as declineSitterBookingCore.regression.test.ts. The
 * critical semantic difference from sitter: walk decline flips status
 * to 'cancelled', not 'declined'. That's a real distinction in the
 * data model that must survive any refactor.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const releaseSlotLockMock = vi.fn(async () => {});
vi.mock('../lib/marketplaceSlotLock', () => ({
  releaseSlotLock: (...a: any[]) => releaseSlotLockMock(...a),
}));

const syncChatMock = vi.fn(async () => {});
vi.mock('../lib/booking-chat-sync', () => ({
  syncChatToBookingStatus: (...a: any[]) => syncChatMock(...a),
}));

const getReceiptsMock = vi.fn(async () => [] as any[]);
const voidReceiptMock = vi.fn(async () => {});
vi.mock('../services/IsraeliDigitalReceiptService', () => ({
  IsraeliDigitalReceiptService: {
    getReceiptByBookingId: (...a: any[]) => getReceiptsMock(...a),
    voidReceipt: (...a: any[]) => voidReceiptMock(...a),
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: (col: any, val: any) => ({ _t: 'eq', col, val }),
}));

interface WalkBookingRow {
  bookingId: string; walkerId: number; ownerId?: string;
  status: string; updatedAt?: Date | null;
}
interface WalkerProfileRow { walkerId: number; userId: string; }
interface OctopusBookingRow { id: number; idempotencyKey: string; status: string; }

const state = {
  walkBookings: [] as WalkBookingRow[],
  walkerProfiles: [] as WalkerProfileRow[],
  octopusBookings: [] as OctopusBookingRow[],
  octopusLedger: [] as any[],
};

vi.mock('@shared/schema', () => ({
  walkBookings: { bookingId: { _col: 'bookingId' }, _table: 'walkBookings' },
  walkerProfiles: { walkerId: { _col: 'walkerId' }, _table: 'walkerProfiles' },
  octopusBookings: { id: { _col: 'id' }, idempotencyKey: { _col: 'idempotencyKey' }, _table: 'octopusBookings' },
  octopusLedger: { _table: 'octopusLedger' },
}));

function matches(where: any): (r: any) => boolean {
  if (!where) return () => true;
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
    if (t?._table === 'octopusLedger') return state.octopusLedger;
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
          arr.filter(matches(w)).forEach((r) => Object.assign(r, vals));
          return Promise.resolve();
        },
      }),
    }),
    insert: (t: any) => ({
      values: (vals: any) => { table(t).push(vals); return Promise.resolve(); },
    }),
  };
  return { db };
});

import { declineWalkBookingCore } from '../services/booking-response/declineWalkBookingCore';

function seed(row: Partial<WalkBookingRow>, prof: Partial<WalkerProfileRow>) {
  const b: WalkBookingRow = {
    bookingId: row.bookingId ?? 'WALK-1', walkerId: row.walkerId ?? 1,
    status: row.status ?? 'pending_provider',
  };
  state.walkBookings.push(b);
  state.walkerProfiles.push({ walkerId: prof.walkerId ?? 1, userId: prof.userId ?? 'walker-uid' });
  return b;
}

beforeEach(() => {
  state.walkBookings = []; state.walkerProfiles = [];
  state.octopusBookings = []; state.octopusLedger = [];
  releaseSlotLockMock.mockClear();
  syncChatMock.mockClear();
  getReceiptsMock.mockReset(); getReceiptsMock.mockResolvedValue([]);
  voidReceiptMock.mockClear();
});

describe('declineWalkBookingCore — refusal paths', () => {
  it('booking not found → BOOKING_NOT_FOUND', async () => {
    const r = await declineWalkBookingCore({ bookingId: 'missing', providerUid: 'walker-uid' });
    expect(r).toEqual({ ok: false, errorCode: 'BOOKING_NOT_FOUND', message: 'Booking not found' });
    expect(releaseSlotLockMock).not.toHaveBeenCalled();
  });

  it('wrong status → BOOKING_WRONG_STATE, row untouched', async () => {
    const row = seed({ bookingId: 'WALK-2', status: 'confirmed' }, { userId: 'walker-uid' });
    const r = await declineWalkBookingCore({ bookingId: 'WALK-2', providerUid: 'walker-uid' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errorCode).toBe('BOOKING_WRONG_STATE');
    expect(row.status).toBe('confirmed');
  });

  it('wrong walker → FORBIDDEN, row untouched', async () => {
    const row = seed({ bookingId: 'WALK-3' }, { userId: 'walker-uid' });
    const r = await declineWalkBookingCore({ bookingId: 'WALK-3', providerUid: 'someone-else' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errorCode).toBe('FORBIDDEN');
    expect(row.status).toBe('pending_provider');
  });
});

describe('declineWalkBookingCore — happy path', () => {
  it('flips walk_bookings.status → cancelled (NOT declined — walk semantic)', async () => {
    // This is the load-bearing distinction from sitter. A refactor that
    // normalises walk to 'declined' would break every downstream consumer
    // that filters walks by status='cancelled'.
    const row = seed({ bookingId: 'WALK-4' }, { userId: 'walker-uid' });
    const r = await declineWalkBookingCore({ bookingId: 'WALK-4', providerUid: 'walker-uid', declineReason: 'busy' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.status).toBe('cancelled');
    expect(row.status).toBe('cancelled');
    expect(releaseSlotLockMock).toHaveBeenCalledTimes(1);
    expect(syncChatMock).toHaveBeenCalledWith('WALK-4', 'cancelled', 'walk_my_pet');
  });

  it('octopus record present → CANCELLATION entry with amount=0 and walk_my_pet platform', async () => {
    seed({ bookingId: 'WALK-5' }, { userId: 'walker-uid' });
    state.octopusBookings.push({ id: 77, idempotencyKey: 'WALK-5', status: 'DRAFT' });
    await declineWalkBookingCore({ bookingId: 'WALK-5', providerUid: 'walker-uid', declineReason: 'oops' });
    const octo = state.octopusBookings.find((b) => b.id === 77);
    expect(octo?.status).toBe('CANCELLED');
    const ledgerEntry = state.octopusLedger.find((l: any) => l.bookingId === 77 && l.type === 'CANCELLATION');
    expect(ledgerEntry).toBeDefined();
    expect(ledgerEntry.amount).toBe(0);
    expect(ledgerEntry.platform).toBe('walk_my_pet');
    expect(ledgerEntry.metadata.reason).toBe('oops');
  });

  it('stale receipts voided defensively', async () => {
    seed({ bookingId: 'WALK-6' }, { userId: 'walker-uid' });
    getReceiptsMock.mockResolvedValueOnce([{ id: 'RW1', isVoided: false }]);
    await declineWalkBookingCore({ bookingId: 'WALK-6', providerUid: 'walker-uid' });
    expect(voidReceiptMock).toHaveBeenCalledWith(expect.objectContaining({ receiptId: 'RW1' }));
  });
});

describe('declineWalkBookingCore — non-fatal downstream failures', () => {
  it('releaseSlotLock throws → still ok:true', async () => {
    seed({ bookingId: 'WALK-7' }, { userId: 'walker-uid' });
    releaseSlotLockMock.mockRejectedValueOnce(new Error('lock down'));
    const r = await declineWalkBookingCore({ bookingId: 'WALK-7', providerUid: 'walker-uid' });
    expect(r.ok).toBe(true);
  });

  it('receipt lookup throws → still ok:true', async () => {
    seed({ bookingId: 'WALK-8' }, { userId: 'walker-uid' });
    getReceiptsMock.mockRejectedValueOnce(new Error('receipt down'));
    const r = await declineWalkBookingCore({ bookingId: 'WALK-8', providerUid: 'walker-uid' });
    expect(r.ok).toBe(true);
  });
});
