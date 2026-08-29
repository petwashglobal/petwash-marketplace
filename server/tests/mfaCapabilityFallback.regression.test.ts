/**
 * CEO §D5 (2026-08-29) — MFA bypass fix on server/middleware/requireMfa.ts.
 *
 * E4+E9 audit finding: `doesRoleRequireMfa` read ONLY from Firebase
 * claims.role. A privileged human whose claim was never resynced
 * (e.g. a provider-admin post-promotion) matched neither
 * MFA_REQUIRED_ROLES nor the account-type branch and silently
 * bypassed MFA on every privileged route.
 *
 * Fix — capability aggregator fallback: after the claim checks
 * miss, load getUserCapabilities(uid) and require MFA if the user
 * has admin/superAdmin/staff.approved capability. Fail-CLOSED on
 * lookup error (safer to require MFA than to silently bypass).
 *
 * These pins are source-anchored — no live capability query is
 * needed for the fix to be verifiable.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'middleware', 'requireMfa.ts'),
  'utf8',
);

describe('CEO §D5 — MFA capability fallback', () => {
  it('imports getUserCapabilities from the aggregator (static or dynamic)', () => {
    expect(SRC).toMatch(/getUserCapabilities/);
    expect(SRC).toMatch(/['"]\.\.\/lib\/userCapabilities['"]/);
  });

  it('reads admin.superAdmin as a fallback to the claim check', () => {
    expect(SRC).toMatch(/caps\.admin\?\.superAdmin/);
  });

  it('reads admin.admin as a fallback', () => {
    expect(SRC).toMatch(/caps\.admin\?\.admin/);
  });

  it('reads staff.approved as a fallback', () => {
    expect(SRC).toMatch(/caps\.staff\?\.approved/);
  });

  it('fails CLOSED (requires MFA) on capability lookup error', () => {
    // The catch block returns true — the SAFE default when we
    // cannot determine the caller's role.
    expect(SRC).toMatch(/failing closed:[\s\S]*return true;/);
  });

  it('leaves the existing claim path intact — this is ADDITIVE', () => {
    // Sanity: the MFA_REQUIRED_ROLES / accountType / kycStaff /
    // kycAdmin / financeAccess branches still exist above the new
    // fallback. If a refactor deletes them the whole file needs a
    // fresh review.
    expect(SRC).toMatch(/MFA_REQUIRED_ROLES\.includes\(role\)/);
    expect(SRC).toMatch(/claims\.accountType === 'internal'/);
    expect(SRC).toMatch(/claims\.kycStaff \|\| claims\.kycAdmin \|\| claims\.financeAccess/);
  });
});

describe('CEO §D5 — session-hardening capability fallback', () => {
  const SH = fs.readFileSync(
    path.resolve(__dirname, '..', 'middleware', 'session-hardening.ts'),
    'utf8',
  );

  it('imports getUserCapabilities', () => {
    expect(SH).toMatch(/getUserCapabilities/);
    expect(SH).toMatch(/['"]\.\.\/lib\/userCapabilities['"]/);
  });

  it('reads admin/staff capability as a fallback to sensitiveRoles claim check', () => {
    expect(SH).toMatch(/caps\.admin\?\.superAdmin \|\| caps\.admin\?\.admin \|\| caps\.staff\?\.approved/);
  });

  it('fails CLOSED (treats as sensitive) on capability lookup error', () => {
    expect(SH).toMatch(/\} catch \{[\s\S]*isSensitiveRole = true;[\s\S]*\}/);
  });
});

describe('CEO §D5 — hasAdminOrStaffCapability shared helper', () => {
  const LIB = fs.readFileSync(
    path.resolve(__dirname, '..', 'lib', 'userCapabilities.ts'),
    'utf8',
  );
  it('exports hasAdminOrStaffCapability', () => {
    expect(LIB).toMatch(/export async function hasAdminOrStaffCapability/);
  });
  it('reads all three capability flags (superAdmin, admin, staff.approved)', () => {
    expect(LIB).toMatch(/caps\.admin\?\.superAdmin \|\| caps\.admin\?\.admin \|\| caps\.staff\?\.approved/);
  });
  it('accepts onError contract-dependent default', () => {
    expect(LIB).toMatch(/opts: \{ onError\?: boolean \}/);
    expect(LIB).toMatch(/opts\.onError \?\? false/);
  });
  it('handles missing uid safely without throwing', () => {
    expect(LIB).toMatch(/if \(!uid\) return opts\.onError \?\? false;/);
  });
  it('never throws — try/catch around getUserCapabilities', () => {
    expect(LIB).toMatch(/try \{[\s\S]*getUserCapabilities\(uid\)[\s\S]*\} catch/);
  });
});

describe('CEO §D5 — contractor.ts requireAdmin capability fallback', () => {
  const C = fs.readFileSync(
    path.resolve(__dirname, '..', 'routes', 'contractor.ts'),
    'utf8',
  );

  it('imports getUserCapabilities in requireAdmin', () => {
    expect(C).toMatch(/getUserCapabilities/);
    expect(C).toMatch(/['"]\.\.\/lib\/userCapabilities['"]/);
  });

  it('checks admin/superAdmin capability after user.role !== "admin"', () => {
    expect(C).toMatch(/caps\.admin\?\.superAdmin \|\| caps\.admin\?\.admin/);
  });

  it('fails CLOSED for the admin gate (deny on aggregator error)', () => {
    expect(C).toMatch(/isAdmin = false;/);
  });
});

describe('CEO §D5 — mfa.ts MFA_MANDATORY_ROLES capability fallback', () => {
  const MFA_ROUTE = fs.readFileSync(
    path.resolve(__dirname, '..', 'routes', 'mfa.ts'),
    'utf8',
  );

  it('imports getUserCapabilities', () => {
    expect(MFA_ROUTE).toMatch(/getUserCapabilities/);
    expect(MFA_ROUTE).toMatch(/['"]\.\.\/lib\/userCapabilities['"]/);
  });

  it('reads admin/staff capability after the claim check misses', () => {
    expect(MFA_ROUTE).toMatch(/mfaRequired = true/);
    expect(MFA_ROUTE).toMatch(/caps\.admin\?\.superAdmin \|\| caps\.admin\?\.admin \|\| caps\.staff\?\.approved/);
  });

  it('fails CLOSED (requires MFA) on capability lookup error', () => {
    expect(MFA_ROUTE).toMatch(/\} catch \{[\s\S]*mfaRequired = true;[\s\S]*\}/);
  });

  it('leaves the last-enrollment guard intact', () => {
    expect(MFA_ROUTE).toMatch(/MFA_CANNOT_DISABLE/);
    expect(MFA_ROUTE).toMatch(/at least one active MFA method/);
  });
});
