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

describe('CEO FLY MODE II §4–§5 — Bearer !== trusted machine client', () => {
  it('the blanket Bearer bypass (hasBearerToken && !hasSessionCookie) is DELETED', () => {
    // The pre-fix line was:
    //   if (hasBearerToken && !hasSessionCookie) return next();
    // Any refactor that re-introduces a shape like this reopens the SEV-1.
    expect(SRC).not.toMatch(/hasBearerToken && !hasSessionCookie/);
    expect(SRC).not.toMatch(/!hasSessionCookie[\s\S]{0,50}return next\(\)/);
  });

  it('service_principal exemption is env-driven via SERVICE_PRINCIPAL_UIDS', () => {
    expect(SRC).toMatch(/process\.env\.SERVICE_PRINCIPAL_UIDS/);
    // Must be comma-parsed with a filter(Boolean) so blank env is empty list.
    expect(SRC).toMatch(/\.split\(','\)/);
    expect(SRC).toMatch(/\.filter\(Boolean\)/);
  });

  it('empty allowlist NEVER short-circuits (defaults to enforce MFA)', () => {
    // The guard must check `.length > 0` — a bare `.includes(uid)` on an
    // empty array happens to return false too but the length check is
    // the audit-visible statement of "no allowlist ⇒ no bypass".
    expect(SRC).toMatch(/servicePrincipalAllowlist\.length > 0/);
    expect(SRC).toMatch(/servicePrincipalAllowlist\.includes\(uid\)/);
  });

  it('every service_principal bypass is logged at INFO for audit', () => {
    expect(SRC).toMatch(/logger\.info\([^\n]*service_principal bypass/);
  });

  it('email in the audit log is masked, not leaked', () => {
    expect(SRC).toMatch(/userEmailForLog/);
  });
});

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

describe('CEO §D5 + FLY MODE II §1 — hasAdminOrStaffCapability + resolveSecurityCapabilities', () => {
  const LIB = fs.readFileSync(
    path.resolve(__dirname, '..', 'lib', 'userCapabilities.ts'),
    'utf8',
  );
  it('exports both the tri-state resolver AND the boolean shim', () => {
    expect(LIB).toMatch(/export async function resolveSecurityCapabilities/);
    expect(LIB).toMatch(/export async function hasAdminOrStaffCapability/);
  });
  it('tri-state resolver returns SecurityCapabilityResolution (ok:true|ok:false with reason)', () => {
    expect(LIB).toMatch(/type SecurityCapabilityResolution\s*=/);
    expect(LIB).toMatch(/\{ ok: true; capabilities: UserCapabilities \}/);
    expect(LIB).toMatch(/reason: 'LOOKUP_FAILED' \| 'MISSING_UID'/);
  });
  it('each security-critical source returns LOOKUP_FAILED on DB error (fail-CLOSED)', () => {
    // The 3 catch blocks — user row, admin row, staff row — MUST
    // return the sentinel, NOT swallow-and-default to false.
    const matches = LIB.match(/return \{ ok: false, reason: 'LOOKUP_FAILED' \};/g) || [];
    expect(matches.length).toBeGreaterThanOrEqual(3);
  });
  it('shim reads capabilities from resolveSecurityCapabilities, not getUserCapabilities', () => {
    // CEO caught: getUserCapabilities swallows errors → onError branch
    // never fires. The shim MUST go through the strict resolver.
    const shimStart = LIB.indexOf('export async function hasAdminOrStaffCapability');
    const shim = LIB.slice(shimStart, shimStart + 800);
    expect(shim).toMatch(/resolveSecurityCapabilities\(uid\)/);
    expect(shim).not.toMatch(/getUserCapabilities\(uid\)/);
  });
  it('shim returns opts.onError when resolution is ok:false', () => {
    const shimStart = LIB.indexOf('export async function hasAdminOrStaffCapability');
    const shim = LIB.slice(shimStart, shimStart + 800);
    expect(shim).toMatch(/if \(!res\.ok\)/);
    expect(shim).toMatch(/return opts\.onError \?\? false;/);
  });
  it('reads staff.active (not the nonexistent staff.approved the old code checked)', () => {
    expect(LIB).toMatch(/caps\.admin\?\.superAdmin \|\| caps\.admin\?\.admin \|\| caps\.staff\?\.active/);
  });
  it('accepts onError contract-dependent default', () => {
    expect(LIB).toMatch(/opts: \{ onError\?: boolean \} = \{\}/);
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
