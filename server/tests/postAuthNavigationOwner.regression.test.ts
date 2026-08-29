/**
 * CEO MASTER §1.10 §F3 (2026-08-29) — pins for the post-auth
 * navigation ownership token and its wiring into the highest-risk
 * competing owners the F3 audit named.
 *
 * BEHAVIOURAL PINS: the token itself round-trips correctly with a
 * TTL guard.
 *
 * SOURCE-ANCHORED PINS: SignUpLuxury.routeNow() claims early;
 * GoogleOneTap defers if the claim is held.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, beforeEach } from 'vitest';

// ─── Behavioural ───────────────────────────────────────────────
import {
  claimPostAuthNavigation,
  releasePostAuthNavigation,
  currentOwner,
  NAV_OWNER_TTL_MS,
} from '../../client/src/lib/postAuthNavigationOwner';

beforeEach(() => releasePostAuthNavigation());

describe('postAuthNavigationOwner — one owner wins', () => {
  it('first claim wins; second claim returns false while held', () => {
    expect(claimPostAuthNavigation('signup-luxury-routeNow')).toBe(true);
    expect(claimPostAuthNavigation('one-tap')).toBe(false);
    expect(currentOwner()).toBe('signup-luxury-routeNow');
  });

  it('idempotent for the SAME owner — repeated claim returns true', () => {
    expect(claimPostAuthNavigation('one-tap')).toBe(true);
    expect(claimPostAuthNavigation('one-tap')).toBe(true);
  });

  it('release makes the token available again', () => {
    claimPostAuthNavigation('signup-luxury-routeNow');
    releasePostAuthNavigation();
    expect(currentOwner()).toBeNull();
    expect(claimPostAuthNavigation('one-tap')).toBe(true);
  });

  it('exports the TTL constant so consumers can reference it', () => {
    expect(typeof NAV_OWNER_TTL_MS).toBe('number');
    expect(NAV_OWNER_TTL_MS).toBeGreaterThan(0);
  });
});

// ─── Source-anchored wiring ────────────────────────────────────
const R = (p: string) => fs.readFileSync(path.resolve(__dirname, '..', '..', p), 'utf8');
const SUL = R('client/src/pages/SignUpLuxury.tsx');
const ONE_TAP = R('client/src/components/GoogleOneTap.tsx');

describe('§1.10 §F3 — SignUpLuxury.routeNow() claims the token first', () => {
  it('imports claim/release from @/lib/postAuthNavigationOwner', () => {
    expect(SUL).toMatch(/from '@\/lib\/postAuthNavigationOwner'/);
    expect(SUL).toMatch(/claimPostAuthNavigation/);
    expect(SUL).toMatch(/releasePostAuthNavigation/);
  });

  it('routeNow() claims EARLY with the signup-luxury-routeNow identity', () => {
    expect(SUL).toMatch(/async function routeNow\(\)[\s\S]*?claimPostAuthNavigation\('signup-luxury-routeNow'\)/);
  });

  it('routeNow() releases the token on BOTH success and failure branches', () => {
    // Two release calls: one after the successful navigate + one in
    // the catch after the fallback navigate.
    const matches = SUL.match(/releasePostAuthNavigation\(\);/g) ?? [];
    expect(matches.length, `found ${matches.length}`).toBeGreaterThanOrEqual(2);
  });
});

describe('§1.10 §F3 — GoogleOneTap defers if SignUpLuxury already owns', () => {
  it('imports claim/release from @/lib/postAuthNavigationOwner', () => {
    expect(ONE_TAP).toMatch(/from '@\/lib\/postAuthNavigationOwner'/);
  });

  it('admin fast-path checks the token before navigating', () => {
    expect(ONE_TAP).toMatch(/if \(!claimPostAuthNavigation\('one-tap-admin'\)\) return;/);
  });

  it('normal post-login path checks the token before navigating', () => {
    expect(ONE_TAP).toMatch(/if \(!claimPostAuthNavigation\('one-tap'\)\) return;/);
  });

  it('fallback catch path also checks the token before navigating to /home', () => {
    expect(ONE_TAP).toMatch(/if \(claimPostAuthNavigation\('one-tap-fallback'\)\) \{[\s\S]*navigate\('\/home'\)[\s\S]*releasePostAuthNavigation/);
  });
});

describe('§1.10 §F3 — PrivilegeSignup enrolled short-circuit defers', () => {
  const P = R('client/src/pages/PrivilegeSignup.tsx');
  it('imports the token helpers', () => {
    expect(P).toMatch(/from ['"]@\/lib\/postAuthNavigationOwner['"]/);
  });
  it('claims before the /prestige/home navigate and releases after', () => {
    expect(P).toMatch(/claimPostAuthNavigation\('privilege-signup-enrolled-shortcut'\)/);
    expect(P).toMatch(/navigate\('\/prestige\/home'\);\s*releasePostAuthNavigation/);
  });
});

describe('§1.10 §F3 — ProviderOnboarding blocked-role bounce defers', () => {
  const PO = R('client/src/pages/ProviderOnboarding.tsx');
  it('claims before the internal-role bounce and releases after', () => {
    expect(PO).toMatch(/claimPostAuthNavigation\('provider-onboarding-blocked-role'\)/);
    expect(PO).toMatch(/claimPostAuthNavigation\('provider-onboarding-blocked-role-fallback'\)/);
  });
});
