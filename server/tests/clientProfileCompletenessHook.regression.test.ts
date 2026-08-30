/**
 * Regression pin — client useProfileCompleteness hook + deep-link
 * routing. Source-anchored so a refactor that drops the 501
 * awaiting-effects state or drifts a deep link from the exact
 * section route is caught in CI.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const HOOK = fs.readFileSync(
  path.resolve(__dirname, '../../client/src/hooks/useProfileCompleteness.ts'),
  'utf8',
);

describe('useProfileCompleteness — client wire', () => {
  it('hits /api/me/profile', () => {
    expect(HOOK).toMatch(/apiRequest\(\s*['"]GET['"]\s*,\s*['"]\/api\/me\/profile['"]/);
  });

  it('maps 401 → not_authenticated and 501 → not_ready', () => {
    expect(HOOK).toContain("'not_authenticated'");
    expect(HOOK).toContain("'not_ready'");
    expect(HOOK).toContain('code === 401');
    expect(HOOK).toContain('code === 501');
  });

  it('exposes MissingField and ProfileState unions matching the server', () => {
    for (const s of [
      "'firstName'", "'lastName'", "'email'", "'emailVerification'",
      "'mobile'", "'mobileVerification'", "'dateOfBirth'",
      "'language'", "'address'", "'termsAcceptance'",
    ]) {
      expect(HOOK).toContain(s);
    }
    expect(HOOK).toContain("'COMPLETE'");
    expect(HOOK).toContain("'INCOMPLETE'");
  });

  it('every server ProfileActionDeepLinkCode routes to an exact /my-account section', () => {
    // Each deepLinkCode must produce a route that contains
    // /my-account and a section query so the Attention CTA opens
    // the right pane — never a generic homepage.
    const pairs: Array<[string, string]> = [
      ['MY_ACCOUNT_PERSONAL',       "/my-account?section=personal"],
      ['MY_ACCOUNT_CONTACT_EMAIL',  "/my-account?section=contact&change=email"],
      ['MY_ACCOUNT_CONTACT_MOBILE', "/my-account?section=contact&change=mobile"],
      ['MY_ACCOUNT_ADDRESS',        "/my-account?section=address"],
      ['MY_ACCOUNT_PREFERENCES',    "/my-account?section=preferences"],
      ['MY_ACCOUNT_TERMS',          "/my-account?section=terms"],
    ];
    for (const [code, route] of pairs) {
      expect(HOOK).toContain(code);
      expect(HOOK).toContain(route);
    }
  });

  it('routeForProfileAction has NO default branch (missing code is a build error)', () => {
    // A default branch would let the client silently point CTAs at
    // some generic route. The switch must be exhaustive.
    expect(HOOK).not.toMatch(/default:/);
  });
});
