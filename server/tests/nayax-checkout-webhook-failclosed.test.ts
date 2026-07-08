/**
 * Nayax checkout/booking webhooks fail-CLOSED — regression pins (2026-07-08).
 *
 * Webhook authenticity sweep, HIGH: the two Nayax checkout webhooks that CREDIT
 * wallets ( /nayax/checkout-payment → walletService.addCredits ) and flip a
 * booking to the paid 'confirmed' state ( /nayax/booking-request-payment ) used
 * a FAIL-OPEN signature form:
 *     if (signatureEnforced && !signature) return 401;   // only when secret set
 *     if (signature && !verify(...))       return 401;   // only if a sig present
 * When NAYAX_WEBHOOK_SECRET is unset in the runtime, isSignatureEnforced() is
 * false → BOTH branches skip → an UNSIGNED body is accepted → free wallet
 * credits. The sibling /nayax/payment was already fail-closed (503 when the
 * secret is unset). This makes the two credit webhooks match it.
 *
 * (Currently latent: the secret IS set + loaded in prod, so signatures verify
 * today. This removes the trap where unsetting/rotating the secret silently
 * reopens a wallet-credit endpoint.)
 *
 * Source-level pins (same style as credit-wallet-confirm-idor.test.ts).
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(path.resolve(__dirname, '..', 'routes', 'nayax-webhooks.ts'), 'utf8');

describe('Nayax credit webhooks are fail-closed (2026-07-08)', () => {
  it('the fail-OPEN form (signatureEnforced && !signature) is gone from the credit webhooks', () => {
    // both blocks previously read `if (signatureEnforced && !signature)`
    expect(SRC).not.toMatch(/if \(signatureEnforced && !signature\)/);
  });

  it('CheckoutWebhook rejects (503) when the secret is not configured', () => {
    const block = SRC.split("[CheckoutWebhook] NAYAX_WEBHOOK_SECRET not configured")[1] ?? '';
    // the 503 fail-closed line exists for the checkout webhook
    expect(SRC).toMatch(/\[CheckoutWebhook\] NAYAX_WEBHOOK_SECRET not configured — rejecting \(fail-closed\)/);
    expect(SRC).toMatch(/if \(!NayaxOnlinePaymentService\.isSignatureEnforced\(\)\)/);
  });

  it('BookingReqWebhook rejects (503) when the secret is not configured', () => {
    expect(SRC).toMatch(/\[BookingReqWebhook\] NAYAX_WEBHOOK_SECRET not configured — rejecting \(fail-closed\)/);
  });

  it('both credit webhooks now require a signature unconditionally (no `signature &&` guard)', () => {
    // the verify call is now unconditional inside the credit webhooks
    const verifyCalls = SRC.match(/if \(!NayaxOnlinePaymentService\.verifyWebhookSignature\(rawBody, signature\)\)/g) ?? [];
    // /nayax/payment (1) + checkout (1) + booking-request (1) = at least 3
    expect(verifyCalls.length).toBeGreaterThanOrEqual(3);
  });
});
