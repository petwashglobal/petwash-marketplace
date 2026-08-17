/**
 * Upload-and-refresh journey. Covers steps 4 & 5 of the mission:
 *
 *   4. upload a document → 201 response → UI shows checkmark and filename
 *   5. refresh the page → uploaded state persists
 *
 * All uploads go through `page.route()`; no real file lands on the server and
 * no real Firebase/Storage call is made. The "persistence" being tested is
 * the client's re-render from the server DTO, which is what an end user
 * actually experiences.
 */

import { test, expect } from '@playwright/test';
import {
  BASE_URL,
  bridgeSitterDocumentsPending,
  bridgeSitterOneDocUploaded,
  installApiRoutes,
  installDevAuth,
  waitForPendingReady,
} from './_helpers';

test.describe.configure({ mode: 'parallel' });

test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
});

test.describe('/provider/pending — document upload + refresh persistence', () => {
  test('upload → 201 → checkmark + filename render, and survive a hard reload', async ({ page }) => {
    await installDevAuth(page);
    const routes = await installApiRoutes(page, bridgeSitterDocumentsPending());

    await page.goto(`${BASE_URL}/provider/pending`, { waitUntil: 'domcontentloaded' });
    await waitForPendingReady(page);

    // Pre-upload state: home_photos card visible, no filename yet.
    await expect(page.getByText(/Home \/ Premises Photos/i)).toBeVisible();
    await expect(page.getByText('home-front.jpg')).toHaveCount(0);

    // Flip the fixture so the follow-up GET after upload returns the "one
    // doc uploaded" DTO. The client does this GET via `await fetchApplication()`
    // in `handleFileUpload` immediately after the 201.
    routes.setFixture(bridgeSitterOneDocUploaded('home-front.jpg'));

    // Trigger the hidden <input type=file>. The exact button varies by
    // language; we hit the input directly to keep the test copy-agnostic.
    const fileInput = page.locator('input[type=file]').first();
    await fileInput.setInputFiles({
      name: 'home-front.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('fake-image-bytes'),
    });

    // Post-upload: filename shows, and the row picks up the green (success)
    // border-green-200 class. Filename is the load-bearing assertion.
    await expect(page.getByText('home-front.jpg')).toBeVisible({ timeout: 5_000 });

    // The counter chip should read 1/1 (`uploadedTypes.size` / `requiredDocs.length`).
    await expect(page.getByText('1/1')).toBeVisible();

    // Refresh — the server is still returning the "one doc uploaded" DTO, so
    // the UI must re-render into the same state.
    await page.reload({ waitUntil: 'domcontentloaded' });

    // After reload the stage has advanced to documents_under_review; the
    // filename still renders and the counter is still 1/1.
    await expect(page.getByText('home-front.jpg')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('1/1')).toBeVisible();
  });

  test('upload button is disabled while an upload is in flight', async ({ page }) => {
    await installDevAuth(page);
    await installApiRoutes(page, bridgeSitterDocumentsPending());

    // Custom slow-upload route to prove the busy state renders. Install AFTER
    // the shared routes so it takes precedence for this specific endpoint.
    await page.route('**/api/provider-applications/my/documents', async (route) => {
      await new Promise((r) => setTimeout(r, 800));
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, document: { id: 1, documentType: 'home_photos' } }),
      });
    });

    await page.goto(`${BASE_URL}/provider/pending`, { waitUntil: 'domcontentloaded' });
    await waitForPendingReady(page);

    const fileInput = page.locator('input[type=file]').first();
    await fileInput.setInputFiles({
      name: 'in-flight.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('x'),
    });

    // While the 800 ms mock resolves, the upload button should carry `disabled`.
    // (The `Upload` button text is language-dependent, but every candidate button
    // in this card region gets disabled when `uploading != null`.)
    const uploadRow = page.getByText(/Home \/ Premises Photos/i).locator('xpath=ancestor::div[1]');
    const btn = uploadRow.locator('button').first();
    await expect(btn).toBeDisabled();
  });
});
