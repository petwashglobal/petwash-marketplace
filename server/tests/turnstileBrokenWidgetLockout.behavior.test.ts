import { describe, it, expect, beforeEach } from 'vitest';
import {
  recordAttempt,
  shouldBypass,
  isDegraded,
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

  it('a few token-less attempts are not enough evidence', () => {
    for (let i = 0; i < 9; i++) recordAttempt('missing');
    expect(shouldBypass()).toBe(false);
  });

  it('a full window where NOBODY could mint a token opens the breaker', () => {
    for (let i = 0; i < 10; i++) recordAttempt('missing');
    expect(shouldBypass()).toBe(true);
    expect(isDegraded()).toBe(true);
  });

  it('it never opens while real users are passing the check', () => {
    for (let i = 0; i < 40; i++) recordAttempt('missing');
    recordAttempt('pass'); // one human got through — the widget works
    __resetBreakerForTests();
    for (let i = 0; i < 20; i++) recordAttempt('missing');
    recordAttempt('pass');
    expect(shouldBypass()).toBe(false);
  });

  it('the first valid token closes it again with no deploy', () => {
    for (let i = 0; i < 10; i++) recordAttempt('missing');
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
