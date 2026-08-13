/**
 * PR-AUTH-FIX-PASSKEY-RACE-2 — passkey session-mint regression.
 *
 * Bug being pinned (forensic auth audit 2026-05-10, confirmed on main
 * 2026-05-11):
 *   client/src/auth/passkey.ts had THREE code paths that called
 *   signInWithCustomToken (signInWithPasskey, signInWithPasskeyConditional,
 *   signInWithPasskeyAuto) but NONE of them then POSTed to
 *   /api/auth/session to mint the pw_session cookie. The server route
 *   at server/routes.ts:3134 intentionally does NOT create the session
 *   cookie itself — a documented client contract at server/routes.ts:3168-3182
 *   requires the client to do it:
 *
 *     signInWithCustomToken(auth, customToken)
 *       → cred.user.getIdToken(true)
 *         → POST /api/auth/session { idToken }
 *
 *   AdminLoginV2.tsx was the only caller doing it correctly, inline.
 *   Every SignUpLuxury Face ID sign-in completed the WebAuthn dance and
 *   set Firebase auth state, but then the app pages 401-bounced back
 *   to /signin because no session cookie was present. UX read:
 *   "Face ID lands you nowhere / doesn't know what to do."
 *
 * Fix (centralised, single owner):
 *   passkey.ts now has a private mintServerSession() helper that POSTs
 *   the freshly-minted ID token to /api/auth/session. Called after
 *   signInWithCustomToken in ALL THREE passkey helpers. Every caller
 *   (SignUpLuxury.handlePasskeyLogin, conditional autofill, and the
 *   currently-dead useAutoFaceID.signInWithPasskeyAuto path) inherits
 *   the correct behaviour without change.
 *
 * Sections:
 *   A. file presence + module contract (imports getApiUrl, exports helpers)
 *   B. mintServerSession helper exists and posts to /api/auth/session
 *   C. every signInWithCustomToken call is IMMEDIATELY followed by
 *      mintServerSession (source-pin against future regression)
 *   D. server route contract is preserved (server does NOT set cookie
 *      itself — the client is expected to mint)
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..');
function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), 'utf8');
}
/** Strip comments + string literals so regex scans hit only code. */
function codeOnly(src: string): string {
  let out = src;
  out = out.replace(/\/\*[\s\S]*?\*\//g, '');
  out = out.replace(/(^|[^:])\/\/.*$/gm, '$1');
  return out;
}

const PASSKEY = 'client/src/auth/passkey.ts';
const SERVER_ROUTES = 'server/routes.ts';

// ─────────────────────────────────────────────────────────────────────────
// A. Module contract
// ─────────────────────────────────────────────────────────────────────────
describe('PR-AUTH-FIX-PASSKEY-RACE-2 — A. module contract', () => {
  it('A1. passkey.ts file exists', () => {
    expect(existsSync(resolve(ROOT, PASSKEY))).toBe(true);
  });

  it('A2. passkey.ts imports getApiUrl (needed for /api/auth/session URL)', () => {
    const src = read(PASSKEY);
    expect(/from\s+['"]@\/lib\/apiConfig['"]/.test(src)).toBe(true);
    expect(/\bgetApiUrl\b/.test(src)).toBe(true);
  });

  it('A3. all three public passkey helpers still exported', () => {
    const src = read(PASSKEY);
    expect(/export\s+async\s+function\s+signInWithPasskey\s*\(/.test(src)).toBe(true);
    expect(/export\s+async\s+function\s+signInWithPasskeyConditional\s*\(/.test(src)).toBe(true);
    expect(/export\s+async\s+function\s+signInWithPasskeyAuto\s*\(/.test(src)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// B. mintServerSession helper
// ─────────────────────────────────────────────────────────────────────────
describe('PR-AUTH-FIX-PASSKEY-RACE-2 — B. mintServerSession helper', () => {
  const src = read(PASSKEY);
  const code = codeOnly(src);

  it('B1. mintServerSession helper is defined', () => {
    expect(/(?:async\s+)?function\s+mintServerSession\s*\(/.test(code)).toBe(true);
  });

  it('B2. mintServerSession POSTs to /api/auth/session', () => {
    // The helper must reference the canonical session endpoint. The
    // path lives inside a getApiUrl(...) template so grep the string.
    expect(src.includes('/api/auth/session')).toBe(true);
    // And the method must be POST.
    expect(/method:\s*['"]POST['"]/.test(code)).toBe(true);
  });

  it('B3. mintServerSession includes credentials: "include" (session cookie must land)', () => {
    // Without credentials:'include' the Set-Cookie response header is
    // dropped by the browser on cross-origin requests → no pw_session
    // → the whole point of the mint is defeated.
    expect(/credentials:\s*['"]include['"]/.test(code)).toBe(true);
  });

  it('B4. mintServerSession forces a fresh idToken with getIdToken(true)', () => {
    // The `true` argument forces a fresh token — critical because the
    // custom-token-derived session may have stale claims otherwise.
    expect(/getIdToken\s*\(\s*true\s*\)/.test(code)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// C. Every signInWithCustomToken call is followed by mintServerSession
// ─────────────────────────────────────────────────────────────────────────
describe('PR-AUTH-FIX-PASSKEY-RACE-2 — C. session mint after every signInWithCustomToken', () => {
  const src = read(PASSKEY);
  const code = codeOnly(src);

  it('C1. passkey.ts contains at least 3 signInWithCustomToken invocations (the 3 helpers)', () => {
    // Import counts as 1 match; each of the 3 helpers invokes it once.
    // Total >=3 invocations (excluding the import line).
    const invocations = (code.match(/\bsignInWithCustomToken\s*\(/g) || []).length;
    expect(invocations).toBeGreaterThanOrEqual(3);
  });

  it('C2. every signInWithCustomToken invocation is followed within 400 chars by mintServerSession()', () => {
    // Windowed scan: for each invocation, look ahead in the code (up to
    // 400 chars) for a mintServerSession() call before the next
    // signInWithCustomToken. Pins the "you must mint after custom-token
    // sign-in" contract without requiring the two lines to be adjacent.
    const invokeRe = /\bsignInWithCustomToken\s*\(/g;
    const positions: number[] = [];
    let m: RegExpExecArray | null;
    while ((m = invokeRe.exec(code)) !== null) {
      positions.push(m.index);
    }
    // Drop the import site (before any function bodies).
    const bodyPositions = positions.filter((p) => code.indexOf('function ', 0) < p);
    const violators: number[] = [];
    for (const start of bodyPositions) {
      const window = code.slice(start, start + 400);
      if (!/\bmintServerSession\s*\(/.test(window)) {
        violators.push(start);
      }
    }
    expect(
      violators,
      `signInWithCustomToken without a following mintServerSession() — this is the exact class of bug PR-AUTH-FIX-PASSKEY-RACE-2 fixes. Offsets: ${violators.join(', ')}`,
    ).toEqual([]);
  });

  it('C3. the stale "// Session cookie is already set by the server" comment is gone', () => {
    // The comment was factually wrong — /api/webauthn/login/verify does
    // NOT set the cookie. Leaving the comment would invite a future
    // regression. If someone re-adds the comment they must first
    // re-read this test's explanation.
    expect(src).not.toContain('// Session cookie is already set by the server');
  });
});

// ─────────────────────────────────────────────────────────────────────────
// D. Server route contract preserved
// ─────────────────────────────────────────────────────────────────────────
describe('PR-AUTH-FIX-PASSKEY-RACE-2 — D. server route contract preserved', () => {
  it('D1. /api/webauthn/login/verify is still mounted', () => {
    const src = read(SERVER_ROUTES);
    expect(src).toContain("/api/webauthn/login/verify");
  });

  it('D2. server route returns a customToken (not a session cookie)', () => {
    // The client must receive customToken to run the mint chain. If a
    // future refactor tries to mint server-side it will hit the same
    // auth/invalid-id-token bug the pre-fix code hit (see server/routes.ts
    // security note dated 2026-05-24 / investigation finding 4.2).
    const src = read(SERVER_ROUTES);
    // Locate the handler block and pin the response shape.
    const start = src.indexOf("/api/webauthn/login/verify");
    expect(start).toBeGreaterThan(-1);
    // Take a generous window (~150 lines) after the mount to look at
    // the response payload the handler sends back.
    const window = src.slice(start, start + 8000);
    expect(window).toContain('createCustomToken');
    expect(window).toContain('customToken');
  });
});
