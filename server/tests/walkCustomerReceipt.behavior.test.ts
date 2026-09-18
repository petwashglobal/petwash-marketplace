/**
 * A paid walk gets the customer a digital receipt at COMPLETION — the fiscal
 * event (מועד החיוב is the supply), not at acceptance and not at payment.
 * Walks became payable by card on 2026-09-18 (#2590); until this, money could
 * be taken and the customer received no document at all.
 *
 * Only a walk carrying a VERIFIED payment gets one: the return handler stamps
 * paymentSessionId with SUMIT's numeric transaction id, an abandoned attempt
 * leaves the `bkg_…` session reference, and a walk confirmed before the rail
 * has neither — none of those may be given a receipt.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
const src = read('server/routes/walk-my-pet.ts');
const block = src.slice(src.indexOf("// ── The customer's digital receipt"), src.indexOf('// Create blockchain audit record'));

const paid = (ref: string) => /^[0-9]+$/.test(ref);

describe('who gets a receipt', () => {
  it('a verified transaction id does; a session reference or nothing does not', () => {
    expect(paid('88123456')).toBe(true);
    expect(paid('bkg_WALK-2026-000123_m0a1b2')).toBe(false);
    expect(paid('')).toBe(false);
  });

  it('the source uses exactly that test, and says so when it skips', () => {
    expect(block).toContain('const walkWasPaid = /^[0-9]+$/.test(walkPaymentTxnId);');
    expect(block).toContain('if (walkWasPaid && walkPaidIls > 0) {');
    expect(block).toContain('no customer receipt — this walk carries no verified payment');
  });
});

describe('the receipt itself', () => {
  it('is the money the walk was actually sold for', () => {
    expect(block).toContain('subtotalAmount: walkPaidIls');
    expect(block).toContain('platformFeeAmount: walkFeeIls');
    expect(block).toContain('providerPayoutAmount: walkPayoutIls');
    expect(block).toContain('brokerCommissionAmount: walkFeeIls');
    expect(block).toContain("paymentMethod: 'Credit card'");
  });

  it('is durable: inline, else the outbox, and never fails the completion', () => {
    expect(block).toContain('runFiscalDocumentAndPersistOnFailure({');
    expect(block).toContain("kind: 'digital_receipt'");
    expect(block).toContain('sourceKey: `walk:${bookingId}`');
    expect(block).toContain('needs manual issue');
  });

  it('is issued at completion, after the settlement and the P&L entry', () => {
    const completion = src.indexOf('recordProviderSettlement({');
    const ledger = src.indexOf('recordTransactionFromGross(');
    const receipt = src.indexOf("// ── The customer's digital receipt");
    expect(completion).toBeLessThan(receipt);
    expect(ledger).toBeLessThan(receipt);
  });
});
