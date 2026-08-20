/**
 * Behavioral test — login rate limiter must use Redis when available so
 * MAX_ATTEMPTS holds ACROSS Cloud Run instances, not per-container.
 *
 * Evil-hunt 2026-08-20: the previous LRUCache was in-memory per instance.
 * An attacker hitting instance A five times was blocked on A but got free
 * attempts on B/C/D... — with N containers, effectively N × MAX_ATTEMPTS.
 * Now Redis is authoritative (atomic INCR + EXPIRE), LRU only in fallback
 * mode when Redis is offline.
 *
 * We simulate two "instances" by importing the middleware TWICE with
 * cache-busting query params, sharing the same mocked Redis backend.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Mock Redis: shared in-memory KV that both "instances" see ────────────
const redisStore = new Map<string, { value: string; expiresAt: number | null }>();
let redisConnected = true;

function now(): number { return Math.floor(Date.now() / 1000); }
function isLive(entry: { expiresAt: number | null }): boolean {
  return entry.expiresAt === null || entry.expiresAt > now();
}

const mockRedis = {
  isConnected: () => redisConnected,
  async getRaw(k: string): Promise<string | null> {
    const e = redisStore.get(k);
    if (!e || !isLive(e)) { redisStore.delete(k); return null; }
    return e.value;
  },
  async setRaw(k: string, v: string, ttl?: number): Promise<boolean> {
    redisStore.set(k, { value: v, expiresAt: ttl ? now() + ttl : null });
    return true;
  },
  async incr(k: string): Promise<number> {
    const cur = await this.getRaw(k);
    const n = (cur ? parseInt(cur, 10) : 0) + 1;
    const e = redisStore.get(k);
    redisStore.set(k, { value: String(n), expiresAt: e?.expiresAt ?? null });
    return n;
  },
  async expire(k: string, ttl: number): Promise<boolean> {
    const e = redisStore.get(k);
    if (!e) return false;
    redisStore.set(k, { value: e.value, expiresAt: now() + ttl });
    return true;
  },
  async ttl(k: string): Promise<number> {
    const e = redisStore.get(k);
    if (!e) return -2;
    if (e.expiresAt === null) return -1;
    return Math.max(0, e.expiresAt - now());
  },
  async del(k: string | string[]): Promise<boolean> {
    const keys = Array.isArray(k) ? k : [k];
    for (const key of keys) redisStore.delete(key);
    return true;
  },
};

vi.mock('../../server/services/redis', () => ({ redis: mockRedis }));
vi.mock('../../server/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Import AFTER mocks are set.
async function importLimiter() {
  vi.resetModules();
  return await import('../../server/middleware/loginRateLimiter');
}

describe('login rate limiter — cross-instance state via Redis', () => {
  beforeEach(() => {
    redisStore.clear();
    redisConnected = true;
    vi.clearAllMocks();
  });

  it('5 failed attempts across TWO instances blocks the 6th (Redis-shared)', async () => {
    // "Instance A"
    const A = await importLimiter();
    // "Instance B" — fresh module import simulates a second container
    const B = await importLimiter();
    // Note: because they share the mocked redis singleton, they share state.

    const id = 'attacker@example.com';

    // First 3 attempts on Instance A
    for (let i = 0; i < 3; i++) await A.recordFailedLogin(id);
    // Next 2 attempts on Instance B (per-instance LRU would let this pass;
    // Redis-backed must remember the previous 3)
    for (let i = 0; i < 2; i++) await B.recordFailedLogin(id);

    // Now check on Instance B — must be blocked because attempts count
    // reached MAX_ATTEMPTS (5) across the two containers.
    const check = await B.checkLoginRateLimit(id);
    expect(check.blocked).toBe(true);
    expect(check.remainingTime).toBeGreaterThan(0);
  });

  it('clearLoginAttempts wipes state from Redis (both keys)', async () => {
    const A = await importLimiter();
    const id = 'user@example.com';

    // Reach the block threshold
    for (let i = 0; i < 5; i++) await A.recordFailedLogin(id);
    expect((await A.checkLoginRateLimit(id)).blocked).toBe(true);

    await A.clearLoginAttempts(id);
    const check = await A.checkLoginRateLimit(id);
    expect(check.blocked).toBe(false);
    expect(check.attempts).toBe(0);
  });

  it('falls back to LRU when Redis is offline (fail-open, still bounded)', async () => {
    redisConnected = false;
    const A = await importLimiter();
    const id = 'offline@example.com';

    // 5 attempts on the same instance — LRU still enforces
    for (let i = 0; i < 5; i++) await A.recordFailedLogin(id);
    const check = await A.checkLoginRateLimit(id);
    expect(check.blocked).toBe(true);
  });

  it('middleware is async and returns 429 when blocked', async () => {
    const A = await importLimiter();
    const id = 'blocked@example.com';
    for (let i = 0; i < 5; i++) await A.recordFailedLogin(id);

    let statusCode = 0;
    let body: any = null;
    const req: any = { body: { email: id } };
    const res: any = {
      status(c: number) { statusCode = c; return this; },
      json(b: any) { body = b; return this; },
    };
    let nextCalled = false;
    const next: any = () => { nextCalled = true; };

    await A.loginRateLimitMiddleware(req, res, next);
    expect(statusCode).toBe(429);
    expect(body).toMatchObject({ ok: false, error: expect.stringContaining('failed login') });
    expect(nextCalled).toBe(false);
  });

  it('middleware forwards when unblocked and attaches loginRateLimit to req', async () => {
    const A = await importLimiter();
    const req: any = { body: { email: 'fresh@example.com' } };
    const res: any = { status: vi.fn(), json: vi.fn() };
    let nextCalled = false;
    const next: any = () => { nextCalled = true; };

    await A.loginRateLimitMiddleware(req, res, next);
    expect(nextCalled).toBe(true);
    expect(req.loginRateLimit).toMatchObject({ blocked: false });
  });
});
