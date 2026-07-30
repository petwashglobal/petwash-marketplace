/**
 * T1 money-truth batch (marketplace 360 audit, 2026-07-30). Pins the six
 * repairs so they cannot silently regress:
 *   1. Quote engine charges the 15% platform fee INSIDE the displayed total.
 *   2. booking-requests takes the fee from the engine (no `= 0` shortcut).
 *   3. Receipt VAT: zero commission falls back to the canonical 15% (|| not ??).
 *   4. payoutLedger derives VAT from ISRAEL_VAT_RATE (no 18/118 literal).
 *   5. 24h auto-approve issues a fiscal receipt at escrow release.
 *   6. Simulated (SIM_) sitter payments never issue a fiscal document.
 *   7. Cancel never stamps refundProcessedAt for money that didn't move, and
 *      the escrow notice doesn't claim a refund already happened.
 * Pins match CALL SITES, not comment phrases.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const R = (p: string) => readFileSync(resolve(__dirname, '..', '..', p), 'utf8');

describe('T1 — money truth invariants', () => {
  it('quote engine adds the platform fee into the quoted total (§17a: fee shown upfront)', () => {
    const src = R('server/services/quoteEngine.ts');
    expect(src).toMatch(/const serviceFeeCents = Math\.round\(remaining \* PETWASH_COMMISSION_RATE\)/);
    expect(src).toMatch(/remaining = remaining \+ serviceFeeCents/);
    expect(src).toMatch(/serviceFeeCents,\s*\n\s*giftCardAppliedCents/);
  });

  it('booking-requests reads the fee from the engine — the `serviceFeeCents = 0` shortcut is dead', () => {
    const src = R('server/routes/booking-requests.ts');
    expect(src).toMatch(/serviceFeeCents = freshQuote\.totals\.serviceFeeCents \?\? 0/);
    expect(src).not.toMatch(/serviceFeeCents = 0; \/\/ already included/);
  });

  it('receipt VAT commission fallback uses || so a 0 commission cannot zero the tax document', () => {
    const src = R('server/services/IsraeliDigitalReceiptService.ts');
    expect(src).toMatch(/params\.brokerCommissionAmount \|\| params\.platformFeeAmount \|\| total \* PLATFORM_COMMISSION_RATE/);
  });

  it('payout ledger VAT comes from the single-source rate', () => {
    const src = R('server/services/payoutLedger.ts');
    expect(src).toMatch(/ISRAEL_VAT_RATE \/ \(1 \+ ISRAEL_VAT_RATE\)/);
    expect(src).not.toMatch(/18 \/ 118/);
  });

  it('24h auto-approve issues the customer receipt at the escrow-release event', () => {
    const src = R('server/cron/auto-approve-completions.ts');
    expect(src).toMatch(/IsraeliDigitalReceiptService\.generateReceipt\(\{/);
    expect(src).toMatch(/paymentClass: 'PROVIDER_BOOKING_COMMISSION'/);
  });

  it('simulated sitter payments (SIM_) are excluded from fiscal receipts', () => {
    const src = R('server/routes/sitter-suite.ts');
    expect(src).toMatch(/nayaxTransactionId\?\.startsWith\('SIM_'\)/);
  });

  it('cancel does not forge refundProcessedAt; only the executing wallet refund stamps it', () => {
    const src = R('server/routes/booking-requests.ts');
    expect(src).not.toMatch(/refundProcessedAt: refundCents > 0/);
    expect(src).toMatch(/walletRefundKey: refundResult\.txnId, financeState: 'refunded', refundProcessedAt: new Date\(\)/);
  });

  it('escrow refund notice does not claim money already moved', () => {
    const src = R('server/services/EscrowService.ts');
    expect(src).not.toMatch(/has been refunded to your account/);
    expect(src).toMatch(/is being processed/);
  });
});
