import rateLimit from 'express-rate-limit';
import type { Request, Response } from 'express';
import { logger } from '../lib/logger';

// Helper to get client IP safely (IPv6-compatible)
function getClientIP(req: Request): string {
  return (
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    (req.headers['x-real-ip'] as string) ||
    req.ip ||
    req.connection?.remoteAddress ||
    'unknown'
  );
}

// General API rate limiter - Environment-aware rate limiting
// Development: 1000 req/15min (allows Vite hot reload and asset loading)
// Production: 200 req/15min (balanced protection)
const isDevelopment = process.env.NODE_ENV !== 'production';
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDevelopment ? 1000 : 200, // High for dev, moderate for production
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  handler: (req: Request, res: Response) => {
    const retryAfter = Math.ceil(Date.now() / 1000) + 900; // 15 min from now
    res.status(429).json({
      error: 'Too many requests',
      message: 'You have exceeded the rate limit. Please try again later.',
      retryAfter
    });
  }
});

// Payment endpoint limiter - 5 requests per 15 minutes PER EMAIL
// Uses email from request body (no authentication required for checkout)
export const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: 'Too many payment attempts, please try again later.',
  skipSuccessfulRequests: false,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    // Use email from request body as key (payment requests include customerEmail)
    const email = req.body?.customerEmail;
    if (email && typeof email === 'string') {
      return `payment:${email}`;
    }
    // If no email, use session-based limiting (this should not happen in normal flow)
    return 'payment:anonymous';
  },
  handler: (req: Request, res: Response) => {
    const retryAfter = Math.ceil(Date.now() / 1000) + 900; // 15 min from now
    res.status(429).json({
      error: 'Payment rate limit exceeded',
      message: 'Too many payment attempts. Please wait before trying again.',
      retryAfter
    });
  }
});

// Admin endpoint limiter - more lenient for admin users (IP-based, IPv6-safe)
export const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // 200 requests per window (admins need more access)
  message: 'Admin rate limit exceeded.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    const retryAfter = Math.ceil(Date.now() / 1000) + 900; // 15 min from now
    res.status(429).json({
      error: 'Admin rate limit exceeded',
      message: 'Too many admin operations. Please wait before trying again.',
      retryAfter
    });
  }
});

// File upload limiter - 20 uploads per hour PER USER
// Uses Firebase UID from authenticated request
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 uploads per hour
  message: 'Too many file uploads, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    // KYC upload requires Firebase authentication - use UID
    const user = (req as any).user;
    if (user?.uid) {
      return `upload:${user.uid}`;
    }
    // Fallback for unauthenticated (should not happen for KYC)
    return 'upload:anonymous';
  },
  handler: (req: Request, res: Response) => {
    const retryAfter = Math.ceil(Date.now() / 1000) + 3600; // 1 hour from now
    res.status(429).json({
      error: 'Upload rate limit exceeded',
      message: 'Too many file uploads. Please wait before uploading more files.',
      retryAfter
    });
  }
});

// WebAuthn endpoint limiter - 60 requests per minute per IP+UID
// Protects passkey registration and authentication from brute force attacks
export const webauthnLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute
  message: 'Too many passkey attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    // Combine IP + uid for user-specific limiting (IPv6-safe)
    const uid = (req as any).firebaseUser?.uid || (req as any).user?.uid || 'anonymous';
    const ip = getClientIP(req);
    return `webauthn:${ip}:${uid}`;
  },
  handler: (req: Request, res: Response) => {
    const retryAfter = Math.ceil(Date.now() / 1000) + 60; // 1 min from now
    res.status(429).json({
      error: 'WebAuthn rate limit exceeded',
      message: 'Too many passkey attempts. Please wait a moment before trying again.',
      retryAfter
    });
  }
});

// Authentication endpoint limiter - 10 requests per minute per IP
// Protects login, register, and post-login endpoints from brute force
export const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute
  message: 'Too many authentication attempts',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    // Use IP-based limiting (IPv6-safe)
    const ip = getClientIP(req);
    return `auth:${ip}`;
  },
  handler: (req: Request, res: Response) => {
    const retryAfter = Math.ceil(Date.now() / 1000) + 60; // 1 min from now
    res.status(429).json({
      error: 'Auth rate limit exceeded',
      message: 'Too many authentication attempts. Please wait before trying again.',
      retryAfter
    });
  }
});

// KYC submission endpoint limiter - 5 requests per hour per user UID
// Protects KYC submission endpoints from spam
export const kycLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 requests per hour
  message: 'Too many KYC submissions',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    // Use UID-based limiting like uploadLimiter
    const user = (req as any).user;
    if (user?.uid) {
      return `kyc:${user.uid}`;
    }
    // Fallback for unauthenticated (should not happen for KYC)
    return 'kyc:anonymous';
  },
  handler: (req: Request, res: Response) => {
    const retryAfter = Math.ceil(Date.now() / 1000) + 3600; // 1 hour from now
    res.status(429).json({
      error: 'KYC rate limit exceeded',
      message: 'Too many KYC submissions. Please wait before submitting again.',
      retryAfter
    });
  }
});

// Booking creation endpoint limiter - 20 requests per 15 minutes per user
// Protects booking creation endpoints from spam
export const bookingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 requests per window
  message: 'Too many booking requests',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    // Use UID-based limiting
    const user = (req as any).user;
    if (user?.uid) {
      return `booking:${user.uid}`;
    }
    // Fallback for unauthenticated
    return 'booking:anonymous';
  },
  handler: (req: Request, res: Response) => {
    const retryAfter = Math.ceil(Date.now() / 1000) + 900; // 15 min from now
    res.status(429).json({
      error: 'Booking rate limit exceeded',
      message: 'Too many booking requests. Please wait before creating more bookings.',
      retryAfter
    });
  }
});

// Dispatch/job endpoint limiter - 30 requests per 15 minutes per user
// Protects dispatch and job-related endpoints from spam
export const dispatchLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 requests per window
  message: 'Too many dispatch requests',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    // Use UID-based limiting
    const user = (req as any).user;
    if (user?.uid) {
      return `dispatch:${user.uid}`;
    }
    // Fallback for unauthenticated
    return 'dispatch:anonymous';
  },
  handler: (req: Request, res: Response) => {
    const retryAfter = Math.ceil(Date.now() / 1000) + 900; // 15 min from now
    res.status(429).json({
      error: 'Dispatch rate limit exceeded',
      message: 'Too many dispatch requests. Please wait before making more requests.',
      retryAfter
    });
  }
});

// OTP/verification code endpoint limiter - 3 requests per 5 minutes per IP
// Protects OTP and verification endpoints from brute force
export const otpLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 3, // 3 requests per window
  message: 'Too many verification code requests',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    // Use IP-based limiting (IPv6-safe)
    const ip = getClientIP(req);
    return `otp:${ip}`;
  },
  handler: (req: Request, res: Response) => {
    const retryAfter = Math.ceil(Date.now() / 1000) + 300; // 5 min from now
    res.status(429).json({
      error: 'OTP rate limit exceeded',
      message: 'Too many verification code requests. Please wait before requesting again.',
      retryAfter
    });
  }
});

logger.info('Rate limiters initialized');
logger.info('Rate limits:');
logger.info(`   - General API: ${isDevelopment ? '1000' : '200'} req/15min per IP (${isDevelopment ? 'dev mode' : 'production'})`);
logger.info('   - Admin: 200 req/15min per IP');
logger.info('   - Payments: 5 req/15min per email');
logger.info('   - Uploads: 20 req/hour per user UID');
logger.info('   - WebAuthn: 60 req/min per IP+UID (passkey security)');
logger.info('   - Auth: 10 req/min per IP (login/register protection)');
logger.info('   - KYC: 5 req/hour per user UID');
logger.info('   - Booking: 20 req/15min per user UID');
logger.info('   - Dispatch: 30 req/15min per user UID');
logger.info('   - OTP: 3 req/5min per IP (verification code protection)');
