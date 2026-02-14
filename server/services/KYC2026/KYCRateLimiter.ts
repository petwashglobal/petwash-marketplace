/**
 * KYC 2026 Dedicated Rate Limiter
 * 
 * Endpoint-specific rate limits for KYC operations:
 * - Document submission: 3 per hour per user, 15 per hour per IP
 * - Face match requests: 5 per hour per user
 * - OTP/MFA verification: 5 per 15 minutes
 * - Admin KYC review: 100 per hour per admin
 * - Liveness challenges: 10 per hour per user
 * 
 * Implements sliding window with exponential backoff on repeat violations.
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../../lib/logger';
import { kycAuditTrail } from './KYCAuditTrail';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyExtractor: (req: Request) => string;
  name: string;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
  violations: number;
}

const buckets = new Map<string, Map<string, RateLimitEntry>>();

function getRateLimitMiddleware(config: RateLimitConfig) {
  const bucketName = config.name;
  if (!buckets.has(bucketName)) {
    buckets.set(bucketName, new Map());
  }
  const bucket = buckets.get(bucketName)!;

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = config.keyExtractor(req);
    const now = Date.now();

    let entry = bucket.get(key);

    if (!entry || now > entry.resetAt) {
      entry = {
        count: 0,
        resetAt: now + config.windowMs,
        violations: entry?.violations || 0,
      };
      bucket.set(key, entry);
    }

    entry.count++;

    const backoffMultiplier = Math.pow(2, Math.min(entry.violations, 4));
    const effectiveMax = Math.max(1, Math.floor(config.maxRequests / backoffMultiplier));

    res.setHeader('X-RateLimit-Limit', effectiveMax.toString());
    res.setHeader('X-RateLimit-Remaining', Math.max(0, effectiveMax - entry.count).toString());
    res.setHeader('X-RateLimit-Reset', new Date(entry.resetAt).toISOString());

    if (entry.count > effectiveMax) {
      entry.violations++;

      const retryAfterSeconds = Math.ceil((entry.resetAt - now) / 1000);
      res.setHeader('Retry-After', retryAfterSeconds.toString());

      logger.warn(`[KYC2026:RateLimit] ${config.name} exceeded by ${key}`, {
        count: entry.count,
        max: effectiveMax,
        violations: entry.violations,
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
          count: entry.count,
          max: effectiveMax,
          violations: entry.violations,
        },
      });

      res.status(429).json({
        error: 'Too many requests',
        message: `KYC ${config.name} rate limit exceeded. Please try again later.`,
        retryAfterSeconds,
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

setInterval(() => {
  const now = Date.now();
  for (const [, bucket] of buckets) {
    for (const [key, entry] of bucket) {
      if (now > entry.resetAt + 60000) {
        bucket.delete(key);
      }
    }
  }
}, 10 * 60 * 1000);
