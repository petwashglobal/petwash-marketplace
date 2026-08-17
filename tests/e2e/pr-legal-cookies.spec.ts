/**
 * PR-LEGAL-COOKIES — behavioral coverage for
 *   claude/pr-legal-cookies → /legal/cookies dead-CTA fix.
 *
 * The two policy-page buttons were decorative pre-PR. Post-PR:
 *   - "Update Cookie Preferences" opens ConsentManager modal
 *   - "Block All Optional Cookies" runs createRejectAllConsent() →
 *     saveConsentPreferences() → localStorage['petwash_consent_preferences']
 *     with analytics/marketing = false, plus a debounce guard so a
 *     jittery double-tap fires the POST only once.
 *
 * Run:
 *   npx playwright test tests/e2e/pr-legal-cookies.spec.ts
 *
 * NEEDS-BACKEND-FIXTURES: no
 *   /api/consent is intercepted via page.route(...). Real localStorage
 *   writes are still observed on `window.localStorage` — that's the
 *   authoritative surface the app reads from at next mount.
 */
import { test, expect, type Page, type Route } from '@playwright/test';

const BASE_URL =
  process.env.BASE_URL ||
  (process.env.REPLIT_DEV_DOMAIN
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : 'http://localhost:5000');

async function installConsentRoute(
  page: Page,
  captured: string[],
  {
    delayMs = 500,
    status = 200,
  }: { delayMs?: number; status?: number } = {},
) {
  await page.route('**/api/consent', async (route: Route) => {
    captured.push(route.request().url());
    // Deliberately slow so the debounce test can double-tap while blocking=true
    await new Promise((r) => setTimeout(r, delayMs));
    return route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });
}

async function stubOtherApi(page: Page) {
  await page.route('**/api/**', async (route: Route) => {
    if (/\/api\/consent$/.test(route.request().url())) return route.fallback();
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, data: [] }),
    });
  });
}

async function clearConsentStorage(page: Page) {
  await page.addInitScript(() => {
    try {
      window.localStorage.removeItem('petwash_consent_preferences');
    } catch {
      /* ignore */
    }
  });
}

// ─── 1. Update Cookie Preferences opens ConsentManager ──────────────────────

test('Update Cookie Preferences opens the ConsentManager modal', async ({ page }) => {
  const captured: string[] = [];
  await stubOtherApi(page);
  await installConsentRoute(page, captured);
  await clearConsentStorage(page);

  await page.goto(`${BASE_URL}/legal/cookies`, { waitUntil: 'domcontentloaded' });

  const openBtn = page.locator('[data-testid="button-cookies-update-preferences"]');
  await expect(openBtn).toBeVisible();
  await openBtn.click();

  // ConsentManager has these testids per the component; either must appear.
  const modalAffordance = page.locator(
    '[data-testid="button-close-consent-manager"], [data-testid="button-accept-all-cookies"], [data-testid="button-save-preferences"]',
  );
  await expect(modalAffordance.first()).toBeVisible({ timeout: 5_000 });
});

// ─── 2. Block All Optional Cookies persists reject-all ──────────────────────

test('Block All Optional Cookies writes analytics/marketing=false to localStorage + toast', async ({
  page,
}) => {
  const captured: string[] = [];
  await stubOtherApi(page);
  await installConsentRoute(page, captured, { delayMs: 100 });
  await clearConsentStorage(page);

  await page.goto(`${BASE_URL}/legal/cookies`, { waitUntil: 'domcontentloaded' });

  const blockBtn = page.locator('[data-testid="button-cookies-block-optional"]');
  await expect(blockBtn).toBeVisible();
  await blockBtn.click();

  // Toast confirming the state change (locale-agnostic).
  const toast = page.locator(
    'text=/optional cookies blocked|preferences saved|עוגיות לא-הכרחיות/i',
  );
  await expect(toast.first()).toBeVisible({ timeout: 5_000 });

  // Authoritative surface: localStorage.
  const stored = await page.evaluate(() =>
    window.localStorage.getItem('petwash_consent_preferences'),
  );
  expect(stored, 'petwash_consent_preferences must be set').toBeTruthy();
  const parsed = JSON.parse(stored!);
  expect(parsed.necessary).toBe(true);
  expect(parsed.functional).toBe(false);
  expect(parsed.analytics).toBe(false);
  expect(parsed.marketing).toBe(false);
});

// ─── 3. Debounce guard: two rapid clicks → ONE POST ─────────────────────────

test('double-tap Block All Optional Cookies while blocking → only one POST /api/consent', async ({
  page,
}) => {
  const captured: string[] = [];
  await stubOtherApi(page);
  // 700 ms is long enough that a second click lands during the pending
  // state and short enough to keep the test fast.
  await installConsentRoute(page, captured, { delayMs: 700 });
  await clearConsentStorage(page);

  await page.goto(`${BASE_URL}/legal/cookies`, { waitUntil: 'domcontentloaded' });

  const blockBtn = page.locator('[data-testid="button-cookies-block-optional"]');
  await expect(blockBtn).toBeVisible();

  // Fire two rapid clicks. Playwright serialises, so we dispatch them
  // as parallel promises to defeat the input-queue sequentialisation.
  await Promise.all([
    blockBtn.click({ force: true }),
    blockBtn.click({ force: true }).catch(() => undefined),
  ]);

  // While pending, the button must be disabled per `disabled={blocking}`.
  await expect(blockBtn).toBeDisabled();

  // Wait for the POST to actually resolve.
  await page.waitForTimeout(1_500);

  expect(
    captured.length,
    `Debounce guard must collapse the double-tap into a single POST. Saw ${captured.length}.`,
  ).toBe(1);
});
