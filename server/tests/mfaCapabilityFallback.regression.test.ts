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
  it('imports from the userCapabilities aggregator (helper or getter)', () => {
    expect(SRC).toMatch(/['"]\.\.\/lib\/userCapabilities['"]/);
  });

  it('uses the shared hasAdminOrStaffCapability helper', () => {
    expect(SRC).toMatch(/hasAdminOrStaffCapability/);
    expect(SRC).toMatch(/\{ onError: true \}/);
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

  it('uses the shared hasAdminOrStaffCapability helper with onError:true', () => {
    expect(SH).toMatch(/hasAdminOrStaffCapability/);
    expect(SH).toMatch(/\{ onError: true \}/);
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

  it('uses the shared hasAdminOrStaffCapability helper with onError:false (admin gate)', () => {
    expect(C).toMatch(/hasAdminOrStaffCapability/);
    expect(C).toMatch(/\{ onError: false \}/);
  });
});

describe('CEO §D5 — mfa.ts MFA_MANDATORY_ROLES capability fallback', () => {
  const MFA_ROUTE = fs.readFileSync(
    path.resolve(__dirname, '..', 'routes', 'mfa.ts'),
    'utf8',
  );

  it('uses the shared hasAdminOrStaffCapability helper with onError:true', () => {
    expect(MFA_ROUTE).toMatch(/hasAdminOrStaffCapability/);
    expect(MFA_ROUTE).toMatch(/\{ onError: true \}/);
  });

  it('leaves the last-enrollment guard intact', () => {
    expect(MFA_ROUTE).toMatch(/MFA_CANNOT_DISABLE/);
    expect(MFA_ROUTE).toMatch(/at least one active MFA method/);
  });
});
