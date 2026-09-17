/**
 * A CREDIT NOTE REVERSES THE SAME SHARE OF THE SAME DOCUMENT (2026-09-17).
 *
 * Under the one money model, Pet Wash's SUMIT document for a marketplace
 * booking covers ONLY Pet Wash's fee. The credit note credited the WHOLE
 * refund with 18/118 VAT of the whole refund:
 *   full refund of a ₪1,150 walk → SUMIT credit ₪1,150 (VAT ₪175.42)
 *   against a Pet Wash invoice of ₪150 (VAT ₪22.88).
 * That under-reports Pet Wash's VAT by ₪152.54 on one refund. And a refunded
 * eGift (stored value, no VAT) credited VAT that was never charged.
 */
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

vi.mock('../db', () => ({ db: {}, pool: {} }));
vi.mock('../lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock('../lib/sendgrid', () => ({ createMailService: vi.fn(), isSendGridConfigured: () => false }));
vi.mock('../services/googleSheetsIntegration', () => ({ appendFormSubmission: vi.fn() }));
vi.mock('../services/TaxSequenceService', () => ({ allocateTaxSequenceNumber: vi.fn() }));
vi.mock('../lib/invoiceSequence', () => ({ generateCommissionInvoiceNumber: vi.fn() }));

import { creditNoteAmounts } from '../services/IsraeliDigitalReceiptService';

// A marketplace walk as generateReceipt stores it: total 1,150, fee 150,
// provider 1,000, VAT only on the fee (150 × 18/118 = 22.88).
const walk = { totalAmount: '1150.00', vatAmount: '22.88', providerPayoutAmount: '1000.00', brokerCommissionAmount: '150.00', platformFeeAmount: '150.00' };
// A shop sale: Pet Wash's own, VAT on the whole ₪100 (15.25).
const shop = { totalAmount: '100.00', vatAmount: '15.25', providerPayoutAmount: null, brokerCommissionAmount: null, platformFeeAmount: '0' };
// A ₪250 eGift: stored value, no VAT.
const egift = { totalAmount: '250.00', vatAmount: '0.00', providerPayoutAmount: null, brokerCommissionAmount: null, platformFeeAmount: '0' };

describe('marketplace booking — only Pet Wash’s fee is credited at SUMIT', () => {
  it('full refund: customer gets ₪1,150 back; SUMIT credit ₪150 with ₪22.88 VAT', () => {
    const a = creditNoteAmounts(walk, 1150);
    expect(a).toMatchObject({ refund: 1150, ratio: 1, feeOnly: true, sumitTotal: 150, sumitVat: 22.88, localVat: 22.88 });
  });

  it('half refund: half of each', () => {
    const a = creditNoteAmounts(walk, 575);
    expect(a).toMatchObject({ ratio: 0.5, sumitTotal: 75, sumitVat: 11.44, localVat: 11.44, localSubtotal: 563.56 });
  });

  it('never credits more than the document it reverses', () => {
    const a = creditNoteAmounts(walk, 5000);
    expect(a.ratio).toBe(1);
    expect(a.sumitTotal).toBe(150);
  });
});

describe('Pet Wash’s own sale — the whole refund, its own VAT share', () => {
  it('shop ₪100 full refund → ₪100 with ₪15.25 VAT', () => {
    expect(creditNoteAmounts(shop, 100)).toMatchObject({ feeOnly: false, sumitTotal: 100, sumitVat: 15.25, localSubtotal: 84.75 });
  });
  it('shop ₪40 partial refund → ₪40 with ₪6.10 VAT', () => {
    expect(creditNoteAmounts(shop, 40)).toMatchObject({ sumitTotal: 40, sumitVat: 6.1 });
  });
});

describe('stored value — no VAT was charged, none is credited', () => {
  it('eGift ₪250 refund → VAT ₪0 (was 18/118 = ₪38.14)', () => {
    expect(creditNoteAmounts(egift, 250)).toMatchObject({ localVat: 0, sumitVat: 0, sumitTotal: 250 });
  });
});

describe('wiring', () => {
  const svc = readFileSync(join(__dirname, '../services/IsraeliDigitalReceiptService.ts'), 'utf8');
  it('issueCreditNote uses the mirror, not a flat breakdown of the refund', () => {
    const i = svc.indexOf('static async issueCreditNote(params');
    const body = svc.slice(i, i + 3500);
    expect(body).toContain('const amounts = creditNoteAmounts(original, refundAmount);');
    expect(body).not.toContain('this.calculateVATBreakdown(refundAmount)');
    expect(body).toContain('brokerCommissionAmount: amounts.feeOnly ? (-amounts.sumitTotal).toFixed(2) : null');
  });
  it('the SUMIT credit is the fee share for a marketplace credit', () => {
    const d = svc.slice(svc.indexOf('static async dispatchCreditNoteToSumitWired('));
    expect(d).toContain('const sumitTotal = feeOnly ? Math.abs(Number(credit.brokerCommissionAmount))');
    expect(d).toContain('totalAmount: sumitTotal,');
  });
});
