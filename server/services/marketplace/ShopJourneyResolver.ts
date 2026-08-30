/**
 * ShopJourneyResolver — CEO NEXT-AUTO §14 (Lane B).
 *
 * JourneyState projection for a Shop order + actor. Mirrors the
 * BookingJourneyResolver shape; every string is a stable slug.
 *
 * §12 — never advertise PAY_AGAIN while the payment provider outcome
 * is uncertain. PAYMENT_PENDING routes to VIEW_PAYMENT_STATUS,
 * waitingOn=PAYMENT_PROVIDER, primary=VIEW_PAYMENT_STATUS.
 * §7 — customer cannot self-mark COLLECTED; staff verifies pickup.
 * §75 — REQUIRED obligations outrank informational.
 */
import {
  emptyJourneyState,
  type JourneyState,
  type Obligation,
  type Deadline,
  type WaitingParty,
  type MoneyState,
  type JourneyPriority,
} from '@shared/marketplace/journeyState';

export type ShopCanonicalStatus =
  | 'CART'
  | 'CHECKOUT'
  | 'PAYMENT_PENDING'
  | 'PAID'
  | 'PREPARING'
  | 'READY_FOR_PICKUP'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'REFUND_PENDING'
  | 'REFUNDED';

export interface ShopJourneySnapshot {
  orderId: string;
  status: ShopCanonicalStatus;
  customerUid: string;
  amountDueCents?: number;
  paymentCapturedCents?: number;
  currency?: 'ILS';
  pickupExpectedAt?: string;
  shipmentTrackingRef?: string;
  hasCustomerRating?: boolean;
}

export type ShopActorRole = 'CUSTOMER' | 'STAFF';

export interface ShopResolverInput {
  snapshot: ShopJourneySnapshot;
  actorUid: string;
  actorRole: ShopActorRole;
}

export function resolveShopJourney(input: ShopResolverInput): JourneyState {
  const s = input.snapshot;
  const entityRef = { kind: 'shop_order', id: s.orderId };
  const actor: JourneyState['actor'] = { role: input.actorRole === 'STAFF' ? 'ADMIN' : 'CUSTOMER', uid: input.actorUid };
  const base = emptyJourneyState(entityRef, actor, s.status);
  const [waitingOn, obligations, deadlines, money, primary, priority] = computeShop(s, input.actorRole);
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

function computeShop(
  s: ShopJourneySnapshot,
  role: ShopActorRole,
): [WaitingParty, Obligation[], Deadline[], MoneyState | undefined, string | undefined, JourneyPriority] {
  const deadlines: Deadline[] = [];
  const money: MoneyState | undefined = (() => {
    if (s.amountDueCents && s.amountDueCents > 0) return { amountCents: s.amountDueCents, currency: 'ILS', labelCode: 'AMOUNT_DUE', paymentStatusCode: 'DUE' };
    if (s.paymentCapturedCents && s.paymentCapturedCents > 0) return { amountCents: s.paymentCapturedCents, currency: 'ILS', labelCode: 'AMOUNT_CHARGED', paymentStatusCode: 'CAPTURED' };
    return undefined;
  })();
  if (role === 'STAFF') {
    return computeShopForStaff(s, deadlines, money);
  }
  return computeShopForCustomer(s, deadlines, money);
}

function computeShopForCustomer(
  s: ShopJourneySnapshot,
  deadlines: Deadline[],
  money: MoneyState | undefined,
): [WaitingParty, Obligation[], Deadline[], MoneyState | undefined, string | undefined, JourneyPriority] {
  switch (s.status) {
    case 'CART':
      return ['CUSTOMER', [{ type: 'NONE', severity: 'INFORMATIONAL', reasonCode: 'CART_OPEN' }], deadlines, money, 'CONTINUE_CHECKOUT', 'MEDIUM'];
    case 'CHECKOUT':
      return ['CUSTOMER', [{ type: 'PAY', severity: 'REQUIRED', reasonCode: 'CHECKOUT_PENDING' }], deadlines, money, 'CONTINUE_CHECKOUT', 'HIGH'];
    case 'PAYMENT_PENDING':
      // §12 — payment uncertainty routes to VIEW_PAYMENT_STATUS, not PAY_AGAIN.
      return ['PAYMENT_PROVIDER', [{ type: 'WAIT', severity: 'INFORMATIONAL', reasonCode: 'PAYMENT_UNKNOWN' }], deadlines, money, 'VIEW_PAYMENT_STATUS', 'HIGH'];
    case 'PAID':
    case 'PREPARING':
      return ['SYSTEM', [{ type: 'WAIT', severity: 'INFORMATIONAL', reasonCode: 'ORDER_PREPARING' }], deadlines, money, 'VIEW_ORDER', 'INFO'];
    case 'READY_FOR_PICKUP':
      if (s.pickupExpectedAt) deadlines.push({ reasonCode: 'PICKUP_EXPECTED', dueAt: s.pickupExpectedAt, hardCutoff: false });
      return ['CUSTOMER', [{ type: 'CONFIRM_ATTENDANCE', severity: 'REQUIRED', reasonCode: 'PICKUP_READY' }], deadlines, money, 'VIEW_PICKUP_DETAILS', 'HIGH'];
    case 'SHIPPED':
      return ['SYSTEM', [{ type: 'WAIT', severity: 'INFORMATIONAL', reasonCode: 'IN_TRANSIT' }], deadlines, money, 'TRACK_SHIPMENT', 'INFO'];
    case 'DELIVERED':
      if (!s.hasCustomerRating) {
        return ['CUSTOMER', [{ type: 'RATE_COMPLETED_SERVICE', severity: 'OPTIONAL', reasonCode: 'RATE_OPTIONAL' }], deadlines, money, 'VIEW_RECEIPT', 'INFO'];
      }
      return ['NONE', [{ type: 'NONE', severity: 'INFORMATIONAL', reasonCode: 'DELIVERED' }], deadlines, money, 'VIEW_RECEIPT', 'INFO'];
    case 'REFUND_PENDING':
      return ['PETWASH', [{ type: 'WAIT', severity: 'INFORMATIONAL', reasonCode: 'REFUND_IN_REVIEW' }], deadlines, money, 'VIEW_REFUND_STATUS', 'MEDIUM'];
    case 'REFUNDED':
      return ['NONE', [{ type: 'NONE', severity: 'INFORMATIONAL', reasonCode: 'REFUNDED' }], deadlines, money, 'VIEW_REFUND_STATUS', 'INFO'];
    case 'CANCELLED':
    default:
      return ['NONE', [{ type: 'NONE', severity: 'INFORMATIONAL', reasonCode: 'CANCELLED' }], deadlines, money, 'VIEW_ORDER', 'INFO'];
  }
}

function computeShopForStaff(
  s: ShopJourneySnapshot,
  deadlines: Deadline[],
  money: MoneyState | undefined,
): [WaitingParty, Obligation[], Deadline[], MoneyState | undefined, string | undefined, JourneyPriority] {
  switch (s.status) {
    case 'PAID':
    case 'PREPARING':
      return ['ADMIN', [{ type: 'NONE', severity: 'REQUIRED', reasonCode: 'PREPARE_ORDER' }], deadlines, money, 'STAFF_MARK_READY', 'HIGH'];
    case 'READY_FOR_PICKUP':
      return ['CUSTOMER', [{ type: 'WAIT', severity: 'INFORMATIONAL', reasonCode: 'AWAIT_PICKUP' }], deadlines, money, 'STAFF_VERIFY_PICKUP_PIN', 'MEDIUM'];
    case 'REFUND_PENDING':
      return ['ADMIN', [{ type: 'NONE', severity: 'REQUIRED', reasonCode: 'REFUND_REVIEW' }], deadlines, money, 'STAFF_REVIEW_REFUND', 'HIGH'];
    default:
      return ['NONE', [], deadlines, money, undefined, 'INFO'];
  }
}
