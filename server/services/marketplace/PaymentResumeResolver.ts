/**
 * PaymentResumeResolver — CEO §12, task #151.
 *
 * The resume-time complement to PaymentUncertaintyResolver.
 *
 * When a user comes back after a crash (browser close, network drop,
 * device switch) and the wizard has a JourneyCheckpoint on a payment-
 * bearing flow (CHECKOUT / SHOP_CART / EGIFT_PURCHASE / REFUND), the
 * client must NEVER guess that "PAY_AGAIN" is the safe move.
 *
 * §12 rule: "NEVER guess payment after crash." The correct next
 * action depends on which side of the payment the checkpoint sits:
 *
 *   PRE_PAYMENT        — no charge attempted yet → SAFE_TO_PROCEED.
 *   PAYMENT_IN_FLIGHT  — a charge may or may not have gone through
 *                        → MUST_CHECK_STATUS_FIRST (never re-charge).
 *   POST_PAYMENT       — payment landed but a downstream step
 *                        (fiscal doc, provider notify, calendar
 *                        write) failed → RESUME_POST_PAYMENT (retry
 *                        the non-money side; never re-charge).
 *
 * This evaluator is PURE — snapshot in, verdict out. The runtime
 * router mounts it at every resume link.
 */

import type {
  UncertaintyVerdict,
} from './PaymentUncertaintyResolver';

/** Where the checkpoint sits relative to the money movement. */
export type PaymentCheckpointPhase = 'PRE_PAYMENT' | 'PAYMENT_IN_FLIGHT' | 'POST_PAYMENT';

export interface PaymentResumeInput {
  phase: PaymentCheckpointPhase;
  /**
   * If phase === 'PAYMENT_IN_FLIGHT' the caller MUST first evaluate
   * PaymentUncertaintyResolver and pass its verdict here. The
   * resume resolver refuses to answer without it (fail-CLOSED).
   */
  uncertaintyVerdict?: UncertaintyVerdict;
}

export type PaymentResumeVerdict =
  | { code: 'SAFE_TO_PROCEED'; reasonCode: 'PRE_PAYMENT_NO_CHARGE_YET' }
  | { code: 'MUST_CHECK_STATUS_FIRST'; reasonCode:
      | 'PAYMENT_IN_FLIGHT_STATUS_UNCLEAR'
      | 'PAYMENT_IN_FLIGHT_RECONCILE_WINDOW' }
  | { code: 'RESUME_POST_PAYMENT'; reasonCode:
      | 'POST_PAYMENT_LEDGER_CAPTURED'
      | 'POST_PAYMENT_PHASE_ASSERTED' }
  | { code: 'ESCALATE_SUPPORT'; reasonCode:
      | 'GATEWAY_LEDGER_DISAGREE'
      | 'UNCERTAINTY_LONG_WINDOW' }
  | { code: 'REFUSE_ANSWER'; reasonCode:
      | 'UNCERTAINTY_VERDICT_REQUIRED_FOR_IN_FLIGHT' };

/**
 * Resolve the safe next action on resume.
 *
 * Never emits a "PAY_AGAIN" verdict — that is the whole point.
 * A PAYMENT_IN_FLIGHT checkpoint with unclear state falls back to
 * MUST_CHECK_STATUS_FIRST, never to a re-charge.
 */
export function resolvePaymentResume(input: PaymentResumeInput): PaymentResumeVerdict {
  switch (input.phase) {
    case 'PRE_PAYMENT':
      return { code: 'SAFE_TO_PROCEED', reasonCode: 'PRE_PAYMENT_NO_CHARGE_YET' };

    case 'PAYMENT_IN_FLIGHT': {
      if (!input.uncertaintyVerdict) {
        return { code: 'REFUSE_ANSWER', reasonCode: 'UNCERTAINTY_VERDICT_REQUIRED_FOR_IN_FLIGHT' };
      }
      const u = input.uncertaintyVerdict;
      switch (u.code) {
        case 'PAID':
          // Money already moved — treat as POST_PAYMENT and retry
          // the non-money downstream side.
          return { code: 'RESUME_POST_PAYMENT', reasonCode: 'POST_PAYMENT_LEDGER_CAPTURED' };
        case 'FAILED':
          // Even here we do NOT emit "PAY_AGAIN" — the client shows
          // the user their options; a fresh charge is a new
          // transaction they must initiate, not something we do
          // silently on resume.
          return { code: 'MUST_CHECK_STATUS_FIRST', reasonCode: 'PAYMENT_IN_FLIGHT_STATUS_UNCLEAR' };
        case 'RECONCILE_STATUS':
          return { code: 'MUST_CHECK_STATUS_FIRST', reasonCode: 'PAYMENT_IN_FLIGHT_RECONCILE_WINDOW' };
        case 'ESCALATE_SUPPORT':
          if (u.reasonCode === 'GATEWAY_LEDGER_DISAGREE') {
            return { code: 'ESCALATE_SUPPORT', reasonCode: 'GATEWAY_LEDGER_DISAGREE' };
          }
          return { code: 'ESCALATE_SUPPORT', reasonCode: 'UNCERTAINTY_LONG_WINDOW' };
      }
      // Unreachable — the union above is exhaustive.
      return { code: 'MUST_CHECK_STATUS_FIRST', reasonCode: 'PAYMENT_IN_FLIGHT_STATUS_UNCLEAR' };
    }

    case 'POST_PAYMENT':
      return { code: 'RESUME_POST_PAYMENT', reasonCode: 'POST_PAYMENT_PHASE_ASSERTED' };
  }
}
