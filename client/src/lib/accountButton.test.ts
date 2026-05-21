/**
 * Tests for the global account button decision logic.
 *
 * Locks: guest → /signup?flow=general&returnTo, checkout-context guest →
 * flow=guest, and the authenticated remap to canonical routes by whoami truth.
 * Cookie-loss (Firebase-authed, whoami null) must defer to the server resolver
 * and never show "Sign Up". Priority: admin > incomplete > provider(pending) >
 * provider(approved) > prestige > customer.
 */
import { describe, it, expect } from 'vitest';
import { accountButtonView, accountLabel } from './accountButton';
import type { WhoamiResponse } from '@/auth/useWhoami';

function whoami(overrides: Partial<WhoamiResponse> = {}): WhoamiResponse {
  return {
    authenticated: true,
    uid: 'u1', email: 'a@b.com', emailVerified: true, phoneVerified: true,
    phone: null, language: 'en', displayName: 'A', role: 'customer', accountType: 'pet_parent',
    isSuperAdmin: false, dashboardsAllowed: ['member'], mfaRequired: false, mfaVerified: false,
    kycStatus: 'not_required', kycAdmin: false,
    profileStatus: 'complete', providerStatus: 'none', prestigeStatus: 'none', activeFlow: 'general', roles: ['customer'],
    session: { ageSeconds: 1, maxAgeSeconds: 100, ip: 'x', createdAt: null },
    claims: {
      role: 'customer', accountType: 'pet_parent', loyaltyMember: false, loyaltyTier: 'bronze',
      program: null, providerType: null, department: null, roleCode: null, kyc_admin: false,
    },
    ...overrides,
  };
}

describe('accountButtonView', () => {
  it('guest → /signup?flow=general with returnTo', () => {
    const v = accountButtonView(null, { pathname: '/home', search: '?x=1' });
    expect(v.state).toBe('guest');
    expect(v.to).toBe(`/signup?flow=general&returnTo=${encodeURIComponent('/home?x=1')}`);
    expect(v.labelEn).toBe('Sign In / Sign Up');
  });

  it('guest in checkout context → /signup?flow=guest, Continue Checkout', () => {
    const v = accountButtonView(null, { pathname: '/egift' });
    expect(v.state).toBe('guest_checkout');
    expect(v.to).toContain('/signup?flow=guest');
    expect(v.labelEn).toBe('Continue Checkout');
  });

  it('logged-in customer → /account, My Profile', () => {
    const v = accountButtonView(whoami(), { pathname: '/' });
    expect(v.state).toBe('customer');
    expect(v.to).toBe('/account');
    expect(v.labelEn).toBe('My Profile');
  });

  it('incomplete profile → /profile/complete, Continue Setup (beats dashboards)', () => {
    const v = accountButtonView(
      whoami({ profileStatus: 'incomplete', providerStatus: 'approved', dashboardsAllowed: ['member', 'provider'] }),
      { pathname: '/' },
    );
    expect(v.state).toBe('incomplete');
    expect(v.to).toBe('/profile/complete');
  });

  it('provider applicant (pending) → /provider/onboarding, Provider Setup', () => {
    const v = accountButtonView(whoami({ providerStatus: 'pending' }), { pathname: '/' });
    expect(v.state).toBe('provider_pending');
    expect(v.to).toBe('/provider/onboarding');
  });

  it('approved provider → /provider/dashboard, Provider Dashboard', () => {
    const v = accountButtonView(whoami({ providerStatus: 'approved', dashboardsAllowed: ['member', 'provider'] }), { pathname: '/' });
    expect(v.state).toBe('provider_approved');
    expect(v.to).toBe('/provider/dashboard');
  });

  it('admin → /octopus, Octopus Control Panel (wins over everything)', () => {
    const v = accountButtonView(
      whoami({ isSuperAdmin: true, profileStatus: 'incomplete', providerStatus: 'pending', dashboardsAllowed: ['member', 'staff', 'admin'] }),
      { pathname: '/' },
    );
    expect(v.state).toBe('admin');
    expect(v.to).toBe('/octopus');
  });

  it('admin via staff dashboard → /octopus', () => {
    const v = accountButtonView(whoami({ dashboardsAllowed: ['member', 'staff'] }), { pathname: '/' });
    expect(v.state).toBe('admin');
  });

  it('prestige member → /prestige/dashboard, Prestige', () => {
    const v = accountButtonView(whoami({ prestigeStatus: 'active' }), { pathname: '/' });
    expect(v.state).toBe('prestige');
    expect(v.to).toBe('/prestige/dashboard');
  });

  it('cookie dropped (firebaseAuthed, whoami null) → useServerResolver, never Sign Up', () => {
    const v = accountButtonView(null, { pathname: '/', firebaseAuthed: true });
    expect(v.useServerResolver).toBe(true);
    expect(v.to).toBeUndefined();
    expect(v.labelEn).toBe('My Profile');
  });

  it('Hebrew + English labels resolve via accountLabel', () => {
    const v = accountButtonView(whoami({ isSuperAdmin: true }), { pathname: '/' });
    expect(accountLabel(v, 'he')).toBe('לוח בקרה Octopus');
    expect(accountLabel(v, 'en')).toBe('Octopus Control Panel');
  });
});
