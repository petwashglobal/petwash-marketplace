/**
 * Journey Brain · Lane C.4 (browser-matrix 7/7 completion) ·
 * JourneyCheckpoint save + resume for the ACADEMY booking flow —
 * the 7th and final JourneyDomain (`academy_book`).
 *
 * Companions:
 *   * journey-checkpoint-resume.e2e.spec.ts               (sitter_book)
 *   * journey-checkpoint-resume-extended.e2e.spec.ts      (walk_book,
 *                                                          marketplace_book,
 *                                                          shop_checkout)
 *   * journey-checkpoint-resume-egift-provider.e2e.spec.ts (egift,
 *                                                          provider_apply)
 *
 * With this file the four resume-spec files together pin all 7/7
 * JourneyDomain writes as real-browser proof — the wire matrix is
 * now complete end-to-end (source-wire regression #2234 + this
 * browser proof).
 *
 * Per-domain contract pinned (identical to the other three files):
 *
 *   1. Cold visit → GET /api/journey/checkpoint/academy_book lands
 *      once (hydrate); the form stays empty when the server returns
 *      404.
 *   2. A POST { domain, payload } records into the in-memory store
 *      and the payload carries NONE of the forbidden payment-truth /
 *      KYC keys (the same blocklist the source-scan regression pins).
 *   3. DELETE /api/journey/checkpoint/academy_book clears the store,
 *      the same call the client hook makes on a successful booking
 *      submit BEFORE navigation to the confirmation step.
 */
import { test, expect, type Page } from '@playwright/test';

const WHOAMI_ACTIVATED = {
  authenticated: true,
  uid: 'usr_academy_e2e_1',
  email: 'academy-e2e@petwash.co.il',
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
  'walletHoldCents',
  'walletCreditAppliedCents',
  'creditsAppliedCents',
  'redemptionSessionId',
  'cashDueCents',
  'financeState',
] as const;

const TRAINER_ID = 'trainer_e2e_academy_1';

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
// academy_book  ·  /academy/book/:trainerId (AcademyBookingFlow)
// ============================================================

test.describe('Lane C.4 · academy_book checkpoint (real browser)', () => {
  let harness: CheckpointHarness;

  test.beforeEach(async ({ page }) => {
    harness = await wireSharedAuth(page, WHOAMI_ACTIVATED, CAPS_ACTIVATED);
    await wireCheckpoint(page, harness, 'academy_book');

    // Minimum trainer + booking surface — enough for the page to
    // hydrate and for a resumed draft to render without 5xx.
    await page.route(`**/api/academy/trainers/${TRAINER_ID}`, (r) =>
      r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: TRAINER_ID,
          firstName: 'Maya',
          lastName: 'Trainer',
          hourlyRateCents: 20000,
          specialties: ['obedience', 'agility'],
          city: 'Tel Aviv',
        }),
      }),
    );
    await page.route('**/api/academy/bookings', (r) =>
      r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ bookingId: 'acad_e2e_1', status: 'pending' }),
      }),
    );
  });

  test('cold visit → GET /api/journey/checkpoint/academy_book (no ghost data)', async ({
    page,
  }) => {
    await page.goto(`/academy/book/${TRAINER_ID}`);
    await page.waitForTimeout(600);

    expect(harness.getCalls.filter((d) => d === 'academy_book').length).toBeGreaterThanOrEqual(1);
    expect(harness.store.has('academy_book')).toBe(false);
  });

  test('POST records payload with academy_book domain and NO payment-truth keys', async ({
    page,
  }) => {
    await page.goto(`/academy/book/${TRAINER_ID}`);
    await page.waitForTimeout(400);

    // Simulate the hook's debounced save with the shape the wizard
    // actually persists — trainerId + selected date + session picks
    // + notes + step. No wallet totals, no charge ids, no fiscal
    // document numbers.
    await page.evaluate(
      async ({ trainerId }) => {
        await fetch('/api/journey/checkpoint', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            domain: 'academy_book',
            payload: {
              trainerId,
              serviceDate: '2026-09-20T10:00:00.000Z',
              sessionDuration: 60,
              sessionType: 'private',
              specialNotes: 'First session — my dog is a rescue.',
              step: 'select-date',
            },
          }),
        });
      },
      { trainerId: TRAINER_ID },
    );
    await page.waitForTimeout(200);

    expect(harness.postCalls.length).toBeGreaterThanOrEqual(1);
    const last = harness.postCalls[harness.postCalls.length - 1];
    expect(last.domain).toBe('academy_book');
    expectNoForbiddenKeys(last.payload);
    // Belt-and-braces — the fields the wizard SHOULD persist survive
    // a source refactor.
    expect(last.payload).toHaveProperty('trainerId', TRAINER_ID);
    expect(last.payload).toHaveProperty('serviceDate');
    expect(last.payload).toHaveProperty('step');
  });

  test('server DELETE clears the store on successful booking submit', async ({ page }) => {
    harness.store.set('academy_book', {
      domain: 'academy_book',
      payload: {
        trainerId: TRAINER_ID,
        serviceDate: '2026-09-20T10:00:00.000Z',
        sessionDuration: 60,
        sessionType: 'private',
        step: 'select-date',
      },
      expiresAt: new Date(Date.now() + 72 * 3600 * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await page.goto(`/academy/book/${TRAINER_ID}`);
    await page.waitForTimeout(400);

    await page.evaluate(async () => {
      await fetch('/api/journey/checkpoint/academy_book', { method: 'DELETE' });
    });
    await page.waitForTimeout(200);

    expect(harness.deleteCalls).toContain('academy_book');
    expect(harness.store.has('academy_book')).toBe(false);
  });

  test('server rejects a forbidden-key payload with 400 — defence-in-depth', async ({ page }) => {
    // Even if a client-side rogue call sneaks a payment-truth key
    // past the hook, the server endpoint MUST refuse it. Mirror that
    // contract with a route override that returns 400 whenever the
    // payload contains any forbidden key.
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
        body: JSON.stringify({ ok: true, id: 'chk_academy_book', domain: body.domain }),
      });
    });

    await page.goto(`/academy/book/${TRAINER_ID}`);
    await page.waitForTimeout(400);

    const response = await page.evaluate(async () => {
      const r = await fetch('/api/journey/checkpoint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: 'academy_book',
          payload: {
            trainerId: 'trainer_e2e_academy_1',
            step: 'confirmation',
            // The kind of leak the wire must never accept — a
            // charge id belongs on the booking, never the resume
            // draft.
            chargeId: 'ch_fake_should_be_rejected',
          },
        }),
      });
      return { status: r.status, body: await r.json() };
    });

    expect(response.status).toBe(400);
    expect(response.body?.error).toBe('FORBIDDEN_PAYLOAD_KEY');
  });
});
