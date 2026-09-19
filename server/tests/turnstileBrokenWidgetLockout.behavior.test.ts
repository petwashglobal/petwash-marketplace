import { describe, it, expect, beforeEach } from 'vitest';
import {
  recordAttempt,
  shouldBypass,
  isDegraded,
  checkTurnstileWithBreaker,
  __resetBreakerForTests,
} from '../lib/turnstileBreaker';

/**
 * 2026-09-19, production: Cloudflare answered error 600010 for the site key in
 * the deployed bundle — it does not allow petwash.co.il. No browser could mint
 * a token, so turnstileGuard refused every caller with 400
 * TURNSTILE_TOKEN_REQUIRED. Verified live on two independent surfaces:
 * POST /api/contact and POST /api/auth/sms/start. Signup by phone, signup by
 * email, gift cards, Privilege signup, onboarding verification and the contact
 * form were all shut to every human.
 */
describe('a broken bot-check widget must not lock every human out', () => {
  beforeEach(() => {
    __resetBreakerForTests();
    delete process.env.TURNSTILE_BREAKER;
  });

  it('one caller with no token is still refused — that is a bot, not an outage', () => {
    recordAttempt('missing');
    expect(shouldBypass()).toBe(false);
  });

  it('a couple of token-less attempts are not enough evidence', () => {
    for (let i = 0; i < 4; i++) recordAttempt('missing');
    expect(shouldBypass()).toBe(false);
  });

  it('a widget that has NEVER minted a token opens the breaker after a handful of misses', () => {
    for (let i = 0; i < 5; i++) recordAttempt('missing');
    expect(shouldBypass()).toBe(true);
    expect(isDegraded()).toBe(true);
  });

  it('works at this site\'s real traffic — no per-hour quota to reach', () => {
    // Production sees roughly ONE signup a week. An earlier draft of the
    // breaker required 10 attempts inside a 15-minute window, which this site
    // can never reach: it would have stayed shut forever and unblocked nobody.
    // Five attempts spread across days must still open it.
    for (let i = 0; i < 5; i++) recordAttempt('missing'); // days apart, in effect
    expect(shouldBypass()).toBe(true);
  });

  it('once the widget HAS worked, it demands far stronger evidence', () => {
    recordAttempt('pass'); // the widget is known good in this process
    for (let i = 0; i < 24; i++) recordAttempt('missing');
    expect(shouldBypass()).toBe(false); // 24 misses is not enough after a pass
    recordAttempt('missing');
    expect(shouldBypass()).toBe(true);  // 25 is
  });

  it('it never opens while real users are passing the check', () => {
    for (let i = 0; i < 4; i++) recordAttempt('missing');
    recordAttempt('pass'); // one human got through — the widget works
    for (let i = 0; i < 4; i++) recordAttempt('missing');
    expect(shouldBypass()).toBe(false);
  });

  it('the first valid token closes it again with no deploy', () => {
    for (let i = 0; i < 5; i++) recordAttempt('missing');
    expect(shouldBypass()).toBe(true);
    recordAttempt('pass');
    expect(isDegraded()).toBe(false);
  });

  it('forged-but-invalid tokens alone do not open it — only empty ones do', () => {
    // A bot that posts junk tokens is a bot. A broken widget posts NOTHING.
    for (let i = 0; i < 40; i++) recordAttempt('invalid');
    expect(shouldBypass()).toBe(false);
  });

  it('TURNSTILE_BREAKER=off disables it entirely', () => {
    process.env.TURNSTILE_BREAKER = 'off';
    for (let i = 0; i < 40; i++) recordAttempt('missing');
    expect(shouldBypass()).toBe(false);
  });
});

/**
 * The guest gift-card purchase calls verifyTurnstileToken directly instead of
 * going through turnstileGuard, so it needed the same protection. Confirmed
 * against production on 2026-09-19:
 *   POST /api/egift/guest/start with turnstileToken:"" -> 403 BOT_CHECK
 * i.e. the one thing a customer can buy today without a provider refused
 * every buyer.
 */
describe('the guest gift-card purchase survives a broken widget too', () => {
  beforeEach(() => {
    __resetBreakerForTests();
    delete process.env.TURNSTILE_BREAKER;
  });

  const alwaysInvalid = async () => ({ valid: false, reason: 'invalid-input-response' });
  const alwaysValid = async () => ({ valid: true });

  it('refuses a token-less buyer while the widget is believed healthy', async () => {
    const r = await checkTurnstileWithBreaker('', '1.2.3.4', alwaysInvalid);
    expect(r.ok).toBe(false);
    expect(r.degraded).toBe(false);
  });

  it('takes the purchase, flagged, once the widget is proven broken', async () => {
    for (let i = 0; i < 10; i++) recordAttempt('missing');
    const r = await checkTurnstileWithBreaker('', '1.2.3.4', alwaysInvalid);
    expect(r.ok).toBe(true);
    expect(r.degraded).toBe(true);
  });

  it('a real token still wins outright and closes the breaker', async () => {
    for (let i = 0; i < 10; i++) recordAttempt('missing');
    expect(isDegraded()).toBe(false); // not evaluated yet
    const r = await checkTurnstileWithBreaker('a-real-token', '1.2.3.4', alwaysValid);
    expect(r.ok).toBe(true);
    expect(r.degraded).toBe(false);
    expect(isDegraded()).toBe(false);
  });

  it("keeps 'not_configured' meaning the server half is absent", async () => {
    const r = await checkTurnstileWithBreaker('tok', '1.2.3.4', async () => ({ valid: false, reason: 'not_configured' }));
    expect(r.ok).toBe(true);
    expect(r.degraded).toBe(false);
  });
});
