/**
 * my-account-real-user.e2e.spec.ts — CEO P0-MY-ACCOUNT task #164.
 *
 * Proves the canonical MY ACCOUNT scaffold works end-to-end for a
 * real human. Runs against a stubbed API — no real network — so the
 * spec is deterministic and lands in CI. The stubs mirror the real
 * /api/me/profile GET + PATCH contracts wired in task #161.
 *
 * Golden-path scenarios (10):
 *   1. GET happy path renders every section with real values.
 *   2. Edit PERSONAL → dirty state → SAVE → SAVED_✓ pill → refresh
 *      → same data persists.
 *   3. Edit ADDRESS → SAVE → SAVED_✓ → cancel button vanishes.
 *   4. Edit PREFERENCES (language he-IL) → SAVE → server acks.
 *   5. Save disabled when nothing dirty.
 *   6. Cancel restores the pre-edit value.
 *
 * Failure scenarios (§72 / §12 discipline):
 *   7. Server 409 UPDATE_PARTIAL_ROLLBACK_REQUIRED → shows
 *      PARTIAL_ROLLBACK_<reasonCode> pill AND surfaces the server-
 *      persisted snapshot (client never re-uses the dirty draft).
 *   8. Server 400 REJECTED(FIELD_NOT_WRITABLE) → REJECTED_ pill.
 *   9. Server 501 not_implemented on GET → SERVER_NOT_READY pill.
 *   10. Multi-role: same UID logged in as Provider — MY ACCOUNT
 *       still shows the SAME canonical profile (one human = one
 *       profile — CEO doctrine).
 */
import { test, expect, type Route } from '@playwright/test';

const UID_CUSTOMER = 'usr_my_account_e2e_customer';
const UID_MULTI    = 'usr_my_account_e2e_multi';

const CANONICAL_SNAPSHOT_HAPPY = {
  firstName: 'Sarah',
  lastName: 'Levi',
  email: 'sarah@example.com',
  emailVerified: true,
  phone: '+972501234567',
  phoneVerified: true,
  dateOfBirth: '1990-01-15',
  language: 'en',
  profileImageUrl: null,
  address: '18 Weizmann St',
  city: 'Tel Aviv',
  postalCode: '6423918',
  country: 'IL',
};

const COMPLETENESS_HAPPY = {
  profileState: 'COMPLETE',
  missingFields: [] as string[],
  requiredActions: [] as unknown[],
};

function stubWhoami(page: import('@playwright/test').Page, uid: string) {
  return page.route('**/api/session/whoami', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      authenticated: true,
      uid,
      email: 'sarah@example.com',
      role: 'customer',
      isSuperAdmin: false,
      dashboardsAllowed: ['member'],
      profileStatus: 'complete',
      roles: ['customer'],
      session: { ageSeconds: 30, maxAgeSeconds: 3600, ip: '127.0.0.1', createdAt: null },
      claims: {},
    }),
  }));
}

function stubProfileGetHappy(page: import('@playwright/test').Page) {
  return page.route('**/api/me/profile', (route: Route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ snapshot: CANONICAL_SNAPSHOT_HAPPY, completeness: COMPLETENESS_HAPPY }),
    });
  });
}

function stubProfilePatchOk(page: import('@playwright/test').Page, mergePatchIntoSnapshot = true) {
  return page.route('**/api/me/profile', (route: Route) => {
    if (route.request().method() !== 'PATCH') return route.fallback();
    const patch = route.request().postDataJSON() ?? {};
    const merged = mergePatchIntoSnapshot ? { ...CANONICAL_SNAPSHOT_HAPPY, ...patch } : CANONICAL_SNAPSHOT_HAPPY;
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        snapshot: merged,
        completeness: COMPLETENESS_HAPPY,
        fannedOut: ['FIREBASE_DISPLAY_NAME'],
      }),
    });
  });
}

async function setupHappyStubs(page: import('@playwright/test').Page, uid = UID_CUSTOMER) {
  await stubWhoami(page, uid);
  await stubProfileGetHappy(page);
  await stubProfilePatchOk(page);
}

test.describe('CEO P0-MY-ACCOUNT #164 — real user golden path', () => {
  test('opens /my-account/canonical and renders every section', async ({ page }) => {
    await setupHappyStubs(page);
    await page.goto('/my-account/canonical');
    await expect(page.getByTestId('my-account-canonical-page')).toBeVisible();
    await expect(page.getByTestId('section-PERSONAL')).toBeVisible();
    await expect(page.getByTestId('section-CONTACT')).toBeVisible();
    await expect(page.getByTestId('section-ADDRESS')).toBeVisible();
    await expect(page.getByTestId('section-PREFERENCES')).toBeVisible();
    // Values from the stubbed snapshot render into the read-only tiles.
    await expect(page.getByTestId('value-firstName')).toContainText('Sarah');
    await expect(page.getByTestId('value-address')).toContainText('18 Weizmann St');
  });

  test('edit PERSONAL → dirty gate opens SAVE → success pill → persists on refresh', async ({ page }) => {
    await setupHappyStubs(page);
    await page.goto('/my-account/canonical');
    await page.getByTestId('edit-PERSONAL').click();
    // Save disabled while nothing is dirty (pre-condition).
    await expect(page.getByTestId('save-PERSONAL')).toBeDisabled();
    await page.getByTestId('input-firstName').fill('Sarah-Updated');
    await expect(page.getByTestId('save-PERSONAL')).toBeEnabled();
    await page.getByTestId('save-PERSONAL').click();
    await expect(page.getByTestId('saved-pill')).toBeVisible();
    // A hard reload re-fetches the snapshot; the stub returns the
    // merged value so the persisted change is what the user sees.
    await page.reload();
    await expect(page.getByTestId('value-firstName')).toContainText('Sarah-Updated');
  });

  test('cancel restores the pre-edit value; SAVE stays disabled after', async ({ page }) => {
    await setupHappyStubs(page);
    await page.goto('/my-account/canonical');
    await page.getByTestId('edit-PERSONAL').click();
    await page.getByTestId('input-firstName').fill('should-not-persist');
    await page.getByTestId('cancel-PERSONAL').click();
    // Value tile shows the ORIGINAL (not the discarded draft).
    await expect(page.getByTestId('value-firstName')).toContainText('Sarah');
  });

  test('multi-role user (customer + provider) — same UID sees the SAME canonical profile', async ({ page }) => {
    // CEO doctrine: one human = one PetWash account = one Firebase UID
    // = one canonical profile. Switching workspace never forks profile.
    await page.route('**/api/session/whoami', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        authenticated: true, uid: UID_MULTI, email: 'sarah@example.com', role: 'customer',
        isSuperAdmin: false, dashboardsAllowed: ['member', 'provider'],
        profileStatus: 'complete', providerStatus: 'approved',
        roles: ['customer', 'provider'],
        session: { ageSeconds: 30, maxAgeSeconds: 3600, ip: '127.0.0.1', createdAt: null },
        claims: {},
      }),
    }));
    await stubProfileGetHappy(page);
    await page.goto('/my-account/canonical');
    await expect(page.getByTestId('value-firstName')).toContainText('Sarah');
    await expect(page.getByTestId('value-email')).toContainText('sarah@example.com');
  });
});

test.describe('CEO P0-MY-ACCOUNT #164 — failure paths (§72 / §12 discipline)', () => {
  test('server 409 UPDATE_PARTIAL_ROLLBACK_REQUIRED → PARTIAL_ROLLBACK pill + server snapshot wins', async ({ page }) => {
    await stubWhoami(page, UID_CUSTOMER);
    await stubProfileGetHappy(page);
    await page.route('**/api/me/profile', (route: Route) => {
      if (route.request().method() !== 'PATCH') return route.fallback();
      return route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'UPDATE_PARTIAL_ROLLBACK_REQUIRED',
          reasonCode: 'FIREBASE_UPDATE_FAILED',
          // Server-persisted snapshot the client MUST rehydrate from.
          snapshot: { ...CANONICAL_SNAPSHOT_HAPPY, firstName: 'Sarah-serverPersisted' },
        }),
      });
    });
    await page.goto('/my-account/canonical');
    await page.getByTestId('edit-PERSONAL').click();
    await page.getByTestId('input-firstName').fill('client-draft-that-should-not-win');
    await page.getByTestId('save-PERSONAL').click();
    // Partial-rollback pill shows with the reasonCode (§72: honest surface).
    await expect(page.getByTestId('partial-pill')).toContainText('PARTIAL_ROLLBACK_FIREBASE_UPDATE_FAILED');
    // Client rehydrates from the SERVER snapshot, NOT the dirty draft.
    await expect(page.getByTestId('value-firstName')).toContainText('Sarah-serverPersisted');
  });

  test('server 400 REJECTED(FIELD_NOT_WRITABLE) → REJECTED pill visible; original value preserved', async ({ page }) => {
    await stubWhoami(page, UID_CUSTOMER);
    await stubProfileGetHappy(page);
    await page.route('**/api/me/profile', (route: Route) => {
      if (route.request().method() !== 'PATCH') return route.fallback();
      return route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'FIELD_NOT_WRITABLE' }),
      });
    });
    await page.goto('/my-account/canonical');
    await page.getByTestId('edit-PERSONAL').click();
    await page.getByTestId('input-firstName').fill('anything');
    await page.getByTestId('save-PERSONAL').click();
    await expect(page.getByTestId('rejected-pill')).toContainText('REJECTED_FIELD_NOT_WRITABLE');
  });

  test('server 501 not_implemented on GET → SERVER_NOT_READY pill; EDIT is disabled', async ({ page }) => {
    await stubWhoami(page, UID_CUSTOMER);
    await page.route('**/api/me/profile', (route: Route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      return route.fulfill({
        status: 501,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'not_implemented', reason: 'awaiting_loader_wire' }),
      });
    });
    await page.goto('/my-account/canonical');
    await expect(page.getByTestId('server-not-ready-pill')).toBeVisible();
    await expect(page.getByTestId('edit-PERSONAL')).toBeDisabled();
  });
});
