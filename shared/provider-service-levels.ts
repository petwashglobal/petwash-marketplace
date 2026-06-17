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
