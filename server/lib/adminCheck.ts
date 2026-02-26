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

    // Fallback: Firestore doc role field (migration window only — remove after all users migrated)
    try {
      const { db: firestoreDb } = await import('./firebase-admin');
      const userDoc = await firestoreDb.collection('users').doc(uid).get();
      const userData = userDoc.data();
      if (userData?.role === 'admin' || userData?.role === 'super_admin') {
        logger.warn('[AdminCheck] Admin access granted via Firestore doc (legacy) — migrate to custom claims', { uid });
        return true;
      }
    } catch {
      // Firestore unavailable — claims-only check is sufficient
    }

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

/**
 * Grant admin custom claim to a user (server-side only).
 * Call this from an admin management endpoint, not from client code.
 */
export async function grantAdminClaim(uid: string, role: 'admin' | 'super_admin' = 'admin'): Promise<void> {
  const { adminAuth } = await import('./firebase-admin');
  const userRecord = await adminAuth.getUser(uid);
  const existing = (userRecord.customClaims || {}) as Record<string, any>;
  await adminAuth.setCustomUserClaims(uid, { ...existing, role, admin: true });
  logger.info('[AdminCheck] Admin claim granted', { uid, role });
}

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
