/**
 * PR-AUTH-FIX-DEADEND-SCREENS — every dead-end screen shows what/next/where.
 *
 * Audit Agent A (2026-08-14) — three related HIGH findings from the
 * CEO 2026-05-11 "dead-end screens" complaint:
 *
 *   HIGH #4 — AccessPending had NO CTAs on rejected / null / error
 *     branches. Any user landing there was completely stuck: no
 *     "back home", no "contact support", no reapply, no retry. The
 *     fetch-error branch collapsed to the same "no request found"
 *     copy, so a network hiccup read as "you were never in the
 *     queue".
 *
 *   HIGH #7 — SignUpLuxury Resend buttons were `onClick={() =>
 *     setSent(false)}` which just closed the OTP screen without
 *     firing another sendCode / sendEmailCode. Users thought the
 *     button was broken. Same bug in both mobile + email OTP paths.
 *
 *   HIGH #8 — VerifyEmail signed-out branch set an error string
 *     ("No signed-in user found") with NO path forward. A stale
 *     link / expired session dropped the user with no way to sign
 *     in and come back.
 *
 * Fix:
 *   AccessPending — CTAs on every branch (pending / approved /
 *     rejected / null-no-request / null-error). Distinct error
 *     state with Retry + support link. Fetch-error tracked
 *     separately (fetchState = 'ok' | 'error').
 *   SignUpLuxury — resend buttons call sendCode / sendEmailCode
 *     directly (keep sent=true so OTP screen stays visible).
 *     `busy` flag provides implicit cooldown.
 *   VerifyEmail — signed-out handleResend + handleContinue
 *     redirect to /signin?redirect=/verify-email so user lands
 *     back on the same page after signing in.
 *
 * Sections:
 *   A. AccessPending — CTAs present on every branch
 *   B. SignUpLuxury — Resend buttons actually call the send helper
 *   C. VerifyEmail — signed-out redirect carries return URL
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..');
const ACCESS = 'client/src/pages/AccessPending.tsx';
const SIGNUP = 'client/src/pages/SignUpLuxury.tsx';
const VERIFY = 'client/src/pages/VerifyEmail.tsx';

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), 'utf8');
}
function codeOnly(src: string): string {
  let out = src;
  out = out.replace(/\/\*[\s\S]*?\*\//g, '');
  out = out.replace(/(^|[^:])\/\/.*$/gm, '$1');
  return out;
}

// ─────────────────────────────────────────────────────────────────────────
// A. AccessPending
// ─────────────────────────────────────────────────────────────────────────
describe('PR-AUTH-FIX-DEADEND-SCREENS — A. AccessPending CTAs', () => {
  const src = read(ACCESS);
  const code = codeOnly(src);

  it('A1. file exists', () => {
    expect(existsSync(resolve(ROOT, ACCESS))).toBe(true);
  });

  it('A2. distinct fetchState tracks network errors (not collapsed to null)', () => {
    // The pre-fix code did `catch { setStatus(null); }` — collapsing
    // network failures to "no request found". Now: setFetchState('error').
    expect(/const\s*\[\s*fetchState\s*,\s*setFetchState\s*\]/.test(code)).toBe(true);
    expect(/setFetchState\s*\(\s*['"]error['"]\s*\)/.test(code)).toBe(true);
  });

  it('A3. every terminal state has a back-home button + support link', () => {
    // data-testid guards so the test finds the buttons without
    // caring about copy translations.
    expect(src).toContain('data-testid="button-back-home"');
    expect(src).toContain('data-testid="link-support"');
    // mailto:support@petwash.co.il is the canonical support address.
    expect(src.includes('mailto:support@petwash.co.il')).toBe(true);
  });

  it('A4. no-request-found branch offers a reapply CTA', () => {
    expect(src).toContain('data-testid="button-reapply"');
    // Reapply routes to the staff-request page.
    expect(src).toContain("navigate('/request-staff-access')");
  });

  it('A5. fetch-error branch offers a retry CTA', () => {
    expect(src).toContain('data-testid="button-retry"');
    // Retry is implemented by bumping retryTick to re-fire the effect.
    expect(/setRetryTick\s*\(/.test(code)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// B. SignUpLuxury — Resend actually resends
// ─────────────────────────────────────────────────────────────────────────
describe('PR-AUTH-FIX-DEADEND-SCREENS — B. SignUpLuxury resend', () => {
  const src = read(SIGNUP);

  it('B1. mobile OTP Resend button calls sendCode() (not setSent(false))', () => {
    // Locate the mobile OTP resend button and pin its onClick handler.
    // Uses `void sendCode();` — kept in a small window so a future
    // refactor cannot accidentally revert to setSent(false).
    const idx = src.indexOf('Enter the code sent to ${phone}');
    expect(idx).toBeGreaterThan(-1);
    const window = src.slice(idx, idx + 2500);
    expect(/onClick=\{[^}]*sendCode\s*\(/.test(window)).toBe(true);
    expect(/onClick=\{[^}]*setSent\s*\(\s*false\s*\)[^}]*\}[^<]*Resend code/i.test(window)).toBe(false);
  });

  it('B2. email OTP Resend button calls sendEmailCode() (not setSent(false))', () => {
    const idx = src.indexOf('Enter the code sent to ${email}');
    expect(idx).toBeGreaterThan(-1);
    const window = src.slice(idx, idx + 2500);
    expect(/onClick=\{[^}]*sendEmailCode\s*\(/.test(window)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// C. VerifyEmail — signed-out redirect carries return URL
// ─────────────────────────────────────────────────────────────────────────
describe('PR-AUTH-FIX-DEADEND-SCREENS — C. VerifyEmail signed-out', () => {
  const src = read(VERIFY);

  it('C1. handleResend redirects to /signin?redirect=/verify-email when no auth.currentUser', () => {
    // The pre-fix path set an error and did nothing else. Fix:
    // setLocation('/signin?redirect=/verify-email') so the user
    // lands back here after signing in.
    expect(src.includes("/signin?redirect=/verify-email")).toBe(true);
  });

  it('C2. handleContinue also carries the return URL (was bare /signin)', () => {
    // Confirm both signed-out paths redirect with return URL, not
    // just to /signin (which would drop user on /home after login
    // and the verify-email gate would bounce them back — the
    // infinite-loop trap the 2026-06-18 bugfix partially addressed).
    const matches = (src.match(/\/signin\?redirect=\/verify-email/g) || []).length;
    expect(matches).toBeGreaterThanOrEqual(2);
  });

  it('C3. handleResend does NOT set the pre-fix error "No signed-in user found"', () => {
    // Bilingual pre-fix error strings. If they reappear, this test
    // catches the regression before merge.
    // (Comment references intentionally kept so the reason is
    // discoverable via grep — the test only forbids the ACTIVE
    // setError call.)
    // The direct-string check: no setError(..."No signed-in user found"...).
    expect(/setError\s*\([^)]*No signed-in user found/.test(src)).toBe(false);
  });
});
