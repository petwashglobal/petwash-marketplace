/**
 * PaymentUncertaintyResolver — CEO §12 (payment uncertainty).
 *
 * Pure evaluator. The doctrine's most explicit rule: "NEVER guess
 * payment after crash." When the client / server sees payment
 * state that is ambiguous, the correct next action is NEVER
 * "PAY_AGAIN" — it is always a STATUS check, a RECONCILE, or a
 * SUPPORT escalation.
 *
 * This service unifies the § 12 discipline across the resolvers:
 * given a rough (paymentGatewayResult, hasCapturedRecord,
 * hasPendingRecord, hasFailedRecord, hoursSinceInitiated), return
 * one canonical UncertaintyVerdict.
 */

export type PaymentGatewayResult =
  | 'CAPTURED_CONFIRMED'
  | 'AUTHORIZED_ONLY'
  | 'FAILED'
  | 'PENDING'
  | 'NO_RESPONSE'
  | 'UNKNOWN';

export interface UncertaintyInput {
  gatewayResult: PaymentGatewayResult;
  hasCapturedLedgerRecord: boolean;
  hasPendingLedgerRecord: boolean;
  hasFailedLedgerRecord: boolean;
  hoursSinceInitiated: number;
}

export type UncertaintyVerdict =
  | { code: 'PAID'; reasonCode: 'GATEWAY_AND_LEDGER_AGREE' }
  | { code: 'FAILED'; reasonCode: 'GATEWAY_AND_LEDGER_AGREE_FAILED' }
  | { code: 'RECONCILE_STATUS'; reasonCode: 'PAYMENT_STATUS_UNCLEAR_SHORT_WINDOW' }
  | { code: 'ESCALATE_SUPPORT'; reasonCode: 'PAYMENT_STATUS_UNCLEAR_LONG_WINDOW' | 'GATEWAY_LEDGER_DISAGREE' };

/** Window before an unclear payment escalates from RECONCILE to SUPPORT. */
const SHORT_WINDOW_HOURS = 24;

export function resolvePaymentUncertainty(input: UncertaintyInput): UncertaintyVerdict {
  // Both signals agree captured → PAID.
  if (input.gatewayResult === 'CAPTURED_CONFIRMED' && input.hasCapturedLedgerRecord) {
    return { code: 'PAID', reasonCode: 'GATEWAY_AND_LEDGER_AGREE' };
  }
  // Both signals agree failed → FAILED. Callers may show
  // START_NEW_TOPUP / retry only in the FAILED case, never
  // otherwise — that discipline lives in resolver primaryAction.
  if (input.gatewayResult === 'FAILED' && input.hasFailedLedgerRecord && !input.hasCapturedLedgerRecord) {
    return { code: 'FAILED', reasonCode: 'GATEWAY_AND_LEDGER_AGREE_FAILED' };
  }
  // Gateway says captured but ledger disagrees, or vice-versa →
  // hard escalation (money integrity).
  if (
    (input.gatewayResult === 'CAPTURED_CONFIRMED' && !input.hasCapturedLedgerRecord)
    || (input.gatewayResult === 'FAILED' && input.hasCapturedLedgerRecord)
  ) {
    return { code: 'ESCALATE_SUPPORT', reasonCode: 'GATEWAY_LEDGER_DISAGREE' };
  }
  // Everything else is UNCLEAR — RECONCILE while young, ESCALATE
  // if the window has lapsed. Client shows VIEW_PAYMENT_STATUS,
  // NEVER PAY_AGAIN.
  if (input.hoursSinceInitiated <= SHORT_WINDOW_HOURS) {
    return { code: 'RECONCILE_STATUS', reasonCode: 'PAYMENT_STATUS_UNCLEAR_SHORT_WINDOW' };
  }
  return { code: 'ESCALATE_SUPPORT', reasonCode: 'PAYMENT_STATUS_UNCLEAR_LONG_WINDOW' };
}
