/**
 * CancellationPreview — behavior pins (business §14.6, §54, §56 + action §12).
 */
import { describe, it, expect } from 'vitest';
import {
  buildCancellationPreview,
  isRefundDestinationConsistent,
  type CancellationPreviewData,
} from '../../shared/marketplace/cancellationPreview';

const base = (o: Partial<CancellationPreviewData> = {}): CancellationPreviewData => ({
  bookingId: 'bkg_1',
  bookingRef: 'PW-BKG-ABCD',
  initiator: 'CUSTOMER',
  policyVersion: 'cp-2026-01',
  originalTotalCents: 45000,   // ₪450
  feeCents: 4500,               // ₪45
  refundCents: 40500,           // ₪405
  refundDestination: { cardCents: 30500, eGiftCents: 10000, walletCents: 0 },
  providerImpact: { payoutRolledBack: true, scheduleReleased: true, ratingImpact: 'CANCEL_COUNT_INCREMENT' },
  documentEffect: { needsCreditNote: true },
  currency: 'ILS',
  ...o,
});

describe('buildCancellationPreview — full refund case', () => {
  it('feeCents=0 → summary says "Full refund back to your original payment method"', () => {
    const p = buildCancellationPreview(
      base({ feeCents: 0, refundCents: 45000, refundDestination: { cardCents: 45000, eGiftCents: 0, walletCents: 0 } }),
      'v1',
      '2026-08-30T13:00:00Z',
    );
    expect(p.summary).toMatch(/Full refund/i);
    expect(p.actionType).toBe('CUSTOMER_CANCEL_BOOKING_PAID');
  });
});

describe('buildCancellationPreview — partial refund case', () => {
  it('summary reports the fee in ILS', () => {
    const p = buildCancellationPreview(base(), 'v1', '2026-08-30T13:00:00Z');
    expect(p.summary).toMatch(/Partial refund/);
    expect(p.summary).toMatch(/ILS 45\.00/);
  });

  it('financial breakdown enumerates original, fee, refund', () => {
    const p = buildCancellationPreview(base(), 'v1', '2026-08-30T13:00:00Z');
    expect(p.financial!.breakdown).toEqual([
      { label: 'Original', cents: 45000 },
      { label: 'Cancellation fee', cents: -4500 },
      { label: 'Refund to you', cents: -40500 },
    ]);
    // Customer perspective: netCents is negative (money BACK to customer).
    expect(p.financial!.netCents).toBe(-40500);
  });

  it('warnings surface the provider payout rollback', () => {
    const p = buildCancellationPreview(base(), 'v1', '2026-08-30T13:00:00Z');
    expect(p.warnings.some((w) => /provider.{0,10}payout/i.test(w))).toBe(true);
  });
});

describe('buildCancellationPreview — no-refund case', () => {
  it('fee === original → "No refund is available"', () => {
    const p = buildCancellationPreview(
      base({ feeCents: 45000, refundCents: 0, refundDestination: { cardCents: 0, eGiftCents: 0, walletCents: 0 } }),
      'v1',
      '2026-08-30T13:00:00Z',
    );
    expect(p.summary).toMatch(/No refund/);
    expect(p.warnings).toContain('No refund is available under the applicable cancellation policy.');
  });
});

describe('framework envelope', () => {
  it('carries previewVersion + expiresAt for the stale-handshake', () => {
    const p = buildCancellationPreview(base(), 'v-preview-1', '2026-08-30T13:00:00Z');
    expect(p.previewVersion).toBe('v-preview-1');
    expect(p.expiresAt).toBe('2026-08-30T13:00:00Z');
  });

  it('affectedEntities points to the booking with its human ref', () => {
    const p = buildCancellationPreview(base(), 'v1', 'x');
    expect(p.affectedEntities).toEqual([{ kind: 'BOOKING', id: 'bkg_1', label: 'PW-BKG-ABCD' }]);
  });

  it('actor-specific action slug (§CEO §8): customer paid/unpaid; provider; admin', () => {
    const custPaid = buildCancellationPreview(base({ originalTotalCents: 10000 }), 'v', 'x');
    const custUnpaid = buildCancellationPreview(base({ originalTotalCents: 0, refundCents: 0, feeCents: 0, refundDestination: { cardCents: 0, eGiftCents: 0, walletCents: 0 } }), 'v', 'x');
    const provider = buildCancellationPreview(base({ initiator: 'PROVIDER', originalTotalCents: 5000 }), 'v', 'x');
    const admin = buildCancellationPreview(base({ initiator: 'STAFF', originalTotalCents: 5000 }), 'v', 'x');
    expect(custPaid.actionType).toBe('CUSTOMER_CANCEL_BOOKING_PAID');
    expect(custUnpaid.actionType).toBe('CUSTOMER_CANCEL_BOOKING_UNPAID');
    expect(provider.actionType).toBe('PROVIDER_CANCEL_BOOKING');
    expect(admin.actionType).toBe('ADMIN_CANCEL_BOOKING');
  });
});

describe('isRefundDestinationConsistent — server-side guard (§54)', () => {
  it('sum of destinations equals refundCents → true', () => {
    expect(isRefundDestinationConsistent(base())).toBe(true);
  });

  it('over-refund attempt (destinations sum > refundCents) → false', () => {
    const d = base({
      refundCents: 40500,
      refundDestination: { cardCents: 50000, eGiftCents: 0, walletCents: 0 },
    });
    expect(isRefundDestinationConsistent(d)).toBe(false);
  });

  it('under-refund attempt → false', () => {
    const d = base({
      refundCents: 40500,
      refundDestination: { cardCents: 20000, eGiftCents: 0, walletCents: 0 },
    });
    expect(isRefundDestinationConsistent(d)).toBe(false);
  });
});
