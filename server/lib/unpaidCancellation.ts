/**
 * "Can the customer still walk away?" — one answer per service (2026-09-19).
 *
 * Sitter and Walk both refused a customer cancel unless the booking was still
 * waiting for the provider. That was right when accepting a booking also
 * charged for it. It stopped being right the moment accept and payment came
 * apart:
 *
 *   WALK   — since the card rail shipped, a walker's accept lands the booking
 *            in `payment_pending` and the customer has paid NOTHING;
 *            `confirmed` is written only by the verified payment return. The
 *            old gate told a customer to phone support to get out of a booking
 *            they had never paid for, and left the walker holding a slot
 *            nobody wanted.
 *   SITTER — acceptSitterBookingCore charges the owner's stored method on
 *            accept. When that charge FAILS the booking lands in
 *            `payment_failed`: nothing captured, no escrow, and nothing in the
 *            product will ever retry it. The customer was told to phone
 *            support about a charge that never happened.
 *
 * Everything else stays refused, and deliberately so. A `confirmed` booking
 * has money held against it and belongs to the refund rail. Sitter's
 * `payment_pending` is NOT here either: it is the transient state around the
 * capture itself, so a row stuck there may or may not have been charged, and
 * only support can tell which.
 */
export type UnpaidCancellationService = 'walk' | 'sitter';

/** Statuses in which the customer owes nothing and nothing has been taken. */
export const CANCELLABLE_WHILE_UNPAID: Record<UnpaidCancellationService, readonly string[]> = {
  walk: ['pending_provider', 'payment_pending'],
  sitter: ['pending_provider', 'payment_failed'],
};

/** True when cancelling moves no money, so the customer may simply do it. */
export function customerMayCancelUnpaid(
  service: UnpaidCancellationService,
  status: unknown,
): boolean {
  const allowed = CANCELLABLE_WHILE_UNPAID[service];
  if (!allowed) return false;
  return allowed.includes(String(status ?? ''));
}
