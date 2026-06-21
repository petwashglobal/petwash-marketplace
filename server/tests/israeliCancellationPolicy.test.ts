import { describe, it, expect } from 'vitest';
import {
  statutoryCancellationFeeCents,
  customerCancellationRefundCents,
  statutoryCancellationDeadline,
  isWithinStatutoryCancellation,
  STATUTORY_FEE_CAP_CENTS,
} from '../services/IsraeliCancellationPolicy';

describe('Israeli statutory cancellation fee (min 5% / ₪100)', () => {
  it('charges 5% when 5% is below the ₪100 cap', () => {
    // ₪50 → 5% = ₪2.50 = 250 agorot
    expect(statutoryCancellationFeeCents(5000)).toBe(250);
  });

  it('caps the fee at ₪100 when 5% would exceed it', () => {
    // ₪5,000 → 5% = ₪250, capped to ₪100
    expect(statutoryCancellationFeeCents(500000)).toBe(STATUTORY_FEE_CAP_CENTS);
  });

  it('is zero for a non-positive amount', () => {
    expect(statutoryCancellationFeeCents(0)).toBe(0);
    expect(statutoryCancellationFeeCents(-100)).toBe(0);
  });

  it('a customer cancellation keeps the statutory fee (never a flat 100% refund)', () => {
    const r = customerCancellationRefundCents({ amountCents: 5000, reason: 'customer' });
    expect(r.feeCents).toBe(250);
    expect(r.refundCents).toBe(4750);
    expect(r.basis).toBe('statutory_fee');
    // The leak this fixes: refund must NOT equal the full amount.
    expect(r.refundCents).toBeLessThan(5000);
  });

  it('full refund (no fee) on provider/platform fault or mismatch', () => {
    for (const reason of ['provider_fault', 'platform_fault', 'mismatch'] as const) {
      const r = customerCancellationRefundCents({ amountCents: 5000, reason });
      expect(r.feeCents).toBe(0);
      expect(r.refundCents).toBe(5000);
      expect(r.basis).toBe('full_refund_fault');
    }
  });

  it('defaults to a customer cancellation (keeps the fee) when reason is omitted', () => {
    const r = customerCancellationRefundCents({ amountCents: 20000 });
    expect(r.feeCents).toBe(1000); // 5% of ₪200 = ₪10
    expect(r.refundCents).toBe(19000);
  });
});

describe('Statutory cancellation deadline (distance-sale window)', () => {
  it('no service date → deadline is purchase + 14 days', () => {
    const purchaseDate = new Date('2026-06-01T10:00:00Z');
    const { deadline, basis } = statutoryCancellationDeadline({ purchaseDate });
    expect(basis).toBe('cooling_off_14d');
    expect(deadline.toISOString().slice(0, 10)).toBe('2026-06-15');
  });

  it('service far out → still bounded by the 14-day cooling-off', () => {
    const purchaseDate = new Date('2026-06-01T10:00:00Z');
    const serviceDate = new Date('2026-09-01T10:00:00Z');
    const { basis } = statutoryCancellationDeadline({ purchaseDate, serviceDate });
    expect(basis).toBe('cooling_off_14d');
  });

  it('service soon → deadline is service minus 2 business days, before the service, not Fri/Sat', () => {
    const purchaseDate = new Date('2026-06-03T12:00:00');
    const serviceDate = new Date('2026-06-07T12:00:00'); // Sunday (local)
    const { deadline, basis } = statutoryCancellationDeadline({ purchaseDate, serviceDate });
    expect(basis).toBe('service_notice');
    expect(deadline.getTime()).toBeLessThan(serviceDate.getTime());
    expect(deadline.getDay()).not.toBe(5); // not Friday
    expect(deadline.getDay()).not.toBe(6); // not Saturday
  });

  it('isWithinStatutoryCancellation: true before deadline, false after', () => {
    const purchaseDate = new Date('2026-06-01T10:00:00Z');
    expect(isWithinStatutoryCancellation({ purchaseDate, now: new Date('2026-06-10T10:00:00Z') })).toBe(true);
    expect(isWithinStatutoryCancellation({ purchaseDate, now: new Date('2026-06-20T10:00:00Z') })).toBe(false);
  });
});
