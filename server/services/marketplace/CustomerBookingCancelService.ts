/**
 * CustomerBookingCancelService — CEO SPEED MODE NEXT-AUTO §1.
 *
 * Unpaid-cancel authority for customer-initiated cancels
 * (CUSTOMER_CANCEL_BOOKING_UNPAID). Split from PAID cancel because
 * consequences differ:
 *
 *   – UNPAID: no refund, no policy computation, no fiscal document.
 *     Just withdraw the pending request and close the loop with the
 *     provider Inbox card.
 *   – PAID:   a separate service (follow-up) reads the
 *     CancellationPolicyRegistry, computes refund/penalty, and
 *     routes through the money reconciliation path. That path is
 *     NOT this service.
 *
 * The service is an ORCHESTRATOR — it does NOT write
 * `status='cancelled'` directly on the booking. It emits a stable
 * outcome that the caller (Action Brain handler or HTTP shell)
 * forwards to the domain-specific cancellation authority (a follow-
 * up unifies those under a `dispatchCancelForSource` sibling of the
 * accept/decline dispatcher).
 *
 * This service enforces the invariants at the orchestration layer:
 *   §11 self-cancellation not applicable (customer IS the booker).
 *   §12 stale-state: a booking in a terminal state cannot be
 *        cancelled — the domain returns STALE_STATE.
 *   §13 paid-guard: if the booking has money on it we refuse the
 *        UNPAID intent and steer the caller to CUSTOMER_CANCEL_BOOKING_PAID.
 */

export type CustomerCancelOutcomeCode =
  | 'CANCELLED_UNPAID'
  | 'PAID_MUST_USE_PAID_CANCEL'
  | 'BOOKING_NOT_FOUND'
  | 'BOOKING_NOT_CANCELLABLE'         // terminal state, or provider already accepted with payment
  | 'ACTOR_NOT_BOOKER'
  | 'STALE_STATE'
  | 'DISPATCHER_NOT_ENABLED'
  | 'UNKNOWN_OUTCOME';

export interface CustomerCancelInput {
  bookingId: string;
  actorUid: string;
  /**
   * Server-derived booking snapshot the caller has already resolved.
   * The service does NOT hit the domain itself so it can be tested
   * without a DB — the calling layer authorises + fetches.
   */
  snapshot: {
    bookerUid: string;
    status: string;                       // canonical booking status
    hasMoneyCaptured: boolean;            // true iff the customer has been charged / wallet debited
  };
  reasonCode?: 'CHANGED_MIND' | 'FOUND_ALTERNATIVE' | 'BUDGET' | 'OTHER';
}

export interface CustomerCancelOutcome {
  code: CustomerCancelOutcomeCode;
  bookingId?: string;
  suggestedNext?: 'FIND_ALTERNATIVES' | 'MESSAGE_PROVIDER' | 'USE_PAID_CANCEL';
}

const CANCELLABLE_STATUSES = new Set<string>([
  'requested',
  'REQUESTED',
  'awaiting_provider',
  'AWAITING_PROVIDER',
  'quoted',
  'QUOTED',
  'pending',
  'PENDING',
]);

/**
 * The one function callers use. Pure — no DB, no email, no push.
 * The outcome is stable; the caller (Action Brain handler or route)
 * forwards it to notifications and/or the domain cancel authority.
 */
export function evaluateCustomerCancelUnpaid(input: CustomerCancelInput): CustomerCancelOutcome {
  if (!input.snapshot) return { code: 'BOOKING_NOT_FOUND' };
  if (input.snapshot.bookerUid !== input.actorUid) {
    return { code: 'ACTOR_NOT_BOOKER' };
  }
  if (input.snapshot.hasMoneyCaptured) {
    return {
      code: 'PAID_MUST_USE_PAID_CANCEL',
      suggestedNext: 'USE_PAID_CANCEL',
    };
  }
  if (!CANCELLABLE_STATUSES.has(input.snapshot.status)) {
    return { code: 'BOOKING_NOT_CANCELLABLE' };
  }
  return {
    code: 'CANCELLED_UNPAID',
    bookingId: input.bookingId,
    suggestedNext: 'FIND_ALTERNATIVES',
  };
}
