/**
 * MarketplaceRelationship — CEO Integrity Doctrine §7.3 / §36 / §37.
 *
 * "They met because of PetWash." The relationship record links a customer
 * ↔ provider pair and tracks the introduction lifecycle. It is used by:
 *
 *   • Rebook UX (integrity §9) — surface the past provider fast.
 *   • Integrity signals (§7) — a repeated cancel-after-contact pattern is
 *     a multi-signal input, never guilt on its own.
 *   • Support (§66) — support already knows which booking.
 *   • Context (§38) — inbox rendering + suggested actions.
 *
 * It is NOT a permission grant. Per-booking phase permissions still apply
 * (§37). A closed relationship does not grant the provider a right to keep
 * contacting the customer.
 */

export type RelationshipSource =
  | 'SEARCH'
  | 'RECOMMENDATION'
  | 'MEET_AND_GREET'
  | 'REBOOK'
  | 'ADMIN';

export type RelationshipStatus = 'ACTIVE' | 'DORMANT' | 'CLOSED';

export interface MarketplaceRelationship {
  relationshipId: string;
  customerUid: string;
  providerUid: string;
  introducedAt: string;                 // ISO — first evidence
  source: RelationshipSource;
  firstBookingId?: string;
  lastBookingId?: string;
  lastActivityAt?: string;              // ISO — latest booking / M&G / rebook
  status: RelationshipStatus;
}

/**
 * Introduce a fresh pair. Called by the server when a search-driven booking
 * request is created, or when a Meet & Greet is scheduled, or when an admin
 * manually links two accounts. Idempotent: repeated calls for the same pair
 * MUST return the existing relationship — never a duplicate.
 */
export interface IntroductionInput {
  customerUid: string;
  providerUid: string;
  source: RelationshipSource;
  now?: string; // for tests
}

export interface IntroductionResult {
  relationship: MarketplaceRelationship;
  created: boolean;
}

/**
 * Business rule: NEVER auto-close a relationship that has an active
 * booking. Callers pass in the booking count so the transition is
 * deterministic.
 */
export function computeRelationshipStatus(
  activeBookingCount: number,
  daysSinceLastActivity: number,
): RelationshipStatus {
  if (activeBookingCount > 0) return 'ACTIVE';
  if (daysSinceLastActivity < 60) return 'ACTIVE';
  if (daysSinceLastActivity < 365) return 'DORMANT';
  return 'CLOSED';
}

/**
 * Guard used by the rebook UX. A CLOSED relationship still shows in
 * search — but the "Book Again" fast path is hidden and the customer must
 * re-enter the funnel. This protects both parties from stale identity
 * assumptions after a long gap.
 */
export function canFastRebook(rel: MarketplaceRelationship): boolean {
  return rel.status === 'ACTIVE' || rel.status === 'DORMANT';
}
