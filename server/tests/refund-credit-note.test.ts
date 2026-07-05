/**
 * Refund credit-note (זיכוי) — regression pin.
 *
 * Fiscal audit 2026-07-05: refunds issued NO credit document. The credit-note
 * engine existed (issueCreditNote) but had zero callers, and SumitClient had no
 * credit method, so credit notes never reached the ITA. This wires it:
 *  - SumitClient.createCreditDocument (Type CreditInvoiceAndReceipt + original ref)
 *  - issueCreditNote routes to SUMIT above the SHAAM threshold
 *  - issueCreditNoteForBooking convenience lookup
 *  - refundBookingWallet issues the credit note on a real refund (all 4 callers)
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SUMIT = fs.readFileSync(path.resolve(__dirname, '..', 'services', 'SumitClient.ts'), 'utf8');
const RECEIPT = fs.readFileSync(path.resolve(__dirname, '..', 'services', 'IsraeliDigitalReceiptService.ts'), 'utf8');
const WALLET = fs.readFileSync(path.resolve(__dirname, '..', 'services', 'WalletService.ts'), 'utf8');

describe('refund credit-note (זיכוי) — audit 2026-07-05', () => {
  it('SumitClient has a credit-document method (CreditInvoiceAndReceipt)', () => {
    expect(SUMIT).toMatch(/async createCreditDocument\(/);
    expect(SUMIT).toMatch(/Type:\s*'CreditInvoiceAndReceipt'/);
    expect(SUMIT).toMatch(/OriginalDocumentID/);
  });

  it('issueCreditNote routes to SUMIT above the SHAAM threshold', () => {
    expect(RECEIPT).toMatch(/if \(shaamRequired && sumitClient\.isWired\(\)\)[\s\S]*createCreditDocument\(/);
  });

  it('issueCreditNoteForBooking looks up the original non-voided receipt', () => {
    expect(RECEIPT).toMatch(/static async issueCreditNoteForBooking\(/);
    expect(RECEIPT).toMatch(/receiptType, 'customer_payment'/);
    expect(RECEIPT).toMatch(/no_original_receipt/);
  });

  it('refundBookingWallet issues a credit note on a real (non-idempotent) refund, non-blocking', () => {
    expect(WALLET).toMatch(/if \(!result\.idempotent\)[\s\S]*issueCreditNoteForBooking\(/);
    expect(WALLET).toMatch(/credit note failed \(non-blocking\)/);
  });
});
