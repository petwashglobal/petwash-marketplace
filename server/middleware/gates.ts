import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';
import { logger } from '../lib/logger';
import { logSecurityEvent } from '../services/securityEventsService';

const SUPER_ADMINS = [
  'nirhadad1@gmail.com',
  'nir.h@petwash.co.il',
  'ido.s@petwash.co.il',
  'idoshakarzi110@gmail.com',
  'idoshaka@gmail.com',
];

/**
 * Helper to extract userId from request
 */
function getUserId(req: Request): string | null {
  const userId = (req as any).userId || (req as any).user?.id || (req.session as any)?.userId;
  return userId || null;
}

/**
 * Helper to get or load user from storage
 * Caches result on req.dbUser to avoid refetching
 */
async function getOrLoadUser(req: Request, userId: string) {
  if ((req as any).dbUser) {
    return (req as any).dbUser;
  }
  const user = await storage.getUser(userId);
  if (user) {
    (req as any).dbUser = user;
  }
  return user;
}

/**
 * Middleware: Checks that user is authenticated
 * Returns 401 if userId is missing
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      logger.debug('[requireAuth] No userId found on request');
      logSecurityEvent({ eventType: 'unauthorized_access_attempt', ip: req.ip || '', userAgent: req.headers['user-agent'] || '', riskScore: 30, metadata: { endpoint: req.originalUrl } });
      return res.status(401).json({ error: 'AUTH_REQUIRED' });
    }
    next();
  } catch (error: any) {
    logger.error(`[requireAuth] Error: ${error.message}`);
    return res.status(401).json({ error: 'AUTH_REQUIRED' });
  }
}

/**
 * Middleware factory: Checks user has one of the allowed roles
 * Returns 403 with {error: 'ROLE_REQUIRED', requiredRoles} if not
 */
export function requireRole(...roles: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // DEV-ONLY: Playwright / curl test bypass — x-test-user-role must be in the required set
      if (process.env.NODE_ENV === 'development' && req.headers['x-test-user-bypass'] === 'playwright-test') {
        const testRole = ((req.headers['x-test-user-role'] as string) || 'customer').toLowerCase();
        if (roles.includes(testRole)) {
          logger.debug(`[requireRole] DEV bypass: role='${testRole}' accepted for [${roles.join(',')}]`);
          return next();
        }
        return res.status(403).json({ error: 'ROLE_REQUIRED', requiredRoles: roles, userRole: testRole });
      }

      // Super admins bypass all role checks regardless of Firebase claims
      const reqEmail = ((req as any).firebaseUser?.email || '').toLowerCase();
      if (reqEmail && SUPER_ADMINS.includes(reqEmail)) {
        logger.debug(`[requireRole] Super admin ${reqEmail} bypassing role check for [${roles.join(',')}]`);
        return next();
      }

      // For Firebase Bearer-token / session-cookie users, enforce role via
      // Firebase custom claims rather than unconditionally calling next().
      // Two middleware shapes exist in the codebase:
      //   • firebase-auth.ts  → normalises to { claims: { role } }
      //   • customAuth.ts     → sets req.firebaseUser = decodedClaims (role at top-level)
      // We resolve both to avoid false 403s for either path.
      if ((req as any).firebaseUser?.uid) {
        const fbUser = (req as any).firebaseUser;
        const claimsRole: string = fbUser?.claims?.role || fbUser?.role || 'public';
        if (!roles.includes(claimsRole)) {
          logger.debug(`[requireRole] Firebase user ${fbUser.uid} has claims role '${claimsRole}', required: ${roles.join(',')}`);
          logSecurityEvent({
            userId: fbUser.uid,
            eventType: 'role_escalation_attempt',
            ip: req.ip || '',
            userAgent: req.headers['user-agent'] || '',
            riskScore: 60,
            metadata: { attemptedRoles: roles, actualRole: claimsRole, endpoint: req.originalUrl, source: 'firebase_claims' },
          });
          return res.status(403).json({ error: 'ROLE_REQUIRED', requiredRoles: roles, userRole: claimsRole });
        }
        return next();
      }

      const userId = getUserId(req);
      if (!userId) {
        logger.debug('[requireRole] No userId found');
        return res.status(401).json({ error: 'AUTH_REQUIRED' });
      }

      const user = await getOrLoadUser(req, userId);
      if (!user) {
        logger.debug(`[requireRole] User not found: ${userId}`);
        return res.status(404).json({ error: 'USER_NOT_FOUND' });
      }

      const userRole = (user as any).role || 'customer';
      if (!roles.includes(userRole)) {
        logger.debug(`[requireRole] User ${userId} has role '${userRole}', required: ${roles.join(',')}`);
        logSecurityEvent({ userId, eventType: 'role_escalation_attempt', ip: req.ip || '', userAgent: req.headers['user-agent'] || '', riskScore: 60, metadata: { attemptedRoles: roles, actualRole: userRole, endpoint: req.originalUrl } });
        return res.status(403).json({
          error: 'ROLE_REQUIRED',
          requiredRoles: roles,
          userRole,
        });
      }

      next();
    } catch (error: any) {
      logger.error(`[requireRole] Error: ${error.message}`);
      return res.status(403).json({ error: 'ROLE_REQUIRED', requiredRoles: roles });
    }
  };
}

/**
 * Middleware factory: Checks user has one of the allowed statuses
 * Returns 403 with {error: 'STATUS_REQUIRED', requiredStatuses} if not
 */
export function requireUserStatus(...statuses: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        logger.debug('[requireUserStatus] No userId found');
        return res.status(401).json({ error: 'AUTH_REQUIRED' });
      }

      const user = await getOrLoadUser(req, userId);
      if (!user) {
        logger.debug(`[requireUserStatus] User not found: ${userId}`);
        return res.status(404).json({ error: 'USER_NOT_FOUND' });
      }

      const userStatus = (user as any).userStatus || 'new';
      if (!statuses.includes(userStatus)) {
        logger.debug(`[requireUserStatus] User ${userId} has status '${userStatus}', required: ${statuses.join(',')}`);
        logSecurityEvent({ userId, eventType: 'status_gate_blocked', ip: req.ip || '', userAgent: req.headers['user-agent'] || '', riskScore: 40, metadata: { requiredStatuses: statuses, actualStatus: userStatus, endpoint: req.originalUrl } });
        return res.status(403).json({
          error: 'STATUS_REQUIRED',
          requiredStatuses: statuses,
          userStatus,
        });
      }

      next();
    } catch (error: any) {
      logger.error(`[requireUserStatus] Error: ${error.message}`);
      return res.status(403).json({ error: 'STATUS_REQUIRED', requiredStatuses: statuses });
    }
  };
}

/**
 * Middleware: Checks user role is 'provider' AND userStatus is 'provider_active'
 * Returns 403 with {error: 'PROVIDER_NOT_ACTIVE'} if not
 */
export async function requireProviderActive(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      logger.debug('[requireProviderActive] No userId found');
      return res.status(401).json({ error: 'AUTH_REQUIRED' });
    }

    const user = await getOrLoadUser(req, userId);
    if (!user) {
      logger.debug(`[requireProviderActive] User not found: ${userId}`);
      return res.status(404).json({ error: 'USER_NOT_FOUND' });
    }

    const userRole = (user as any).role || 'customer';
    const userStatus = (user as any).userStatus || 'new';

    if (userRole !== 'provider' || userStatus !== 'provider_active') {
      logger.debug(
        `[requireProviderActive] User ${userId} is not provider_active (role: ${userRole}, status: ${userStatus})`
      );
      logSecurityEvent({ userId, eventType: 'provider_gate_blocked', ip: req.ip || '', userAgent: req.headers['user-agent'] || '', riskScore: 50, metadata: { role: userRole, status: userStatus, endpoint: req.originalUrl } });
      return res.status(403).json({ error: 'PROVIDER_NOT_ACTIVE' });
    }

    next();
  } catch (error: any) {
    logger.error(`[requireProviderActive] Error: ${error.message}`);
    return res.status(403).json({ error: 'PROVIDER_NOT_ACTIVE' });
  }
}

/**
 * Middleware: Checks user role is in ['staff','management','admin'] AND userStatus is 'staff_active'
 * Returns 403 with {error: 'STAFF_NOT_APPROVED'} if not
 */
export async function requireStaffApproved(req: Request, res: Response, next: NextFunction) {
  try {
    // DEV-ONLY bypass
    if (process.env.NODE_ENV === 'development' && req.headers['x-test-user-bypass'] === 'playwright-test') {
      const testRole   = ((req.headers['x-test-user-role']   as string) || 'customer').toLowerCase();
      const testStatus = ((req.headers['x-test-user-status'] as string) || 'active').toLowerCase();
      const staffRoles = ['staff', 'management', 'admin'];
      if (staffRoles.includes(testRole) && testStatus === 'staff_active') {
        logger.debug(`[requireStaffApproved] DEV bypass: role=${testRole} status=${testStatus}`);
        return next();
      }
      return res.status(403).json({ error: 'STAFF_NOT_APPROVED' });
    }

    // Super admins bypass staff approval requirement
    const reqEmail = ((req as any).firebaseUser?.email || '').toLowerCase();
    if (reqEmail && SUPER_ADMINS.includes(reqEmail)) {
      logger.debug(`[requireStaffApproved] Super admin ${reqEmail} bypassing staff approval check`);
      return next();
    }

    const userId = getUserId(req);
    if (!userId) {
      logger.debug('[requireStaffApproved] No userId found');
      return res.status(401).json({ error: 'AUTH_REQUIRED' });
    }

    const user = await getOrLoadUser(req, userId);
    if (!user) {
      logger.debug(`[requireStaffApproved] User not found: ${userId}`);
      return res.status(404).json({ error: 'USER_NOT_FOUND' });
    }

    const userRole = (user as any).role || 'customer';
    const userStatus = (user as any).userStatus || 'new';
    const allowedRoles = ['staff', 'management', 'admin'];

    if (!allowedRoles.includes(userRole) || userStatus !== 'staff_active') {
      logger.debug(
        `[requireStaffApproved] User ${userId} is not staff_active (role: ${userRole}, status: ${userStatus})`
      );
      logSecurityEvent({ userId, eventType: 'staff_gate_blocked', ip: req.ip || '', userAgent: req.headers['user-agent'] || '', riskScore: 50, metadata: { role: userRole, status: userStatus, endpoint: req.originalUrl } });
      return res.status(403).json({ error: 'STAFF_NOT_APPROVED' });
    }

    next();
  } catch (error: any) {
    logger.error(`[requireStaffApproved] Error: ${error.message}`);
    return res.status(403).json({ error: 'STAFF_NOT_APPROVED' });
  }
}

/**
 * Middleware: Checks if mfaEnrolled is true when mfaRequired is true
 * Returns 403 with {error: 'MFA_REQUIRED'} if mfaRequired but not mfaEnrolled
 */
export async function requireMfaEnrolled(req: Request, res: Response, next: NextFunction) {
  try {
    // DEV-ONLY bypass — test users have no real MFA enrollment
    if (process.env.NODE_ENV === 'development' && req.headers['x-test-user-bypass'] === 'playwright-test') {
      logger.debug('[requireMfaEnrolled] DEV bypass: MFA check skipped for test user');
      return next();
    }

    // Super admins bypass MFA check so they can access settings to enroll
    const reqEmail = ((req as any).firebaseUser?.email || '').toLowerCase();
    if (reqEmail && SUPER_ADMINS.includes(reqEmail)) {
      logger.debug(`[requireMfaEnrolled] Super admin ${reqEmail} bypassing MFA enrolled check`);
      return next();
    }

    const userId = getUserId(req);
    if (!userId) {
      logger.debug('[requireMfaEnrolled] No userId found');
      return res.status(401).json({ error: 'AUTH_REQUIRED' });
    }

    const user = await getOrLoadUser(req, userId);
    if (!user) {
      logger.debug(`[requireMfaEnrolled] User not found: ${userId}`);
      return res.status(404).json({ error: 'USER_NOT_FOUND' });
    }

    const mfaRequired = (user as any).mfaRequired === true;
    const mfaEnrolled = (user as any).mfaEnrolled === true;

    if (mfaRequired && !mfaEnrolled) {
      logger.debug(`[requireMfaEnrolled] User ${userId} has mfaRequired=true but mfaEnrolled=false`);
      logSecurityEvent({ userId, eventType: 'mfa_gate_blocked', ip: req.ip || '', userAgent: req.headers['user-agent'] || '', riskScore: 40, metadata: { mfaRequired: true, mfaEnrolled: false, endpoint: req.originalUrl } });
      return res.status(403).json({ error: 'MFA_REQUIRED' });
    }

    next();
  } catch (error: any) {
    logger.error(`[requireMfaEnrolled] Error: ${error.message}`);
    return res.status(403).json({ error: 'MFA_REQUIRED' });
  }
}

/**
 * Middleware: Checks if email is verified in Firebase auth
 * Returns 403 with {error: 'EMAIL_NOT_VERIFIED'} if not verified
 */
export async function requireEmailVerified(req: Request, res: Response, next: NextFunction) {
  try {
    const emailVerified =
      (req as any).firebaseUser?.email_verified === true ||
      (req as any).emailVerified === true;

    if (!emailVerified) {
      logger.debug('[requireEmailVerified] Email not verified');
      return res.status(403).json({ error: 'EMAIL_NOT_VERIFIED' });
    }

    next();
  } catch (error: any) {
    logger.error(`[requireEmailVerified] Error: ${error.message}`);
    return res.status(403).json({ error: 'EMAIL_NOT_VERIFIED' });
  }
}

/**
 * Middleware: Checks if user email is in SUPER_ADMINS list
 * Returns 403 if not a super admin
 */
export async function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      logger.debug('[requireSuperAdmin] No userId found');
      return res.status(401).json({ error: 'AUTH_REQUIRED' });
    }

    const user = await getOrLoadUser(req, userId);
    if (!user) {
      logger.debug(`[requireSuperAdmin] User not found: ${userId}`);
      return res.status(404).json({ error: 'USER_NOT_FOUND' });
    }

    const userEmail = (user as any).email;
    if (!userEmail || !SUPER_ADMINS.includes(userEmail)) {
      logger.debug(`[requireSuperAdmin] User ${userId} (${userEmail}) is not a super admin`);
      logSecurityEvent({ userId, eventType: 'super_admin_escalation_attempt', ip: req.ip || '', userAgent: req.headers['user-agent'] || '', riskScore: 90, metadata: { email: userEmail, endpoint: req.originalUrl } });
      return res.status(403).json({ error: 'SUPER_ADMIN_REQUIRED' });
    }

    next();
  } catch (error: any) {
    logger.error(`[requireSuperAdmin] Error: ${error.message}`);
    return res.status(403).json({ error: 'SUPER_ADMIN_REQUIRED' });
  }
}
