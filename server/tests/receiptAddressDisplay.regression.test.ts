/**
 * CEO 2026-07-29 "360 both ends": the structured address the customer enters
 * must reach the receipt AND every confirmation — through ONE formatter, not 8
 * hand-built strings. This pins:
 *   1. formatUserAddress renders the full structured address (incl. access
 *      details) and stays safe on sparse / empty / fallback input.
 *   2. serviceAddress on the receipt is DISPLAY ONLY — it is rendered, but never
 *      feeds the VAT/amount/sequence/dedup path (money-invariants §2/§3).
 *   3. all paid call sites pass serviceAddress.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { formatUserAddress, bookingSnapshotToAddress } from '../../shared/formatAddress';

const R = (p: string) => readFileSync(resolve(__dirname, '..', '..', p), 'utf8');

describe('formatUserAddress — one canonical renderer', () => {
  const full = {
    street: 'דיזנגוף', streetNumber: '153', apartment: '12', floor: '3',
    entrance: 'א', city: 'תל אביב–יפו', postalCode: '6343804',
    notes: 'קוד שער 1234',
  };

  it('renders street, access details, city and zip in order', () => {
    const s = formatUserAddress(full, { lang: 'he' });
    expect(s).toBe('דיזנגוף 153, כניסה א, קומה 3, דירה 12, תל אביב–יפו, מיקוד 6343804');
  });

  it('includes access notes ONLY when asked (never on a receipt)', () => {
    expect(formatUserAddress(full, { lang: 'he' })).not.toContain('קוד שער');
    expect(formatUserAddress(full, { lang: 'he', includeNotes: true })).toContain('הערות: קוד שער 1234');
  });

  it('is safe on sparse / empty / legacy-freetext input', () => {
    expect(formatUserAddress({ street: 'רוטשילד' }, { lang: 'he' })).toBe('רוטשילד');
    expect(formatUserAddress({}, { lang: 'he' })).toBe('');
    expect(formatUserAddress({ fallback: 'כתובת ישנה' }, { lang: 'he' })).toBe('כתובת ישנה');
  });

  it('maps the frozen booking snapshot columns', () => {
    const parts = bookingSnapshotToAddress({
      customerStreet: 'סוקולוב', customerStreetNumber: '8',
      customerCity: 'הרצליה', customerPostalCode: '4642508',
    });
    expect(formatUserAddress(parts, { lang: 'he' })).toBe('סוקולוב 8, הרצליה, מיקוד 4642508');
  });
});

describe('receipt address is display-only (money-invariants preserved)', () => {
  const receiptSrc = R('server/services/IsraeliDigitalReceiptService.ts');

  it('serviceAddress is an optional param and is rendered from the receipt object', () => {
    expect(receiptSrc).toMatch(/serviceAddress\?:\s*string/);
    // Must render receipt.serviceAddress (attached in generateReceipt), NOT
    // params.serviceAddress — sendReceiptEmail has no `params` in scope, and the
    // out-of-scope ref silently threw and skipped every receipt email.
    expect(receiptSrc).toMatch(/receipt\.serviceAddress \?/);
    expect(receiptSrc).toMatch(/\(receipt as any\)\.serviceAddress = params\.serviceAddress/);
  });

  it('sendReceiptEmail does NOT reference `params` (out-of-scope regression)', () => {
    const body = receiptSrc.slice(receiptSrc.indexOf('static async sendReceiptEmail'));
    const end = body.indexOf('\n  static async ', 1);
    const fn = end > 0 ? body.slice(0, end) : body;
    expect(fn).not.toMatch(/\bparams\./);
  });

  it('VAT still comes from the per-class vatMode resolver, not from the address', () => {
    // The tax path is untouched — resolveReceiptVat / vatBreakdown still drive VAT.
    expect(receiptSrc).toMatch(/resolveReceiptVat|vatBreakdown/);
    // serviceAddress must never appear in a numeric/vat expression.
    expect(receiptSrc).not.toMatch(/serviceAddress[^?]*[*+]/);
    expect(receiptSrc).not.toMatch(/vat[A-Za-z]*\s*[=:].*serviceAddress/i);
  });
});

describe('booking reminder email carries the real address (not just a placeholder)', () => {
  const cron = R('server/routes/cron-booking-reminders.ts');
  it('both customer and provider reminder emails pass locationAddress via the formatter', () => {
    const matches = cron.match(/locationAddress:\s*formatUserAddress\(bookingSnapshotToAddress\(b\)/g) || [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });
});

describe('all paid call sites pass the service address to the receipt', () => {
  for (const f of [
    'server/routes/booking-requests.ts',
    'server/routes/sitter-suite.ts',
    'server/routes/walk-my-pet.ts',
    'server/routes/academy.ts',
    'server/services/ShopService.ts',
  ]) {
    it(`${f} sets serviceAddress`, () => {
      expect(R(f)).toMatch(/serviceAddress:/);
    });
  }
});
