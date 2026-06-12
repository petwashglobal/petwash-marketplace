/**
 * Tests for the sticky-account-paths guard.
 *
 * Locks the canonical sticky-path list and the matcher behaviour so any
 * future change to either is intentional. P0 production-blocker fix:
 * prevents `useAccountNavigation.resolveAccountRoute()` from kicking a
 * user out of /provider-onboarding (and similar) via async post-login.
 */

import { describe, it, expect } from 'vitest';
import { isStickyAccountPath, STICKY_ACCOUNT_PATHS } from './sticky-account-paths';

describe('isStickyAccountPath', () => {
  it('returns false for null / undefined / empty', () => {
    expect(isStickyAccountPath(null)).toBe(false);
    expect(isStickyAccountPath(undefined)).toBe(false);
    expect(isStickyAccountPath('')).toBe(false);
  });

  it('returns false for non-onboarding paths', () => {
    expect(isStickyAccountPath('/')).toBe(false);
    expect(isStickyAccountPath('/home')).toBe(false);
    expect(isStickyAccountPath('/my-account')).toBe(false);
    expect(isStickyAccountPath('/admin/dashboard')).toBe(false);
    expect(isStickyAccountPath('/provider-os')).toBe(false);
    expect(isStickyAccountPath('/provider-os/bookings')).toBe(false);
  });

  it('returns true for /provider-onboarding (the original P0)', () => {
    expect(isStickyAccountPath('/provider-onboarding')).toBe(true);
  });

  it('returns true for /provider-onboarding sub-paths', () => {
    expect(isStickyAccountPath('/provider-onboarding/step-2')).toBe(true);
    expect(isStickyAccountPath('/provider-onboarding/identity')).toBe(true);
  });

  it('returns true for provider join sub-paths', () => {
    expect(isStickyAccountPath('/join')).toBe(true);
    expect(isStickyAccountPath('/join/walker')).toBe(true);
    expect(isStickyAccountPath('/join/sitter')).toBe(true);
    expect(isStickyAccountPath('/join/trainer')).toBe(true);
  });

  it('returns true for trailing-slash variants', () => {
    expect(isStickyAccountPath('/provider-onboarding/')).toBe(true);
    expect(isStickyAccountPath('/complete-profile/')).toBe(true);
    expect(isStickyAccountPath('/join/walker/')).toBe(true);
  });

  it('returns true for every entry in the canonical list', () => {
    for (const p of STICKY_ACCOUNT_PATHS) {
      expect(isStickyAccountPath(p)).toBe(true);
    }
  });

  it('returns false for paths that only PREFIX a sticky entry', () => {
    // /provider should NOT match /provider-onboarding
    expect(isStickyAccountPath('/provider')).toBe(false);
    // /signinabc should NOT match /signin
    expect(isStickyAccountPath('/signinabc')).toBe(false);
    // /joined should NOT match /join
    expect(isStickyAccountPath('/joined')).toBe(false);
  });

  it('canonical list contains the critical onboarding and provider-join paths', () => {
    expect(STICKY_ACCOUNT_PATHS).toContain('/provider-onboarding');
    expect(STICKY_ACCOUNT_PATHS).toContain('/become-provider');
    expect(STICKY_ACCOUNT_PATHS).toContain('/complete-profile');
    expect(STICKY_ACCOUNT_PATHS).toContain('/choose-role');
    expect(STICKY_ACCOUNT_PATHS).toContain('/join');
    expect(STICKY_ACCOUNT_PATHS).toContain('/join/walker');
    expect(STICKY_ACCOUNT_PATHS).toContain('/join/sitter');
    expect(STICKY_ACCOUNT_PATHS).toContain('/join/trainer');
  });

  // PR-FRES-4 — /apply-provider and /join-team both redirect to the
  // canonical /provider-onboarding. They must be sticky so an
  // Account-tab tap mid-form does not bounce returning users to /home.
  it('PR-FRES-4: canonical list contains /apply-provider and /join-team', () => {
    expect(STICKY_ACCOUNT_PATHS).toContain('/apply-provider');
    expect(STICKY_ACCOUNT_PATHS).toContain('/join-team');
  });

  it('PR-FRES-4: /apply-provider and /join-team match including sub-paths', () => {
    expect(isStickyAccountPath('/apply-provider')).toBe(true);
    expect(isStickyAccountPath('/apply-provider/')).toBe(true);
    expect(isStickyAccountPath('/apply-provider/step-2')).toBe(true);
    expect(isStickyAccountPath('/join-team')).toBe(true);
    expect(isStickyAccountPath('/join-team/')).toBe(true);
    expect(isStickyAccountPath('/join-team/walker')).toBe(true);
  });

  it('handles non-string input safely', () => {
    expect(isStickyAccountPath(123 as any)).toBe(false);
    expect(isStickyAccountPath({} as any)).toBe(false);
  });
});
