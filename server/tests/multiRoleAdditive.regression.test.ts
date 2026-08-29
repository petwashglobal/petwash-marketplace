/**
 * CEO FLY MODE II §37 (2026-08-29) — multi-role additive pins.
 *
 * The identity model is ADDITIVE: an account can simultaneously hold
 * customer + provider + prestige, and being promoted to one MUST NOT
 * clobber the others. This suite locks the server-side invariants
 * that keep the workspaces from stepping on each other:
 *
 *   1. Provider service-level approval never resets an existing
 *      customer role/accountType on Firebase custom claims.
 *   2. The roles array accumulates via Set-union — no role is ever
 *      dropped when a new one is added.
 *   3. Capability aggregator returns all held capabilities in one
 *      response (identity + prestige + provider + staff + admin).
 *   4. `hasCustomerCapability` / `hasProviderCapability` /
 *      `hasPrestigeCapability` are independent predicates — no
 *      predicate returns true because another predicate is true.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const APPROVE_ROUTE = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes', 'provider-applications.ts'),
  'utf8',
);

const SHARED_CAPS = fs.readFileSync(
  path.resolve(__dirname, '..', '..', 'shared', 'lib', 'userCapabilities.ts'),
  'utf8',
);

const SERVER_CAPS = fs.readFileSync(
  path.resolve(__dirname, '..', 'lib', 'userCapabilities.ts'),
  'utf8',
);

describe('CEO FLY MODE II §37 — provider approval PRESERVES prior customer identity', () => {
  it('preservedRole keeps a non-public existing role (never resets to "provider")', () => {
    // The pre-2026 bug was: promoting a customer to provider set
    // customClaims.role = 'provider', erasing 'customer'. §37 fixes
    // that: existing non-public role wins, provider is only the
    // fallback when the caller has no role yet.
    expect(APPROVE_ROUTE).toMatch(
      /const preservedRole = \(existingClaims\.role && existingClaims\.role !== 'public'\) \? existingClaims\.role : 'provider'/,
    );
  });

  it('preservedAccountType keeps a non-pet_parent existing accountType', () => {
    // Similar guard for accountType — a staff or admin promotion
    // path may have set accountType='internal'; provider approval
    // must not overwrite that.
    expect(APPROVE_ROUTE).toMatch(
      /const preservedAccountType = \(existingClaims\.accountType && existingClaims\.accountType !== 'pet_parent'\) \? existingClaims\.accountType : 'provider'/,
    );
  });

  it('roles array is a Set-union — never drops a prior role', () => {
    // priorRoles.filter + Set(new Set([...priorRoles, 'provider']))
    // guarantees every role the caller already holds is carried
    // forward, plus the new one, plus no duplicates.
    expect(APPROVE_ROUTE).toMatch(
      /const priorRoles = Array\.isArray\(existingClaims\.roles\) \? existingClaims\.roles\.filter\(\(r: string\) => typeof r === 'string'\) : \[\]/,
    );
    expect(APPROVE_ROUTE).toMatch(
      /const nextRoles = Array\.from\(new Set\(\[\.\.\.priorRoles, 'provider'\]\)\)/,
    );
  });

  it('setCustomUserClaims spread includes {...existingClaims} first so unrelated claims survive', () => {
    // A regression that dropped `...existingClaims` from the spread
    // would nuke every claim the caller already had (email_verified,
    // mfa_verified, kycStaff, etc.). The spread order is the whole
    // safety net.
    expect(APPROVE_ROUTE).toMatch(
      /setCustomUserClaims\(application\.userId,\s*\{\s*\.\.\.existingClaims,/,
    );
  });
});

describe('CEO FLY MODE II §37 — capabilities are independent predicates', () => {
  it('shared type surfaces identity + prestige + provider + staff + admin — all at once', () => {
    for (const field of ['identity', 'prestige', 'provider', 'staff', 'admin']) {
      // Each capability lives on its own field of UserCapabilities;
      // no field is derived from another.
      expect(SHARED_CAPS).toMatch(new RegExp(`^\\s*${field}:\\s*\\{`, 'm'));
    }
  });

  it('hasCustomerCapability = identity.activated (not derived from provider/staff/admin)', () => {
    expect(SHARED_CAPS).toMatch(
      /hasCustomerCapability\s*=\s*\(c:\s*UserCapabilities\):\s*boolean\s*=>\s*c\.identity\.activated/,
    );
  });

  it('hasPrestigeCapability = prestige.enrolled (independent of provider status)', () => {
    expect(SHARED_CAPS).toMatch(
      /hasPrestigeCapability\s*=\s*\(c:\s*UserCapabilities\):\s*boolean\s*=>\s*c\.prestige\.enrolled/,
    );
  });

  it('hasProviderCapability = provider.active (independent of admin/staff)', () => {
    expect(SHARED_CAPS).toMatch(
      /hasProviderCapability\s*=\s*\(c:\s*UserCapabilities\):\s*boolean\s*=>\s*c\.provider\.active/,
    );
  });

  it('server aggregator returns ALL capabilities in one Promise.all — never conditionally', () => {
    // The Prestige + provider + staff + admin arms run in parallel
    // and each writes its own bit. A regression that gated one arm
    // behind another's result would drop capabilities on a
    // multi-role account.
    expect(SERVER_CAPS).toMatch(/await Promise\.all\(\[/);
    expect(SERVER_CAPS).toMatch(/── PRESTIGE ─/);
    expect(SERVER_CAPS).toMatch(/── PROVIDER ─/);
    expect(SERVER_CAPS).toMatch(/── STAFF ─/);
    expect(SERVER_CAPS).toMatch(/── ADMIN ─/);
  });

  it('empty capabilities SHAPE has every field — no field is `undefined` by default', () => {
    // emptyCapabilities returns a fully-populated shape so a
    // consumer that reads e.g. `caps.staff.active` never trips on
    // undefined when the user has no staff record yet.
    expect(SHARED_CAPS).toMatch(
      /export function emptyCapabilities[\s\S]{0,600}staff:\s*\{\s*active:\s*false\s*\}/,
    );
    expect(SHARED_CAPS).toMatch(
      /export function emptyCapabilities[\s\S]{0,600}admin:\s*\{\s*admin:\s*false,\s*superAdmin:\s*false\s*\}/,
    );
  });
});
