/**
 * Behavioral test — P0-4 VAT per-class (X-ray 2026-07-25).
 *
 * generateReceipt used to book flat 18% on the FULL amount for every payment
 * class, ignoring the CPA's vatMode (getSumitDocumentMapping). resolveReceiptVat
 * now honours it. VAT rate = 18% (0.18). These assert the actual numbers.
 */
import { describe, it, expect } from 'vitest';
import { IsraeliDigitalReceiptService as R } from '../services/IsraeliDigitalReceiptService';

const base = {
  platform: 'test', bookingId: 'B1', customerEmail: 'a@b.co',
  serviceDescription: 'x', serviceDescriptionHe: 'x',
  subtotalAmount: 0, platformFeeAmount: 0, totalAmount: 100,
  paymentMethod: 'card',
} as any;

describe('resolveReceiptVat honours the CPA per-class vatMode', () => {
  it('FULL_VAT (SHOP_ITEM): 18% extracted from the full ₪100', () => {
    const r = R.resolveReceiptVat({ ...base, paymentClass: 'SHOP_ITEM' });
    expect(r.vatAmount).toBeCloseTo(15.25, 2); // 100 - 100/1.18
    expect(r.subtotalBeforeVAT).toBeCloseTo(84.75, 2);
    expect(r.vatRatePct).toBe(18);
  });

  it('NO_VAT_STORED_VALUE (wallet top-up): ZERO VAT on a ₪100 top-up', () => {
    const r = R.resolveReceiptVat({ ...base, paymentClass: 'WALLET_TOPUP' });
    expect(r.vatAmount).toBe(0);
    expect(r.subtotalBeforeVAT).toBe(100);
    expect(r.vatRatePct).toBe(0);
  });

  it('NO_VAT_STORED_VALUE (eGift purchase): ZERO VAT', () => {
    const r = R.resolveReceiptVat({ ...base, paymentClass: 'EGIFT_PURCHASE' });
    expect(r.vatAmount).toBe(0);
  });

  it('VAT_ON_COMMISSION_ONLY: VAT only on the ₪15 commission, not the ₪100 gross', () => {
    const r = R.resolveReceiptVat({
      ...base, paymentClass: 'PROVIDER_BOOKING_COMMISSION',
      totalAmount: 100, brokerCommissionAmount: 15,
    });
    // VAT is 18% extracted from the 15 commission = 15 - 15/1.18 = 2.29
    expect(r.vatAmount).toBeCloseTo(2.29, 2);
    // Crucially NOT 15.25 (the old full-gross bug)
    expect(r.vatAmount).toBeLessThan(3);
    expect(r.totalAmount).toBe(100);
  });

  it('no paymentClass → full VAT (unchanged legacy default)', () => {
    const r = R.resolveReceiptVat({ ...base });
    expect(r.vatAmount).toBeCloseTo(15.25, 2);
  });
});
