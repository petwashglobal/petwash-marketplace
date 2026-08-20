/**
 * LOGIN RATE LIMITER - Advanced Credential Stuffing Protection
 *
 * Based on banking-level security principles:
 * - Tracks failed login attempts per email/phone
 * - Blocks users after 5 failed attempts for 5 minutes
 * - Redis-backed state so the limit HOLDS across Cloud Run instances
 *   (previously an in-memory LRU per-instance let an attacker get
 *    N × 5 attempts before being blocked — trivially bypassed at scale)
 * - Falls back to the local LRU only when Redis is offline (fail-open
 *   is preferable to DoS'ing our own login page during a Redis outage)
 * - LRU still bounds memory in the fallback path
 *
 * Evil-hunt 2026-08-20: multi-instance bypass. Prior state was
 * per-container-only, so `MAX_ATTEMPTS` was effectively unbounded in
 * production. Now the primary counter lives in Redis, atomic INCR +
 * EXPIRE; the LRU is a degraded-mode backup.
 */

import type { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger';
import { redis } from '../services/redis';

// LRU Cache implementation (Least Recently Used)
class LRUCache<K, V> {
  private cache: Map<K, V>;
  private maxSize: number;

  constructor(maxSize: number) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      // Move to end (most recently used)
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  set(key: K, value: V): void {
    // Remove if exists
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
    // Add to end
    this.cache.set(key, value);
    
    // Evict oldest if over max size
    if (this.cache.size > this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
  }

  delete(key: K): void {
    this.cache.delete(key);
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }
}

interface LoginAttemptRecord {
  attempts: number;
  blockedUntil: number; // Unix timestamp in seconds
  lastAttempt: number;
}

// Cache to store failed login attempts (Max 1000 users to prevent memory leaks)
const loginAttemptCache = new LRUCache<string, LoginAttemptRecord>(1000);

// Configuration
const MAX_ATTEMPTS = 5;
const BLOCK_TIME_SECONDS = 300; // 5 minutes
const ATTEMPT_WINDOW_SECONDS = 300; // count only recent 5 min

const kAttempts = (id: string) => `rl:login:attempts:${id}`;
const kBlocked = (id: string) => `rl:login:blocked:${id}`;

function maskId(id: string): string {
  return id.length > 3 ? id.substring(0, 3) + '***' : '***';
}

/**
 * Check if login is rate limited for this email/phone.
 * Redis-first (shared across Cloud Run instances); LRU-fallback when Redis
 * is unavailable so login itself doesn't hard-fail on cache outage.
 *
 * NOTE: previously synchronous. Now async so the multi-instance Redis path
 * can actually be honoured. Every caller runs inside an async handler.
 */
export async function checkLoginRateLimit(identifier: string): Promise<{
  blocked: boolean;
  remainingTime?: number;
  attempts?: number;
}> {
  const now = Math.floor(Date.now() / 1000);

  // ── Redis (authoritative when reachable) ────────────────────────────
  if (redis.isConnected()) {
    try {
      const blockedRaw = await redis.getRaw(kBlocked(identifier));
      if (blockedRaw) {
        const ttl = await redis.ttl(kBlocked(identifier));
        return {
          blocked: true,
          remainingTime: ttl > 0 ? ttl : BLOCK_TIME_SECONDS,
          attempts: MAX_ATTEMPTS,
        };
      }
      const attemptsRaw = await redis.getRaw(kAttempts(identifier));
      const attempts = attemptsRaw ? parseInt(attemptsRaw, 10) || 0 : 0;
      return { blocked: false, attempts };
    } catch (err) {
      logger.warn('[Login Rate Limit] Redis check failed — falling back to LRU', { err: (err as Error)?.message });
    }
  }

  // ── LRU fallback (degraded mode) ────────────────────────────────────
  const record = loginAttemptCache.get(identifier) || {
    attempts: 0,
    blockedUntil: 0,
    lastAttempt: 0,
  };
  if (record.blockedUntil > now) {
    return {
      blocked: true,
      remainingTime: record.blockedUntil - now,
      attempts: record.attempts,
    };
  }
  if (record.attempts >= MAX_ATTEMPTS) {
    record.blockedUntil = now + BLOCK_TIME_SECONDS;
    record.attempts = 0;
    loginAttemptCache.set(identifier, record);
    return { blocked: true, remainingTime: BLOCK_TIME_SECONDS, attempts: MAX_ATTEMPTS };
  }
  return { blocked: false, attempts: record.attempts };
}

/**
 * Record a failed login attempt. Redis-first (atomic INCR + EXPIRE on first
 * increment, then SET blocked when the counter reaches MAX). LRU fallback.
 */
export async function recordFailedLogin(identifier: string): Promise<void> {
  if (redis.isConnected()) {
    try {
      const attempts = await redis.incr(kAttempts(identifier));
      if (attempts === 1) {
        // Set expiry only on first increment so a burst doesn't extend the window.
        await redis.expire(kAttempts(identifier), ATTEMPT_WINDOW_SECONDS);
      }
      if (attempts >= MAX_ATTEMPTS) {
        await redis.setRaw(kBlocked(identifier), '1', BLOCK_TIME_SECONDS);
        await redis.del(kAttempts(identifier));
        logger.warn('[Login Rate Limit] Blocked (redis)', {
          identifier: maskId(identifier),
          blockDuration: BLOCK_TIME_SECONDS,
        });
      } else {
        logger.info('[Login Rate Limit] Failed attempt recorded (redis)', {
          identifier: maskId(identifier),
          attempts,
          remainingAttempts: MAX_ATTEMPTS - attempts,
        });
      }
      return;
    } catch (err) {
      logger.warn('[Login Rate Limit] Redis record failed — LRU fallback', { err: (err as Error)?.message });
    }
  }

  // LRU fallback
  const now = Math.floor(Date.now() / 1000);
  const record = loginAttemptCache.get(identifier) || {
    attempts: 0,
    blockedUntil: 0,
    lastAttempt: 0,
  };
  record.attempts += 1;
  record.lastAttempt = now;
  loginAttemptCache.set(identifier, record);
  logger.info('[Login Rate Limit] Failed attempt recorded (LRU)', {
    identifier: maskId(identifier),
    attempts: record.attempts,
    remainingAttempts: MAX_ATTEMPTS - record.attempts,
  });
}

/**
 * Clear failed login attempts after successful login. Redis + LRU both.
 */
export async function clearLoginAttempts(identifier: string): Promise<void> {
  if (redis.isConnected()) {
    try {
      await redis.del([kAttempts(identifier), kBlocked(identifier)]);
    } catch (err) {
      logger.warn('[Login Rate Limit] Redis clear failed', { err: (err as Error)?.message });
    }
  }
  if (loginAttemptCache.has(identifier)) {
    loginAttemptCache.delete(identifier);
  }
  logger.info('[Login Rate Limit] Attempts cleared after successful login', {
    identifier: maskId(identifier),
  });
}

/**
 * Express middleware to enforce login rate limiting
 * 
 * Usage:
 * ```
 * app.post('/api/login', loginRateLimitMiddleware, async (req, res) => {
 *   // ... your login logic
 * });
 * ```
 */
export async function loginRateLimitMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const identifier = req.body?.email || req.body?.phoneNumber || req.body?.phone;

  if (!identifier) {
    // No identifier provided, let it proceed (will fail at validation)
    return next();
  }

  const result = await checkLoginRateLimit(identifier);

  if (result.blocked) {
    const retryAfter = result.remainingTime || 0;
    res.status(429).json({
      ok: false,
      error: 'Too many failed login attempts',
      message: `Account temporarily locked due to excessive failed attempts. Try again in ${retryAfter} seconds.`,
      retryAfter,
      attemptsRemaining: 0,
    });
    return;
  }

  // Attach rate limit info to request for use in login handler
  (req as any).loginRateLimit = result;

  next();
}

logger.info('[Login Rate Limiter] Initialized');
logger.info(`   - Max attempts: ${MAX_ATTEMPTS}`);
logger.info(`   - Block duration: ${BLOCK_TIME_SECONDS} seconds`);
logger.info(`   - Cache size: 1000 users (LRU)`);

export { recordFailedLogin as recordLoginFailure, clearLoginAttempts as clearLoginFailures };
