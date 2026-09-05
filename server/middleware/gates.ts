import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';
import { logger } from '../lib/logger';
import { logSecurityEvent } from '../services/securityEventsService';
import { isReadOnlyAdminRole } from '@shared/adminRoles';
import { isSuperAdminVerified } from './rbac';
import { getUserCapabilities } from '../lib/userCapabilities';
import { hasProviderCapability } from '@shared/lib/userCapabilities';

// SECURITY: Super-admin email list loaded from environment variable.
// BEFORE: Hard-coded personal Gmail addresses — if any leaked (GitHub, CI logs,
//         ex-employee) the attacker had permanent admin bypass with no rotation path.
// AFTER:  Read from SUPER_ADMIN_EMAILS (comma-separated). Falls back to legacy list
//         ONLY in development so prod startup doesn't silently lock out all admins.
//         To rotate: update the env var, redeploy — no code change needed.
// SECURITY 2026-06-12 (audit L1): the dev-only hardcoded personal-email
// fallback was removed. It granted nothing in production, but a hardcoded
// admin-email list reads like a backdoor and ages badly (ex-staff, leaks).
// Super-admins now come ONLY from SUPER_ADMIN_EMAILS in every environment.
// Local dev: set SUPER_ADMIN_EMAILS in your .env (already standard here).
const _rawSuperAdminEmails = process.env.SUPER_ADMIN_EMAILS;
const SUPER_ADMINS: string[] = (_rawSuperAdminEmails || '')
  .split(',').map(e => e.trim().toLowerCase()).filter(Boolean);

if (!_rawSuperAdminEmails) {
  console.warn('[gates] WARNING: SUPER_ADMIN_EMAILS not set — super-admin email bypass disabled');
}

/**
 * Helper to extract userId from request
 */
export function getUserId(req: Request): string | null {
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
      // DEV-ONLY: Playwright / curl test bypass — x-test-user-role must be in the required set.
      // Uses TEST_BYPASS_TOKEN env var so that no secret is hardcoded in source code.
      // Bypass is completely disabled when the env var is not set (fail-closed).
      const bypassToken = process.env.NODE_ENV === 'production' ? undefined : process.env.TEST_BYPASS_TOKEN; // SECURITY 2026-06-25: never in prod
      if (bypassToken && req.headers['x-test-user-bypass'] === bypassToken) {
        const testRole = ((req.headers['x-test-user-role'] as string) || 'customer').toLowerCase();
        if (roles.includes(testRole)) {
          logger.debug(`[requireRole] DEV bypass: role='${testRole}' accepted for [${roles.join(',')}]`);
          return next();
        }
        return res.status(403).json({ error: 'ROLE_REQUIRED', requiredRoles: roles, userRole: testRole });
      }

      // Super admins bypass all role checks regardless of Firebase claims
      const reqEmail = ((req as any).firebaseUser?.email || '').toLowerCase();
      // #240 follow-up: allowlist match ALONE is not authority — require
      // Firebase email_verified === true too (canonical rbac primitive).
      if (isSuperAdminVerified(req)) {
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

const READ_ONLY_SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Middleware: enforce READ-ONLY admin roles (e.g. 'viewer' — external accountants,
 * observers like ido.s@petwash.co.il). Such accounts can VIEW every admin screen
 * (they pass the admin role gate) but must never change anything, so any mutating
 * request (POST/PUT/PATCH/DELETE) is rejected with 403 READ_ONLY_ACCESS.
 *
 * Resolves the role from Firebase custom claims, identically to requireRole, so it
 * stays consistent with the gate it sits behind. The single super admin (Nir, via
 * SUPER_ADMIN_EMAILS) is NEVER read-only and always passes. Mount this AFTER the
 * admin role gate on /api/admin so non-admins are already rejected.
 */
export function enforceReadOnlyMutations(req: Request, res: Response, next: NextFunction) {
  // Reads are always allowed.
  if (READ_ONLY_SAFE_METHODS.has(req.method)) return next();

  // Super admins are never read-only.
  const reqEmail = ((req as any).firebaseUser?.email || '').toLowerCase();
  // #240 follow-up: only a VERIFIED super-admin may write past the
  // read-only-viewer block. The viewer role's own semantics are unchanged.
  if (isSuperAdminVerified(req)) return next();

  const fbUser = (req as any).firebaseUser;
  const claimsRole: string = fbUser?.claims?.role || fbUser?.role || '';
  if (isReadOnlyAdminRole(claimsRole)) {
    logger.warn(`[enforceReadOnlyMutations] Blocked ${req.method} ${req.originalUrl} for read-only role '${claimsRole}' (${reqEmail || fbUser?.uid || 'unknown'})`);
    logSecurityEvent({
      userId: fbUser?.uid,
      eventType: 'readonly_mutation_blocked',
      ip: req.ip || '',
      userAgent: req.headers['user-agent'] || '',
      riskScore: 40,
      metadata: { role: claimsRole, method: req.method, endpoint: req.originalUrl },
    });
    return res.status(403).json({
      error: 'READ_ONLY_ACCESS',
      message: 'This account has read-only (viewer) access and cannot make changes.',
      role: claimsRole,
    });
  }

  return next();
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
 * Resolve the caller's id for the provider gate.
 *
 * `getUserId` above looks at `req.userId`, `req.user?.id` and
 * `req.session.userId` — and NONE of those is what the Firebase auth path
 * actually sets. `validateFirebaseToken` (server/middleware/firebase-auth.ts)
 * sets ONLY `req.firebaseUser`, and `customAuth.requireAuth` sets
 * `req.user = { uid, email }` — note `.uid`, not `.id`. So on
 * `/api/provider-dashboard/v2` — mounted as
 * `validateFirebaseToken → requireProviderActive` — getUserId() returned
 * null and the gate answered 401 AUTH_REQUIRED to a fully approved
 * provider holding a valid token.
 *
 * Deliberately local to this gate: `getUserId` is shared by requireAuth /
 * requireRole / requireUserStatus and widening it changes behaviour on
 * routes outside this lane. Handed off rather than fixed here.
 */
function getProviderGateUserId(req: Request): string | null {
  const r = req as any;
  return (
    r.firebaseUser?.uid ||
    r.userId ||
    r.user?.uid ||
    r.user?.id ||
    (req.session as any)?.userId ||
    null
  );
}

/**
 * Middleware: the account must hold the PROVIDER capability — i.e. the
 * authoritative provider_applications row is 'approved'.
 * Returns 403 {error: 'PROVIDER_NOT_ACTIVE'} otherwise.
 *
 * 2026-09-05 — REWRITTEN. This gate gates `/api/provider/*` and
 * `/api/provider-dashboard/v2/*`, i.e. the provider dashboard: the final
 * step of the provider journey. It used to require
 *
 *     users.role === 'provider' && users.userStatus === 'provider_active'
 *
 * and BOTH halves of that are unsatisfiable in the current data model:
 *
 *  • users.role is DELIBERATELY never flipped to 'provider' any more. The
 *    2026-08-20 MULTI-ROLE CONTRACT forbids mutating the scalar (it deleted
 *    the customer capability of anyone who became a provider), so both
 *    approval paths now only set `role = 'provider' WHERE role IS NULL`
 *    and otherwise just append to the users.roles[] array, and
 *    post-login.ts:823 explicitly refuses the mutation. An existing
 *    customer who is approved as a provider keeps role='customer' forever
 *    — and the normal journey REQUIRES being a signed-in customer first.
 *
 *  • NOTHING in the repo ever writes users.user_status = 'provider_active'.
 *    Staff has its write path (access-requests.ts sets 'staff_active');
 *    the provider equivalent was never built. The column stays at its
 *    'new' default.
 *
 * So the gate was dead-closed: every caller got 403 (or 401, per the id
 * bug above), approved providers included. Fail-closed, so not an
 * escalation — but the provider dashboard was unreachable for everyone.
 *
 * Authority now comes from the ONE server-side aggregator,
 * getUserCapabilities() → provider_applications.status === 'approved'
 * (CEO D5: users.role is a legacy CACHE, never the authority). The
 * aggregator fails soft to empty capabilities on a DB error, which lands
 * here as a 403 — still fail-closed.
 */
export async function requireProviderActive(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getProviderGateUserId(req);
    if (!userId) {
      logger.debug('[requireProviderActive] No userId found');
      return res.status(401).json({ error: 'AUTH_REQUIRED' });
    }

    // Memoise per request — the aggregator runs several queries and this
    // gate sits on a hot mount.
    let caps = (req as any).userCapabilities;
    if (!caps) {
      caps = await getUserCapabilities(userId);
      (req as any).userCapabilities = caps;
    }

    if (!hasProviderCapability(caps)) {
      const status = caps?.provider?.applicationStatus ?? 'none';
      logger.debug(
        `[requireProviderActive] User ${userId} lacks the provider capability (application status: ${status})`
      );
      logSecurityEvent({ userId, eventType: 'provider_gate_blocked', ip: req.ip || '', userAgent: req.headers['user-agent'] || '', riskScore: 50, metadata: { applicationStatus: status, endpoint: req.originalUrl } });
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
    // DEV-ONLY bypass — uses TEST_BYPASS_TOKEN env var (no hardcoded string)
    const bypassToken = process.env.NODE_ENV === 'production' ? undefined : process.env.TEST_BYPASS_TOKEN; // SECURITY 2026-06-25: never in prod
    if (bypassToken && req.headers['x-test-user-bypass'] === bypassToken) {
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
    // #240 follow-up: allowlist + Firebase email_verified === true.
    if (isSuperAdminVerified(req)) {
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

    // Elevated admin roles (admin/management/super_admin/ops/hr/finance) go through
    // a separate Firebase-claims-based approval workflow, not the "staff approval" queue.
    // They must not be gated behind staff_active — their own requireAdmin / requireRole
    // check is the enforced gate.
    const ELEVATED_ADMIN_ROLES = ['admin', 'management', 'super_admin', 'ops', 'hr', 'finance', 'ceo'];
    if (ELEVATED_ADMIN_ROLES.includes(userRole)) {
      return next();
    }

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
    // DEV-ONLY bypass — uses TEST_BYPASS_TOKEN env var (no hardcoded string)
    const bypassToken = process.env.NODE_ENV === 'production' ? undefined : process.env.TEST_BYPASS_TOKEN; // SECURITY 2026-06-25: never in prod
    if (bypassToken && req.headers['x-test-user-bypass'] === bypassToken) {
      logger.debug('[requireMfaEnrolled] DEV bypass: MFA check skipped for test user');
      return next();
    }

    // Super admins bypass MFA check so they can access settings to enroll
    const reqEmail = ((req as any).firebaseUser?.email || '').toLowerCase();
    // #240 follow-up: allowlist + Firebase email_verified === true. An
    // UNVERIFIED allowlisted account must not skip the MFA requirement.
    if (isSuperAdminVerified(req)) {
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
    // #240 follow-up: BOTH must hold — the stored user row must be on the
    // allowlist AND the live request must be a Firebase-verified
    // super-admin. Belt-and-braces: the row check alone trusts a DB column,
    // the request check alone trusts a token; a privileged gate wants both.
    if (!userEmail || !SUPER_ADMINS.includes(userEmail) || !isSuperAdminVerified(req)) {
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
