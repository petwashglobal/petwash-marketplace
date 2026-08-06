/**
 * "Logged in but no dashboard" (CEO 2026-08-06): /api/auth/post-login was called
 * cookie-only; a cookie-timing 401 was silently rewritten to navigate(dest) =
 * /prestige/home — dumping a super-admin on the member home instead of /admin/dashboard.
 * Fix: both routing call sites carry the Firebase ID token (Bearer auth works before
 * the cookie lands) and retry once with a fresh token instead of falling to dest.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
const src = readFileSync(resolve(__dirname, '..', 'SignUpLuxury.tsx'), 'utf8');

describe('post-login routing carries the ID token', () => {
  it('both resolvePostLogin routing calls pass idToken (Bearer, not cookie-only)', () => {
    // finishAndRoute + the user-effect
    expect((src.match(/resolvePostLogin\(\{ body: [^}]*\}, idToken/g) || []).length).toBeGreaterThanOrEqual(2);
    expect(src).toMatch(/auth\.currentUser\?\.getIdToken\(\)/);
  });
  it('retries once with a force-refreshed token instead of only falling to dest', () => {
    expect((src.match(/getIdToken\(true\)/g) || []).length).toBeGreaterThanOrEqual(2);
    expect(src).toMatch(/if \(\(!data\?\.ok \|\| !data\?\.nextUrl\) && auth\.currentUser\)/);
  });
});
