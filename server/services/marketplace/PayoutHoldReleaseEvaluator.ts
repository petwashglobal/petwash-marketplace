/**
 * PayoutHoldReleaseEvaluator — CEO PROGRAM 12 + payout release rules.
 *
 * Pure evaluator. Given (booking completion signal, dispute/refund
 * state, hold days from BusinessDecisionRegistry, now), decides
 * whether a provider's payout may be RELEASED, must remain on HOLD,
 * or is BLOCKED for cause.
 *
 * Doctrine: the payout is NEVER released while a dispute is open, a
 * refund is pending, or the customer's review window is still open
 * and reviewNeededBeforePayout=true (business decision).
 */

export interface PayoutHoldInput {
  bookingCompletedAt?: string;                      // ISO
  now?: Date;
  /** Hold days from BusinessDecisionRegistry (undefined → POLICY_NOT_CONFIGURED). */
  holdDays?: number;
  hasOpenDispute: boolean;
  hasPendingRefund: boolean;
  /** True if this product requires the review window to close first. */
  reviewNeededBeforePayout?: boolean;
  reviewSubmitted?: boolean;
  reviewWindowDays?: number;
}

export type PayoutHoldOutcome =
  | { code: 'RELEASE_ALLOWED' }
  | { code: 'ON_HOLD'; reasonCode:
      | 'HOLD_WINDOW_NOT_ELAPSED'
      | 'DISPUTE_OPEN'
      | 'REFUND_PENDING'
      | 'REVIEW_WINDOW_OPEN' }
  | { code: 'BLOCKED'; reasonCode: 'POLICY_NOT_CONFIGURED' | 'NOT_COMPLETED_YET' };

export function evaluatePayoutHold(input: PayoutHoldInput): PayoutHoldOutcome {
  if (typeof input.holdDays !== 'number') return { code: 'BLOCKED', reasonCode: 'POLICY_NOT_CONFIGURED' };
  if (!input.bookingCompletedAt) return { code: 'BLOCKED', reasonCode: 'NOT_COMPLETED_YET' };

  if (input.hasOpenDispute) return { code: 'ON_HOLD', reasonCode: 'DISPUTE_OPEN' };
  if (input.hasPendingRefund) return { code: 'ON_HOLD', reasonCode: 'REFUND_PENDING' };

  const now = input.now ?? new Date();
  const completed = Date.parse(input.bookingCompletedAt);
  if (Number.isFinite(completed)) {
    const gapDays = (now.getTime() - completed) / (24 * 60 * 60 * 1000);
    if (gapDays < input.holdDays) return { code: 'ON_HOLD', reasonCode: 'HOLD_WINDOW_NOT_ELAPSED' };
    if (input.reviewNeededBeforePayout && !input.reviewSubmitted && typeof input.reviewWindowDays === 'number') {
      if (gapDays < input.reviewWindowDays) return { code: 'ON_HOLD', reasonCode: 'REVIEW_WINDOW_OPEN' };
    }
  }
  return { code: 'RELEASE_ALLOWED' };
}
