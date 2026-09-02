/**
 * Release-blocker A3 + A4 + A5 — fiscal document outbox
 * (CEO 2026-09-02 release freeze).
 *
 * Prior behaviour: VAT ledger writes, Israeli digital receipts, and
 * the walk-my-pet legacy bridge all lived inside non-blocking
 * `.catch()` blocks on the booking-completion path. Any transient
 * failure silently dropped the work — an Israeli fiscal-law breach
 * for receipts, and paid bookings that hung at pending_provider
 * forever for the bridge.
 *
 * Fixed behaviour (this test locks in):
 *
 *   1. INLINE-FIRST — the caller's runNow() is executed; on success
 *      NO outbox row is written (steady-state stays clean).
 *
 *   2. DURABLE ON INLINE FAILURE — runNow's throw triggers a durable
 *      insert into fiscal_document_outbox keyed by (kind, source_key).
 *      Row carries the payload the drainer needs to retry.
 *
 *   3. FAIL-CLOSED ON DOUBLE-FAILURE — if the outbox insert ALSO
 *      fails, throws FiscalOutboxUnavailableError so the HTTP caller
 *      returns a 5xx and the client can retry. The work is NEVER
 *      silently absorbed.
 *
 *   4. IDEMPOTENT ENQUEUE — a second enqueue for the same
 *      (kind, source_key) is a no-op via ON CONFLICT DO NOTHING.
 *      Booking-completion retries on the client cannot double-enqueue.
 *
 *   5. PAYLOAD ROUND-TRIP — the payload the caller supplies is what
 *      the drainer will see, byte-for-byte after JSON round-trip.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/logger', () => ({
  logger: {
    error: () => {},
    warn: () => {},
    info: () => {},
    debug: () => {},
  },
}));

import {
  runFiscalDocumentAndPersistOnFailure,
  FiscalOutboxUnavailableError,
  type FiscalOutboxKind,
} from '../services/fiscalDocumentOutbox';

// Minimal in-memory outbox stand-in.
type Row = { kind: string; source_key: string; payload: string; status: string; last_error: string | null };
function makePool(opts: { insertThrows?: boolean } = {}) {
  const store: Row[] = [];
  const pool: any = {
    query: async (sql: string, params?: unknown[]) => {
      if (opts.insertThrows && sql.trim().startsWith('INSERT INTO fiscal_document_outbox')) {
        throw new Error('outbox insert failed');
      }
      if (sql.trim().startsWith('INSERT INTO fiscal_document_outbox')) {
        const p = (params ?? []) as any[];
        const existing = store.find((r) => r.kind === p[0] && r.source_key === p[1]);
        if (existing) return { rows: [] }; // ON CONFLICT DO NOTHING
        store.push({ kind: p[0], source_key: p[1], payload: p[2], status: 'pending', last_error: p[3] ?? null });
        return { rows: [] };
      }
      return { rows: [] };
    },
    __store: store,
  };
  return pool;
}

describe('A3/A4/A5 · runFiscalDocumentAndPersistOnFailure', () => {
  it('INLINE SUCCESS · runNow returns → NO outbox row written', async () => {
    const pool = makePool();
    let called = 0;
    const result = await runFiscalDocumentAndPersistOnFailure({
      pool,
      kind: 'vat_ledger',
      sourceKey: 'booking:BK-1',
      payload: { grossAmountIls: 42.5 },
      runNow: async () => {
        called++;
        return 'ok' as const;
      },
    });
    expect(called).toBe(1);
    expect(result.ranInline).toBe(true);
    expect(result.enqueued).toBe(false);
    expect(result.result).toBe('ok');
    expect(pool.__store).toHaveLength(0);
  });

  it('INLINE FAILURE · runNow throws → durable outbox row written, caller sees success', async () => {
    const pool = makePool();
    const result = await runFiscalDocumentAndPersistOnFailure({
      pool,
      kind: 'academy_receipt',
      sourceKey: 'booking:BK-2',
      payload: { bookingId: 'BK-2', totalAmountIls: 100 },
      runNow: async () => { throw new Error('receipt service 500'); },
    });
    expect(result.ranInline).toBe(false);
    expect(result.enqueued).toBe(true);
    expect(result.inlineError).toContain('receipt service 500');
    expect(pool.__store).toHaveLength(1);
    const row = pool.__store[0];
    expect(row.kind).toBe('academy_receipt');
    expect(row.source_key).toBe('booking:BK-2');
    expect(row.status).toBe('pending');
    expect(row.last_error).toContain('receipt service 500');
  });

  it('PAYLOAD ROUND-TRIP · what the caller passed is what the drainer will see', async () => {
    const pool = makePool();
    const payload = {
      source: 'sitter-suite',
      bookingId: 'BK-round-trip',
      grossAmountIls: 199.5,
      metadata: { completedAt: '2026-09-02T10:00:00.000Z', bookingDbId: 42 },
      settlement: {
        withholdingTaxAmount: 12.5,
        withholdingTaxRate: 0.05,
        netPaymentToProvider: 176.5,
        commissionId: 'COM-A',
        osekType: 'osek_patur',
      },
    };
    await runFiscalDocumentAndPersistOnFailure({
      pool,
      kind: 'vat_ledger',
      sourceKey: 'booking:BK-round-trip',
      payload,
      runNow: async () => { throw new Error('inline failed'); },
    });
    const row = pool.__store[0];
    const parsed = JSON.parse(row.payload);
    expect(parsed).toEqual(payload);
  });

  it('IDEMPOTENT ENQUEUE · same (kind, source_key) inserted twice → one row', async () => {
    const pool = makePool();
    for (let i = 0; i < 3; i++) {
      await runFiscalDocumentAndPersistOnFailure({
        pool,
        kind: 'walk_legacy_bridge',
        sourceKey: 'walk_booking:BK-3',
        payload: { attempt: i },
        runNow: async () => { throw new Error('inline fail'); },
      });
    }
    expect(pool.__store).toHaveLength(1);
  });

  it('DOUBLE FAILURE · runNow AND outbox insert both throw → FiscalOutboxUnavailableError', async () => {
    const pool = makePool({ insertThrows: true });
    await expect(
      runFiscalDocumentAndPersistOnFailure({
        pool,
        kind: 'vat_ledger',
        sourceKey: 'booking:BK-4',
        payload: { grossAmountIls: 50 },
        runNow: async () => { throw new Error('inline fail'); },
      }),
    ).rejects.toBeInstanceOf(FiscalOutboxUnavailableError);
    expect(pool.__store).toHaveLength(0);
  });

  it('error class shape stable — caller inspects .name / .kind / .sourceKey', () => {
    const err = new FiscalOutboxUnavailableError(
      'vat_ledger' as FiscalOutboxKind,
      'booking:X',
      new Error('db_down'),
    );
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('FiscalOutboxUnavailableError');
    expect(err.message).toBe('fiscal_outbox_unavailable:vat_ledger:booking:X');
    expect(err.kind).toBe('vat_ledger');
    expect(err.sourceKey).toBe('booking:X');
  });

  it('runNow may return void — result field is undefined but ranInline stays true', async () => {
    const pool = makePool();
    const r = await runFiscalDocumentAndPersistOnFailure({
      pool,
      kind: 'digital_receipt',
      sourceKey: 'booking:BK-void',
      payload: {},
      runNow: async () => { /* void */ },
    });
    expect(r.ranInline).toBe(true);
    expect(r.enqueued).toBe(false);
    expect(r.result).toBeUndefined();
  });
});
