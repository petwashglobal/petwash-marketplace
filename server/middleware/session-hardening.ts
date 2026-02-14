import { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger';

const MAX_ADMIN_SESSION_AGE = 14400;
const MAX_USER_SESSION_AGE = 432000;
const STEP_UP_MFA_THRESHOLD = 7200;

const suspiciousIPAttempts = new Map<string, { count: number; firstSeen: number }>();
const SUSPICIOUS_IP_WINDOW = 60 * 60 * 1000;
const SUSPICIOUS_IP_THRESHOLD = 50;

export function sessionAgeGuard(maxAgeSeconds: number = MAX_ADMIN_SESSION_AGE) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const decoded = (req as any).decodedClaims || (req as any).firebaseUser;
      if (!decoded?.auth_time) {
        next();
        return;
      }

      const authTime = typeof decoded.auth_time === 'number' ? decoded.auth_time * 1000 : Date.now();
      const sessionAge = Math.floor((Date.now() - authTime) / 1000);

      if (sessionAge > maxAgeSeconds) {
        logger.warn(`[SessionHardening] Session too old: ${sessionAge}s > ${maxAgeSeconds}s for ${decoded.uid || decoded.email}`);
        res.status(401).json({
          error: 'session_expired',
          message: 'Your session has expired. Please sign in again.',
          sessionAge,
          maxAge: maxAgeSeconds,
        });
        return;
      }

      next();
    } catch (err: any) {
      logger.error('[SessionHardening] Session age check failed:', err.message);
      next();
    }
  };
}

export function ipRiskScoring() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    const now = Date.now();

    const existing = suspiciousIPAttempts.get(ip);
    if (existing) {
      if (now - existing.firstSeen > SUSPICIOUS_IP_WINDOW) {
        suspiciousIPAttempts.set(ip, { count: 1, firstSeen: now });
      } else {
        existing.count++;
        if (existing.count > SUSPICIOUS_IP_THRESHOLD) {
          logger.warn(`[SessionHardening] Suspicious IP activity: ${ip} - ${existing.count} requests in window`);
          res.status(429).json({
            error: 'suspicious_activity',
            message: 'Too many requests from this location. Please try again later.',
          });
          return;
        }
      }
    } else {
      suspiciousIPAttempts.set(ip, { count: 1, firstSeen: now });
    }

    if (suspiciousIPAttempts.size > 10000) {
      const cutoff = now - SUSPICIOUS_IP_WINDOW;
      for (const [key, val] of suspiciousIPAttempts) {
        if (val.firstSeen < cutoff) suspiciousIPAttempts.delete(key);
      }
    }

    next();
  };
}

export function stepUpMFACheck() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const decoded = (req as any).decodedClaims || (req as any).firebaseUser;
      if (!decoded?.uid) {
        next();
        return;
      }

      const { adminAuth: fbAdminAuth } = await import('../lib/firebase-admin');
      const userRecord = await fbAdminAuth.getUser(decoded.uid);
      const claims = (userRecord.customClaims || {}) as Record<string, any>;

      const role = claims.role || 'public';
      const sensitiveRoles = ['admin', 'management', 'super_admin'];
      const isSensitiveRole = sensitiveRoles.includes(role) || claims.kyc_admin === true;

      if (!isSensitiveRole) {
        next();
        return;
      }

      const authTime = typeof decoded.auth_time === 'number' ? decoded.auth_time * 1000 : Date.now();
      const sessionAge = Math.floor((Date.now() - authTime) / 1000);

      if (sessionAge > STEP_UP_MFA_THRESHOLD && !claims.mfa_verified) {
        logger.warn(`[SessionHardening] Step-up MFA required for ${decoded.uid} (session=${sessionAge}s, role=${role})`);
        res.status(403).json({
          error: 'step_up_mfa_required',
          message: 'Extended session requires MFA re-verification for admin operations.',
          mfaRequired: true,
          sessionAge,
          threshold: STEP_UP_MFA_THRESHOLD,
        });
        return;
      }

      next();
    } catch (err: any) {
      logger.error('[SessionHardening] Step-up MFA check failed:', err.message);
      next();
    }
  };
}

export function adminRouteHardening() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    const method = req.method;
    const path = req.path;

    logger.info(`[AdminAudit] ${method} ${path} | IP: ${ip} | UA: ${userAgent.substring(0, 80)}`);

    next();
  };
}

setInterval(() => {
  const now = Date.now();
  const cutoff = now - SUSPICIOUS_IP_WINDOW;
  for (const [key, val] of suspiciousIPAttempts) {
    if (val.firstSeen < cutoff) suspiciousIPAttempts.delete(key);
  }
}, 10 * 60 * 1000);
