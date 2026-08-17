/**
 * BRIDGE-path coverage: applicant on the CANONICAL `provider_applications`
 * table (the live onboarding form). Regression this file locks in:
 *
 *   Before 9425f13, GET /api/provider-applications/my's bridge branch omitted
 *   `requiredDocuments`. The client gates the upload card on
 *   `requiredDocs.length > 0`, so a sitter applicant on the canonical table
 *   never saw a way to upload the `home_photos` the server was waiting for.
 *
 * The tests below exercise ALL three provider types that route through the
 * bridge branch (sitter/walker/station_operator) to prove that:
 *   - sitter (pet_sitting)      → requiredDocuments == ['home_photos']  → upload card renders
 *   - walker (dog_walking)      → requiredDocuments == []               → upload card HIDDEN
 *   - station_operator (empty)  → requiredDocuments == []               → upload card HIDDEN
 */

import { test, expect } from '@playwright/test';
import {
  BASE_URL,
  bridgeSitterDocumentsPending,
  bridgeWalkerNoDocuments,
  bridgeStationOperatorNoDocuments,
  installApiRoutes,
  installDevAuth,
  waitForPendingReady,
} from './_helpers';

test.describe.configure({ mode: 'parallel' });

test.afterEach(async ({ page }) => {
  // Idempotent cleanup — page teardown already unroutes, but the mission
  // asks for an explicit call in every file to make the discipline visible.
  await page.unrouteAll({ behavior: 'ignoreErrors' });
});

test.describe('/provider/pending — bridge (provider_applications) path', () => {
  test('sitter submission → progress bar renders + home_photos upload card visible', async ({ page }) => {
    await installDevAuth(page);
    await installApiRoutes(page, bridgeSitterDocumentsPending());

    await page.goto(`${BASE_URL}/provider/pending`, { waitUntil: 'domcontentloaded' });
    await waitForPendingReady(page);

    // All four canonical progress dots must render (regression: the old code
    // rendered dots twice and used bg-white — nothing was visible on a white
    // Card. We do not care about the pixel; we care that all four exist).
    for (const stage of [
      'documents_pending',
      'documents_under_review',
      'background_check_pending',
      'approved',
    ]) {
      await expect(page.getByTestId(`progress-dot-${stage}`)).toBeVisible();
    }

    // Current stage highlighted (amber). We assert the amber class is present
    // on the current dot rather than parsing the computed style, because that
    // class is the exact contract the fix restored.
    const currentDot = page.getByTestId('progress-dot-documents_pending');
    await expect(currentDot).toHaveClass(/bg-amber-500/);

    // Later stages must NOT carry the amber class — they should sit on the
    // gray-200 fill that the fix introduced.
    for (const stage of ['documents_under_review', 'background_check_pending', 'approved']) {
      await expect(page.getByTestId(`progress-dot-${stage}`)).not.toHaveClass(/bg-amber-500/);
      await expect(page.getByTestId(`progress-dot-${stage}`)).toHaveClass(/bg-gray-200/);
    }

    // The upload card is gated on `requiredDocuments.length > 0`. For a sitter
    // it MUST render with a home_photos row.
    await expect(page.getByText(/Required Documents/i)).toBeVisible();
    await expect(page.getByText(/Home \/ Premises Photos/i)).toBeVisible();
  });

  test('walker submission → progress bar renders + upload card HIDDEN (no required docs)', async ({ page }) => {
    await installDevAuth(page);
    await installApiRoutes(page, bridgeWalkerNoDocuments());

    await page.goto(`${BASE_URL}/provider/pending`, { waitUntil: 'domcontentloaded' });
    await waitForPendingReady(page);

    // Progress bar still renders for a walker.
    await expect(page.getByTestId('progress-dot-documents_pending')).toBeVisible();
    await expect(page.getByTestId('progress-dot-approved')).toBeVisible();

    // With requiredDocuments == [] the upload card must NOT be in the DOM.
    // We assert on the heading text; scoping to `getByRole` avoids matching
    // the FileCheck icon's aria-hidden label.
    await expect(page.getByText(/Required Documents/i)).toHaveCount(0);
  });

  test('station_operator submission → upload card HIDDEN', async ({ page }) => {
    await installDevAuth(page);
    await installApiRoutes(page, bridgeStationOperatorNoDocuments());

    await page.goto(`${BASE_URL}/provider/pending`, { waitUntil: 'domcontentloaded' });
    await waitForPendingReady(page);

    await expect(page.getByText(/Required Documents/i)).toHaveCount(0);
  });

  test('404 from /my → applicant is bounced to /become-provider (fixture: no application)', async ({ page }) => {
    // Baseline safety: an applicant with no rows on either table (a rare edge
    // that the fix does not touch) must still be shipped to /become-provider.
    // We assert here so a future regression that swallowed the 404 shows up.
    await installDevAuth(page);
    await installApiRoutes(page, { status: 404 });

    await page.goto(`${BASE_URL}/provider/pending`, { waitUntil: 'domcontentloaded' });

    await page.waitForURL(/\/become-provider/i, { timeout: 5_000 }).catch(() => {
      /* fall through — expectation below will fail with a clear message */
    });
    expect(page.url()).toMatch(/\/become-provider/i);
  });
});
