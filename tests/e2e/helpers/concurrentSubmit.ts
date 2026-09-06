/**
 * concurrentSubmit — double-tap and concurrent-request guards.
 *
 * WHY THIS EXISTS
 * ---------------
 * Two distinct bugs hide behind "the button was clicked twice", and a test
 * that only covers one of them gives false confidence:
 *
 *   1. CLIENT double-tap. The button is not disabled while the first submit
 *      is in flight, so an impatient user (or a laggy mobile tap that fires
 *      twice) sends two requests. Fix lives in the component.
 *
 *   2. SERVER non-idempotency. Even with a perfect button, two requests can
 *      arrive concurrently — retry, double-submitted form, two devices, a
 *      replayed webhook. If the handler has no idempotency key or unique
 *      constraint, the user is charged twice / booked twice.
 *
 * This repo has a documented history of exactly (2): prestige double-charge,
 * treasury double-pay, double-payout guards, escrow idempotency, booking
 * double-book races. A client-only guard does NOT close those.
 *
 * So this module exports one helper per layer, and callers should use BOTH
 * on any money- or booking-mutating surface.
 *
 * SAFETY
 * ------
 * `expectConcurrentRequestsIdempotent` fires real requests at whatever origin
 * the page is pointed at. NEVER aim it at production. Point it at a stubbed
 * route or a disposable test account only.
 */
import { expect, type Locator, type Page, type APIResponse } from '@playwright/test';

// ── Layer 1: the client guard ─────────────────────────────────────────────

export interface DoubleTapOptions {
  /** Human label for failure messages, e.g. 'signup submit'. */
  name: string;
  /** The control to double-tap. */
  button: Locator;
  /** Glob matched against request URLs to count in-flight submits. */
  urlPattern: string;
  /** HTTP method that counts as a submit. Default 'POST'. */
  method?: string;
  /** How long the stubbed handler stays in flight (ms). Default 500. */
  latencyMs?: number;
  /** Response the stub returns. Default 200 {ok:true}. */
  respondWith?: { status?: number; body?: unknown };
}

/**
 * Stubs the submit endpoint with an artificial delay, fires two clicks as
 * fast as the event loop allows, and asserts the client never had more than
 * one request in flight.
 *
 * Returns the observed request count so a caller can assert further.
 */
export async function expectNoDoubleTap(
  page: Page,
  opts: DoubleTapOptions,
): Promise<{ requestCount: number; peakConcurrent: number }> {
  const method = (opts.method ?? 'POST').toUpperCase();
  const latency = opts.latencyMs ?? 500;

  let inFlight = 0;
  let peakConcurrent = 0;
  let requestCount = 0;

  await page.route(opts.urlPattern, async (route) => {
    if (route.request().method().toUpperCase() !== method) return route.continue();
    requestCount++;
    inFlight++;
    peakConcurrent = Math.max(peakConcurrent, inFlight);
    await new Promise((r) => setTimeout(r, latency));
    inFlight--;
    return route.fulfill({
      status: opts.respondWith?.status ?? 200,
      contentType: 'application/json',
      body: JSON.stringify(opts.respondWith?.body ?? { ok: true }),
    });
  });

  // Two clicks with no await between them. The second is allowed to reject
  // (Playwright throws if the control became disabled/detached) — that
  // rejection is itself the PASS condition for a well-guarded button.
  await Promise.all([
    opts.button.click(),
    opts.button.click({ timeout: 2000 }).catch(() => undefined),
  ]);

  await page.waitForTimeout(latency + 300);

  expect(
    peakConcurrent,
    `[double-tap:${opts.name}] the button fired ${peakConcurrent} concurrent ` +
      `${method}s to ${opts.urlPattern}. It must be disabled (or the handler ` +
      `single-flighted) while the first submit is in flight.`,
  ).toBeLessThanOrEqual(1);

  return { requestCount, peakConcurrent };
}

/**
 * Asserts the control is actually in a disabled/busy state during flight,
 * rather than merely deduping by luck of timing. Complements the counter
 * assertion above — a component that drops the second click without any
 * visible busy state is a UX defect even when the request count is right.
 */
export async function expectBusyStateWhileInFlight(
  page: Page,
  opts: { name: string; button: Locator; urlPattern: string; method?: string },
): Promise<void> {
  const method = (opts.method ?? 'POST').toUpperCase();
  let release!: () => void;
  const gate = new Promise<void>((r) => { release = r; });

  await page.route(opts.urlPattern, async (route) => {
    if (route.request().method().toUpperCase() !== method) return route.continue();
    await gate; // hold the request open so we can inspect the button
    return route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }),
    });
  });

  await opts.button.click();
  // While held open the control must be non-interactive.
  const disabled = await opts.button.isDisabled().catch(() => false);
  const ariaBusy = await opts.button.getAttribute('aria-busy').catch(() => null);
  release();

  expect(
    disabled || ariaBusy === 'true',
    `[busy-state:${opts.name}] the submit control showed no disabled/aria-busy ` +
      `state while its request was in flight — users get no feedback and will tap again.`,
  ).toBeTruthy();
}

// ── Layer 2: the server guard ─────────────────────────────────────────────

export interface ConcurrentRequestOptions {
  name: string;
  /** Absolute or baseURL-relative path to POST to. */
  path: string;
  /** Body sent by EVERY parallel request — identical, as a real retry is. */
  body: unknown;
  /** How many requests to fire at once. Default 2. */
  parallel?: number;
  /** Extra headers (persona bypass, idempotency key, CSRF...). */
  headers?: Record<string, string>;
  /**
   * Given all responses, return the number that represent a NEW effect
   * (e.g. count 2xx-with-a-fresh-id). Exactly one is expected; the rest
   * should be 409/422/dedup-to-the-same-id.
   */
  countEffects: (responses: APIResponse[], bodies: unknown[]) => Promise<number> | number;
}

/**
 * Fires N identical requests with Promise.all and asserts the server applied
 * the effect EXACTLY ONCE.
 *
 * This is the assertion that catches double-charge / double-book. A passing
 * `expectNoDoubleTap` does not imply this — they are independent layers.
 */
export async function expectConcurrentRequestsIdempotent(
  page: Page,
  opts: ConcurrentRequestOptions,
): Promise<void> {
  const n = opts.parallel ?? 2;

  const responses = await Promise.all(
    Array.from({ length: n }, () =>
      page.request.post(opts.path, {
        data: opts.body as never,
        headers: opts.headers,
        failOnStatusCode: false,
      }),
    ),
  );

  const bodies = await Promise.all(
    responses.map(async (r) => {
      try { return await r.json(); } catch { return null; }
    }),
  );

  const effects = await opts.countEffects(responses, bodies);

  expect(
    effects,
    `[idempotency:${opts.name}] ${n} identical concurrent POSTs to ${opts.path} ` +
      `produced ${effects} distinct effects; exactly 1 is required. Statuses: ` +
      `[${responses.map((r) => r.status()).join(', ')}]. Without a unique ` +
      `constraint or idempotency key this is a double-charge / double-book.`,
  ).toBe(1);
}
