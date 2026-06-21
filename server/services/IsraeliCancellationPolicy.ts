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

// ─── Statutory cancellation WINDOW (distance-sale right) ─────────────────────
// Israeli Consumer Protection Law distance-sale cancellation for a SERVICE: the
// consumer may cancel within 14 days of the transaction, provided the
// cancellation is made at least 2 days (that are not rest days) BEFORE the date
// the service is due. The effective deadline is the EARLIER of those two. For a
// good / no service date, only the 14-day window applies. This is what lets the
// admin refund review show "within the legal window? deadline = X" (the gap).

export const STATUTORY_COOLING_OFF_DAYS = 14;
/** Business days before the service the consumer must cancel by. */
export const SERVICE_CANCELLATION_NOTICE_BUSINESS_DAYS = 2;

function addCalendarDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

/** Subtract N business days, skipping the Israeli weekend (Fri=5, Sat=6). */
function subtractBusinessDays(d: Date, n: number): Date {
  const r = new Date(d);
  let left = n;
  while (left > 0) {
    r.setDate(r.getDate() - 1);
    const day = r.getDay(); // 0=Sun … 5=Fri, 6=Sat
    if (day !== 5 && day !== 6) left--;
  }
  return r;
}

export interface CancellationDeadline {
  /** Last moment the consumer can cancel under the statutory distance-sale right. */
  deadline: Date;
  /** Which constraint set the deadline. */
  basis: 'cooling_off_14d' | 'service_notice';
}

/**
 * The statutory cancellation deadline. For a service with a date, it is the
 * EARLIER of (purchase + 14 days) and (serviceDate − 2 business days). Without a
 * service date, it is purchase + 14 days. (Israeli weekend = Fri/Sat; public
 * holidays are not modelled here — treat the result as a floor.)
 */
export function statutoryCancellationDeadline(input: {
  purchaseDate: Date;
  serviceDate?: Date | null;
}): CancellationDeadline {
  const coolingOff = addCalendarDays(input.purchaseDate, STATUTORY_COOLING_OFF_DAYS);
  if (!input.serviceDate) return { deadline: coolingOff, basis: 'cooling_off_14d' };
  const serviceCutoff = subtractBusinessDays(input.serviceDate, SERVICE_CANCELLATION_NOTICE_BUSINESS_DAYS);
  return coolingOff.getTime() <= serviceCutoff.getTime()
    ? { deadline: coolingOff, basis: 'cooling_off_14d' }
    : { deadline: serviceCutoff, basis: 'service_notice' };
}

/** Is `now` still within the statutory cancellation window? */
export function isWithinStatutoryCancellation(input: {
  purchaseDate: Date;
  serviceDate?: Date | null;
  now?: Date;
}): boolean {
  const now = input.now ?? new Date();
  return now.getTime() <= statutoryCancellationDeadline(input).deadline.getTime();
}
