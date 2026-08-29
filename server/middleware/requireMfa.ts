import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { mfaEnrollments } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { isSuperAdmin, ROLE_HIERARCHY } from './rbac';
import { logger } from '../lib/logger';

/** Safely tag an email for audit logs without leaking the full address. */
function userEmailForLog(email: string | undefined): string {
  if (!email) return '<none>';
  const [local, domain] = email.split('@');
  if (!domain) return '<opaque>';
  const localMasked = local.length <= 2 ? local[0] + '***' : local[0] + '***' + local.slice(-1);
  return `${localMasked}@${domain}`;
}

const MFA_REQUIRED_ROLES = ['admin', 'super_admin', 'management', 'hr', 'finance'];

const MFA_REQUIRED_ACCESS_LEVELS = 6;

export async function requireAdminMfa(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const uid = req.firebaseUser?.uid;
    const email = req.firebaseUser?.email;

    if (!uid || !email) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // CEO FLY MODE II §4–§5 (2026-08-29) — Bearer !== trusted machine client.
    //
    // Pre-fix, the middleware short-circuited whenever the request had
    // an Authorization header without the session cookie. That meant
    // EVERY Firebase ID token presented via Authorization
    // (mobile app, curl, any web fetch that skipped the cookie)
    // skipped MFA entirely. That is a HUMAN identity — the token is
    // issued to a person, verifyIdToken at requireAuth confirms a
    // Firebase user. Naming the transport does not make the client a
    // machine.
    //
    // FIX: MFA is enforced identically for cookie-based and Bearer-based
    // human sessions. Only a caller whose Firebase UID matches the
    // explicitly-configured SERVICE_PRINCIPAL_UIDS allowlist is granted
    // machine exemption — and every bypass is logged at INFO for audit.
    // The allowlist is env-driven, comma-separated, and defaults to
    // EMPTY so a misconfigured env cannot silently open the door.
    const servicePrincipalAllowlist = (process.env.SERVICE_PRINCIPAL_UIDS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (servicePrincipalAllowlist.length > 0 && servicePrincipalAllowlist.includes(uid)) {
      logger.info('[MFA-Enforcement] service_principal bypass', {
        uid,
        email: userEmailForLog(email),
        allowlistSize: servicePrincipalAllowlist.length,
      });
      return next();
    }

    const userEmail = email.toLowerCase();

    const needsMfa = await doesRoleRequireMfa(uid, userEmail);
    if (!needsMfa) {
      return next();
    }

    const enrollments = await db
      .select()
      .from(mfaEnrollments)
      .where(
        and(
          eq(mfaEnrollments.userId, uid),
          eq(mfaEnrollments.isActive, true)
        )
      )
      .limit(1);

    if (enrollments.length === 0) {
      // Super admins are allowed through without MFA so they can reach /settings/security to enroll.
      // All such access is logged as a security warning.
      if (isSuperAdmin(userEmail)) {
        logger.warn(`[MFA-Enforcement] ⚠️ Super admin ${userEmail} accessed without MFA enrollment — please enroll at /settings/security`);
        return next();
      }
      logger.warn(`[MFA-Enforcement] Admin user ${userEmail} blocked - no MFA enrolled`);
      return res.status(403).json({
        error: 'MFA_REQUIRED',
        message: 'Multi-factor authentication enrollment is mandatory for your role. Please enroll via /settings/security.',
        enrollmentRequired: true,
        enrollUrl: '/settings/security',
      });
    }

    const enrollment = enrollments[0];
    if (enrollment.method === 'totp' && !enrollment.totpVerified) {
      logger.warn(`[MFA-Enforcement] Admin user ${userEmail} blocked - TOTP not verified`);
      return res.status(403).json({
        error: 'MFA_ENROLLMENT_INCOMPLETE',
        message: 'Your authenticator app enrollment is incomplete. Please verify with a code.',
        enrollmentRequired: true,
        enrollUrl: '/settings/security',
      });
    }

    next();
  } catch (error) {
    logger.error('[MFA-Enforcement] Error checking MFA status:', error);
    res.status(500).json({ error: 'Failed to verify MFA status' });
  }
}

async function doesRoleRequireMfa(uid: string, email: string): Promise<boolean> {
  if (isSuperAdmin(email)) {
    return true;
  }

  try {
    const { adminAuth } = await import('../lib/firebase-admin');
    const userRecord = await adminAuth.getUser(uid);
    const claims = (userRecord.customClaims || {}) as Record<string, any>;

    const role = claims.role || '';
    if (MFA_REQUIRED_ROLES.includes(role)) {
      return true;
    }

    if (claims.accountType === 'internal') {
      const roleLevel = ROLE_HIERARCHY[role] || 1;
      if (roleLevel >= MFA_REQUIRED_ACCESS_LEVELS) {
        return true;
      }
    }

    if (claims.kycStaff || claims.kycAdmin || claims.financeAccess) {
      return true;
    }
  } catch (error) {
    logger.error('[MFA-Enforcement] Error reading user claims:', error);
  }

  // CEO §D5 §Lane 1 (2026-08-29 E4+E9 audit) — capability fallback
  // via the shared helper. Fail-CLOSED with onError:true (require
  // MFA on aggregator error). Claim-drift used to silently bypass
  // MFA for a privileged human whose claim never re-issued.
  const { hasAdminOrStaffCapability } = await import('../lib/userCapabilities');
  if (await hasAdminOrStaffCapability(uid, { onError: true })) return true;

  return false;
}

export default requireAdminMfa;
