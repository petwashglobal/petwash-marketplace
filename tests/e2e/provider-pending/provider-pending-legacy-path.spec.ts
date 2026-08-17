/**
 * LEGACY-path coverage: applicant on the historical `provider_applicants`
 * table. Regression this file locks in:
 *
 *   Before 9425f13, this branch returned a NESTED shape —
 *     { application: { stage, status, ... }, documents, tasks, ... }
 *   — while the client reads `data.stage` and `data.status` FLAT. Result:
 *   stageIndex === -1, entire progress bar rendered inactive, auto-redirect
 *   on approval never fired. The fix flattened the payload to match the
 *   bridge-branch shape. This spec asserts the flat shape produces a working
 *   UI end-to-end.
 */

import { test, expect } from '@playwright/test';
import {
  BASE_URL,
  legacyDocumentsPending,
  installApiRoutes,
  installDevAuth,
  waitForPendingReady,
} from './_helpers';

test.describe.configure({ mode: 'parallel' });

test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
});

test.describe('/provider/pending — legacy (provider_applicants) path', () => {
  test('flat-shape DTO → progress bar + upload card render exactly like the bridge path', async ({ page }) => {
    await installDevAuth(page);
    await installApiRoutes(page, legacyDocumentsPending());

    await page.goto(`${BASE_URL}/provider/pending`, { waitUntil: 'domcontentloaded' });
    await waitForPendingReady(page);

    // If the DTO had regressed to the old nested shape, `stageIndex` would be
    // -1 and the CURRENT dot would NOT carry bg-amber-500. That is exactly the
    // regression this assertion catches.
    const currentDot = page.getByTestId('progress-dot-documents_pending');
    await expect(currentDot).toHaveClass(/bg-amber-500/);

    // All four labels rendered — no partial UI.
    for (const stage of [
      'documents_pending',
      'documents_under_review',
      'background_check_pending',
      'approved',
    ]) {
      await expect(page.getByTestId(`progress-dot-${stage}`)).toBeVisible();
    }

    // The document upload card renders because requiredDocuments is populated.
    await expect(page.getByText(/Required Documents/i)).toBeVisible();
    await expect(page.getByText(/Home \/ Premises Photos/i)).toBeVisible();

    // Counter chip reads 0/1 — proves both `documents.length` and
    // `requiredDocuments.length` were read from the FLAT payload keys.
    await expect(page.getByText('0/1')).toBeVisible();
  });

  test('progress bar reflects `stage` as it advances on the flat shape', async ({ page }) => {
    // Start at documents_under_review to prove the second dot lights up when
    // the flat `stage` field says so — the nested-shape bug made ALL dots
    // inactive regardless of stage.
    await installDevAuth(page);
    await installApiRoutes(page, {
      ...legacyDocumentsPending(),
      stage: 'documents_under_review',
      status: 'documents_under_review',
    });

    await page.goto(`${BASE_URL}/provider/pending`, { waitUntil: 'domcontentloaded' });
    await waitForPendingReady(page);

    await expect(page.getByTestId('progress-dot-documents_pending')).toHaveClass(/bg-amber-500/);
    await expect(page.getByTestId('progress-dot-documents_under_review')).toHaveClass(/bg-amber-500/);
    await expect(page.getByTestId('progress-dot-background_check_pending')).not.toHaveClass(/bg-amber-500/);
    await expect(page.getByTestId('progress-dot-approved')).not.toHaveClass(/bg-amber-500/);
  });
});
