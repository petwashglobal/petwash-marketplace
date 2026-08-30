/**
 * ContactChangeStateMachine — CEO P0-MY-ACCOUNT step 3+4.
 *
 * Pure state-machine + OTP-handshake for CHANGE MOBILE and CHANGE
 * EMAIL. The doctrine's contract:
 *   1. tap Change
 *   2. enter new value
 *   3. validation
 *   4. send OTP / verification link
 *   5. verify code / link
 *   6. server changes canonical value
 *   7. confirmation
 *   8. UI refreshes everywhere
 *
 *   DO NOT change verified phone / email merely because someone
 *   typed into an input.
 *
 * This evaluator NEVER writes state — it computes the next state
 * transition given the current state + event. Callers wire the
 * persistence + OTP send.
 */

export type ChangeKind = 'MOBILE' | 'EMAIL';

export type ChangeState =
  | 'IDLE'
  | 'PROPOSED'                            // user typed a new value; awaiting validation
  | 'AWAITING_VERIFICATION'               // OTP sent
  | 'VERIFIED_PENDING_COMMIT'             // code verified; server about to write canonical
  | 'COMMITTED'
  | 'CANCELLED'
  | 'FAILED';

export type ChangeEvent =
  | { kind: 'PROPOSE'; value: string }
  | { kind: 'VALIDATED' }
  | { kind: 'INVALID'; reasonCode: string }
  | { kind: 'OTP_SENT' }
  | { kind: 'OTP_VERIFIED' }
  | { kind: 'OTP_WRONG' }
  | { kind: 'OTP_EXPIRED' }
  | { kind: 'RESEND' }
  | { kind: 'COMMIT_OK' }
  | { kind: 'COMMIT_FAILED'; reasonCode: string }
  | { kind: 'CANCEL' };

export interface StateContext {
  state: ChangeState;
  proposedValue?: string;
  attempts: number;
  lastReasonCode?: string;
}

export type Transition =
  | { code: 'OK'; next: StateContext }
  | { code: 'ILLEGAL_TRANSITION'; state: ChangeState; event: ChangeEvent['kind'] };

const MAX_ATTEMPTS = 5;

export function transition(ctx: StateContext, event: ChangeEvent): Transition {
  const bump = (nextState: ChangeState, over: Partial<StateContext> = {}): Transition => ({
    code: 'OK',
    next: { ...ctx, ...over, state: nextState },
  });

  switch (ctx.state) {
    case 'IDLE':
      if (event.kind === 'PROPOSE') return bump('PROPOSED', { proposedValue: event.value, attempts: 0, lastReasonCode: undefined });
      break;
    case 'PROPOSED':
      if (event.kind === 'VALIDATED') return bump('PROPOSED');
      if (event.kind === 'INVALID') return bump('FAILED', { lastReasonCode: event.reasonCode });
      if (event.kind === 'OTP_SENT') return bump('AWAITING_VERIFICATION');
      if (event.kind === 'CANCEL') return bump('CANCELLED');
      break;
    case 'AWAITING_VERIFICATION':
      if (event.kind === 'OTP_VERIFIED') return bump('VERIFIED_PENDING_COMMIT');
      if (event.kind === 'OTP_WRONG') {
        const next = ctx.attempts + 1;
        if (next >= MAX_ATTEMPTS) return bump('FAILED', { attempts: next, lastReasonCode: 'MAX_OTP_ATTEMPTS' });
        return bump('AWAITING_VERIFICATION', { attempts: next, lastReasonCode: 'OTP_WRONG' });
      }
      if (event.kind === 'OTP_EXPIRED') return bump('FAILED', { lastReasonCode: 'OTP_EXPIRED' });
      if (event.kind === 'RESEND') return bump('AWAITING_VERIFICATION', { attempts: 0, lastReasonCode: undefined });
      if (event.kind === 'CANCEL') return bump('CANCELLED');
      break;
    case 'VERIFIED_PENDING_COMMIT':
      if (event.kind === 'COMMIT_OK') return bump('COMMITTED');
      if (event.kind === 'COMMIT_FAILED') return bump('FAILED', { lastReasonCode: event.reasonCode });
      break;
    case 'COMMITTED':
    case 'CANCELLED':
    case 'FAILED':
      // Terminal states — no further transitions until a fresh flow.
      break;
  }
  return { code: 'ILLEGAL_TRANSITION', state: ctx.state, event: event.kind };
}

export function initial(): StateContext {
  return { state: 'IDLE', attempts: 0 };
}

// ── Input validation helpers (shared with client) ────────────────

const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RE_PHONE_E164 = /^\+\d{8,15}$/;

export function isValidNewValue(kind: ChangeKind, value: string): boolean {
  if (!value || typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (kind === 'EMAIL') return RE_EMAIL.test(trimmed);
  return RE_PHONE_E164.test(trimmed);
}
