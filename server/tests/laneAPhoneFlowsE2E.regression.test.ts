/**
 * Lane A — Phone flow E2E pins.
 *
 * CEO FLY MODE II §4 + §5 + §14 — AUTH CONVERSION P0 (2026-08-29).
 *
 * Locks the phone-new + phone-returning scenarios so a regression to
 * the shell or the state machine surfaces in vitest, not just in a
 * red Playwright run.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SPEC = fs.readFileSync(
  path.resolve(__dirname, '..', '..', 'tests', 'e2e', 'auth-master-lane-a-phone-flows.e2e.spec.ts'),
  'utf8',
);

const SHELL = fs.readFileSync(
  path.resolve(__dirname, '..', '..', 'client', 'src', 'pages', 'SignUpProgressive.tsx'),
  'utf8',
);

describe('CEO FLY MODE II §4 §14 — TRUE NEW phone customer scenario', () => {
  it('scenario uses personas.customerNewPhone (NOT customerNew — email or Google shape)', () => {
    expect(SPEC).toMatch(/installFirebaseTestAdapter\(page, personas\.customerNewPhone\)/);
  });

  it('scenario clicks Continue with mobile, enters ONE phone value, clicks Send code', () => {
    // The whole point of §4 — the user typed ONLY a phone number
    // before Send code. Password / DOB / name inputs must not exist
    // on that screen.
    expect(SPEC).toMatch(/cta-signin-mobile/);
    expect(SPEC).toMatch(/signup-progressive-input-mobile[\s\S]{0,500}fill\(/);
    expect(SPEC).toMatch(/signup-progressive-send-code/);
    expect(SPEC).toMatch(/input\[type="password"\][\s\S]{0,80}toHaveCount\(0\)/);
    expect(SPEC).toMatch(/input\[type="date"\][\s\S]{0,80}toHaveCount\(0\)/);
  });

  it('scenario walks CONTACT_VERIFY → PROFILE_COMPLETION → 4 action screens', () => {
    expect(SPEC).toMatch(/data-state[\s\S]{0,10}CONTACT_VERIFY/);
    expect(SPEC).toMatch(/data-state[\s\S]{0,10}PROFILE_COMPLETION/);
    // The four action screens in canonical §6 order.
    const idxFirst = SPEC.indexOf('signup-progressive-action-first_name');
    const idxLast = SPEC.indexOf('signup-progressive-action-last_name');
    const idxDob = SPEC.indexOf('signup-progressive-action-date_of_birth');
    const idxTerms = SPEC.indexOf('signup-progressive-action-terms_acceptance');
    expect(idxFirst).toBeGreaterThan(0);
    expect(idxLast).toBeGreaterThan(idxFirst);
    expect(idxDob).toBeGreaterThan(idxLast);
    expect(idxTerms).toBeGreaterThan(idxDob);
  });

  it('final assertion waits for /pet-parent/home landing', () => {
    expect(SPEC).toMatch(/waitForURL\(\(u\)\s*=>\s*\/\\\/pet-parent\\\/home\/\.test/);
  });
});

describe('CEO FLY MODE II §5 — RETURNING phone customer scenario', () => {
  it('uses personas.customerActive; walks mobile → OTP → home without profile screens', () => {
    // The block for the returning describe uses customerActive.
    expect(SPEC).toMatch(
      /describe\([\s\S]{0,80}RETURNING phone[\s\S]{0,600}installFirebaseTestAdapter\(page, personas\.customerActive\)/,
    );
    // MutationObserver records data-state values so PROFILE_COMPLETION
    // absence can be asserted synchronously.
    expect(SPEC).toMatch(/new MutationObserver/);
    expect(SPEC).toMatch(/expect\(states\)\.not\.toContain\(['"]PROFILE_COMPLETION['"]\)/);
  });

  it('asserts zero action + zero progress DOM nodes ever mounted', () => {
    // The returning path must never render an empty PROFILE_COMPLETION
    // screen — the reducer's zero-action shortcut plus the shell's
    // rendering guard together enforce it.
    expect(SPEC).toMatch(
      /locator\('\[data-testid\^="signup-progressive-action-"\]'\)[\s\S]{0,100}\.count\(\)[\s\S]{0,80}toBe\(0\)/,
    );
    expect(SPEC).toMatch(
      /locator\('\[data-testid="signup-progressive-progress"\]'\)[\s\S]{0,100}\.count\(\)[\s\S]{0,80}toBe\(0\)/,
    );
  });
});

describe('CEO FLY MODE II Lane A — shell session-mint scoping', () => {
  it('AUTHENTICATING useEffect fires only for google/apple methods', () => {
    // Mobile/email must NOT fire session POST here — otherwise
    // clicking Continue with mobile would race past the phone
    // entry screen with the wrong body payload.
    expect(SHELL).toMatch(
      /state\.method !== 'google' && state\.method !== 'apple'[\s\S]{0,60}return;/,
    );
  });

  it('OtpVerifyScreen Verify button POSTs /api/auth/session with method + code + sentTo', () => {
    const idx = SHELL.indexOf('function OtpVerifyScreen');
    const nextFn = SHELL.indexOf('\nfunction ', idx + 1);
    const body = SHELL.slice(idx, nextFn > 0 ? nextFn : idx + 5000);
    // Session POST body carries the OTP context so a real backend
    // can attach the code verification to the exchange.
    expect(body).toMatch(/JSON\.stringify\(\{[\s\S]{0,200}idToken:\s*syntheticToken,[\s\S]{0,200}method,[\s\S]{0,80}code,[\s\S]{0,80}sentTo/);
    expect(body).toMatch(/dispatch\(\{ kind: 'AUTH_SUCCESS' \}\)/);
  });
});
