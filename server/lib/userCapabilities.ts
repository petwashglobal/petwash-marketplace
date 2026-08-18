/**
 * getUserCapabilities(uid) — server-side canonical capability resolver.
 *
 * Per CEO 2026-08-18 §35.4 + §6 + §32:
 *   ONE user. Additive capabilities. Derive from EXISTING authoritative
 *   data (do NOT add a users.capabilities column first). Do NOT invent a
 *   parallel source of truth — reuse the reads that me-status already
 *   does. Every capability below maps 1:1 to a table that already exists.
 *
 * Authoritative sources (per the 2026-08-18 capability audit):
 *   identity   → users.emailVerified + users.phoneVerified / mobileVerifiedAt
 *   prestige   → privilege_members (row exists WHERE firebase_uid=uid
 *                AND status='active')
 *   provider   → provider_applications.status (draft | pending_review |
 *                under_review | approved | rejected | withdrawn)
 *   services   → provider_services filtered by serviceStatus IN
 *                (approved_for_booking, approved_for_payout)
 *   admin      → users.role ∈ ADMIN_ROLES; superAdmin via req email
 *                allowlist (isSuperAdminVerified in rbac.ts — pass
 *                explicitly since this function has no req access)
 *
 * FAIL-SOFT: one section failing (e.g. provider_services table temporarily
 * unavailable) returns that section's safe default rather than throwing
 * away the whole capability set. Same pattern as me-status.ts.
 *
 * NOT reading users.role for provider truth: it's a CACHE of
 * provider_applications.status === 'approved' that post-login re-syncs.
 * A stale users.role='provider' where the application isn't approved
 * would over-grant. Always derive from the application row.
 */

import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../db';
import { pool } from '../db';
import { storage } from '../storage';
import { providerServices } from '@shared/schema-provider-services';
import { logger } from './logger';
import { isAdminRole } from '@shared/adminRoles';
import {
  emptyCapabilities,
  type UserCapabilities,
  type ProviderApplicationStatus,
  type ProviderServiceType,
} from '@shared/lib/userCapabilities';

const APPROVED_SERVICE_STATUSES = ['approved_for_booking', 'approved_for_payout'];

/**
 * Valid application statuses per shared/schema.ts:5316. Anything else is
 * mapped to null to keep the client contract clean.
 */
const VALID_APPLICATION_STATUSES: readonly ProviderApplicationStatus[] = [
  'draft',
  'pending_review',
  'under_review',
  'approved',
  'rejected',
  'withdrawn',
] as const;

function normalizeApplicationStatus(raw: unknown): ProviderApplicationStatus | null {
  if (typeof raw !== 'string') return null;
  const v = raw.toLowerCase();
  return (VALID_APPLICATION_STATUSES as readonly string[]).includes(v)
    ? (v as ProviderApplicationStatus)
    : null;
}

/**
 * The applicant capability is TRUE if the application exists and is in a
 * non-terminal open state. "approved" is provider.active, not applicant.
 * "rejected" and "withdrawn" are terminal — not applicant.
 */
function statusIsApplicant(s: ProviderApplicationStatus | null): boolean {
  return s === 'draft' || s === 'pending_review' || s === 'under_review';
}

export interface ResolveOptions {
  /**
   * Result of the same-request isSuperAdminVerified check (rbac.ts).
   * Passed in so this pure helper stays req-free and testable. Endpoint
   * callers should pass the value they computed on the incoming request.
   */
  superAdminVerified?: boolean;
}

export async function getUserCapabilities(
  uid: string,
  opts: ResolveOptions = {},
): Promise<UserCapabilities> {
  if (!uid) return emptyCapabilities();

  const caps = emptyCapabilities(uid);

  // ── identity (activation gate — PR-AUTH-IDENTITY-1) ───────────────────────
  let userRow: any = null;
  try {
    userRow = await storage.getUser(uid);
  } catch (e: any) {
    logger.warn('[getUserCapabilities] user load failed', { uid, err: e?.message });
  }
  if (userRow) {
    const emailVerified = !!userRow.emailVerified;
    const mobileVerified = !!(userRow.phoneVerified ?? userRow.mobileVerifiedAt);
    caps.identity = {
      emailVerified,
      mobileVerified,
      activated: emailVerified && mobileVerified,
    };
    const role = (userRow.role || '').toString().toLowerCase();
    caps.admin.admin = isAdminRole(role);
  }

  // Super-admin authority is a REQUEST-time check (email allowlist + Firebase
  // email_verified) that the caller passes in — don't re-derive here.
  caps.admin.superAdmin = !!opts.superAdminVerified;
  if (caps.admin.superAdmin) caps.admin.admin = true;

  // ── prestige (row-exists in privilege_members with status='active') ───────
  // Table declaration lives at shared/schema.ts:11825 but the routes
  // exclusively use raw SQL (see the schema.ts comment). Follow suit to
  // stay consistent with prestige-join / privilege-loyalty callers.
  try {
    const r = await pool.query(
      `SELECT member_id, tier, status
         FROM privilege_members
        WHERE firebase_uid = $1 AND status = 'active'
        LIMIT 1`,
      [uid],
    );
    const row = r.rows[0];
    if (row) {
      caps.prestige = {
        enrolled: true,
        tier: (row.tier || null) as string | null,
        memberId: (row.member_id || null) as string | null,
      };
    }
  } catch (e: any) {
    logger.warn('[getUserCapabilities] prestige load failed', { uid, err: e?.message });
  }

  // ── provider (application status + approved services) ─────────────────────
  try {
    const app = await storage.getProviderApplicationByUser(uid);
    const status = normalizeApplicationStatus((app as any)?.status);
    caps.provider.applicationStatus = status;
    caps.provider.applicant = statusIsApplicant(status);
    caps.provider.active = status === 'approved';

    if (caps.provider.active) {
      try {
        const rows = await db
          .select({ svc: providerServices.serviceType, st: providerServices.serviceStatus })
          .from(providerServices)
          .where(
            and(
              eq(providerServices.providerId, uid),
              inArray(providerServices.serviceStatus, APPROVED_SERVICE_STATUSES),
            ),
          );
        caps.provider.services = rows
          .map((r) => r.svc)
          .filter((s): s is ProviderServiceType => typeof s === 'string' && s.length > 0)
          .filter((s, i, a) => a.indexOf(s) === i) as ProviderServiceType[];
      } catch (e: any) {
        // provider_services table optional — leave services empty
        logger.warn('[getUserCapabilities] provider_services load failed', { uid, err: e?.message });
      }
    }
  } catch (e: any) {
    logger.warn('[getUserCapabilities] provider application load failed', { uid, err: e?.message });
  }

  return caps;
}
