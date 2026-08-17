/**
 * Rejection-state journey. Covers mission step 7:
 *
 *   admin rejects → status=rejected → client shows rejection card
 *
 * The rejection card is an entire branch of the component
 * (`if (appData.status === "rejected") return <Card>...</Card>`) — no progress
 * bar, no upload card, just the "Application Not Approved" surface with a
 * single "Back to Home" CTA that navigates to `/`.
 */

import { test, expect } from '@playwright/test';
import {
  BASE_URL,
  bridgeSitterDocumentsPending,
  bridgeRejected,
  installApiRoutes,
  installDevAuth,
  waitForPendingReady,
} from './_helpers';

test.describe.configure({ mode: 'parallel' });

test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
});

test.describe('/provider/pending — rejection card', () => {
  test('rejected fixture → rejection card, no progress bar, no upload card', async ({ page }) => {
    await installDevAuth(page);
    await installApiRoutes(page, bridgeRejected('Missing valid ID'));

    await page.goto(`${BASE_URL}/provider/pending`, { waitUntil: 'domcontentloaded' });

    // Rejection card is a full-branch replacement — the whole "Application Not
    // Approved" heading must be present, and the progress bar must NOT be.
    await expect(page.getByText(/Application Not Approved/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('progress-dot-documents_pending')).toHaveCount(0);
    await expect(page.getByText(/Required Documents/i)).toHaveCount(0);

    // The CTA takes the applicant back home. We assert the click actually
    // moves the URL rather than trusting the button label (bilingual UI).
    await page.getByRole('button', { name: /Back to Home|דף הבית|Home/i }).first().click();
    await page.waitForURL((url) => url.pathname === '/' || url.pathname === '/home', {
      timeout: 5_000,
    }).catch(() => {
      /* fall through — expectation below will fail with a clear message */
    });
    expect(page.url()).toMatch(/\/(home)?$/);
  });

  test('mid-flow → admin rejects → refresh flips to rejection card', async ({ page }) => {
    // The applicant is initially documents_pending; the rejection card should
    // appear after a fresh /my fetch returns status=rejected, without a full
    // page reload.
    await installDevAuth(page);
    const routes = await installApiRoutes(page, bridgeSitterDocumentsPending());

    await page.goto(`${BASE_URL}/provider/pending`, { waitUntil: 'domcontentloaded' });
    await waitForPendingReady(page);

    routes.setFixture(bridgeRejected('Failed background check'));

    await page.getByRole('button', { name: /Refresh Status/i }).click();

    await expect(page.getByText(/Application Not Approved/i)).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId('progress-dot-documents_pending')).toHaveCount(0);
  });
});
