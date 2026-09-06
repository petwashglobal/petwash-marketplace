/**
 * /packages · customer purchase happy path (Task #280).
 *
 * Guards the collapse of `client/src/pages/Packages.tsx` from a hardcoded
 * 4-tier `packageOptions` array + `WASH_COUNT_TO_PACKAGE_ID` lookup onto the
 * live `/api/packages` catalog. The homepage widget already reads that
 * endpoint (`client/src/components/WashPackages.tsx:129`); this file pins
 * that the customer-facing `/packages` page does too, so admin edits at
 * `/admin/wash-packages` cannot silently diverge from what the buyer sees.
 *
 * Stubs mirror the shape of `journey-checkpoint-resume-academy.e2e.spec.ts`
 * — `page.route` all the way down, no live backend, deterministic IDs.
 *
 * The three contract pins the task calls out:
 *   1. Cards render in `/api/packages` order (proves the render is not
 *      re-sorting or reaching for a hardcoded array).
 *   2. Clicking a card → "View Package Details" → "Buy Now" issues
 *      POST /api/checkout with the DB row's `packageId` (proves the brittle
 *      washCount→id map is gone).
 *   3. Success screen renders and the dashboard CTA navigates to /dashboard
 *      (proves the preserved-UX success path is intact).
 */
import { test, expect, type Page } from '@playwright/test';

const WHOAMI_ACTIVATED = {
  authenticated: true,
  uid: 'usr_packages_e2e_1',
  email: 'packages-e2e@petwash.co.il',
  role: 'customer',
  isSuperAdmin: false,
  dashboardsAllowed: ['member'],
  profileStatus: 'complete',
  providerStatus: 'none',
  prestigeStatus: 'active',
  roles: ['customer'],
  session: { ageSeconds: 30, maxAgeSeconds: 3600, ip: '127.0.0.1', createdAt: null },
  claims: { role: 'customer', accountType: 'external' },
};

const CAPS_ACTIVATED = {
  ok: true,
  capabilities: {
    identity: { emailVerified: true, mobileVerified: true, activated: true },
    provider: { active: false, applicant: false, applicationStatus: null, services: [] },
    prestige: { enrolled: true, tier: 'gold', memberId: 'PM-2024-1' },
    staff: { active: false },
    admin: { admin: false, superAdmin: false },
  },
};

// A three-tier catalog. Deliberately NOT in wash-count order — the render
// contract is "server order, unchanged". If the client silently re-sorts,
// the first test fails.
const CATALOG = [
  {
    id: 42,
    name: 'Silver',
    nameHe: 'סילבר',
    description: 'Three premium natural washes',
    descriptionHe: 'שלוש רחיצות פרימיום טבעיות',
    price: '150',
    washCount: 3,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 7,
    name: 'Essentials',
    nameHe: 'בסיסי',
    description: 'One premium natural wash',
    descriptionHe: 'רחיצה פרימיום טבעית',
    price: '55',
    washCount: 1,
    isActive: true,
    createdAt: '2026-01-02T00:00:00.000Z',
  },
  {
    id: 113,
    name: 'Maison Collection',
    nameHe: 'קולקציית מזון',
    description: 'Ten premium natural washes',
    descriptionHe: 'עשר רחיצות פרימיום טבעיות',
    price: '480',
    washCount: 10,
    isActive: true,
    createdAt: '2026-01-03T00:00:00.000Z',
  },
] as const;

// Fields the client's onSuccess handler consumes to render the success
// screen. Kept small on purpose — the point of this stub is the wire, not
// the receipt.
const CHECKOUT_SUCCESS = {
  success: true,
  washesAdded: 3,
  amountPaid: 150,
  discountApplied: 0,
};

interface Harness {
  checkoutCalls: Array<{ packageId: number | undefined; paymentMethod: string | undefined }>;
}

async function wireStubs(page: Page): Promise<Harness> {
  const harness: Harness = { checkoutCalls: [] };

  // AuthProvider's client-side dev-mode escape hatch — with this flag set
  // BEFORE the app boots, `useFirebaseAuth()` synthesises a dev user so
  // the Buy Now button does not detour to /sign-up. Dev-mode-only per
  // client/src/auth/AuthProvider.tsx:200; production is unaffected.
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem('petwash_dev_mode', 'true');
      window.localStorage.setItem('petwash_lang', 'en');
    } catch {
      /* ignore private-mode storage errors */
    }
  });

  await page.route('**/api/session/whoami', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(WHOAMI_ACTIVATED) }),
  );
  await page.route('**/api/me/capabilities', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(CAPS_ACTIVATED) }),
  );
  await page.route('**/api/user/profile', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) }),
  );
  await page.route('**/api/auth/me', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: WHOAMI_ACTIVATED }) }),
  );

  await page.route('**/api/packages', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(CATALOG) }),
  );

  await page.route('**/api/checkout', async (route) => {
    const req = route.request();
    if (req.method() !== 'POST') return route.fallback();
    const body = (req.postDataJSON() ?? {}) as { packageId?: number; paymentMethod?: string };
    harness.checkoutCalls.push({ packageId: body.packageId, paymentMethod: body.paymentMethod });
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(CHECKOUT_SUCCESS),
    });
  });

  return harness;
}

test.describe('Task #280 · /packages reads the live /api/packages catalog', () => {
  let harness: Harness;

  test.beforeEach(async ({ page }) => {
    harness = await wireStubs(page);
  });

  test('cards render in /api/packages order — not any hardcoded order', async ({ page }) => {
    await page.goto('/packages');

    // Wait for the catalog cards to be present before probing the order.
    const cards = page.locator('[data-testid^="package-card-"]');
    await expect(cards.first()).toBeVisible({ timeout: 10_000 });
    await expect(cards).toHaveCount(CATALOG.length);

    // The stub returns [Silver(3), Essentials(1), Maison(10)] — verify the
    // rendered wash-count sequence matches that, NOT ascending order.
    const texts = await cards.allTextContents();
    const washCountSeen: number[] = [];
    for (const t of texts) {
      const match = t.match(/(\d+)\s+wash/i);
      if (match) washCountSeen.push(Number(match[1]));
    }
    expect(washCountSeen).toEqual(CATALOG.map((p) => p.washCount));
  });

  test('happy path: pick a card → Buy Now → POST /api/checkout with the DB packageId', async ({ page }) => {
    await page.goto('/packages');

    const cards = page.locator('[data-testid^="package-card-"]');
    await expect(cards.first()).toBeVisible({ timeout: 10_000 });

    // Click the second card in server order — Essentials (id: 7, washCount: 1).
    // A washCount → id map WOULD have picked id 1; this pins that we use the
    // DB row's id instead.
    const target = CATALOG[1];
    await cards.nth(1).click();

    const proceed = page.getByTestId('button-proceed-details');
    await expect(proceed).toBeVisible();
    await proceed.click();

    const buy = page.getByTestId('button-purchase');
    await expect(buy).toBeVisible();
    await buy.click();

    // The mutation fires — assert the wire.
    await expect.poll(() => harness.checkoutCalls.length, { timeout: 5_000 }).toBeGreaterThan(0);
    const last = harness.checkoutCalls[harness.checkoutCalls.length - 1];
    expect(last.packageId).toBe(target.id);
    expect(last.paymentMethod).toBe('credit_card');
  });

  test('success screen renders and the CTA navigates to /dashboard', async ({ page }) => {
    await page.goto('/packages');

    const cards = page.locator('[data-testid^="package-card-"]');
    await expect(cards.first()).toBeVisible({ timeout: 10_000 });

    await cards.nth(0).click();
    await page.getByTestId('button-proceed-details').click();
    await page.getByTestId('button-purchase').click();

    const dashboardCta = page.getByTestId('button-go-dashboard');
    await expect(dashboardCta).toBeVisible({ timeout: 5_000 });
    await dashboardCta.click();

    await expect
      .poll(() => new URL(page.url()).pathname, { timeout: 5_000 })
      .toBe('/dashboard');
  });

  test('empty /api/packages → graceful empty state, no crash', async ({ page }) => {
    // Override just this call — same URL, empty array.
    await page.unroute('**/api/packages');
    await page.route('**/api/packages', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
    );

    await page.goto('/packages');

    const empty = page.getByTestId('packages-empty');
    await expect(empty).toBeVisible({ timeout: 10_000 });

    // No cards, no "View Package Details" CTA.
    await expect(page.locator('[data-testid^="package-card-"]')).toHaveCount(0);
    await expect(page.getByTestId('button-proceed-details')).toHaveCount(0);
  });
});
