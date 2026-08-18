/**
 * PR-AUTH-FIX-RESET-EMAIL-3 — SignUpLuxury login page has a working
 * Forgot Password path.
 *
 * Pre-fix the customer /signin (SignUpLuxury usePassword branch) had NO
 * "Forgot password" affordance. Users with a forgotten password were
 * stuck on the sign-in screen with no path forward. AdminLoginV2
 * already had one; the customer path did not.
 *
 * Fix: add a Forgot Password link near the Sign In button on the login
 * screen. Anti-enumeration: the success message is ALWAYS the generic
 * "if an account exists ..." text regardless of Firebase's response,
 * so a probe cannot infer account existence via error variance.
 *
 * Sections:
 *   A. handler exists and calls Firebase's sendPasswordResetEmail
 *   B. anti-enumeration success message is generic
 *   C. link is rendered on the LOGIN password branch (data-testid pin)
 *   D. double-submit is guarded (forgotBusy state)
 *   E. Hebrew + English copy present
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..');
const PAGE = 'client/src/pages/SignUpLuxury.tsx';

function read(rel: string): string { return readFileSync(resolve(ROOT, rel), 'utf8'); }
function codeOnly(src: string): string {
  let out = src;
  out = out.replace(/\/\*[\s\S]*?\*\//g, '');
  out = out.replace(/(^|[^:])\/\/.*$/gm, '$1');
  return out;
}

describe('PR-AUTH-FIX-RESET-EMAIL-3 — Forgot Password on customer sign-in', () => {
  const src = read(PAGE);
  const code = codeOnly(src);

  it('A1. file exists', () => {
    expect(existsSync(resolve(ROOT, PAGE))).toBe(true);
  });

  it('A2. handleForgotPassword handler is defined', () => {
    expect(/const\s+handleForgotPassword\s*=\s*async\s*\(\s*\)\s*=>/.test(code)).toBe(true);
  });

  it('A3. handler dynamically imports Firebase sendPasswordResetEmail (matches AdminLoginV2 pattern)', () => {
    expect(/import\(\s*['"]firebase\/auth['"]\s*\)/.test(code)).toBe(true);
    expect(/sendPasswordResetEmail\s*\(\s*fbAuth\s*,\s*trimmed\s*\)/.test(code)).toBe(true);
  });

  it('B1. success message is anti-enumeration generic (does not confirm account existence)', () => {
    // Both language variants must use "if an account exists" style,
    // never "we sent to X" or "no account for X".
    expect(src.includes('If an account exists')).toBe(true);
    expect(src.includes('אם קיים חשבון')).toBe(true);
    // Grep-guard: the pre-fix AdminLoginV2 toast that named the email
    // in the success message is a mild leak; ensure this file does not
    // adopt that pattern.
    expect(/reset email is on its way/.test(src)).toBe(false);
  });

  it('B2. catch branch is empty — errors are swallowed (anti-enumeration)', () => {
    // Firebase can throw for "auth/user-not-found" among others.
    // Distinct error messages would let a caller probe account
    // existence. Pin an empty catch (comment allowed inside).
    const catchBlock = code.match(/catch\s*\{([^}]*)\}\s*finally/m);
    expect(catchBlock).not.toBeNull();
    const body = (catchBlock?.[1] || '').trim();
    // No setError, setInlineError, or toast in this catch.
    expect(/setInlineError\s*\(/.test(body)).toBe(false);
    expect(/setError\s*\(/.test(body)).toBe(false);
    expect(/toast\s*\(/.test(body)).toBe(false);
  });

  it('C1. Forgot Password link is rendered (data-testid pin)', () => {
    expect(src).toContain('data-testid="link-forgot-password"');
  });

  it('C2. success status is rendered (data-testid pin)', () => {
    expect(src).toContain('data-testid="text-forgot-sent"');
  });

  it('D1. double-submit guard — forgotBusy state + disabled on click', () => {
    expect(/const\s*\[\s*forgotBusy\s*,\s*setForgotBusy\s*\]/.test(code)).toBe(true);
    expect(/if\s*\(\s*forgotBusy\s*\)\s*return/.test(code)).toBe(true);
    // Button must be disabled while busy.
    expect(/disabled=\{forgotBusy\}/.test(src)).toBe(true);
  });

  it('D2. email shape validated client-side before hitting Firebase', () => {
    // Cheap RFC-ish shape check. Reject invalid before round-trip.
    expect(/!\/\^\[\^\\s@\]\+@\[\^\\s@\]\+\\\.\[\^\\s@\]\+\$\//.test(code)).toBe(true);
  });

  it('E1. Hebrew + English link copy present', () => {
    expect(src.includes('Forgot password?')).toBe(true);
    expect(src.includes('שכחתי את הסיסמה')).toBe(true);
  });
});
