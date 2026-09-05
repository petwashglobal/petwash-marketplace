/**
 * User Capabilities — canonical shape for what a PetWash user can do.
 *
 * Per CEO 2026-08-18 §6 "Rover-quality multi-role is P0":
 *   ONE user. Additive capabilities. No mutation of user.role on mode switch.
 *   Do not blindly add a users.capabilities JSON column first — audit current
 *   authoritative data (§32: no parallel domain services).
 *
 * These types are consumed by BOTH server (getUserCapabilities in
 * server/lib/userCapabilities.ts) and client (mode switch, ProviderPending,
 * Become Provider router). Shared so drift is impossible.
 *
 * Authority: every field derives from ONE authoritative table — no cache
 * copies (e.g. users.role is a CACHE of provider_applications.status =
 * 'approved' and is DELIBERATELY not the source of truth here).
 */

/**
 * Every status that is actually written to `provider_applications.status`
 * in this repo. The union used to list only six of them, and the server
 * aggregator's "in-flight" set listed only three — which silently excluded
 * `'pending'`, the ONE status the live submit endpoint
 * (POST /api/provider-onboarding/apply) writes. Result: every real
 * applicant came back `applicant: false`.
 *
 * Writers (grep `providerApplications` + `status:`):
 *   draft                 — post-login placeholder row
 *   pending               — POST /api/provider-onboarding/apply
 *   pending_review        — legacy submit paths
 *   under_review          — AdminProviderReviewService (claim / resume)
 *   processing            — provider-onboarding resubmission
 *   pending_resubmission  — admin asked for more documents
 *   on_hold               — AdminProviderReviewService hold
 *   approved              — human admin approval  (the ONLY active state)
 *   rejected              — human admin rejection (terminal)
 *   withdrawn             — applicant withdrew    (terminal)
 */
export type ProviderApplicationStatus =
  | 'draft'
  | 'pending'
  | 'pending_review'
  | 'under_review'
  | 'processing'
  | 'pending_resubmission'
  | 'on_hold'
  | 'approved'
  | 'rejected'
  | 'withdrawn';

/**
 * In-flight (= "has a live application", NOT "is a provider"). Anything
 * outside this set and outside `'approved'` is terminal or unknown and
 * grants nothing — the aggregator defaults closed on an unrecognised
 * value rather than guessing.
 */
export const PROVIDER_APPLICANT_STATUSES: readonly ProviderApplicationStatus[] = [
  'draft',
  'pending',
  'pending_review',
  'under_review',
  'processing',
  'pending_resubmission',
  'on_hold',
] as const;

/** Terminal, no authority, no in-flight application. */
export const PROVIDER_TERMINAL_STATUSES: readonly ProviderApplicationStatus[] = [
  'rejected',
  'withdrawn',
] as const;

/**
 * The approved service catalog for a provider. Matches the DB enum in
 * shared/schema-provider-services.ts. Extend when new service types launch.
 */
export type ProviderServiceType =
  | 'dog_walking'
  | 'pet_sitting'
  | 'training'
  | 'boarding'
  | 'drop_in'
  | 'pet_transport'
  | 'k9000_wash';

export interface UserCapabilities {
  userId: string;

  /**
   * IDENTITY — the PR-AUTH-IDENTITY-1 gate: both contacts verified means
   * the user is a fully-activated customer. Everything else is additive.
   */
  identity: {
    emailVerified: boolean;
    mobileVerified: boolean;
    /** True when BOTH emailVerified and mobileVerified — the "customer" capability. */
    activated: boolean;
  };

  /**
   * PRESTIGE — enrollment truth is a row in privilege_members with
   * status='active'. Tier + memberId come from the same row.
   * NEVER derive from age alone (that was the me-status.ts bug).
   */
  prestige: {
    enrolled: boolean;
    tier: string | null;
    memberId: string | null;
  };

  /**
   * PROVIDER — three related states:
   *   applicant: the authoritative application row is in a non-terminal
   *              state (see PROVIDER_APPLICANT_STATUSES).
   *   active:    application.status === 'approved'.
   *   services:  approved service types (from provider_services table
   *              filtered by serviceStatus IN approved_for_booking /
   *              approved_for_payout). Only populated when active === true.
   */
  provider: {
    applicant: boolean;
    active: boolean;
    applicationStatus: ProviderApplicationStatus | null;
    services: ProviderServiceType[];
  };

  /**
   * STAFF — internal-role capability. Authority is a row in
   * staff_access_requests with status = 'approved'. Additive: a staffer
   * keeps their customer/loyalty capability at the same time.
   */
  staff: {
    active: boolean;
  };

  /**
   * ADMIN — canonical source is the isSuperAdminVerified check (email in
   * SUPER_ADMIN_EMAILS allowlist AND Firebase email_verified). Regular
   * admin roles come from users.role ∈ ADMIN_ROLES.
   */
  admin: {
    admin: boolean;
    superAdmin: boolean;
  };
}

/** Empty capabilities for an unauthenticated / unknown user. */
export function emptyCapabilities(userId = ''): UserCapabilities {
  return {
    userId,
    identity: { emailVerified: false, mobileVerified: false, activated: false },
    prestige: { enrolled: false, tier: null, memberId: null },
    provider: { applicant: false, active: false, applicationStatus: null, services: [] },
    staff: { active: false },
    admin: { admin: false, superAdmin: false },
  };
}

/** Convenience predicates — same rule on server and client so gates match. */
export const hasCustomerCapability      = (c: UserCapabilities): boolean => c.identity.activated;
export const hasPrestigeCapability      = (c: UserCapabilities): boolean => c.prestige.enrolled;
export const hasProviderCapability      = (c: UserCapabilities): boolean => c.provider.active;
export const hasApplicantCapability     = (c: UserCapabilities): boolean => c.provider.applicant;
export const hasStaffCapability         = (c: UserCapabilities): boolean => c.staff.active;
export const hasAdminCapability         = (c: UserCapabilities): boolean => c.admin.admin || c.admin.superAdmin;
export const hasWalkerCapability        = (c: UserCapabilities): boolean =>
  c.provider.active && c.provider.services.includes('dog_walking');
export const hasSitterCapability        = (c: UserCapabilities): boolean =>
  c.provider.active && c.provider.services.includes('pet_sitting');
export const hasTrainerCapability       = (c: UserCapabilities): boolean =>
  c.provider.active && c.provider.services.includes('training');

/**
 * Canonical roles list for a capability set. Order is fixed:
 * `['customer','provider','staff','admin']` — only the true capabilities
 * appear. Used by /api/session/whoami so callers see every capability
 * the user actually holds, not the single mutable users.role.
 *
 * ROLE MODEL (CEO 2026-08-26): Prestige is NOT a role — it is a
 * membership entitlement. It used to be emitted as `'loyalty'` here,
 * which made every downstream `roles.includes('loyalty')` check treat
 * Prestige as a workspace peer to provider/staff. That was the same
 * anti-pattern that put "Prestige" in the mode picker and gave enrolled
 * members a separate destination. Callers that need to know Prestige
 * enrollment read `capabilities.prestige.enrolled` directly.
 */
export function rolesFromCapabilities(c: UserCapabilities): string[] {
  const out: string[] = [];
  if (hasCustomerCapability(c))  out.push('customer');
  if (hasProviderCapability(c))  out.push('provider');
  if (hasStaffCapability(c))     out.push('staff');
  if (hasAdminCapability(c))     out.push('admin');
  return out;
}
