import { describe, it, expect } from 'vitest';
import { SumitReceiptService } from '../services/SumitReceiptService';

// SUMIT is not enabled in the test env (no SUMIT_ENABLED/creds), so the service
// must no-op safely — proving it can never break the payment flow it's called from.
describe('SumitReceiptService.issueCustomerReceipt — fail-safe', () => {
  it('no-ops with ok:false (never throws) when SUMIT is not wired', async () => {
    const res = await SumitReceiptService.issueCustomerReceipt({
      idempotencyKey: 'test-nayax-1',
      sourceRef: 'voucher-1',
      customerName: 'Test Customer',
      customerEmail: 'test@example.com',
      totalAmountIls: 100,
      description: 'PetWash e-Gift card',
    });
    expect(res.ok).toBe(false);
    expect(typeof res.reason).toBe('string');
  });

  it('handles missing/edge input without throwing', async () => {
    const res = await SumitReceiptService.issueCustomerReceipt({
      idempotencyKey: 'test-nayax-2',
      sourceRef: 'voucher-2',
      customerName: '',
      totalAmountIls: 0,
      description: '',
    });
    expect(res.ok).toBe(false);
  });
});
