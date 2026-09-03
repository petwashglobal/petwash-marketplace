/**
 * Canonical admin role list — single source of truth for PetWash™ platform.
 *
 * Any role in this list grants access to the admin dashboard and backend APIs.
 * Import this constant everywhere instead of defining local inline arrays:
 *   - server/adminAuth.ts
 *   - server/routes.ts  (/api/session/whoami ROLE_DASHBOARDS)
 *   - client/src/components/AdminRouteGuard.tsx
 *   - client/src/hooks/useAdminAuth.ts
 *   - client/src/pages/admin/AdminLoginV2.tsx
 *
 * super_admin is always allowed via the isSuperAdminVerified check; it is also
 * included here so that role-string comparisons remain consistent.
 */
export const ADMIN_ROLES = [
  'admin',
  'ops',
  'management',
  'super_admin',
  'staff',
  'hr',
  'finance',
  'ceo',
  // READ-ONLY: can VIEW every admin screen but cannot change anything. Used for
  // external accountants and observers (e.g. ido.s@petwash.co.il). Writes are
  // blocked server-side by enforceReadOnlyMutations on /api/admin. See
  // READ_ONLY_ADMIN_ROLES below.
  'viewer',
] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];

/**
 * Admin roles that are READ-ONLY — granted full admin visibility but blocked from
 * any mutating request (POST/PUT/PATCH/DELETE) on admin APIs. The single super
 * admin (Nir, via SUPER_ADMIN_EMAILS) is never read-only.
 */
export const READ_ONLY_ADMIN_ROLES: string[] = ['viewer'];

/** Returns true if the given role string grants admin-level access. */
export function isAdminRole(role: string): boolean {
  return (ADMIN_ROLES as readonly string[]).includes(role);
}

/** Returns true if the role can view admin but must never write (viewer/observer). */
export function isReadOnlyAdminRole(role: string | undefined | null): boolean {
  return !!role && READ_ONLY_ADMIN_ROLES.includes(role.toLowerCase());
}

/**
 * Spreads ADMIN_ROLES into a plain mutable string array.
 * Use this when calling variadic functions that expect `string[]` rather than
 * `readonly ('admin' | 'ops' | ...)[])` — avoids the `as unknown as string[]` cast.
 */
export const ADMIN_ROLES_ARRAY: string[] = [...ADMIN_ROLES];
