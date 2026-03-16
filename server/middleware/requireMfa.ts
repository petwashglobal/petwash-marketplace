import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { mfaEnrollments } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { isSuperAdmin, ROLE_HIERARCHY } from './rbac';
import { logger } from '../lib/logger';

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

    // Programmatic API access via Bearer token (not browser session) — skip MFA
    // MFA is a browser UX gate; API clients use short-lived signed tokens instead
    const hasSessionCookie = !!(req as any).cookies?.pw_session;
    const hasBearerToken = !!(req.headers.authorization?.startsWith('Bearer '));
    if (hasBearerToken && !hasSessionCookie) {
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

  return false;
}

export default requireAdminMfa;
