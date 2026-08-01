/**
 * SUMIT card purchases must FULFIL on the verified return (2026-08-01, P0).
 *
 * Before this fix, a logged-in wash-package / wallet-top-up purchase charged the
 * customer's card via the SUMIT hosted page, then /return only redirected to
 * /payment-success — fulfilment lived ONLY in the SUMIT webhook, which (a) is never
 * registered by beginRedirect and (b) is gated behind ff.commerce.unified_purchase_
 * lifecycle (OFF in prod, absent from the deploy env). Net: card charged, nothing
 * delivered, purchase stuck 'payment_pending' forever. Guest eGift avoided this by
 * fulfilling inline on its /return; this test locks the same pattern for the
 * card-checkout /return.
 *
 * activateFromVerifiedPayment is idempotent (provider-ref lock + purchase-level
 * conditional flip + addCredits dedupe), so fulfilling on /return AND a possible
 * future webhook cannot double-credit.
 *
 * Also locks the escrow-release notification honesty fix: releasing escrow approves
 * a payout, it does NOT itself move money to the provider's bank, so the message
 * must not claim "transferred to your account".
 *
 * Source-pinned (no DB) so a regression fails the money gate.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const sumitPay = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes', 'payments-sumit.ts'),
  'utf8',
);
const escrow = fs.readFileSync(
  path.resolve(__dirname, '..', 'services', 'EscrowService.ts'),
  'utf8',
);

describe('SUMIT /return fulfilment (P0: charged-but-not-delivered)', () => {
  it('/return fulfils the purchase via activateFromVerifiedPayment after verifying', () => {
    expect(sumitPay).toMatch(/import \{ activateFromVerifiedPayment \} from '\.\.\/services\/PurchaseActivationService'/);
    // The call must happen inside the /return handler, after the getTransaction verify.
    const returnIdx = sumitPay.indexOf("router.get('/return'");
    expect(returnIdx).toBeGreaterThan(-1);
    const after = sumitPay.slice(returnIdx);
    expect(after).toMatch(/await activateFromVerifiedPayment\(\{/);
    expect(after).toMatch(/transactionId: txnId/);
    expect(after).toMatch(/externalRef: ext/);
  });

  it('/return does NOT silently redirect to success without attempting fulfilment', () => {
    // The old comment ("handled by the order's own flow keyed on ext") that masked
    // the gap must be gone.
    expect(sumitPay).not.toMatch(/handled by the order's own flow keyed on ext/);
  });
});

describe('escrow-release notification honesty', () => {
  it('does not claim money was "transferred to your account" on a mere status release', () => {
    expect(escrow).not.toMatch(/released from escrow and transferred to your account/);
    // It should word the release as approved/queued for payout instead.
    expect(escrow).toMatch(/queued for payout|approved and is queued/i);
  });
});
