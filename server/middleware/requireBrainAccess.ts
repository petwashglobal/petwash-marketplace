/**
 * requireBrainAccess — gate for the CEO Operations Brain dashboard.
 *
 * Today: only super-admin (SUPER_ADMIN_EMAILS env var) gets in.
 * Tomorrow: flip a role on `users.roles` JSON to grant CFO / Ops lead
 *           access without sharing the CEO account.
 *
 * Why this exists separate from requireAdmin:
 *   The Brain dashboard is read-only and aggregates highly sensitive data
 *   (revenue, payouts, signed agreements, fraud signals). It must NEVER
 *   widen as more users gain `admin` for unrelated reasons. This gate is
 *   intentionally narrower than `requireAdmin`.
 *
 * Resolution order:
 *   1. Caller must already be authenticated by Firebase auth — req.firebaseUser
 *      is required. If not present → 401.
 *   2. If email matches SUPER_ADMIN_EMAILS list → allow.
 *   3. If req.firebaseUser.claims.roles or req.user.role contains any of
 *      BRAIN_ROLES → allow.
 *   4. Otherwise → 403.
 *
 * Adding a CFO later:
 *   - Set the user's Firebase custom claim role to 'cfo' (or push 'cfo' into
 *     their `users.roles` JSON column — syncFirebaseClaims mirrors it).
 *   - No code change required.
 */
import type { Request, Response, NextFunction } from 'express';
import { isSuperAdmin } from './rbac';
import { logger } from '../lib/logger';

export const BRAIN_ROLES = ['ceo', 'cfo', 'ops_lead'] as const;
export type BrainRole = (typeof BRAIN_ROLES)[number];

function rolesFromRequest(req: Request): string[] {
  const claimRoles = (req.firebaseUser?.claims?.roles as string[] | undefined) || [];
  const claimRole = (req.firebaseUser?.claims?.role as string | undefined);
  // Cast: the global Express User type doesn't include `role`, but firebase-auth.ts
  // augments req.user with a `role` field at request time. Cast to any to read it.
  const userRole = ((req.user as any)?.role as string | undefined);
  const authRoles = (req as any).authRoles as string[] | undefined;
  return [
    ...(Array.isArray(claimRoles) ? claimRoles : []),
    ...(claimRole ? [claimRole] : []),
    ...(userRole ? [userRole] : []),
    ...(Array.isArray(authRoles) ? authRoles : []),
  ].map(r => String(r).toLowerCase());
}

export function requireBrainAccess(req: Request, res: Response, next: NextFunction) {
  const email = req.firebaseUser?.email?.toLowerCase();
  if (!email && !req.firebaseUser?.uid) {
    return res.status(401).json({
      error: 'AUTHENTICATION_REQUIRED',
      message: 'Sign in required to access the Operations Brain.',
    });
  }

  // 1. Super-admin email allowlist (env-driven, primary gate today)
  if (email && isSuperAdmin(email)) {
    return next();
  }

  // 2. Role allowlist — flip a role to grant CFO / Ops lead access tomorrow.
  const roles = rolesFromRequest(req);
  const hasBrainRole = roles.some(r => (BRAIN_ROLES as readonly string[]).includes(r));
  if (hasBrainRole) {
    return next();
  }

  logger.warn('[BrainAccess] denied', {
    uid: req.firebaseUser?.uid,
    email,
    roles,
  });
  return res.status(403).json({
    error: 'FORBIDDEN',
    message: 'Operations Brain is restricted to CEO / CFO / Ops lead.',
  });
}

export default requireBrainAccess;
