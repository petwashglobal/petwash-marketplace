/**
 * Pure (DB-free, isomorphic) per-service approval ladder + decision.
 * Server's providerServiceApproval.ts wraps this with a DB lookup; this file
 * is unit-testable on its own.
 *
 * Rule: a provider approved for one service is NOT approved for another, and
 * approved-for-booking is NOT approved-for-payout.
 */
export type ServiceLevel = 'waitlist' | 'profile' | 'booking' | 'payout';

// Monotonic ladder — a higher rank includes everything below it.
export const STATUS_RANK: Record<string, number> = {
  not_started: 0, draft: 1, submitted: 2, missing_requirements: 2, pending_review: 3,
  approved_for_waitlist: 4, approved_for_profile_display: 5,
  approved_for_booking: 6, approved_for_payout: 7,
};
export const LEVEL_MIN_RANK: Record<ServiceLevel, number> = { waitlist: 4, profile: 5, booking: 6, payout: 7 };

// Statuses that block regardless of rank.
export const BLOCKED_STATUSES = new Set([
  'suspended', 'rejected', 'expired_documents', 'needs_reconfirmation',
  'paused_by_provider', 'paused_by_admin',
]);

/**
 * Canonical service-type keys for provider_services rows.
 *
 * The codebase has divergent service-type vocabularies (a known issue — see the
 * three booking engines): provider APPLICATIONS use long forms
 * (`dog_walking`, `pet_sitting`, `grooming`, `pet_training`, `pet_transport`),
 * while marketplace BOOKINGS use short forms (`sitting`, `walking`, `training`,
 * `pettrek`). If provider_services rows were keyed by one vocabulary and the gate
 * looked up by the other, the gate would silently never match — either blocking
 * every new provider or being bypassed entirely. Both are money/trust hazards.
 *
 * normalizeServiceType collapses every known alias to ONE canonical key so the
 * INSERT-on-approval and the gate lookups always agree. Unknown values are
 * lower-cased and passed through unchanged (never throws) so the system degrades
 * predictably rather than crashing a booking or payout.
 */
export type CanonicalServiceType =
  | 'pet_sitting' | 'dog_walking' | 'pet_training' | 'pet_transport' | 'grooming';

const SERVICE_TYPE_ALIASES: Record<string, CanonicalServiceType> = {
  // pet sitting
  pet_sitting: 'pet_sitting', petsitting: 'pet_sitting', sitting: 'pet_sitting',
  sitter: 'pet_sitting', petsitter: 'pet_sitting', boarding: 'pet_sitting',
  // dog walking
  dog_walking: 'dog_walking', dogwalking: 'dog_walking', walking: 'dog_walking',
  walk: 'dog_walking', walker: 'dog_walking', walkers: 'dog_walking',
  // training
  pet_training: 'pet_training', training: 'pet_training', trainer: 'pet_training',
  academy: 'pet_training',
  // transport
  pet_transport: 'pet_transport', transport: 'pet_transport', pettrek: 'pet_transport',
  driver: 'pet_transport', driving: 'pet_transport',
  // grooming
  grooming: 'grooming', groomer: 'grooming',
};

export function normalizeServiceType(serviceType?: string | null): string {
  if (!serviceType) return '';
  const key = String(serviceType).trim().toLowerCase();
  return SERVICE_TYPE_ALIASES[key] ?? key;
}

export interface ServiceApprovalResult { ok: boolean; status: string | null; reason?: string; }
export interface ServiceRowLike {
  serviceStatus: string;
  bookingEnabled: boolean;
  payoutEnabled: boolean;
  pausedByProvider: boolean;
  pausedByAdmin: boolean;
}

export function isServiceApprovedFor(row: ServiceRowLike | null | undefined, level: ServiceLevel): ServiceApprovalResult {
  if (!row) return { ok: false, status: null, reason: 'SERVICE_NOT_SET_UP' };
  if (row.pausedByProvider) return { ok: false, status: row.serviceStatus, reason: 'PAUSED_BY_PROVIDER' };
  if (row.pausedByAdmin) return { ok: false, status: row.serviceStatus, reason: 'PAUSED_BY_ADMIN' };
  if (BLOCKED_STATUSES.has(row.serviceStatus)) return { ok: false, status: row.serviceStatus, reason: `BLOCKED_STATUS_${row.serviceStatus.toUpperCase()}` };

  const rank = STATUS_RANK[row.serviceStatus] ?? 0;
  if (rank < LEVEL_MIN_RANK[level]) return { ok: false, status: row.serviceStatus, reason: `NEEDS_${level.toUpperCase()}_APPROVAL` };

  // The explicit flag must also be on for money-flow levels — status alone can
  // never enable booking/payout without the operator toggling it.
  if (level === 'booking' && !row.bookingEnabled) return { ok: false, status: row.serviceStatus, reason: 'BOOKING_NOT_ENABLED' };
  if (level === 'payout' && !row.payoutEnabled) return { ok: false, status: row.serviceStatus, reason: 'PAYOUT_NOT_ENABLED' };
  return { ok: true, status: row.serviceStatus };
}
