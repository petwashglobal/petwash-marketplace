/**
 * PR-AUTH-FIX-RESET-EMAIL-3 — password-reset flow regression.
 *
 * Ships two things pinned as a single "password reset works end-to-end"
 * contract (CEO 2026-05-11 "go big build full on"):
 *
 *   1. Customer forgot-password flow — added to SignUpLuxury.tsx (the
 *      unified sign-in surface). Previously customers had NO way to
 *      reset a forgotten password; the "SignIn.tsx" retirement on
 *      2026-06-28 unified sign-in into SignUpLuxury but the reset flow
 *      was never carried across.
 *   2. Admin reset URL branding — AdminLoginV2.tsx now passes
 *      actionCodeSettings.url so Firebase routes the reset email to
 *      the PetWash /auth/action page (handled by AuthAction.tsx),
 *      instead of the Firebase console default off-domain URL.
 *
 * Pins BOTH call sites so the branded landing can never silently drift
 * back to the off-domain default.
 *
 * Sections:
 *   A. file presence + AuthAction.tsx handler still exists
 *   B. customer forgot-password flow present in SignUpLuxury.tsx
 *   C. sendPasswordResetEmail is ALWAYS called with actionCodeSettings
 *      (guard against re-introducing the bare 2-arg form)
 *   D. actionCodeSettings.url points at /auth/action on our own origin
 *   E. resend timer state exists (60s cooldown per Firebase rate limit)
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..');

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), 'utf8');
}
function codeOnly(src: string): string {
  let out = src;
  out = out.replace(/\/\*[\s\S]*?\*\//g, '');
  out = out.replace(/(^|[^:])\/\/.*$/gm, '$1');
  return out;
}

const SIGNUP_LUXURY = 'client/src/pages/SignUpLuxury.tsx';
const ADMIN_LOGIN = 'client/src/pages/admin/AdminLoginV2.tsx';
const AUTH_ACTION = 'client/src/pages/AuthAction.tsx';

// ─────────────────────────────────────────────────────────────────────────
// A. File presence + landing handler still wired
// ─────────────────────────────────────────────────────────────────────────
describe('PR-AUTH-FIX-RESET-EMAIL-3 — A. files + landing', () => {
  it('A1. all three files exist', () => {
    for (const rel of [SIGNUP_LUXURY, ADMIN_LOGIN, AUTH_ACTION]) {
      expect(existsSync(resolve(ROOT, rel)), `expected ${rel}`).toBe(true);
    }
  });

  it('A2. AuthAction.tsx still handles the resetPassword mode + calls confirmPasswordReset', () => {
    const src = read(AUTH_ACTION);
    expect(src).toContain("'resetPassword'");
    expect(src).toContain('confirmPasswordReset');
    expect(src).toContain('verifyPasswordResetCode');
  });

  it('A3. /auth/action route is mounted (client/src/App.tsx)', () => {
    const src = read('client/src/App.tsx');
    expect(src).toContain('/auth/action');
    expect(src).toContain('AuthAction');
  });
});

// ─────────────────────────────────────────────────────────────────────────
// B. Customer flow present in SignUpLuxury
// ─────────────────────────────────────────────────────────────────────────
describe('PR-AUTH-FIX-RESET-EMAIL-3 — B. customer forgot-password flow', () => {
  const src = read(SIGNUP_LUXURY);
  const code = codeOnly(src);

  it('B1. sendPasswordResetEmail imported from firebase/auth', () => {
    // Import statement must include sendPasswordResetEmail alongside the
    // other firebase/auth imports.
    const m = code.match(/from\s+['"]firebase\/auth['"]/);
    expect(m, 'firebase/auth import present').toBeTruthy();
    expect(/import\s*\{[^}]*\bsendPasswordResetEmail\b[^}]*\}\s*from\s*['"]firebase\/auth['"]/s.test(code)).toBe(true);
  });

  it('B2. sendForgotPasswordEmail handler exists', () => {
    expect(/async\s+function\s+sendForgotPasswordEmail\s*\(/.test(code)).toBe(true);
  });

  it('B3. forgot-password state variables exist', () => {
    for (const stateVar of [
      'forgotOpen',
      'forgotEmail',
      'forgotSent',
      'forgotBusy',
      'forgotError',
      'resendSecondsLeft',
    ]) {
      expect(
        new RegExp(`\\b${stateVar}\\b`).test(code),
        `state var ${stateVar} must exist`,
      ).toBe(true);
    }
  });

  it('B4. UI has a "Forgot password?" link and a reset panel (via data-testid)', () => {
    expect(src).toContain('data-testid="link-forgot-password"');
    expect(src).toContain('data-testid="panel-forgot-password"');
    expect(src).toContain('data-testid="input-forgot-email"');
    expect(src).toContain('data-testid="button-forgot-send"');
    expect(src).toContain('data-testid="button-forgot-resend"');
    expect(src).toContain('data-testid="button-forgot-cancel"');
  });

  it('B5. bilingual copy present (Hebrew + English)', () => {
    // Hebrew "Forgot password?" and English variant both present.
    expect(src).toContain('שכחת סיסמה?');
    expect(src).toContain('Forgot password?');
    // Success state has bilingual "Reset link sent" copy.
    expect(src).toContain('Reset link sent');
    expect(src).toContain('הקישור נשלח');
  });
});

// ─────────────────────────────────────────────────────────────────────────
// C. Guard — every sendPasswordResetEmail call passes actionCodeSettings
// ─────────────────────────────────────────────────────────────────────────
describe('PR-AUTH-FIX-RESET-EMAIL-3 — C. no bare sendPasswordResetEmail anywhere in client', () => {
  function walk(dir: string): string[] {
    const out: string[] = [];
    const stack = [dir];
    while (stack.length) {
      const cur = stack.pop()!;
      for (const entry of readdirSync(cur, { withFileTypes: true })) {
        if (entry.name.startsWith('.')) continue;
        if (entry.name === 'node_modules') continue;
        const full = resolve(cur, entry.name);
        if (entry.isDirectory()) stack.push(full);
        else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) out.push(full);
      }
    }
    return out;
  }

  it('C1. every sendPasswordResetEmail() call has at least 3 arguments (auth, email, actionCodeSettings)', () => {
    const clientDir = resolve(ROOT, 'client', 'src');
    if (!existsSync(clientDir)) return;
    const violators: string[] = [];
    for (const file of walk(clientDir)) {
      const raw = readFileSync(file, 'utf8');
      if (!raw.includes('sendPasswordResetEmail')) continue;
      const src = codeOnly(raw);
      // Find every INVOCATION (not the import). An invocation is
      // `sendPasswordResetEmail(...)`. Grab the argument list and count
      // top-level commas.
      const invokeRe = /\bsendPasswordResetEmail\s*\(([\s\S]*?)\)\s*(?:;|$)/g;
      let m: RegExpExecArray | null;
      while ((m = invokeRe.exec(src)) !== null) {
        const args = m[1];
        // Count top-level commas (ignoring commas inside nested braces).
        let depth = 0;
        let commas = 0;
        for (const ch of args) {
          if (ch === '{' || ch === '(' || ch === '[') depth++;
          else if (ch === '}' || ch === ')' || ch === ']') depth--;
          else if (ch === ',' && depth === 0) commas++;
        }
        // Two top-level commas => three top-level arguments.
        if (commas < 2) {
          violators.push(`${file.replace(ROOT + '/', '')}  args=${JSON.stringify(args.trim())}`);
        }
      }
    }
    expect(
      violators,
      `sendPasswordResetEmail must always be called with actionCodeSettings — bare 2-arg calls:\n  ${violators.join('\n  ')}`,
    ).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// D. Landing URL points at PetWash /auth/action
// ─────────────────────────────────────────────────────────────────────────
describe('PR-AUTH-FIX-RESET-EMAIL-3 — D. branded landing URL', () => {
  it('D1. SignUpLuxury.tsx builds actionCodeSettings.url ending in /auth/action', () => {
    const src = read(SIGNUP_LUXURY);
    // Match `${...}/auth/action` inside a url: ... value.
    expect(/url:\s*`[^`]*\/auth\/action`/.test(src)).toBe(true);
  });

  it('D2. AdminLoginV2.tsx builds actionCodeSettings.url ending in /auth/action', () => {
    const src = read(ADMIN_LOGIN);
    expect(/url:\s*`[^`]*\/auth\/action`/.test(src)).toBe(true);
  });

  it('D3. both files gate on petwash.co.il hostname for the prod origin (no hard-coded prod URL)', () => {
    // The chosen pattern (same as client/src/auth/client.ts) is:
    //   hostname.includes('petwash.co.il') ? `https://${hostname}` : origin
    // This keeps preview/staging builds working without a hard-coded prod URL.
    for (const rel of [SIGNUP_LUXURY, ADMIN_LOGIN]) {
      const src = read(rel);
      expect(
        src.includes("petwash.co.il"),
        `${rel} should compute origin via petwash.co.il hostname check`,
      ).toBe(true);
      expect(
        src.includes("window.location.origin") || src.includes("location.origin"),
        `${rel} should fall back to window.location.origin off-prod`,
      ).toBe(true);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────
// E. Resend timer contract
// ─────────────────────────────────────────────────────────────────────────
describe('PR-AUTH-FIX-RESET-EMAIL-3 — E. resend timer', () => {
  const src = read(SIGNUP_LUXURY);
  const code = codeOnly(src);

  it('E1. resend cooldown is 60 seconds (matches Firebase per-account rate limit)', () => {
    // The handler sets resendSecondsLeft to 60 on successful send.
    expect(/setResendSecondsLeft\s*\(\s*60\s*\)/.test(code)).toBe(true);
  });

  it('E2. resend button is disabled while cooldown > 0', () => {
    // The Resend button disables on `resendSecondsLeft > 0`.
    expect(/disabled=\{[^}]*resendSecondsLeft\s*>\s*0[^}]*\}/.test(src)).toBe(true);
  });

  it('E3. countdown useEffect decrements per second', () => {
    // A setInterval(..., 1000) that decrements resendSecondsLeft.
    expect(/setInterval\([\s\S]{0,120}setResendSecondsLeft/.test(code)).toBe(true);
    expect(/,\s*1000\s*\)/.test(code)).toBe(true);
  });
});
