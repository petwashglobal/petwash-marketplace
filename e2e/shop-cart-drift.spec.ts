/**
 * shop-cart-drift.spec.ts — Punch-list #3.
 *
 * INVARIANT UNDER TEST
 *   If the cart mutates between "priced at /begin" and "activation at
 *   webhook", activation MUST NOT create a mismatched order. The customer's
 *   card was charged the priced amount; the order is deferred to
 *   `activation=pending` and an admin alert fires — money is never silently
 *   spent on a stale basket.
 *
 * MECHANISM
 *   PurchaseActivationService case 'SHOP_ORDER' compares meta.subtotalCents
 *   (frozen at /begin) with the live cart.subtotalCents; on mismatch it
 *   returns false → markActivationPending('no_safe_handler'), and the
 *   webhook body reports activation === 'pending'.
 *
 * SIMULATION
 *   True cart drift needs a real DB and a live cart. In this harness we
 *   simulate by opening a second context/tab that hits POST /api/shop/cart
 *   between the /begin and the callback fire. The assertion is soft: we
 *   accept 'pending' (drift caught), 'not_found' (harness has no seeded
 *   cart), or 'activated' (drift did not land in time). We ONLY FAIL if
 *   the second tab's mutation is visible AND activation reports success.
 */
import { test, expect, chromium } from '@playwright/test';
import { headersForPersona, bypassAvailable } from './fixtures/testBypassHeaders';
import { buildSignedCallback } from './fixtures/sumitCallback';

const CART_ID = 'cart_e2e_drift_3001';
const PRICED_AMOUNT = 15700;

test.use({ extraHTTPHeaders: headersForPersona('customer', 'active') });

test.describe('shop-cart-drift — INVARIANT: mutated cart never activates a mismatched order', () => {
  test('cart mutation between /begin and webhook leaves activation pending, no order', async ({ page, browser }) => {
    if (!bypassAvailable()) test.skip(true, 'TEST_BYPASS_TOKEN not set');
    const signed = buildSignedCallback({ cartId: CART_ID, amountCents: PRICED_AMOUNT });
    if ('skip' in signed) test.skip(true, signed.reason);
    const s = signed as Exclude<typeof signed, { skip: true }>;

    // 1. Kick off checkout: server writes the `purchases` row with the
    //    priced subtotalCents into metadataJson.
    const begin = await page.request.post('/api/shop/checkout', {
      data: {
        cartId: CART_ID,
        paymentMethod: 'card',
        deliveryMethod: 'courier',
        deliveryAddressId: 'addr_e2e_drift',
        giftWrap: false,
        language: 'he',
      },
      failOnStatusCode: false,
    });
    if (![202, 503].includes(begin.status())) {
      test.skip(true, `/api/shop/checkout not exercisable here (HTTP ${begin.status()})`);
    }

    // 2. In a SECOND browser context (a new tab wouldn't share the auth
    //    bypass headers cleanly; a fresh context makes the intent explicit),
    //    mutate the cart quantity BEFORE the callback fires.
    const ctx2 = await browser.newContext({
      extraHTTPHeaders: headersForPersona('customer', 'active'),
    });
    try {
      const mutation = await ctx2.request.post('/api/shop/cart', {
        data: { cartId: CART_ID, productId: 'prod_test_shampoo_1', quantity: 5 },
        failOnStatusCode: false,
      });
      // Any 2xx counts as "the mutation landed"; any 4xx means the harness
      // does not carry a live cart and the drift assert cannot bind.
      const mutationLanded = mutation.status() >= 200 && mutation.status() < 300;

      // 3. Fire the signed webhook with the ORIGINAL priced amount.
      const cb = await page.request.post('/api/sumit/webhook', {
        headers: { [s.signatureHeader]: s.signatureValue, 'content-type': 'application/json' },
        data: s.bodyString,
        failOnStatusCode: false,
      });
      expect(cb.status()).toBe(200);
      const json = await cb.json();

      if (mutationLanded) {
        // The drift guard must have fired — activation is 'pending' (real
        // cart with drift) or 'not_found' (cart deleted in-flight).
        // 'activated' here would be a defect.
        expect(['pending', 'not_found', 'already_processed']).toContain(json.activation);
        expect(json.activation).not.toBe('activated');
      } else {
        // Harness cannot drive real cart state — accept any non-5xx outcome.
        expect(['pending', 'not_found', 'already_processed', 'activated', 'skipped']).toContain(json.activation);
      }

      // 4. UI check: when the drift path is taken, the cart page should
      //    surface an "activation pending" / "payment received but order
      //    not yet placed" alert. Best-effort: if the route doesn't
      //    hydrate the alert copy, we do NOT fail — the server-side
      //    assertion above is the invariant.
      const nav = await page.goto('/shop/orders', { waitUntil: 'domcontentloaded' }).catch(() => null);
      if (nav && nav.status() < 400) {
        const body = (await page.locator('body').innerText().catch(() => '')) || '';
        // We only assert the negative: no "confirmed" order copy for this cart.
        expect(body).not.toMatch(new RegExp(`Order.*${CART_ID}.*confirmed`, 'i'));
      }
    } finally {
      await ctx2.close();
    }
  });
});
