/**
 * IsraeliCancellationPolicy — the statutory cancellation-fee floor under the
 * Israeli Consumer Protection Law (חוק הגנת הצרכן) for distance sales.
 *
 * The law lets a consumer cancel a distance transaction and receive a refund
 * MINUS a cancellation fee of the LOWER of 5% of the transaction or ₪100. The
 * platform is entitled to keep that fee on a normal customer-initiated
 * cancellation before the service — it must NOT refund 100%.
 *
 * Full refund (no fee) is owed only when the cancellation is due to a platform /
 * provider fault or a mismatch between the service and its description.
 *
 * This is the single source of truth so every cancel path (shop orders,
 * bookings, unified-booking) keeps the same legally-correct amount instead of
 * each one inventing a flat 100% refund (a real money leak).
 *
 * NOTE: late-cancellation tiers (e.g. <24h before a booked service the provider
 * may keep more because they've already incurred cost) are layered ON TOP by the
 * booking policy engine; this module supplies the statutory floor used when no
 * stricter, time-based provider tier applies.
 */

/** Statutory cancellation fee = 5% of the transaction. */
export const STATUTORY_FEE_RATE = 0.05;
/** …capped at ₪100 (10,000 agorot) — the consumer pays the LOWER of the two. */
export const STATUTORY_FEE_CAP_CENTS = 10000;

export type CancellationReason =
  | 'customer'         // ordinary customer-initiated cancellation
  | 'provider_fault'   // provider no-show / failed to deliver
  | 'platform_fault'   // station fault / platform error
  | 'mismatch';        // service did not match its description

/** The Israeli statutory cancellation fee in agorot: min(5%, ₪100). */
export function statutoryCancellationFeeCents(amountCents: number): number {
  if (!(amountCents > 0)) return 0;
  return Math.min(Math.round(amountCents * STATUTORY_FEE_RATE), STATUTORY_FEE_CAP_CENTS);
}

export interface CancellationRefund {
  refundCents: number;
  feeCents: number;
  /** Why this amount was chosen — for the audit trail / receipt. */
  basis: 'full_refund_fault' | 'statutory_fee';
}

/**
 * The refund owed to a customer who cancels, in agorot.
 *  - fault / mismatch → full refund, no fee.
 *  - otherwise        → amount minus the statutory fee (min 5% / ₪100).
 *
 * This deliberately never returns 100% for an ordinary cancellation — that was
 * the leak. Time-based provider tiers (if any) are applied by the caller on top
 * and can only REDUCE the refund further (never increase it past full).
 */
export function customerCancellationRefundCents(input: {
  amountCents: number;
  reason?: CancellationReason;
}): CancellationRefund {
  const amount = Math.max(0, Math.round(input.amountCents || 0));
  const reason = input.reason ?? 'customer';
  if (reason === 'provider_fault' || reason === 'platform_fault' || reason === 'mismatch') {
    return { refundCents: amount, feeCents: 0, basis: 'full_refund_fault' };
  }
  const feeCents = statutoryCancellationFeeCents(amount);
  return { refundCents: Math.max(0, amount - feeCents), feeCents, basis: 'statutory_fee' };
}
