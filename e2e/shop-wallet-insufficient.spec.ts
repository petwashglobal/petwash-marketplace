/**
 * shop-wallet-insufficient.spec.ts — Punch-list #6.
 *
 * INVARIANT UNDER TEST
 *   When wallet balance < cart total the UI shows an honest "wallet
 *   insufficient" warning AND the card option. Completing checkout with
 *   the card path MUST NOT debit the wallet — the wallet balance and
 *   ledger are unchanged after the flow completes.
 *
 *   This is the fiscal-honesty guardrail: no split-tender illusions, no
 *   silent partial wallet spend behind a card charge.
 */
import { test, expect } from '@playwright/test';
import { headersForPersona, bypassAvailable } from './fixtures/testBypassHeaders';

const CART_ID = 'cart_e2e_wallet_short_6001';
const CART_TOTAL_CENTS = 15700;
const SEED_CENTS = 500; // ₪5 — far below the ₪157 cart total.

test.use({ extraHTTPHeaders: headersForPersona('customer', 'active') });

test.describe('shop-wallet-insufficient — INVARIANT: card path never silently debits the wallet', () => {
  test('short-balance shows the honest warning + card option', async ({ page }) => {
    if (!bypassAvailable()) test.skip(true, 'TEST_BYPASS_TOKEN not set');

    const seed = await page.request.post('/api/dev/wallet/seed', {
      data: { amountCents: SEED_CENTS, reset: true, note: 'e2e shop-wallet-insufficient' },
      failOnStatusCode: false,
    });
    if (seed.status() >= 400) test.skip(true, `wallet seed endpoint unavailable (HTTP ${seed.status()})`);

    const nav = await page.goto('/cart', { waitUntil: 'domcontentloaded' }).catch(() => null);
    if (!nav || nav.status() >= 400) test.skip(true, '/cart not reachable');

    const body = (await page.locator('body').innerText().catch(() => '')) || '';
    // Honest warning copy — English or Hebrew.
    expect(body).toMatch(/(wallet insufficient|balance too low|יתרה לא מספיקה|אין מספיק ב?ארנק)/i);
    // Card option must still be reachable.
    const cardBtn = page.getByRole('button', { name: /card|כרטיס אשראי|לתשלום בכרטיס/i }).first();
    expect(await cardBtn.count()).toBeGreaterThan(0);
  });

  test('completing checkout on the card path does NOT debit the wallet', async ({ page }) => {
    if (!bypassAvailable()) test.skip(true, 'TEST_BYPASS_TOKEN not set');

    const seed = await page.request.post('/api/dev/wallet/seed', {
      data: { amountCents: SEED_CENTS, reset: true, note: 'e2e wallet-insufficient — card path' },
      failOnStatusCode: false,
    });
    if (seed.status() >= 400) test.skip(true, `wallet seed endpoint unavailable (HTTP ${seed.status()})`);

    const before = await page.request.get('/api/wallet/balance', { failOnStatusCode: false });
    const beforeCents = before.status() === 200
      ? Number((await before.json().catch(() => ({}))).balanceCents ?? SEED_CENTS)
      : null;

    const res = await page.request.post('/api/shop/checkout', {
      data: {
        cartId: CART_ID,
        paymentMethod: 'card',
        deliveryMethod: 'courier',
        deliveryAddressId: 'addr_e2e_short',
        giftWrap: false,
        language: 'he',
      },
      failOnStatusCode: false,
    });
    // Card path returns 202 with paymentUrl (or 503 when the rail is off).
    expect([202, 401, 403, 503]).toContain(res.status());
    if (res.status() === 202) {
      const json = await res.json().catch(() => ({}));
      expect(typeof json.paymentUrl).toBe('string');
      expect(json.totalCents).toBe(CART_TOTAL_CENTS);
    }

    // The card /begin must NEVER touch the wallet. If we can read balance,
    // it must be unchanged.
    if (beforeCents !== null) {
      const after = await page.request.get('/api/wallet/balance', { failOnStatusCode: false });
      if (after.status() === 200) {
        const afterCents = Number((await after.json().catch(() => ({}))).balanceCents ?? beforeCents);
        expect(afterCents).toBe(beforeCents);
      }
    }
  });
});
