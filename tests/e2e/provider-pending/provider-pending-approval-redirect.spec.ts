/**
 * Approval → auto-redirect journey. Covers mission step 6:
 *
 *   admin approves → next fetch of /my returns status=approved
 *   → client auto-redirects to /provider/dashboard
 *
 * The redirect is fired from `fetchApplication()`:
 *     if (data.status === "approved" || data.stage === "approved") {
 *       setLocation("/provider/dashboard");
 *     }
 * so we install the routes with a documents_pending fixture, wait for the
 * first render, flip the fixture to approved, and trigger the "Refresh Status"
 * button (which calls `checkStatus() -> fetchApplication()`).
 */

import { test, expect } from '@playwright/test';
import {
  BASE_URL,
  bridgeSitterDocumentsPending,
  bridgeApproved,
  installApiRoutes,
  installDevAuth,
  waitForPendingReady,
} from './_helpers';

test.describe.configure({ mode: 'parallel' });

test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
});

test.describe('/provider/pending — approval auto-redirect', () => {
  test('status flips to approved on the next fetch → user is sent to /provider/dashboard', async ({ page }) => {
    await installDevAuth(page);
    const routes = await installApiRoutes(page, bridgeSitterDocumentsPending());

    await page.goto(`${BASE_URL}/provider/pending`, { waitUntil: 'domcontentloaded' });
    await waitForPendingReady(page);

    // Baseline: we're on /provider/pending, not the dashboard.
    expect(page.url()).toMatch(/\/provider\/pending$/);

    // Admin approves — the next /my fetch will return status=approved.
    routes.setFixture(bridgeApproved());

    // Trigger a fresh fetch. The "Refresh Status" button uses `getIdToken(true)`
    // + `getIdTokenResult(true)`, both of which are provided by the dev-mode
    // synthetic user, so no Firebase network is involved.
    const refresh = page.getByRole('button', { name: /Refresh Status/i });
    await refresh.click();

    // Redirect must land on /provider/dashboard within a few seconds.
    await page.waitForURL(/\/provider\/dashboard/, { timeout: 5_000 });
    expect(page.url()).toMatch(/\/provider\/dashboard/);
  });

  test('approval detected on initial mount also redirects (no user gesture needed)', async ({ page }) => {
    // Some approvals happen while the tab is closed; when the applicant returns
    // to /provider/pending directly, the first /my must trigger the redirect.
    await installDevAuth(page);
    await installApiRoutes(page, bridgeApproved());

    await page.goto(`${BASE_URL}/provider/pending`, { waitUntil: 'domcontentloaded' });

    await page.waitForURL(/\/provider\/dashboard/, { timeout: 5_000 });
    expect(page.url()).toMatch(/\/provider\/dashboard/);
  });
});
