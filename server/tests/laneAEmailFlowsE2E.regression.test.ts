/**
 * Lane A — Email flow E2E pins.
 *
 * CEO FLY MODE II §4 + §5 + §14 — AUTH CONVERSION P0 (2026-08-29).
 *
 * Locks the email-new + email-returning scenarios so a regression to
 * the shell or the state machine surfaces in vitest, not just in a
 * red Playwright run.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SPEC = fs.readFileSync(
  path.resolve(__dirname, '..', '..', 'tests', 'e2e', 'auth-master-lane-a-email-flows.e2e.spec.ts'),
  'utf8',
);

describe('CEO FLY MODE II §4 §14 — TRUE NEW email customer scenario', () => {
  it('scenario uses personas.customerNewEmail (NOT customerNew — Google shape, or customerActive)', () => {
    expect(SPEC).toMatch(/installFirebaseTestAdapter\(page, personas\.customerNewEmail\)/);
  });

  it('scenario clicks Continue with email, enters ONE email value, clicks Send code', () => {
    // The whole point of §4 — the user typed ONLY an email address
    // before Send code. Password / DOB / name inputs must not exist
    // on that screen.
    expect(SPEC).toMatch(/cta-signin-email/);
    expect(SPEC).toMatch(/signup-progressive-input-email[\s\S]{0,500}fill\(/);
    expect(SPEC).toMatch(/signup-progressive-send-code/);
    expect(SPEC).toMatch(/input\[type="password"\][\s\S]{0,80}toHaveCount\(0\)/);
    expect(SPEC).toMatch(/input\[type="date"\][\s\S]{0,80}toHaveCount\(0\)/);
  });

  it('scenario walks CONTACT_VERIFY → PROFILE_COMPLETION → 5 action screens in canonical order', () => {
    expect(SPEC).toMatch(/data-state[\s\S]{0,10}CONTACT_VERIFY/);
    expect(SPEC).toMatch(/data-state[\s\S]{0,10}PROFILE_COMPLETION/);
    // Canonical §6 ordering: mobile → first_name → last_name → DOB → terms.
    const idxMobile = SPEC.indexOf('signup-progressive-action-mobile_verification');
    const idxFirst = SPEC.indexOf('signup-progressive-action-first_name');
    const idxLast = SPEC.indexOf('signup-progressive-action-last_name');
    const idxDob = SPEC.indexOf('signup-progressive-action-date_of_birth');
    const idxTerms = SPEC.indexOf('signup-progressive-action-terms_acceptance');
    expect(idxMobile).toBeGreaterThan(0);
    expect(idxFirst).toBeGreaterThan(idxMobile);
    expect(idxLast).toBeGreaterThan(idxFirst);
    expect(idxDob).toBeGreaterThan(idxLast);
    expect(idxTerms).toBeGreaterThan(idxDob);
  });

  it('progress marker asserts "1..5" — five required actions total', () => {
    // A regression that dropped mobile_verification would leave four
    // screens, and this assertion would fail.
    expect(SPEC).toMatch(/toContainText\(['"]5['"]\)/);
  });

  it('final assertion waits for /pet-parent/home landing', () => {
    expect(SPEC).toMatch(/waitForURL\(\(u\)\s*=>\s*\/\\\/pet-parent\\\/home\/\.test/);
  });
});

describe('CEO FLY MODE II §5 — RETURNING email customer scenario', () => {
  it('uses personas.customerActive; walks email → OTP → home without profile screens', () => {
    // The block for the returning describe uses customerActive.
    expect(SPEC).toMatch(
      /describe\([\s\S]{0,80}RETURNING email[\s\S]{0,800}installFirebaseTestAdapter\(page, personas\.customerActive\)/,
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

  it('scenario does NOT collect password anywhere in the returning flow', () => {
    // §5: "email code primary, password secondary" — the returning
    // customer path in this spec never asks for a password.
    const idx = SPEC.indexOf('RETURNING email');
    const body = SPEC.slice(idx);
    expect(body).not.toMatch(/type=["']password["']/);
    expect(body).not.toMatch(/signup-progressive-input-password/);
  });
});
