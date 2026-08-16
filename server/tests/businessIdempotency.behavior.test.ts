/**
 * Task 21 — CEO fire order 101-140.
 *
 * BUSINESS IDEMPOTENCY runtime tests for
 * server/lib/businessIdempotency.ts (used by
 * server/routes/provider-applications.ts POST / and future
 * business-create endpoints in tasks 22-29).
 *
 * Contract:
 *
 *   claimBusinessOnce(key, endpoint) →
 *     'CLAIMED'   — proceed with the business op
 *     'IN_FLIGHT' — another worker is currently processing
 *     'DONE'      — a prior call already completed
 *     'DB_ERROR'  — FAIL CLOSED (caller returns 503)
 *
 *   finalizeBusinessClaim(key, ok) →
 *     ok=true   → UPDATE response_hash='done' (permanent until 24h TTL)
 *     ok=false  → DELETE row so the user can safely retry
 *
 * NO auto-steal on stale in_progress. Business ops require an
 * operator decision.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

type Row = { key: string; endpoint: string; response_hash: string; created_at: number };
const store = new Map<string, Row>();
let dbFail = false;

vi.mock('../db', () => {
  const execute = vi.fn(async (query: any) => {
    if (dbFail) throw new Error('simulated DB failure');
    const chunks: any[] = query?.queryChunks ?? [];
    const text = chunks.map(c => c?.constructor?.name === 'StringChunk' ? (c.value?.[0] ?? '') : '?').join('');
    const params: any[] = [];
    for (const c of chunks) {
      if (!c) continue;
      const name = c.constructor?.name;
      if (name === 'StringChunk') continue;
      if (name === 'String') { params.push(String(c)); continue; }
      if (name === 'Number') { params.push(Number(c)); continue; }
      if (typeof c === 'object' && 'value' in c) { params.push((c as any).value); continue; }
      params.push(c);
    }
    if (/INSERT INTO idempotency_keys/i.test(text) && /ON CONFLICT \(key\) DO NOTHING/i.test(text)) {
      const [key, endpoint] = params;
      if (store.has(key)) return { rows: [] };
      store.set(key, { key, endpoint, response_hash: 'in_progress', created_at: Date.now() });
      return { rows: [{ key }] };
    }
    if (/SELECT response_hash/i.test(text) && /INTERVAL '24 hours'/i.test(text)) {
      const [key] = params;
      const row = store.get(key);
      if (!row) return { rows: [] };
      if (Date.now() - row.created_at > 24 * 60 * 60 * 1000) return { rows: [] };
      return { rows: [{ response_hash: row.response_hash }] };
    }
    if (/UPDATE idempotency_keys/i.test(text) && /SET response_hash = 'done'/i.test(text)) {
      const [key] = params;
      const row = store.get(key);
      if (row) row.response_hash = 'done';
      return { rows: [] };
    }
    if (/DELETE FROM idempotency_keys/i.test(text)) {
      const [key] = params;
      store.delete(key);
      return { rows: [] };
    }
    throw new Error(`unhandled SQL: ${text.slice(0, 200)}`);
  });
  return { db: { execute } };
});

import { claimBusinessOnce, finalizeBusinessClaim } from '../lib/businessIdempotency';

beforeEach(() => {
  store.clear();
  dbFail = false;
});

describe('claimBusinessOnce — atomic first-claim wins', () => {
  it('single call → CLAIMED', async () => {
    const r = await claimBusinessOnce('biz:submit:userA', 'POST /x');
    expect(r).toBe('CLAIMED');
  });

  it('two concurrent claims → 1 CLAIMED, 1 IN_FLIGHT', async () => {
    const [a, b] = await Promise.all([
      claimBusinessOnce('biz:submit:userB', 'POST /x'),
      claimBusinessOnce('biz:submit:userB', 'POST /x'),
    ]);
    expect([a, b].sort()).toEqual(['CLAIMED', 'IN_FLIGHT']);
  });

  it('five concurrent claims → exactly one CLAIMED', async () => {
    const rs = await Promise.all(Array.from({ length: 5 }, () =>
      claimBusinessOnce('biz:submit:userC', 'POST /x'),
    ));
    expect(rs.filter(r => r === 'CLAIMED').length).toBe(1);
    expect(rs.filter(r => r === 'IN_FLIGHT').length).toBe(4);
  });
});

describe('finalize + replay', () => {
  it('finalize(true) → subsequent claim returns DONE', async () => {
    const key = 'biz:submit:userD';
    expect(await claimBusinessOnce(key, 'POST /x')).toBe('CLAIMED');
    await finalizeBusinessClaim(key, true);
    expect(await claimBusinessOnce(key, 'POST /x')).toBe('DONE');
  });

  it('finalize(false) → subsequent claim returns CLAIMED (business op can retry)', async () => {
    const key = 'biz:submit:userE';
    expect(await claimBusinessOnce(key, 'POST /x')).toBe('CLAIMED');
    await finalizeBusinessClaim(key, false);
    expect(await claimBusinessOnce(key, 'POST /x')).toBe('CLAIMED');
  });
});

describe('fail-closed on DB error', () => {
  it('claim on DB error → DB_ERROR (caller returns 503)', async () => {
    dbFail = true;
    const r = await claimBusinessOnce('biz:submit:userF', 'POST /x');
    expect(r).toBe('DB_ERROR');
  });

  it('finalize swallows DB error non-fatally', async () => {
    dbFail = true;
    // Must not throw.
    await expect(finalizeBusinessClaim('biz:submit:userG', true)).resolves.toBeUndefined();
    await expect(finalizeBusinessClaim('biz:submit:userG', false)).resolves.toBeUndefined();
  });
});

describe('no auto-steal on stale in_progress', () => {
  it('a stale in_progress claim stays IN_FLIGHT (business ops require operator resolution)', async () => {
    const key = 'biz:submit:userH';
    expect(await claimBusinessOnce(key, 'POST /x')).toBe('CLAIMED');
    // Force the store entry to be >24h old.
    const row = store.get(key)!;
    row.created_at = Date.now() - 25 * 60 * 60 * 1000;
    // Second claim: INSERT conflicts, SELECT returns empty (TTL), helper
    // must NOT steal — returns IN_FLIGHT.
    expect(await claimBusinessOnce(key, 'POST /x')).toBe('IN_FLIGHT');
  });
});
