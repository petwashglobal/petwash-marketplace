/**
 * CEO §17 multi-role posture — one person can be customer + provider +
 * Prestige simultaneously. Mode = PET_PARENT vs PROVIDER. Prestige
 * stays entitlement (never a mode / not a base role).
 *
 * Source-pin regression on client/src/auth/useWhoami.ts:
 *
 *   • providerStatus and prestigeStatus are SEPARATE optional fields
 *     — a refactor that collapsed them into a single `role` string
 *     would break the additive model.
 *   • dashboardsAllowed is an array of DashboardType — a single dashboard
 *     field would forbid the customer+provider+staff case.
 *   • activeFlow enum includes 'customer' AND 'provider' but never
 *     'prestige' (that's a membership, not a flow — CEO 2026-08-26).
 *   • DashboardType lists ALL four buckets: member, provider, staff, admin
 *     — a refactor that dropped one silently forbids that role.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, 'useWhoami.ts'),
  'utf8',
);

describe('§17 multi-role posture pinned at the whoami DTO', () => {
  it('DashboardType lists all four buckets — member, provider, staff, admin', () => {
    expect(SRC).toMatch(
      /export type DashboardType\s*=\s*'member'\s*\|\s*'provider'\s*\|\s*'staff'\s*\|\s*'admin'/,
    );
  });

  it('providerStatus + prestigeStatus + kycStatus are SEPARATE optional axes', () => {
    // Never collapsed into a single role/status field. Each axis
    // evolves independently.
    expect(SRC).toMatch(/providerStatus\?:\s*'none'\s*\|\s*'pending'\s*\|\s*'approved'/);
    expect(SRC).toMatch(/prestigeStatus\?:\s*'none'\s*\|\s*'active'/);
    expect(SRC).toMatch(/kycStatus:\s*'not_started'\s*\|\s*'pending'\s*\|\s*'approved'\s*\|\s*'rejected'\s*\|\s*'manual_review'\s*\|\s*'not_required'/);
  });

  it('dashboardsAllowed is an ARRAY — allows customer+provider+staff simultaneously', () => {
    expect(SRC).toMatch(/dashboardsAllowed:\s*DashboardType\[\]/);
    // Ban a single-dashboard field that would forbid multi-role.
    expect(SRC).not.toMatch(/dashboardAllowed:\s*DashboardType/);
    expect(SRC).not.toMatch(/activeDashboard:\s*DashboardType/);
  });

  it('activeFlow includes customer AND provider — never prestige (membership, not flow)', () => {
    // CEO 2026-08-26 role model: Prestige is a membership, not a
    // flow. Legacy 'prestige' value was renamed to 'customer'; the
    // regression cannot let 'prestige' come back as a flow value.
    expect(SRC).toMatch(/activeFlow\?:\s*'customer'\s*\|\s*'provider'\s*\|\s*'guest'\s*\|\s*'booking'\s*\|\s*'general'/);
    // 'prestige' as a flow value is banned.
    expect(SRC).not.toMatch(/activeFlow\?:.*\|\s*'prestige'/);
  });

  it('canAccessDashboard uses ARRAY includes — never role-string equality', () => {
    expect(SRC).toMatch(
      /export function canAccessDashboard\(dashboardsAllowed: DashboardType\[\], dashboard: DashboardType\)[\s\S]*?dashboardsAllowed\.includes\(dashboard\)/,
    );
  });

  it('DTO carries roles?: string[] — additive not exclusive', () => {
    // A single-role field would silently drop the customer+provider
    // combo on whichever role fires last.
    expect(SRC).toMatch(/roles\?:\s*string\[\]/);
  });
});
