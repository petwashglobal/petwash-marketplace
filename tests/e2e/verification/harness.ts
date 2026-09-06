/**
 * Shared harness for the verification browser journeys.
 *
 * Every API is intercepted in-page, so these run against the built SPA with no
 * backend — the same approach as the existing journey specs. What is NOT faked
 * is the part under test: a real browser, real focus and keyboard, real paste,
 * real RTL text shaping, real navigation and reload.
 */
import type { Page, Route } from '@playwright/test';

/**
 * A Firebase config shaped like the real one.
 *
 * Needed because index.html fetches /api/config/firebase before React boots.
 * A blanket `{}` mock leaves apiKey undefined, Firebase init throws, and the
 * app renders its boot-failure panel instead of the page — which looks exactly
 * like a broken app and is really a broken stub.
 *
 * The values are deliberately non-secret placeholders: nothing here signs in.
 */
export const FAKE_FIREBASE_CONFIG = {
  apiKey: 'test-api-key-not-a-real-key',
  authDomain: 'petwash-e2e.firebaseapp.com',
  projectId: 'petwash-e2e',
  storageBucket: 'petwash-e2e.appspot.com',
  messagingSenderId: '000000000000',
  appId: '1:000000000000:web:0000000000000000000000',
};

export interface ChallengeStub {
  challengeId: string;
  purpose: string;
  channel: string;
  maskedDestination: string;
  status: string;
  expiresAt: string;
  resendAvailableAt: string;
  attempts: number;
  maxAttempts: number;
}

export function makeChallenge(over: Partial<ChallengeStub> = {}): ChallengeStub {
  return {
    challengeId: 'ch_e2e_000000000000000000',
    purpose: 'signup',
    channel: 'email',
    maskedDestination: 'p••••••h@example.com',
    status: 'pending',
    expiresAt: new Date(Date.now() + 300_000).toISOString(),
    resendAvailableAt: new Date(Date.now() + 60_000).toISOString(),
    attempts: 0,
    maxAttempts: 5,
    ...over,
  };
}

export interface VerifyServer {
  /** Everything the page asked for, in order — so a spec can assert what was NOT called. */
  calls: string[];
  startBody: () => any;
  setChallenge: (c: ChallengeStub) => void;
  /** Next /verify outcome. */
  setVerifyResult: (r: { status: number; body: any }) => void;
  setResendResult: (r: { status: number; body: any }) => void;
}

const json = (route: Route, status: number, body: unknown) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

/** Install the whole stubbed backend. Call BEFORE page.goto(). */
export async function installVerificationServer(page: Page): Promise<VerifyServer> {
  const state: {
    calls: string[];
    startBody: any;
    challenge: ChallengeStub;
    verify: { status: number; body: any } | null;
    resend: { status: number; body: any } | null;
  } = {
    calls: [],
    startBody: null,
    challenge: makeChallenge(),
    verify: null,
    resend: null,
  };

  /**
   * ORDER MATTERS, and the wrong way round is silent.
   *
   * Playwright matches routes in REVERSE registration order, so the catch-all
   * has to be registered FIRST or it wins over every specific handler and
   * every call returns `{}`. That reads as "the flow is broken" rather than
   * "the stub is broken", which is exactly how it presented the first time.
   */
  await page.route('**/api/**', (r) => json(r, 200, {}));

  await page.route('**/api/config/firebase', (r) => json(r, 200, FAKE_FIREBASE_CONFIG));

  await page.route('**/api/auth/email/start', async (r) => {
    state.calls.push('start');
    try { state.startBody = JSON.parse(r.request().postData() || '{}'); } catch { state.startBody = null; }
    await json(r, 200, { ok: true, challenge: state.challenge, challengeId: state.challenge.challengeId });
  });

  await page.route('**/api/auth/email/verify', async (r) => {
    state.calls.push('verify');
    const out = state.verify ?? {
      status: 200,
      body: { ok: true, verified: true, sessionToken: 'stub-session-token', action: {} },
    };
    await json(r, out.status, out.body);
  });

  await page.route('**/api/auth/email/resend', async (r) => {
    state.calls.push('resend');
    const out = state.resend ?? { status: 200, body: { ok: true, challenge: state.challenge } };
    await json(r, out.status, out.body);
  });

  return {
    calls: state.calls,
    startBody: () => state.startBody,
    setChallenge: (c) => { state.challenge = c; },
    setVerifyResult: (v) => { state.verify = v; },
    setResendResult: (v) => { state.resend = v; },
  };
}

/** Mount the real VerificationFlow and wait for it. */
export async function gotoHarness(
  page: Page,
  opts: { lang?: 'en' | 'he'; purpose?: string; email?: string; autoSubmitBlocked?: boolean } = {},
) {
  const q = new URLSearchParams();
  q.set('lang', opts.lang ?? 'en');
  if (opts.purpose) q.set('purpose', opts.purpose);
  if (opts.email) q.set('email', opts.email);
  await page.goto(`/?${q.toString()}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="verification-flow"]', { timeout: 15_000 });
  await page.waitForSelector('[data-testid="verification-code-input"]', { timeout: 15_000 });
}
