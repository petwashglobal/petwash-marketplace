/**
 * The gold account icon bounced a LOGGED-IN user to sign-in on iPhone Safari:
 * resolveAccountRoute() read the stale React `user`/`loading` closure, which is
 * null while the Firebase SDK is still rehydrating a persisted session from
 * IndexedDB, so it returned '/signin'. It must instead consult the LIVE
 * auth.currentUser (getLiveFirebaseUser) before deciding "not logged in".
 * Source-introspection (the live path needs the real Firebase SDK + a browser).
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const nav = fs.readFileSync(path.resolve(__dirname, '..', 'useAccountNavigation.ts'), 'utf8');
const header = fs.readFileSync(
  path.resolve(__dirname, '..', '..', 'components', 'PetWashHeader.tsx'),
  'utf8',
);

describe('account navigation uses live Firebase auth, never bounces a logged-in user', () => {
  it('exports getLiveFirebaseUser and consults auth.currentUser', () => {
    expect(nav).toMatch(/export function getLiveFirebaseUser/);
    expect(nav).toMatch(/auth\.currentUser/);
    expect(nav).toMatch(/onAuthStateChanged\(auth/);
  });

  it('resolveAccountRoute resolves the live user and no longer trusts stale `!loading && !user`', () => {
    expect(nav).toMatch(/const fbUser = await getLiveFirebaseUser/);
    expect(nav).not.toMatch(/if \(!loading && !user\) return '\/signin'/);
  });

  it('once the live user is known, the authed fallback is /home (never /signin)', () => {
    const fn = nav.slice(nav.indexOf('const resolveAccountRoute'));
    // the only /signin in the resolver is the genuine no-user case + the 401 case
    expect(fn).toMatch(/if \(!fbUser\) return '\/signin'/);
    expect(fn).not.toMatch(/return user \? '\/home' : '\/signin'/);
  });

  it('the header gold icon re-checks live auth before trusting a "guest" decision', () => {
    expect(header).toMatch(/getLiveFirebaseUser/);
    const fn = header.slice(header.indexOf('handleProfileNavigate'));
    expect(fn).toMatch(/accountView\.state === 'guest'/);
    // the live check must come BEFORE the accountView.to (guest route) branch
    expect(fn.indexOf('getLiveFirebaseUser')).toBeLessThan(fn.indexOf('handleNavigate(accountView.to)'));
  });
});
