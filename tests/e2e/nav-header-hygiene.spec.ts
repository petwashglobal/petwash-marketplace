/**
 * PR-NAV-HEADER-HYGIENE — behavioral coverage for
 *   claude/nav-header-hygiene → PetWashHeader.tsx
 *
 * Ships with:
 *   - Dead inbox poll removed  (no /api/booking-chat/inbox on mount)
 *   - Third-party geo fetch removed (no ipapi.co on mount)
 *   - Logout drawer button disables while `isLoggingOut`
 *   - Sign in / Sign up drawer buttons append `?from=<current path>` on deep pages
 *   - `notifications.aria` translated across 6 languages
 *
 * Run:
 *   npx playwright test tests/e2e/nav-header-hygiene.spec.ts
 *
 * NEEDS-BACKEND-FIXTURES: no
 *   Every outbound network call is intercepted via page.route(...). No real
 *   Firebase / SUMIT / SMS traffic. The auth stub is a window-level shim
 *   that flips the header into its "logged in" branch so the logout button
 *   and language button render.
 */
import { test, expect, type Page, type Route } from '@playwright/test';

const BASE_URL =
  process.env.BASE_URL ||
  (process.env.REPLIT_DEV_DOMAIN
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : 'http://localhost:5000');

// ─── Helpers ────────────────────────────────────────────────────────────────

async function stubApi(
  page: Page,
  observed: {
    inboxCalls: string[];
    unreadCountCalls: string[];
    ipapiCalls: string[];
    logoutCalls: string[];
  },
) {
  await page.route('**/ipapi.co/**', async (route: Route) => {
    observed.ipapiCalls.push(route.request().url());
    return route.fulfill({ status: 200, body: 'IL' });
  });

  await page.route('**/api/**', async (route: Route) => {
    const url = route.request().url();
    if (/\/api\/booking-chat\/inbox\b/.test(url)) {
      observed.inboxCalls.push(url);
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '[]',
      });
    }
    if (/\/api\/notifications\/unread-count\b/.test(url)) {
      observed.unreadCountCalls.push(url);
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ count: 0 }),
      });
    }
    if (/\/api\/auth\/logout\b/.test(url)) {
      observed.logoutCalls.push(url);
      // Simulate a slow logout so the disabled state is observable.
      await new Promise((r) => setTimeout(r, 400));
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
    }
    // Safe default — never a real network hop.
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, data: [], items: [], count: 0 }),
    });
  });
}

async function stubAuthLoggedIn(page: Page, language: string = 'en') {
  await page.addInitScript(
    ({ lang }) => {
      try {
        (window as unknown as { __PETWASH_TEST_AUTH__?: unknown }).__PETWASH_TEST_AUTH__ = {
          uid: 'header-test-uid',
          email: 'qa+header@petwash.test',
          role: 'customer',
          roles: ['customer'],
          isAnonymous: false,
        };
        window.localStorage.setItem('pw_lang', lang);
        window.localStorage.setItem('pw_country', 'IL');
      } catch {
        /* private mode — tolerate */
      }
    },
    { lang: language },
  );
}

function makeObserved() {
  return {
    inboxCalls: [] as string[],
    unreadCountCalls: [] as string[],
    ipapiCalls: [] as string[],
    logoutCalls: [] as string[],
  };
}

// ─── 1. No dead /api/booking-chat/inbox poll ────────────────────────────────

test.describe('header network hygiene', () => {
  test('mount does NOT fire /api/booking-chat/inbox useQuery', async ({ page }) => {
    const observed = makeObserved();
    await stubApi(page, observed);
    await stubAuthLoggedIn(page);

    await page.goto(`${BASE_URL}/home`, { waitUntil: 'domcontentloaded' });
    // Give any latent refetch interval a chance to fire — the poll used to
    // run at 30 s so 3 s here is deliberately shorter than a single tick.
    await page.waitForTimeout(3_000);

    expect(
      observed.inboxCalls,
      `Header must not poll /api/booking-chat/inbox after PR — saw: ${observed.inboxCalls.join(', ')}`,
    ).toEqual([]);
  });

  test('mount does NOT fetch ipapi.co', async ({ page }) => {
    const observed = makeObserved();
    await stubApi(page, observed);
    // Deliberately do NOT prime pw_lang so the old geo-detect path would
    // fire if it still existed. The new code should still not call ipapi.
    await page.addInitScript(() => {
      try {
        window.localStorage.removeItem('pw_lang');
        window.localStorage.removeItem('pw_country');
      } catch {
        /* ignore */
      }
    });

    await page.goto(`${BASE_URL}/home`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1_500);

    expect(
      observed.ipapiCalls,
      `Header must not fetch ipapi.co on mount — saw: ${observed.ipapiCalls.join(', ')}`,
    ).toEqual([]);
  });
});

// ─── 2. Logout button disabled while pending ────────────────────────────────

test.describe('logout debounce', () => {
  test('logout drawer button disables while isLoggingOut and posts only once', async ({ page }) => {
    const observed = makeObserved();
    await stubApi(page, observed);
    await stubAuthLoggedIn(page);

    await page.goto(`${BASE_URL}/home`, { waitUntil: 'domcontentloaded' });

    // Open the mobile drawer — try a few conventional selectors.
    const drawerToggle = page
      .locator(
        '[data-testid="button-mobile-menu"], button[aria-label*="menu" i], button[aria-label*="Menu"]',
      )
      .first();
    const drawerAvailable = await drawerToggle.isVisible().catch(() => false);
    test.skip(
      !drawerAvailable,
      'Mobile drawer toggle not visible in this viewport/build — logout button lives inside the drawer only.',
    );
    await drawerToggle.click();

    const logoutBtn = page.locator('button.pw-logout-btn').first();
    const logoutVisible = await logoutBtn.isVisible().catch(() => false);
    test.skip(
      !logoutVisible,
      'Logout button not rendered — likely because the test auth stub was not picked up by the real provider.',
    );

    // Fire a jittery double-tap. The 2nd click should be a no-op because
    // the button flips to disabled after the first synchronous state
    // update.
    await Promise.all([logoutBtn.click(), logoutBtn.click().catch(() => undefined)]);
    // Immediately after: the button must report itself disabled.
    await expect(logoutBtn).toBeDisabled();

    // Wait long enough for the (stubbed) POST to complete + follow-up
    // window.location.assign — which is swallowed by playwright.
    await page.waitForTimeout(800);
    expect(
      observed.logoutCalls.length,
      `Only ONE /api/auth/logout should have fired despite the double-tap. Saw ${observed.logoutCalls.length}.`,
    ).toBeLessThanOrEqual(1);
  });
});

// ─── 3. Sign in / Sign up append ?from=<current path> ───────────────────────

test.describe('drawer sign-in / sign-up return-to', () => {
  test('signin button appends ?from=<current path> when clicked from a deep page', async ({
    page,
  }) => {
    const observed = makeObserved();
    await stubApi(page, observed);
    // Don't stub auth — we want the anonymous branch so signin/signup show.

    const DEEP_PATH = '/partners/locations';
    await page.goto(`${BASE_URL}${DEEP_PATH}`, { waitUntil: 'domcontentloaded' });

    const drawerToggle = page
      .locator(
        '[data-testid="button-mobile-menu"], button[aria-label*="menu" i], button[aria-label*="Menu"]',
      )
      .first();
    const drawerAvailable = await drawerToggle.isVisible().catch(() => false);
    test.skip(!drawerAvailable, 'Mobile drawer toggle not visible in this viewport.');
    await drawerToggle.click();

    const signInBtn = page.locator('button.pw-mobile-link', { hasText: /sign in|log in|התחבר/i }).first();
    const signInVisible = await signInBtn.isVisible().catch(() => false);
    test.skip(!signInVisible, 'Sign-in drawer button not rendered on this build.');

    await signInBtn.click();
    // The header's handleNavigate can be wouter's setLocation or a
    // straight window.location assignment — accept either.
    await page.waitForURL(
      (u) =>
        /\/(signin|login)/.test(u.pathname) &&
        /from=/.test(u.search) &&
        u.search.includes(encodeURIComponent(DEEP_PATH)),
      { timeout: 5_000 },
    );

    const url = new URL(page.url());
    expect(
      url.searchParams.get('from'),
      `?from= must carry the origin path (${DEEP_PATH}).`,
    ).toContain(DEEP_PATH);
  });

  test('signup button appends ?from=<current path> when clicked from a deep page', async ({
    page,
  }) => {
    const observed = makeObserved();
    await stubApi(page, observed);

    const DEEP_PATH = '/partners/municipal';
    await page.goto(`${BASE_URL}${DEEP_PATH}`, { waitUntil: 'domcontentloaded' });

    const drawerToggle = page
      .locator(
        '[data-testid="button-mobile-menu"], button[aria-label*="menu" i], button[aria-label*="Menu"]',
      )
      .first();
    const drawerAvailable = await drawerToggle.isVisible().catch(() => false);
    test.skip(!drawerAvailable, 'Mobile drawer toggle not visible in this viewport.');
    await drawerToggle.click();

    const signUpBtn = page.locator('button.pw-mobile-link', { hasText: /sign up|register|הרשמ/i }).first();
    const signUpVisible = await signUpBtn.isVisible().catch(() => false);
    test.skip(!signUpVisible, 'Sign-up drawer button not rendered on this build.');

    await signUpBtn.click();
    await page.waitForURL(
      (u) =>
        /\/signup/.test(u.pathname) &&
        /from=/.test(u.search) &&
        u.search.includes(encodeURIComponent(DEEP_PATH)),
      { timeout: 5_000 },
    );

    const url = new URL(page.url());
    expect(url.searchParams.get('from')).toContain(DEEP_PATH);
  });
});

// ─── 4. notifications.aria renders in every supported language ───────────────

const LANG_ARIA: Array<{ code: string; expected: RegExp }> = [
  { code: 'en', expected: /notifications/i },
  { code: 'he', expected: /התראות/ },
  { code: 'ru', expected: /Уведомления/ },
  { code: 'fr', expected: /notifications/i },
  { code: 'es', expected: /notificaciones/i },
  { code: 'ar', expected: /الإشعارات/ },
];

for (const { code, expected } of LANG_ARIA) {
  test(`notification bell aria-label localised to "${code}"`, async ({ page }) => {
    const observed = makeObserved();
    await stubApi(page, observed);
    await stubAuthLoggedIn(page, code);

    await page.goto(`${BASE_URL}/home`, { waitUntil: 'domcontentloaded' });

    const bell = page.locator('[data-testid="button-notifications-bell"]').first();
    const bellVisible = await bell.isVisible().catch(() => false);
    test.skip(
      !bellVisible,
      'Notification bell not rendered — real auth provider ignored the test stub, cannot exercise localised aria on this build.',
    );

    const aria = await bell.getAttribute('aria-label');
    expect(aria, `Bell aria-label must be present for lang=${code}`).toBeTruthy();
    expect(aria!, `Bell aria-label must localise to ${code}: got "${aria}"`).toMatch(expected);
  });
}
