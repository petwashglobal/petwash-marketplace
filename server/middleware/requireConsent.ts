/**
 * requireConsent(...consentTypes) — Express middleware that blocks an action
 * until the signed-in user has accepted ALL the given consent documents.
 *
 * Wraps the existing consent engine (verifyConsent → user_consents). Returns
 * 403 { error:'CONSENT_REQUIRED', missing:[...] } so the client can route the
 * user to sign the missing document(s). Reads the uid from the Firebase/session
 * auth already attached upstream.
 *
 * ROLL-OUT SAFETY: only apply this to a route once the matching consent docs
 * are live and (for existing users) backfilled — otherwise it will block users
 * who never had the chance to accept. New/low-risk actions can adopt it
 * immediately; high-traffic legacy flows should be gated behind a flag until
 * consent is backfilled.
 */
import type { Request, Response, NextFunction } from 'express';
import { verifyConsent } from '../services/consentEngine';
import { logger } from '../lib/logger';

export function requireConsent(...consentTypes: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const uid = (req as any).user?.uid || (req as any).firebaseUser?.uid;
    if (!uid) return res.status(401).json({ error: 'Authentication required' });

    try {
      const missing: string[] = [];
      for (const type of consentTypes) {
        const given = await verifyConsent(uid, type);
        if (!given) missing.push(type);
      }
      if (missing.length > 0) {
        return res.status(403).json({ error: 'CONSENT_REQUIRED', missing });
      }
      return next();
    } catch (err: any) {
      // Fail CLOSED for a consent gate — a lookup error must not silently let a
      // gated action through.
      logger.error('[requireConsent] check failed', { error: err?.message, consentTypes });
      return res.status(503).json({ error: 'CONSENT_CHECK_UNAVAILABLE' });
    }
  };
}
