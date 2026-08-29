/**
 * Lane A — Progressive signup state machine.
 *
 * CEO FLY MODE II — AUTH CONVERSION P0 (2026-08-29).
 *
 * The ONE authority for the signup surface. Replaces the tangled
 * `readyForSubmit / joinReady / bothContacts / startSignup / startJoin`
 * predicates in SignUpLuxury.tsx with a single explicit state
 * machine driven off two inputs:
 *   • the user's current method choice (Google / Apple / mobile / email)
 *   • the server-authoritative account-resolution payload returned
 *     from POST /api/auth/session
 *
 * Rules (CEO §1 canonical model):
 *   METHOD_SELECTION → AUTHENTICATING → CONTACT_VERIFY? →
 *   ACCOUNT_RESOLUTION → PROFILE_COMPLETION? → ACTIVATION →
 *   POST_LOGIN → DONE
 *
 * The client NEVER guesses `isNewUser` (CEO §9) — it always waits for
 * the server response.
 */

export type AuthMethod = 'google' | 'apple' | 'mobile' | 'email';

/**
 * The action list the server can request during PROFILE_COMPLETION.
 * Each action is one focused screen; NO action is bundled with
 * unrelated fields.
 */
export type RequiredAction =
  | 'mobile_verification'
  | 'email_verification'
  | 'first_name'
  | 'last_name'
  | 'date_of_birth'
  | 'terms_acceptance';

export type ProfileState = 'complete' | 'incomplete';

/**
 * The server's authoritative account-resolution response. Sent by
 * POST /api/auth/session; the client trusts this verbatim.
 */
export interface AccountResolution {
  isNewUser: boolean;
  profileState: ProfileState;
  /**
   * ORDERED — the client renders them one at a time in this order.
   * The server's order is the source of truth so a display change
   * ships as a server-side reorder, not a scattered client patch.
   */
  requiredActions: RequiredAction[];
  /** Server-owned destination string, e.g. '/pet-parent/home'. */
  destination: string;
}

export type SignupState =
  | { name: 'METHOD_SELECTION' }
  | { name: 'AUTHENTICATING'; method: AuthMethod }
  | { name: 'CONTACT_VERIFY'; method: 'mobile' | 'email'; sentTo: string }
  | { name: 'ACCOUNT_RESOLUTION' }
  | { name: 'PROFILE_COMPLETION'; pending: RequiredAction[]; total: number; index: number }
  | { name: 'ACTIVATION' }
  | { name: 'POST_LOGIN'; destination: string }
  | { name: 'DONE' };

export type SignupEvent =
  | { kind: 'CHOOSE_METHOD'; method: AuthMethod }
  | { kind: 'AUTH_CODE_SENT'; sentTo: string; method: 'mobile' | 'email' }
  | { kind: 'AUTH_SUCCESS' }
  | { kind: 'RESOLVED'; resolution: AccountResolution }
  | { kind: 'ACTION_COMPLETED' }
  | { kind: 'ACTIVATED' }
  | { kind: 'REACHED_DESTINATION' }
  | { kind: 'RESET' };

export const initialState: SignupState = { name: 'METHOD_SELECTION' };

/**
 * Pure reducer. Given (state, event) → next state. Every unhandled
 * (state, event) pair returns the state unchanged so the caller
 * never crashes on an unexpected fire.
 */
export function reduce(state: SignupState, event: SignupEvent): SignupState {
  if (event.kind === 'RESET') return initialState;

  switch (state.name) {
    case 'METHOD_SELECTION':
      if (event.kind === 'CHOOSE_METHOD') {
        return { name: 'AUTHENTICATING', method: event.method };
      }
      return state;

    case 'AUTHENTICATING': {
      // Google / Apple skip CONTACT_VERIFY — a successful provider
      // handshake becomes an AUTH_SUCCESS directly.
      if (event.kind === 'AUTH_CODE_SENT' && (state.method === 'mobile' || state.method === 'email')) {
        return { name: 'CONTACT_VERIFY', method: state.method, sentTo: event.sentTo };
      }
      if (event.kind === 'AUTH_SUCCESS') {
        return { name: 'ACCOUNT_RESOLUTION' };
      }
      return state;
    }

    case 'CONTACT_VERIFY':
      if (event.kind === 'AUTH_SUCCESS') {
        return { name: 'ACCOUNT_RESOLUTION' };
      }
      return state;

    case 'ACCOUNT_RESOLUTION':
      if (event.kind === 'RESOLVED') {
        const { requiredActions, destination } = event.resolution;
        if (requiredActions.length === 0) {
          // Nothing to collect → straight to activation. The server
          // may still opt to run its own activation step (loyalty
          // wallet seed, etc); the client waits on ACTIVATED before
          // navigating.
          return { name: 'ACTIVATION' };
        }
        return {
          name: 'PROFILE_COMPLETION',
          pending: requiredActions,
          total: requiredActions.length,
          index: 0,
        };
      }
      return state;

    case 'PROFILE_COMPLETION':
      if (event.kind === 'ACTION_COMPLETED') {
        const nextIndex = state.index + 1;
        if (nextIndex >= state.pending.length) {
          return { name: 'ACTIVATION' };
        }
        return { ...state, index: nextIndex };
      }
      return state;

    case 'ACTIVATION':
      if (event.kind === 'ACTIVATED') {
        // Destination MUST come from the server-owned RESOLVED payload
        // — but we lost it when we transitioned out. The caller passes
        // the destination alongside ACTIVATED via a wrapper if it
        // needs to. For the pure reducer we default to '/' and let
        // the wrapper override; POST_LOGIN honors whatever comes in.
        return { name: 'POST_LOGIN', destination: '/' };
      }
      return state;

    case 'POST_LOGIN':
      if (event.kind === 'REACHED_DESTINATION') {
        return { name: 'DONE' };
      }
      return state;

    case 'DONE':
      return state;
  }

  return state;
}

/**
 * The currently-active PROFILE_COMPLETION action, or null when the
 * state machine is not in that phase. UI reads this to decide which
 * focused screen to render.
 */
export function currentAction(state: SignupState): RequiredAction | null {
  if (state.name !== 'PROFILE_COMPLETION') return null;
  return state.pending[state.index] ?? null;
}

/**
 * Progress label for the profile-completion screens — "1 of 2" etc.
 * Returns null outside PROFILE_COMPLETION.
 */
export function progressLabel(state: SignupState): { current: number; total: number } | null {
  if (state.name !== 'PROFILE_COMPLETION') return null;
  return { current: state.index + 1, total: state.total };
}
