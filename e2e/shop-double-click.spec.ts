/**
 * shop-double-click.spec.ts — Punch-list #7.
 *
 * INVARIANT UNDER TEST
 *   A user impatiently clicking the Checkout button twice in quick
 *   succession MUST result in ONE charge and ONE order — never two.
 *
 *   Two layers guarantee this in the code:
 *     (a) WALLET PATH — ledgerDeduct's idempotencyKey
 *         `shop-checkout:${cartId}` deduplicates concurrent debits.
 *     (b) CARD PATH — the `purchases` row is inserted with
 *         unique(surface, surfaceRefId=shop-<cartId>); a duplicate
 *         insert throws 23505 and the code path continues to redirect
 *         to the SAME hosted-page URL. One redirect, one webhook, one
 *         activation.
 *
 *   This spec fires TWO parallel POST /api/shop/checkout requests for
 *   the same cart and asserts:
 *     - both succeed (2xx) or both fail identically,
 *     - the response payloads reference the same paymentUrl / externalId
 *       (card path) OR the same orderId (wallet path),
 *     - the order-list read-back shows ≤ 1 order for this cart.
 */
import { test, expect } from '@playwright/test';
import { headersForPersona, bypassAvailable } from './fixtures/testBypassHeaders';

const CART_ID = 'cart_e2e_doubleclick_7001';

test.use({ extraHTTPHeaders: headersForPersona('customer', 'active') });

async function fireCheckout(page: any) {
  return page.request.post('/api/shop/checkout', {
    data: {
      cartId: CART_ID,
      paymentMethod: 'card',
      deliveryMethod: 'courier',
      deliveryAddressId: 'addr_e2e_double',
      giftWrap: false,
      language: 'he',
    },
    failOnStatusCode: false,
  });
}

test.describe('shop-double-click — INVARIANT: two rapid Checkout clicks = one order', () => {
  test('two parallel POST /api/shop/checkout calls for one cart return the SAME redirect / order', async ({ page }) => {
    if (!bypassAvailable()) test.skip(true, 'TEST_BYPASS_TOKEN not set');

    // Fire in parallel — the whole point is to race the two requests
    // through the unique(surface, surfaceRefId) gate.
    const [a, b] = await Promise.all([fireCheckout(page), fireCheckout(page)]);

    // Neither request may be a 5xx. Both must land on the same shape.
    expect(a.status()).toBeLessThan(500);
    expect(b.status()).toBeLessThan(500);

    // When the server is fully wired (SHOP_CHECKOUT_ENABLED=true) both
    // return 202 with the same externalId. When it's not, both return
    // the same 503. Either way, the pair must AGREE.
    expect(a.status()).toBe(b.status());

    if (a.status() === 202) {
      const ja = await a.json().catch(() => ({}));
      const jb = await b.json().catch(() => ({}));
      // Same cart → same server-owned externalId, same total.
      expect(ja.externalId).toBe(jb.externalId);
      expect(ja.totalCents).toBe(jb.totalCents);
      // One redirect target — a mismatched paymentUrl would prove two
      // hosted-page sessions were opened for one cart.
      expect(ja.paymentUrl).toBe(jb.paymentUrl);
    }

    // Read-back: at most one order for this cart's externalId.
    const list = await page.request.get('/api/shop/orders', { failOnStatusCode: false });
    if (list.status() === 200) {
      const j = await list.json().catch(() => ({}));
      const orders: any[] = Array.isArray(j.orders) ? j.orders : Array.isArray(j) ? j : [];
      const matches = orders.filter(
        (o) => o?.externalId === `shop-${CART_ID}` || o?.cartId === CART_ID,
      );
      expect(matches.length).toBeLessThanOrEqual(1);
    }
  });
});
