/**
 * The map between a ROLE (what the server authorises) and a DASHBOARD
 * (where the person lands) — and the one place that knows both names.
 *
 * WHY THIS FILE EXISTS. The two halves already disagreed:
 *
 *   POST /api/me/active-role accepts  'customer' | 'provider' | 'staff' | 'admin'
 *   whoami returns dashboardsAllowed  'member'   | 'provider' | 'staff' | 'admin'
 *
 * The customer role is called `customer` on one side and `member` on the other.
 * A switcher that posted the dashboard name straight through would be rejected
 * with 400 for exactly one role — the most common one. Translating in one
 * module, with a test, is how that stops being a trap.
 *
 * NOTHING HERE GRANTS ANYTHING. activeRole is a UX preference; the server
 * recomputes capabilities on every request and RoleProtectedRoute still gates
 * the destination. This only decides what to OFFER and where to go.
 */
import type { DashboardType } from '@/auth/useWhoami';

/** The role names POST /api/me/active-role accepts. */
export type ActiveRole = 'customer' | 'provider' | 'staff' | 'admin';

interface DashboardSpec {
  /** What the switch endpoint calls it. */
  role: ActiveRole;
  /** Where the person lands. */
  path: string;
  labelEn: string;
  labelHe: string;
}

/**
 * Keyed by DashboardType so an added dashboard fails to compile here until it
 * declares its role name and its landing path.
 */
export const DASHBOARDS: Record<DashboardType, DashboardSpec> = {
  member: {
    role: 'customer',
    // Lane A (#2190): the canonical customer workspace. NOT /prestige/home —
    // Prestige is a membership entitlement rendered inside this, not a rival
    // destination. See canonicalMemberHome.regression.test.ts.
    path: '/pet-parent/home',
    labelEn: 'Pet parent',
    labelHe: 'בעל חיה',
  },
  provider: {
    role: 'provider',
    path: '/provider-os',
    labelEn: 'Provider',
    labelHe: 'נותן שירות',
  },
  staff: {
    role: 'staff',
    path: '/admin/dashboard',
    labelEn: 'Staff',
    labelHe: 'צוות',
  },
  admin: {
    role: 'admin',
    path: '/admin/dashboard',
    labelEn: 'Admin',
    labelHe: 'ניהול',
  },
};

/** The dashboard a given active role means, or null for an unknown value. */
export function dashboardForRole(role: string | null | undefined): DashboardType | null {
  if (!role) return null;
  const hit = (Object.keys(DASHBOARDS) as DashboardType[])
    .find((d) => DASHBOARDS[d].role === role);
  return hit ?? null;
}

/**
 * What to OFFER. A switcher shown to someone with one dashboard is clutter, so
 * this returns [] rather than a single-item list — the caller renders nothing.
 */
export function switchableDashboards(allowed: readonly DashboardType[]): DashboardType[] {
  const known = allowed.filter((d): d is DashboardType => d in DASHBOARDS);
  // staff and admin land on the same screen; offering both is a choice with no
  // consequence, so collapse to the higher one.
  const collapsed = known.includes('admin') ? known.filter((d) => d !== 'staff') : known;
  return collapsed.length > 1 ? collapsed : [];
}
