/**
 * LOGIN RATE LIMITER - Advanced Credential Stuffing Protection
 * 
 * Based on banking-level security principles:
 * - Tracks failed login attempts per email/phone
 * - Blocks users after 5 failed attempts for 5 minutes
 * - Uses LRU cache to prevent memory leaks (max 1000 users)
 * - Prevents credential stuffing and brute force attacks
 * 
 * Inspired by FastAPI best practices, implemented for Express.js
 */

import type { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger';

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

/**
 * Check if login is rate limited for this email/phone
 * 
 * @param identifier - Email address or phone number
 * @returns true if blocked, false if allowed
 */
export function checkLoginRateLimit(identifier: string): { 
  blocked: boolean; 
  remainingTime?: number; 
  attempts?: number 
} {
  const now = Math.floor(Date.now() / 1000);
  const record = loginAttemptCache.get(identifier) || {
    attempts: 0,
    blockedUntil: 0,
    lastAttempt: 0,
  };

  // Check if user is currently blocked
  if (record.blockedUntil > now) {
    const remainingTime = record.blockedUntil - now;
    logger.warn('[Login Rate Limit] User is blocked', {
      identifier: identifier.substring(0, 3) + '***', // Masked for privacy
      remainingTime,
    });
    return {
      blocked: true,
      remainingTime,
      attempts: record.attempts,
    };
  }

  // Check if max attempts exceeded
  if (record.attempts >= MAX_ATTEMPTS) {
    // Block user for 5 minutes
    record.blockedUntil = now + BLOCK_TIME_SECONDS;
    record.attempts = 0; // Reset counter after blocking
    loginAttemptCache.set(identifier, record);
    
    logger.warn('[Login Rate Limit] User exceeded max attempts, now blocked', {
      identifier: identifier.substring(0, 3) + '***',
      blockDuration: BLOCK_TIME_SECONDS,
    });
    
    return {
      blocked: true,
      remainingTime: BLOCK_TIME_SECONDS,
      attempts: MAX_ATTEMPTS,
    };
  }

  return {
    blocked: false,
    attempts: record.attempts,
  };
}

/**
 * Record a failed login attempt
 * 
 * @param identifier - Email address or phone number
 */
export function recordFailedLogin(identifier: string): void {
  const now = Math.floor(Date.now() / 1000);
  const record = loginAttemptCache.get(identifier) || {
    attempts: 0,
    blockedUntil: 0,
    lastAttempt: 0,
  };

  record.attempts += 1;
  record.lastAttempt = now;
  loginAttemptCache.set(identifier, record);

  logger.info('[Login Rate Limit] Failed attempt recorded', {
    identifier: identifier.substring(0, 3) + '***',
    attempts: record.attempts,
    maxAttempts: MAX_ATTEMPTS,
    remainingAttempts: MAX_ATTEMPTS - record.attempts,
  });
}

/**
 * Clear failed login attempts after successful login
 * 
 * @param identifier - Email address or phone number
 */
export function clearLoginAttempts(identifier: string): void {
  if (loginAttemptCache.has(identifier)) {
    loginAttemptCache.delete(identifier);
    logger.info('[Login Rate Limit] Attempts cleared after successful login', {
      identifier: identifier.substring(0, 3) + '***',
    });
  }
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
export function loginRateLimitMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const identifier = req.body?.email || req.body?.phoneNumber || req.body?.phone;

  if (!identifier) {
    // No identifier provided, let it proceed (will fail at validation)
    return next();
  }

  const result = checkLoginRateLimit(identifier);

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
