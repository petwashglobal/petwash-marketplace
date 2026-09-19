import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * 2026-09-19: a pet-sitting customer paid and received NOTHING.
 *
 * On /complete, Sitter Suite recorded the provider settlement, ran the payout
 * and wrote the VAT ledger — all of which are OUR books — but never called
 * generateReceipt, so no document ever reached the customer. Walk My Pet and
 * Academy both issue one on completion; this path never did.
 *
 * IsraeliDigitalReceiptService's own comment on sendReceiptEmail:
 *   "Israeli law requires digital receipt to be sent to customer"
 *
 * Rule: every route that settles a paid provider booking must also issue the
 * customer's receipt. Recording our own accounting is not the same as giving
 * the customer their document.
 */
const ROOT = path.resolve(__dirname, '..', '..');
const R = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');

/** routes that take a customer's money for a provider booking */
const PAID_BOOKING_ROUTES = [
  'server/routes/sitter-suite.ts',
  'server/routes/walk-my-pet.ts',
  'server/routes/academy.ts',
];

describe('every paid provider booking issues the customer a receipt', () => {
  it.each(PAID_BOOKING_ROUTES)('%s calls generateReceipt', (rel) => {
    const src = R(rel);
    expect(
      /IsraeliDigitalReceiptService\.generateReceipt\(/.test(src),
      `${rel} settles money but never issues the customer's receipt`,
    ).toBe(true);
  });

  it('sitter-suite issues it for the CUSTOMER, not just the provider settlement', () => {
    const src = R('server/routes/sitter-suite.ts');
    // recordProviderSettlement is our own books; customerEmail on a receipt
    // payload is the customer's document.
    expect(src).toContain('recordProviderSettlement');
    const receiptBlock = src.slice(src.indexOf('sitterReceiptInput'));
    expect(receiptBlock).toContain('customerEmail');
    expect(receiptBlock).toContain("providerType: 'sitter'");
  });

  it('the receipt never fails the completion — outbox + catch, like Walk My Pet', () => {
    const src = R('server/routes/sitter-suite.ts');
    const block = src.slice(src.indexOf('CUSTOMER RECEIPT (2026-09-19)'));
    expect(block).toContain('runFiscalDocumentAndPersistOnFailure');
    expect(block).toContain("kind: 'digital_receipt'");
    expect(block).toContain('catch');
  });
});
