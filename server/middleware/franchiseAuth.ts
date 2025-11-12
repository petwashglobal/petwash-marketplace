import { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { hrEmployees } from "@shared/schema-hr";
import { eq } from "drizzle-orm";

// Extended request type with employee context
export interface FranchiseAuthRequest extends Request {
  employee?: {
    id: number;
    employeeId: string;
    franchiseId: number | null;
    role: string;
    permissions: string[];
    firstName: string;
    lastName: string;
    email: string;
    department: string;
  };
}

/**
 * Middleware to load employee context from Firebase UID
 * Requires requireAuth to be called first
 */
export async function loadEmployeeContext(
  req: FranchiseAuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const firebaseUid = (req as any).user?.uid;
    
    if (!firebaseUid) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Load employee record by Firebase UID
    const [employee] = await db
      .select({
        id: hrEmployees.id,
        employeeId: hrEmployees.employeeId,
        franchiseId: hrEmployees.franchiseId,
        role: hrEmployees.role,
        permissions: hrEmployees.permissions,
        firstName: hrEmployees.firstName,
        lastName: hrEmployees.lastName,
        email: hrEmployees.email,
        department: hrEmployees.department,
        isActive: hrEmployees.isActive,
      })
      .from(hrEmployees)
      .where(eq(hrEmployees.firebaseUid, firebaseUid))
      .limit(1);

    if (!employee) {
      return res.status(403).json({ 
        error: "Employee record not found. Please contact your administrator." 
      });
    }

    if (!employee.isActive) {
      return res.status(403).json({ 
        error: "Your employee account is inactive. Please contact your administrator." 
      });
    }

    // Attach employee context to request
    req.employee = {
      id: employee.id,
      employeeId: employee.employeeId,
      franchiseId: employee.franchiseId,
      role: employee.role || "employee",
      permissions: (employee.permissions as string[]) || [],
      firstName: employee.firstName,
      lastName: employee.lastName,
      email: employee.email,
      department: employee.department,
    };

    next();
  } catch (error) {
    console.error("Error loading employee context:", error);
    return res.status(500).json({ error: "Failed to load employee context" });
  }
}

/**
 * Middleware to enforce franchise scoping
 * Requires loadEmployeeContext to be called first
 */
export function requireFranchiseScope(
  req: FranchiseAuthRequest,
  res: Response,
  next: NextFunction
) {
  if (!req.employee) {
    return res.status(403).json({ 
      error: "Employee context required. Please ensure loadEmployeeContext middleware is applied." 
    });
  }

  // Corporate HQ employees (franchiseId === null) can access all franchises
  if (req.employee.franchiseId === null && 
      (req.employee.role === "admin" || req.employee.role === "manager")) {
    return next();
  }

  // Franchise employees must have a franchiseId
  if (req.employee.franchiseId === null) {
    return res.status(403).json({ 
      error: "You must be assigned to a franchise to access this resource. Please contact your administrator." 
    });
  }

  next();
}

/**
 * Helper to check if user can access a specific franchise's data
 */
export function canAccessFranchise(
  employee: FranchiseAuthRequest["employee"],
  targetFranchiseId: number | null
): boolean {
  if (!employee) return false;

  // Corporate HQ admins/managers can access all franchises
  if (employee.franchiseId === null && 
      (employee.role === "admin" || employee.role === "manager")) {
    return true;
  }

  // Franchise employees can only access their own franchise
  return employee.franchiseId === targetFranchiseId;
}

/**
 * Helper to get franchise filter for queries
 * Returns null for corporate HQ users (can see all)
 * Returns franchiseId for franchise-scoped users
 */
export function getFranchiseFilter(
  employee: FranchiseAuthRequest["employee"]
): number | null {
  if (!employee) return null;

  // Corporate HQ admins/managers can see all franchises
  if (employee.franchiseId === null && 
      (employee.role === "admin" || employee.role === "manager")) {
    return null;
  }

  // Franchise employees can only see their own franchise
  return employee.franchiseId;
}

/**
 * Middleware to check specific permissions
 */
export function requirePermission(...requiredPermissions: string[]) {
  return (req: FranchiseAuthRequest, res: Response, next: NextFunction) => {
    if (!req.employee) {
      return res.status(403).json({ error: "Employee context required" });
    }

    // Admins bypass permission checks
    if (req.employee.role === "admin") {
      return next();
    }

    // Check if employee has all required permissions
    const hasAllPermissions = requiredPermissions.every(permission =>
      req.employee!.permissions.includes(permission)
    );

    if (!hasAllPermissions) {
      return res.status(403).json({ 
        error: "Insufficient permissions",
        required: requiredPermissions,
      });
    }

    next();
  };
}
