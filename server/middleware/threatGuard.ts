/**
 * ThreatGuard Express Middleware
 *
 * Mounts on all /api/ routes. Performs per-request:
 *   1. User-agent scanner fingerprint check
 *   2. URL + body injection pattern scan
 *   3. Admin-404 enumeration tracking
 *   4. Auth failure recording (call recordAuthFailure from auth routes)
 *   5. Super-admin access logging
 *
 * IMPORTANT: This middleware NEVER blocks requests outright on its own.
 * It stamps events, sends alerts, and records threats — but keeps traffic
 * flowing so attackers don't know they've been detected.
 * Exception: confirmed injection payloads get a 400 early return.
 */

import type { Request, Response, NextFunction } from 'express';
import { ThreatGuardService } from '../services/ThreatGuardService';
import { logger } from '../lib/logger';

function getIp(req: Request): string {
  return (
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    'unknown'
  );
}

/**
 * Main threat-detection middleware — attach to app.use() before routes.
 */
export function threatGuardMiddleware(req: Request, res: Response, next: NextFunction): void {
  const ip = getIp(req);
  const ua = req.headers['user-agent'] ?? '';
  const path = req.path;

  /* 1. Scanner user-agent check */
  ThreatGuardService.scanUserAgent(ip, ua, path);

  /* 2. Injection scan on URL and raw body (best-effort) */
  const rawBody = typeof req.body === 'string' ? req.body :
                  req.body ? JSON.stringify(req.body) : '';
  const injected = ThreatGuardService.scanForInjection(ip, ua, req.originalUrl, rawBody);
  if (injected) {
    // Return 400 — attacker knows we rejected it, but we've already stamped + alerted
    res.status(400).json({ error: 'Bad request' });
    return;
  }

  /* 3. Admin enumeration: track 404s on admin routes after response */
  if (path.startsWith('/api/admin')) {
    res.on('finish', () => {
      if (res.statusCode === 404) {
        ThreatGuardService.recordAdminEnumeration(ip, ua, path);
      }
      /* 4. Auth failures on admin routes */
      if (res.statusCode === 401 || res.statusCode === 403) {
        ThreatGuardService.recordAuthFailure(ip, ua, path);
      }
      /* 5. Super-admin access log */
      if (res.statusCode < 400) {
        const uid = (req as any).user?.uid ?? (req as any).firebaseUser?.uid ?? 'unknown';
        if (uid !== 'unknown') {
          ThreatGuardService.recordSuperAdminAccess(ip, ua, path, uid);
        }
      }
    });
  }

  /* 6. Auth failure tracking on /api/auth/ */
  if (path.startsWith('/api/auth') || path.startsWith('/api/simple-auth')) {
    res.on('finish', () => {
      if (res.statusCode === 401 || res.statusCode === 403) {
        ThreatGuardService.recordAuthFailure(ip, ua, path, (req as any).user?.uid);
      }
    });
  }

  next();
}

/**
 * Threat summary endpoint helper (used by admin dashboard route).
 */
export function getThreatSummary() {
  return ThreatGuardService.getThreatSummary();
}
