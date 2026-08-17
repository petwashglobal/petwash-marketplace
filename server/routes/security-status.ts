/**
 * PR-AUTH-SECURITY-9 §2 — Account > Security STATUS endpoint.
 *
 * Single READ-ONLY GET that returns server-truth for every row on the
 * Account > Security surface. The client MUST NOT infer any status from
 * localStorage / sessionStorage — it always calls this endpoint (plus
 * /api/webauthn/credentials for the passkey list).
 *
 * Identity is derived from the Firebase session (cookie OR Bearer). Any
 * client-supplied uid/email is ignored.
 *
 * No side effects. No money code. No admin authorization changes.
 */

import { Router, Request, Response } from 'express';
import { eq, and } from 'drizzle-orm';
import { db } from '../db';
import { users, userPins, mfaEnrollments } from '../../shared/schema';
import { logger } from '../lib/logger';
import { auth as firebaseAdminAuth } from '../lib/firebase-admin';

const router = Router();

/**
 * Resolve the authenticated user from EITHER the pw_session/__session cookie
 * OR an Authorization: Bearer id-token. Mirrors the pattern used by
 * /api/session/whoami. Returns null on any failure (401 already sent).
 */
async function resolveAuthedSecurity(
  req: Request,
  res: Response,
): Promise<{ uid: string; email: string | null; emailVerified: boolean } | null> {
  const bearer = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.substring(7)
    : null;
  const cookie = (req as any).cookies?.pw_session || (req as any).cookies?.__session;
  try {
    if (bearer) {
      const decoded = await firebaseAdminAuth.verifyIdToken(bearer, true);
      return {
        uid: decoded.uid,
        email: decoded.email?.toLowerCase() ?? null,
        emailVerified: !!decoded.email_verified,
      };
    }
    if (cookie) {
      const decoded = await firebaseAdminAuth.verifySessionCookie(cookie, false);
      return {
        uid: decoded.uid,
        email: decoded.email?.toLowerCase() ?? null,
        emailVerified: !!decoded.email_verified,
      };
    }
  } catch (err) {
    logger.debug('[security/status] auth resolution failed', { err: (err as any)?.message });
  }
  res.status(401).json({ ok: false, error: 'Authentication required', code: 'AUTH_REQUIRED' });
  return null;
}

/**
 * GET /api/security/status
 *
 * Returns the full server-truth Account > Security status for the
 * authenticated user only. Fields marked `available:false` mean "we can't
 * answer that on the current schema" — the UI should render "Not yet
 * available" for those rows rather than guessing.
 */
router.get('/status', async (req: Request, res: Response) => {
  const authed = await resolveAuthedSecurity(req, res);
  if (!authed) return;

  try {
    // ─── Firebase Auth record: password provider + MFA factors ──────────────
    let hasPassword = false;
    let mfaFactorCount = 0;
    let mfaFactors: Array<{ factorId?: string; displayName?: string | null; enrollmentTime?: string }> = [];
    try {
      const rec = await firebaseAdminAuth.getUser(authed.uid);
      hasPassword = (rec.providerData || []).some((p: any) => p.providerId === 'password');
      const enrolled = (rec.multiFactor && (rec.multiFactor as any).enrolledFactors) || [];
      mfaFactorCount = enrolled.length;
      mfaFactors = enrolled.map((f: any) => ({
        factorId: f.factorId,
        displayName: f.displayName || null,
        enrollmentTime: f.enrollmentTime || null,
      }));
    } catch (err) {
      logger.warn('[security/status] getUser failed — degrading', { uid: authed.uid, err: (err as any)?.message });
    }

    // ─── Postgres users row: mobile verification ────────────────────────────
    const [pgUser] = await db.select().from(users).where(eq(users.id, authed.uid)).limit(1);
    const mobile = pgUser?.phoneE164 || (pgUser as any)?.phone || null;
    const mobileVerified = !!(pgUser?.mobileVerifiedAt) || (pgUser as any)?.phoneVerified === true;
    const emailVerifiedPg = !!(pgUser?.emailVerifiedAt);

    // ─── Passkey count via existing WebAuthn service (Firestore-backed) ─────
    let passkeyCount = 0;
    try {
      const { getUserCredentials } = await import('../webauthn/service');
      const creds = await getUserCredentials(authed.uid, false);
      passkeyCount = (creds || []).filter((c: any) => !c.isRevoked).length;
    } catch (err) {
      logger.debug('[security/status] webauthn count failed', { err: (err as any)?.message });
    }

    // ─── PIN status (user_pins, active only) ────────────────────────────────
    let pinSet = false;
    try {
      const [pinRow] = await db.select({ id: userPins.id, pinLength: userPins.pinLength }).from(userPins)
        .where(and(eq(userPins.userId, authed.uid), eq(userPins.isActive, true)))
        .limit(1);
      pinSet = !!pinRow;
    } catch (err) {
      logger.debug('[security/status] pin count failed', { err: (err as any)?.message });
    }

    // ─── MFA fallback: mfa_enrollments table (SMS/TOTP) ─────────────────────
    let mfaEnrolledPg = 0;
    try {
      const rows = await db.select({ id: mfaEnrollments.id }).from(mfaEnrollments)
        .where(and(eq(mfaEnrollments.userId, authed.uid), eq(mfaEnrollments.isActive, true)));
      mfaEnrolledPg = rows.length;
    } catch (err) {
      logger.debug('[security/status] mfa count failed', { err: (err as any)?.message });
    }
    const mfaEnrolled = mfaFactorCount + mfaEnrolledPg;

    // ─── Response ───────────────────────────────────────────────────────────
    return res.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      email: {
        value: authed.email,
        verified: authed.emailVerified || emailVerifiedPg,
      },
      mobile: {
        value: mobile,
        verified: mobileVerified,
      },
      password: {
        set: hasPassword,
      },
      passkey: {
        count: passkeyCount,
      },
      pin: {
        set: pinSet,
      },
      trustedDevices: {
        available: false,
        count: null,
        reason: 'Trusted-device inventory endpoint not yet wired',
      },
      mfa: {
        enrolled: mfaEnrolled > 0,
        count: mfaEnrolled,
        factors: mfaFactors,
      },
      sessions: {
        available: false,
        count: null,
        reason: 'Firebase Admin session inventory not exposed',
      },
    });
  } catch (error) {
    logger.error('[security/status] Unexpected error', error);
    return res.status(500).json({ ok: false, error: 'Failed to fetch security status' });
  }
});

export default router;
