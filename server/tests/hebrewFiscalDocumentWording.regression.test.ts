import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { paymentMethodHe } from '@shared/fiscalHebrew';

/**
 * CEO, 2026-09-19: "hebrew wrong fix now legal hebrew not google vtranslate",
 * "invoices and cards not legal enough".
 *
 * The templates were written in correct formal Hebrew. The DATA was not: every
 * call site passed its own free-text payment method in English, and the Hebrew
 * tax document printed it verbatim. What a customer actually received:
 *
 *   אמצעי תשלום: Credit card            academy, walk-my-pet
 *   אמצעי תשלום: PetWash Wallet         prestige-pass, academy wallet
 *   אמצעי תשלום: Credit Card (SUMIT)    guest e-gift
 *   אמצעי תשלום: credit_card            payments-sumit, shop   ← raw DB enum
 *
 * A tax document that mixes languages — or prints a column name with an
 * underscore — is not something a bookkeeper or the ITA should ever receive.
 */
const ROOT = path.resolve(__dirname, '..', '..');
const R = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');

describe('Hebrew fiscal documents say the payment method in Hebrew', () => {
  it.each([
    ['Credit card',          'כרטיס אשראי'],
    ['credit_card',          'כרטיס אשראי'],
    ['Credit Card (SUMIT)',  'כרטיס אשראי'],
    ['card',                 'כרטיס אשראי'],
    ['PetWash Wallet',       'ארנק PetWash'],
    ['wallet',               'ארנק PetWash'],
    ['bank_transfer',        'העברה בנקאית'],
    ['cash',                 'מזומן'],
    ['bit',                  'ביט'],
  ])('%s -> %s', (raw, he) => {
    expect(paymentMethodHe(raw)).toBe(he);
  });

  it('a brand name stays English inside the Hebrew wording', () => {
    // brand rule: product names are never transliterated
    expect(paymentMethodHe('wallet')).toContain('PetWash');
    expect(paymentMethodHe('nayax')).toBe('Nayax');
    expect(paymentMethodHe('Apple Pay')).toBe('Apple Pay');
  });

  it('an empty method says so in Hebrew rather than leaving a blank line', () => {
    expect(paymentMethodHe('')).toBe('לא צוין');
    expect(paymentMethodHe(null)).toBe('לא צוין');
    expect(paymentMethodHe(undefined)).toBe('לא צוין');
  });

  it('an UNKNOWN method is passed through, never guessed at', () => {
    // inventing a Hebrew name for a method we do not recognise would put a
    // wrong statement on a tax document — worse than an untranslated one.
    expect(paymentMethodHe('Klarna Pay Later')).toBe('Klarna Pay Later');
  });

  it('the receipt and the tax invoice both go through it', () => {
    expect(R('server/services/IsraeliDigitalReceiptService.ts'))
      .toContain('paymentMethodHe(receipt.paymentMethod)');
    expect(R('server/email/templates/tax-invoice-luxury-2026.ts'))
      .toContain('paymentMethodHe(p.paymentMethod)');
  });

  it('no Hebrew fiscal document prints a raw snake_case enum', () => {
    const receipt = R('server/services/IsraeliDigitalReceiptService.ts');
    const hebrewDoc = receipt.slice(receipt.indexOf('אישור תשלום'));
    expect(hebrewDoc).not.toMatch(/אמצעי תשלום: \$\{receipt\.paymentMethod\}/);
  });
});
