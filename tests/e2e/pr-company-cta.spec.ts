/**
 * PR-COMPANY-CTA — behavioral coverage for
 *   claude/pr-company-cta → PartnershipEnquiryDialog + Municipal + Locations
 *
 * Wires the previously-dead CTAs on /partners/municipal and
 * /partners/locations to /api/contact with source-tagged subject prefixes.
 *
 * Run:
 *   npx playwright test tests/e2e/pr-company-cta.spec.ts
 *
 * NEEDS-BACKEND-FIXTURES: no
 *   /api/contact is intercepted via page.route(...) — no real POST leaves
 *   the browser. Success and destructive-toast flows are exercised by
 *   controlling the mocked response.
 */
import { test, expect, type Page, type Route } from '@playwright/test';

const BASE_URL =
  process.env.BASE_URL ||
  (process.env.REPLIT_DEV_DOMAIN
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : 'http://localhost:5000');

type CapturedContact = {
  bodyText: string;
  body: Record<string, unknown> | null;
  headers: Record<string, string>;
};

async function installContactRoute(
  page: Page,
  captured: CapturedContact[],
  {
    status = 200,
    responseBody = { ok: true },
  }: { status?: number; responseBody?: unknown } = {},
) {
  await page.route('**/api/contact', async (route: Route) => {
    const req = route.request();
    const bodyText = req.postData() ?? '';
    let body: Record<string, unknown> | null = null;
    try {
      body = bodyText ? JSON.parse(bodyText) : null;
    } catch {
      body = null;
    }
    captured.push({ bodyText, body, headers: req.headers() });
    return route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(responseBody),
    });
  });
}

async function stubOtherApi(page: Page) {
  await page.route('**/api/**', async (route: Route) => {
    if (/\/api\/contact$/.test(route.request().url())) return route.fallback();
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, data: [] }),
    });
  });
}

async function openEnquiryDialog(page: Page, buttonTestId: string) {
  const cta = page.locator(`[data-testid="${buttonTestId}"]`);
  await expect(cta, `CTA ${buttonTestId} must be present`).toBeVisible();
  await cta.click();
  const form = page.locator('[data-testid="partnership-enquiry-form"]');
  await expect(form).toBeVisible();
}

async function fillEnquiryForm(
  page: Page,
  vals: { name: string; email: string; message: string; phone?: string; org?: string },
) {
  await page.locator('[data-testid="input-partnership-name"]').fill(vals.name);
  if (vals.org) await page.locator('[data-testid="input-partnership-org"]').fill(vals.org);
  await page.locator('[data-testid="input-partnership-email"]').fill(vals.email);
  if (vals.phone) await page.locator('[data-testid="input-partnership-phone"]').fill(vals.phone);
  await page.locator('[data-testid="input-partnership-message"]').fill(vals.message);
}

// ─── Municipal ──────────────────────────────────────────────────────────────

test.describe('/partners/municipal → Submit Council Enquiry', () => {
  test('happy path posts to /api/contact with municipal subject prefix', async ({ page }) => {
    const captured: CapturedContact[] = [];
    await stubOtherApi(page);
    await installContactRoute(page, captured);

    await page.goto(`${BASE_URL}/partners/municipal`, { waitUntil: 'domcontentloaded' });
    await openEnquiryDialog(page, 'button-council-enquiry');

    await fillEnquiryForm(page, {
      name: 'Yael Cohen',
      email: 'yael@municipality.test',
      phone: '+972-50-1234567',
      org: 'Tel Aviv Municipality',
      message: 'Interested in K9000 stations at three parks.',
    });

    await page.locator('[data-testid="button-partnership-submit"]').click();

    // Success surface — the success card in the dialog is authoritative.
    await expect(page.locator('[data-testid="partnership-enquiry-success"]')).toBeVisible({
      timeout: 5_000,
    });

    expect(captured.length, 'exactly one POST /api/contact should have fired').toBe(1);
    const body = captured[0].body!;
    expect(String(body.subject)).toMatch(/^Municipal \/ Council Enquiry — Yael Cohen$/);
    expect(body.name).toBe('Yael Cohen');
    expect(body.email).toBe('yael@municipality.test');
    expect(body.phone).toBe('+972-50-1234567');
    expect(typeof body.message).toBe('string');
    expect(String(body.message)).toContain('K9000 stations at three parks');
    expect(body.language).toBeTruthy();
  });

  test('empty required fields → destructive toast, no POST', async ({ page }) => {
    const captured: CapturedContact[] = [];
    await stubOtherApi(page);
    await installContactRoute(page, captured);

    await page.goto(`${BASE_URL}/partners/municipal`, { waitUntil: 'domcontentloaded' });
    await openEnquiryDialog(page, 'button-council-enquiry');

    // Strip HTML `required` so the browser doesn't short-circuit before
    // our JS handler runs its guard.
    await page.evaluate(() => {
      const form = document.querySelector(
        '[data-testid="partnership-enquiry-form"]',
      ) as HTMLFormElement | null;
      if (!form) return;
      form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('[required]').forEach((el) => {
        el.removeAttribute('required');
      });
    });
    await page.locator('[data-testid="button-partnership-submit"]').click();

    const destructiveToast = page.locator(
      '[data-variant="destructive"], .destructive, text=/missing required fields|שדות חובה/i',
    );
    await expect(destructiveToast.first()).toBeVisible({ timeout: 5_000 });

    expect(captured.length, 'no /api/contact POST should have fired').toBe(0);
  });
});

// ─── Locations / Landlord ───────────────────────────────────────────────────

test.describe('/partners/locations → Submit Partnership Enquiry', () => {
  test('happy path posts to /api/contact with location/landlord prefix', async ({ page }) => {
    const captured: CapturedContact[] = [];
    await stubOtherApi(page);
    await installContactRoute(page, captured);

    await page.goto(`${BASE_URL}/partners/locations`, { waitUntil: 'domcontentloaded' });
    await openEnquiryDialog(page, 'button-submit-enquiry');

    await fillEnquiryForm(page, {
      name: 'Dan Levi',
      email: 'dan@ayalonmall.test',
      phone: '+972-52-9876543',
      org: 'Ayalon Mall Group',
      message: 'Two anchor sites in central Israel, ~5000 daily foot traffic each.',
    });
    await page.locator('[data-testid="button-partnership-submit"]').click();

    await expect(page.locator('[data-testid="partnership-enquiry-success"]')).toBeVisible({
      timeout: 5_000,
    });

    expect(captured.length).toBe(1);
    const body = captured[0].body!;
    expect(String(body.subject)).toMatch(
      /^Location \/ Landlord Partnership Enquiry — Dan Levi$/,
    );
    expect(body.name).toBe('Dan Levi');
    expect(body.email).toBe('dan@ayalonmall.test');
    expect(body.phone).toBe('+972-52-9876543');
    expect(String(body.message)).toContain('Ayalon Mall Group');
    expect(body.language).toBeTruthy();
  });

  test('server 500 → destructive toast, dialog stays open (no success card)', async ({ page }) => {
    const captured: CapturedContact[] = [];
    await stubOtherApi(page);
    await installContactRoute(page, captured, { status: 500, responseBody: { ok: false } });

    await page.goto(`${BASE_URL}/partners/locations`, { waitUntil: 'domcontentloaded' });
    await openEnquiryDialog(page, 'button-submit-enquiry');

    await fillEnquiryForm(page, {
      name: 'Sara Bloch',
      email: 'sara@sitecorp.test',
      message: 'Interested in three sites.',
    });
    await page.locator('[data-testid="button-partnership-submit"]').click();

    await page.waitForTimeout(500);
    expect(captured.length).toBe(1);
    await expect(page.locator('[data-testid="partnership-enquiry-success"]')).toHaveCount(0);

    const destructiveToast = page.locator(
      '[data-variant="destructive"], .destructive, text=/could not submit|שגיאה/i',
    );
    await expect(destructiveToast.first()).toBeVisible({ timeout: 5_000 });
  });
});
