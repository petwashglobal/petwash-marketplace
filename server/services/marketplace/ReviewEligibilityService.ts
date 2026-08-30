/**
 * ReviewEligibilityService — CEO PROGRAM 28 (Reviews).
 *
 * Pure evaluator. A review can only be left when ALL of the
 * doctrine's conditions are met:
 *   • The booking is COMPLETED.
 *   • The service was VERIFIED (handoff completed on both sides
 *     where the product requires it).
 *   • The reviewer is the customer.
 *   • The customer is not reviewing themselves.
 *   • No prior review exists for this booking from this reviewer.
 *   • The review window (business decision) has not lapsed.
 */

export type ReviewEligibilityOutcome =
  | { code: 'ELIGIBLE' }
  | { code: 'INELIGIBLE'; reasonCode:
      | 'BOOKING_NOT_COMPLETED'
      | 'SERVICE_NOT_VERIFIED'
      | 'ACTOR_NOT_CUSTOMER'
      | 'SELF_REVIEW_BLOCKED'
      | 'ALREADY_REVIEWED'
      | 'REVIEW_WINDOW_LAPSED'
      | 'POLICY_NOT_CONFIGURED' };

export interface ReviewEligibilityInput {
  bookingStatus: 'REQUESTED' | 'QUOTED' | 'PROVIDER_PROPOSED_CHANGE' | 'ACCEPTED' | 'CONFIRMED' | 'READY_TO_START' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'DECLINED' | 'EXPIRED';
  serviceVerified: boolean;                 // handoff completed where required
  actorRole: 'CUSTOMER' | 'PROVIDER' | 'ADMIN' | 'SYSTEM';
  actorUid: string;
  customerUid: string;
  providerUid: string;
  hasExistingReview: boolean;
  completedAt?: string;                     // ISO
  now?: Date;
  /** Business decision — days after COMPLETED that the review window stays open. Undefined → POLICY_NOT_CONFIGURED. */
  reviewWindowDays?: number;
}

export function evaluateReviewEligibility(input: ReviewEligibilityInput): ReviewEligibilityOutcome {
  if (input.bookingStatus !== 'COMPLETED') return { code: 'INELIGIBLE', reasonCode: 'BOOKING_NOT_COMPLETED' };
  if (!input.serviceVerified) return { code: 'INELIGIBLE', reasonCode: 'SERVICE_NOT_VERIFIED' };
  if (input.actorRole !== 'CUSTOMER') return { code: 'INELIGIBLE', reasonCode: 'ACTOR_NOT_CUSTOMER' };
  if (input.actorUid !== input.customerUid) return { code: 'INELIGIBLE', reasonCode: 'ACTOR_NOT_CUSTOMER' };
  if (input.actorUid === input.providerUid) return { code: 'INELIGIBLE', reasonCode: 'SELF_REVIEW_BLOCKED' };
  if (input.hasExistingReview) return { code: 'INELIGIBLE', reasonCode: 'ALREADY_REVIEWED' };
  if (typeof input.reviewWindowDays !== 'number') return { code: 'INELIGIBLE', reasonCode: 'POLICY_NOT_CONFIGURED' };
  if (input.completedAt) {
    const now = input.now ?? new Date();
    const completed = new Date(input.completedAt).getTime();
    if (Number.isFinite(completed)) {
      const gapDays = (now.getTime() - completed) / (24 * 60 * 60 * 1000);
      if (gapDays > input.reviewWindowDays) {
        return { code: 'INELIGIBLE', reasonCode: 'REVIEW_WINDOW_LAPSED' };
      }
    }
  }
  return { code: 'ELIGIBLE' };
}
