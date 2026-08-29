/**
 * User capabilities aggregator — the additive multi-role authority.
 *
 * Reads from the existing per-capability tables and returns the CANONICAL
 * nested UserCapabilities shape declared in `shared/lib/userCapabilities.ts`.
 * There is ONE shape shared by server + client — no drift, no adapters.
 *
 * Additive: an account can hold `customer + loyalty + provider` or
 * `customer + staff` simultaneously — no capability replaces another.
 *
 * Source tables (all already declared + populated in production):
 *   identity   — users.email_verified + users.phone_verified
 *                (activated ⇔ BOTH verified — the PR-AUTH-IDENTITY-1 gate)
 *   prestige   — privilege_members (by email) — tier + memberId
 *   provider   — provider_applications.status (+ provider_services for `services`)
 *   staff      — staff_access_requests.status = 'approved'
 *   admin      — admin_users row OR SUPER_ADMIN_EMAILS allowlist (verified)
 *
 * Never reads `users.role`. That scalar column is a legacy cache — kept
 * for display / routing convenience — and MUST NOT be treated as the
 * capability authority. A provider promotion that used to overwrite
 * `role` from `customer` to `provider` was removed on 2026-08-20 as part
 * of the multi-role wiring fixes; this aggregator sourced from
 * provider_applications the whole time so nothing changes for callers.
 *
 * Fails soft: on any per-source query error the aggregator leaves that
 * sub-capability at its default (false / empty), so a Redis / Postgres
 * blip cannot silently grant privilege.
 */

import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../db';
import {
  users,
  providerApplications,
  staffAccessRequests,
  adminUsers,
  privilegeMembers,
} from '../../shared/schema';
import { providerServices } from '../../shared/schema-provider-services';
import { logger } from './logger';
import {
  emptyCapabilities,
  type ProviderApplicationStatus,
  type ProviderServiceType,
  type UserCapabilities,
} from '@shared/lib/userCapabilities';

// Re-export the canonical type so downstream `import { UserCapabilities }
// from '../lib/userCapabilities'` sites keep resolving to the SAME shape
// the client uses.
export type { UserCapabilities } from '@shared/lib/userCapabilities';

/**
 * CEO FLY MODE II §1–§3 (2026-08-29) — TRI-STATE security capability
 * resolution.
 *
 * BUG THE CEO CAUGHT: getUserCapabilities() swallows every per-source
 * DB error and defaults to `admin=false / staff=false`. That means
 * `hasAdminOrStaffCapability(uid, { onError: true })` NEVER sees the
 * throw, its `onError` branch NEVER fires, and a capability-DB
 * outage silently returned `false` — which for an MFA gate means
 * "MFA not required" for a privileged human whose claim was stale.
 * Fail-CLOSED was a fiction.
 *
 * FIX: resolveSecurityCapabilities() distinguishes three outcomes:
 *   • { ok: true,  capabilities }     — we CHECKED and know the answer.
 *   • { ok: false, reason: 'LOOKUP_FAILED' } — DB failed; caller must
 *     apply the security policy for uncertainty (fail-CLOSED for MFA +
 *     admin gates: require MFA / deny privileged continuation).
 *
 * The display-oriented getUserCapabilities() keeps its fail-soft
 * behaviour so dashboards do not blow up on a Prestige blip. Security
 * gates MUST call resolveSecurityCapabilities() instead — the
 * hasAdminOrStaffCapability() shim below already does.
 */

export type SecurityCapabilityResolution =
  | { ok: true; capabilities: UserCapabilities }
  | { ok: false; reason: 'LOOKUP_FAILED' | 'MISSING_UID' };

/**
 * Read the security-critical capability sources (user row, admin
 * table, staff table, super-admin allowlist) with STRICT error
 * propagation. Any per-source failure resolves to
 * { ok: false, reason: 'LOOKUP_FAILED' } so callers can apply their
 * fail-CLOSED policy explicitly.
 *
 * Prestige + provider signals are read too (best-effort) so callers
 * that want them can piggyback, but their failure does NOT downgrade
 * the resolution to `ok:false` — they are not admin/staff signals.
 */
export async function resolveSecurityCapabilities(
  uid: string | undefined | null,
): Promise<SecurityCapabilityResolution> {
  if (!uid) return { ok: false, reason: 'MISSING_UID' };

  const caps = emptyCapabilities(uid);
  // ── STEP 1: user row — MUST succeed so we know the email for admin
  //           + super-admin allowlist lookups. Any DB failure here is
  //           terminal for the security decision.
  let email: string | null = null;
  let emailVerified = false;
  let phoneVerified = false;
  try {
    const [row] = await db
      .select({
        email: users.email,
        emailVerified: users.emailVerified,
        phoneVerified: users.phoneVerified,
      })
      .from(users)
      .where(eq(users.id, uid))
      .limit(1);
    if (row) {
      email = row.email ?? null;
      emailVerified = !!row.emailVerified;
      phoneVerified = !!row.phoneVerified;
    }
  } catch (e: any) {
    logger.error('[Capabilities] resolveSecurityCapabilities — user row lookup failed (fail-CLOSED)', {
      uid,
      error: e?.message,
    });
    return { ok: false, reason: 'LOOKUP_FAILED' };
  }

  caps.identity = {
    emailVerified,
    mobileVerified: phoneVerified,
    activated: emailVerified && phoneVerified,
  };

  // ── STEP 2: admin row — MUST succeed.
  try {
    if (email) {
      const [row] = await db
        .select({ id: adminUsers.id })
        .from(adminUsers)
        .where(eq(adminUsers.email, email))
        .limit(1);
      if (row) caps.admin.admin = true;
    }
  } catch (e: any) {
    logger.error('[Capabilities] resolveSecurityCapabilities — admin row lookup failed (fail-CLOSED)', {
      uid,
      error: e?.message,
    });
    return { ok: false, reason: 'LOOKUP_FAILED' };
  }

  // ── STEP 3: super-admin allowlist (env-driven — cannot fail on DB).
  if (isSuperAdminEmail(email)) {
    caps.admin.admin = true;
    // superAdmin bit is only set by getUserCapabilities() when the
    // caller has independently verified email_verified (see
    // GetUserCapabilitiesOptions.superAdminVerified). Security gates
    // that need the strict variant should verify separately — the
    // shim below treats `admin.admin` as sufficient for privilege.
  }

  // ── STEP 4: staff row — MUST succeed.
  try {
    const [row] = await db
      .select({ status: staffAccessRequests.status })
      .from(staffAccessRequests)
      .where(eq(staffAccessRequests.userId, uid))
      .limit(1);
    caps.staff.active = row?.status === 'approved';
  } catch (e: any) {
    logger.error('[Capabilities] resolveSecurityCapabilities — staff row lookup failed (fail-CLOSED)', {
      uid,
      error: e?.message,
    });
    return { ok: false, reason: 'LOOKUP_FAILED' };
  }

  return { ok: true, capabilities: caps };
}

/**
 * hasAdminOrStaffCapability — SECURITY gate shim.
 *
 * Contract:
 *   • resolved + privileged  → true  (allow / require MFA)
 *   • resolved + ordinary    → false (route continues per non-priv policy)
 *   • unavailable            → opts.onError (fail-CLOSED for MFA gates:
 *                              onError:true → treat as privileged → REQUIRE
 *                              MFA; admin authorization gates:
 *                              onError:false → deny)
 *
 * A "resolved" answer here means resolveSecurityCapabilities returned
 * ok:true. An `ok:false` result is the real DB-uncertainty branch the
 * previous swallow-then-default implementation could not distinguish
 * from a definite "not privileged" — see CEO FLY MODE II §1.
 */
export async function hasAdminOrStaffCapability(
  uid: string | undefined | null,
  opts: { onError?: boolean } = {},
): Promise<boolean> {
  const res = await resolveSecurityCapabilities(uid);
  if (!res.ok) {
    // MISSING_UID is a caller bug (no identity to check) — apply the
    // same fail-CLOSED contract as LOOKUP_FAILED so no code path can
    // sneak an unauthenticated call past the guard.
    logger.warn('[Capabilities] hasAdminOrStaffCapability unresolved', {
      uid,
      reason: res.reason,
      onError: opts.onError ?? false,
    });
    return opts.onError ?? false;
  }
  const caps = res.capabilities;
  return !!(caps.admin?.superAdmin || caps.admin?.admin || caps.staff?.active);
}

// Provider service rows only count toward `services` when their status is
// in one of the two "approved for real work" buckets (matches me-status.ts).
const APPROVED_SERVICE_STATUSES = ['approved_for_booking', 'approved_for_payout'] as const;

// Application rows in these statuses mean "user has an in-flight application"
// (applicant = true) but is NOT yet an active provider.
const APPLICANT_STATUSES = new Set<ProviderApplicationStatus>([
  'draft',
  'pending_review',
  'under_review',
]);

function isSuperAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const list = (process.env.SUPER_ADMIN_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.trim().toLowerCase());
}

export interface GetUserCapabilitiesOptions {
  /**
   * When the caller has already run the stricter isSuperAdminVerified check
   * (email in SUPER_ADMIN_EMAILS AND Firebase email_verified === true),
   * pass true so the aggregator surfaces `admin.superAdmin = true`. Without
   * verification we still consult the allowlist as a soft signal for
   * `admin.admin`, but never mark superAdmin from an unverified email.
   */
  superAdminVerified?: boolean;
}

/**
 * getUserCapabilities — the ONE aggregator. Returns the canonical nested
 * UserCapabilities shape from shared/lib/userCapabilities.ts.
 *
 * On complete failure returns the empty-capabilities shape (least privilege)
 * for the given userId — never throws.
 */
export async function getUserCapabilities(
  userId: string,
  opts: GetUserCapabilitiesOptions = {},
): Promise<UserCapabilities> {
  const caps = emptyCapabilities(userId);
  if (!userId) return caps;

  // Base user row — needed for email lookups (prestige + admin) and for
  // the identity capability. Fail-soft: an empty user row leaves all
  // capabilities at their defaults.
  let email: string | null = null;
  let emailVerified = false;
  let phoneVerified = false;
  try {
    const [row] = await db
      .select({
        email: users.email,
        emailVerified: users.emailVerified,
        phoneVerified: users.phoneVerified,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (row) {
      email = row.email ?? null;
      emailVerified = !!row.emailVerified;
      phoneVerified = !!row.phoneVerified;
    }
  } catch (e: any) {
    logger.warn('[Capabilities] user lookup failed (defaulting empty)', { userId, error: e?.message });
  }

  caps.identity = {
    emailVerified,
    mobileVerified: phoneVerified,
    activated: emailVerified && phoneVerified,
  };

  await Promise.all([
    // ── PRESTIGE ─────────────────────────────────────────────────────────
    (async () => {
      if (!email) return;
      try {
        const [row] = await db
          .select({
            memberId: privilegeMembers.memberId,
            tier: privilegeMembers.tier,
            status: privilegeMembers.status,
          })
          .from(privilegeMembers)
          .where(eq(privilegeMembers.email, email))
          .limit(1);
        if (row && (row.status ?? 'active') === 'active') {
          caps.prestige = {
            enrolled: true,
            tier: row.tier ?? null,
            memberId: row.memberId ?? null,
          };
        }
      } catch (e: any) {
        logger.warn('[Capabilities] prestige lookup failed (defaulting false)', { userId, error: e?.message });
      }
    })(),

    // ── PROVIDER ─────────────────────────────────────────────────────────
    (async () => {
      try {
        const [row] = await db
          .select({ status: providerApplications.status })
          .from(providerApplications)
          .where(eq(providerApplications.userId, userId))
          .limit(1);
        const status = (row?.status ?? null) as ProviderApplicationStatus | null;
        const active = status === 'approved';
        const applicant = !!status && APPLICANT_STATUSES.has(status);
        caps.provider.applicationStatus = status;
        caps.provider.active = active;
        caps.provider.applicant = applicant;

        if (active) {
          try {
            const svcRows = await db
              .select({ svc: providerServices.serviceType })
              .from(providerServices)
              .where(and(
                eq(providerServices.providerId, userId),
                inArray(providerServices.serviceStatus, APPROVED_SERVICE_STATUSES as unknown as string[]),
              ));
            caps.provider.services = svcRows
              .map((r) => r.svc as ProviderServiceType)
              .filter(Boolean);
          } catch (e: any) {
            logger.warn('[Capabilities] provider services lookup failed (defaulting empty)', { userId, error: e?.message });
          }
        }
      } catch (e: any) {
        logger.warn('[Capabilities] provider lookup failed (defaulting false)', { userId, error: e?.message });
      }
    })(),

    // ── STAFF ────────────────────────────────────────────────────────────
    (async () => {
      try {
        const [row] = await db
          .select({ status: staffAccessRequests.status })
          .from(staffAccessRequests)
          .where(eq(staffAccessRequests.userId, userId))
          .limit(1);
        caps.staff.active = row?.status === 'approved';
      } catch (e: any) {
        logger.warn('[Capabilities] staff lookup failed (defaulting false)', { userId, error: e?.message });
      }
    })(),

    // ── ADMIN ────────────────────────────────────────────────────────────
    (async () => {
      try {
        // Row in admin_users → admin. SUPER_ADMIN_EMAILS allowlist → admin
        // as a soft signal; superAdmin only when the caller has verified
        // the email via isSuperAdminVerified (Firebase email_verified === true).
        if (email) {
          const [row] = await db
            .select({ id: adminUsers.id })
            .from(adminUsers)
            .where(eq(adminUsers.email, email))
            .limit(1);
          if (row) caps.admin.admin = true;
        }
        if (isSuperAdminEmail(email)) {
          caps.admin.admin = true;
          if (opts.superAdminVerified) caps.admin.superAdmin = true;
        }
      } catch (e: any) {
        logger.warn('[Capabilities] admin lookup failed (defaulting false)', { userId, error: e?.message });
      }
    })(),
  ]);

  return caps;
}
