/**
 * Nayax manual-import mapper — unit tests.
 *
 * Locks the money-integrity contract of the Tower Control report import:
 *   • RECORD-ONLY: loyaltyAwarded is always false, points always 0
 *   • rows without a transaction id / amount / time are SKIPPED, never guessed
 *   • Nayax Core header variants map via aliases (case/space-insensitive)
 *   • machine ids resolve to the Kfar Saba station/bay registry
 *   • non-ILS rows are recorded but flagged (the LEFT machine USD mis-set)
 */
import { describe, it, expect } from 'vitest';
import { mapImportRow, classifyChannel, parseReportTime } from '../services/nayaxEventImport';

const BASE = {
  'Transaction ID': 'TX-1001',
  'Machine ID': '182443',
  'Payment Method': 'Credit Card',
  'Settlement Value': '55.00',
  'Currency': 'ILS',
  'Machine Time': '2026-07-13T10:15:00',
};

describe('mapImportRow — happy path', () => {
  it('maps a Nayax Core settlement row to an event insert', () => {
    const r = mapImportRow(BASE, 'admin@petwash.co.il');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.event.externalTransactionId).toBe('TX-1001');
    expect(r.event.machineId).toBe('182443');
    expect(r.event.stationId).toBe('KFAR_SABA_PARK_WALD');
    expect(r.event.terminalId).toBe('369617593'); // deviceId fallback from registry
    expect(r.event.paymentChannel).toBe('tap_card');
    expect(r.event.approvalStatus).toBe('approved'); // settlement report row = a sale
    expect(r.event.amountGross).toBe('55.00');
    expect(r.event.currency).toBe('ILS');
    expect(r.warnings).toEqual([]);
  });

  it('NEVER awards loyalty from a manual import', () => {
    const r = mapImportRow(BASE, 'admin');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.event.loyaltyAwarded).toBe(false);
    expect(r.event.loyaltyPointsAwarded).toBe(0);
    expect(r.event.processingStatus).toBe('imported_manual');
  });

  it('stores provenance in rawPayload', () => {
    const r = mapImportRow(BASE, 'nir.h@petwash.co.il');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const payload = r.event.rawPayload as Record<string, unknown>;
    expect(payload.source).toBe('manual_import');
    expect(payload.importedBy).toBe('nir.h@petwash.co.il');
  });
});

describe('mapImportRow — header aliases', () => {
  it('accepts lowercase/underscore/alternate headers', () => {
    const r = mapImportRow({
      transaction_id: 'TX-2',
      machine: '182462',
      'payment type': 'Monyx Wallet',
      amount: '₪48.00',
      datetime: '13/07/2026 14:30',
    }, 'admin');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.event.machineId).toBe('182462');
    expect(r.event.stationId).toBe('KFAR_SABA_PARK_WALD');
    expect(r.event.paymentChannel).toBe('monyx_qr');
    expect(r.event.amountGross).toBe('48.00'); // ₪ symbol stripped
    expect(r.event.transactionTime.getFullYear()).toBe(2026);
    expect(r.event.transactionTime.getMonth()).toBe(6); // July (IL DD/MM/YYYY)
    expect(r.event.transactionTime.getDate()).toBe(13);
  });
});

describe('mapImportRow — skips (never guesses)', () => {
  it('skips a row without a transaction id', () => {
    const { 'Transaction ID': _omit, ...rest } = BASE;
    const r = mapImportRow(rest, 'admin');
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toContain('transaction id');
  });

  it('skips a row with an unparseable amount', () => {
    const r = mapImportRow({ ...BASE, 'Settlement Value': 'N/A' }, 'admin');
    expect(r.ok).toBe(false);
  });

  it('skips a row with an unparseable time', () => {
    const r = mapImportRow({ ...BASE, 'Machine Time': 'yesterday-ish' }, 'admin');
    expect(r.ok).toBe(false);
  });
});

describe('mapImportRow — warnings (recorded but flagged)', () => {
  it('flags the USD mis-set machine but still records the row', () => {
    const r = mapImportRow({ ...BASE, 'Machine ID': '182462', Currency: 'USD' }, 'admin');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.event.currency).toBe('USD');
    expect(r.warnings.join(' ')).toContain('non-ILS');
  });

  it('flags an unknown machine id', () => {
    const r = mapImportRow({ ...BASE, 'Machine ID': '999999' }, 'admin');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.event.stationId).toBeNull();
    expect(r.warnings.join(' ')).toContain('unknown machine');
  });
});

describe('mapImportRow — status normalization', () => {
  it.each([
    ['Settled', 'approved'],
    ['APPROVED', 'approved'],
    ['Refund', 'refunded'],
    ['Declined', 'declined'],
    ['Voided', 'declined'],
  ])('%s → %s', (raw, expected) => {
    const r = mapImportRow({ ...BASE, Status: raw }, 'admin');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.event.approvalStatus).toBe(expected);
  });
});

describe('classifyChannel', () => {
  it.each([
    ['Monyx App', 'monyx_qr'],
    ['PetWash QR', 'petwash_wallet_qr'],
    ['Apple Pay', 'apple_pay'],
    ['Google Pay', 'google_pay'],
    ['Credit Card', 'tap_card'],
    ['EMV Contactless', 'tap_card'],
    ['Prepaid Card', 'loyalty_prepaid'],
    ['Punch Card Campaign', 'loyalty_prepaid'],
    ['', 'unknown'],
  ])('%s → %s', (input, expected) => {
    expect(classifyChannel(input)).toBe(expected);
  });
});

describe('parseReportTime', () => {
  it('parses ISO', () => {
    expect(parseReportTime('2026-07-13T10:15:00')?.getDate()).toBe(13);
  });
  it('parses IL DD/MM/YYYY HH:mm:ss', () => {
    const d = parseReportTime('05/07/2026 09:05:30');
    expect(d?.getMonth()).toBe(6);
    expect(d?.getDate()).toBe(5);
  });
  it('returns null for garbage', () => {
    expect(parseReportTime('not a date')).toBeNull();
  });
});
