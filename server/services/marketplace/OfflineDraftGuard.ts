/**
 * OfflineDraftGuard — CEO PROGRAM 48 (Offline / Bad Network).
 *
 * Pure evaluator. Doctrine:
 *   § Draft messages CAN survive offline.
 *   § Payment / material action MUST require a live connection.
 *   § On reconnect, RECONCILE first — never blindly resend payment.
 *
 * Given an outbound action + connectivity state, decides whether
 * the client should:
 *   ATTEMPT_NOW  — safe to execute.
 *   QUEUE_LOCAL  — safe to keep the draft locally until reconnect.
 *   BLOCK        — refuse (needs live network + reconciliation first).
 */

export type ActionClass =
  | 'CHAT_DRAFT'
  | 'FAVOURITE_TOGGLE'
  | 'DISMISS_ATTENTION'
  | 'MESSAGE_SEND'
  | 'BOOKING_REQUEST_SEND'
  | 'BOOKING_ACCEPT'
  | 'BOOKING_DECLINE'
  | 'PAYMENT_INITIATE'
  | 'PAYMENT_CONFIRM'
  | 'WALLET_TOPUP'
  | 'REFUND_REQUEST'
  | 'JOB_START'
  | 'JOB_COMPLETE'
  | 'HANDOFF_VERIFY';

export interface OfflineGuardInput {
  action: ActionClass;
  connectivity: 'ONLINE' | 'OFFLINE' | 'UNSTABLE';
  hasUnreconciledPayment: boolean;
}

export type OfflineGuardOutcome =
  | { code: 'ATTEMPT_NOW' }
  | { code: 'QUEUE_LOCAL'; reasonCode: 'DRAFT_SAFE_LOCAL' }
  | { code: 'BLOCK'; reasonCode:
      | 'NETWORK_REQUIRED'
      | 'RECONCILE_BEFORE_MUTATE' };

const DRAFT_SAFE: ReadonlySet<ActionClass> = new Set<ActionClass>([
  'CHAT_DRAFT',
  'FAVOURITE_TOGGLE',
  'DISMISS_ATTENTION',
  'MESSAGE_SEND',
]);

const MONEY_OR_LIFECYCLE: ReadonlySet<ActionClass> = new Set<ActionClass>([
  'PAYMENT_INITIATE',
  'PAYMENT_CONFIRM',
  'WALLET_TOPUP',
  'REFUND_REQUEST',
  'JOB_START',
  'JOB_COMPLETE',
  'HANDOFF_VERIFY',
  'BOOKING_ACCEPT',
  'BOOKING_DECLINE',
  'BOOKING_REQUEST_SEND',
]);

export function evaluateOfflineAction(input: OfflineGuardInput): OfflineGuardOutcome {
  // §12 discipline: never send another money/lifecycle mutation while
  // a previous payment is unreconciled, even online.
  if (MONEY_OR_LIFECYCLE.has(input.action) && input.hasUnreconciledPayment) {
    return { code: 'BLOCK', reasonCode: 'RECONCILE_BEFORE_MUTATE' };
  }

  if (input.connectivity === 'ONLINE') return { code: 'ATTEMPT_NOW' };

  // OFFLINE / UNSTABLE.
  if (DRAFT_SAFE.has(input.action)) return { code: 'QUEUE_LOCAL', reasonCode: 'DRAFT_SAFE_LOCAL' };
  return { code: 'BLOCK', reasonCode: 'NETWORK_REQUIRED' };
}
