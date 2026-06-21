import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
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

  it('issues the canonical חשבונית מס/קבלה (createCustomerReceipt = InvoiceAndReceipt), not a bare Invoice', () => {
    // A paid eGift is the same economic event as a paid booking, so it must use
    // the same document type. This pins the fix away from createDocument('Invoice').
    const src = fs.readFileSync(
      path.resolve(__dirname, '..', 'services', 'SumitReceiptService.ts'),
      'utf8',
    );
    expect(src).toMatch(/createCustomerReceipt\(/);
    expect(src).not.toMatch(/createDocument\(/);
  });
});
