import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { eq, and } from 'drizzle-orm';
import { 
  systemRoles, 
  userRoleAssignments,
  type SystemRole,
  type UserRoleAssignment
} from '../../shared/schema-enterprise';
import { logger } from '../lib/logger';

// Super Admin emails with full access to all sections
const SUPER_ADMINS = [
  'nirhadad1@gmail.com',        // Nir Hadad - Founder & CEO (Gmail)
  'nir.h@petwash.co.il',        // Nir Hadad - Founder & CEO
  'ido.s@petwash.co.il',        // Ido Shakarzi - National Operations Director
  'idoshaka@gmail.com'          // Ido Shakarzi - Director (Gmail)
];

// Extended Request with user role information
// Note: firebaseUser is already globally declared in Express Request by firebase-auth.ts
export interface AuthenticatedRequest extends Request {
  userRole?: {
    role: SystemRole;
    assignment: UserRoleAssignment;
    isSuperAdmin: boolean;
  };
}

/**
 * Check if user is a super admin (CEO or Director)
 */
export function isSuperAdmin(email: string): boolean {
  return SUPER_ADMINS.includes(email.toLowerCase());
}

/**
 * Load user role and permissions
 */
export async function loadUserRole(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.firebaseUser?.email) {
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'User email not found in session'
      });
    }

    const userEmail = req.firebaseUser.email.toLowerCase();

    // Super admins have unrestricted access
    if (isSuperAdmin(userEmail)) {
      req.userRole = {
        role: {
          id: 0,
          roleCode: 'SUPER_ADMIN',
          roleName: 'Super Administrator',
          roleNameHe: 'מנהל על',
          department: 'executive',
          accessLevel: 10,
          permissions: ['*'], // All permissions
          canAccessAllStations: true,
          canAccessFinancials: true,
          canAccessLegal: true,
          canAccessK9000Supplier: true,
          canManageFranchises: true,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        assignment: {
          id: 0,
          userId: req.firebaseUser!.uid,
          userEmail: userEmail,
          userName: 'Super Admin',
          roleId: 0,
          franchiseeId: null,
          stationIds: null,
          isActive: true,
          assignedBy: 'SYSTEM',
          assignedAt: new Date(),
          expiresAt: null,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        isSuperAdmin: true
      };
      return next();
    }

    // Load role assignment for regular users
    const assignments = await db
      .select({
        assignment: userRoleAssignments,
        role: systemRoles
      })
      .from(userRoleAssignments)
      .leftJoin(systemRoles, eq(userRoleAssignments.roleId, systemRoles.id))
      .where(
        and(
          eq(userRoleAssignments.userEmail, userEmail),
          eq(userRoleAssignments.isActive, true)
        )
      )
      .limit(1);

    if (!assignments.length || !assignments[0].role) {
      return res.status(403).json({ 
        error: 'Access denied',
        message: 'No active role assignment found for this user'
      });
    }

    const { role, assignment } = assignments[0];

    req.userRole = {
      role,
      assignment,
      isSuperAdmin: false
    };

    next();
  } catch (error) {
    logger.error('Error loading user role:', error);
    res.status(500).json({ error: 'Failed to load user permissions' });
  }
}

/**
 * Check if user has required permission
 */
export function checkPermission(requiredPermission: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.userRole) {
      return res.status(403).json({ 
        error: 'Access denied',
        message: 'User role not loaded'
      });
    }

    const { role, isSuperAdmin } = req.userRole;

    // Super admins have all permissions
    if (isSuperAdmin) {
      return next();
    }

    // Check if user's role has the required permission
    const permissions = role.permissions as string[];
    const hasPermission = permissions.includes('*') || permissions.includes(requiredPermission);

    if (!hasPermission) {
      logger.warn(`Access denied for ${req.firebaseUser?.email}: missing permission ${requiredPermission}`);
      return res.status(403).json({ 
        error: 'Access denied',
        message: `You do not have permission to perform this action (${requiredPermission})`
      });
    }

    next();
  };
}

/**
 * Check if user has access to specific department
 */
export function checkDepartmentAccess(department: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.userRole) {
      return res.status(403).json({ 
        error: 'Access denied',
        message: 'User role not loaded'
      });
    }

    const { role, isSuperAdmin } = req.userRole;

    // Super admins have access to all departments
    if (isSuperAdmin) {
      return next();
    }

    // Check if user's role belongs to the required department
    if (role.department !== department) {
      logger.warn(`Access denied for ${req.firebaseUser?.email}: department mismatch (required: ${department}, has: ${role.department})`);
      return res.status(403).json({ 
        error: 'Access denied',
        message: `You do not have access to the ${department} section`
      });
    }

    next();
  };
}

/**
 * Check if user has minimum access level
 */
export function checkAccessLevel(minLevel: number) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.userRole) {
      return res.status(403).json({ 
        error: 'Access denied',
        message: 'User role not loaded'
      });
    }

    const { role, isSuperAdmin } = req.userRole;

    // Super admins have highest access level
    if (isSuperAdmin) {
      return next();
    }

    if (role.accessLevel < minLevel) {
      logger.warn(`Access denied for ${req.firebaseUser?.email}: insufficient access level (required: ${minLevel}, has: ${role.accessLevel})`);
      return res.status(403).json({ 
        error: 'Access denied',
        message: 'You do not have sufficient access level for this resource'
      });
    }

    next();
  };
}

/**
 * Middleware specifically for K9000 supplier section
 * Only K9000 personnel and super admins can access
 */
export function k9000SupplierAccess(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.userRole) {
    return res.status(403).json({ 
      error: 'Access denied',
      message: 'User role not loaded'
    });
  }

  const { role, isSuperAdmin } = req.userRole;

  // Super admins always have access
  if (isSuperAdmin) {
    return next();
  }

  // Check if user has K9000 supplier access
  if (!role.canAccessK9000Supplier) {
    logger.warn(`K9000 access denied for ${req.firebaseUser?.email}`);
    return res.status(403).json({ 
      error: 'Access denied',
      message: 'Only K9000 supplier personnel and super administrators can access this section'
    });
  }

  next();
}

/**
 * Middleware specifically for franchise management
 * Franchisees can only access their own data
 */
export function franchiseAccess(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.userRole) {
    return res.status(403).json({ 
      error: 'Access denied',
      message: 'User role not loaded'
    });
  }

  const { role, isSuperAdmin } = req.userRole;

  // Super admins can access all franchises
  if (isSuperAdmin || role.canManageFranchises) {
    return next();
  }

  // Franchisees must have a valid franchisee assignment
  if (!req.userRole.assignment.franchiseeId) {
    logger.warn(`Franchise access denied for ${req.firebaseUser?.email}: no franchisee assignment`);
    return res.status(403).json({ 
      error: 'Access denied',
      message: 'You do not have access to franchise management'
    });
  }

  next();
}

/**
 * Check if user can access specific franchisee data
 */
export function checkFranchiseeOwnership(franchiseeIdParam: string = 'id') {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.userRole) {
      return res.status(403).json({ 
        error: 'Access denied',
        message: 'User role not loaded'
      });
    }

    const { isSuperAdmin, role, assignment } = req.userRole;

    // Super admins can access any franchisee
    if (isSuperAdmin || role.canManageFranchises) {
      return next();
    }

    const requestedFranchiseeId = parseInt(req.params[franchiseeIdParam]);
    
    if (!assignment.franchiseeId || assignment.franchiseeId !== requestedFranchiseeId) {
      logger.warn(`Franchisee ownership check failed for ${req.firebaseUser?.email}: cannot access franchisee ${requestedFranchiseeId}`);
      return res.status(403).json({ 
        error: 'Access denied',
        message: 'You can only access your own franchisee data'
      });
    }

    next();
  };
}

/**
 * Simple admin-only middleware for routes that require admin access
 * Can be used without loadUserRole middleware for lightweight checks
 */
export function requireAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.firebaseUser?.email) {
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'User email not found in session'
      });
    }

    const userEmail = req.firebaseUser.email.toLowerCase();

    // Quick check: Super admin email list
    if (isSuperAdmin(userEmail)) {
      return next();
    }

    // For non-super-admins, we need to check the database
    // This provides a lightweight alternative to loadUserRole
    logger.warn(`Admin access denied for ${userEmail}`);
    return res.status(403).json({ 
      error: 'Admin access required',
      message: 'This operation requires administrator privileges'
    });
  } catch (error) {
    logger.error('Error in requireAdmin middleware:', error);
    res.status(500).json({ error: 'Failed to verify admin access' });
  }
}

export default {
  isSuperAdmin,
  loadUserRole,
  checkPermission,
  checkDepartmentAccess,
  checkAccessLevel,
  k9000SupplierAccess,
  franchiseAccess,
  checkFranchiseeOwnership,
  requireAdmin
};
