/**
 * ShopJourneyResolver — CEO NEXT-AUTO §14 Lane B.
 */
import { describe, it, expect } from 'vitest';
import {
  resolveShopJourney,
  type ShopJourneySnapshot,
} from '../services/marketplace/ShopJourneyResolver';

function snap(over: Partial<ShopJourneySnapshot> = {}): ShopJourneySnapshot {
  return {
    orderId: 'O-1',
    status: 'CART',
    customerUid: 'sarah',
    ...over,
  };
}

describe('customer journey per state', () => {
  it('CART → CONTINUE_CHECKOUT', () => {
    const r = resolveShopJourney({ snapshot: snap(), actorUid: 'sarah', actorRole: 'CUSTOMER' });
    expect(r.primaryAction?.actionType).toBe('CONTINUE_CHECKOUT');
    expect(r.waitingOn).toBe('CUSTOMER');
  });

  it('CHECKOUT with amountDue → PAY REQUIRED + CONTINUE_CHECKOUT (HIGH)', () => {
    const r = resolveShopJourney({ snapshot: snap({ status: 'CHECKOUT', amountDueCents: 12000 }), actorUid: 'sarah', actorRole: 'CUSTOMER' });
    expect(r.obligations.some((o) => o.type === 'PAY' && o.severity === 'REQUIRED')).toBe(true);
    expect(r.attentionPriority).toBe('HIGH');
    expect(r.money?.labelCode).toBe('AMOUNT_DUE');
  });

  it('§12 — PAYMENT_PENDING → VIEW_PAYMENT_STATUS, NEVER PAY_AGAIN', () => {
    const r = resolveShopJourney({ snapshot: snap({ status: 'PAYMENT_PENDING', amountDueCents: 12000 }), actorUid: 'sarah', actorRole: 'CUSTOMER' });
    expect(r.waitingOn).toBe('PAYMENT_PROVIDER');
    expect(r.primaryAction?.actionType).toBe('VIEW_PAYMENT_STATUS');
    expect(r.primaryAction?.actionType).not.toBe('PAY_AGAIN');
    expect(r.primaryAction?.actionType).not.toBe('CONTINUE_CHECKOUT');
  });

  it('PAID / PREPARING → VIEW_ORDER, waitingOn=SYSTEM', () => {
    for (const status of ['PAID', 'PREPARING'] as const) {
      const r = resolveShopJourney({ snapshot: snap({ status }), actorUid: 'sarah', actorRole: 'CUSTOMER' });
      expect(r.primaryAction?.actionType).toBe('VIEW_ORDER');
      expect(r.waitingOn).toBe('SYSTEM');
    }
  });

  it('READY_FOR_PICKUP → VIEW_PICKUP_DETAILS + CONFIRM_ATTENDANCE obligation (customer cannot self-mark COLLECTED)', () => {
    const r = resolveShopJourney({ snapshot: snap({ status: 'READY_FOR_PICKUP', pickupExpectedAt: '2026-08-30T18:00:00Z' }), actorUid: 'sarah', actorRole: 'CUSTOMER' });
    expect(r.primaryAction?.actionType).toBe('VIEW_PICKUP_DETAILS');
    // §7 discipline — the customer's action is VIEW_PICKUP_DETAILS, never STAFF_MARK_COLLECTED.
    expect(r.primaryAction?.actionType).not.toMatch(/COLLECTED/);
    expect(r.deadlines).toContainEqual({ reasonCode: 'PICKUP_EXPECTED', dueAt: '2026-08-30T18:00:00Z', hardCutoff: false });
  });

  it('SHIPPED → TRACK_SHIPMENT, waitingOn=SYSTEM', () => {
    const r = resolveShopJourney({ snapshot: snap({ status: 'SHIPPED' }), actorUid: 'sarah', actorRole: 'CUSTOMER' });
    expect(r.primaryAction?.actionType).toBe('TRACK_SHIPMENT');
    expect(r.waitingOn).toBe('SYSTEM');
  });

  it('DELIVERED without rating → OPTIONAL RATE_COMPLETED_SERVICE', () => {
    const r = resolveShopJourney({ snapshot: snap({ status: 'DELIVERED', hasCustomerRating: false }), actorUid: 'sarah', actorRole: 'CUSTOMER' });
    expect(r.obligations.some((o) => o.type === 'RATE_COMPLETED_SERVICE' && o.severity === 'OPTIONAL')).toBe(true);
    expect(r.primaryAction?.actionType).toBe('VIEW_RECEIPT');
  });

  it('REFUND_PENDING → PETWASH is waiting; primary VIEW_REFUND_STATUS', () => {
    const r = resolveShopJourney({ snapshot: snap({ status: 'REFUND_PENDING' }), actorUid: 'sarah', actorRole: 'CUSTOMER' });
    expect(r.waitingOn).toBe('PETWASH');
    expect(r.primaryAction?.actionType).toBe('VIEW_REFUND_STATUS');
  });
});

describe('staff journey', () => {
  it('READY_FOR_PICKUP: staff verifies pickup PIN, customer does not self-mark', () => {
    const r = resolveShopJourney({ snapshot: snap({ status: 'READY_FOR_PICKUP' }), actorUid: 'staff_1', actorRole: 'STAFF' });
    expect(r.primaryAction?.actionType).toBe('STAFF_VERIFY_PICKUP_PIN');
    expect(r.waitingOn).toBe('CUSTOMER');
  });

  it('REFUND_PENDING: staff must review', () => {
    const r = resolveShopJourney({ snapshot: snap({ status: 'REFUND_PENDING' }), actorUid: 'staff_1', actorRole: 'STAFF' });
    expect(r.primaryAction?.actionType).toBe('STAFF_REVIEW_REFUND');
  });
});
