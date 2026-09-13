/**
 * 2026-09-13 — auto-approve cron vs customer /confirm race (money + fiscal).
 *
 * The cron ran every money side effect (earning, escrow release, ledger, the
 * PROVIDER_BOOKING_COMMISSION tax document) BEFORE a status-guarded UPDATE whose
 * result it never checked. A customer confirming in the same seconds meant BOTH
 * paths issued. It now takes the same atomic claim /confirm takes
 * (ownerConfirmedAt IS NULL AND status='provider_marked_complete').
 *
 * Behaviour test on the REAL cron module: drizzle predicates and the db are
 * replaced by a tiny in-memory evaluator, every money/fiscal helper is a spy.
 * Nothing here can reach SUMIT, Nayax, Firestore or Postgres.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

type Row = Record<string, any>;
const H = vi.hoisted(() => ({
  bookings: [] as Row[],
  earnings: [] as Row[],
  disputes: [] as Row[],
  users: [{ id: 'owner1', email: 'o@example.test', firstName: 'O', lastName: 'W' }] as Row[],
}));

// ── drizzle-orm: predicates become row => boolean ─────────────────────────────
vi.mock('drizzle-orm', () => {
  const col = (c: any) => c.__col as string;
  return {
    eq: (c: any, v: any) => (r: Row) => r[col(c)] === v,
    isNull: (c: any) => (r: Row) => r[col(c)] == null,
    inArray: (c: any, vs: any[]) => (r: Row) => vs.includes(r[col(c)]),
    lt: (c: any, v: any) => (r: Row) => r[col(c)] < v,
    and: (...ps: any[]) => (r: Row) => ps.filter(Boolean).every((p) => p(r)),
    sql: () => () => true, // the 24h COALESCE cutoff — every seeded row is stale
  };
});

vi.mock('@shared/schema', () => {
  const table = (name: string, cols: string[]) =>
    Object.assign({ __table: name }, Object.fromEntries(cols.map((c) => [c, { __col: c }])));
  return {
    bookingRequests: table('bookings', ['requestId', 'status', 'ownerConfirmedAt', 'providerCompletedAt', 'updatedAt', 'id']),
    contractorEarnings: table('earnings', ['earningId', 'bookingId']),
    bookingDisputes: table('disputes', ['id', 'bookingId', 'status']),
    users: table('users', ['id', 'email', 'firstName', 'lastName']),
    superAppNotifications: table('notifications', []),
  };
});

vi.mock('../db', () => {
  const rowsOf = (t: any): Row[] =>
    t.__table === 'bookings' ? H.bookings : t.__table === 'earnings' ? H.earnings
      : t.__table === 'disputes' ? H.disputes : t.__table === 'users' ? H.users : [];
  const select = (proj?: Record<string, any>) => ({
    from: (t: any) => {
      let pred: any = () => true;
      let lim = Infinity;
      const run = () => rowsOf(t).filter(pred).slice(0, lim).map((r) =>
        proj ? Object.fromEntries(Object.entries(proj).map(([k, c]: any) => [k, r[c.__col]])) : { ...r });
      const q: any = {
        where: (p: any) => { pred = p; return q; },
        limit: (n: number) => { lim = n; return q; },
        then: (res: any, rej: any) => Promise.resolve(run()).then(res, rej),
      };
      return q;
    },
  });
  const update = (t: any) => ({
    set: (vals: Row) => {
      let pred: any = () => true;
      const apply = () => {
        const hit = rowsOf(t).filter(pred);
        hit.forEach((r) => Object.assign(r, vals));
        return hit;
      };
      const q: any = {
        where: (p: any) => { pred = p; return q; },
        returning: () => Promise.resolve(apply().map((r) => ({ id: r.id }))),
        then: (res: any, rej: any) => Promise.resolve(apply()).then(res, rej),
      };
      return q;
    },
  });
  return { db: { select, update } };
});

const generateReceipt = vi.fn(async () => ({ success: true }));
const createEarningRecord = vi.fn(async () => ({ earningId: 'e1' }));
const releaseEscrowPayment = vi.fn(async () => true);
const writeBookingLedgerEntries = vi.fn(async () => undefined);

vi.mock('../services/IsraeliDigitalReceiptService', () => ({ IsraeliDigitalReceiptService: { generateReceipt } }));
vi.mock('../services/payoutLedger', () => ({ createEarningRecord }));
vi.mock('../services/EscrowService', () => ({
  default: { getEscrowsByBooking: vi.fn(async () => [{ id: 'esc1', status: 'held' }]), releaseEscrowPayment },
}));
vi.mock('../services/bookingLedgerWriter', () => ({ writeBookingLedgerEntries }));
vi.mock('../lib/notificationDispatcher', () => ({ dispatchNotification: vi.fn(async () => undefined) }));
vi.mock('../email/sendServiceCompletedReview', () => ({ sendServiceCompletedReview: vi.fn(async () => undefined) }));
vi.mock('@shared/formatAddress', () => ({ formatUserAddress: () => '', bookingSnapshotToAddress: () => ({}) }));
vi.mock('../lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('node-cron', () => ({ default: { schedule: vi.fn() } }));
vi.mock('../backgroundJobs', () => ({
  BackgroundJobProcessor: { runWithLock: async (_n: string, fn: () => Promise<unknown>) => fn() },
}));

const seed = (over: Row = {}) => {
  const row: Row = {
    id: 1, requestId: 'REQ-1', status: 'provider_marked_complete', ownerConfirmedAt: null,
    ownerId: 'owner1', providerId: 'prov1', providerType: 'sitter', serviceType: 'pet_sitting',
    subtotalCents: 10000, serviceFeeCents: 1500, totalCents: 10000, statusHistory: [],
    updatedAt: new Date(0), providerCompletedAt: new Date(0), ...over,
  };
  H.bookings.push(row);
  return row;
};

async function runCron() {
  // The cron module keeps autoApproveExpiredCompletions private; drive it the way
  // production does — through its scheduler entrypoint's startup scan.
  vi.useFakeTimers();
  const mod = await import('../cron/auto-approve-completions');
  mod.startAutoApproveCompletionsCron();
  await vi.runAllTimersAsync();
  vi.useRealTimers();
}

describe('auto-approve cron takes the same atomic claim as /confirm', () => {
  beforeEach(() => {
    vi.resetModules();
    H.bookings.length = 0;
    H.earnings.length = 0;
    H.disputes.length = 0;
    [generateReceipt, createEarningRecord, releaseEscrowPayment, writeBookingLedgerEntries].forEach((f) => f.mockClear());
    createEarningRecord.mockImplementation(async () => ({ earningId: 'e1' }));
  });

  it('customer /confirm already holds the claim → cron issues NOTHING (no receipt, no escrow, no earning)', async () => {
    const row = seed({ ownerConfirmedAt: new Date() }); // /confirm won the claim a moment ago
    await runCron();
    expect(generateReceipt).not.toHaveBeenCalled();
    expect(releaseEscrowPayment).not.toHaveBeenCalled();
    expect(createEarningRecord).not.toHaveBeenCalled();
    expect(writeBookingLedgerEntries).not.toHaveBeenCalled();
    expect(row.status).toBe('provider_marked_complete'); // /confirm finishes it, not the cron
  });

  it('unclaimed stale booking → exactly one receipt, escrow released once, completed', async () => {
    const row = seed();
    await runCron();
    expect(generateReceipt).toHaveBeenCalledTimes(1);
    expect((generateReceipt.mock.calls[0] as any)[0]).toMatchObject({ bookingId: 'REQ-1', paymentClass: 'PROVIDER_BOOKING_COMMISSION' });
    expect(releaseEscrowPayment).toHaveBeenCalledTimes(1);
    expect(row.status).toBe('completed');
    expect(row.ownerConfirmedAt).toBeInstanceOf(Date);
  });

  it('a failure mid-way releases the claim so the next run (or the customer) can retry', async () => {
    const row = seed();
    createEarningRecord.mockImplementationOnce(async () => { throw new Error('ledger down'); });
    await runCron();
    expect(generateReceipt).not.toHaveBeenCalled();
    expect(row.status).toBe('provider_marked_complete');
    expect(row.ownerConfirmedAt).toBeNull();
  });
});
