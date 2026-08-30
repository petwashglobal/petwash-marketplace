/**
 * MaskedPhoneCallService — CEO NEXT-AUTO §12 + BusinessDecisionRegistry.
 *
 * Gate for CALL_PROVIDER / CALL_OWNER intents. The marketplace does
 * NOT expose raw phone numbers between customer and provider — a
 * masked-relay number is used, and the availability window is a
 * BUSINESS DECISION anchored in the registry.
 *
 * If the doctrine's post-booking masked-phone policy is
 * POLICY_NOT_CONFIGURED, the service refuses the intent with a
 * stable outcome rather than inventing a duration. If the caller
 * is not a party on the booking, refused.
 *
 * The service is a pure evaluator. The caller applies the outcome
 * (dial the masked relay, log the intent, or refuse the UI).
 */

import {
  isPolicyConfigured,
  getBusinessDecision,
} from '@shared/marketplace/businessDecisionRegistry';

const POLICY_KEY = 'POST_BOOKING_MASKED_PHONE_EXPIRY';

export type MaskedCallOutcomeCode =
  | 'CALL_AUTHORIZED'
  | 'POLICY_NOT_CONFIGURED'
  | 'ACTOR_NOT_PARTY'
  | 'BOOKING_NOT_ACTIVE'
  | 'MASK_WINDOW_EXPIRED';

export interface MaskedCallInput {
  bookingId: string;
  actorUid: string;
  customerUid: string;
  providerUid: string;
  bookingStatus: string;
  bookingCompletedAt?: string;              // ISO — used to compute mask window if policy is configured
  now?: string;
}

export interface MaskedCallOutcome {
  code: MaskedCallOutcomeCode;
  maskedRelayCode?: 'BOOKING_ACTIVE_MASK' | 'POST_BOOKING_MASK';
  windowExpiresAt?: string;                 // ISO
  policyStatus?: 'DECIDED' | 'POLICY_NOT_CONFIGURED';
}

const ACTIVE_STATUSES = new Set<string>(['CONFIRMED', 'READY_TO_START', 'IN_PROGRESS', 'ACCEPTED', 'QUOTED']);
const POST_STATUSES = new Set<string>(['COMPLETED']);

export function evaluateMaskedCall(input: MaskedCallInput): MaskedCallOutcome {
  if (input.actorUid !== input.customerUid && input.actorUid !== input.providerUid) {
    return { code: 'ACTOR_NOT_PARTY' };
  }
  if (ACTIVE_STATUSES.has(input.bookingStatus)) {
    // Active bookings always allow the masked relay.
    return { code: 'CALL_AUTHORIZED', maskedRelayCode: 'BOOKING_ACTIVE_MASK', policyStatus: 'DECIDED' };
  }
  if (POST_STATUSES.has(input.bookingStatus)) {
    if (!isPolicyConfigured(POLICY_KEY)) {
      return { code: 'POLICY_NOT_CONFIGURED', policyStatus: 'POLICY_NOT_CONFIGURED' };
    }
    const decision = getBusinessDecision(POLICY_KEY);
    // Registry currently returns null/undecided — but if a caller has
    // recorded a decided policy (e.g. 72h), we compute the window.
    const completedAt = input.bookingCompletedAt;
    if (!completedAt) return { code: 'MASK_WINDOW_EXPIRED', policyStatus: 'DECIDED' };
    const now = new Date(input.now ?? new Date().toISOString()).getTime();
    const completed = new Date(completedAt).getTime();
    const hoursCode = (decision as any)?.decisionValue?.postBookingMaskHours;
    const hours = typeof hoursCode === 'number' ? hoursCode : 0;
    const windowEnds = completed + hours * 60 * 60 * 1000;
    if (windowEnds <= now) return { code: 'MASK_WINDOW_EXPIRED', policyStatus: 'DECIDED' };
    return {
      code: 'CALL_AUTHORIZED',
      maskedRelayCode: 'POST_BOOKING_MASK',
      windowExpiresAt: new Date(windowEnds).toISOString(),
      policyStatus: 'DECIDED',
    };
  }
  return { code: 'BOOKING_NOT_ACTIVE' };
}
