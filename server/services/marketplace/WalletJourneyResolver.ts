/**
 * WalletJourneyResolver — CEO NEXT-AUTO §14 continuous refill.
 *
 * JourneyState projection for a wallet top-up + actor. §12 discipline
 * on payment uncertainty: PENDING → VIEW_TOPUP_STATUS, never TOPUP_AGAIN.
 */
import {
  emptyJourneyState,
  type JourneyState,
  type Obligation,
  type Deadline,
  type MoneyState,
  type WaitingParty,
  type JourneyPriority,
} from '@shared/marketplace/journeyState';

export type WalletTopupStatus =
  | 'INITIATED'
  | 'PAYMENT_PENDING'
  | 'CAPTURED'
  | 'FAILED_FINAL'
  | 'REFUND_PENDING'
  | 'REFUNDED';

export interface WalletJourneySnapshot {
  topupId: string;
  status: WalletTopupStatus;
  customerUid: string;
  amountCents: number;
  currency?: 'ILS';
  requestedAt?: string;
}

export interface WalletResolverInput {
  snapshot: WalletJourneySnapshot;
  actorUid: string;
}

export function resolveWalletJourney(input: WalletResolverInput): JourneyState {
  const s = input.snapshot;
  const entityRef = { kind: 'wallet_topup', id: s.topupId };
  const actor: JourneyState['actor'] = { role: 'CUSTOMER', uid: input.actorUid };
  const base = emptyJourneyState(entityRef, actor, s.status);
  const money: MoneyState = { amountCents: s.amountCents, currency: 'ILS', labelCode: 'TOPUP_AMOUNT' };
  const deadlines: Deadline[] = [];
  const [waitingOn, obligations, primary, priority] = classify(s);
  return {
    ...base,
    waitingOn,
    obligations,
    deadlines,
    money,
    primaryAction: primary ? { actionType: primary, reasonCode: `PRIMARY_FOR_${s.status}` } : undefined,
    availableActions: [],
    attentionPriority: priority,
  };
}

function classify(s: WalletJourneySnapshot): [WaitingParty, Obligation[], string | undefined, JourneyPriority] {
  switch (s.status) {
    case 'INITIATED':
      return ['CUSTOMER', [{ type: 'PAY', severity: 'REQUIRED', reasonCode: 'TOPUP_PAY' }], 'CONTINUE_CHECKOUT', 'HIGH'];
    case 'PAYMENT_PENDING':
      // §12 — never advertise TOPUP_AGAIN under uncertain outcome.
      return ['PAYMENT_PROVIDER', [{ type: 'WAIT', severity: 'INFORMATIONAL', reasonCode: 'TOPUP_UNKNOWN' }], 'VIEW_TOPUP_STATUS', 'HIGH'];
    case 'CAPTURED':
      return ['NONE', [{ type: 'NONE', severity: 'INFORMATIONAL', reasonCode: 'TOPUP_CAPTURED' }], 'VIEW_WALLET_BALANCE', 'INFO'];
    case 'FAILED_FINAL':
      return ['CUSTOMER', [{ type: 'NONE', severity: 'OPTIONAL', reasonCode: 'TOPUP_FAILED_FINAL' }], 'START_NEW_TOPUP', 'MEDIUM'];
    case 'REFUND_PENDING':
      return ['PETWASH', [{ type: 'WAIT', severity: 'INFORMATIONAL', reasonCode: 'REFUND_IN_REVIEW' }], 'VIEW_REFUND_STATUS', 'MEDIUM'];
    case 'REFUNDED':
      return ['NONE', [{ type: 'NONE', severity: 'INFORMATIONAL', reasonCode: 'REFUNDED' }], 'VIEW_REFUND_STATUS', 'INFO'];
    default:
      return ['NONE', [], undefined, 'INFO'];
  }
}
