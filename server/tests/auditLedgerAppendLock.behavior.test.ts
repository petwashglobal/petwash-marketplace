/**
 * AuditLedgerService.recordEvent must not fork the chain under concurrency.
 *
 * 2026-09-10 07:10Z: two device-security events raced; FOR UPDATE on the
 * tail row did not stop the second writer from computing the same
 * blockNumber → audit_ledger_block_number_unique → event dropped. Pins:
 * the advisory lock is taken BEFORE the tail is read, and a unique violation
 * is retried exactly once.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const h = vi.hoisted(() => ({ calls: [] as string[], failInsertsLeft: 0, tail: [] as any[] }));

vi.mock('../db', () => ({
  db: {
    transaction: async (cb: any) => {
      const tx: any = {
        execute: async (q: any) => { h.calls.push('lock:' + JSON.stringify(q?.queryChunks ? 'sql' : q).slice(0, 12)); return []; },
        select: () => ({ from: () => ({ orderBy: () => ({ limit: () => ({ for: async () => { h.calls.push('select-tail'); return h.tail; } }) }) }) }),
        insert: () => ({ values: (v: any) => ({ returning: async () => {
          h.calls.push('insert:' + v.blockNumber);
          if (h.failInsertsLeft > 0) { h.failInsertsLeft--; const cause: any = new Error('duplicate key value violates unique constraint "audit_ledger_block_number_unique"'); cause.code = '23505'; const e: any = new Error('Failed query: insert into "audit_ledger" …'); e.cause = cause; throw e; }
          return [{ id: 99 }];
        } }) }),
      };
      return cb(tx);
    },
  },
}));
vi.mock('../lib/logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { AuditLedgerService } from '../services/AuditLedgerService';

const event = { eventType: 'DEVICE_SECURITY', userId: 'u1', entityType: 'device', entityId: 'd1', action: 'alert', newState: {}, ipAddress: '1.1.1.1', userAgent: 'ua' } as any;

describe('AuditLedger append', () => {
  beforeEach(() => { h.calls = []; h.failInsertsLeft = 0; h.tail = [{ blockNumber: 41, currentHash: 'abc' }]; });

  it('takes the advisory lock before reading the tail, then appends block N+1', async () => {
    const id = await AuditLedgerService.recordEvent(event);
    expect(id).toBe(99);
    expect(h.calls[0]).toMatch(/^lock:/);
    expect(h.calls[1]).toBe('select-tail');
    expect(h.calls[2]).toBe('insert:42');
  });

  it('retries exactly once when the tail moved underneath (unique violation)', async () => {
    h.failInsertsLeft = 1;
    const id = await AuditLedgerService.recordEvent(event);
    expect(id).toBe(99);
    expect(h.calls.filter(c => c.startsWith('insert:')).length).toBe(2);
    expect(h.calls.filter(c => c.startsWith('lock:')).length).toBe(2);
  });

  it('a second consecutive violation propagates', async () => {
    h.failInsertsLeft = 2;
    await expect(AuditLedgerService.recordEvent(event)).rejects.toThrow();
  });
});
