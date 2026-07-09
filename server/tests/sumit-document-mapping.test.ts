/**
 * SUMIT per-class document mapping — the CPA-approved decision table (2026-07-09).
 *
 * Encodes the accountant's mapping as tested code (no invented tax logic) and
 * verifies the SUMIT client can issue the per-class document type. The behaviour
 * activates only when SUMIT is the issuer (isWired()); until go-live it's inert.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { getSumitDocumentMapping, type PetWashPaymentClass } from '../services/sumitDocumentMapping';

describe('getSumitDocumentMapping — CPA table (2026-07-09)', () => {
  it('principal sales (wash, shop) → InvoiceAndReceipt, full VAT', () => {
    for (const c of ['K9000_WASH', 'SHOP_ITEM'] as PetWashPaymentClass[]) {
      const m = getSumitDocumentMapping(c);
      expect(m.documentType).toBe('InvoiceAndReceipt');
      expect(m.vatMode).toBe('FULL_VAT');
      expect(m.issuer).toBe('PETWASH_PRINCIPAL');
    }
  });

  it('stored value (top-up, eGift purchase) → Receipt, NO VAT', () => {
    for (const c of ['WALLET_TOPUP', 'EGIFT_PURCHASE'] as PetWashPaymentClass[]) {
      const m = getSumitDocumentMapping(c);
      expect(m.documentType).toBe('Receipt');
      expect(m.vatMode).toBe('NO_VAT_STORED_VALUE');
    }
  });

  it('eGift redemption → InvoiceAndReceipt, VAT at redemption', () => {
    const m = getSumitDocumentMapping('EGIFT_REDEMPTION');
    expect(m.documentType).toBe('InvoiceAndReceipt');
    expect(m.vatMode).toBe('VAT_AT_REDEMPTION');
  });

  it('disclosed-agent booking → Invoice, VAT on commission only', () => {
    const m = getSumitDocumentMapping('PROVIDER_BOOKING_COMMISSION');
    expect(m.documentType).toBe('Invoice');
    expect(m.vatMode).toBe('VAT_ON_COMMISSION_ONLY');
    expect(m.issuer).toBe('PETWASH_DISCLOSED_AGENT');
  });

  it('refund / credit → CreditInvoice, requires original document id', () => {
    for (const c of ['REFUND', 'CREDIT_ADJUSTMENT'] as PetWashPaymentClass[]) {
      const m = getSumitDocumentMapping(c);
      expect(m.documentType).toBe('CreditInvoice');
      expect(m.requiresOriginalDocumentId).toBe(true);
    }
  });

  it('throws loudly on an unmapped class (never silently mis-issues)', () => {
    expect(() => getSumitDocumentMapping('NOPE' as PetWashPaymentClass)).toThrow(/no CPA SUMIT mapping/);
  });
});

describe('SumitClient issues the per-class document type', () => {
  it('createCustomerReceipt uses input.documentType (default InvoiceAndReceipt)', () => {
    const SRC = fs.readFileSync(path.resolve(__dirname, '..', 'services', 'SumitClient.ts'), 'utf8');
    expect(SRC).toMatch(/Type: input\.documentType \|\| 'InvoiceAndReceipt'/);
    expect(SRC).toMatch(/documentType\?: 'InvoiceAndReceipt' \| 'Receipt' \| 'Invoice'/);
  });
});
