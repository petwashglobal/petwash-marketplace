/**
 * Nayax bay-sales reconciliation summary — unit tests (2026-07-11).
 * Pure transform over lastSales rows: settled/unsettled, discrepancies, prepaid
 * (member QR-redeem, PetWash-owned) vs public card (Nayax-owned), per-method totals.
 */
import { describe, it, expect } from 'vitest';
import { summarizeBaySales } from '../services/lynxReconciliation';

const rows = [
  // settled prepaid (member redeem) — ours to receipt
  { TransactionID: 1, MachineName: 'KS Right', SiteName: 'Kfar Saba', CurrencyCode: 'ILS',
    AuthorizationValue: 55, SettlementValue: 55, PaymentMethod: 'Prepaid Credit',
    RecognitionMethod: 'Prepaid Credit', ProductName: 'Wash', AuthorizationDateTimeGMT: '2026-07-10T09:00:00', SettlementDateTimeGMT: '2026-07-10T10:00:00' },
  // settled public card — Nayax's, not ours
  { TransactionID: 2, MachineName: 'KS Right', CurrencyCode: 'ILS',
    AuthorizationValue: 55, SettlementValue: 55, PaymentMethod: 'Credit Card',
    RecognitionMethod: 'EMV', AuthorizationDateTimeGMT: '2026-07-10T11:00:00', SettlementDateTimeGMT: '2026-07-10T12:00:00' },
  // unsettled (authorized, no settlement yet) — needs attention
  { TransactionID: 3, CurrencyCode: 'ILS', AuthorizationValue: 55, SettlementValue: null,
    PaymentMethod: 'Credit Card', AuthorizationDateTimeGMT: '2026-07-10T13:00:00', SettlementDateTimeGMT: null },
  // settled with drift (auth 55, settled 50) — discrepancy, needs attention
  { TransactionID: 4, CurrencyCode: 'ILS', AuthorizationValue: 55, SettlementValue: 50,
    PaymentMethod: 'Credit Card', AuthorizationDateTimeGMT: '2026-07-10T14:00:00', SettlementDateTimeGMT: '2026-07-10T15:00:00' },
];

describe('summarizeBaySales (2026-07-11)', () => {
  const s = summarizeBaySales('182443', rows);

  it('counts totals, settled, unsettled', () => {
    expect(s.totalCount).toBe(4);
    expect(s.settledCount).toBe(3);   // tx 1,2,4
    expect(s.unsettledCount).toBe(1); // tx 3
  });

  it('separates prepaid (ours) from public card (Nayax)', () => {
    expect(s.prepaidCount).toBe(1);      // tx 1
    expect(s.publicCardCount).toBe(3);   // tx 2,3,4
  });

  it('flags settlement discrepancies and needs-attention', () => {
    expect(s.discrepancyCount).toBe(1);      // tx 4 (55→50)
    expect(s.needsAttentionCount).toBe(2);   // tx 3 (unsettled) + tx 4 (drift)
  });

  it('sums authorized and settled correctly', () => {
    expect(s.sumAuthorized).toBe(220);       // 55*4
    expect(s.sumSettled).toBe(160);          // 55+55+0+50
  });

  it('breaks down by payment method', () => {
    expect(s.byPaymentMethod['Prepaid Credit']).toEqual({ count: 1, sumSettled: 55 });
    expect(s.byPaymentMethod['Credit Card'].count).toBe(3);
  });

  it('carries machine/site/currency + machineId', () => {
    expect(s.machineId).toBe('182443');
    expect(s.machineName).toBe('KS Right');
    expect(s.siteName).toBe('Kfar Saba');
    expect(s.currency).toBe('ILS');
  });

  it('is defensive: non-array input yields an empty summary, never throws', () => {
    const empty = summarizeBaySales('x', null);
    expect(empty.totalCount).toBe(0);
    expect(empty.sumSettled).toBe(0);
    expect(empty.rows).toEqual([]);
  });
});
