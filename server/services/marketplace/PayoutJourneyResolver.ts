/**
 * PayoutJourneyResolver — CEO NEXT-AUTO §14.
 *
 * JourneyState for the provider payout lifecycle. Provider view only —
 * customers do not observe payouts.
 */
import {
  emptyJourneyState,
  type JourneyState,
  type Obligation,
  type MoneyState,
  type WaitingParty,
  type JourneyPriority,
} from '@shared/marketplace/journeyState';

export type PayoutStatus =
  | 'PENDING_HOLD'
  | 'READY_TO_TRANSFER'
  | 'TRANSFERRING'
  | 'PAID'
  | 'FAILED'
  | 'RECONCILING';

export interface PayoutJourneySnapshot {
  payoutId: string;
  status: PayoutStatus;
  providerUid: string;
  amountCents: number;
  currency?: 'ILS';
  holdReleasesAt?: string;
  reconciliationNoteCode?: string;
}

export interface PayoutResolverInput {
  snapshot: PayoutJourneySnapshot;
  actorUid: string;
}

export function resolvePayoutJourney(input: PayoutResolverInput): JourneyState {
  const s = input.snapshot;
  const entityRef = { kind: 'payout', id: s.payoutId };
  const actor: JourneyState['actor'] = { role: 'PROVIDER', uid: input.actorUid };
  const base = emptyJourneyState(entityRef, actor, s.status);
  const money: MoneyState = { amountCents: s.amountCents, currency: 'ILS', labelCode: 'PAYOUT_AMOUNT', paymentStatusCode: s.status };
  const [waitingOn, obligations, primary, priority] = classify(s);
  return {
    ...base,
    waitingOn,
    obligations,
    money,
    primaryAction: primary ? { actionType: primary, reasonCode: `PRIMARY_FOR_${s.status}` } : undefined,
    availableActions: [],
    attentionPriority: priority,
    deadlines: s.holdReleasesAt ? [{ reasonCode: 'PAYOUT_HOLD_RELEASES', dueAt: s.holdReleasesAt, hardCutoff: false }] : [],
  };
}

function classify(s: PayoutJourneySnapshot): [WaitingParty, Obligation[], string | undefined, JourneyPriority] {
  switch (s.status) {
    case 'PENDING_HOLD':
      return ['PETWASH', [{ type: 'WAIT', severity: 'INFORMATIONAL', reasonCode: 'HOLD_WINDOW' }], 'VIEW_PAYOUT', 'INFO'];
    case 'READY_TO_TRANSFER':
      return ['SYSTEM', [{ type: 'WAIT', severity: 'INFORMATIONAL', reasonCode: 'READY_TO_TRANSFER' }], 'VIEW_PAYOUT', 'MEDIUM'];
    case 'TRANSFERRING':
      return ['PAYMENT_PROVIDER', [{ type: 'WAIT', severity: 'INFORMATIONAL', reasonCode: 'TRANSFERRING' }], 'VIEW_PAYOUT_STATUS', 'HIGH'];
    case 'PAID':
      return ['NONE', [{ type: 'NONE', severity: 'INFORMATIONAL', reasonCode: 'PAID' }], 'VIEW_PAYOUT_RECEIPT', 'INFO'];
    case 'FAILED':
      return ['PETWASH', [{ type: 'NONE', severity: 'REQUIRED', reasonCode: 'PAYOUT_FAILED' }], 'CONTACT_SUPPORT', 'URGENT'];
    case 'RECONCILING':
      return ['PETWASH', [{ type: 'WAIT', severity: 'INFORMATIONAL', reasonCode: 'RECONCILING' }], 'VIEW_PAYOUT_STATUS', 'HIGH'];
    default:
      return ['NONE', [], undefined, 'INFO'];
  }
}
