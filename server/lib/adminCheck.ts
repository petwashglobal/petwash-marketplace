import { Request, Response, NextFunction } from "express";
import { logger } from './logger';

/**
 * Unified admin role check — uses Firebase custom claims (primary source of truth).
 *
 * ── Admin System Consolidation ───────────────────────────────────────────────
 * PetWash™ previously had three competing admin-check mechanisms:
 *   1. adminCheck.ts  — Firestore document `/users/{uid}/role` field
 *   2. adminAuth.ts   — Firebase custom claims (`claims.role`)
 *   3. rbac.ts        — PostgreSQL system_roles + hardcoded email list
 *
 * Resolution: Firebase custom claims is the single source of truth for admin status.
 *   - Claims are set server-side via Firebase Admin SDK (cannot be spoofed by clients)
 *   - Claims survive token refresh and are available without a DB round-trip
 *   - PostgreSQL system_roles remains authoritative for FINE-GRAINED permissions only
 *   - The Firestore doc `/users/{uid}/role` is now READ-ONLY display data, not auth
 *
 * To grant admin access to a user, call from the server:
 *   admin.auth().setCustomUserClaims(uid, { role: 'admin' })
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Usage:
 *   As middleware: router.get('/admin', validateFirebaseToken, requireAdminRole, handler)
 *   Inline check:  const isAdm = await checkUserIsAdmin(uid);
 */

const ADMIN_ROLES = ['admin', 'super_admin', 'hq_admin'];

/**
 * Check if user has admin role via Firebase custom claims.
 * Falls back to Firestore doc read only if claims are absent (migration window).
 */
export async function checkUserIsAdmin(uid: string): Promise<boolean> {
  try {
    const { adminAuth } = await import('./firebase-admin');
    const userRecord = await adminAuth.getUser(uid);
    const claims = (userRecord.customClaims || {}) as Record<string, any>;

    // Primary check: custom claims (fast, no extra DB round-trip)
    if (ADMIN_ROLES.includes(claims.role)) {
      return true;
    }
    if (claims.admin === true) {
      return true;
    }

    // REMOVED 2026-09-13 — THIS WAS A SELF-SERVICE ADMIN DOOR.
    //
    // The block here read `role` from Firestore `users/{uid}` and returned
    // true for 'admin' / 'super_admin'. firestore.rules:69 says
    //
    //     match /users/{userId} { allow write: if isAuthenticated() && isOwner(userId); }
    //
    // — the signed-in user may write ANY field on their own document, and the
    // browser ships the Firestore SDK. So one call from the console:
    //
    //     setDoc(doc(db, 'users', uid), { role: 'admin' }, { merge: true })
    //
    // made that user an admin to every consumer of this function: platform
    // revenue by channel, AI insights, the event-bus history, marketing
    // campaign create AND launch (real ad spend), wallet-telemetry purge,
    // and the Sheets export URL.
    //
    // The block was labelled "migration window only — remove after all users
    // migrated". Firebase custom claims (checked above) are the authority and
    // are writable only by the server. This now fails closed.
    // Do NOT reinstate a check against any store the subject can write.

    return false;
  } catch (error) {
    logger.error('[AdminCheck] Error checking admin status via Firebase claims', { uid, error });
    return false;
  }
}

/**
 * Express middleware — requires admin role.
 * Must be used AFTER validateFirebaseToken middleware.
 */
export async function requireAdminRole(req: any, res: Response, next: NextFunction) {
  const uid = req.firebaseUser?.uid;

  if (!uid) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const isAdmin = await checkUserIsAdmin(uid);

  if (!isAdmin) {
    logger.warn('[AdminCheck] Unauthorized admin access attempt', {
      uid,
      method: req.method,
      path: req.path,
      ip: req.ip,
    });
    return res.status(403).json({ error: 'Admin access required' });
  }

  logger.info('[AdminCheck] Admin access granted', { uid, method: req.method, path: req.path });
  next();
}

// SECURITY 2026-06-12 (audit L3): grantAdminClaim() was removed — it had
// zero callers anywhere in the codebase and existed only as a latent
// privilege-escalation surface (it set { admin: true } custom claims).
// Admin roles are provisioned via the env allowlist + approval records;
// if a programmatic grant is ever needed, reintroduce it behind a guarded,
// audited admin endpoint — not as a free-floating exported helper.

/**
 * Revoke admin custom claim from a user.
 */
export async function revokeAdminClaim(uid: string): Promise<void> {
  const { adminAuth } = await import('./firebase-admin');
  const userRecord = await adminAuth.getUser(uid);
  const existing = (userRecord.customClaims || {}) as Record<string, any>;
  const updated = { ...existing };
  delete updated.role;
  delete updated.admin;
  await adminAuth.setCustomUserClaims(uid, updated);
  logger.info('[AdminCheck] Admin claim revoked', { uid });
}
