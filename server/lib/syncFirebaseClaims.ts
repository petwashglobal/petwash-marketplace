/**
 * Phase B — Single helper that syncs Firebase customClaims with the
 * Postgres `users.role` source of truth.
 *
 * Why
 * ───
 * Three role data sources existed before this:
 *   users.role             (Postgres — public auth)
 *   userRoleAssignments    (Postgres — enterprise RBAC)
 *   firebase customClaims  (token claims — read by rbac.ts)
 *
 * Backend ONLY wrote claims in the provider-approval path. Staff,
 * franchise, loyalty, and block / unblock paths never updated claims,
 * so `rbac.ts:541 getUserRoleFromClaims` could disagree with the
 * post-login decider for everyone except approved providers.
 *
 * What this helper does
 * ─────────────────────
 *   syncFirebaseClaims(uid, { role, blocked, accountType, ... })
 *
 *   - Reads the user's existing customClaims (preserves ones we don't
 *     own, e.g. third-party SSO claims).
 *   - Merges in our authoritative subset.
 *   - Writes via firebaseAuth.setCustomUserClaims.
 *   - Logs the diff at info level for audit.
 *   - Never throws — Firebase outages should NEVER block a role
 *     transition in Postgres. The caller proceeds; reconciliation
 *     job (future) catches drift.
 *
 * Idempotent: re-running with the same input is a no-op (we still
 * call setCustomUserClaims because Firebase doesn't expose a "skip
 * if same" path, but the values don't change).
 */

import { auth as firebaseAuth } from './firebase-admin';
import { logger } from './logger';

export interface ClaimsUpdate {
  /** Canonical role string from Postgres users.role. */
  role?: string | null;
  /** Whether the user is blocked from auth. */
  blocked?: boolean;
  /** 'internal' | 'provider' — used by rbac.ts:requireInternalAccount. */
  accountType?: string | null;
  /** When the provider was approved. */
  providerApprovedAt?: string | null;
  /** When a staff member was approved. */
  staffApprovedAt?: string | null;
}

/**
 * Sync the given Firebase user's custom claims with our authoritative
 * role + status. Non-blocking — failures are logged at warn level
 * and the function still returns. Caller continues.
 *
 * Returns true on success, false on failure (so tests can assert).
 */
export async function syncFirebaseClaims(
  uid: string,
  update: ClaimsUpdate,
): Promise<boolean> {
  if (!uid || typeof uid !== 'string') {
    logger.warn('[SyncClaims] Skipped — invalid uid', { uid });
    return false;
  }
  try {
    const userRecord = await firebaseAuth.getUser(uid);
    const existing = (userRecord.customClaims || {}) as Record<string, any>;

    const next: Record<string, any> = { ...existing };
    // Only assign fields the caller passed — leaves third-party
    // claims (SSO group memberships, custom integrations, etc.)
    // untouched.
    if (update.role !== undefined) next.role = update.role ?? null;
    if (update.blocked !== undefined) next.blocked = update.blocked;
    if (update.accountType !== undefined) next.accountType = update.accountType ?? null;
    if (update.providerApprovedAt !== undefined) next.providerApprovedAt = update.providerApprovedAt ?? null;
    if (update.staffApprovedAt !== undefined) next.staffApprovedAt = update.staffApprovedAt ?? null;

    await firebaseAuth.setCustomUserClaims(uid, next);

    logger.info('[SyncClaims] Firebase claims updated', {
      uid,
      changedKeys: Object.keys(update),
      newRole: next.role,
    });
    return true;
  } catch (err: any) {
    // Reconciliation job will pick up drift later. Do NOT block the
    // calling role transition — Postgres is the source of truth.
    logger.warn('[SyncClaims] Failed to update claims (non-blocking)', {
      uid,
      error: err?.message,
    });
    return false;
  }
}

/**
 * Convenience for the common "user just got blocked" path.
 */
export function syncBlocked(uid: string, blocked: boolean): Promise<boolean> {
  return syncFirebaseClaims(uid, { blocked });
}
