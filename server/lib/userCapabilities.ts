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

import { and, desc, eq, inArray } from 'drizzle-orm';
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
  PROVIDER_APPLICANT_STATUSES,
  type ProviderApplicationStatus,
  type ProviderServiceType,
  type UserCapabilities,
} from '@shared/lib/userCapabilities';

// Re-export the canonical type so downstream `import { UserCapabilities }
// from '../lib/userCapabilities'` sites keep resolving to the SAME shape
// the client uses.
export type { UserCapabilities } from '@shared/lib/userCapabilities';

// Provider service rows only count toward `services` when their status is
// in one of the two "approved for real work" buckets (matches me-status.ts).
const APPROVED_SERVICE_STATUSES = ['approved_for_booking', 'approved_for_payout'] as const;

// Application rows in these statuses mean "user has an in-flight application"
// (applicant = true) but is NOT yet an active provider.
//
// 2026-09-05 CORRECTNESS FIX — this set used to be the three-value literal
// ['draft','pending_review','under_review'], which did NOT contain 'pending'
// — the ONLY status POST /api/provider-onboarding/apply ever writes
// (provider-onboarding.ts `status: 'pending'`). So EVERY provider who
// actually submitted an application came back `applicant: false`, and the
// Become-Provider router could not tell "already applied, waiting" from
// "never applied" — it pushed them back into the wizard, where the
// duplicate-submit guard 409s them (APPLICATION_EXISTS). Dead end.
// It also missed 'processing', 'pending_resubmission' and 'on_hold'.
// The list now lives in shared/ next to the status union so the two
// cannot drift again.
const APPLICANT_STATUSES = new Set<ProviderApplicationStatus>(PROVIDER_APPLICANT_STATUSES);

/**
 * Pick the ONE authoritative provider_applications row out of however many
 * a user happens to hold. Pure so it can be tested without a database.
 *
 * @param rows statuses ALREADY ordered newest-first
 *             (createdAt DESC, id DESC — see the caller).
 *
 * Rule: newest NON-draft row wins; if the user has only draft placeholders,
 * the newest draft is used. Never "any row with status approved" — that
 * would make provider authority survive a later rejection.
 */
export function resolveAuthoritativeApplicationStatus(
  rows: ReadonlyArray<{ status: string | null }>,
): ProviderApplicationStatus | null {
  const row = rows.find((r) => r.status && r.status !== 'draft') ?? rows[0] ?? null;
  return (row?.status ?? null) as ProviderApplicationStatus | null;
}

/**
 * Map an application status to the two provider capability booleans.
 * Fail-closed: an unrecognised status grants neither.
 */
export function deriveProviderStates(
  status: ProviderApplicationStatus | null,
): { active: boolean; applicant: boolean } {
  return {
    active: status === 'approved',
    applicant: !!status && APPLICANT_STATUSES.has(status),
  };
}

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
        // AUTHORITY ROW SELECTION — deterministic, fail-closed.
        //
        // `provider_applications` has NO unique index on user_id (see
        // migrations/0003_thin_strong_guy.sql — only application_id is
        // unique) and the submit guard in provider-onboarding.ts only
        // blocks re-apply while a row is IN FLIGHT. So one user can hold
        // several rows: {rejected, pending}, {approved, draft}, …
        //
        // This query used to be a bare `.limit(1)` with NO ORDER BY. With
        // several rows, Postgres is free to return ANY of them, so provider
        // authority was effectively arbitrary:
        //   • rejected-then-re-applied → could still read the stale
        //     'rejected' row and hide the live application, or
        //   • approved-then-decided-again → could keep reading the OLD
        //     'approved' row, so the newer decision never revoked
        //     `provider.active`. Authority surviving a revocation.
        //
        // Rule now: the AUTHORITATIVE row is the most recently created
        // NON-DRAFT row. Drafts are placeholders the post-login flow
        // auto-creates on provider intent (see the "Replace any
        // auto-created draft" delete in provider-onboarding.ts); letting a
        // fresh placeholder be "latest" would silently demote a live
        // approved provider on their next sign-in. When only drafts exist
        // the newest draft is used (applicant = true, active = false).
        const rows = await db
          .select({ status: providerApplications.status })
          .from(providerApplications)
          .where(eq(providerApplications.userId, userId))
          .orderBy(desc(providerApplications.createdAt), desc(providerApplications.id));

        const status = resolveAuthoritativeApplicationStatus(rows);
        const { active, applicant } = deriveProviderStates(status);
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
