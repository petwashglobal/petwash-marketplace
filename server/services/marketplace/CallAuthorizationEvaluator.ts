/**
 * CallAuthorizationEvaluator — CEO PROGRAM 9 (Call Provider / Owner).
 *
 * Pure evaluator. Doctrine:
 *   § Before booking:  no raw number.
 *   § Confirmed booking: masked / in-app calling if available.
 *   § Active service:  Call prominently.
 *   § Emergency:       owner / provider / emergency contact / vet.
 *   § Do not expose raw numbers unnecessarily.
 *   § Do not record calls by default.
 *
 * Given (booking status, actor role, is-emergency, has-active-service),
 * returns which CALL surface (if any) the client may render, and the
 * masking discipline.
 */

export type CallSurface =
  | 'NONE'                                  // no call button
  | 'IN_APP_MASKED'                         // masked provider ↔ customer via app
  | 'EMERGENCY_LIST'                        // vet, emergency contact, provider, owner
  | 'RAW_NOT_ALLOWED';                      // caller asked for raw phone — refuse

export interface CallAuthInput {
  actorRole: 'CUSTOMER' | 'PROVIDER';
  bookingStatus: 'REQUESTED' | 'QUOTED' | 'PROVIDER_PROPOSED_CHANGE' | 'ACCEPTED' | 'CONFIRMED' | 'READY_TO_START' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'DECLINED' | 'EXPIRED';
  isEmergency?: boolean;
  isActiveServiceWindow?: boolean;
  requestingRawNumber?: boolean;
}

export type CallAuthOutcome =
  | { code: 'ALLOWED'; surface: CallSurface; recordCall: false; reasonCode: string }
  | { code: 'REFUSED'; reasonCode: string };

const CONFIRMED_STATES: ReadonlySet<CallAuthInput['bookingStatus']> = new Set<CallAuthInput['bookingStatus']>(['ACCEPTED', 'CONFIRMED', 'READY_TO_START', 'IN_PROGRESS']);

export function authorizeCall(input: CallAuthInput): CallAuthOutcome {
  if (input.requestingRawNumber) {
    // Doctrine: raw phone number is never handed to the client.
    return { code: 'REFUSED', reasonCode: 'RAW_NUMBER_NEVER_EXPOSED' };
  }
  if (input.isEmergency) {
    return { code: 'ALLOWED', surface: 'EMERGENCY_LIST', recordCall: false, reasonCode: 'EMERGENCY_SURFACE' };
  }
  if (!CONFIRMED_STATES.has(input.bookingStatus)) {
    return { code: 'REFUSED', reasonCode: 'NO_CALL_BEFORE_CONFIRMATION' };
  }
  return {
    code: 'ALLOWED',
    surface: 'IN_APP_MASKED',
    recordCall: false,
    reasonCode: input.isActiveServiceWindow ? 'ACTIVE_SERVICE_PROMINENT' : 'CONFIRMED_BOOKING_MASKED',
  };
}
