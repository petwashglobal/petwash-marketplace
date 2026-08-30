/**
 * RefundJourneyResolver behavior — CEO NEXT-AUTO §14 refill.
 *
 * A refund is its own domain object (§43): the customer view must
 * always know which party (PetWash / payment provider / customer)
 * is holding progress.
 */
import { describe, it, expect } from 'vitest';
import { resolveRefundJourney } from '../services/marketplace/RefundJourneyResolver';

describe('Refund — customer view routing', () => {
  it('REQUESTED → waitingOn=PETWASH, primary VIEW_REFUND_STATUS, MEDIUM', () => {
    const r = resolveRefundJourney({
      snapshot: {
        refundId: 'R-1',
        status: 'REQUESTED',
        customerUid: 'sarah',
        originEntityRef: { kind: 'booking', id: 'B-1' },
        amountCents: 15000,
      },
      actorUid: 'sarah',
    });
    expect(r.waitingOn).toBe('PETWASH');
    expect(r.primaryAction?.actionType).toBe('VIEW_REFUND_STATUS');
    expect(r.attentionPriority).toBe('MEDIUM');
    expect(r.obligations.some((o) => o.reasonCode === 'REFUND_IN_REVIEW')).toBe(true);
  });

  it('REVIEWING → still waitingOn=PETWASH (same routing as REQUESTED)', () => {
    const r = resolveRefundJourney({
      snapshot: {
        refundId: 'R-1',
        status: 'REVIEWING',
        customerUid: 'sarah',
        originEntityRef: { kind: 'shop_order', id: 'S-1' },
        amountCents: 4500,
      },
      actorUid: 'sarah',
    });
    expect(r.waitingOn).toBe('PETWASH');
    expect(r.primaryAction?.actionType).toBe('VIEW_REFUND_STATUS');
  });

  it('APPROVED → waitingOn=PAYMENT_PROVIDER (not PetWash any more)', () => {
    const r = resolveRefundJourney({
      snapshot: {
        refundId: 'R-1',
        status: 'APPROVED',
        customerUid: 'sarah',
        originEntityRef: { kind: 'booking', id: 'B-1' },
        amountCents: 15000,
      },
      actorUid: 'sarah',
    });
    expect(r.waitingOn).toBe('PAYMENT_PROVIDER');
    expect(r.obligations.some((o) => o.reasonCode === 'REFUND_ISSUED')).toBe(true);
  });

  it('ISSUED → waitingOn=PAYMENT_PROVIDER, primary VIEW_REFUND_STATUS', () => {
    const r = resolveRefundJourney({
      snapshot: {
        refundId: 'R-1',
        status: 'ISSUED',
        customerUid: 'sarah',
        originEntityRef: { kind: 'gift', id: 'G-1' },
        amountCents: 20000,
      },
      actorUid: 'sarah',
    });
    expect(r.waitingOn).toBe('PAYMENT_PROVIDER');
    expect(r.primaryAction?.actionType).toBe('VIEW_REFUND_STATUS');
  });

  it('SETTLED → waitingOn=NONE, INFO priority', () => {
    const r = resolveRefundJourney({
      snapshot: {
        refundId: 'R-1',
        status: 'SETTLED',
        customerUid: 'sarah',
        originEntityRef: { kind: 'booking', id: 'B-1' },
        amountCents: 15000,
      },
      actorUid: 'sarah',
    });
    expect(r.waitingOn).toBe('NONE');
    expect(r.attentionPriority).toBe('INFO');
    expect(r.obligations.some((o) => o.reasonCode === 'REFUNDED')).toBe(true);
  });

  it('DECLINED → primary CONTACT_SUPPORT (never "retry the refund")', () => {
    const r = resolveRefundJourney({
      snapshot: {
        refundId: 'R-1',
        status: 'DECLINED',
        customerUid: 'sarah',
        originEntityRef: { kind: 'booking', id: 'B-1' },
        amountCents: 15000,
      },
      actorUid: 'sarah',
    });
    expect(r.primaryAction?.actionType).toBe('CONTACT_SUPPORT');
    expect(r.waitingOn).toBe('CUSTOMER');
  });

  it('DISPUTED → HIGH priority, waitingOn=PETWASH', () => {
    const r = resolveRefundJourney({
      snapshot: {
        refundId: 'R-1',
        status: 'DISPUTED',
        customerUid: 'sarah',
        originEntityRef: { kind: 'booking', id: 'B-1' },
        amountCents: 15000,
      },
      actorUid: 'sarah',
    });
    expect(r.attentionPriority).toBe('HIGH');
    expect(r.waitingOn).toBe('PETWASH');
    expect(r.primaryAction?.actionType).toBe('CONTACT_SUPPORT');
  });

  it('expectedSettleAt surfaces as soft-cutoff deadline', () => {
    const r = resolveRefundJourney({
      snapshot: {
        refundId: 'R-1',
        status: 'ISSUED',
        customerUid: 'sarah',
        originEntityRef: { kind: 'booking', id: 'B-1' },
        amountCents: 15000,
        expectedSettleAt: '2026-09-15T00:00:00Z',
      },
      actorUid: 'sarah',
    });
    expect(r.deadlines).toContainEqual({
      reasonCode: 'REFUND_EXPECTED',
      dueAt: '2026-09-15T00:00:00Z',
      hardCutoff: false,
    });
  });

  it('money carries REFUND_AMOUNT label and status code', () => {
    const r = resolveRefundJourney({
      snapshot: {
        refundId: 'R-1',
        status: 'ISSUED',
        customerUid: 'sarah',
        originEntityRef: { kind: 'booking', id: 'B-1' },
        amountCents: 15000,
      },
      actorUid: 'sarah',
    });
    expect(r.money?.labelCode).toBe('REFUND_AMOUNT');
    expect(r.money?.amountCents).toBe(15000);
    expect(r.money?.currency).toBe('ILS');
    expect(r.money?.paymentStatusCode).toBe('ISSUED');
  });
});
