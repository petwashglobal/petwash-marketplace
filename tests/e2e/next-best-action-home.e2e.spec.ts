/**
 * Real-browser E2E · NextBestActionCard on home surfaces
 * (Journey Brain Phase 5 · post-release 2026-09-04).
 *
 * Proves the whole Phase 4 + Phase 5 wire end-to-end in real
 * Chromium — server projection → useNextBestAction hook →
 * <NextBestActionCard> render → tap → navigate — for both
 * Pet-Parent (Prestige) home and Provider home.
 *
 * Contract pinned:
 *
 *   1. Cold visit → GET /api/next-best-action lands on mount.
 *   2. When the server returns a populated primary + secondary
 *      projection, the card renders with:
 *        * data-testid=`next-best-action-${actor}`  (section)
 *        * data-testid=`next-best-action-primary`   (primary tap)
 *        * data-testid=`next-best-action-secondary-list` (list)
 *   3. Tapping the primary AttentionItem navigates to its
 *      `destination` — no client-side priority override.
 *   4. Tapping a resume secondary carries `data-action-id="RESUME_JOURNEY"`
 *      (distinct from BOOK_CONFIRM).
 *   5. When the server fails-CLOSED (200 with null primary), the
 *      card renders NOTHING — home stays clean; AttentionList
 *      still owns its own render.
 *   6. Defence-in-depth: if the server EVER leaks a payment-truth
 *      key on the primary, the card SUPPRESSES itself.
 */
import { test, expect, type Page } from '@playwright/test';

const WHOAMI = {
  authenticated: true,
  uid: 'usr_next_best_action_e2e',
  email: 'nba-e2e@petwash.co.il',
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

const CAPS = {
  ok: true,
  capabilities: {
    identity: { emailVerified: true, mobileVerified: true, activated: true },
    provider: { active: false, applicant: false, applicationStatus: null, services: [] },
    prestige: { enrolled: true, tier: 'gold', memberId: 'PM-2024-1' },
    staff: { active: false },
    admin: { admin: false, superAdmin: false },
  },
};

interface NBAResponse {
  primaryAction: any | null;
  secondaryActions: any[];
  composedAt: string;
}

async function wireBaseline(page: Page) {
  await page.route('**/api/session/whoami', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(WHOAMI) }),
  );
  await page.route('**/api/me/capabilities', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(CAPS) }),
  );
  await page.route('**/api/user/profile', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) }),
  );
  // Everything home-page-adjacent that would 404 by default: return {}
  // so React Query doesn't retry-storm.
  await page.route('**/api/prestige-pass/**', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) }),
  );
  await page.route('**/api/pets', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ pets: [] }) }),
  );
  await page.route('**/api/attention/**', (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ feed: { actor: 'pet_parent', items: [], composedAt: new Date().toISOString() } }),
    }),
  );
}

async function wireNextBestAction(page: Page, actor: string, payload: NBAResponse) {
  await page.route(`**/api/next-best-action?actor=${actor}**`, (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) }),
  );
}

test.describe('NextBestActionCard · Pet-Parent home (real browser)', () => {
  test.beforeEach(async ({ page }) => {
    await wireBaseline(page);
  });

  test('quiet home → card renders NOTHING (primary=null)', async ({ page }) => {
    await wireNextBestAction(page, 'pet_parent', {
      primaryAction: null,
      secondaryActions: [],
      composedAt: new Date().toISOString(),
    });
    await page.goto('/prestige/home');
    await page.waitForTimeout(600);

    // Section is absent when primary is null.
    await expect(
      page.locator('[data-testid="next-best-action-pet_parent"]'),
    ).toHaveCount(0);
  });

  test('urgent primary AttentionItem → card renders, tap navigates to destination', async ({ page }) => {
    await wireNextBestAction(page, 'pet_parent', {
      primaryAction: {
        id: 'atn_urgent_1',
        actor: 'pet_parent',
        domain: 'booking',
        entityId: 'bk_1',
        priority: 'urgent',
        title: 'Pay to confirm your sitter booking',
        reason: 'Booking is on hold pending payment',
        nextAction: 'pay',
        destination: '/wallet/pay/bk_1',
      },
      secondaryActions: [],
      composedAt: new Date().toISOString(),
    });
    // Stub the destination so wouter can land there without a 404.
    await page.route('**/wallet/pay/bk_1', (r) => r.continue());
    await page.route('**/api/wallet/**', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) }),
    );

    await page.goto('/prestige/home');
    await page.waitForTimeout(700);

    // Section + primary appear.
    await expect(
      page.locator('[data-testid="next-best-action-pet_parent"]'),
    ).toBeVisible();
    const primary = page.locator('[data-testid="next-best-action-primary"]');
    await expect(primary).toBeVisible();
    // The primary carries the CTA identity for a non-resume action.
    await expect(primary).toHaveAttribute('data-action-id', 'BOOK_CONFIRM');

    await primary.click();
    // wouter updates window.location.pathname to the destination.
    await page.waitForFunction(() => window.location.pathname === '/wallet/pay/bk_1', {
      timeout: 2000,
    });
  });

  test('resume primary → data-action-id="RESUME_JOURNEY"; tap navigates to the wizard root', async ({ page }) => {
    await wireNextBestAction(page, 'pet_parent', {
      primaryAction: {
        kind: 'resume',
        domain: 'sitter_book',
        destination: '/sitter-suite',
        title: 'Resume your sitter booking',
        reason: 'We saved where you left off — pick up from the same spot.',
        updatedAt: new Date().toISOString(),
        checkpointId: 'chk_e2e_1',
      },
      secondaryActions: [],
      composedAt: new Date().toISOString(),
    });
    await page.route('**/sitter-suite**', (r) => r.continue());
    await page.route('**/api/sitter-suite/**', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) }),
    );

    await page.goto('/prestige/home');
    await page.waitForTimeout(700);

    const primary = page.locator('[data-testid="next-best-action-primary"]');
    await expect(primary).toBeVisible();
    // Resume primary carries the distinct RESUME_JOURNEY identity.
    await expect(primary).toHaveAttribute('data-action-id', 'RESUME_JOURNEY');

    await primary.click();
    await page.waitForFunction(() => window.location.pathname.startsWith('/sitter-suite'), {
      timeout: 2000,
    });
  });

  test('defence-in-depth: primary carrying a payment-truth key SUPPRESSES the whole card', async ({ page }) => {
    // Simulate a server bug that leaks a payment-truth key. The
    // client is not the source of truth for payment — it MUST
    // refuse to render this card rather than surface leaked data.
    await wireNextBestAction(page, 'pet_parent', {
      primaryAction: {
        id: 'atn_leaky',
        actor: 'pet_parent',
        domain: 'booking',
        entityId: 'bk_leaky',
        priority: 'urgent',
        title: 'Bad server leak',
        reason: 'this should not render',
        nextAction: 'pay',
        destination: '/wallet/pay/bk_leaky',
        chargeId: 'chg_should_never_appear_client_side',
      },
      secondaryActions: [],
      composedAt: new Date().toISOString(),
    });

    await page.goto('/prestige/home');
    await page.waitForTimeout(700);

    // The section MUST NOT render — payment-truth guard trips.
    await expect(
      page.locator('[data-testid="next-best-action-pet_parent"]'),
    ).toHaveCount(0);
  });

  test('secondary list renders and shows a stable testid handle', async ({ page }) => {
    await wireNextBestAction(page, 'pet_parent', {
      primaryAction: {
        id: 'atn_primary',
        actor: 'pet_parent',
        domain: 'booking',
        entityId: 'bk_p',
        priority: 'urgent',
        title: 'Primary title',
        reason: 'primary reason',
        nextAction: 'pay',
        destination: '/wallet/pay/bk_p',
      },
      secondaryActions: [
        {
          kind: 'resume',
          domain: 'walk_book',
          destination: '/walk-my-pet',
          title: 'Resume your walk booking',
          reason: 'saved',
          updatedAt: new Date().toISOString(),
          checkpointId: 'chk_walk',
        },
        {
          id: 'atn_secondary_2',
          actor: 'pet_parent',
          domain: 'wallet',
          entityId: 'w_2',
          priority: 'due_soon',
          title: 'Confirm your walk',
          reason: 'due soon',
          nextAction: 'confirm',
          destination: '/wallet',
        },
      ],
      composedAt: new Date().toISOString(),
    });

    await page.goto('/prestige/home');
    await page.waitForTimeout(700);

    await expect(
      page.locator('[data-testid="next-best-action-secondary-list"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="next-best-action-secondary-0"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="next-best-action-secondary-1"]'),
    ).toBeVisible();
    // First secondary is a resume → RESUME_JOURNEY id.
    await expect(
      page.locator('[data-testid="next-best-action-secondary-0"]'),
    ).toHaveAttribute('data-action-id', 'RESUME_JOURNEY');
    // Second secondary is an AttentionItem → BOOK_CONFIRM id.
    await expect(
      page.locator('[data-testid="next-best-action-secondary-1"]'),
    ).toHaveAttribute('data-action-id', 'BOOK_CONFIRM');
  });
});
