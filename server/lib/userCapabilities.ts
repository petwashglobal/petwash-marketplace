/**
 * User capabilities aggregator — the additive multi-role authority.
 *
 * Reads from the existing per-capability tables and returns a boolean
 * shape for downstream authorization/routing decisions. Deliberately
 * additive: an account can hold `customer + loyalty + provider` or
 * `customer + staff` simultaneously — no capability replaces another.
 *
 * Source tables (all already declared + populated in production):
 *   customer  — always true (base account capability)
 *   loyalty   — loyalty_profiles OR privilege_members (either row = enrolled)
 *   provider  — provider_applications.status = 'approved'
 *   staff     — staff_access_requests.status = 'approved'
 *   admin     — admin_users row OR SUPER_ADMIN_EMAILS allowlist match
 *
 * Never reads `users.role`. That scalar column is legacy — kept for
 * display / routing convenience — and MUST NOT be treated as the
 * capability authority. A provider promotion that overwrites `role`
 * from `customer` to `provider` (see server/routes/post-login.ts) is a
 * DISPLAY convenience that this aggregator ignores; the capability
 * calculation would return { customer: true, provider: true } either
 * way, because it sources from the provider_applications row.
 *
 * Fails closed: on any per-source query error the aggregator drops that
 * capability to false, so a Redis / Postgres blip cannot silently grant
 * privilege. Customer stays true because it is the base capability.
 */

import { eq } from 'drizzle-orm';
import { db } from '../db';
import { users, providerApplications, staffAccessRequests, adminUsers, privilegeMembers } from '../../shared/schema';
import { loyaltyProfiles } from '../../shared/schema-loyalty';
import { logger } from './logger';

// privilege_members links to a user by `email` (there is no userId FK on that
// table — see shared/schema.ts:11825+). loyalty_profiles is the primary
// truth for "has loyalty capability"; privilege_members is a secondary
// lookup by email for Prestige-branded enrollment.

export interface UserCapabilities {
  userId: string;
  customer: boolean;
  loyalty: boolean;
  provider: boolean;
  staff: boolean;
  admin: boolean;
}

function isSuperAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const list = (process.env.SUPER_ADMIN_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.trim().toLowerCase());
}

export async function computeCapabilities(userId: string): Promise<UserCapabilities> {
  const caps: UserCapabilities = {
    userId,
    customer: true,
    loyalty: false,
    provider: false,
    staff: false,
    admin: false,
  };

  const [userRow] = await db.select({ email: users.email })
    .from(users).where(eq(users.id, userId)).limit(1).catch(() => [] as any);
  const email = userRow?.email ?? null;

  await Promise.all([
    (async () => {
      try {
        const [row] = await db.select({ userId: loyaltyProfiles.userId })
          .from(loyaltyProfiles).where(eq(loyaltyProfiles.userId, userId)).limit(1);
        if (row) { caps.loyalty = true; return; }
        // Fallback lookup by email for Prestige-branded enrollment rows that
        // predate the loyalty_profiles-per-user convention.
        if (email) {
          const [priv] = await db.select({ id: privilegeMembers.id })
            .from(privilegeMembers).where(eq(privilegeMembers.email, email)).limit(1);
          if (priv) caps.loyalty = true;
        }
      } catch (e: any) {
        logger.warn('[Capabilities] loyalty lookup failed (defaulting false)', { userId, error: e?.message });
      }
    })(),
    (async () => {
      try {
        const [row] = await db.select({ status: providerApplications.status })
          .from(providerApplications).where(eq(providerApplications.userId, userId)).limit(1);
        caps.provider = row?.status === 'approved';
      } catch (e: any) {
        logger.warn('[Capabilities] provider lookup failed (defaulting false)', { userId, error: e?.message });
      }
    })(),
    (async () => {
      try {
        const [row] = await db.select({ status: staffAccessRequests.status })
          .from(staffAccessRequests).where(eq(staffAccessRequests.userId, userId)).limit(1);
        caps.staff = row?.status === 'approved';
      } catch (e: any) {
        logger.warn('[Capabilities] staff lookup failed (defaulting false)', { userId, error: e?.message });
      }
    })(),
    (async () => {
      try {
        if (isSuperAdminEmail(email)) { caps.admin = true; return; }
        const [row] = await db.select({ id: adminUsers.id })
          .from(adminUsers).where(eq(adminUsers.email, email ?? '')).limit(1);
        if (row) caps.admin = true;
      } catch (e: any) {
        logger.warn('[Capabilities] admin lookup failed (defaulting false)', { userId, error: e?.message });
      }
    })(),
  ]);

  return caps;
}
