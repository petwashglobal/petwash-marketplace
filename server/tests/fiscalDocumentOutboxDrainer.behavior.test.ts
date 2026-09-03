/**
 * Release-blocker A3/A4/A5 · fiscal outbox drainer — behavioural gate
 * (CEO 2026-09-02 release freeze).
 *
 * Locks in the "durable retry" half of the release-blocker contract.
 *
 *   1. Picks up rows with status='pending' AND next_attempt_at<=now(),
 *      up to BATCH_SIZE per tick.
 *
 *   2. Success path: handler resolves → row flips to status='succeeded',
 *      succeeded_at stamped, last_error cleared.
 *
 *   3. Failure path (below MAX_ATTEMPTS): handler throws → row stays
 *      status='pending', attempts++, last_error captured, next_attempt_at
 *      pushed out per the exponential backoff schedule.
 *
 *   4. Failure path at MAX_ATTEMPTS: row flips to
 *      status='failed_needs_review' for ops intervention.
 *
 *   5. Unknown kind (no handler in the registry): row flips to
 *      status='failed_needs_review' with last_error naming the kind —
 *      never a silent loop.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/logger', () => ({
  logger: { error: () => {}, warn: () => {}, info: () => {}, debug: () => {} },
}));

import { drainOnce } from '../services/fiscalDocumentOutboxDrainer';

// In-memory outbox stand-in.
type Row = {
  id: string;
  kind: string;
  source_key: string;
  payload: any;
  attempts: number;
  status: 'pending' | 'succeeded' | 'failed_needs_review';
  last_error: string | null;
  next_attempt_at: number;
  succeeded_at: number | null;
  updated_at: number;
};

let rows: Row[] = [];

function makePool() {
  const pool: any = {
    query: async (sql: string, params?: unknown[]) => {
      // Claim batch — the CTE + SKIP LOCKED. Simplified to "pick pending
      // rows whose next_attempt_at <= now()".
      if (/WITH due AS[\s\S]+FOR UPDATE SKIP LOCKED/.test(sql)) {
        const limit = ((params ?? []) as any[])[0] as number;
        const now = Date.now();
        const due = rows
          .filter((r) => r.status === 'pending' && r.next_attempt_at <= now)
          .sort((a, b) => a.next_attempt_at - b.next_attempt_at)
          .slice(0, limit);
        return {
          rows: due.map((r) => ({
            id: r.id, kind: r.kind, source_key: r.source_key,
            payload: r.payload, attempts: r.attempts,
          })),
        };
      }
      // Success write.
      if (sql.includes(`status = 'succeeded'`)) {
        const id = ((params ?? []) as any[])[0] as string;
        const row = rows.find((r) => r.id === id);
        if (row) {
          row.status = 'succeeded';
          row.succeeded_at = Date.now();
          row.last_error = null;
          row.updated_at = Date.now();
        }
        return { rows: [] };
      }
      // Failed → needs_review write.
      if (sql.includes(`status = 'failed_needs_review'`)) {
        const p = (params ?? []) as any[];
        const id = p[0] as string;
        const row = rows.find((r) => r.id === id);
        if (row) {
          row.status = 'failed_needs_review';
          if (typeof p[1] === 'number') row.attempts = p[1];
          if (typeof p[2] === 'string') row.last_error = p[2];
          else if (typeof p[1] === 'string') row.last_error = p[1]; // no-handler variant
          row.updated_at = Date.now();
        }
        return { rows: [] };
      }
      // Reschedule (still pending, new next_attempt_at).
      if (sql.includes('next_attempt_at')) {
        const p = (params ?? []) as any[];
        const id = p[0] as string;
        const attempts = p[1] as number;
        const err = p[2] as string;
        const backoffSec = p[3] as number;
        const row = rows.find((r) => r.id === id);
        if (row) {
          row.attempts = attempts;
          row.last_error = err;
          row.next_attempt_at = Date.now() + backoffSec * 1000;
          row.updated_at = Date.now();
        }
        return { rows: [] };
      }
      return { rows: [] };
    },
  };
  return pool;
}

function seedRow(overrides: Partial<Row> = {}): Row {
  const r: Row = {
    id: 'r-' + Math.random().toString(36).slice(2, 8),
    kind: 'vat_ledger',
    source_key: 'booking:X',
    payload: { grossAmountIls: 42 },
    attempts: 0,
    status: 'pending',
    last_error: null,
    next_attempt_at: Date.now() - 1000,
    succeeded_at: null,
    updated_at: Date.now(),
    ...overrides,
  };
  rows.push(r);
  return r;
}

beforeEach(() => {
  rows = [];
});

describe('fiscal outbox drainer · success path', () => {
  it('handler resolves → row → succeeded, error cleared', async () => {
    const r = seedRow();
    const handler = vi.fn().mockResolvedValue(undefined);
    const processed = await drainOnce(makePool(), { handlers: { vat_ledger: handler } });
    expect(processed).toBe(1);
    expect(handler).toHaveBeenCalledOnce();
    expect(r.status).toBe('succeeded');
    expect(r.succeeded_at).not.toBeNull();
    expect(r.last_error).toBeNull();
  });

  it('handler is called with the exact payload we stored', async () => {
    seedRow({ kind: 'academy_receipt', payload: { bookingId: 'BK-9', total: 100 } });
    const handler = vi.fn().mockResolvedValue(undefined);
    await drainOnce(makePool(), { handlers: { academy_receipt: handler } });
    expect(handler).toHaveBeenCalledWith({ bookingId: 'BK-9', total: 100 });
  });

  it('BATCH_SIZE limit is respected (drainer takes up to 10 per tick)', async () => {
    for (let i = 0; i < 15; i++) seedRow({ source_key: `booking:${i}` });
    const handler = vi.fn().mockResolvedValue(undefined);
    const processed = await drainOnce(makePool(), { handlers: { vat_ledger: handler } });
    expect(processed).toBe(10);
    expect(handler).toHaveBeenCalledTimes(10);
  });
});

describe('fiscal outbox drainer · failure + backoff', () => {
  it('handler throws → row stays pending, attempts++, next_attempt_at pushed out', async () => {
    const r = seedRow();
    const before = Date.now();
    const handler = vi.fn().mockRejectedValue(new Error('boom'));
    await drainOnce(makePool(), { handlers: { vat_ledger: handler } });
    expect(r.status).toBe('pending');
    expect(r.attempts).toBe(1);
    expect(r.last_error).toBe('boom');
    expect(r.next_attempt_at).toBeGreaterThan(before);
  });

  it('reaches MAX_ATTEMPTS → status flips to failed_needs_review', async () => {
    const r = seedRow({ attempts: 9 }); // one before the wall
    const handler = vi.fn().mockRejectedValue(new Error('never works'));
    await drainOnce(makePool(), { handlers: { vat_ledger: handler } });
    expect(r.status).toBe('failed_needs_review');
    expect(r.attempts).toBe(10);
    expect(r.last_error).toBe('never works');
  });

  it('exponential backoff grows across attempts', async () => {
    const r = seedRow();
    const handler = vi.fn().mockRejectedValue(new Error('boom'));

    await drainOnce(makePool(), { handlers: { vat_ledger: handler } });
    const firstNext = r.next_attempt_at;

    // Simulate time passing so it's due again.
    r.next_attempt_at = Date.now() - 1000;
    await drainOnce(makePool(), { handlers: { vat_ledger: handler } });
    const secondNext = r.next_attempt_at;

    // Second backoff is strictly longer than first.
    expect(secondNext - Date.now()).toBeGreaterThan(firstNext - (Date.now() - 1000));
  });
});

describe('fiscal outbox drainer · defensive contracts', () => {
  it('unknown kind → failed_needs_review with descriptive error (no infinite loop)', async () => {
    const r = seedRow({ kind: 'unregistered_kind' });
    await drainOnce(makePool(), { handlers: { vat_ledger: async () => {} } });
    expect(r.status).toBe('failed_needs_review');
    expect(r.last_error).toContain('no_handler_registered:unregistered_kind');
  });

  it('rows whose next_attempt_at is in the FUTURE are skipped', async () => {
    const r = seedRow({ next_attempt_at: Date.now() + 60_000 });
    const handler = vi.fn().mockResolvedValue(undefined);
    const processed = await drainOnce(makePool(), { handlers: { vat_ledger: handler } });
    expect(processed).toBe(0);
    expect(handler).not.toHaveBeenCalled();
    expect(r.status).toBe('pending');
  });

  it('rows already succeeded are skipped even when handler would succeed', async () => {
    seedRow({ status: 'succeeded', succeeded_at: Date.now() - 60_000 });
    const handler = vi.fn().mockResolvedValue(undefined);
    const processed = await drainOnce(makePool(), { handlers: { vat_ledger: handler } });
    expect(processed).toBe(0);
    expect(handler).not.toHaveBeenCalled();
  });

  it('rows in failed_needs_review are NOT re-attempted automatically', async () => {
    seedRow({ status: 'failed_needs_review', attempts: 10 });
    const handler = vi.fn().mockResolvedValue(undefined);
    const processed = await drainOnce(makePool(), { handlers: { vat_ledger: handler } });
    expect(processed).toBe(0);
    expect(handler).not.toHaveBeenCalled();
  });
});

describe('fiscal outbox drainer · concurrency shape', () => {
  it('an empty batch returns 0 without error', async () => {
    const processed = await drainOnce(makePool(), { handlers: {} });
    expect(processed).toBe(0);
  });
});
