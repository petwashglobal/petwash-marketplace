/**
 * Issue #148 P1 — regression pin.
 *
 * The provider onboarding page used to do `navigate('/post-login')` for
 * blocked roles. `/post-login` is the SERVER endpoint path, not a client
 * <Route>, so wouter found no match and the page disappeared mid-render
 * (the user saw the "Become מטפל" form flash and then vanish).
 *
 * The fix POSTs to `/api/auth/post-login` and navigates to the returned
 * `nextUrl`. This test pins the source so the regression cannot return
 * silently — if anyone reintroduces the literal `navigate('/post-login')`
 * or removes the API call, this test fails immediately.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, 'ProviderOnboarding.tsx'),
  'utf8',
);

describe('ProviderOnboarding — Issue #148 P1 regression pin', () => {
  it('does NOT navigate to the non-existent /post-login client route', () => {
    expect(SRC).not.toMatch(/navigate\(\s*['"]\/post-login['"]\s*\)/);
  });

  it('POSTs to the canonical /api/auth/post-login decider endpoint', () => {
    expect(SRC).toMatch(/getApiUrl\(\s*['"]\/api\/auth\/post-login['"]\s*\)/);
    expect(SRC).toMatch(/method:\s*['"]POST['"]/);
  });

  it('navigates to the server-resolved nextUrl with a /home fallback', () => {
    expect(SRC).toMatch(/data\?\.nextUrl/);
    expect(SRC).toMatch(/['"]\/home['"]/);
  });

  it('still gates blocked roles (loyalty / staff / admin / management / franchise_owner)', () => {
    for (const role of [
      'loyalty', 'staff', 'admin', 'super_admin', 'management', 'franchise_owner',
    ]) {
      expect(SRC).toMatch(new RegExp(`['"]${role}['"]`));
    }
  });

  it('preserves the unauthenticated redirect to sign-in with the return path', () => {
    expect(SRC).toMatch(/\/sign-in\?redirect=\/provider-onboarding/);
  });
});
