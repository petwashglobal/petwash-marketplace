/**
 * providerBookingActions — canonical enum + derivation for the actions a
 * provider can take on a booking, computed by the SERVER.
 *
 * Per CEO 2026-08-18 §P1-17:
 *   Backend state determines allowed actions.
 *   Frontend decides button appearance.
 *
 * The client MUST NOT infer eligibility from labels or timestamps alone
 * (that was the ProviderToday `resolvePrimary()` pattern this replaces).
 * Instead, the client reads `primaryAction` + `allowedActions` from the
 * DTO and picks the button style + icon. If the client wants to render
 * an action button that the server did not include in allowedActions,
 * the button MUST be omitted — no client-side override.
 *
 * Kept in shared/ so client + server agree on the enum. The derivation
 * function is server-safe (no browser globals, no reads outside its
 * inputs) so it can also run in tests.
 */

export type ProviderBookingAction =
  | 'ACCEPT'                // pending → accepted / meet_greet_requested → schedule
  | 'DECLINE'               // pending / meet_greet_requested → declined
  | 'SCHEDULE_MEET_GREET'   // meet_greet_requested → meet_greet_scheduled
  | 'COMPLETE_MEET_GREET'   // meet_greet_scheduled → meet_greet_completed
  | 'ARRIVING'              // confirmed + close-to-start → notify customer "on the way"
  | 'START_SERVICE'         // confirmed + imminent → in_progress
  | 'FINISH_SERVICE'        // in_progress → provider_marked_complete
  | 'MESSAGE'               // any live state
  | 'VIEW_DETAILS';         // fallback — always allowed

export interface ActionResolution {
  primaryAction: ProviderBookingAction;
  allowedActions: ProviderBookingAction[];
}

export interface BookingActionContext {
  /** Canonical booking status (as stored in booking_requests.status). */
  status: string | null | undefined;
  /** For confirmed bookings: minutes until scheduled start (start_date). */
  minutesUntilStart?: number | null;
  /** For meet_greet_scheduled bookings: minutes until meet_greet_date. */
  minutesUntilMeetGreet?: number | null;
}

/** Imminent-start window per CEO §"Provider Booking Card". */
export const IMMINENT_MINUTES = 15;
/** "On the way" window — provider is en route. */
export const ARRIVING_MINUTES = 60;

/**
 * Deterministic action derivation. Same rule server + client.
 *
 * Notes:
 *   • MESSAGE is offered on every state that has a live counter-party
 *     to talk to; it is deliberately NOT the primary except when nothing
 *     more interesting is happening.
 *   • VIEW_DETAILS is a universal fallback so the UI is never
 *     button-less.
 *   • The server also enforces the transition itself on the route
 *     handler — a client that gets a stale allowedActions and POSTs an
 *     action that no longer applies gets a 409 from the state machine.
 */
export function resolveProviderBookingActions(ctx: BookingActionContext): ActionResolution {
  const status = (ctx.status || '').toLowerCase();
  const minsUntilStart = ctx.minutesUntilStart ?? null;
  const minsUntilMG = ctx.minutesUntilMeetGreet ?? null;

  // Always safe.
  const universalAllowed: ProviderBookingAction[] = ['MESSAGE', 'VIEW_DETAILS'];

  switch (status) {
    case 'pending':
      return {
        primaryAction: 'ACCEPT',
        allowedActions: ['ACCEPT', 'DECLINE', ...universalAllowed],
      };
    case 'meet_greet_requested':
      return {
        primaryAction: 'SCHEDULE_MEET_GREET',
        allowedActions: ['SCHEDULE_MEET_GREET', 'DECLINE', ...universalAllowed],
      };
    case 'meet_greet_scheduled':
      // Only surface "complete" as the primary when the meeting is here.
      if (minsUntilMG != null && minsUntilMG <= IMMINENT_MINUTES) {
        return {
          primaryAction: 'COMPLETE_MEET_GREET',
          allowedActions: ['COMPLETE_MEET_GREET', ...universalAllowed],
        };
      }
      return {
        primaryAction: 'VIEW_DETAILS',
        allowedActions: ['COMPLETE_MEET_GREET', ...universalAllowed],
      };
    case 'meet_greet_completed':
    case 'accepted':
    case 'payment_pending':
      return {
        primaryAction: 'VIEW_DETAILS',
        allowedActions: universalAllowed,
      };
    case 'confirmed': {
      if (minsUntilStart != null && minsUntilStart <= IMMINENT_MINUTES) {
        return {
          primaryAction: 'START_SERVICE',
          allowedActions: ['START_SERVICE', 'ARRIVING', ...universalAllowed],
        };
      }
      if (minsUntilStart != null && minsUntilStart <= ARRIVING_MINUTES) {
        return {
          primaryAction: 'ARRIVING',
          allowedActions: ['ARRIVING', ...universalAllowed],
        };
      }
      return {
        primaryAction: 'VIEW_DETAILS',
        allowedActions: universalAllowed,
      };
    }
    case 'in_progress':
      return {
        primaryAction: 'FINISH_SERVICE',
        allowedActions: ['FINISH_SERVICE', ...universalAllowed],
      };
    case 'provider_marked_complete':
    case 'completed':
    case 'reviewed':
    case 'cancelled':
    case 'declined':
    case 'disputed':
    default:
      return {
        primaryAction: 'VIEW_DETAILS',
        allowedActions: universalAllowed,
      };
  }
}
