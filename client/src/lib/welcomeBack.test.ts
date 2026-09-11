import { describe, it, expect } from 'vitest';
import { welcomeBackOr } from './welcomeBack';

/**
 * Returning member → /welcome-back greeting carrying the server's destination
 * as the canonical returnTo. New / incomplete member → the server's
 * destination untouched. (CEO 2026-09-12 Google sign-in flow.)
 */
describe('welcomeBackOr', () => {
  it('greets a returning complete member, carrying the server destination', () => {
    const out = welcomeBackOr({ nextUrl: '/pet-parent/home', profileStatus: 'complete', userStatus: 'active' }, '/home');
    expect(out).toBe('/welcome-back?returnTo=%2Fpet-parent%2Fhome');
  });

  it('greets an approved provider / admin too', () => {
    expect(welcomeBackOr({ nextUrl: '/provider-os', profileStatus: 'approved', userStatus: 'active' }, '/home'))
      .toBe('/welcome-back?returnTo=%2Fprovider-os');
    expect(welcomeBackOr({ nextUrl: '/admin/dashboard', profileStatus: 'approved', userStatus: 'active' }, '/home'))
      .toBe('/welcome-back?returnTo=%2Fadmin%2Fdashboard');
  });

  it('sends a NEW Google user straight to /complete-profile (no greeting)', () => {
    expect(welcomeBackOr({ nextUrl: '/complete-profile', profileStatus: 'incomplete', userStatus: 'new' }, '/home'))
      .toBe('/complete-profile');
  });

  it('never greets an incomplete or gated member', () => {
    expect(welcomeBackOr({ nextUrl: '/verify-email', profileStatus: 'incomplete', userStatus: 'active' }, '/home')).toBe('/verify-email');
    expect(welcomeBackOr({ nextUrl: '/provider-onboarding', profileStatus: 'incomplete', userStatus: 'active' }, '/home')).toBe('/provider-onboarding');
    expect(welcomeBackOr({ nextUrl: '/blocked', profileStatus: 'blocked', userStatus: 'blocked' }, '/home')).toBe('/blocked');
    expect(welcomeBackOr({ nextUrl: '/pet-parent/home', profileStatus: 'complete', userStatus: 'new' }, '/home')).toBe('/pet-parent/home');
  });

  it('falls back to dest when the server gave nothing', () => {
    expect(welcomeBackOr(undefined, '/home')).toBe('/home');
    expect(welcomeBackOr({}, '/home')).toBe('/home');
  });

  it('does not double-wrap /welcome-back', () => {
    expect(welcomeBackOr({ nextUrl: '/welcome-back?returnTo=%2Fx', profileStatus: 'complete', userStatus: 'active' }, '/home'))
      .toBe('/welcome-back?returnTo=%2Fx');
  });
});
