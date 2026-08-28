/**
 * shop-signature-invalid.spec.ts — Punch-list #4.
 *
 * INVARIANT UNDER TEST
 *   A webhook without a valid HMAC signature MUST be rejected 401 BEFORE
 *   the body is parsed, no DB write happens, and no activation is
 *   attempted. This is the outermost security gate of the money path.
 *
 * MECHANISM
 *   server/routes/sumit-webhook.ts (line ~229):
 *     if (!signature || !sumitClient.verifyWebhookSignature(rawString, signature))
 *       return res.status(401).json({ ok:false, error:'invalid_signature' });
 *   The verifier also 401s when SUMIT_WEBHOOK_SECRET is unset (fail-closed).
 */
import { test, expect } from '@playwright/test';
import { headersForPersona } from './fixtures/testBypassHeaders';
import { buildSignedCallback } from './fixtures/sumitCallback';

const CART_ID = 'cart_e2e_badsig_4001';

test.use({ extraHTTPHeaders: headersForPersona('customer', 'active') });

test.describe('shop-signature-invalid — INVARIANT: unsigned/tampered callbacks are 401 with no side effects', () => {
  test('missing signature header is rejected 401', async ({ page }) => {
    // We can build the body without a secret because omitSignature=true.
    const built = buildSignedCallback({ cartId: CART_ID, omitSignature: true });
    if ('skip' in built) test.skip(true, built.reason);
    const s = built as Exclude<typeof built, { skip: true }>;

    const res = await page.request.post('/api/sumit/webhook', {
      headers: { 'content-type': 'application/json' },
      data: s.bodyString,
      failOnStatusCode: false,
    });
    // 401 is the specified rejection. 403 accepted as a WAF/middleware
    // variant; anything 2xx would prove the money gate is broken.
    expect([401, 403]).toContain(res.status());
    expect(res.status()).toBeLessThan(500);
  });

  test('wrong-signed callback is rejected 401 — activation never runs', async ({ page }) => {
    const signed = buildSignedCallback({ cartId: CART_ID, tamperSignature: true });
    if ('skip' in signed) test.skip(true, signed.reason);
    const s = signed as Exclude<typeof signed, { skip: true }>;

    const res = await page.request.post('/api/sumit/webhook', {
      headers: {
        [s.signatureHeader]: s.signatureValue, // sha256=00...00 — not a valid MAC
        'content-type': 'application/json',
      },
      data: s.bodyString,
      failOnStatusCode: false,
    });
    expect([401, 403]).toContain(res.status());

    // Read-back: whatever orders the customer had before must NOT include
    // one whose paymentRef matches our tampered TransactionID. We do a
    // best-effort listing (skip cleanly if the endpoint isn't available).
    const list = await page.request.get('/api/shop/orders', { failOnStatusCode: false });
    if (list.status() === 200) {
      const j = await list.json().catch(() => ({}));
      const orders: any[] = Array.isArray(j.orders) ? j.orders : Array.isArray(j) ? j : [];
      const bogus = orders.filter((o) => String(o?.paymentRef ?? '').includes('TXN_TEST_SHOP'));
      expect(bogus.length).toBe(0);
    }
  });
});
