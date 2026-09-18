/**
 * The role/dashboard name mismatch that would have broken the switcher for the
 * MOST COMMON role, and the rules about what to offer.
 */
import { describe, it, expect } from 'vitest';
import { DASHBOARDS, dashboardForRole, switchableDashboards } from './roleDashboards';
import type { DashboardType } from '@/auth/useWhoami';

describe('the two halves call the customer role different things', () => {
  it('the member dashboard posts the role name "customer", not "member"', () => {
    // POST /api/me/active-role accepts customer|provider|staff|admin and 400s
    // on anything else. whoami says 'member'. Posting the dashboard name
    // straight through would fail for exactly one role — the common one.
    expect(DASHBOARDS.member.role).toBe('customer');
  });

  it('every dashboard maps to a role the endpoint accepts', () => {
    const ACCEPTED = ['customer', 'provider', 'staff', 'admin'];
    for (const spec of Object.values(DASHBOARDS)) {
      expect(ACCEPTED).toContain(spec.role);
    }
  });

  it('the mapping round-trips', () => {
    expect(dashboardForRole('customer')).toBe('member');
    expect(dashboardForRole('provider')).toBe('provider');
    expect(dashboardForRole('nonsense')).toBeNull();
    expect(dashboardForRole(null)).toBeNull();
  });
});

describe('the member dashboard is the canonical customer workspace', () => {
  it('lands on /pet-parent/home, never the Prestige surface', () => {
    // Lane A (#2190): Prestige is an entitlement rendered INSIDE the workspace,
    // not a rival destination. canonicalMemberHome pins the server half.
    expect(DASHBOARDS.member.path).toBe('/pet-parent/home');
    expect(DASHBOARDS.member.path).not.toContain('prestige');
  });
});

describe('what to offer', () => {
  it('one dashboard offers nothing — a switcher with one option is clutter', () => {
    expect(switchableDashboards(['member'])).toEqual([]);
    expect(switchableDashboards([])).toEqual([]);
  });

  it('a customer who is also a provider gets both', () => {
    expect(switchableDashboards(['member', 'provider'])).toEqual(['member', 'provider']);
  });

  it('staff collapses into admin — they land on the same screen', () => {
    // Offering a choice with no consequence is worse than offering none.
    expect(DASHBOARDS.staff.path).toBe(DASHBOARDS.admin.path);
    expect(switchableDashboards(['member', 'staff', 'admin'])).toEqual(['member', 'admin']);
  });

  it('staff WITHOUT admin is still offered', () => {
    expect(switchableDashboards(['member', 'staff'])).toEqual(['member', 'staff']);
  });

  it('an unknown dashboard from a newer server is ignored, not rendered', () => {
    const fromFutureServer = ['member', 'provider', 'franchise'] as unknown as DashboardType[];
    expect(switchableDashboards(fromFutureServer)).toEqual(['member', 'provider']);
  });
});
