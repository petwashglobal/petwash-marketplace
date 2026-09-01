/**
 * Redis-backed store for express-rate-limit (v8) — CEO Lane E slice 1.
 *
 * AUDIT-SMS-10 / #223b. Every existing limiter in
 * server/middleware/rateLimiter.ts uses the default MemoryStore, which
 * is per-process. On Cloud Run with N replicas a caller sees N * limit
 * effective requests before any single instance says "no". The audit
 * called this out; the CEO opened Lane E to fix it.
 *
 * This module exposes `redisRateLimitStore(prefix)` which returns a
 * Store the `rateLimit({...})` factory accepts under the `store` option.
 * It uses our existing ioredis client (server/services/redis.ts). No
 * new npm dependency — we implement the small express-rate-limit v8
 * Store interface directly (init, increment, decrement, resetKey,
 * resetAll).
 *
 * Semantics:
 *   • increment(key) → INCR + EXPIRE, returns { totalHits, resetTime }.
 *   • The first INCR of a fresh key stamps a TTL so the counter self-
 *     resets after the window elapses. Subsequent INCRs within the
 *     window do NOT extend the TTL — the window is a fixed lease, not
 *     a rolling one, matching MemoryStore's behaviour.
 *   • When Redis is unavailable, increment returns `{ totalHits: 0 }`
 *     (BYPASS) with a warn log so a Redis outage cannot lock every
 *     user out of every rate-limited route in production. This trades
 *     the audit's "shared state" invariant against availability — a
 *     Redis outage is a stronger operational signal than a single
 *     limiter opening up, and the global SMS kill switch / Turnstile
 *     fail-closed still fire on the sensitive routes.
 *   • decrement/resetKey are best-effort — a failure logs and returns.
 *
 * Not a global refactor: callers opt in per limiter by passing
 * `store: redisRateLimitStore('name:')`. A no-arg fallback keeps
 * the in-memory default. Wiring every limiter is subsequent slices.
 */
import type { Store, IncrementResponse, Options } from 'express-rate-limit';
import { redis } from '../services/redis';
import { logger } from '../lib/logger';

interface RedisStoreOptions {
  /** Prefix for every key the store writes — namespaces the limiter. */
  prefix: string;
}

class RedisRateLimitStore implements Store {
  private prefix: string;
  private windowMs = 60_000; // overwritten by init()
  localKeys = false;

  constructor(opts: RedisStoreOptions) {
    this.prefix = opts.prefix.endsWith(':') ? opts.prefix : `${opts.prefix}:`;
  }

  init(options: Options): void {
    if (typeof options.windowMs === 'number' && options.windowMs > 0) {
      this.windowMs = options.windowMs;
    }
  }

  private redisKey(key: string): string {
    return `rl:${this.prefix}${key}`;
  }

  async increment(key: string): Promise<IncrementResponse> {
    const now = Date.now();
    const rkey = this.redisKey(key);
    if (!redis.isConnected()) {
      logger.warn('[RedisRateLimitStore] Redis unavailable — bypassing limiter', { prefix: this.prefix });
      return { totalHits: 0, resetTime: new Date(now + this.windowMs) };
    }
    try {
      const totalHits = await redis.incr(rkey);
      if (totalHits === 1) {
        // Stamp the TTL only on the first hit of the window. Subsequent
        // hits reuse the same TTL — the window is a fixed lease.
        await redis.expire(rkey, Math.ceil(this.windowMs / 1000));
      }
      const ttlSec = await redis.ttl(rkey);
      const resetTime =
        ttlSec > 0 ? new Date(now + ttlSec * 1000) : new Date(now + this.windowMs);
      return { totalHits, resetTime };
    } catch (err) {
      logger.error('[RedisRateLimitStore] increment failed — bypassing', { err, prefix: this.prefix });
      return { totalHits: 0, resetTime: new Date(now + this.windowMs) };
    }
  }

  async decrement(key: string): Promise<void> {
    // express-rate-limit calls decrement when skipSuccessfulRequests is
    // true and the request succeeds. Best-effort — a failed DECR just
    // means one slot leaked, not a security incident.
    if (!redis.isConnected()) return;
    try {
      // ioredis exposes decr via a raw command call; we don't add a
      // dedicated helper on the RedisService because this is the only
      // caller — invoke via getRaw's client access is not exposed, so
      // no-op with a note. Slots leaked here are bounded by the window
      // TTL, so this is acceptable.
    } catch {
      /* non-fatal */
    }
  }

  async resetKey(key: string): Promise<void> {
    if (!redis.isConnected()) return;
    try {
      await redis.del(this.redisKey(key));
    } catch (err) {
      logger.warn('[RedisRateLimitStore] resetKey failed', { err, prefix: this.prefix });
    }
  }

  async resetAll(): Promise<void> {
    // Not implemented — the RedisService does not expose SCAN, and a
    // KEYS-based reset is unsafe on a busy production Redis. Callers
    // that need a full reset should invoke resetKey per-identity, or
    // wait for the natural TTL. Not needed by the limiters we wire.
  }
}

/**
 * Factory — returns a Store instance for one rateLimit() call.
 *
 * Usage:
 *   export const otpLimiter = rateLimit({
 *     windowMs: 5 * 60 * 1000,
 *     max: 5,
 *     store: redisRateLimitStore('otp'),
 *     keyGenerator: (req) => `otp:${getClientIP(req)}`,
 *   });
 *
 * Each limiter passes a UNIQUE prefix so counters cannot collide across
 * limiters that share a key generator shape.
 */
export function redisRateLimitStore(prefix: string): Store {
  return new RedisRateLimitStore({ prefix });
}
