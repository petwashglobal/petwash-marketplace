/**
 * my-transactions-pettrek.e2e.spec.ts — CEO 2026-08-27 §94.16 + §37.
 *
 * Playwright coverage for a customer viewing a PetTrek trip receipt
 * through the fiscal-passport surface. Complements the SHOP/SITTER/
 * WALK spec (`my-transactions.e2e.spec.ts`).
 *
 * Fixtures stub /api/fiscal/transactions/by-source/pettrek_trips/:tripId
 * with a full FiscalTransactionPassport that matches the shape
 * composePettrekFiscal() emits (see server/services/fiscalPassport/composer.ts).
 *
 *   npx playwright test tests/e2e/my-transactions-pettrek.e2e.spec.ts
 */
import { test, expect } from '@playwright/test';

const BASE = process.env.BASE_URL ?? 'http://localhost:5173';
const NOW_ISO = new Date().toISOString();

const PETTREK_DETAIL_FIXTURE = {
  ok: true,
  passport: {
    correlationId: 'pettrek:TRK-E2E-1',
    transactionRef: 'PWT-26-PT1Q3',
    bookingRef: 'TRK-E2E-1',
    eventType: 'PETTREK_BOOKING_PAID',
    paymentClass: 'PROVIDER_BOOKING_COMMISSION',
    platform: 'PETTREK',
    serviceType: 'transport',
    money: {
      currency: 'ILS',
      subtotalCents: 12000,
      totalCents: 12000,
      amountPaidCents: 12000,
      amountRefundedCents: 0,
      amountOutstandingCents: 0,
    },
    fundingLegs: [
      { rail: 'CARD', amountCents: 12000, currency: 'ILS', label: 'Card (Nayax)', externalRef: 'nayax_trk_e2e_1' },
    ],
    payment: { state: 'PAID', rail: 'CARD', providerTransactionId: 'nayax_trk_e2e_1' },
    fiscalDocument: {
      required: true,
      documentType: 'Invoice',
      state: 'PENDING',
    },
    items: [
      { label: 'PetTrek trip', code: 'PETTREK_TRIP', quantity: 1, unitAmountCents: 12000, totalCents: 12000 },
    ],
    commercialState: 'BOOKED',
    fulfilmentState: 'NOT_STARTED',
    payoutState: 'PENDING',
    reconciliation: {
      paymentMatched: true, documentMatched: false, ledgerMatched: true,
      // §85 — paid, doc pending → PAID_NO_FISCAL_DOCUMENT surfaces.
      warnings: ['PAID_NO_FISCAL_DOCUMENT'],
    },
    composedAt: NOW_ISO,
  },
};

test.describe('/account/transactions/pettrek_trips — PetTrek fiscal passport', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/fiscal/transactions/by-source/pettrek_trips/**', (route) => {
      route.fulfill({ status: 200, body: JSON.stringify(PETTREK_DETAIL_FIXTURE), contentType: 'application/json' });
    });
  });

  test('customer sees the PetTrek passport with disclosed-agent semantics', async ({ page }) => {
    await page.goto(`${BASE}/account/transactions/pettrek_trips/TRK-E2E-1`);

    // Hero renders the PetTrek platform + transactionRef.
    await expect(page.getByText('PWT-26-PT1Q3')).toBeVisible();
    // Total.
    await expect(page.getByText('₪120.00')).toBeVisible();
    // Payment PAID pill (localised label).
    await expect(page.getByText(/Paid|שולם/i)).toBeVisible();
  });

  test('marketplace booking exposes the honest reconciliation warning', async ({ page }) => {
    await page.goto(`${BASE}/account/transactions/pettrek_trips/TRK-E2E-1`);
    // §85 warning is surfaced verbatim in the reconciliation block.
    await expect(page.getByText('PAID_NO_FISCAL_DOCUMENT')).toBeVisible();
  });

  test('booking-source transaction gets the Open Job Passport link', async ({ page }) => {
    await page.goto(`${BASE}/account/transactions/pettrek_trips/TRK-E2E-1`);
    // MyTransactions.tsx renders the link when source ∈ BOOKING_SOURCES.
    // pettrek_trips was added to that set in the fiscal-passport wire.
    await expect(page.getByText(/Open Job Passport|פתיחת דרכון עבודה/i)).toBeVisible();
  });
});
