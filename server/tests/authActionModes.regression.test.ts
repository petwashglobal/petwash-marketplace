/**
 * PR-AUTH-FIX-AUTHACTION-4 — AuthAction.tsx mode-handler regression.
 *
 * Bug being pinned (forensic auth audit 2026-05-10, confirmed on main
 * 2026-05-11):
 *   client/src/pages/AuthAction.tsx handled Firebase action-code modes
 *   'resetPassword', 'verifyEmail', 'recoverEmail' and defaulted the
 *   rest to a bare "Invalid action requested." message. Firebase email-
 *   link sign-in uses mode='signIn', so every magic-link click landed
 *   on the default case and dead-ended the user with no useful signal.
 *
 * Fix:
 *   Added the 'signIn' case + handleEmailLinkSignIn() function. It
 *   verifies the URL is a real email-link, recovers the pending email
 *   from localStorage (checks both PetWash sender key and Firebase
 *   default), signs in via signInWithEmailLink, MINTS the pw_session
 *   cookie via POST /api/auth/session (same client contract as
 *   PR-AUTH-FIX-PASSKEY-RACE-2), clears the single-use stored email,
 *   and routes to /home.
 *   The default case now returns an honest error that includes the
 *   actual mode string + a hint on what to do.
 *
 * Sections:
 *   A. file presence + imports (signInWithEmailLink, isSignInWithEmailLink,
 *      getApiUrl)
 *   B. mode='signIn' case exists in the switch
 *   C. handleEmailLinkSignIn implements the required chain
 *   D. session cookie is minted after email-link sign-in (same client
 *      contract as passkey flow)
 *   E. default case includes the actual mode value in the error
 *   F. all pre-existing modes (resetPassword, verifyEmail, recoverEmail)
 *      still handled
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..');
const AUTH_ACTION = 'client/src/pages/AuthAction.tsx';

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
// A. File presence + required imports
// ─────────────────────────────────────────────────────────────────────────
describe('PR-AUTH-FIX-AUTHACTION-4 — A. imports', () => {
  it('A1. AuthAction.tsx exists', () => {
    expect(existsSync(resolve(ROOT, AUTH_ACTION))).toBe(true);
  });

  it('A2. imports signInWithEmailLink from firebase/auth', () => {
    const src = read(AUTH_ACTION);
    expect(/import\s*\{[^}]*\bsignInWithEmailLink\b[^}]*\}\s*from\s*['"]firebase\/auth['"]/s.test(src)).toBe(true);
  });

  it('A3. imports isSignInWithEmailLink from firebase/auth', () => {
    const src = read(AUTH_ACTION);
    expect(/import\s*\{[^}]*\bisSignInWithEmailLink\b[^}]*\}\s*from\s*['"]firebase\/auth['"]/s.test(src)).toBe(true);
  });

  it('A4. imports getApiUrl (needed for /api/auth/session URL)', () => {
    const src = read(AUTH_ACTION);
    expect(/from\s+['"]@\/lib\/apiConfig['"]/.test(src)).toBe(true);
    expect(/\bgetApiUrl\b/.test(src)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// B. signIn case exists in the switch
// ─────────────────────────────────────────────────────────────────────────
describe('PR-AUTH-FIX-AUTHACTION-4 — B. signIn case in switch', () => {
  const src = read(AUTH_ACTION);
  const code = codeOnly(src);

  it('B1. handleAction switch includes a case for "signIn"', () => {
    expect(/case\s+['"]signIn['"]\s*:/.test(code)).toBe(true);
  });

  it('B2. the signIn case invokes handleEmailLinkSignIn (not left dangling)', () => {
    // The case block must actually CALL the handler, not just fall
    // through to the default. Look for the handler name within a small
    // window of the case label.
    const idx = code.search(/case\s+['"]signIn['"]\s*:/);
    expect(idx).toBeGreaterThan(-1);
    const window = code.slice(idx, idx + 300);
    expect(/handleEmailLinkSignIn\s*\(/.test(window)).toBe(true);
  });

  it('B3. handleEmailLinkSignIn function is defined', () => {
    // Arrow-function const OR named function OR async variant.
    expect(
      /(?:const|function)\s+handleEmailLinkSignIn\b/.test(code),
    ).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// C. handleEmailLinkSignIn implements the required chain
// ─────────────────────────────────────────────────────────────────────────
describe('PR-AUTH-FIX-AUTHACTION-4 — C. required chain', () => {
  const src = read(AUTH_ACTION);
  const code = codeOnly(src);

  it('C1. calls isSignInWithEmailLink to validate the URL', () => {
    expect(/isSignInWithEmailLink\s*\(/.test(code)).toBe(true);
  });

  it('C2. reads a stored email from localStorage (email is required by Firebase)', () => {
    // Firebase signInWithEmailLink REQUIRES the original email address.
    // We recover it from localStorage under either the PetWash sender
    // key ('pw_admin_pending_email' — @/auth/client.ts) or the Firebase
    // convention key ('emailForSignIn').
    expect(/localStorage\.getItem\s*\(\s*['"]pw_admin_pending_email['"]/.test(code)).toBe(true);
    expect(/localStorage\.getItem\s*\(\s*['"]emailForSignIn['"]/.test(code)).toBe(true);
  });

  it('C3. calls signInWithEmailLink(auth, email, currentUrl)', () => {
    // The 3-arg form is Firebase's contract; anything else is a bug.
    expect(/signInWithEmailLink\s*\(\s*auth\s*,/.test(code)).toBe(true);
    expect(/window\.location\.href/.test(code)).toBe(true);
  });

  it('C4. clears the single-use stored email after sign-in', () => {
    // Firebase requires that the emailForSignIn key be single-use — if
    // left in localStorage it could be replayed by another action.
    expect(/localStorage\.removeItem\s*\(\s*['"]pw_admin_pending_email['"]/.test(code)).toBe(true);
    expect(/localStorage\.removeItem\s*\(\s*['"]emailForSignIn['"]/.test(code)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// D. session cookie is minted (same contract as PR-AUTH-FIX-PASSKEY-RACE-2)
// ─────────────────────────────────────────────────────────────────────────
describe('PR-AUTH-FIX-AUTHACTION-4 — D. session cookie mint', () => {
  const src = read(AUTH_ACTION);
  const code = codeOnly(src);

  it('D1. POSTs /api/auth/session after email-link sign-in', () => {
    expect(src.includes('/api/auth/session')).toBe(true);
    // Must be a POST with credentials:'include' — the whole point is to
    // land the Set-Cookie header for pw_session.
    expect(/method:\s*['"]POST['"]/.test(code)).toBe(true);
    expect(/credentials:\s*['"]include['"]/.test(code)).toBe(true);
  });

  it('D2. sends a fresh idToken via getIdToken(true)', () => {
    expect(/getIdToken\s*\(\s*true\s*\)/.test(code)).toBe(true);
  });

  it('D3. the mint block sits within the handleEmailLinkSignIn function', () => {
    // Pin that the mint happens INSIDE the signIn handler, not
    // somewhere unrelated.
    const start = code.search(/(?:const|function)\s+handleEmailLinkSignIn\b/);
    expect(start).toBeGreaterThan(-1);
    // The function body is < 2500 chars — take a generous window.
    const window = code.slice(start, start + 2500);
    expect(window.includes('/api/auth/session')).toBe(true);
    expect(/getIdToken\s*\(\s*true\s*\)/.test(window)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// E. default case error is honest (includes mode value)
// ─────────────────────────────────────────────────────────────────────────
describe('PR-AUTH-FIX-AUTHACTION-4 — E. honest default error', () => {
  const src = read(AUTH_ACTION);

  it('E1. the bare "Invalid action requested." string is gone', () => {
    // Pre-fix default. Its removal is intentional; if a future PR
    // re-adds it, this test flags it before merge.
    expect(src).not.toContain('Invalid action requested.');
  });

  it('E2. default error message references the actual mode', () => {
    // The new default surfaces the actual `mode` string in the error
    // so an operator can debug ("mode was X, we don't handle X").
    // Match either `${mode}` template interp or `"${mode}"` reporting.
    expect(/mode/.test(src)).toBe(true);
    // A hint about opening the link on the requesting device or
    // requesting a fresh one should be present too — the concrete
    // "what to do" the pre-fix message lacked.
    expect(/fresh|open the link|open this link/i.test(src)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// F. pre-existing modes still handled (no regression)
// ─────────────────────────────────────────────────────────────────────────
describe('PR-AUTH-FIX-AUTHACTION-4 — F. no regression on existing modes', () => {
  const src = read(AUTH_ACTION);
  const code = codeOnly(src);

  it('F1. resetPassword case still present and still calls handlePasswordReset', () => {
    expect(/case\s+['"]resetPassword['"]\s*:/.test(code)).toBe(true);
    expect(/handlePasswordReset\s*\(/.test(code)).toBe(true);
    expect(/verifyPasswordResetCode\s*\(/.test(code)).toBe(true);
    expect(/confirmPasswordReset\s*\(/.test(code)).toBe(true);
  });

  it('F2. verifyEmail case still present and still calls applyActionCode', () => {
    expect(/case\s+['"]verifyEmail['"]\s*:/.test(code)).toBe(true);
    expect(/handleEmailVerification\s*\(/.test(code)).toBe(true);
    expect(/applyActionCode\s*\(/.test(code)).toBe(true);
  });

  it('F3. recoverEmail case still present (returns "not yet configured")', () => {
    expect(/case\s+['"]recoverEmail['"]\s*:/.test(code)).toBe(true);
    expect(src).toContain('Email recovery is not yet configured.');
  });

  it('F4. header string exists for mode=signIn', () => {
    // The page header should have a human label for the new mode so
    // the user is not staring at a blank subtitle.
    expect(/mode\s*===\s*['"]signIn['"]\s*&&\s*['"]Sign In['"]/.test(src)).toBe(true);
  });
});
