/**
 * Issue #153 PR-FRES-2 — iPhone Safari ITP intent survival
 *
 * BEFORE this fix:
 *   SignIn.tsx and SignUp.tsx OAuth redirect paths called
 *   signInWithRedirect(auth, provider) WITHOUT first persisting
 *   the localStorage 'signup_intent' value to a server-set HttpOnly
 *   cookie. iPhone Safari ITP and slow mobile networks could wipe
 *   localStorage during the OAuth roundtrip — returning customers
 *   then landed on /home instead of /provider-onboarding because
 *   post-login.ts saw no intent (no body intent, no cookie fallback).
 *
 *   server/routes/post-login.ts:325 expects req.cookies.pw_signup_intent
 *   as a Phase-A fallback when localStorage is wiped. The cookie was
 *   written by /api/auth/seed-intent (post-login.ts:1007) but the
 *   client never called that endpoint — so the fallback was a dead
 *   contract.
 *
 * AFTER this fix:
 *   1. New helper client/src/lib/seedIntent.ts → seedSignupIntentCookie()
 *      reads localStorage.signup_intent, validates against
 *      ALLOWED_INTENTS, and POSTs to /api/auth/seed-intent.
 *   2. SignIn.tsx imports the helper and calls it BEFORE
 *      signInWithRedirect on the iPhone redirect path.
 *
 * Source pins (line numbers may drift, anchors are unique strings):
 *   client/src/lib/seedIntent.ts        — module exists, exports the helper
 *   client/src/pages/SignIn.tsx         — imports + calls before redirect
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..', '..');
const read = (p: string) => readFileSync(resolve(ROOT, p), 'utf8');

describe('Issue #153 PR-FRES-2 — seed signup_intent cookie before OAuth redirect', () => {
  it('1. seedIntent helper module exists and exports seedSignupIntentCookie', () => {
    const src = read('client/src/lib/seedIntent.ts');
    expect(src).toMatch(/export\s+async\s+function\s+seedSignupIntentCookie\s*\(/);
  });

  it('2. seedIntent helper POSTs to /api/auth/seed-intent with credentials', () => {
    const src = read('client/src/lib/seedIntent.ts');
    expect(src).toMatch(/['"]\/api\/auth\/seed-intent['"]/);
    expect(src).toMatch(/credentials:\s*['"]include['"]/);
    expect(src).toMatch(/method:\s*['"]POST['"]/);
  });

  it('3. seedIntent helper validates intent against ALLOWED_INTENTS allowlist', () => {
    const src = read('client/src/lib/seedIntent.ts');
    expect(src).toMatch(/ALLOWED_INTENTS/);
    expect(src).toMatch(/'customer'/);
    expect(src).toMatch(/'loyalty'/);
    expect(src).toMatch(/'provider'/);
    expect(src).toMatch(/'staff_request'/);
  });

  it('4. SignIn.tsx imports seedSignupIntentCookie', () => {
    const src = read('client/src/pages/SignIn.tsx');
    expect(src).toMatch(/import\s*\{\s*seedSignupIntentCookie\s*\}\s*from\s*['"]@\/lib\/seedIntent['"]/);
  });

  it('5. SignIn.tsx awaits seedSignupIntentCookie BEFORE signInWithRedirect on the iPhone path', () => {
    const src = read('client/src/pages/SignIn.tsx');
    // Anchor on the unique log line that precedes the redirect
    const idx = src.indexOf("iPhone detected");
    expect(idx).toBeGreaterThan(0);
    const window = src.slice(idx, idx + 600);
    const seedPos = window.indexOf('seedSignupIntentCookie');
    const redirectPos = window.indexOf('signInWithRedirect');
    expect(seedPos).toBeGreaterThan(0);
    expect(redirectPos).toBeGreaterThan(0);
    expect(seedPos).toBeLessThan(redirectPos);
    expect(window).toMatch(/await\s+seedSignupIntentCookie\(\)/);
  });

  it('6. Server seed-intent endpoint contract preserved (post-login.ts route + ALLOWED_INTENTS)', () => {
    const src = read('server/routes/post-login.ts');
    expect(src).toMatch(/export\s+async\s+function\s+seedIntent/);
    expect(src).toMatch(/pw_signup_intent/);
    expect(src).toMatch(/httpOnly:\s*true/);
    const routes = read('server/routes.ts');
    expect(routes).toMatch(/['"]\/api\/auth\/seed-intent['"]/);
  });
});
