/**
 * declineSitterBookingCore — extracted decline branch invariants.
 *
 * Pins the safety rules a future refactor cannot silently break:
 *   • Only the assigned provider can decline (FORBIDDEN otherwise).
 *   • A booking not in pending_provider is refused (BOOKING_WRONG_STATE).
 *   • A missing booking id → BOOKING_NOT_FOUND (never a false success).
 *   • Successful decline flips sitter_bookings.status to 'declined',
 *     persists the reason, sets cancelledAt.
 *   • Slot lock released, chat synced, octopus ledger entry, receipt
 *     void all run non-fatally (a failure in any of them does NOT
 *     leave the caller with { ok:false }).
 *   • provider_response_changed audit event fires with metadata.response='decline'.
 *
 * DB / side-effect surfaces are stubbed the same way the other
 * server/tests/ files do — a thin drizzle-shaped in-memory shim.
 * No real DB, no real network.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks (hoisted) ────────────────────────────────────────────────────────

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

const logAuditEventMock = vi.fn(async () => {});
vi.mock('../middleware/auditLog', () => ({
  logAuditEvent: (...a: any[]) => logAuditEventMock(...a),
}));

// drizzle-orm helpers — reused across every mock in this repo.
vi.mock('drizzle-orm', () => ({
  eq: (col: any, val: any) => ({ _t: 'eq', col, val }),
  and: (...parts: any[]) => ({ _t: 'and', parts }),
}));

// Column markers + in-memory state.
interface SitterBookingRow {
  bookingId: string;
  sitterId: number;
  status: string;
  cancellationReason?: string | null;
  cancelledAt?: Date | null;
  updatedAt?: Date | null;
}
interface SitterProfileRow { id: number; userId: string; }
interface OctopusBookingRow { id: number; idempotencyKey: string; status: string; }

const state = {
  sitterBookings: [] as SitterBookingRow[],
  sitterProfiles: [] as SitterProfileRow[],
  octopusBookings: [] as OctopusBookingRow[],
  octopusLedger: [] as any[],
};

vi.mock('@shared/schema', () => ({
  sitterBookings: {
    bookingId: { _col: 'bookingId' },
    id: { _col: 'id' },
    _table: 'sitterBookings',
  },
  sitterProfiles: {
    id: { _col: 'id' },
    _table: 'sitterProfiles',
  },
  octopusBookings: {
    id: { _col: 'id' },
    idempotencyKey: { _col: 'idempotencyKey' },
    _table: 'octopusBookings',
  },
  octopusLedger: { _table: 'octopusLedger' },
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
    if (t?._table === 'sitterBookings') return state.sitterBookings;
    if (t?._table === 'sitterProfiles') return state.sitterProfiles;
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
      values: (vals: any) => {
        table(t).push(vals);
        return Promise.resolve();
      },
    }),
  };
  return { db };
});

// Import AFTER mocks.
import { declineSitterBookingCore } from '../services/booking-response/declineSitterBookingCore';

function seed(booking: Partial<SitterBookingRow>, profile: Partial<SitterProfileRow>) {
  const row: SitterBookingRow = {
    bookingId: booking.bookingId ?? 'SIT-001',
    sitterId: booking.sitterId ?? 1,
    status: booking.status ?? 'pending_provider',
  };
  state.sitterBookings.push(row);
  const prof: SitterProfileRow = { id: profile.id ?? 1, userId: profile.userId ?? 'sitter-uid' };
  state.sitterProfiles.push(prof);
  return { row, prof };
}

beforeEach(() => {
  state.sitterBookings = [];
  state.sitterProfiles = [];
  state.octopusBookings = [];
  state.octopusLedger = [];
  releaseSlotLockMock.mockClear();
  syncChatMock.mockClear();
  getReceiptsMock.mockReset();
  getReceiptsMock.mockResolvedValue([]);
  voidReceiptMock.mockClear();
  logAuditEventMock.mockClear();
});

describe('declineSitterBookingCore — refusal paths', () => {
  it('booking not found → BOOKING_NOT_FOUND, no side effects', async () => {
    const r = await declineSitterBookingCore({ bookingId: 'missing', providerUid: 'sitter-uid' });
    expect(r).toEqual({ ok: false, errorCode: 'BOOKING_NOT_FOUND', message: 'Booking not found' });
    expect(releaseSlotLockMock).not.toHaveBeenCalled();
    expect(logAuditEventMock).not.toHaveBeenCalled();
  });

  it('wrong status (already confirmed) → BOOKING_WRONG_STATE, row untouched', async () => {
    const { row } = seed({ bookingId: 'SIT-2', status: 'confirmed' }, { userId: 'sitter-uid' });
    const r = await declineSitterBookingCore({ bookingId: 'SIT-2', providerUid: 'sitter-uid' });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errorCode).toBe('BOOKING_WRONG_STATE');
      expect(r.currentStatus).toBe('confirmed');
    }
    // Row is UNCHANGED — a wrong-state decline must never overwrite.
    expect(row.status).toBe('confirmed');
    expect(row.cancelledAt).toBeUndefined();
  });

  it('wrong provider → FORBIDDEN, row untouched', async () => {
    const { row } = seed({ bookingId: 'SIT-3' }, { userId: 'sitter-uid' });
    const r = await declineSitterBookingCore({ bookingId: 'SIT-3', providerUid: 'someone-else' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errorCode).toBe('FORBIDDEN');
    expect(row.status).toBe('pending_provider'); // never flipped
    expect(logAuditEventMock).not.toHaveBeenCalled();
  });
});

describe('declineSitterBookingCore — happy path side effects', () => {
  it('flips status → declined, persists reason, releases slot, syncs chat, audit fires', async () => {
    const { row } = seed({ bookingId: 'SIT-4' }, { userId: 'sitter-uid' });
    const r = await declineSitterBookingCore({
      bookingId: 'SIT-4', providerUid: 'sitter-uid',
      declineReason: 'schedule conflict',
      traceId: 'trace-42',
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.status).toBe('declined');
      expect(r.message).toContain('נדחתה');
    }
    expect(row.status).toBe('declined');
    expect(row.cancellationReason).toBe('schedule conflict');
    expect(row.cancelledAt).toBeInstanceOf(Date);
    expect(releaseSlotLockMock).toHaveBeenCalledTimes(1);
    expect(syncChatMock).toHaveBeenCalledWith('SIT-4', 'cancelled', 'sitter_suite');
    expect(logAuditEventMock).toHaveBeenCalledTimes(1);
    const auditArg = logAuditEventMock.mock.calls[0][0];
    expect(auditArg.actionType).toBe('provider_response_changed');
    expect(auditArg.metadata.response).toBe('decline');
    expect(auditArg.metadata.reason).toBe('schedule conflict');
    expect(auditArg.traceId).toBe('trace-42');
  });

  it('empty reason falls back to the default sentence', async () => {
    const { row } = seed({ bookingId: 'SIT-5' }, { userId: 'sitter-uid' });
    const r = await declineSitterBookingCore({ bookingId: 'SIT-5', providerUid: 'sitter-uid' });
    expect(r.ok).toBe(true);
    expect(row.cancellationReason).toBe('Provider declined the booking request');
  });

  it('octopus record present → ledger CANCELLATION entry written with amount=0', async () => {
    seed({ bookingId: 'SIT-6' }, { userId: 'sitter-uid' });
    state.octopusBookings.push({ id: 99, idempotencyKey: 'SIT-6', status: 'DRAFT' });
    await declineSitterBookingCore({ bookingId: 'SIT-6', providerUid: 'sitter-uid', declineReason: 'oops' });
    const octo = state.octopusBookings.find((b) => b.id === 99);
    expect(octo?.status).toBe('CANCELLED');
    const ledgerEntry = state.octopusLedger.find((l: any) => l.bookingId === 99 && l.type === 'CANCELLATION');
    expect(ledgerEntry).toBeDefined();
    expect(ledgerEntry.amount).toBe(0);
    expect(ledgerEntry.platform).toBe('PETSITTER');
    expect(ledgerEntry.metadata.reason).toBe('oops');
  });

  it('stale receipts get voided (defensive — decline should have none)', async () => {
    seed({ bookingId: 'SIT-7' }, { userId: 'sitter-uid' });
    getReceiptsMock.mockResolvedValueOnce([{ id: 'R1', isVoided: false }, { id: 'R2', isVoided: true }]);
    await declineSitterBookingCore({ bookingId: 'SIT-7', providerUid: 'sitter-uid' });
    // Only R1 gets voided — R2 was already voided.
    expect(voidReceiptMock).toHaveBeenCalledTimes(1);
    expect(voidReceiptMock).toHaveBeenCalledWith(expect.objectContaining({ receiptId: 'R1' }));
  });
});

describe('declineSitterBookingCore — non-fatal downstream failures', () => {
  it('releaseSlotLock throws → still returns ok:true (status flip is the primary success)', async () => {
    seed({ bookingId: 'SIT-8' }, { userId: 'sitter-uid' });
    releaseSlotLockMock.mockRejectedValueOnce(new Error('lock service down'));
    const r = await declineSitterBookingCore({ bookingId: 'SIT-8', providerUid: 'sitter-uid' });
    expect(r.ok).toBe(true);
  });

  it('chat sync throws → still returns ok:true', async () => {
    seed({ bookingId: 'SIT-9' }, { userId: 'sitter-uid' });
    syncChatMock.mockRejectedValueOnce(new Error('chat down'));
    const r = await declineSitterBookingCore({ bookingId: 'SIT-9', providerUid: 'sitter-uid' });
    expect(r.ok).toBe(true);
  });

  it('receipt void throws → still returns ok:true (getReceipts itself throws)', async () => {
    seed({ bookingId: 'SIT-10' }, { userId: 'sitter-uid' });
    getReceiptsMock.mockRejectedValueOnce(new Error('receipt service down'));
    const r = await declineSitterBookingCore({ bookingId: 'SIT-10', providerUid: 'sitter-uid' });
    expect(r.ok).toBe(true);
  });
});
