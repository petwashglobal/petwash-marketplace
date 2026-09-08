/**
 * Who is acting, financially — ONE implementation.
 *
 * Lifted out of server/routes/financial-approvals.ts so the wallet money routes
 * can ask the same question the approval matrix already asks. A second copy of
 * "what role is this caller?" on the money path is how two surfaces end up
 * disagreeing about the same person.
 *
 * FAILS CLOSED. Throws { status: 401 } when neither a valid x-admin-secret nor
 * a decoded Firebase token is present — it never silently returns the lowest
 * role, because "I don't know who this is" and "this is an agent" are different
 * answers and only one of them is safe to act on.
 */
import type { Request } from 'express';
import { timingSafeEqual } from 'node:crypto';

const ALLOWED_MACHINE_IPS = (process.env.ALLOWED_MACHINE_IPS || '')
  .split(',').map(s => s.trim()).filter(Boolean);

function getClientIp(req: Request): string {
  return (req.headers['x-forwarded-for'] as string || '').split(',')[0].trim()
    || req.socket.remoteAddress || '';
}

/** Highest index wins. Mirrors ROLE_HIERARCHY in financial-approvals.ts. */
export type FinancialRole = 'agent' | 'manager' | 'franchise_owner' | 'admin' | 'executive';

export function getActingRole(req: Request): string {
  // Timing-safe: a `===` here leaks the secret's length and prefix.
  const adminSecretHeader = req.headers['x-admin-secret'] as string | undefined;
  const adminSecretEnv = process.env.ADMIN_SECRET;
  const adminSecretMatch = !!(
    adminSecretHeader &&
    adminSecretEnv &&
    adminSecretHeader.length === adminSecretEnv.length &&
    timingSafeEqual(Buffer.from(adminSecretHeader), Buffer.from(adminSecretEnv))
  );
  if (adminSecretMatch) {
    if (ALLOWED_MACHINE_IPS.length > 0) {
      const clientIp = getClientIp(req);
      if (!ALLOWED_MACHINE_IPS.includes(clientIp)) {
        // Not in the allowlist — fall through to token auth rather than
        // silently downgrading to an unauthenticated 'agent'.
        const err: any = new Error('Authentication required');
        err.status = 401;
        throw err;
      }
    }
    return 'admin';
  }

  const decoded = (req as any).decodedToken ?? (req as any).firebaseUser;
  if (!decoded) {
    const err: any = new Error('Authentication required');
    err.status = 401;
    throw err;
  }
  if (decoded?.executive || decoded?.claims?.executive) return 'executive';
  if (decoded?.admin || decoded?.claims?.admin) return 'admin';
  if (decoded?.franchise_owner || decoded?.claims?.franchise_owner) return 'franchise_owner';
  if (decoded?.manager || decoded?.claims?.manager) return 'manager';
  if (decoded?.role === 'executive' || decoded?.claims?.role === 'executive') return 'executive';
  if (decoded?.role === 'franchise_owner' || decoded?.claims?.role === 'franchise_owner') return 'franchise_owner';
  if (decoded?.role === 'manager' || decoded?.claims?.role === 'manager') return 'manager';
  // Authenticated but unprivileged — a KNOWN answer, unlike the throw above.
  return 'agent';
}

export function getActingUid(req: Request): string | null {
  const decoded = (req as any).decodedToken ?? (req as any).firebaseUser;
  return decoded?.uid ?? null;
}
