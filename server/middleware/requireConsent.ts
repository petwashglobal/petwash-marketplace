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
import { eq } from 'drizzle-orm';
import { verifyConsent } from '../services/consentEngine';
import { db } from '../db';
import { users } from '@shared/schema';
import { logger } from '../lib/logger';

/**
 * The member's Terms + Privacy acceptance lives on the users row
 * (termsAcceptedAt / privacyAcceptedAt — written by /complete-profile and the
 * signup form) — NOT only in user_consents. Until 2026-09-12 this gate read
 * user_consents alone, so it would have refused every member who consented
 * the normal way. Either store satisfies 'terms' / 'privacy'.
 */
async function legacyMemberConsent(uid: string, type: string): Promise<boolean> {
  if (type !== 'terms' && type !== 'privacy') return false;
  const [u] = await db
    .select({ terms: users.termsAcceptedAt, privacy: users.privacyAcceptedAt })
    .from(users)
    .where(eq(users.id, uid))
    .limit(1);
  return type === 'terms' ? !!u?.terms : !!u?.privacy;
}

/** LEGAL_CONSENT_GATE_ENABLED=true turns the gate on for the legacy value-moving routers. */
export function consentGateEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return (env.LEGAL_CONSENT_GATE_ENABLED || '').trim().toLowerCase() === 'true';
}

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function requireConsent(...consentTypes: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const uid = (req as any).user?.uid || (req as any).firebaseUser?.uid;
    if (!uid) return res.status(401).json({ error: 'Authentication required' });

    try {
      const missing: string[] = [];
      for (const type of consentTypes) {
        const given = (await legacyMemberConsent(uid, type)) || (await verifyConsent(uid, type));
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

/**
 * The same gate for LEGACY high-traffic routers: only mutating methods, only
 * when LEGAL_CONSENT_GATE_ENABLED=true (roll-out safety — see the header).
 * Reads never need consent; anonymous callers are left to the router's own auth.
 */
export function requireConsentIfEnabled(...consentTypes: string[]) {
  const gate = requireConsent(...consentTypes);
  return (req: Request, res: Response, next: NextFunction) => {
    if (!consentGateEnabled()) return next();
    if (!MUTATING.has(req.method)) return next();
    const uid = (req as any).user?.uid || (req as any).firebaseUser?.uid;
    if (!uid) return next();
    return gate(req, res, next);
  };
}
