import { describe, it, expect } from 'vitest';
import {
  statutoryCancellationFeeCents,
  customerCancellationRefundCents,
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
