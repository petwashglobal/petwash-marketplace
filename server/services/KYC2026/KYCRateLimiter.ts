/**
 * KYC 2026 Dedicated Rate Limiter (Postgres-Backed)
 * 
 * Persistent rate limits that survive server restarts:
 * - Document submission: 3 per hour per user, 15 per hour per IP
 * - Face match requests: 5 per hour per user
 * - OTP/MFA verification: 5 per 15 minutes
 * - Admin KYC review: 100 per hour per admin
 * - Liveness challenges: 10 per hour per user
 * 
 * Uses Postgres for counter persistence with sliding window + exponential backoff.
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../../lib/logger';
import { kycAuditTrail } from './KYCAuditTrail';
import { pool } from '../../db';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyExtractor: (req: Request) => string;
  name: string;
}

async function checkRateLimit(bucketName: string, key: string, windowMs: number, maxRequests: number): Promise<{
  allowed: boolean;
  count: number;
  effectiveMax: number;
  violations: number;
  resetAt: Date;
  retryAfterSeconds: number;
}> {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + windowMs);

  try {
    const result = await pool.query(`
      INSERT INTO kyc_rate_limits (bucket_name, rate_key, request_count, violations, window_start, window_end, updated_at)
      VALUES ($1, $2, 1, 0, $3, $4, $3)
      ON CONFLICT (bucket_name, rate_key, window_start) DO UPDATE
        SET request_count = kyc_rate_limits.request_count + 1,
            updated_at = $3
      RETURNING request_count, violations, window_end
    `, [bucketName, key, now, windowEnd]);

    let row = result.rows[0];

    const activeWindow = await pool.query(`
      SELECT SUM(request_count) as total_count, MAX(violations) as max_violations, MAX(window_end) as max_window_end
      FROM kyc_rate_limits
      WHERE bucket_name = $1 AND rate_key = $2 AND window_end > $3
    `, [bucketName, key, now]);

    const totalCount = parseInt(activeWindow.rows[0]?.total_count || '1');
    const violations = parseInt(activeWindow.rows[0]?.max_violations || '0');
    const resetAt = new Date(activeWindow.rows[0]?.max_window_end || windowEnd);

    const backoffMultiplier = Math.pow(2, Math.min(violations, 4));
    const effectiveMax = Math.max(1, Math.floor(maxRequests / backoffMultiplier));

    if (totalCount > effectiveMax) {
      await pool.query(`
        UPDATE kyc_rate_limits
        SET violations = violations + 1, updated_at = $1
        WHERE bucket_name = $2 AND rate_key = $3 AND window_end > $1
      `, [now, bucketName, key]);

      const retryAfterSeconds = Math.ceil((resetAt.getTime() - now.getTime()) / 1000);
      return {
        allowed: false,
        count: totalCount,
        effectiveMax,
        violations: violations + 1,
        resetAt,
        retryAfterSeconds: Math.max(1, retryAfterSeconds),
      };
    }

    return {
      allowed: true,
      count: totalCount,
      effectiveMax,
      violations,
      resetAt,
      retryAfterSeconds: 0,
    };
  } catch (dbErr) {
    logger.error(`[KYC2026:RateLimit] DB error for ${bucketName}/${key}, allowing request`, dbErr);
    return {
      allowed: true,
      count: 0,
      effectiveMax: maxRequests,
      violations: 0,
      resetAt: windowEnd,
      retryAfterSeconds: 0,
    };
  }
}

function getRateLimitMiddleware(config: RateLimitConfig) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const key = config.keyExtractor(req);

    const result = await checkRateLimit(config.name, key, config.windowMs, config.maxRequests);

    res.setHeader('X-RateLimit-Limit', result.effectiveMax.toString());
    res.setHeader('X-RateLimit-Remaining', Math.max(0, result.effectiveMax - result.count).toString());
    res.setHeader('X-RateLimit-Reset', result.resetAt.toISOString());

    if (!result.allowed) {
      res.setHeader('Retry-After', result.retryAfterSeconds.toString());

      logger.warn(`[KYC2026:RateLimit] ${config.name} exceeded by ${key}`, {
        count: result.count,
        max: result.effectiveMax,
        violations: result.violations,
      });

      const userId = (req as any).user?.uid || (req as any).userId || 'unknown';
      kycAuditTrail.record({
        action: 'kyc_blocked',
        actorId: userId,
        actorRole: 'user',
        ipAddress: req.ip || req.socket.remoteAddress || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown',
        metadata: {
          rateLimitName: config.name,
          count: result.count,
          max: result.effectiveMax,
          violations: result.violations,
          storage: 'postgres',
        },
      });

      res.status(429).json({
        error: 'Too many requests',
        message: `KYC ${config.name} rate limit exceeded. Please try again later.`,
        retryAfterSeconds: result.retryAfterSeconds,
      });
      return;
    }

    next();
  };
}

export const kycSubmitLimiter = getRateLimitMiddleware({
  name: 'kyc_submit',
  windowMs: 60 * 60 * 1000,
  maxRequests: 3,
  keyExtractor: (req) => {
    const userId = (req as any).user?.uid || (req as any).userId;
    return userId || req.ip || 'anonymous';
  },
});

export const kycSubmitIPLimiter = getRateLimitMiddleware({
  name: 'kyc_submit_ip',
  windowMs: 60 * 60 * 1000,
  maxRequests: 15,
  keyExtractor: (req) => req.ip || req.socket.remoteAddress || 'unknown',
});

export const kycFaceMatchLimiter = getRateLimitMiddleware({
  name: 'kyc_face_match',
  windowMs: 60 * 60 * 1000,
  maxRequests: 5,
  keyExtractor: (req) => {
    const userId = (req as any).user?.uid || (req as any).userId;
    return userId || req.ip || 'anonymous';
  },
});

export const kycMFALimiter = getRateLimitMiddleware({
  name: 'kyc_mfa',
  windowMs: 15 * 60 * 1000,
  maxRequests: 5,
  keyExtractor: (req) => {
    const userId = (req as any).user?.uid || (req as any).userId;
    return userId || req.ip || 'anonymous';
  },
});

export const kycAdminReviewLimiter = getRateLimitMiddleware({
  name: 'kyc_admin_review',
  windowMs: 60 * 60 * 1000,
  maxRequests: 100,
  keyExtractor: (req) => {
    const userId = (req as any).user?.uid || (req as any).userId;
    return `admin:${userId || 'unknown'}`;
  },
});

export const kycLivenessLimiter = getRateLimitMiddleware({
  name: 'kyc_liveness',
  windowMs: 60 * 60 * 1000,
  maxRequests: 10,
  keyExtractor: (req) => {
    const userId = (req as any).user?.uid || (req as any).userId;
    return userId || req.ip || 'anonymous';
  },
});

export async function cleanupExpiredRateLimits(): Promise<number> {
  try {
    const result = await pool.query(`
      DELETE FROM kyc_rate_limits WHERE window_end < NOW() - INTERVAL '1 hour'
    `);
    const deleted = result.rowCount || 0;
    if (deleted > 0) {
      logger.info(`[KYC2026:RateLimit] Cleaned up ${deleted} expired rate limit entries`);
    }
    return deleted;
  } catch (err) {
    logger.error('[KYC2026:RateLimit] Cleanup error', err);
    return 0;
  }
}

setInterval(() => cleanupExpiredRateLimits(), 15 * 60 * 1000);
