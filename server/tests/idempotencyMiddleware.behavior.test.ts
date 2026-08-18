/**
 * P0-141 CEO fix — atomic idempotency middleware runtime tests.
 *
 * Coverage (tests match the CEO spec letters A–H):
 *   A. Promise.all([2 identical strict]) → handler exactly once
 *   B. Promise.all([10 identical strict]) → handler exactly once
 *   C. losing workers never reach next()
 *   D. DB error in strict mode → 503, handler not executed
 *   E. completed duplicate → no second business execution
 *   F. failed first attempt → retryable
 *   G. stale PENDING (crashed worker) → bounded lease recovery
 *   H. different keys → both execute normally
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── In-memory Postgres emulator for idempotency_keys (PK on key). ─────────
type Row = { key: string; endpoint: string; response_hash: string; created_at: number };
const store = new Map<string, Row>();
let dbFail = false;

vi.mock('../db', () => {
  const execute = vi.fn(async (query: any) => {
    if (dbFail) throw new Error('simulated DB failure');
    const chunks: any[] = query?.queryChunks ?? [];
    const text = chunks
      .map((c) =>
        c?.constructor?.name === 'StringChunk'
          ? c.value?.[0] ?? ''
          : c?.constructor?.name === 'FakeSqlRaw'
            ? c.raw ?? ''
            : '?',
      )
      .join('');
    const params: any[] = [];
    for (const c of chunks) {
      if (!c) continue;
      const name = c.constructor?.name;
      if (name === 'StringChunk' || name === 'FakeSqlRaw') continue;
      if (name === 'String') { params.push(String(c)); continue; }
      if (name === 'Number') { params.push(Number(c)); continue; }
      if (typeof c === 'object' && 'value' in c) { params.push((c as any).value); continue; }
      params.push(c);
    }
    // INSERT ON CONFLICT DO NOTHING RETURNING
    if (/INSERT INTO idempotency_keys/i.test(text) && /ON CONFLICT \(key\) DO NOTHING/i.test(text)) {
      const [key, endpoint, marker] = params;
      if (store.has(key)) return { rows: [] };
      store.set(key, {
        key: String(key),
        endpoint: String(endpoint),
        response_hash: String(marker),
        created_at: Date.now(),
      });
      return { rows: [{ key }] };
    }
    // SELECT with TTL
    if (/SELECT response_hash, created_at/i.test(text) && /INTERVAL/i.test(text)) {
      const [key] = params;
      const row = store.get(String(key));
      if (!row) return { rows: [] };
      if (Date.now() - row.created_at > 24 * 60 * 60 * 1000) return { rows: [] };
      return {
        rows: [{
          response_hash: row.response_hash,
          created_at: new Date(row.created_at).toISOString(),
        }],
      };
    }
    // UPDATE steal-when-24h-old
    if (
      /UPDATE idempotency_keys/i.test(text) &&
      /response_hash = \?, created_at = NOW\(\), endpoint = \?/i.test(text) &&
      /INTERVAL/i.test(text)
    ) {
      // Param order per the sql template: PENDING_MARKER, endpoint, key
      const [marker, endpoint, key] = params;
      const row = store.get(String(key));
      if (!row) return { rows: [] };
      if (Date.now() - row.created_at <= 24 * 60 * 60 * 1000) return { rows: [] };
      row.response_hash = String(marker);
      row.endpoint = String(endpoint);
      row.created_at = Date.now();
      return { rows: [{ key: row.key }] };
    }
    // UPDATE lease-steal (exact created_at)
    if (
      /UPDATE idempotency_keys/i.test(text) &&
      /SET created_at = NOW\(\), endpoint = \?/i.test(text) &&
      /response_hash = \?/i.test(text) &&
      /AND created_at = \?::timestamptz/i.test(text)
    ) {
      // Param order per the sql template: endpoint, key, marker, claimedIso
      const [endpoint, key, marker, claimedIso] = params;
      const claimedTs = new Date(String(claimedIso)).getTime();
      const row = store.get(String(key));
      if (!row) return { rows: [] };
      if (row.response_hash !== String(marker)) return { rows: [] };
      if (Math.abs(row.created_at - claimedTs) > 5) return { rows: [] };
      row.created_at = Date.now();
      row.endpoint = String(endpoint);
      return { rows: [{ key: row.key }] };
    }
    // UPDATE finalize (response_hash to status JSON)
    if (
      /UPDATE idempotency_keys/i.test(text) &&
      /SET response_hash = \?/i.test(text) &&
      /WHERE key = \?/i.test(text) &&
      !/created_at/i.test(text)
    ) {
      const [marker, key] = params;
      const row = store.get(String(key));
      if (row) row.response_hash = String(marker);
      return { rows: [] };
    }
    throw new Error(`unhandled SQL: ${text.slice(0, 200)}`);
  });
  return { db: { execute } };
});

vi.mock('drizzle-orm', async () => {
  const actual: any = await vi.importActual('drizzle-orm');
  // Provide a raw() shim that returns a FakeSqlRaw chunk so our fake db
  // sees the same text-fragment inserts drizzle would produce.
  const raw = (text: string) => {
    class FakeSqlRaw { raw: string; constructor(t: string) { this.raw = t; } }
    return new FakeSqlRaw(text);
  };
  const sql: any = actual.sql;
  sql.raw = raw;
  return { ...actual, sql };
});

vi.mock('./requestIdAndLogs', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../services/SystemEventService', () => ({
  SystemEventService: { doubleSubmitBlocked: vi.fn() },
}));

// Import AFTER mocks are registered.
import { requireIdempotency, requireStrictIdempotency } from '../middleware/idempotency';

function makeReqRes(key?: string, path = '/checkout') {
  const req: any = {
    headers: key ? { 'idempotency-key': key } : {},
    method: 'POST',
    path,
  };
  const listeners: Record<string, Array<() => void>> = {};
  const res: any = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    status(code: number) { this.statusCode = code; return this; },
    json(body: any) { this.body = body; this.finished = true; (listeners['finish'] || []).forEach(fn => fn()); return this; },
    on(evt: string, fn: () => void) { (listeners[evt] = listeners[evt] || []).push(fn); },
    body: undefined,
    finished: false,
  };
  return { req, res, listeners };
}

async function runMiddleware(mw: typeof requireStrictIdempotency, req: any, res: any) {
  return await new Promise<'next' | 'stopped'>((resolve) => {
    let called = false;
    const next = () => { called = true; resolve('next'); };
    mw(req, res, next);
    // If mw responds without calling next, wait for finish.
    const t = setTimeout(() => resolve(called ? 'next' : 'stopped'), 200);
    // Race the timeout with the response.
    // (No return needed — the outer Promise resolves via next() or timeout.)
  });
}

beforeEach(() => {
  store.clear();
  dbFail = false;
});

describe('P0-141 A — 2 concurrent strict requests → handler exactly once', () => {
  it('exactly one caller advances via next()', async () => {
    const key = 'abc-2';
    const [a, b] = await Promise.all([
      runMiddleware(requireStrictIdempotency, ...Object.values(makeReqRes(key)).slice(0, 2) as any),
      runMiddleware(requireStrictIdempotency, ...Object.values(makeReqRes(key)).slice(0, 2) as any),
    ]);
    const nextCount = [a, b].filter((r) => r === 'next').length;
    expect(nextCount).toBe(1);
  });
});

describe('P0-141 B — 10 concurrent strict requests → handler exactly once', () => {
  it('exactly one caller advances via next()', async () => {
    const key = 'abc-10';
    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        runMiddleware(requireStrictIdempotency, ...Object.values(makeReqRes(key)).slice(0, 2) as any),
      ),
    );
    const nextCount = results.filter((r) => r === 'next').length;
    expect(nextCount).toBe(1);
  });
});

describe('P0-141 C — losing workers do not reach next()', () => {
  it('losers return 409 IN_PROGRESS without invoking next', async () => {
    const key = 'abc-c';
    const first = makeReqRes(key);
    const second = makeReqRes(key);
    const [rFirst, rSecond] = await Promise.all([
      runMiddleware(requireStrictIdempotency, first.req, first.res),
      runMiddleware(requireStrictIdempotency, second.req, second.res),
    ]);
    const results = [rFirst, rSecond];
    // Exactly one next, one stopped.
    expect(results.filter((r) => r === 'next').length).toBe(1);
    expect(results.filter((r) => r === 'stopped').length).toBe(1);
    // The stopped one must have responded with either 409 (still pending)
    // or 200 (already complete — depends on scheduling).
    const stopped = rFirst === 'stopped' ? first.res : second.res;
    expect([200, 409]).toContain(stopped.statusCode);
    if (stopped.statusCode === 409) {
      expect(stopped.body?.error).toBe('IDEMPOTENT_REQUEST_IN_PROGRESS');
    }
  });
});

describe('P0-141 D — DB error in strict mode → 503, handler not executed', () => {
  it('503 IDEMPOTENCY_UNAVAILABLE + next() not called', async () => {
    dbFail = true;
    const { req, res } = makeReqRes('abc-d');
    const r = await runMiddleware(requireStrictIdempotency, req, res);
    expect(r).toBe('stopped');
    expect(res.statusCode).toBe(503);
    expect(res.body?.error).toBe('IDEMPOTENCY_UNAVAILABLE');
  });
});

describe('P0-141 E — completed duplicate → no second business execution', () => {
  it('replay of a finalized-success key returns 200 idempotent without next()', async () => {
    const key = 'abc-e';
    const first = makeReqRes(key);
    const rFirst = await runMiddleware(requireStrictIdempotency, first.req, first.res);
    expect(rFirst).toBe('next');
    // Simulate the business handler completing with a 201.
    first.res.status(201).json({ ok: true });

    // Now replay.
    const second = makeReqRes(key);
    const rSecond = await runMiddleware(requireStrictIdempotency, second.req, second.res);
    expect(rSecond).toBe('stopped');
    expect(second.res.statusCode).toBe(200);
    expect(second.res.body?.idempotent).toBe(true);
  });
});

describe('P0-141 F — failed first attempt (crash before finalize) is retryable via lease', () => {
  it('after PENDING_LEASE_MS, a fresh caller may steal the claim and run', async () => {
    const key = 'abc-f';
    const first = makeReqRes(key);
    const rFirst = await runMiddleware(requireStrictIdempotency, first.req, first.res);
    expect(rFirst).toBe('next');
    // Simulate crash — row stays 'pending'. Backdate the store row so the
    // lease is expired without waiting real seconds.
    const row = store.get(key)!;
    row.created_at = Date.now() - 10 * 60 * 1000; // 10 min ago > 5 min lease
    const second = makeReqRes(key);
    const rSecond = await runMiddleware(requireStrictIdempotency, second.req, second.res);
    expect(rSecond).toBe('next');
  });
});

describe('P0-141 G — stale PENDING crashed worker → bounded recovery', () => {
  it('within the lease window, second caller returns IN_PROGRESS (not runs)', async () => {
    const key = 'abc-g';
    const first = makeReqRes(key);
    expect(await runMiddleware(requireStrictIdempotency, first.req, first.res)).toBe('next');
    // Simulate: first caller crashed, but the lease is still fresh.
    // (No mutation to created_at — it's Date.now() from the insert.)
    const second = makeReqRes(key);
    const r = await runMiddleware(requireStrictIdempotency, second.req, second.res);
    expect(r).toBe('stopped');
    expect(second.res.statusCode).toBe(409);
    expect(second.res.body?.error).toBe('IDEMPOTENT_REQUEST_IN_PROGRESS');
  });
});

describe('P0-141 H — different keys → both handlers run', () => {
  it('two different Idempotency-Keys → both advance', async () => {
    const a = makeReqRes('abc-h1');
    const b = makeReqRes('abc-h2');
    const [ra, rb] = await Promise.all([
      runMiddleware(requireStrictIdempotency, a.req, a.res),
      runMiddleware(requireStrictIdempotency, b.req, b.res),
    ]);
    expect(ra).toBe('next');
    expect(rb).toBe('next');
  });
});

describe('P0-141 — non-strict FAIL-OPEN on DB error', () => {
  it('DB error under requireIdempotency → next() (app stays up)', async () => {
    dbFail = true;
    const { req, res } = makeReqRes('lax-1');
    const r = await runMiddleware(requireIdempotency, req, res);
    expect(r).toBe('next');
  });
});

describe('P0-141 — missing key → 400 in both modes', () => {
  it('strict', async () => {
    const { req, res } = makeReqRes(undefined);
    const r = await runMiddleware(requireStrictIdempotency, req, res);
    expect(r).toBe('stopped');
    expect(res.statusCode).toBe(400);
    expect(res.body?.error).toBe('MISSING_IDEMPOTENCY_KEY');
  });
  it('lax', async () => {
    const { req, res } = makeReqRes(undefined);
    const r = await runMiddleware(requireIdempotency, req, res);
    expect(r).toBe('stopped');
    expect(res.statusCode).toBe(400);
    expect(res.body?.error).toBe('MISSING_IDEMPOTENCY_KEY');
  });
});
