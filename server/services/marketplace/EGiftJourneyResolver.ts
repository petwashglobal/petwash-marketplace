/**
 * EGiftJourneyResolver — CEO NEXT-AUTO §14 continuous refill.
 *
 * JourneyState for the eGift lifecycle (buyer + recipient projections).
 * Recipient never sees BUYER-side money state; buyer never sees the
 * redemption code.
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

export type EGiftStatus =
  | 'CREATED'
  | 'PAYMENT_PENDING'
  | 'PAID'
  | 'DELIVERY_PENDING'
  | 'DELIVERED_TO_RECIPIENT'
  | 'REDEEMED'
  | 'EXPIRED'
  | 'REFUNDED';

export type EGiftActorRole = 'BUYER' | 'RECIPIENT';

export interface EGiftJourneySnapshot {
  giftId: string;
  status: EGiftStatus;
  buyerUid: string;
  recipientUid?: string;                // may be undefined if delivered to email
  amountCents: number;
  currency?: 'ILS';
  expiresAt?: string;
}

export interface EGiftResolverInput {
  snapshot: EGiftJourneySnapshot;
  actorUid: string;
  actorRole: EGiftActorRole;
}

export function resolveEGiftJourney(input: EGiftResolverInput): JourneyState {
  const s = input.snapshot;
  const entityRef = { kind: 'gift', id: s.giftId };
  const actor: JourneyState['actor'] = { role: 'CUSTOMER', uid: input.actorUid };
  const base = emptyJourneyState(entityRef, actor, s.status);
  const money: MoneyState = { amountCents: s.amountCents, currency: 'ILS', labelCode: 'GIFT_AMOUNT' };
  const deadlines: Deadline[] = [];
  if (s.expiresAt) deadlines.push({ reasonCode: 'GIFT_EXPIRES', dueAt: s.expiresAt, hardCutoff: true });
  const [waitingOn, obligations, primary, priority] = classify(s, input.actorRole);
  return {
    ...base,
    waitingOn,
    obligations,
    deadlines,
    money: input.actorRole === 'BUYER' ? money : undefined,
    primaryAction: primary ? { actionType: primary, reasonCode: `PRIMARY_FOR_${s.status}` } : undefined,
    availableActions: [],
    attentionPriority: priority,
  };
}

function classify(s: EGiftJourneySnapshot, role: EGiftActorRole): [WaitingParty, Obligation[], string | undefined, JourneyPriority] {
  if (role === 'BUYER') {
    switch (s.status) {
      case 'CREATED':               return ['CUSTOMER', [{ type: 'PAY', severity: 'REQUIRED', reasonCode: 'GIFT_PAY' }], 'CONTINUE_CHECKOUT', 'HIGH'];
      case 'PAYMENT_PENDING':       return ['PAYMENT_PROVIDER', [{ type: 'WAIT', severity: 'INFORMATIONAL', reasonCode: 'GIFT_PAY_UNKNOWN' }], 'VIEW_PAYMENT_STATUS', 'HIGH'];
      case 'PAID':
      case 'DELIVERY_PENDING':      return ['SYSTEM', [{ type: 'WAIT', severity: 'INFORMATIONAL', reasonCode: 'GIFT_DELIVERY' }], 'VIEW_GIFT', 'INFO'];
      case 'DELIVERED_TO_RECIPIENT':return ['NONE', [], 'VIEW_GIFT_RECEIPT', 'INFO'];
      case 'REDEEMED':              return ['NONE', [{ type: 'NONE', severity: 'INFORMATIONAL', reasonCode: 'GIFT_REDEEMED' }], 'VIEW_GIFT_RECEIPT', 'INFO'];
      case 'EXPIRED':               return ['NONE', [{ type: 'NONE', severity: 'INFORMATIONAL', reasonCode: 'GIFT_EXPIRED' }], 'VIEW_REFUND_STATUS', 'INFO'];
      case 'REFUNDED':              return ['NONE', [], 'VIEW_REFUND_STATUS', 'INFO'];
      default:                      return ['NONE', [], undefined, 'INFO'];
    }
  }
  // RECIPIENT
  switch (s.status) {
    case 'DELIVERED_TO_RECIPIENT':  return ['CUSTOMER', [{ type: 'NONE', severity: 'OPTIONAL', reasonCode: 'GIFT_READY_TO_REDEEM' }], 'REDEEM_GIFT', 'MEDIUM'];
    case 'REDEEMED':                return ['NONE', [{ type: 'NONE', severity: 'INFORMATIONAL', reasonCode: 'GIFT_REDEEMED' }], 'VIEW_GIFT_RECEIPT', 'INFO'];
    case 'EXPIRED':                 return ['NONE', [{ type: 'NONE', severity: 'INFORMATIONAL', reasonCode: 'GIFT_EXPIRED' }], undefined, 'INFO'];
    default:                        return ['NONE', [], undefined, 'INFO'];
  }
}
