/**
 * Behavioral tests for the canonical event-notification idempotency
 * helper (server/lib/eventNotificationIdempotency.ts).
 *
 * These are RUNTIME tests — not source pins. They run real
 * claim/finalize flows against an in-memory fake `db.execute` that
 * models the same UNIQUE-constraint semantics Postgres provides on
 * `idempotency_keys.key`.
 *
 * Coverage (matches CEO fire-order Test 1–6 spec):
 *
 *   T1 CONCURRENT CLAIM       — two workers race, exactly one CLAIMED
 *   T2 DUPLICATE EVENT        — replay after success → skipped
 *   T3 FAILED DELIVERY RETRY  — failed send releases claim → retry OK
 *   T4 SUCCESS THEN REPLAY    — success persists, replay skipped
 *   T5 PARALLEL DELIVERY      — Promise.all(N × dispatchOnce) →
 *                                exactly one sender invocation
 *   T6 DB FAILURE              — claim() returns 'DB_ERROR'; caller
 *                                may fail-open (lifecycle) or fail-
 *                                closed (money paths — separate helper)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Minimal Postgres emulator for `idempotency_keys`:
 *   - UNIQUE PK on `key`
 *   - Handles the four SQL shapes the helper issues:
 *       · INSERT ... ON CONFLICT (key) DO NOTHING RETURNING key, created_at
 *       · SELECT response_hash, created_at ... WHERE key = ? AND created_at > NOW() - INTERVAL '24 hours'
 *       · UPDATE idempotency_keys SET response_hash='pending', created_at=NOW()
 *         WHERE key = ? AND created_at <= NOW() - INTERVAL '24 hours' RETURNING key
 *       · UPDATE ... SET created_at=NOW() WHERE key=? AND response_hash='pending' AND created_at=? RETURNING key
 *       · UPDATE ... SET response_hash='sent' WHERE key=?
 *       · DELETE ... WHERE key=?
 *
 * The fake is intentionally atomic per call — Node.js is single-threaded
 * inside a promise microtask, so the ORDER of interleaving is deterministic
 * per test. That is sufficient to prove the semantic contract: two callers
 * cannot both see "no row" then both insert.
 */
type Row = { key: string; response_hash: string; created_at: number };
const store = new Map<string, Row>();
let now = () => Date.now();
let dbFail = false;

vi.mock('../db', () => {
  return {
    db: {
      execute: vi.fn(async (query: any) => {
        if (dbFail) throw new Error('simulated DB failure');
        // drizzle's sql`...` returns an object with .strings + .queryChunks etc.
        // We serialize it to a canonical text and pull params out of it.
        const text = serialize(query);
        // -- INSERT ... ON CONFLICT (key) DO NOTHING RETURNING key, created_at
        if (/INSERT INTO idempotency_keys/i.test(text) && /ON CONFLICT \(key\) DO NOTHING/i.test(text)) {
          const key = extractParam(query, 0);
          if (store.has(key)) return { rows: [] };
          const row: Row = { key, response_hash: 'pending', created_at: now() };
          store.set(key, row);
          return { rows: [{ key, created_at: new Date(row.created_at).toISOString() }] };
        }
        // -- SELECT response_hash, created_at ... 24 hours
        if (/SELECT response_hash, created_at/i.test(text) && /INTERVAL '24 hours'/i.test(text)) {
          const key = extractParam(query, 0);
          const row = store.get(key);
          if (!row) return { rows: [] };
          if (now() - row.created_at > 24 * 60 * 60 * 1000) return { rows: [] };
          return {
            rows: [{
              response_hash: row.response_hash,
              created_at: new Date(row.created_at).toISOString(),
            }],
          };
        }
        // -- UPDATE steal-when-24h-old
        if (/UPDATE idempotency_keys/i.test(text)
            && /response_hash = 'pending', created_at = NOW\(\)/i.test(text)
            && /INTERVAL '24 hours'/i.test(text)) {
          const key = extractParam(query, 0);
          const row = store.get(key);
          if (!row || now() - row.created_at <= 24 * 60 * 60 * 1000) return { rows: [] };
          row.response_hash = 'pending';
          row.created_at = now();
          return { rows: [{ key }] };
        }
        // -- UPDATE lease-steal (created_at = <exact ts>)
        if (/UPDATE idempotency_keys/i.test(text)
            && /SET created_at = NOW\(\)/i.test(text)
            && /response_hash = 'pending'/i.test(text)
            && /AND created_at =/i.test(text)) {
          const key = extractParam(query, 0);
          const claimedTsIso = extractParam(query, 1);
          const claimedTs = new Date(claimedTsIso).getTime();
          const row = store.get(key);
          // Force visibility via require('fs') sync write.
          if (!row) return { rows: [] };
          if (row.response_hash !== 'pending') return { rows: [] };
          // The claim timestamp round-trips through ISO string; a 1ms wobble
          // is possible if Date precision differs. Accept within 5ms.
          if (Math.abs(row.created_at - claimedTs) > 5) return { rows: [] };
          row.created_at = now();
          return { rows: [{ key }] };
        }
        // -- UPDATE finalize success
        if (/UPDATE idempotency_keys/i.test(text) && /SET response_hash = 'sent'/i.test(text)) {
          const key = extractParam(query, 0);
          const row = store.get(key);
          if (row) row.response_hash = 'sent';
          return { rows: [] };
        }
        // -- DELETE finalize failure
        if (/DELETE FROM idempotency_keys/i.test(text) && /WHERE key =/i.test(text)) {
          const key = extractParam(query, 0);
          store.delete(key);
          return { rows: [] };
        }
        throw new Error(`unhandled test SQL: ${text.slice(0, 200)}`);
      }),
    },
  };

  function serialize(q: any): string {
    if (typeof q === 'string') return q;
    const chunks: any[] = q?.queryChunks ?? [];
    return chunks.map(c => c?.constructor?.name === 'StringChunk' ? (c.value?.[0] ?? '') : '?').join('');
  }
  function extractParam(q: any, i: number): any {
    const chunks: any[] = q?.queryChunks ?? [];
    const params: any[] = [];
    for (const c of chunks) {
      if (!c) continue;
      const name = c.constructor?.name;
      if (name === 'StringChunk') continue;
      // Boxed primitives (String / Number / Boolean) → unbox
      if (name === 'String') { params.push(String(c)); continue; }
      if (name === 'Number') { params.push(Number(c)); continue; }
      if (name === 'Boolean') { params.push(Boolean((c as any).valueOf())); continue; }
      // Any drizzle Param-like object with .value
      if (typeof c === 'object' && 'value' in c) { params.push((c as any).value); continue; }
      params.push(c);
    }
    return params[i];
  }
});

// Import AFTER the mock is registered so the module picks up our fake db.
import { claimEventNotification, finalizeEventNotification, dispatchOnce } from '../lib/eventNotificationIdempotency';

beforeEach(() => {
  store.clear();
  dbFail = false;
  now = () => Date.now();
});

describe('T1 — concurrent claim: exactly one worker wins', () => {
  it('two Promise.all claims → one CLAIMED, one IN_FLIGHT', async () => {
    const key = 'notif:booking_cancelled:1:userA';
    const [a, b] = await Promise.all([
      claimEventNotification(key),
      claimEventNotification(key),
    ]);
    const outcomes = [a, b].sort();
    expect(outcomes).toEqual(['CLAIMED', 'IN_FLIGHT']);
  });

  it('five concurrent claims → exactly one CLAIMED', async () => {
    const key = 'notif:booking_cancelled:2:userB';
    const results = await Promise.all(
      Array.from({ length: 5 }, () => claimEventNotification(key)),
    );
    expect(results.filter(r => r === 'CLAIMED').length).toBe(1);
    expect(results.filter(r => r === 'IN_FLIGHT').length).toBe(4);
  });
});

describe('T2 — duplicate event after success is skipped', () => {
  it('replay of a finalized-success key returns ALREADY_SENT', async () => {
    const key = 'notif:booking_confirmed:3:userC';
    const first = await claimEventNotification(key);
    expect(first).toBe('CLAIMED');
    await finalizeEventNotification(key, true);
    const replay = await claimEventNotification(key);
    expect(replay).toBe('ALREADY_SENT');
  });
});

describe('T3 — failed delivery releases the claim so retry proceeds', () => {
  it('finalize(false) DELETES the claim; a redelivered event may re-claim', async () => {
    const key = 'notif:booking_cancelled:4:userD';
    expect(await claimEventNotification(key)).toBe('CLAIMED');
    await finalizeEventNotification(key, false);
    // Redelivered event
    expect(await claimEventNotification(key)).toBe('CLAIMED');
  });

  it('dispatchOnce with sender returning success:false releases the claim', async () => {
    const key = 'notif:booking_cancelled:5:userE';
    const sender = vi.fn().mockResolvedValueOnce({ success: false, errors: ['send failed'] });
    const r1 = await dispatchOnce(key, sender);
    expect(r1.dispatched).toBe(true);
    expect(r1.sendOk).toBe(false);
    // Redelivered event should re-claim + re-invoke sender
    sender.mockResolvedValueOnce({ success: true });
    const r2 = await dispatchOnce(key, sender);
    expect(r2.dispatched).toBe(true);
    expect(r2.sendOk).toBe(true);
    expect(sender).toHaveBeenCalledTimes(2);
    // Third redelivery is now skipped because the success is persisted.
    const r3 = await dispatchOnce(key, sender);
    expect(r3.dispatched).toBe(false);
    expect(r3.outcome).toBe('ALREADY_SENT');
    expect(sender).toHaveBeenCalledTimes(2);
  });

  it('dispatchOnce that throws also releases the claim', async () => {
    const key = 'notif:booking_cancelled:6:userF';
    const boom = vi.fn().mockRejectedValueOnce(new Error('transport crash'));
    await expect(dispatchOnce(key, boom)).rejects.toThrow('transport crash');
    // Redelivered event may re-claim.
    const ok = vi.fn().mockResolvedValueOnce({ success: true });
    const r = await dispatchOnce(key, ok);
    expect(r.dispatched).toBe(true);
    expect(r.sendOk).toBe(true);
  });
});

describe('T4 — success replay is permanently suppressed until TTL', () => {
  it('replay after success:true returns ALREADY_SENT and does NOT invoke sender', async () => {
    const key = 'notif:booking_completed:7:userG';
    const sender = vi.fn().mockResolvedValue({ success: true });
    await dispatchOnce(key, sender);
    const r = await dispatchOnce(key, sender);
    expect(r.dispatched).toBe(false);
    expect(r.outcome).toBe('ALREADY_SENT');
    expect(sender).toHaveBeenCalledTimes(1);
  });
});

describe('T5 — parallel dispatch: only one sender invocation', () => {
  it('Promise.all of 6 dispatchOnce calls on the same key → sender fired exactly once', async () => {
    const key = 'notif:booking_cancelled:8:userH';
    const sender = vi.fn().mockResolvedValue({ success: true });
    const results = await Promise.all(
      Array.from({ length: 6 }, () => dispatchOnce(key, sender)),
    );
    expect(sender).toHaveBeenCalledTimes(1);
    expect(results.filter(r => r.dispatched).length).toBe(1);
    expect(results.filter(r => !r.dispatched && r.outcome === 'IN_FLIGHT').length).toBe(5);
  });
});

describe('T6 — DB failure surfaces DB_ERROR, caller decides policy', () => {
  it('claim() returns DB_ERROR on DB fault', async () => {
    dbFail = true;
    const r = await claimEventNotification('notif:x:9:userI');
    expect(r).toBe('DB_ERROR');
  });

  it('dispatchOnce does NOT invoke sender on DB_ERROR', async () => {
    dbFail = true;
    const sender = vi.fn();
    const r = await dispatchOnce('notif:x:10:userJ', sender);
    expect(sender).not.toHaveBeenCalled();
    expect(r.outcome).toBe('DB_ERROR');
    expect(r.dispatched).toBe(false);
  });
});

describe('lease expiry: a stale pending claim becomes stealable', () => {
  it('another worker can steal an expired lease and dispatch', async () => {
    const key = 'notif:booking_cancelled:11:userK';
    // Helper floors leaseMs at 1000ms as a production safety, so the test
    // must wait past that.
    expect(await claimEventNotification(key, { leaseMs: 1000 })).toBe('CLAIMED');
    await new Promise(r => setTimeout(r, 1100));
    const outcome = await claimEventNotification(key, { leaseMs: 1000 });
    expect(outcome).toBe('CLAIMED');
  });

  it('fresh pending claim is still IN_FLIGHT for a concurrent worker', async () => {
    const key = 'notif:booking_cancelled:12:userL';
    expect(await claimEventNotification(key)).toBe('CLAIMED');
    const r = await claimEventNotification(key);
    expect(r).toBe('IN_FLIGHT');
  });
});
