/**
 * CancellationEngine — CEO MASTER 2026-08-28 §38 §39 §40 §41 §42
 * §71 §72 §73.
 *
 * Deterministic. Versioned. AI-free. Produces a CancellationQuote
 * the client confirm-dialog renders BEFORE the customer commits
 * (§39). Every quote records the policyVersion so a downstream
 * dispute can re-derive the exact math.
 *
 * Israeli consumer-protection rule surfaces here as a POLICY MATRIX,
 * not a blanket 5% / ₪100 formula. The matrix below covers common
 * cases; edge cases route to a support fallback that never charges
 * more than the pessimistic-for-business cap.
 */
import {
  CURRENT_POLICY_VERSION,
  type CancellationInput,
  type CancellationQuote,
  type CxnBookingPhase,
  type CxnFundingLegRefund,
  type CxnInitiator,
  type CxnServiceType,
  type CxnTransactionType,
} from '@shared/lib/cancellationPolicy';

/**
 * Israeli consumer-protection ceiling for cancellation fees on
 * DISTANCE service transactions (Consumer Protection Regulations
 * (Cancellation of Transactions) 5771-2010). The BUSINESS may
 * charge the LOWER of 5% of transaction value OR ₪100. Applies
 * ONLY when: distance sale + service not yet started + within
 * regulatory window. Elsewhere, use the phase-specific fee.
 */
function israeliDistanceCap(grossCents: number): number {
  const fivePercent = Math.round(grossCents * 0.05);
  const oneHundredIls = 10000;
  return Math.min(fivePercent, oneHundredIls);
}

/**
 * Clearing-fee treatment (CEO §42). Processor charges PetWash a fee;
 * that cost does NOT automatically become the customer's charge.
 * ONLY when: distance sale + cancellation within regulated window +
 * the actual clearing fee was already charged to PetWash for the
 * initial transaction. The maximum here is 2% of gross (Israeli
 * regulator ceiling for clearing pass-through).
 */
function clearingFeePassThroughCents(input: CancellationInput): number {
  if (!input.usedCreditCard) return 0;
  if (input.initiator !== 'customer') return 0;
  if (input.bookingPhase === 'draft_no_payment') return 0;
  // Absolute ceiling — 2% of gross OR the actual clearing (whichever
  // is lower, but we don't have the actual clearing at quote time so
  // we cap conservatively). Never rounds up.
  return Math.floor(input.grossCents * 0.02);
}

/**
 * Days between now and the scheduled service start. Positive = future.
 */
function daysToStart(input: CancellationInput): number {
  if (!input.serviceStartsAt) return 0;
  const start = new Date(input.serviceStartsAt).getTime();
  const now = new Date(input.requestedAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(now)) return 0;
  return Math.floor((start - now) / (24 * 60 * 60 * 1000));
}

/**
 * Compute the base cancellation fee, before clearing / delivery
 * adjustments. Rules:
 *
 *   * Provider or admin cancelling → customer gets full refund; no
 *     cancellation fee.
 *   * Customer, service already in progress → NO refund (irreversible
 *     work).
 *   * Customer, service completed → NO refund, no fee.
 *   * Customer, no payment (draft) → nothing to charge.
 *   * Customer, ≥14 days before start → full refund, ZERO fee (§40
 *     grace window for Israeli distance service transactions).
 *   * Customer, service not started, distance-sale service marketplace
 *     → Israeli distance-cap (min of 5% or ₪100).
 *   * Customer, service not started, shop_product / shop_digital →
 *     distance-cap.
 *   * Customer, egift_purchase not redeemed → distance-cap.
 *   * Everything else → conservative "no fee" fallback so a business
 *     can never OVER-charge silently.
 */
function baseCancellationFeeCents(input: CancellationInput): number {
  if (input.initiator !== 'customer') return 0;
  if (input.bookingPhase === 'draft_no_payment') return 0;
  if (input.bookingPhase === 'in_progress') return input.grossCents;      // no refund
  if (input.bookingPhase === 'completed')   return input.grossCents;      // no refund

  const days = daysToStart(input);
  if (days >= 14) return 0;

  switch (input.transactionType) {
    case 'service_marketplace':
    case 'shop_product':
    case 'shop_digital':
    case 'egift_purchase':
      return israeliDistanceCap(input.grossCents);
    case 'prestige_membership':
      // Subscription — pro-rata unused fraction, no fee. Handled by
      // a separate subscription engine downstream.
      return 0;
    default:
      return 0;
  }
}

/**
 * Distribute the refund across the original funding legs
 * proportionally. Fiscal rule: refund goes back to the funding
 * instrument it came from.
 */
function distributeRefund(
  refundableCents: number,
  paymentLegs: CxnFundingLegRefund[],
): CxnFundingLegRefund[] {
  if (refundableCents <= 0 || paymentLegs.length === 0) return [];
  const gross = paymentLegs.reduce((s, l) => s + Math.max(0, l.amountCents), 0);
  if (gross <= 0) return [];
  const out: CxnFundingLegRefund[] = [];
  let assigned = 0;
  for (let i = 0; i < paymentLegs.length; i += 1) {
    const leg = paymentLegs[i];
    const last = i === paymentLegs.length - 1;
    // Last leg absorbs the rounding remainder so the sum equals
    // refundableCents exactly.
    const raw = last
      ? refundableCents - assigned
      : Math.round((leg.amountCents / gross) * refundableCents);
    if (raw > 0) {
      out.push({ instrument: leg.instrument, amountCents: raw });
      assigned += raw;
    }
  }
  return out;
}

function reasonExplanation(input: CancellationInput, fee: number): string {
  if (input.initiator === 'provider') return 'Provider-initiated cancellation — full refund.';
  if (input.initiator === 'admin')    return 'Admin-authorised cancellation — full refund.';
  if (input.initiator === 'system_dispute') return 'System dispute — refund under review.';
  if (input.bookingPhase === 'in_progress') return 'Service already in progress — no refund.';
  if (input.bookingPhase === 'completed')   return 'Service completed — no refund.';
  if (input.bookingPhase === 'draft_no_payment') return 'No payment on file — nothing to refund.';
  const days = daysToStart(input);
  if (days >= 14 && input.initiator === 'customer') return 'Cancelled ≥14 days before start — full refund per Israeli distance-sale grace.';
  if (fee === 0) return 'Full refund — no cancellation fee applies to this scenario.';
  return `Cancellation fee is the lower of 5% or ₪100 per Israeli Consumer Protection Regulations. Fee: ₪${(fee / 100).toFixed(2)}.`;
}

function providerImpact(input: CancellationInput): CancellationQuote['providerImpact'] {
  if (input.initiator === 'provider') {
    if (input.bookingPhase === 'accepted_awaiting_start') return 'flag_no_show';
    return 'flag_late_cancel';
  }
  if (input.initiator === 'customer' && input.bookingPhase === 'in_progress') return 'revoke_payout';
  return 'none';
}

function fiscalAction(refundableCents: number, grossCents: number): CancellationQuote['fiscalAction'] {
  if (refundableCents <= 0) return 'none';
  if (refundableCents >= grossCents) return 'issue_credit_note';
  return 'issue_partial_credit_note';
}

/**
 * The public engine entry point. Never throws — returns a
 * conservative-for-business quote on any degenerate input so a bug
 * cannot leave the customer stuck between "cannot cancel" and "no
 * math available".
 */
export function computeCancellationQuote(input: CancellationInput): CancellationQuote {
  // Draft with no payment legs: there IS no charge to refund. A
  // caller might still pass a nominal grossCents (from a quote
  // preview); treat as zero so the fiscal action is correctly 'none'.
  const legsSum = (input.paymentLegs ?? []).reduce(
    (s, l) => s + Math.max(0, l.amountCents ?? 0),
    0,
  );
  const rawGross = Math.max(0, Math.floor(input.grossCents ?? 0));
  const gross = input.bookingPhase === 'draft_no_payment' ? Math.min(rawGross, legsSum) : rawGross;
  const base = baseCancellationFeeCents({ ...input, grossCents: gross });
  const cancellationFee = Math.min(base, gross);
  // Clearing pass-through applies ONLY when the business is actually
  // charging a cancellation fee. A grace-window customer refund
  // (fee = 0) does not pass processor costs on to the customer —
  // that would silently re-open the CEO §42 "1.75% surcharge"
  // regression the directive explicitly bans.
  const clearing = cancellationFee > 0
    && input.bookingPhase !== 'in_progress'
    && input.bookingPhase !== 'completed'
    ? clearingFeePassThroughCents({ ...input, grossCents: gross })
    : 0;
  // Delivery adjustment placeholder — shop_product may have shipped
  // by the time of cancel; the shop engine sets this via a follow-up
  // add-on. For MVP scope: zero unless we know a delivery cost.
  const delivery = 0;
  const refundable = Math.max(0, gross - cancellationFee - clearing - delivery);
  return {
    policyVersion: CURRENT_POLICY_VERSION,
    country: input.country,
    transactionType: input.transactionType,
    serviceType: input.serviceType,
    bookingPhase: input.bookingPhase,
    consumerCategory: input.consumerCategory,
    initiator: input.initiator,
    currency: 'ILS',
    grossCents: gross,
    cancellationFeeCents: cancellationFee,
    clearingFeeCents: clearing,
    deliveryAdjustmentCents: delivery,
    refundableCents: refundable,
    fundingLegRefunds: distributeRefund(refundable, input.paymentLegs ?? []),
    providerImpact: providerImpact(input),
    fiscalAction: fiscalAction(refundable, gross),
    reasonExplanation: reasonExplanation(input, cancellationFee),
  };
}
