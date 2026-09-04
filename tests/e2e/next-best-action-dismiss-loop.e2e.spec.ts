/**
 * Real-browser E2E · complete Phase 6 dismiss loop
 * (post-release 2026-09-04).
 *
 * Proves the WHOLE feedback loop end-to-end in real Chromium:
 *
 *   1. Server returns primary A → card renders A.
 *   2. User taps the dismiss X on primary A.
 *   3. Client POSTs { actionKey: attn:A, verdict: not_interested }
 *      to /api/next-best-action/feedback.
 *   4. Query cache invalidates; server responds with primary B
 *      (simulating the composer's suppression step from PR #2220).
 *   5. Card now renders B — home never nagged the user about A.
 *
 * Companion to:
 *   * next-best-action-home.e2e.spec.ts (basic render + tap wire)
 *   * journey-checkpoint-resume-*.e2e.spec.ts (JourneyCheckpoint 6/6)
 *
 * No DB, no Firebase Admin — every endpoint stubbed.
 */
import { test, expect, type Page, type Request } from '@playwright/test';

const WHOAMI = {
  authenticated: true,
  uid: 'usr_nba_dismiss_loop_e2e',
  email: 'nba-dismiss-loop@petwash.co.il',
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

interface FeedbackPost {
  actionKey: string;
  verdict: string;
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

function makeAttentionItem(id: string, title: string, priority: 'urgent' | 'due_soon' = 'urgent') {
  return {
    id,
    actor: 'pet_parent' as const,
    domain: 'booking' as const,
    entityId: id,
    priority,
    title,
    reason: `reason-${id}`,
    nextAction: 'pay' as const,
    destination: `/wallet/pay/${id}`,
  };
}

test.describe('Phase 6 dismiss loop · real-browser end-to-end', () => {
  test('dismiss X → POST feedback → cache invalidates → next primary takes over', async ({ page }) => {
    await wireBaseline(page);

    // Sequence of NBA responses. Index 0 for the cold visit; the
    // dismiss-triggered invalidation lands us on index 1.
    const responses = [
      {
        primaryAction: makeAttentionItem('atn-first', 'First primary — will be dismissed'),
        secondaryActions: [],
        composedAt: new Date().toISOString(),
      },
      {
        primaryAction: makeAttentionItem('atn-second', 'Second primary — after suppression'),
        secondaryActions: [],
        composedAt: new Date(Date.now() + 1000).toISOString(),
      },
    ];
    let responseIdx = 0;
    let nbaFetchCount = 0;

    await page.route('**/api/next-best-action?**', (route) => {
      nbaFetchCount += 1;
      // First fetch → responses[0]; every subsequent fetch → responses[1].
      const body = responses[Math.min(responseIdx, responses.length - 1)];
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(body),
      });
    });

    // Capture the feedback POST.
    const feedbackPosts: FeedbackPost[] = [];
    await page.route('**/api/next-best-action/feedback', (route) => {
      const req = route.request();
      if (req.method() !== 'POST') return route.fallback();
      const body = req.postDataJSON() ?? {};
      feedbackPosts.push({
        actionKey: String(body.actionKey ?? ''),
        verdict: String(body.verdict ?? ''),
      });
      // Simulate the server's suppression: after this POST lands, the
      // composer would skip attn-first on the next read.
      responseIdx = 1;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, id: 'fb_e2e_1' }),
      });
    });

    await page.goto('/prestige/home');
    await page.waitForTimeout(700);

    // First primary is visible.
    const primary = page.locator('[data-testid="next-best-action-primary"]');
    await expect(primary).toBeVisible();
    await expect(primary).toContainText('First primary');

    // Tap the dismiss X (positioned inside the card wrapper).
    const dismiss = page.locator('[data-testid="next-best-action-dismiss"]');
    await expect(dismiss).toBeVisible();
    await dismiss.click();

    // Feedback POST landed with the expected shape.
    await page.waitForTimeout(500);
    expect(feedbackPosts.length).toBeGreaterThanOrEqual(1);
    const last = feedbackPosts[feedbackPosts.length - 1];
    expect(last.actionKey).toBe('attn:atn-first');
    expect(last.verdict).toBe('not_interested');

    // Wait for the cache invalidation to refetch and the new primary
    // to render. TanStack Query fires the refetch immediately on
    // invalidateQueries — a short poll covers the render.
    await expect(primary).toContainText('Second primary', { timeout: 5000 });

    // The old primary never resurfaces.
    await expect(primary).not.toContainText('First primary');

    // Sanity: the client actually invalidated the cache (nbaFetchCount
    // went up beyond the initial cold-mount fetch).
    expect(nbaFetchCount).toBeGreaterThanOrEqual(2);
  });

  test('dismiss X does NOT also fire the primary tap (no rogue navigation)', async ({ page }) => {
    await wireBaseline(page);
    await page.route('**/api/next-best-action?**', (r) =>
      r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          primaryAction: makeAttentionItem('atn-guarded', 'Will not navigate on dismiss'),
          secondaryActions: [],
          composedAt: new Date().toISOString(),
        }),
      }),
    );
    let feedbackCount = 0;
    await page.route('**/api/next-best-action/feedback', (r) => {
      feedbackCount += 1;
      return r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, id: 'fb_e2e_2' }),
      });
    });

    await page.goto('/prestige/home');
    await page.waitForTimeout(600);

    const startPath = new URL(page.url()).pathname;

    // Tap dismiss — must NOT navigate to the primary's destination.
    await page.locator('[data-testid="next-best-action-dismiss"]').click();
    await page.waitForTimeout(400);

    const endPath = new URL(page.url()).pathname;
    expect(endPath).toBe(startPath);
    // The primary's destination was /wallet/pay/atn-guarded — assert
    // we did NOT land there.
    expect(endPath).not.toContain('/wallet/pay/atn-guarded');
    // The dismiss verdict fired, the primary "act" verdict did NOT.
    expect(feedbackCount).toBe(1);
  });
});
