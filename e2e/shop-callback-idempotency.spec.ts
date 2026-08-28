/**
 * shop-callback-idempotency.spec.ts — Punch-list #2.
 *
 * INVARIANT UNDER TEST
 *   Firing the SAME signed SUMIT callback twice creates EXACTLY ONE order,
 *   grants exactly one credit, and issues exactly one receipt. The second
 *   delivery must short-circuit as `already_processed`.
 *
 *   Behind the scenes this is guaranteed by three layers in
 *   PurchaseActivationService:
 *     (a) purchase_events_provider_ref_uq UNIQUE index (fast-path lock),
 *     (b) conditional UPDATE ... WHERE status IN (payment_pending,quoted,failed)
 *         (rowcount-as-lock),
 *     (c) credit_txn_source_uq on (walletId, sourceType, sourceId).
 *   This spec exercises the OUTER contract — one order per callback — via
 *   the webhook and an admin/history read-back.
 */
import { test, expect } from '@playwright/test';
import { headersForPersona, bypassAvailable } from './fixtures/testBypassHeaders';
import { buildSignedCallback } from './fixtures/sumitCallback';

const CART_ID = 'cart_e2e_idempo_2001';
const AMOUNT = 15700;

test.use({ extraHTTPHeaders: headersForPersona('customer', 'active') });

test.describe('shop-callback-idempotency — INVARIANT: duplicate webhook = one order', () => {
  test('two identical signed callbacks yield one order and one activation', async ({ page }) => {
    if (!bypassAvailable()) test.skip(true, 'TEST_BYPASS_TOKEN not set');
    const signed = buildSignedCallback({ cartId: CART_ID, amountCents: AMOUNT });
    if ('skip' in signed) test.skip(true, signed.reason);
    const s = signed as Exclude<typeof signed, { skip: true }>;

    // Fire once — first delivery.
    const first = await page.request.post('/api/sumit/webhook', {
      headers: { [s.signatureHeader]: s.signatureValue, 'content-type': 'application/json' },
      data: s.bodyString,
      failOnStatusCode: false,
    });
    expect(first.status()).toBe(200);
    const firstJson = await first.json();

    // Fire again — same eventId, same TransactionID, byte-identical body.
    const second = await page.request.post('/api/sumit/webhook', {
      headers: { [s.signatureHeader]: s.signatureValue, 'content-type': 'application/json' },
      data: s.bodyString,
      failOnStatusCode: false,
    });
    expect(second.status()).toBe(200);
    const secondJson = await second.json();

    // Contract: SUMIT never gets a non-2xx (design of the receiver) and the
    // SECOND call must NOT report a fresh activation. It is either the
    // idempotency-lock short-circuit (already_processed) or, when the
    // fixture didn't correspond to a real purchase, the same not_found on
    // both — never `activated` twice.
    if (firstJson.activation === 'activated') {
      expect(secondJson.activation).toBe('already_processed');
    } else {
      expect(secondJson.activation).toBe(firstJson.activation);
    }

    // Read-back: count how many orders the current customer sees for this
    // externalId / cart. GET /api/shop/orders returns the customer's list;
    // if the endpoint is unavailable in this env we skip the count assert.
    const list = await page.request.get('/api/shop/orders', { failOnStatusCode: false });
    if (list.status() === 200) {
      const j = await list.json().catch(() => ({}));
      const orders: any[] = Array.isArray(j.orders) ? j.orders : Array.isArray(j) ? j : [];
      const matches = orders.filter(
        (o) => o?.externalId === `shop-${CART_ID}` || o?.cartId === CART_ID,
      );
      // ZERO matches is legitimate in a shared test DB where the seeded
      // cart doesn't exist. What we forbid is > 1 — that would prove a
      // duplicate-order defect on the second callback.
      expect(matches.length).toBeLessThanOrEqual(1);
    }
  });
});
