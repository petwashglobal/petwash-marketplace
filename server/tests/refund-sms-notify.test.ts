/**
 * Refund confirmation SMS + receipt-email delivery — pin.
 *
 * Fiscal audit 2026-07-05 (#4, customer-facing notifications):
 *  - the fiscal RECEIPT is emailed to the customer on issuance (already wired) —
 *    this is the legal document delivery; pinned so it can't regress.
 *  - refund_approved SMS was an orphaned template; now sent on a real refund.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const WALLET = fs.readFileSync(path.resolve(__dirname, '..', 'services', 'WalletService.ts'), 'utf8');
const RECEIPT = fs.readFileSync(path.resolve(__dirname, '..', 'services', 'IsraeliDigitalReceiptService.ts'), 'utf8');

describe('customer fiscal notifications — audit 2026-07-05 #4', () => {
  it('the fiscal receipt is emailed to the customer on issuance', () => {
    expect(RECEIPT).toMatch(/emailSent = await this\.sendReceiptEmail\(receipt\)/);
  });

  it('a refund sends the refund_approved SMS (best-effort, non-blocking)', () => {
    expect(WALLET).toMatch(/sendSmsTemplate\('refund_approved'/);
    // guarded so it never affects the refund
    expect(WALLET).toMatch(/refund confirmation SMS[\s\S]*catch \{ \/\* best effort/);
  });
});
