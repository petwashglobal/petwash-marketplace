import { Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import { AdminUser } from "@shared/schema";
import { logger } from './lib/logger';

// Extend Express Request to include admin user
declare module "express-session" {
  interface SessionData {
    adminId?: string;
  }
}

declare global {
  namespace Express {
    interface Request {
      adminUser?: AdminUser;
    }
  }
}

export interface AdminSession {
  adminId: string;
  role: string;
  email: string;
  regions: string[];
  isActive: boolean;
}

// Admin authentication middleware (Firebase-based)
export const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { verifySessionCookie, SESSION_COOKIE_NAME } = await import('./lib/sessionCookies');
    const sessionCookie = req.cookies?.[SESSION_COOKIE_NAME];
    
    if (!sessionCookie) {
      return res.status(401).json({ message: "Admin authentication required" });
    }

    // Verify session cookie with revocation check for admins
    let decodedClaims;
    try {
      decodedClaims = await verifySessionCookie(sessionCookie, true);
    } catch (error) {
      return res.status(401).json({ message: "Invalid or expired session" });
    }

    // Check if user is admin in Firestore
    const { db: firestoreDb } = await import('./lib/firebase-admin');
    const userDoc = await firestoreDb.collection('users').doc(decodedClaims.uid).get();
    const userData = userDoc.data();
    
    if (userData?.role !== 'admin') {
      return res.status(403).json({ message: "Admin access required" });
    }

    // For backwards compatibility, set session adminId
    req.session.adminId = decodedClaims.uid;
    
    // Try to get admin user from storage
    const admin = await storage.getAdminUser(decodedClaims.uid);
    if (admin) {
      req.adminUser = admin;
    }

    next();
  } catch (error) {
    logger.error('Admin auth error:', error);
    res.status(500).json({ message: "Authentication error" });
  }
};

// Authenticated role middleware - validates session and checks roles
export const requireAuthenticatedRole = (allowedRoles: string[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { verifySessionCookie, SESSION_COOKIE_NAME } = await import('./lib/sessionCookies');
      const sessionCookie = req.cookies?.[SESSION_COOKIE_NAME];
      
      if (!sessionCookie) {
        return res.status(401).json({ message: "Admin authentication required" });
      }

      // Verify session cookie with revocation check
      let decodedClaims;
      try {
        decodedClaims = await verifySessionCookie(sessionCookie, true);
      } catch (error) {
        return res.status(401).json({ message: "Invalid or expired session" });
      }

      // Check if user has one of the allowed roles in Firestore
      const { db: firestoreDb } = await import('./lib/firebase-admin');
      const userDoc = await firestoreDb.collection('users').doc(decodedClaims.uid).get();
      const userData = userDoc.data();
      
      if (!userData?.role || !allowedRoles.includes(userData.role)) {
        return res.status(403).json({ message: "Insufficient permissions for this operation" });
      }

      // Set session adminId for backwards compatibility
      req.session.adminId = decodedClaims.uid;
      
      // Try to get admin user from storage
      const admin = await storage.getAdminUser(decodedClaims.uid);
      if (admin) {
        req.adminUser = admin;
      }

      next();
    } catch (error) {
      logger.error('Role auth error:', error);
      res.status(500).json({ message: "Authentication error" });
    }
  };
};

// Role-based authorization middleware (requires req.adminUser to be populated)
export const requireRole = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const adminUser = req.adminUser;
    
    if (!adminUser) {
      return res.status(401).json({ message: "Admin authentication required" });
    }

    if (!allowedRoles.includes(adminUser.role)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    next();
  };
};

// Super admin only middleware
export const requireSuperAdmin = requireRole(["super_admin"]);

// Regional admin or higher middleware
export const requireRegionalAdmin = requireRole(["super_admin", "regional_admin"]);

// Log admin activity
export const logAdminActivity = async (
  adminId: string,
  action: string,
  resource?: string,
  details?: any,
  req?: Request
) => {
  try {
    await storage.createAdminActivityLog({
      adminId,
      action,
      resource,
      details,
      ipAddress: req?.ip || req?.socket?.remoteAddress,
      userAgent: req?.get("User-Agent"),
    });
  } catch (error) {
    logger.error('Failed to log admin activity:', error);
  }
};

// Admin login helper
export const loginAdmin = async (email: string, password: string): Promise<AdminUser | null> => {
  try {
    // For now, we'll use a simple email-based login
    // In production, you'd want proper password hashing
    const admin = await storage.getAdminUserByEmail(email);
    
    if (!admin || !admin.isActive) {
      return null;
    }

    // Update last login
    await storage.updateAdminUser(admin.id, { lastLogin: new Date() });
    
    return admin;
  } catch (error) {
    logger.error('Admin login error:', error);
    return null;
  }
};

// Check if user has access to specific region
export const hasRegionAccess = (admin: AdminUser, region: string): boolean => {
  if (admin.role === "super_admin") return true;
  
  const regions = Array.isArray(admin.regions) ? admin.regions : [];
  return regions.includes(region);
};

// Check if user can manage specific resource
export const canManageResource = (admin: AdminUser, resourceType: string, resourceRegion?: string): boolean => {
  if (admin.role === "super_admin") return true;
  
  if (admin.role === "support") {
    // Support staff can only view, not manage
    return false;
  }
  
  if (admin.role === "regional_admin" && resourceRegion) {
    return hasRegionAccess(admin, resourceRegion);
  }
  
  return false;
};