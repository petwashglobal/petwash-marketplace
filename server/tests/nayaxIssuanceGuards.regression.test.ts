/**
 * Issuance guards — everything that must STOP a document being created.
 *
 * Fixtures only. No SUMIT call is made by this suite and no fiscal document is
 * issued, credited or modified.
 *
 * Two of these were found missing while writing the suite:
 *   • a non-ILS sale was carried into buildReceiptInput, which hardcodes
 *     currency 'ILS' — an AUD 10.00 wash would have been invoiced as ₪10.00,
 *     silently re-denominated. This is the exact error the one real AUD
 *     transaction (3467932838) was deliberately held out of.
 *   • a sale from an unregistered machine fell back to a generic label and was
 *     issued anyway, with no station or bay on the document.
 */
import { describe, it, expect } from 'vitest';
import {
  selectDocumentableSales, issuanceBlockers, isIssuable, idempotencyKeyFor,
  buildReceiptInput, applyFiscalCutover, type DocumentableSale,
} from '../services/nayaxSumitBridge';

const row = (o: Record<string, unknown> = {}) => ({
  TransactionID: 9001, MachineID: 182443, CurrencyCode: 'ILS',
  AuthorizationValue: 48, SettlementValue: 48, PaymentMethod: 'Credit Card(NFC)',
  SettlementDateTimeGMT: '2026-09-06T09:00:00', ...o,
});
const sale = (o: Partial<DocumentableSale> = {}): DocumentableSale => ({
  transactionId: '9001', machineId: '182443', totalInclVat: 48,
  amountBeforeVat: 40.68, vatAmount: 7.32, currency: 'ILS',
  settledAt: '2026-09-06T09:00:00', ...o,
});

describe('issuance guards — what must never produce a document', () => {
  it('withholds a sale in a currency other than ILS', () => {
    const s = sale({ currency: 'AUD', totalInclVat: 10 });
    expect(issuanceBlockers(s)).toContain('NON_ILS');
    expect(isIssuable(s)).toBe(false);
  });

  // The live consequence of not having this guard.
  it('never re-denominates: an AUD sale is not invoiced as shekels', () => {
    const s = sale({ currency: 'AUD', totalInclVat: 10, transactionId: '3467932838' });
    expect(isIssuable(s)).toBe(false);
    // buildReceiptInput emits ILS unconditionally, which is exactly why the
    // guard must run BEFORE it — proving the hazard the guard exists to stop.
    expect(buildReceiptInput(s).currency).toBe('ILS');
    expect(s.currency).toBe('AUD');
  });

  it('withholds a sale from a machine that is not in the registry', () => {
    const s = sale({ machineId: '999999' });
    expect(issuanceBlockers(s)).toContain('UNKNOWN_MACHINE');
    expect(isIssuable(s)).toBe(false);
  });

  it('withholds a sale with no machine id at all', () => {
    expect(isIssuable(sale({ machineId: undefined }))).toBe(false);
  });

  it('withholds a sale with no readable settlement timestamp', () => {
    expect(issuanceBlockers(sale({ settledAt: undefined }))).toContain('NO_SETTLEMENT_TIME');
    expect(issuanceBlockers(sale({ settledAt: 'not-a-date' }))).toContain('NO_SETTLEMENT_TIME');
  });

  it('withholds a non-positive amount', () => {
    expect(isIssuable(sale({ totalInclVat: 0 }))).toBe(false);
    expect(isIssuable(sale({ totalInclVat: -48 }))).toBe(false);
  });

  it('issues for a clean settled ILS sale from a registered bay', () => {
    expect(issuanceBlockers(sale())).toEqual([]);
    expect(isIssuable(sale())).toBe(true);
  });

  it('reports every blocker, not just the first', () => {
    const b = issuanceBlockers(sale({ currency: 'USD', machineId: '999999', settledAt: undefined }));
    expect(b).toEqual(expect.arrayContaining(['NON_ILS', 'UNKNOWN_MACHINE', 'NO_SETTLEMENT_TIME']));
  });
});

describe('prepaid / Monyx redemption — already ours, never re-documented', () => {
  it('is dropped by the selector before it can become a candidate', () => {
    expect(selectDocumentableSales([row({ PaymentMethod: 'Prepaid Credit(PHO)' })])).toHaveLength(0);
    expect(selectDocumentableSales([row({ RecognitionMethod: 'card balance' })])).toHaveLength(0);
    expect(selectDocumentableSales([row()])).toHaveLength(1);
  });
});

describe('idempotency — replay must never produce a second document', () => {
  it('derives the key from the Nayax transaction id alone', () => {
    expect(idempotencyKeyFor('2207959160')).toBe('nayax-bay:2207959160');
    expect(idempotencyKeyFor(2207959160)).toBe(idempotencyKeyFor('2207959160'));
  });

  it('gives a replayed transaction the identical key', () => {
    const first = buildReceiptInput(sale());
    const replay = buildReceiptInput(sale());
    expect(replay.idempotencyKey).toBe(first.idempotencyKey);
  });

  // A retry after a network timeout is the same transaction, so it carries the
  // same key: SUMIT dedups on ExternalReference and no second document appears.
  it('keeps the key stable across a timeout retry', () => {
    const keys = [1, 2, 3].map(() => buildReceiptInput(sale()).idempotencyKey);
    expect(new Set(keys).size).toBe(1);
  });

  // If Nayax restates an amount, the key must NOT change — a changed key would
  // read as a new sale and issue a SECOND document for one wash.
  it('does not mint a new key when transaction details change', () => {
    const a = buildReceiptInput(sale({ totalInclVat: 48, amountBeforeVat: 40.68, vatAmount: 7.32 }));
    const b = buildReceiptInput(sale({ totalInclVat: 20, amountBeforeVat: 16.95, vatAmount: 3.05 }));
    expect(b.idempotencyKey).toBe(a.idempotencyKey);
  });

  it('gives two different transactions different keys', () => {
    expect(buildReceiptInput(sale({ transactionId: '1' })).idempotencyKey)
      .not.toBe(buildReceiptInput(sale({ transactionId: '2' })).idempotencyKey);
  });
});

describe('guards compose with the cutover', () => {
  it('withholds an ineligible sale even when it is after the cutover', () => {
    const cutover = new Date('2026-09-01T00:00:00+03:00');
    const bad = sale({ currency: 'AUD', settledAt: '2026-09-06T09:00:00' });
    const { eligible } = applyFiscalCutover([bad], cutover);
    expect(eligible.filter(isIssuable)).toHaveLength(0);
  });
});
