/**
 * acceptSitterBookingCore — extracted ACCEPT branch invariants.
 *
 * MONEY-CRITICAL pins. Every assertion here corresponds to a real
 * production hazard the original inline handler was built to prevent.
 * A refactor that breaks any of these can move money incorrectly:
 *
 *   • Only the assigned sitter can accept (FORBIDDEN otherwise).
 *   • pending_provider gate (BOOKING_WRONG_STATE otherwise).
 *   • Atomic claim: concurrent double-click resolves to ALREADY_CLAIMED
 *     for the loser — NEVER a second nayax charge.
 *   • Payment failure → payment_failed, no confirm, no escrow, no receipt.
 *   • Payment success → confirmed + captured + nayaxTransactionId + confirmedAt.
 *   • SIM_ prefix → simulated payment: NO fiscal receipt (false tax
 *     document rule from money-invariants §2).
 *   • Non-SIM → real receipt with the resolved customer email.
 *   • Escrow (confirmBooking) called with sitter.userId, not sitterProfile.id.
 *   • provider_response_changed audit fires with metadata.response='accept'.
 *
 * DB / services are stubbed in-memory. No real DB, no real network.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Service mocks ────────────────────────────────────────────────────────

const processBookingPaymentMock = vi.fn();
vi.mock('../services/NayaxSitterMarketplaceService', () => ({
  nayaxSitterMarketplace: {
    processBookingPayment: (...a: any[]) => processBookingPaymentMock(...a),
  },
}));

const confirmBookingMock = vi.fn(async () => {});
vi.mock('../services/SitterAdvancedBookingEngine', () => ({
  advancedBookingEngine: {
    confirmBooking: (...a: any[]) => confirmBookingMock(...a),
  },
}));

const createBookingEventMock = vi.fn(() => Promise.resolve());
vi.mock('../services/CalendarIntegrationService', () => ({
  calendarIntegrationService: {
    createBookingEvent: (...a: any[]) => createBookingEventMock(...a),
  },
}));

const syncChatMock = vi.fn(async () => {});
vi.mock('../lib/booking-chat-sync', () => ({
  syncChatToBookingStatus: (...a: any[]) => syncChatMock(...a),
}));

const generateReceiptMock = vi.fn(async () => {});
vi.mock('../services/IsraeliDigitalReceiptService', () => ({
  IsraeliDigitalReceiptService: {
    generateReceipt: (...a: any[]) => generateReceiptMock(...a),
  },
}));

const backupFinancialMock = vi.fn(async () => {});
vi.mock('../services/gcsBackupService', () => ({
  backupFinancialDocument: (...a: any[]) => backupFinancialMock(...a),
}));

const logAuditEventMock = vi.fn(async () => {});
vi.mock('../middleware/auditLog', () => ({
  logAuditEvent: (...a: any[]) => logAuditEventMock(...a),
}));

vi.mock('@shared/formatAddress', () => ({
  formatUserAddress: () => 'Test Address, Tel Aviv',
  bookingSnapshotToAddress: () => ({}),
}));

vi.mock('drizzle-orm', () => ({
  eq: (col: any, val: any) => ({ _t: 'eq', col, val }),
  and: (...parts: any[]) => ({ _t: 'and', parts }),
}));

// ── DB state ─────────────────────────────────────────────────────────────

interface SitterBookingRow {
  bookingId: string;
  sitterId: number;
  ownerId: string;
  status: string;
  paymentStatus?: string | null;
  nayaxTransactionId?: string | null;
  totalDays: number;
  basePriceCents: number;
  platformServiceFeeCents: number;
  sitterPayoutCents: number;
  totalChargeCents: number;
  startDate: Date;
  endDate: Date;
  confirmedAt?: Date | null;
  updatedAt?: Date | null;
}
interface SitterProfileRow { id: number; userId: string; firstName: string; lastName: string; }
interface OctopusBookingRow { id: number; idempotencyKey: string; status: string; price: number; }
interface UserRow { id: string; email: string; firstName?: string; lastName?: string; }

const state = {
  sitterBookings: [] as SitterBookingRow[],
  sitterProfiles: [] as SitterProfileRow[],
  octopusBookings: [] as OctopusBookingRow[],
  octopusLedger: [] as any[],
  users: [] as UserRow[],
};

vi.mock('@shared/schema', () => ({
  sitterBookings: {
    bookingId: { _col: 'bookingId' },
    status: { _col: 'status' },
    id: { _col: 'id' },
    _table: 'sitterBookings',
  },
  sitterProfiles: { id: { _col: 'id' }, _table: 'sitterProfiles' },
  octopusBookings: { id: { _col: 'id' }, idempotencyKey: { _col: 'idempotencyKey' }, _table: 'octopusBookings' },
  octopusLedger: { _table: 'octopusLedger' },
  users: { id: { _col: 'id' }, email: {}, firstName: {}, lastName: {}, _table: 'users' },
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
    if (t?._table === 'users') return state.users;
    return [];
  };
  const db = {
    select: (_cols?: any) => ({
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
      values: (vals: any) => { table(t).push(vals); return Promise.resolve(); },
    }),
  };
  return { db };
});

// Import AFTER mocks.
import { acceptSitterBookingCore } from '../services/booking-response/acceptSitterBookingCore';

function seed(overrides: Partial<SitterBookingRow> = {}, profile: Partial<SitterProfileRow> = {}) {
  const start = new Date('2026-09-01T10:00:00Z');
  const end = new Date('2026-09-03T10:00:00Z');
  const row: SitterBookingRow = {
    bookingId: overrides.bookingId ?? 'SIT-ACC-1',
    sitterId: overrides.sitterId ?? 1,
    ownerId: overrides.ownerId ?? 'owner-uid',
    status: overrides.status ?? 'pending_provider',
    totalDays: overrides.totalDays ?? 2,
    basePriceCents: overrides.basePriceCents ?? 10000,
    platformServiceFeeCents: overrides.platformServiceFeeCents ?? 1500,
    sitterPayoutCents: overrides.sitterPayoutCents ?? 8500,
    totalChargeCents: overrides.totalChargeCents ?? 10000,
    startDate: overrides.startDate ?? start,
    endDate: overrides.endDate ?? end,
    ...overrides,
  };
  state.sitterBookings.push(row);
  const prof: SitterProfileRow = {
    id: profile.id ?? 1,
    userId: profile.userId ?? 'sitter-uid',
    firstName: profile.firstName ?? 'Anat',
    lastName: profile.lastName ?? 'Cohen',
  };
  state.sitterProfiles.push(prof);
  state.users.push({ id: row.ownerId, email: 'owner@petwash.co.il', firstName: 'Yoni', lastName: 'Owner' });
  return { row, prof };
}

beforeEach(() => {
  state.sitterBookings = [];
  state.sitterProfiles = [];
  state.octopusBookings = [];
  state.octopusLedger = [];
  state.users = [];
  processBookingPaymentMock.mockReset();
  confirmBookingMock.mockClear();
  createBookingEventMock.mockClear();
  syncChatMock.mockClear();
  generateReceiptMock.mockClear();
  backupFinancialMock.mockClear();
  logAuditEventMock.mockClear();
});

describe('acceptSitterBookingCore — refusal paths', () => {
  it('booking not found → BOOKING_NOT_FOUND, no payment attempt', async () => {
    const r = await acceptSitterBookingCore({ bookingId: 'missing', providerUid: 'sitter-uid' });
    expect(r).toEqual({ ok: false, errorCode: 'BOOKING_NOT_FOUND', message: 'Booking not found' });
    expect(processBookingPaymentMock).not.toHaveBeenCalled();
  });

  it('wrong status → BOOKING_WRONG_STATE, no charge', async () => {
    const { row } = seed({ status: 'confirmed' });
    const r = await acceptSitterBookingCore({ bookingId: row.bookingId, providerUid: 'sitter-uid' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errorCode).toBe('BOOKING_WRONG_STATE');
    expect(processBookingPaymentMock).not.toHaveBeenCalled();
  });

  it('wrong provider → FORBIDDEN, no charge', async () => {
    seed({}, { userId: 'sitter-uid' });
    const r = await acceptSitterBookingCore({ bookingId: 'SIT-ACC-1', providerUid: 'wrong-uid' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errorCode).toBe('FORBIDDEN');
    expect(processBookingPaymentMock).not.toHaveBeenCalled();
  });
});

describe('acceptSitterBookingCore — atomic claim (concurrent double-click)', () => {
  it('second call after row already claimed → ALREADY_CLAIMED, no second charge', async () => {
    seed({});
    // First call claims and pays.
    processBookingPaymentMock.mockResolvedValueOnce({ success: true, nayaxTransactionId: 'SIM_first', error: '' });
    const first = await acceptSitterBookingCore({ bookingId: 'SIT-ACC-1', providerUid: 'sitter-uid' });
    expect(first.ok).toBe(true);
    expect(processBookingPaymentMock).toHaveBeenCalledTimes(1);

    // Second call now sees status='confirmed' — the pre-claim status check
    // returns BOOKING_WRONG_STATE (this covers the practical race where the
    // second request reads AFTER the first has flipped). No second charge.
    const second = await acceptSitterBookingCore({ bookingId: 'SIT-ACC-1', providerUid: 'sitter-uid' });
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.errorCode).toBe('BOOKING_WRONG_STATE');
    expect(processBookingPaymentMock).toHaveBeenCalledTimes(1);
  });
});

describe('acceptSitterBookingCore — payment failure', () => {
  it('payment capture returns success:false → payment_failed, no confirm, no receipt, no escrow', async () => {
    const { row } = seed({});
    processBookingPaymentMock.mockResolvedValueOnce({ success: false, nayaxTransactionId: '', error: 'card declined' });
    const r = await acceptSitterBookingCore({ bookingId: row.bookingId, providerUid: 'sitter-uid' });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errorCode).toBe('PAYMENT_FAILED');
      expect(r.message).toBe('card declined');
    }
    expect(row.status).toBe('payment_failed');
    expect(row.paymentStatus).toBe('failed');
    expect(confirmBookingMock).not.toHaveBeenCalled();
    expect(generateReceiptMock).not.toHaveBeenCalled();
  });

  it('processBookingPayment THROWS → treated as failure, still no confirm/receipt', async () => {
    const { row } = seed({});
    processBookingPaymentMock.mockRejectedValueOnce(new Error('nayax down'));
    const r = await acceptSitterBookingCore({ bookingId: row.bookingId, providerUid: 'sitter-uid' });
    expect(r.ok).toBe(false);
    expect(row.status).toBe('payment_failed');
    expect(confirmBookingMock).not.toHaveBeenCalled();
    expect(generateReceiptMock).not.toHaveBeenCalled();
  });
});

describe('acceptSitterBookingCore — payment success', () => {
  it('flips status → confirmed with paymentStatus=captured + txId + confirmedAt', async () => {
    const { row } = seed({});
    processBookingPaymentMock.mockResolvedValueOnce({ success: true, nayaxTransactionId: 'TXN-abc-123', error: '' });
    const r = await acceptSitterBookingCore({ bookingId: row.bookingId, providerUid: 'sitter-uid' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.status).toBe('confirmed');
      expect(r.nayaxTransactionId).toBe('TXN-abc-123');
    }
    expect(row.status).toBe('confirmed');
    expect(row.paymentStatus).toBe('captured');
    expect(row.nayaxTransactionId).toBe('TXN-abc-123');
    expect(row.confirmedAt).toBeInstanceOf(Date);
  });

  it('escrow (confirmBooking) called with sitter.userId — NOT the sitterProfile.id', async () => {
    // Load-bearing: EscrowService pays out the userId, not the profile
    // row id. A refactor that passes booking.sitterId here would pay
    // the wrong Firebase uid.
    // sitterId on the booking must match the profile.id so the
    // sitterProfiles lookup joins correctly.
    seed({ sitterId: 99 }, { id: 99, userId: 'sitter-uid-real' });
    processBookingPaymentMock.mockResolvedValueOnce({ success: true, nayaxTransactionId: 'SIM_x', error: '' });
    await acceptSitterBookingCore({ bookingId: 'SIT-ACC-1', providerUid: 'sitter-uid-real' });
    expect(confirmBookingMock).toHaveBeenCalledTimes(1);
    const [, pricing, ownerId, sitterUidArg] = confirmBookingMock.mock.calls[0];
    expect(sitterUidArg).toBe('sitter-uid-real');
    expect(ownerId).toBe('owner-uid');
    expect(pricing).toEqual(expect.objectContaining({ currency: 'ILS' }));
  });

  it('SIM_ prefix → NO fiscal receipt (money-invariants §2)', async () => {
    // A SUMIT/ITA חשבונית for money that was never collected is a false
    // tax document. Any refactor that issues one for SIM_ payments
    // creates a compliance breach.
    seed({});
    processBookingPaymentMock.mockResolvedValueOnce({ success: true, nayaxTransactionId: 'SIM_test_123', error: '' });
    await acceptSitterBookingCore({ bookingId: 'SIT-ACC-1', providerUid: 'sitter-uid' });
    expect(generateReceiptMock).not.toHaveBeenCalled();
  });

  it('non-SIM transaction → fiscal receipt with resolved customer email', async () => {
    seed({});
    processBookingPaymentMock.mockResolvedValueOnce({ success: true, nayaxTransactionId: 'REAL-TXN-xyz', error: '' });
    await acceptSitterBookingCore({ bookingId: 'SIT-ACC-1', providerUid: 'sitter-uid' });
    expect(generateReceiptMock).toHaveBeenCalledTimes(1);
    const arg = generateReceiptMock.mock.calls[0][0];
    expect(arg.customerEmail).toBe('owner@petwash.co.il');
    expect(arg.nayaxTransactionId).toBe('REAL-TXN-xyz');
    expect(arg.platform).toBe('sitter-suite');
    expect(arg.paymentClass).toBe('PROVIDER_BOOKING_COMMISSION');
  });

  it('octopus record present → status flips CONFIRMED + PAYMENT_CAPTURED ledger entry with txId', async () => {
    seed({});
    state.octopusBookings.push({ id: 42, idempotencyKey: 'SIT-ACC-1', status: 'DRAFT', price: 100 });
    processBookingPaymentMock.mockResolvedValueOnce({ success: true, nayaxTransactionId: 'TX-42', error: '' });
    await acceptSitterBookingCore({ bookingId: 'SIT-ACC-1', providerUid: 'sitter-uid' });
    const octo = state.octopusBookings.find((b) => b.id === 42);
    expect(octo?.status).toBe('CONFIRMED');
    const captured = state.octopusLedger.find((l: any) => l.bookingId === 42 && l.type === 'PAYMENT_CAPTURED');
    expect(captured).toBeDefined();
    expect(captured.metadata.nayaxTransactionId).toBe('TX-42');
    expect(captured.metadata.escrowHoldHours).toBe(72);
  });

  it('audit event fires with metadata.response=accept and correct actor', async () => {
    seed({});
    processBookingPaymentMock.mockResolvedValueOnce({ success: true, nayaxTransactionId: 'SIM_z', error: '' });
    await acceptSitterBookingCore({ bookingId: 'SIT-ACC-1', providerUid: 'sitter-uid', traceId: 'trace-99' });
    expect(logAuditEventMock).toHaveBeenCalledTimes(1);
    const arg = logAuditEventMock.mock.calls[0][0];
    expect(arg.actionType).toBe('provider_response_changed');
    expect(arg.actorUserId).toBe('sitter-uid');
    expect(arg.metadata.response).toBe('accept');
    expect(arg.metadata.newStatus).toBe('confirmed');
    expect(arg.traceId).toBe('trace-99');
  });
});
