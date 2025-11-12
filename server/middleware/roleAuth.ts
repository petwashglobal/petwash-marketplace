import { Request, Response, NextFunction } from 'express';
import { db } from '../lib/firebase-admin';
import { EmployeeRole } from '@shared/firestore-schema';
import { logger } from '../lib/logger';

// Extend Express Request to include employee profile
declare global {
  namespace Express {
    interface Request {
      employee?: {
        uid: string;
        fullName: string;
        email: string;
        phone?: string;
        role: EmployeeRole;
        stations: string[];
        status: 'active' | 'suspended' | 'inactive';
      };
    }
  }
}

// Permission matrix
const ROLE_PERMISSIONS = {
  admin: {
    canAccessAll: true,
    canManageUsers: true,
    canManageStations: true,
    canManagePayments: true,
    canManageCRM: true,
    canAccessAnalytics: true,
    canAccessOps: true,
    canAccessMaintenance: true,
  },
  ops: {
    canAccessAll: false,
    canManageUsers: false,
    canManageStations: true,
    canManagePayments: false,
    canManageCRM: true,
    canAccessAnalytics: true,
    canAccessOps: true,
    canAccessMaintenance: false,
  },
  manager: {
    canAccessAll: false,
    canManageUsers: false,
    canManageStations: false, // Can only edit their assigned stations
    canManagePayments: false,
    canManageCRM: false,
    canAccessAnalytics: false,
    canAccessOps: true, // View only
    canAccessMaintenance: false,
  },
  maintenance: {
    canAccessAll: false,
    canManageUsers: false,
    canManageStations: false,
    canManagePayments: false,
    canManageCRM: false,
    canAccessAnalytics: false,
    canAccessOps: false,
    canAccessMaintenance: true, // Full maintenance tab access
  },
  support: {
    canAccessAll: false,
    canManageUsers: false,
    canManageStations: false, // Read-only
    canManagePayments: false,
    canManageCRM: true,
    canAccessAnalytics: false,
    canAccessOps: false,
    canAccessMaintenance: false,
  },
};

/**
 * Optional middleware to load employee profile from Firestore
 * Does NOT fail if user is not an employee - simply sets req.employee if they are
 * Used for endpoints that serve both employees and regular users
 */
export async function optionalEmployeeProfile(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.firebaseUser?.uid) {
      // No Firebase auth - continue without employee profile
      return next();
    }

    const uid = req.firebaseUser.uid;
    const email = req.firebaseUser.email;
    
    // SUPER ADMIN BYPASS: Hard-coded access for founder
    const SUPER_ADMIN_EMAIL = 'nirhadad1@gmail.com';
    if (email === SUPER_ADMIN_EMAIL) {
      logger.info(`[Auth] Super admin access granted: ${email}`);
      req.employee = {
        uid,
        fullName: 'Nir Hadad',
        email: email,
        role: 'admin',
        stations: [],
        status: 'active',
      };
      return next();
    }
    
    // Load employee profile from Firestore
    let employeeDoc = await db
      .collection('employees')
      .doc(uid)
      .get();

    // Fallback to legacy path
    if (!employeeDoc.exists) {
      employeeDoc = await db
        .collection('users')
        .doc(uid)
        .collection('employee')
        .doc('profile')
        .get();
    }

    if (!employeeDoc.exists) {
      // User exists but is not an employee - continue without employee profile
      return next();
    }

    const employeeData = employeeDoc.data();
    
    // Check if employee is active
    const isActive = employeeData?.status === 'active' || employeeData?.isActive === true;
    
    if (!isActive) {
      // Inactive employee - continue without employee profile
      return next();
    }

    // Attach employee to request
    req.employee = {
      uid: employeeData.uid,
      fullName: employeeData.fullName,
      email: employeeData.email,
      phone: employeeData.phone,
      role: employeeData.role,
      stations: employeeData.stations || [],
      status: employeeData.status,
    };
    
    next();
  } catch (error) {
    logger.error('[Auth] Error loading optional employee profile:', error);
    // Continue without employee profile on error
    next();
  }
}

/**
 * Middleware to load employee profile from Firestore
 * Requires Firebase auth to have already run (req.firebaseUser must exist)
 */
export async function loadEmployeeProfile(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.firebaseUser?.uid) {
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'You must be logged in to access this resource' 
      });
    }

    const uid = req.firebaseUser.uid;
    const email = req.firebaseUser.email;
    
    // SUPER ADMIN BYPASS: Hard-coded access for founder
    const SUPER_ADMIN_EMAIL = 'nirhadad1@gmail.com';
    if (email === SUPER_ADMIN_EMAIL) {
      logger.info(`[Auth] Super admin access granted: ${email}`);
      req.employee = {
        uid,
        fullName: 'Nir Hadad',
        email: email,
        role: 'admin',
        stations: [],
        status: 'active',
      };
      return next();
    }
    
    // Load employee profile from Firestore with backward compatibility
    // Try new path first: employees/{uid}
    let employeeDoc = await db
      .collection('employees')
      .doc(uid)
      .get();

    // Fallback to legacy path: users/{uid}/employee/profile
    if (!employeeDoc.exists) {
      employeeDoc = await db
        .collection('users')
        .doc(uid)
        .collection('employee')
        .doc('profile')
        .get();
    }

    if (!employeeDoc.exists) {
      // User exists but is not an employee
      return res.status(403).json({ 
        error: 'Forbidden', 
        message: 'This account does not have employee access' 
      });
    }

    const employeeData = employeeDoc.data();
    
    // Check if employee is active (support both old and new field names)
    const isActive = employeeData?.status === 'active' || employeeData?.isActive === true;
    const status = employeeData?.status || (employeeData?.isActive ? 'active' : 'inactive');
    
    if (!isActive) {
      return res.status(403).json({ 
        error: 'Forbidden', 
        message: `Account is ${status}` 
      });
    }

    // Attach employee to request
    req.employee = {
      uid: employeeData.uid,
      fullName: employeeData.fullName,
      email: employeeData.email,
      phone: employeeData.phone,
      role: employeeData.role,
      stations: employeeData.stations || [],
      status: employeeData.status,
    };

    // Update last login timestamp
    await employeeDoc.ref.update({ 
      lastLoginAt: new Date() 
    });

    next();
  } catch (error) {
    logger.error('Error loading employee profile:', error);
    return res.status(500).json({ 
      error: 'Internal Server Error', 
      message: 'Failed to load employee profile' 
    });
  }
}

/**
 * Middleware to require specific role(s)
 * Usage: requireRole(['admin', 'ops'])
 */
export function requireRole(allowedRoles: EmployeeRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.employee) {
      return res.status(403).json({ 
        error: 'Forbidden', 
        message: 'Employee profile not loaded' 
      });
    }

    if (!allowedRoles.includes(req.employee.role)) {
      logger.warn(`Access denied for role ${req.employee.role} to resource requiring ${allowedRoles.join(', ')}`);
      return res.status(403).json({ 
        error: 'Forbidden', 
        message: `This resource requires one of the following roles: ${allowedRoles.join(', ')}` 
      });
    }

    next();
  };
}

/**
 * Middleware to require specific permission
 * Usage: requirePermission('canManageStations')
 */
export function requirePermission(permission: keyof typeof ROLE_PERMISSIONS.admin) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.employee) {
      return res.status(403).json({ 
        error: 'Forbidden', 
        message: 'Employee profile not loaded' 
      });
    }

    const rolePermissions = ROLE_PERMISSIONS[req.employee.role];
    
    if (!rolePermissions[permission]) {
      logger.warn(`Access denied for role ${req.employee.role} - missing permission ${permission}`);
      return res.status(403).json({ 
        error: 'Forbidden', 
        message: `Your role does not have permission to perform this action` 
      });
    }

    next();
  };
}

/**
 * Middleware to check station access
 * Allows admin/ops full access, others only to their assigned stations
 */
export function requireStationAccess(stationIdParam: string = 'stationId') {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.employee) {
      return res.status(403).json({ 
        error: 'Forbidden', 
        message: 'Employee profile not loaded' 
      });
    }

    // Admin and ops can access all stations
    if (req.employee.role === 'admin' || req.employee.role === 'ops') {
      return next();
    }

    // Get station ID from params or query
    const stationId = req.params[stationIdParam] || req.query[stationIdParam];
    
    if (!stationId) {
      return res.status(400).json({ 
        error: 'Bad Request', 
        message: 'Station ID is required' 
      });
    }

    // Check if user has access to this station
    if (!req.employee.stations.includes(stationId as string)) {
      logger.warn(`Access denied for ${req.employee.email} to station ${stationId}`);
      return res.status(403).json({ 
        error: 'Forbidden', 
        message: 'You do not have access to this station' 
      });
    }

    next();
  };
}

/**
 * Get permissions for current employee
 */
export function getEmployeePermissions(req: Request) {
  if (!req.employee) {
    return null;
  }
  return ROLE_PERMISSIONS[req.employee.role];
}
