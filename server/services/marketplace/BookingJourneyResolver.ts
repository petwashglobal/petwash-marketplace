/**
 * BookingJourneyResolver — CEO NEXT-AUTO §14 + Doctrine §84-§87.
 *
 * Concrete resolver that produces a JourneyState for a (booking,
 * actor) pair. Reads a supplied snapshot; returns the doctrine's
 * READ projection with waitingOn, obligations, blockers, deadlines,
 * money, communication, primaryAction.
 *
 * §86 discipline: same booking → different JourneyState per actor.
 * §75 discipline: REQUIRED obligations always outrank informational.
 */
import {
  emptyJourneyState,
  type JourneyState,
  type Obligation,
  type Deadline,
  type WaitingParty,
  type JourneyPriority,
  type MoneyState,
} from '@shared/marketplace/journeyState';

export type BookingCanonicalStatus =
  | 'REQUESTED'
  | 'QUOTED'
  | 'PROVIDER_PROPOSED_CHANGE'
  | 'ACCEPTED'
  | 'CONFIRMED'
  | 'READY_TO_START'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'DECLINED'
  | 'EXPIRED';

export interface BookingJourneySnapshot {
  bookingId: string;
  status: BookingCanonicalStatus;
  customerUid: string;
  providerUid: string;
  requestExpiresAt?: string;                    // ISO
  paymentCapturedCents?: number;                // > 0 iff money captured
  amountDueCents?: number;                      // > 0 iff customer owes
  currency?: 'ILS';
  pickupHandoffVerified?: boolean;
  returnHandoffVerified?: boolean;
  hasCustomerRating?: boolean;
  unreadForActor?: number;
  threadId?: string;
}

export type ResolverActorRole = 'CUSTOMER' | 'PROVIDER';

export interface ResolverInput {
  snapshot: BookingJourneySnapshot;
  actorUid: string;
  actorRole: ResolverActorRole;
}

/**
 * The one call. Pure, no DB.
 */
export function resolveBookingJourney(input: ResolverInput): JourneyState {
  const s = input.snapshot;
  const entityRef = { kind: 'booking', id: s.bookingId };
  const actor: JourneyState['actor'] = {
    role: input.actorRole,
    uid: input.actorUid,
  };
  const base = emptyJourneyState(entityRef, actor, s.status);
  base.communication = {
    status: s.threadId ? 'OPEN' : 'NO_THREAD_YET',
    unreadCount: s.unreadForActor ?? 0,
    threadRef: s.threadId ? { kind: 'booking_thread', id: s.threadId } : undefined,
  };

  const [waitingOn, obligations, blockers, deadlines, money, primary, priority] = computeForStatus(s, input.actorRole);
  return {
    ...base,
    waitingOn,
    obligations,
    blockers,
    deadlines,
    money,
    primaryAction: primary ? { actionType: primary, reasonCode: `PRIMARY_FOR_${s.status}` } : undefined,
    availableActions: [],
    attentionPriority: priority,
  };
}

function computeForStatus(
  s: BookingJourneySnapshot,
  role: ResolverActorRole,
): [WaitingParty, Obligation[], JourneyState['blockers'], Deadline[], MoneyState | undefined, string | undefined, JourneyPriority] {
  const deadlines: Deadline[] = [];
  const isCustomer = role === 'CUSTOMER';
  const money: MoneyState | undefined = (() => {
    if (s.amountDueCents && s.amountDueCents > 0) {
      return { amountCents: s.amountDueCents, currency: 'ILS', labelCode: 'AMOUNT_DUE', paymentStatusCode: 'DUE' };
    }
    if (s.paymentCapturedCents && s.paymentCapturedCents > 0) {
      return { amountCents: s.paymentCapturedCents, currency: 'ILS', labelCode: 'AMOUNT_CHARGED', paymentStatusCode: 'CAPTURED' };
    }
    return undefined;
  })();

  switch (s.status) {
    case 'REQUESTED':
    case 'QUOTED': {
      if (s.requestExpiresAt) deadlines.push({ reasonCode: 'REQUEST_EXPIRES', dueAt: s.requestExpiresAt, hardCutoff: true });
      if (isCustomer) {
        return ['PROVIDER', [{ type: 'WAIT', severity: 'INFORMATIONAL', reasonCode: 'WAIT_FOR_PROVIDER' }], [], deadlines, money, 'MESSAGE_PROVIDER', 'MEDIUM'];
      }
      return ['PROVIDER',
        [{ type: 'RESPOND_TO_PROVIDER_REQUEST', severity: 'REQUIRED', reasonCode: 'RESPOND_TO_REQUEST', dueAt: s.requestExpiresAt }],
        [], deadlines, money, 'BOOKING_ACCEPT', 'HIGH'];
    }
    case 'PROVIDER_PROPOSED_CHANGE': {
      if (isCustomer) {
        return ['CUSTOMER',
          [{ type: 'REVIEW_PROPOSED_CHANGE', severity: 'REQUIRED', reasonCode: 'REVIEW_CHANGE' }],
          [], deadlines, money, 'BOOKING_ACCEPT_PROPOSED_CHANGE', 'HIGH'];
      }
      return ['CUSTOMER',
        [{ type: 'WAIT', severity: 'INFORMATIONAL', reasonCode: 'WAIT_FOR_CUSTOMER_DECISION' }],
        [], deadlines, money, 'MESSAGE_CUSTOMER', 'MEDIUM'];
    }
    case 'ACCEPTED':
    case 'CONFIRMED': {
      const obs: Obligation[] = [];
      if (isCustomer && s.amountDueCents && s.amountDueCents > 0) {
        obs.push({ type: 'PAY', severity: 'REQUIRED', reasonCode: 'PAY_DUE' });
        return ['CUSTOMER', obs, [], deadlines, money, 'CUSTOMER_PAY_BOOKING', 'URGENT'];
      }
      if (isCustomer) {
        return ['SYSTEM', [{ type: 'WAIT', severity: 'INFORMATIONAL', reasonCode: 'WAIT_FOR_START' }], [], deadlines, money, 'VIEW_BOOKING', 'MEDIUM'];
      }
      return ['SYSTEM', [{ type: 'WAIT', severity: 'INFORMATIONAL', reasonCode: 'WAIT_FOR_START' }], [], deadlines, money, 'VIEW_BOOKING', 'MEDIUM'];
    }
    case 'READY_TO_START': {
      if (isCustomer) {
        return ['PROVIDER', [{ type: 'WAIT', severity: 'INFORMATIONAL', reasonCode: 'WAIT_FOR_PROVIDER_START' }], [], deadlines, money, 'MESSAGE_PROVIDER', 'MEDIUM'];
      }
      // Provider needs pickup handoff
      const obs: Obligation[] = [{ type: 'ISSUE_HANDOFF_CODE', severity: 'REQUIRED', reasonCode: 'PICKUP_HANDOFF_REQUIRED' }];
      return ['PROVIDER', obs, [], deadlines, money, 'HANDOFF_ISSUE_CODE', 'HIGH'];
    }
    case 'IN_PROGRESS': {
      if (isCustomer) {
        // Return handoff pending → customer must verify code
        if (!s.returnHandoffVerified) {
          return ['CUSTOMER', [{ type: 'VERIFY_HANDOFF_CODE', severity: 'REQUIRED', reasonCode: 'RETURN_HANDOFF_REQUIRED' }], [], deadlines, money, 'HANDOFF_VERIFY_CODE', 'HIGH'];
        }
        return ['PROVIDER', [{ type: 'WAIT', severity: 'INFORMATIONAL', reasonCode: 'WAIT_FOR_JOB_COMPLETE' }], [], deadlines, money, 'MESSAGE_PROVIDER', 'MEDIUM'];
      }
      // Provider — complete after return handoff
      if (s.returnHandoffVerified) {
        return ['PROVIDER', [{ type: 'WAIT', severity: 'INFORMATIONAL', reasonCode: 'READY_TO_COMPLETE' }], [], deadlines, money, 'COMPLETE_JOB', 'HIGH'];
      }
      return ['PROVIDER', [{ type: 'ISSUE_HANDOFF_CODE', severity: 'REQUIRED', reasonCode: 'RETURN_HANDOFF_REQUIRED' }], [], deadlines, money, 'HANDOFF_ISSUE_CODE', 'HIGH'];
    }
    case 'COMPLETED': {
      if (isCustomer && !s.hasCustomerRating) {
        return ['CUSTOMER', [{ type: 'RATE_COMPLETED_SERVICE', severity: 'OPTIONAL', reasonCode: 'RATE_OPTIONAL' }], [], deadlines, money, 'CUSTOMER_RATE_BOOKING', 'INFO'];
      }
      return ['NONE', [{ type: 'NONE', severity: 'INFORMATIONAL', reasonCode: 'COMPLETED' }], [], deadlines, money, 'VIEW_RECEIPT', 'INFO'];
    }
    case 'DECLINED':
    case 'CANCELLED':
    case 'EXPIRED':
    default:
      return ['NONE', [{ type: 'NONE', severity: 'INFORMATIONAL', reasonCode: 'TERMINAL' }], [], deadlines, money, 'FIND_PROVIDER', 'INFO'];
  }
}
