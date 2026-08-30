/**
 * ProviderCancellationService — Program 14.
 */
import { describe, it, expect } from 'vitest';
import { previewProviderCancellation } from '../services/marketplace/ProviderCancellationService';

describe('ProviderCancellationService', () => {
  it('COMPLETED / CANCELLED / DECLINED / EXPIRED → NOT_CANCELLABLE', () => {
    for (const status of ['COMPLETED', 'CANCELLED', 'DECLINED', 'EXPIRED'] as const) {
      const out = previewProviderCancellation({ status, paymentCapturedCents: 0, currency: 'ILS' });
      expect(out.code).toBe('NOT_CANCELLABLE');
    }
  });

  it('CONFIRMED with money captured → full refund to customer (never partial — provider fault)', () => {
    const out = previewProviderCancellation({
      status: 'CONFIRMED',
      paymentCapturedCents: 15000,
      currency: 'ILS',
    });
    expect(out.code).toBe('PREVIEW');
    if (out.code !== 'PREVIEW') throw new Error();
    expect(out.outcome.customerRefundCents).toBe(15000);
    expect(out.outcome.notifyCustomer).toBe(true);
    expect(out.outcome.releaseCalendarSlot).toBe(true);
    expect(out.outcome.reasonCode).toBe('PROVIDER_INITIATED_CANCELLATION');
  });

  it('REQUESTED with no capture → refund 0, still valid preview', () => {
    const out = previewProviderCancellation({
      status: 'REQUESTED',
      paymentCapturedCents: 0,
      currency: 'ILS',
    });
    expect(out.code).toBe('PREVIEW');
    if (out.code !== 'PREVIEW') throw new Error();
    expect(out.outcome.customerRefundCents).toBe(0);
  });

  it('IN_PROGRESS cancellation does NOT trigger a replacement search (customer needs support)', () => {
    const out = previewProviderCancellation({
      status: 'IN_PROGRESS',
      paymentCapturedCents: 15000,
      currency: 'ILS',
    });
    if (out.code !== 'PREVIEW') throw new Error();
    expect(out.outcome.triggerReplacementSearch).toBe(false);
  });

  it('provider with 3+ cancellations in 30 days → HIGH integrity impact', () => {
    const out = previewProviderCancellation({
      status: 'CONFIRMED',
      paymentCapturedCents: 15000,
      currency: 'ILS',
      providerCancelCountInLast30Days: 4,
    });
    if (out.code !== 'PREVIEW') throw new Error();
    expect(out.outcome.providerIntegrityImpact).toBe('HIGH');
  });

  it('zero prior cancels → LOW integrity impact', () => {
    const out = previewProviderCancellation({
      status: 'CONFIRMED',
      paymentCapturedCents: 15000,
      currency: 'ILS',
      providerCancelCountInLast30Days: 0,
    });
    if (out.code !== 'PREVIEW') throw new Error();
    expect(out.outcome.providerIntegrityImpact).toBe('LOW');
  });
});
