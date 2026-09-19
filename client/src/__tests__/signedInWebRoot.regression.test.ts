/**
 * Signed-in web root (CEO 2026-09-19: "why is the Pet Passport not in my dashboard?")
 *
 * On the web a signed-in visitor at "/" or the Home tab used to get the
 * marketing Landing — a page with no navigation — while their real home
 * (/pet-parent/home with the Pet Passport, wallet, bookings) was reachable only
 * through Account → workspace switcher. The native app never had this problem.
 *
 * Now the root asks the same decider the sign-in flow uses and goes where it
 * says. Two things are pinned: the pure decision (tested for real) and the
 * wiring in App.tsx (source pin — App.tsx cannot be imported under node).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { decideSignedInRoot } from '../lib/signedInRoot';

const CLIENT = resolve(__dirname, '..');
const read = (p: string) => readFileSync(resolve(CLIENT, p), 'utf8');

describe('decideSignedInRoot — follows the post-login decider, never loops, never leaves the site', () => {
  it('goes where the decider says for every real destination', () => {
    for (const url of ['/pet-parent/home', '/provider-os', '/admin/dashboard', '/mode', '/verify-email', '/complete-profile', '/provider/pending', '/blocked']) {
      expect(decideSignedInRoot({ ok: true, status: 200, nextUrl: url })).toBe(url);
    }
  });

  it('keeps a query string on the target', () => {
    expect(decideSignedInRoot({ ok: true, status: 200, nextUrl: '/mode?from=root' })).toBe('/mode?from=root');
  });

  it('falls back (null) when the decider is not ok or the session is gone', () => {
    expect(decideSignedInRoot({ ok: false, status: 500, nextUrl: '/pet-parent/home' })).toBeNull();
    expect(decideSignedInRoot({ ok: false, status: 401 })).toBeNull();
    expect(decideSignedInRoot({ ok: true, status: 401, nextUrl: '/pet-parent/home' })).toBeNull();
  });

  it('falls back when the answer is empty, absolute, or protocol-relative (never an open redirect)', () => {
    expect(decideSignedInRoot({ ok: true, status: 200 })).toBeNull();
    expect(decideSignedInRoot({ ok: true, status: 200, nextUrl: '' })).toBeNull();
    expect(decideSignedInRoot({ ok: true, status: 200, nextUrl: 'https://evil.example/x' })).toBeNull();
    expect(decideSignedInRoot({ ok: true, status: 200, nextUrl: '//evil.example/x' })).toBeNull();
    expect(decideSignedInRoot({ ok: true, status: 200, nextUrl: 'pet-parent/home' })).toBeNull();
  });

  it('falls back when the answer would send the visitor straight back here', () => {
    expect(decideSignedInRoot({ ok: true, status: 200, nextUrl: '/' })).toBeNull();
    expect(decideSignedInRoot({ ok: true, status: 200, nextUrl: '/home' })).toBeNull();
    expect(decideSignedInRoot({ ok: true, status: 200, nextUrl: '/home?x=1' })).toBeNull();
  });
});

describe('App.tsx — the web root hands a signed-in visitor to SignedInRoot', () => {
  const app = read('App.tsx');
  const component = read('components/SignedInRoot.tsx');

  it('signed-in web visitors render SignedInRoot with the old Home as the fallback', () => {
    expect(app).toMatch(/return user \? \(\s*<SignedInRoot\s+loader=\{<PageLoader \/>\}\s+fallback=\{<Home /);
    expect(app).toMatch(/import SignedInRoot from "@\/components\/SignedInRoot";/);
  });

  it('signed-out web visitors still get the marketing Landing', () => {
    expect(app).toMatch(/\) : \(\s*<Landing language=\{language\} onLanguageChange=\{handleLanguageChange\} \/>\s*\);/);
  });

  it('the component uses the single-flight coordinator, not a second fetch of post-login', () => {
    expect(component).toMatch(/resolvePostLogin\(\{ idToken \}\)/);
    expect(component).not.toMatch(/fetch\(/);
    expect(component).toMatch(/navigate\(target, \{ replace: true \}\)/);
    expect(component).toMatch(/decideSignedInRoot\(result\)/);
  });

  it('the native-app branch is untouched (flavored builds still redirect during render)', () => {
    expect(app).toMatch(/if \(isProviderApp\) return <Redirect to=\{user \? '\/provider\/home' : '\/signup'\} \/>;/);
    expect(app).toMatch(/return <Redirect to=\{user \? '\/pet-parent\/home' : '\/signup'\} \/>;/);
  });
});
