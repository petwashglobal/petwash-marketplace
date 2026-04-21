/**
 * Canonical admin role list — single source of truth for Pet Wash™ platform.
 *
 * Any role in this list grants access to the admin dashboard and backend APIs.
 * Import this constant everywhere instead of defining local inline arrays:
 *   - server/adminAuth.ts
 *   - server/routes.ts  (/api/session/whoami ROLE_DASHBOARDS)
 *   - client/src/components/AdminRouteGuard.tsx
 *   - client/src/hooks/useAdminAuth.ts
 *   - client/src/pages/admin/AdminLoginV2.tsx
 *
 * super_admin is always allowed via the isSuperAdmin() check; it is also
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
] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];

/** Returns true if the given role string grants admin-level access. */
export function isAdminRole(role: string): boolean {
  return (ADMIN_ROLES as readonly string[]).includes(role);
}

/**
 * Spreads ADMIN_ROLES into a plain mutable string array.
 * Use this when calling variadic functions that expect `string[]` rather than
 * `readonly ('admin' | 'ops' | ...)[])` — avoids the `as unknown as string[]` cast.
 */
export const ADMIN_ROLES_ARRAY: string[] = [...ADMIN_ROLES];
