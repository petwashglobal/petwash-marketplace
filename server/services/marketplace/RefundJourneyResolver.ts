/**
 * RefundJourneyResolver — CEO NEXT-AUTO §14 refill.
 *
 * JourneyState for a refund. Refund is its own domain object — a
 * booking / shop order / gift may spawn a refund; the refund has its
 * own lifecycle (REQUESTED → REVIEWING → APPROVED → ISSUED → SETTLED).
 * Reject / DISPUTED are separate branches.
 */
import {
  emptyJourneyState,
  type JourneyState,
  type Obligation,
  type MoneyState,
  type WaitingParty,
  type JourneyPriority,
} from '@shared/marketplace/journeyState';

export type RefundStatus =
  | 'REQUESTED'
  | 'REVIEWING'
  | 'APPROVED'
  | 'ISSUED'
  | 'SETTLED'
  | 'DECLINED'
  | 'DISPUTED';

export interface RefundJourneySnapshot {
  refundId: string;
  status: RefundStatus;
  customerUid: string;
  originEntityRef: { kind: 'booking' | 'shop_order' | 'gift' | 'k9000_session' | 'wallet_topup'; id: string };
  amountCents: number;
  currency?: 'ILS';
  expectedSettleAt?: string;
}

export function resolveRefundJourney(input: { snapshot: RefundJourneySnapshot; actorUid: string }): JourneyState {
  const s = input.snapshot;
  const entityRef = { kind: 'refund', id: s.refundId };
  const actor: JourneyState['actor'] = { role: 'CUSTOMER', uid: input.actorUid };
  const base = emptyJourneyState(entityRef, actor, s.status);
  const money: MoneyState = { amountCents: s.amountCents, currency: 'ILS', labelCode: 'REFUND_AMOUNT', paymentStatusCode: s.status };
  const [waitingOn, obligations, primary, priority] = classify(s);
  return {
    ...base,
    waitingOn,
    obligations,
    money,
    primaryAction: primary ? { actionType: primary, reasonCode: `PRIMARY_FOR_${s.status}` } : undefined,
    availableActions: [],
    attentionPriority: priority,
    deadlines: s.expectedSettleAt ? [{ reasonCode: 'REFUND_EXPECTED', dueAt: s.expectedSettleAt, hardCutoff: false }] : [],
  };
}

function classify(s: RefundJourneySnapshot): [WaitingParty, Obligation[], string | undefined, JourneyPriority] {
  switch (s.status) {
    case 'REQUESTED':
    case 'REVIEWING':
      return ['PETWASH', [{ type: 'WAIT', severity: 'INFORMATIONAL', reasonCode: 'REFUND_IN_REVIEW' }], 'VIEW_REFUND_STATUS', 'MEDIUM'];
    case 'APPROVED':
    case 'ISSUED':
      return ['PAYMENT_PROVIDER', [{ type: 'WAIT', severity: 'INFORMATIONAL', reasonCode: 'REFUND_ISSUED' }], 'VIEW_REFUND_STATUS', 'MEDIUM'];
    case 'SETTLED':
      return ['NONE', [{ type: 'NONE', severity: 'INFORMATIONAL', reasonCode: 'REFUNDED' }], 'VIEW_REFUND_STATUS', 'INFO'];
    case 'DECLINED':
      return ['CUSTOMER', [{ type: 'NONE', severity: 'OPTIONAL', reasonCode: 'REFUND_DECLINED' }], 'CONTACT_SUPPORT', 'MEDIUM'];
    case 'DISPUTED':
      return ['PETWASH', [{ type: 'WAIT', severity: 'INFORMATIONAL', reasonCode: 'REFUND_DISPUTED' }], 'CONTACT_SUPPORT', 'HIGH'];
    default:
      return ['NONE', [], undefined, 'INFO'];
  }
}
