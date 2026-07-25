/**
 * Regression pin — P0-3 (X-ray 2026-07-25).
 *
 * The escrow booking engine (booking-requests.ts) recorded only a P&L VAT row at
 * completion and never issued the customer a receipt. It now calls generateReceipt
 * with the disclosed-agent payment class at the owner-confirm/escrow-release event.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const src = readFileSync(join(__dirname, '..', 'routes', 'booking-requests.ts'), 'utf8');

describe('escrow booking engine issues a customer receipt (P0-3)', () => {
  it('calls generateReceipt', () => {
    expect(src).toMatch(/IsraeliDigitalReceiptService\.generateReceipt\(/);
  });
  it('uses the disclosed-agent payment class (commission-only VAT)', () => {
    const at = src.indexOf('generateReceipt(');
    const window = src.slice(at, at + 400);
    expect(window).toMatch(/PROVIDER_BOOKING_COMMISSION/);
  });
  it('issues at the completion/escrow-release path (near the VAT ledger record)', () => {
    const vatAt = src.indexOf('recordTransactionFromGross');
    const receiptAt = src.indexOf('generateReceipt(');
    expect(vatAt).toBeGreaterThan(-1);
    expect(receiptAt).toBeGreaterThan(vatAt); // receipt is wired after the VAT record
  });
});
