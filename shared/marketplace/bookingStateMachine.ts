/**
 * Booking state machines — CEO Business Doctrine §7, §8, §72.
 *
 * FOUR SEPARATE AXES. Do NOT infer one from another.
 *
 *   BookingStatus     — DRAFT → REQUESTED → QUOTED → ACCEPTED →
 *                       CONFIRMED → IN_PROGRESS → COMPLETED
 *                       plus branches CANCELLED, DISPUTED.
 *   PaymentStatus     — NOT_REQUIRED | UNPAID | PENDING | AUTHORIZED |
 *                       PAID | PARTIAL_REFUND | REFUNDED | FAILED.
 *   ProviderPayoutStatus — NOT_ELIGIBLE | ACCRUED | HELD | SCHEDULED | PAID.
 *   FiscalStatus      — NOT_REQUIRED | PENDING | ISSUED | FAILED |
 *                       CREDIT_PENDING | CREDIT_ISSUED.
 *
 * Client CANNOT POST `status = COMPLETED`. It invokes the ACTION
 * (COMPLETE_JOB) and the server validates the transition via
 * `canTransitionBookingStatus()`.
 */

// ── BookingStatus ─────────────────────────────────────────────────────

export type BookingStatus =
  | 'DRAFT'
  | 'REQUESTED'
  | 'QUOTED'
  | 'ACCEPTED'
  | 'CONFIRMED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'DISPUTED';

const BOOKING_STATUS_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  DRAFT: ['REQUESTED', 'CANCELLED'],
  REQUESTED: ['QUOTED', 'ACCEPTED', 'CANCELLED'],       // provider may re-quote or accept directly
  QUOTED: ['ACCEPTED', 'CANCELLED'],                    // customer accepts the revised quote
  ACCEPTED: ['CONFIRMED', 'CANCELLED'],                 // payment completion promotes to CONFIRMED
  CONFIRMED: ['IN_PROGRESS', 'CANCELLED', 'DISPUTED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED', 'DISPUTED'],
  COMPLETED: ['DISPUTED'],                              // review window may still open a dispute
  CANCELLED: [],                                        // terminal
  DISPUTED: ['COMPLETED', 'CANCELLED'],                 // resolution routes back
};

export function canTransitionBookingStatus(
  from: BookingStatus,
  to: BookingStatus,
): boolean {
  return BOOKING_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

export function nextBookingStatuses(from: BookingStatus): BookingStatus[] {
  return BOOKING_STATUS_TRANSITIONS[from] ?? [];
}

export function isTerminalBookingStatus(status: BookingStatus): boolean {
  return BOOKING_STATUS_TRANSITIONS[status]?.length === 0;
}

// ── PaymentStatus ─────────────────────────────────────────────────────

export type PaymentStatus =
  | 'NOT_REQUIRED'
  | 'UNPAID'
  | 'PENDING'
  | 'AUTHORIZED'
  | 'PAID'
  | 'PARTIAL_REFUND'
  | 'REFUNDED'
  | 'FAILED';

const PAYMENT_STATUS_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  NOT_REQUIRED: [],                                      // terminal — free booking
  UNPAID: ['PENDING', 'FAILED'],
  PENDING: ['AUTHORIZED', 'PAID', 'FAILED'],
  AUTHORIZED: ['PAID', 'FAILED'],
  PAID: ['PARTIAL_REFUND', 'REFUNDED'],
  PARTIAL_REFUND: ['REFUNDED'],
  REFUNDED: [],                                          // terminal
  FAILED: ['UNPAID', 'PENDING'],                         // retry possible
};

export function canTransitionPaymentStatus(
  from: PaymentStatus,
  to: PaymentStatus,
): boolean {
  return PAYMENT_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * §8.3 discipline: derive whether the customer has "paid" for the
 * booking. This is what the booking-status → CONFIRMED promotion consults.
 */
export function isPaymentSettled(status: PaymentStatus): boolean {
  return status === 'PAID' || status === 'AUTHORIZED';
}

// ── ProviderPayoutStatus ──────────────────────────────────────────────

export type ProviderPayoutStatus =
  | 'NOT_ELIGIBLE'
  | 'ACCRUED'
  | 'HELD'
  | 'SCHEDULED'
  | 'PAID';

const PAYOUT_STATUS_TRANSITIONS: Record<ProviderPayoutStatus, ProviderPayoutStatus[]> = {
  NOT_ELIGIBLE: ['ACCRUED'],                             // job COMPLETED promotes
  ACCRUED: ['HELD', 'SCHEDULED'],                        // risk / freeze branches
  HELD: ['ACCRUED', 'SCHEDULED'],                        // resolved hold returns to accrual or schedules
  SCHEDULED: ['PAID', 'HELD'],                           // pre-payout freeze possible
  PAID: [],                                              // terminal
};

export function canTransitionPayoutStatus(
  from: ProviderPayoutStatus,
  to: ProviderPayoutStatus,
): boolean {
  return PAYOUT_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

// ── FiscalStatus ──────────────────────────────────────────────────────

export type FiscalStatus =
  | 'NOT_REQUIRED'
  | 'PENDING'
  | 'ISSUED'
  | 'FAILED'
  | 'CREDIT_PENDING'
  | 'CREDIT_ISSUED';

const FISCAL_STATUS_TRANSITIONS: Record<FiscalStatus, FiscalStatus[]> = {
  NOT_REQUIRED: [],
  PENDING: ['ISSUED', 'FAILED'],
  ISSUED: ['CREDIT_PENDING'],                            // refund path opens a credit note
  FAILED: ['PENDING'],                                   // retry
  CREDIT_PENDING: ['CREDIT_ISSUED', 'FAILED'],
  CREDIT_ISSUED: [],                                     // terminal
};

export function canTransitionFiscalStatus(
  from: FiscalStatus,
  to: FiscalStatus,
): boolean {
  return FISCAL_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

// ── Cross-axis derivation guards (§8 discipline: NEVER infer) ─────────

/**
 * Refuse to promote a booking to CONFIRMED unless payment is settled.
 * This is the ONE cross-axis rule the doctrine allows because doctrine
 * §8 also says the CONFIRMED status is the "payment complete + booking
 * live" state.
 *
 * Every OTHER cross-axis inference is a defect (§18).
 */
export function canPromoteToConfirmed(
  bookingStatus: BookingStatus,
  paymentStatus: PaymentStatus,
): boolean {
  if (bookingStatus !== 'ACCEPTED') return false;
  return isPaymentSettled(paymentStatus);
}

/**
 * Guard for the payout status update triggered by COMPLETE_JOB. The
 * booking status is authoritative; payout only accrues when the job
 * is genuinely COMPLETED, not when it merely REACHED that record
 * through some external write path.
 */
export function canAccruePayoutOnComplete(
  bookingStatus: BookingStatus,
  paymentStatus: PaymentStatus,
): boolean {
  return bookingStatus === 'COMPLETED' && isPaymentSettled(paymentStatus);
}
