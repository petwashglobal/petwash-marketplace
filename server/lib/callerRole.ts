/**
 * ONE way to read the caller's role.
 *
 * THE BUG (2026-09-19). Six surfaces gated on `req.user?.role`. That field does
 * not exist and never has: `bridgeFirebaseUser` (server/middleware/firebase-auth.ts)
 * writes exactly
 *
 *     req.user = { uid, id, email }
 *
 * and the only other writers — customAuth.ts and adminAuth.ts — write
 * `{ uid, email }`. Nothing anywhere assigns `req.user.role`, `req.user.customClaims`
 * or `req.user.franchiseId`. Those names appear in local `AuthenticatedRequest`
 * interfaces, which is why the code compiles.
 *
 * So every one of those gates evaluated `undefined`, took the deny branch, and
 * answered 403 to EVERY authenticated caller — including the super admin:
 *
 *   /api/admin/finance/israel-compliance     403
 *   /api/admin/finance/payout-reconciliation 403
 *   /api/admin/finance/manual-adjustment     403
 *   /api/v2/vouchers  issue / cancel / adjust / ledger   403
 *   /api/chat/conversations/franchise/:id    403, and every admin bypass on /api/chat
 *   /api/walk-my-pet/users/:id/walks         403 for support and management
 *
 * The role really lives on `req.firebaseUser.claims.role` — which is what
 * server/routes/finance/treasury-settings.ts already reads correctly, and what
 * server/middleware/gates.ts checks. This centralises that one true source so a
 * seventh surface cannot invent a seventh wrong way to ask.
 */
import type { Request } from 'express';

/**
 * The caller's role, or '' when there is none.
 *
 * Reads, in order: the verified Firebase custom claim (the real source), then
 * the legacy shapes some middlewares still set, so an older path that DOES
 * populate a role keeps working.
 */
export function callerRole(req: Request): string {
  const fb = (req as any).firebaseUser;
  const u = (req as any).user;
  return (
    fb?.claims?.role ??
    fb?.role ??
    u?.claims?.role ??
    u?.customClaims?.role ??
    u?.role ??
    ''
  );
}

/** True when the caller holds any of `roles`. */
export function callerHasRole(req: Request, roles: Iterable<string>): boolean {
  const role = callerRole(req);
  if (!role) return false;
  for (const r of roles) if (r === role) return true;
  return false;
}

/** The platform's admin roles, in one place. */
export const ADMIN_ROLES = ['admin', 'super_admin'] as const;

export function callerIsAdmin(req: Request): boolean {
  return callerHasRole(req, ADMIN_ROLES);
}
