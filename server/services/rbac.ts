/**
 * RBAC (Role-Based Access Control) Service
 * Handles user role lookups and access level checks
 */

import { db } from '../db';
import { systemRoles, userRoleAssignments } from '@shared/schema-enterprise';
import { eq, and } from 'drizzle-orm';
import { logger } from '../lib/logger';

/**
 * Get user's role level (access level)
 * Returns 0 if no role found
 * 
 * Access Levels:
 * - 10: Super Admin (CEO, Director)
 * - 8-9: Executive/Management (Finance, Legal, Operations Directors)
 * - 5: Department Level (Franchise Owners, K9000 Supplier)
 * - 1-4: Restricted (Technicians, Support Staff)
 */
export async function getUserRoleLevel(userId: string): Promise<number> {
  try {
    const assignments = await db
      .select({
        roleId: userRoleAssignments.roleId,
        accessLevel: systemRoles.accessLevel,
      })
      .from(userRoleAssignments)
      .innerJoin(systemRoles, eq(userRoleAssignments.roleId, systemRoles.id))
      .where(
        and(
          eq(userRoleAssignments.userId, userId),
          eq(userRoleAssignments.isActive, true)
        )
      )
      .limit(1);

    if (assignments.length === 0) {
      return 0; // No role assigned
    }

    return assignments[0].accessLevel || 0;
  } catch (error) {
    logger.error('[RBAC] Failed to get user role level', { userId, error });
    return 0;
  }
}

/**
 * Get user's full role information
 */
export async function getUserRole(userId: string) {
  try {
    const assignments = await db
      .select({
        roleCode: systemRoles.roleCode,
        roleName: systemRoles.roleName,
        roleNameHe: systemRoles.roleNameHe,
        department: systemRoles.department,
        accessLevel: systemRoles.accessLevel,
        permissions: systemRoles.permissions,
      })
      .from(userRoleAssignments)
      .innerJoin(systemRoles, eq(userRoleAssignments.roleId, systemRoles.id))
      .where(
        and(
          eq(userRoleAssignments.userId, userId),
          eq(userRoleAssignments.isActive, true)
        )
      )
      .limit(1);

    return assignments[0] || null;
  } catch (error) {
    logger.error('[RBAC] Failed to get user role', { userId, error });
    return null;
  }
}

/**
 * Check if user has specific permission
 */
export async function userHasPermission(
  userId: string,
  permission: string
): Promise<boolean> {
  try {
    const role = await getUserRole(userId);
    if (!role) return false;

    const permissions = role.permissions as string[];
    return permissions.includes(permission);
  } catch (error) {
    logger.error('[RBAC] Failed to check permission', { userId, permission, error });
    return false;
  }
}

/**
 * Check if user has minimum access level
 */
export async function userHasMinimumLevel(
  userId: string,
  minLevel: number
): Promise<boolean> {
  const level = await getUserRoleLevel(userId);
  return level >= minLevel;
}
