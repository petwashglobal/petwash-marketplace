/**
 * K9000OutcomeDiscriminator — CEO PROGRAM 17 (K9000 Transaction).
 *
 * Pure evaluator. Doctrine: "If payment success but wash failed:
 * create support/refund path. Do not treat machine success and
 * payment success as same state."
 *
 * Given (paymentOutcome, machineOutcome), returns the customer-
 * facing routing decision:
 *   • RECEIPT_ONLY — both success.
 *   • REFUND_PATH — money captured, wash failed.
 *   • PAYMENT_ONLY_ISSUE — payment failed, wash never started.
 *   • RECONCILIATION_REQUIRED — asymmetric or ambiguous — needs
 *     support review (§12 discipline).
 */

export type K9000PaymentOutcome =
  | 'AUTHORIZED_AND_CAPTURED'
  | 'AUTHORIZED_NOT_CAPTURED'
  | 'FAILED'
  | 'UNKNOWN';

export type K9000MachineOutcome =
  | 'WASH_DELIVERED'
  | 'WASH_FAILED'
  | 'WASH_NEVER_STARTED'
  | 'UNKNOWN';

export type K9000Verdict =
  | 'RECEIPT_ONLY'
  | 'REFUND_PATH'
  | 'PAYMENT_ONLY_ISSUE'
  | 'RECONCILIATION_REQUIRED';

export interface K9000DiscriminatorInput {
  payment: K9000PaymentOutcome;
  machine: K9000MachineOutcome;
}

export interface K9000DiscriminatorOutcome {
  verdict: K9000Verdict;
  reasonCode: string;
  supportEscalation: boolean;
}

export function discriminateK9000(input: K9000DiscriminatorInput): K9000DiscriminatorOutcome {
  const p = input.payment;
  const m = input.machine;

  // Both success — a normal receipt.
  if (p === 'AUTHORIZED_AND_CAPTURED' && m === 'WASH_DELIVERED') {
    return { verdict: 'RECEIPT_ONLY', reasonCode: 'BOTH_SUCCESS', supportEscalation: false };
  }
  // Money captured, wash failed → refund path (§12 discipline).
  if (p === 'AUTHORIZED_AND_CAPTURED' && m === 'WASH_FAILED') {
    return { verdict: 'REFUND_PATH', reasonCode: 'PAID_BUT_WASH_FAILED', supportEscalation: true };
  }
  // Payment failed and machine never started — customer just needs
  // to know the transaction did not go through.
  if (p === 'FAILED' && (m === 'WASH_NEVER_STARTED' || m === 'UNKNOWN')) {
    return { verdict: 'PAYMENT_ONLY_ISSUE', reasonCode: 'PAYMENT_FAILED', supportEscalation: false };
  }
  // Every other combination is asymmetric or ambiguous — require
  // reconciliation before showing a definitive receipt or refund.
  return { verdict: 'RECONCILIATION_REQUIRED', reasonCode: 'ASYMMETRIC_OR_UNKNOWN', supportEscalation: true };
}
