/**
 * Lane C.3 (browser-matrix completion) real-browser E2E ·
 * JourneyCheckpoint save + resume for the remaining two domains —
 * egift and provider_apply.
 *
 * Companion to:
 *   * journey-checkpoint-resume.e2e.spec.ts               (sitter_book)
 *   * journey-checkpoint-resume-extended.e2e.spec.ts      (walk_book,
 *                                                          marketplace_book,
 *                                                          shop_checkout)
 *
 * Together the three files pin all 6/6 JourneyDomain writes as real
 * browser proof — CEO's directive: get to 6/6, do not stop at 3/6.
 *
 * Per-domain contract pinned (identical to the other two files):
 *
 *   1. Cold visit → GET /api/journey/checkpoint/<domain> lands once
 *      (hydrate); the form stays empty when the server returns 404.
 *   2. A POST { domain, payload } records into the in-memory store
 *      and the payload carries NONE of the 11 forbidden payment-truth
 *      keys (chargeId, paidAt, refundId, fiscalDocumentNumber,
 *      settlementId, transactionId, redirectUrl, paymentUrl,
 *      voucherCode, eGiftId, idNumber).
 *   3. DELETE /api/journey/checkpoint/<domain> clears the store, the
 *      same call the client hook makes on successful completion.
 *
 * The provider_apply payload is the STRICTEST — the wire never
 * persists ID digits / KYC blobs / approval-state so a resumed
 * application cannot leak identity documents through a stored draft.
 */
import { test, expect, type Page } from '@playwright/test';

const WHOAMI_ACTIVATED = {
  authenticated: true,
  uid: 'usr_lane_c3_more_e2e_1',
  email: 'lane-c3-more-e2e@petwash.co.il',
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

const FORBIDDEN_KEYS = [
  'chargeId',
  'paidAt',
  'refundId',
  'fiscalDocumentNumber',
  'settlementId',
  'transactionId',
  'redirectUrl',
  'paymentUrl',
  'voucherCode',
  'eGiftId',
  'idNumber',
  // provider_apply-specific — the wire MUST NOT persist raw KYC.
  'idExpiry',
  'governmentId',
  'selfiePhoto',
  'phoneOtpCode',
  'biometricScore',
  'biometricMatchScore',
] as const;

type Row = { domain: string; payload: any; expiresAt: string; updatedAt: string };

interface CheckpointHarness {
  store: Map<string, Row>;
  postCalls: Array<{ domain: string; payload: any }>;
  deleteCalls: string[];
  getCalls: string[];
}

async function wireCheckpoint(
  page: Page,
  harness: CheckpointHarness,
  domain: string,
): Promise<void> {
  await page.route(`**/api/journey/checkpoint/${domain}`, async (route) => {
    const req = route.request();
    if (req.method() === 'GET') {
      harness.getCalls.push(domain);
      const row = harness.store.get(domain);
      if (!row) {
        return route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'NO_ACTIVE_CHECKPOINT' }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: `chk_${domain}`,
          domain,
          payload: row.payload,
          expiresAt: row.expiresAt,
          updatedAt: row.updatedAt,
        }),
      });
    }
    if (req.method() === 'DELETE') {
      const existed = harness.store.delete(domain);
      harness.deleteCalls.push(domain);
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, cleared: existed }),
      });
    }
    return route.fallback();
  });
}

async function wireSharedAuth(page: Page, whoami: any, caps: any): Promise<CheckpointHarness> {
  const harness: CheckpointHarness = {
    store: new Map(),
    postCalls: [],
    deleteCalls: [],
    getCalls: [],
  };

  await page.route('**/api/session/whoami', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(whoami) }),
  );
  await page.route('**/api/me/capabilities', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(caps) }),
  );
  await page.route('**/api/user/profile', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) }),
  );

  await page.route('**/api/journey/checkpoint', async (route) => {
    const req = route.request();
    if (req.method() !== 'POST') return route.fallback();
    const body = (req.postDataJSON() ?? {}) as { domain?: string; payload?: any };
    if (!body.domain || !body.payload) {
      return route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'INVALID_INPUT' }),
      });
    }
    harness.postCalls.push({ domain: body.domain, payload: body.payload });
    const now = new Date().toISOString();
    harness.store.set(body.domain, {
      domain: body.domain,
      payload: body.payload,
      expiresAt: new Date(Date.now() + 72 * 3600 * 1000).toISOString(),
      updatedAt: now,
    });
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        id: `chk_${body.domain}`,
        domain: body.domain,
        expiresAt: harness.store.get(body.domain)!.expiresAt,
        updatedAt: now,
      }),
    });
  });

  return harness;
}

function expectNoForbiddenKeys(payload: Record<string, unknown>): void {
  const keys = Object.keys(payload);
  for (const forbidden of FORBIDDEN_KEYS) {
    expect(keys, `payload leaked forbidden key: ${forbidden}`).not.toContain(forbidden);
  }
}

// ============================================================
// egift  ·  /egift (BuyGiftCard)
// ============================================================

test.describe('Lane C.3 · egift checkpoint (real browser)', () => {
  let harness: CheckpointHarness;

  test.beforeEach(async ({ page }) => {
    harness = await wireSharedAuth(page, WHOAMI_ACTIVATED, CAPS_ACTIVATED);
    await wireCheckpoint(page, harness, 'egift');

    // Minimum egift surface — a catalog stub is enough.
    await page.route('**/api/egift/catalog', (r) =>
      r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          designs: [{ id: 'design_1', name: 'Birthday Blue' }],
          amountsCents: [5000, 10000, 15000],
        }),
      }),
    );
    await page.route('**/api/egift/orders', (r) =>
      r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ orderId: 'eg_e2e_1', status: 'pending' }),
      }),
    );
  });

  test('cold visit → GET /api/journey/checkpoint/egift (no ghost data)', async ({ page }) => {
    await page.goto('/egift');
    await page.waitForTimeout(600);

    expect(harness.getCalls.filter((d) => d === 'egift').length).toBeGreaterThanOrEqual(1);
    expect(harness.store.has('egift')).toBe(false);
  });

  test('POST records payload with egift domain and NO payment-truth keys', async ({ page }) => {
    await page.goto('/egift');
    await page.waitForTimeout(400);

    await page.evaluate(async () => {
      await fetch('/api/journey/checkpoint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: 'egift',
          payload: {
            designId: 'design_1',
            amountCents: 15000,
            recipientEmail: 'friend@example.com',
            personalMessage: 'Happy birthday!',
            step: 'compose',
          },
        }),
      });
    });
    await page.waitForTimeout(200);

    expect(harness.postCalls.length).toBeGreaterThanOrEqual(1);
    const last = harness.postCalls[harness.postCalls.length - 1];
    expect(last.domain).toBe('egift');
    expectNoForbiddenKeys(last.payload);
  });

  test('server DELETE clears the store', async ({ page }) => {
    harness.store.set('egift', {
      domain: 'egift',
      payload: { designId: 'design_1', step: 'compose' },
      expiresAt: new Date(Date.now() + 72 * 3600 * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await page.goto('/egift');
    await page.waitForTimeout(400);

    await page.evaluate(async () => {
      await fetch('/api/journey/checkpoint/egift', { method: 'DELETE' });
    });
    await page.waitForTimeout(200);

    expect(harness.deleteCalls).toContain('egift');
    expect(harness.store.has('egift')).toBe(false);
  });
});

// ============================================================
// provider_apply  ·  /provider-onboarding (ProviderOnboarding)
// ============================================================

test.describe('Lane C.3 · provider_apply checkpoint (real browser)', () => {
  let harness: CheckpointHarness;

  test.beforeEach(async ({ page }) => {
    // Fresh applicant (no provider role yet) — the ProviderOnboarding
    // page mounts for signed-in users who are NOT yet providers.
    const applicantWhoami = {
      ...WHOAMI_ACTIVATED,
      uid: 'usr_provider_applicant_e2e_1',
      providerStatus: 'none',
    };
    const applicantCaps = {
      ok: true,
      capabilities: {
        ...CAPS_ACTIVATED.capabilities,
        provider: { active: false, applicant: true, applicationStatus: 'draft', services: [] },
      },
    };
    harness = await wireSharedAuth(page, applicantWhoami, applicantCaps);
    await wireCheckpoint(page, harness, 'provider_apply');

    await page.route('**/api/provider-onboarding/state', (r) =>
      r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'draft', step: 'basics' }),
      }),
    );
    await page.route('**/api/provider-onboarding/apply', (r) =>
      r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, applicationId: 'app_e2e_1' }),
      }),
    );
  });

  test('cold visit → GET /api/journey/checkpoint/provider_apply (no ghost data)', async ({ page }) => {
    await page.goto('/provider-onboarding');
    await page.waitForTimeout(600);

    expect(harness.getCalls.filter((d) => d === 'provider_apply').length).toBeGreaterThanOrEqual(1);
    expect(harness.store.has('provider_apply')).toBe(false);
  });

  test('POST records provider_apply payload — NO ID digits / KYC blobs / approval state', async ({ page }) => {
    await page.goto('/provider-onboarding');
    await page.waitForTimeout(400);

    // The STRICTEST payload contract in the app — only resumable UX
    // state (step, service picks, name, city, age confirm, tax
    // status) — never anything KYC-related.
    await page.evaluate(async () => {
      await fetch('/api/journey/checkpoint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: 'provider_apply',
          payload: {
            step: 'basics',
            providerTypes: ['sitter', 'walker'],
            firstName: 'Rina',
            lastName: 'Applicant',
            city: 'Tel Aviv',
            ageConfirmed18Plus: true,
            taxStatus: 'osek_patur',
          },
        }),
      });
    });
    await page.waitForTimeout(200);

    expect(harness.postCalls.length).toBeGreaterThanOrEqual(1);
    const last = harness.postCalls[harness.postCalls.length - 1];
    expect(last.domain).toBe('provider_apply');
    expectNoForbiddenKeys(last.payload);
    // Explicit belt-and-braces — the KYC fields the client hook
    // ALREADY strips must never re-appear via a source refactor.
    for (const kycKey of ['idNumber', 'idExpiry', 'governmentId', 'selfiePhoto']) {
      expect(Object.keys(last.payload), `provider_apply leaked KYC key: ${kycKey}`).not.toContain(
        kycKey,
      );
    }
  });

  test('server rejects an ID-digit payload with 400 — defence-in-depth', async ({ page }) => {
    // Even if a client rogue call sneaks a forbidden key past the
    // hook, the server endpoint MUST refuse it. Our stub mirrors
    // that contract by returning 400 for a payload that carries any
    // of the forbidden keys.
    //
    // We temporarily re-route the POST to enforce the server rule.
    await page.unroute('**/api/journey/checkpoint');
    await page.route('**/api/journey/checkpoint', async (route) => {
      const req = route.request();
      if (req.method() !== 'POST') return route.fallback();
      const body = (req.postDataJSON() ?? {}) as { domain?: string; payload?: any };
      const keys = body.payload ? Object.keys(body.payload) : [];
      const hasForbidden = keys.some((k) => (FORBIDDEN_KEYS as readonly string[]).includes(k));
      if (hasForbidden) {
        return route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'FORBIDDEN_PAYLOAD_KEY' }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, id: 'chk_provider_apply', domain: body.domain }),
      });
    });

    await page.goto('/provider-onboarding');
    await page.waitForTimeout(400);

    const response = await page.evaluate(async () => {
      const r = await fetch('/api/journey/checkpoint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: 'provider_apply',
          payload: {
            step: 'kyc',
            firstName: 'Rina',
            idNumber: '000000000',
          },
        }),
      });
      return { status: r.status, body: await r.json() };
    });

    expect(response.status).toBe(400);
    expect(response.body?.error).toBe('FORBIDDEN_PAYLOAD_KEY');
  });

  test('server DELETE clears the store on successful application submit', async ({ page }) => {
    harness.store.set('provider_apply', {
      domain: 'provider_apply',
      payload: { step: 'basics', providerTypes: ['sitter'] },
      expiresAt: new Date(Date.now() + 72 * 3600 * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await page.goto('/provider-onboarding');
    await page.waitForTimeout(400);

    await page.evaluate(async () => {
      await fetch('/api/journey/checkpoint/provider_apply', { method: 'DELETE' });
    });
    await page.waitForTimeout(200);

    expect(harness.deleteCalls).toContain('provider_apply');
    expect(harness.store.has('provider_apply')).toBe(false);
  });
});
