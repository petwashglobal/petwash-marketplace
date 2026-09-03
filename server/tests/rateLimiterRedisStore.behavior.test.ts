/**
 * Behavioural test — redisRateLimitStore (AUDIT-SMS-10 / Lane E slice 1).
 *
 * Proves the express-rate-limit Store adapter:
 *
 *   1. INCRs on the first hit and stamps a TTL matching windowMs.
 *   2. Subsequent hits within the window bump totalHits but NOT the TTL
 *      (windows are fixed leases, matching MemoryStore semantics).
 *   3. Keys are namespaced by the prefix + a `rl:` root so counters from
 *      different limiters cannot collide.
 *   4. When Redis is unavailable the store BYPASSES (totalHits: 0) with a
 *      warn log — a Redis outage must not lock every rate-limited route
 *      out of production (the sensitive routes have their own fail-CLOSED
 *      gates elsewhere: Turnstile, aiUserBudget, perUidSmsBudget).
 *   5. resetKey deletes the counter.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, number>();
const ttls = new Map<string, number>();
let connected = true;

vi.mock('../services/redis', () => ({
  redis: {
    isConnected: () => connected,
    incr: vi.fn(async (key: string) => {
      const n = (store.get(key) ?? 0) + 1;
      store.set(key, n);
      return n;
    }),
    expire: vi.fn(async (key: string, seconds: number) => {
      ttls.set(key, seconds);
      return true;
    }),
    ttl: vi.fn(async (key: string) => ttls.get(key) ?? -2),
    del: vi.fn(async (key: string | string[]) => {
      const keys = Array.isArray(key) ? key : [key];
      for (const k of keys) {
        store.delete(k);
        ttls.delete(k);
      }
      return true;
    }),
  },
}));

import { redisRateLimitStore } from '../middleware/rateLimiterRedisStore';

beforeEach(() => {
  store.clear();
  ttls.clear();
  connected = true;
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('redisRateLimitStore (AUDIT-SMS-10)', () => {
  it('INCR on first hit stamps a TTL matching windowMs', async () => {
    const s = redisRateLimitStore('otp');
    s.init({ windowMs: 300_000 } as any);
    const res = await s.increment('user-A');
    expect(res.totalHits).toBe(1);
    // TTL in seconds, from a 300000ms window → 300s.
    expect(ttls.get('rl:otp:user-A')).toBe(300);
    // resetTime must be a Date roughly 300s from now.
    const now = Date.now();
    const dt = (res.resetTime as Date).getTime() - now;
    expect(dt).toBeGreaterThan(200_000);
    expect(dt).toBeLessThan(400_000);
  });

  it('bumps totalHits within the window without extending the TTL', async () => {
    const s = redisRateLimitStore('otp');
    s.init({ windowMs: 60_000 } as any);
    await s.increment('user-A');
    ttls.set('rl:otp:user-A', 45); // simulate 15s elapsed of a 60s window
    const second = await s.increment('user-A');
    expect(second.totalHits).toBe(2);
    // TTL is NOT re-stamped — still 45s remaining.
    expect(ttls.get('rl:otp:user-A')).toBe(45);
  });

  it('namespaces keys per prefix — collisions impossible across limiters', async () => {
    const otp = redisRateLimitStore('otp');
    const api = redisRateLimitStore('api');
    otp.init({ windowMs: 60_000 } as any);
    api.init({ windowMs: 60_000 } as any);
    await otp.increment('user-A');
    await otp.increment('user-A');
    const apiRes = await api.increment('user-A');
    // Api limiter sees a FRESH counter — the otp limiter's writes are on
    // rl:otp:user-A, not rl:api:user-A.
    expect(apiRes.totalHits).toBe(1);
    expect(store.get('rl:otp:user-A')).toBe(2);
    expect(store.get('rl:api:user-A')).toBe(1);
  });

  it('Redis outage → BYPASS (totalHits 0) — never locks legit users out on infra failure', async () => {
    connected = false;
    const s = redisRateLimitStore('otp');
    s.init({ windowMs: 60_000 } as any);
    const res = await s.increment('user-A');
    expect(res.totalHits).toBe(0);
    // resetTime still set so the limiter can compute a retry-after; it
    // just never fires because 0 < max.
    expect(res.resetTime).toBeInstanceOf(Date);
  });

  it('resetKey removes the counter', async () => {
    const s = redisRateLimitStore('otp');
    s.init({ windowMs: 60_000 } as any);
    await s.increment('user-A');
    expect(store.has('rl:otp:user-A')).toBe(true);
    await s.resetKey('user-A');
    expect(store.has('rl:otp:user-A')).toBe(false);
  });
});
