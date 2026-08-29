/**
 * CancellationPolicyRegistry — CEO MASTER DIRECTIVE 2026-08-28
 * §38 §39 §40 §41 §42 §71 §72 §73.
 *
 * Israeli consumer cancellation rules DIFFER by:
 *   * transaction type (service, product, distance/remote sale, ...)
 *   * timing (before / after service start; ≥14d in advance; etc.)
 *   * consumer category (regular / senior / with-disability / minor)
 *   * whether the service actually started
 *   * whether it's a credit-card transaction (clearing fee)
 *
 * DO NOT hardcode the 5% / ₪100 Israeli consumer-protection formula
 * on every cancellation — that outcome depends on a specific matrix
 * of the above. This registry is versioned so a policy change in
 * 2027 does not invalidate a 2026 booking's quote.
 *
 * The AI concierge (CEO §38) can EXPLAIN a quote. It cannot COMPUTE
 * one. The engine below is the sole authority.
 */

export type Country = 'IL';

export type CxnTransactionType =
  | 'service_marketplace'   // walk / sitter / academy / marketplace booking
  | 'shop_product'          // physical goods
  | 'shop_digital'          // digital / instant delivery
  | 'egift_purchase'        // stored-value / voucher purchase
  | 'prestige_membership';  // subscription

export type CxnServiceType =
  | 'walk'
  | 'sitting'
  | 'academy'
  | 'grooming'
  | 'k9000_wash'
  | 'shop'
  | 'egift'
  | 'membership';

/** Where the booking sits in its life-cycle when the customer cancels. */
export type CxnBookingPhase =
  | 'pending_provider_accept'
  | 'accepted_awaiting_start'
  | 'in_progress'
  | 'completed'
  | 'draft_no_payment';

/** The consumer category the customer belongs to (Israeli law affords
 *  special protections). */
export type CxnConsumerCategory =
  | 'regular'
  | 'senior'          // 65+
  | 'disability'
  | 'new_immigrant';  // עולה חדש within relevant window

/** Who initiated the cancellation. */
export type CxnInitiator = 'customer' | 'provider' | 'system_dispute' | 'admin';

/** The refund destination legs. Sum must equal refundableCents. */
export interface CxnFundingLegRefund {
  instrument: 'card' | 'wallet' | 'egift' | 'wash_package' | 'loyalty_points';
  amountCents: number;
}

/**
 * The CANONICAL cancellation quote. AI can render it; humans can act
 * on it. Every field is server-authoritative. Recorded in the audit
 * (CEO §72) with the policyVersion so a downstream dispute can
 * re-derive the exact math.
 */
export interface CancellationQuote {
  policyVersion: string;      // e.g. "IL-2026-08"
  country: Country;
  transactionType: CxnTransactionType;
  serviceType: CxnServiceType;
  bookingPhase: CxnBookingPhase;
  consumerCategory: CxnConsumerCategory;
  initiator: CxnInitiator;
  currency: 'ILS';

  grossCents: number;         // what the customer paid
  cancellationFeeCents: number;
  clearingFeeCents: number;   // credit-card actual clearing cost, if applicable
  deliveryAdjustmentCents: number;
  refundableCents: number;    // gross − cancellationFee − clearing − delivery

  fundingLegRefunds: CxnFundingLegRefund[];

  /** Provider-side side-effects (payout revoke / performance flag). */
  providerImpact: 'none' | 'flag_late_cancel' | 'flag_no_show' | 'revoke_payout';

  /** SUMIT / fiscal action to trigger downstream. */
  fiscalAction: 'none' | 'issue_credit_note' | 'issue_partial_credit_note';

  /** Human-readable reason string emitted by the engine — safe for
   *  the customer confirm dialog. */
  reasonExplanation: string;
}

export interface CancellationInput {
  country: Country;
  transactionType: CxnTransactionType;
  serviceType: CxnServiceType;
  bookingPhase: CxnBookingPhase;
  consumerCategory: CxnConsumerCategory;
  initiator: CxnInitiator;
  /** Server-owned totals from the canonical booking / order row. */
  grossCents: number;
  /** ISO — when the service was scheduled to start. Used for the
   *  "≥14 days" rule when applicable. */
  serviceStartsAt: string | null;
  /** ISO — when the cancel request lands on the server. */
  requestedAt: string;
  /** How the customer originally funded the transaction. Sum of
   *  amounts must equal grossCents. */
  paymentLegs: CxnFundingLegRefund[];
  /** Whether the customer used a credit card leg — determines the
   *  clearing-fee treatment (CEO §42). */
  usedCreditCard: boolean;
}

/**
 * Current active policy version. Bump when the matrix below changes
 * so historical quotes remain re-derivable via a previous version's
 * engine.
 */
export const CURRENT_POLICY_VERSION = 'IL-2026-08';
