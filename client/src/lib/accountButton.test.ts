/**
 * Tests for the global account button decision logic (safe scope).
 *
 * Locks the SAFE behaviour: guest → /signup?flow=general&returnTo, authenticated
 * states get a correct label only (route stays with resolveAccountRoute). States
 * whoami cannot prove (profile-incomplete, provider-pending) must NOT be guessed.
 */
import { describe, it, expect } from 'vitest';
import { accountButtonView, accountLabel } from './accountButton';
import type { WhoamiResponse } from '@/auth/useWhoami';

function whoami(overrides: Partial<WhoamiResponse> = {}): WhoamiResponse {
  return {
    authenticated: true,
    uid: 'u1', email: 'a@b.com', emailVerified: true, phoneVerified: true,
    phone: null, language: 'en', displayName: 'A', role: 'customer', accountType: 'customer',
    isSuperAdmin: false, dashboardsAllowed: ['member'], mfaRequired: false, mfaVerified: false,
    kycStatus: 'not_required', kycAdmin: false,
    session: { ageSeconds: 1, maxAgeSeconds: 100, ip: 'x', createdAt: null },
    claims: {
      role: 'customer', accountType: 'customer', loyaltyMember: false, loyaltyTier: 'bronze',
      program: null, providerType: null, department: null, roleCode: null, kyc_admin: false,
    },
    ...overrides,
  };
}

describe('accountButtonView', () => {
  it('guest (not authenticated) → /signup?flow=general with returnTo', () => {
    const v = accountButtonView(null, { pathname: '/home', search: '?x=1' });
    expect(v.state).toBe('guest');
    expect(v.guestTo).toBe(`/signup?flow=general&returnTo=${encodeURIComponent('/home?x=1')}`);
    expect(v.labelEn).toBe('Sign In / Sign Up');
  });

  it('guest in checkout context still routes to signup (express-continue is a follow-up)', () => {
    const v = accountButtonView(null, { pathname: '/egift' });
    expect(v.state).toBe('guest');
    expect(v.guestTo).toContain('/signup?flow=general');
    expect(v.guestTo).toContain(encodeURIComponent('/egift'));
  });

  it('logged-in customer → My Profile, no guest route', () => {
    const v = accountButtonView(whoami(), { pathname: '/' });
    expect(v.state).toBe('customer');
    expect(v.labelEn).toBe('My Profile');
    expect(v.guestTo).toBeUndefined();
  });

  it('profile-incomplete is NOT guessed → falls back to customer label', () => {
    // whoami exposes no profile-completeness field; an unverified customer must
    // still read as 'customer' (no fake "Continue Setup").
    const v = accountButtonView(whoami({ emailVerified: false }), { pathname: '/' });
    expect(v.state).toBe('customer');
  });

  it('provider applicant (providerType set, not approved) is NOT guessed → customer', () => {
    // pending-vs-approved is a documented whoami gap; do not guess "Provider Setup".
    const v = accountButtonView(
      whoami({ dashboardsAllowed: ['member'], claims: { ...whoami().claims, providerType: 'walker' } }),
      { pathname: '/' },
    );
    expect(v.state).toBe('customer');
  });

  it('approved provider → Provider Dashboard', () => {
    const v = accountButtonView(whoami({ dashboardsAllowed: ['member', 'provider'] }), { pathname: '/' });
    expect(v.state).toBe('provider');
    expect(v.labelEn).toBe('Provider Dashboard');
  });

  it('admin (isSuperAdmin) → Octopus Control Panel', () => {
    const v = accountButtonView(whoami({ isSuperAdmin: true }), { pathname: '/' });
    expect(v.state).toBe('admin');
    expect(v.labelEn).toBe('Octopus Control Panel');
  });

  it('admin (staff dashboard) → Octopus Control Panel', () => {
    const v = accountButtonView(whoami({ dashboardsAllowed: ['staff'] }), { pathname: '/' });
    expect(v.state).toBe('admin');
  });

  it('prestige member → Prestige', () => {
    const v = accountButtonView(whoami({ claims: { ...whoami().claims, loyaltyMember: true } }), { pathname: '/' });
    expect(v.state).toBe('prestige');
    expect(v.labelEn).toBe('Prestige');
  });

  it('firebaseAuthed (cookie dropped) never shows Sign Up', () => {
    const v = accountButtonView(null, { pathname: '/', firebaseAuthed: true });
    expect(v.state).toBe('customer');
    expect(v.guestTo).toBeUndefined();
  });

  it('Hebrew + English labels resolve via accountLabel', () => {
    const v = accountButtonView(whoami({ isSuperAdmin: true }), { pathname: '/' });
    expect(accountLabel(v, 'he')).toBe('לוח בקרה Octopus');
    expect(accountLabel(v, 'en')).toBe('Octopus Control Panel');
  });
});
