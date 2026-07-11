/**
 * Nayax → SUMIT fiscal bridge — unit tests for the PURE fiscal logic (2026-07-11).
 *
 * Every public-card bay sale must get a SUMIT חשבונית מס/קבלה (PetWash is the operator);
 * prepaid member-redeems must NOT be re-documented; VAT is backed out of the VAT-
 * inclusive bay price; the idempotency key must be deterministic per Nayax transaction.
 */
import { describe, it, expect } from 'vitest';
import {
  selectDocumentableSales,
  buildReceiptInput,
  idempotencyKeyFor,
} from '../services/nayaxSumitBridge';
import { getSumitDocumentMapping } from '../services/sumitDocumentMapping';

const rows = [
  // settled PUBLIC CARD ₪55 — MUST be documented
  { TransactionID: 101, MachineName: 'KS Right', SiteName: 'Kfar Saba', CurrencyCode: 'ILS',
    AuthorizationValue: 55, SettlementValue: 55, PaymentMethod: 'Credit Card', RecognitionMethod: 'EMV',
    CardNumber: '2736390748', CardBrand: 'Visa',
    AuthorizationDateTimeGMT: '2026-07-10T09:00:00', SettlementDateTimeGMT: '2026-07-10T10:00:00',
    PaymentServiceTransactionID: 'RRN-777' },
  // settled PREPAID (member QR-redeem) — must be SKIPPED (already ours-documented)
  { TransactionID: 102, CurrencyCode: 'ILS', AuthorizationValue: 55, SettlementValue: 55,
    PaymentMethod: 'Prepaid Credit', RecognitionMethod: 'Prepaid Credit',
    AuthorizationDateTimeGMT: '2026-07-10T11:00:00', SettlementDateTimeGMT: '2026-07-10T12:00:00' },
  // UNSETTLED public card — skip (no settled money yet)
  { TransactionID: 103, CurrencyCode: 'ILS', AuthorizationValue: 55, SettlementValue: null,
    PaymentMethod: 'Credit Card', AuthorizationDateTimeGMT: '2026-07-10T13:00:00', SettlementDateTimeGMT: null },
  // zero / refund-ish — skip
  { TransactionID: 104, CurrencyCode: 'ILS', AuthorizationValue: 0, SettlementValue: 0,
    PaymentMethod: 'Credit Card', SettlementDateTimeGMT: '2026-07-10T14:00:00' },
];

describe('nayaxSumitBridge.selectDocumentableSales (2026-07-11)', () => {
  const sales = selectDocumentableSales(rows);

  it('selects ONLY the settled public-card sale (skips prepaid/unsettled/zero)', () => {
    expect(sales.map((s) => s.transactionId)).toEqual(['101']);
  });

  it('backs VAT out of the VAT-inclusive bay price (₪55 → 46.61 + 8.39 @ 18%)', () => {
    const s = sales[0];
    expect(s.totalInclVat).toBe(55);
    expect(s.amountBeforeVat).toBe(46.61);
    expect(s.vatAmount).toBe(8.39);
    // the two parts must reconstruct the price the customer paid
    expect(Math.round((s.amountBeforeVat + s.vatAmount) * 100) / 100).toBe(55);
  });

  it('carries card last-4, brand, machine + Nayax reference for the audit trail', () => {
    const s = sales[0];
    expect(s.cardLast4).toBe('0748');
    expect(s.cardBrand).toBe('Visa');
    expect(s.machineName).toBe('KS Right');
    expect(s.reference).toBe('RRN-777');
  });

  it('is defensive: non-array input yields no sales, never throws', () => {
    expect(selectDocumentableSales(null)).toEqual([]);
    expect(selectDocumentableSales(undefined)).toEqual([]);
  });
});

describe('nayaxSumitBridge idempotency + SUMIT input (2026-07-11)', () => {
  it('idempotency key is deterministic per Nayax transaction (never double-issues)', () => {
    expect(idempotencyKeyFor(101)).toBe('nayax-bay:101');
    expect(idempotencyKeyFor('101')).toBe('nayax-bay:101');
  });

  it('builds an InvoiceAndReceipt (full VAT, principal) per the CPA mapping', () => {
    const input = buildReceiptInput(selectDocumentableSales(rows)[0]);
    expect(input.documentType).toBe('InvoiceAndReceipt');
    expect(input.idempotencyKey).toBe('nayax-bay:101');
    expect(input.totalAmount).toBe(55);
    expect(input.amountBeforeVat).toBe(46.61);
    expect(input.currency).toBe('ILS');
    expect(input.card).toEqual({ last4: '0748', brand: 'Visa' });
    expect(input.context.source).toBe('nayax-sumit-bridge');
    expect(input.context.nayaxTransactionId).toBe('101');
    // must match the CPA per-class mapping for a public-card wash
    expect(getSumitDocumentMapping('K9000_PUBLIC_CARD')).toEqual(
      getSumitDocumentMapping('K9000_WASH'),
    );
  });
});
