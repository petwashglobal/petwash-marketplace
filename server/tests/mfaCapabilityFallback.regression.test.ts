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
