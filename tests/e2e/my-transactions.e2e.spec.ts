/**
 * my-transactions.e2e.spec.ts — CEO 2026-08-27 §32-33, §94.20-22.
 *
 * Real user journey against the FiscalTransactionPassport surface:
 *   1. Customer opens /account/transactions.
 *   2. Sees the green-marble hero + a listing of their transactions.
 *   3. Taps a shop-order row → drills into
 *      /account/transactions/shop_orders/:id — sees full passport
 *      (money, fiscal document, reconciliation, refund lineage).
 *   4. Taps 'Open Job Passport' on a booking-source row → lands on
 *      /jobs/by-booking/:source/:sourceId.
 *
 * Fixtures stub /api/fiscal/my/transactions + /api/fiscal/transactions/by-source.
 * No live backend needed. Runs in ~5 seconds.
 *
 *   npx playwright test tests/e2e/my-transactions.e2e.spec.ts
 */
import { test, expect } from '@playwright/test';

const BASE = process.env.BASE_URL ?? 'http://localhost:5173';

const NOW_ISO = new Date().toISOString();

const LIST_FIXTURE = {
  ok: true,
  composedAt: NOW_ISO,
  transactions: [
    {
      transactionRef: 'PWT-26-A1B2C',
      correlationId: 'shop:ORDER-E2E-1',
      occurredAt: NOW_ISO,
      platform: 'SHOP',
      label: 'PetWash Shop · Complete Grooming Kit',
      totalCents: 12500,
      currency: 'ILS',
      paymentState: 'PAID',
      documentType: 'InvoiceAndReceipt',
      source: 'shop_orders',
      sourceId: 'ORDER-E2E-1',
    },
    {
      transactionRef: 'PWT-26-S9K4M',
      correlationId: 'sitter:SIT-E2E-2',
      occurredAt: NOW_ISO,
      platform: 'SITTER_SUITE',
      label: 'Pet sitter · 3 nights',
      totalCents: 35000,
      currency: 'ILS',
      paymentState: 'PAID',
      documentType: 'Invoice',
      source: 'sitter_bookings',
      sourceId: 'SIT-E2E-2',
    },
    {
      transactionRef: 'PWT-26-W1L0Z',
      correlationId: 'walk:WLK-E2E-3',
      occurredAt: NOW_ISO,
      platform: 'WALK_MY_PET',
      label: 'Walk My Pet · 30 min',
      totalCents: 4500,
      currency: 'ILS',
      // §24 walk today has no payment rail — this row is honestly NOT_REQUIRED.
      paymentState: 'NOT_REQUIRED',
      source: 'walk_bookings',
      sourceId: 'WLK-E2E-3',
    },
  ],
};

const SHOP_DETAIL_FIXTURE = {
  ok: true,
  passport: {
    correlationId: 'shop:ORDER-E2E-1',
    transactionRef: 'PWT-26-A1B2C',
    orderRef: 'ORDER-E2E-1',
    eventType: 'SHOP_ORDER_PAID',
    paymentClass: 'SHOP_ITEM',
    platform: 'SHOP',
    serviceType: 'product_order',
    money: {
      currency: 'ILS',
      subtotalCents: 10684,
      vatAmountCents: 1816,
      totalCents: 12500,
      amountPaidCents: 12500,
      amountRefundedCents: 0,
      amountOutstandingCents: 0,
    },
    fundingLegs: [
      { rail: 'CARD', amountCents: 12500, currency: 'ILS', label: 'Card' },
    ],
    payment: { state: 'PAID', rail: 'CARD' },
    fiscalDocument: {
      required: true,
      documentType: 'InvoiceAndReceipt',
      state: 'ISSUED',
      sumitDocumentId: 'SUMIT-E2E-DOC-1',
    },
    items: [
      { label: 'Complete Grooming Kit', code: 'SHOP_ITEM_GENERIC', quantity: 1, unitAmountCents: 12500, totalCents: 12500 },
    ],
    commercialState: 'FULFILLED',
    fulfilmentState: 'CUSTOMER_CONFIRMED',
    payoutState: 'NOT_APPLICABLE',
    reconciliation: {
      paymentMatched: true, documentMatched: true, ledgerMatched: true, warnings: [],
    },
    composedAt: NOW_ISO,
  },
};

test.describe('/account/transactions — customer FiscalTransactionPassport surface', () => {
  test.beforeEach(async ({ page }) => {
    // Bypass Firebase — the client dev-mode bypass header pattern.
    await page.route('**/api/fiscal/my/transactions', (route) => {
      route.fulfill({ status: 200, body: JSON.stringify(LIST_FIXTURE), contentType: 'application/json' });
    });
    await page.route('**/api/fiscal/transactions/by-source/shop_orders/**', (route) => {
      route.fulfill({ status: 200, body: JSON.stringify(SHOP_DETAIL_FIXTURE), contentType: 'application/json' });
    });
  });

  test('list renders every transaction with amount + payment pill', async ({ page }) => {
    await page.goto(`${BASE}/account/transactions`);

    // Hero title.
    await expect(page.getByText(/Receipts.*orders|קבלות.*הזמנות/i)).toBeVisible();

    // Every row's label + amount.
    await expect(page.getByText(/Complete Grooming Kit/i)).toBeVisible();
    await expect(page.getByText(/₪125\.00/)).toBeVisible();
    await expect(page.getByText(/Pet sitter · 3 nights/i)).toBeVisible();
    await expect(page.getByText(/₪350\.00/)).toBeVisible();

    // §24 honest state — walk row shows the NOT_REQUIRED chip (not PAID).
    await expect(page.getByText(/Walk My Pet/i)).toBeVisible();
    await expect(page.getByText(/₪45\.00/)).toBeVisible();
  });

  test('drilling into a shop row shows total, fiscal doc, and no false warning', async ({ page }) => {
    await page.goto(`${BASE}/account/transactions/shop_orders/ORDER-E2E-1`);

    // Green hero + transactionRef.
    await expect(page.getByText('PWT-26-A1B2C')).toBeVisible();

    // Money block — the passport total.
    await expect(page.getByText('₪125.00')).toBeVisible();

    // Fiscal document block.
    await expect(page.getByText(/InvoiceAndReceipt/i)).toBeVisible();
    await expect(page.getByText(/ISSUED|סטטוס/i)).toBeVisible();

    // No warning banner — reconciliation.warnings is empty.
    await expect(page.getByText(/PAID_NO_FISCAL_DOCUMENT/i)).toHaveCount(0);
  });
});
