import { Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import { AdminUser } from "@shared/schema";
import { logger } from './lib/logger';
import { isSuperAdmin } from './middleware/rbac';
import { ADMIN_ROLES } from '@shared/adminRoles';

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

const ADMIN_SESSION_MAX_AGE_SECONDS = 14400;

async function resolveClaimsBasedAuth(req: Request, res: Response): Promise<{
  decoded: any;
  claims: Record<string, any>;
  role: string;
  isSuperAdminUser: boolean;
  sessionAge: number;
  ip: string;
} | null> {
  const { verifySessionCookie, SESSION_COOKIE_NAME } = await import('./lib/sessionCookies');
  const sessionCookie = req.cookies?.[SESSION_COOKIE_NAME];
  const bearerToken = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : null;

  if (!sessionCookie && !bearerToken) {
    res.status(401).json({ message: "Admin authentication required" });
    return null;
  }

  let decoded: any;
  try {
    if (sessionCookie) {
      decoded = await verifySessionCookie(sessionCookie, true);
    } else {
      // Bearer token fallback for programmatic / localStorage-based admin logins
      const { adminAuth: fbAdmin } = await import('./lib/firebase-admin');
      decoded = await fbAdmin.verifyIdToken(bearerToken!, true);
    }
  } catch (error) {
    res.status(401).json({ message: "Invalid or expired session" });
    return null;
  }

  const authTime = decoded.auth_time ? decoded.auth_time * 1000 : Date.now();
  const sessionAge = Math.floor((Date.now() - authTime) / 1000);

  if (sessionAge > ADMIN_SESSION_MAX_AGE_SECONDS) {
    logger.warn(`[Admin Auth] Session too old for admin access: ${sessionAge}s > ${ADMIN_SESSION_MAX_AGE_SECONDS}s`);
    res.status(401).json({
      message: "Admin session expired. Please re-authenticate.",
      sessionExpired: true,
      maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
      currentAge: sessionAge,
    });
    return null;
  }

  const { adminAuth: fbAdminAuth } = await import('./lib/firebase-admin');
  const userRecord = await fbAdminAuth.getUser(decoded.uid);
  const claims = (userRecord.customClaims || {}) as Record<string, any>;

  let role = claims.role || 'public';
  if (!claims.role) {
    if (claims.accountType === 'internal') role = 'staff';
    else if (claims.accountType === 'provider') role = 'provider';
    else role = 'public';
  }

  const userEmail = (decoded.email || '').toLowerCase();
  const isSuperAdminUser = isSuperAdmin(userEmail);
  if (isSuperAdminUser) role = 'super_admin';

  const ip = req.ip || req.socket?.remoteAddress || 'unknown';

  return { decoded, claims, role, isSuperAdminUser, sessionAge, ip };
}

export const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const auth = await resolveClaimsBasedAuth(req, res);
    if (!auth) return;

    const { decoded, claims, role, isSuperAdminUser, sessionAge, ip } = auth;
    const userEmail = (decoded.email || '').toLowerCase();

    const adminRoles = ['admin', 'management', 'super_admin'];
    const hasAdminClaim = isSuperAdminUser || adminRoles.includes(role) || adminRoles.includes(claims.role);

    if (!hasAdminClaim) {
      logger.warn(`[Admin Auth] Access denied for ${userEmail} - claims.role=${claims.role}, resolved=${role}`);
      return res.status(403).json({ message: "Admin access required" });
    }

    logger.info(`[Admin Auth] Access granted: ${userEmail} (superAdmin=${isSuperAdminUser}, role=${role}, session=${sessionAge}s)`);

    const endpoint = req.path;
    const method = req.method;
    logger.info(`🚨 HEAD OFFICE OVERRIDE by ${decoded.uid} | ${method} ${endpoint} | IP: ${ip}`);

    req.session.adminId = decoded.uid;
    (req as any).user = { uid: decoded.uid, email: decoded.email };

    const admin = await storage.getAdminUser(decoded.uid);
    if (admin) {
      req.adminUser = admin;
    }

    next();
  } catch (error) {
    logger.error('Admin auth error:', error);
    res.status(500).json({ message: "Authentication error" });
  }
};

export const requireAuthenticatedRole = (allowedRoles: string[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const auth = await resolveClaimsBasedAuth(req, res);
      if (!auth) return;

      const { decoded, claims, role, isSuperAdminUser, sessionAge, ip } = auth;
      const userEmail = (decoded.email || '').toLowerCase();

      const hasAllowedRole = isSuperAdminUser
        || allowedRoles.includes(role)
        || (claims.role && allowedRoles.includes(claims.role));

      if (!hasAllowedRole) {
        logger.warn(`[Role Auth] Access denied for ${userEmail} - claims.role=${claims.role}, resolved=${role}, required=${allowedRoles.join(',')}`);
        return res.status(403).json({ message: "Insufficient permissions for this operation" });
      }

      const roleEmoji = role === 'super_admin' ? '👑' : role === 'admin' ? '🏢' : '👤';
      logger.info(`${roleEmoji} ${role.toUpperCase()} ACCESS by ${decoded.uid} | ${req.method} ${req.path} | IP: ${ip} | session=${sessionAge}s`);

      req.session.adminId = decoded.uid;

      const admin = await storage.getAdminUser(decoded.uid);
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
  return async (req: Request, res: Response, next: NextFunction) => {
    const adminUser = req.adminUser;
    
    // Check if the request has firebaseUser with email for super admin check
    // Also check adminUser email as fallback
    const userEmail = (req as any).firebaseUser?.email?.toLowerCase() 
      || adminUser?.email?.toLowerCase() 
      || '';
    
    // Super admins always have access
    if (userEmail && isSuperAdmin(userEmail)) {
      return next();
    }
    
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

// Log admin activity (with Octopus Protocol emoji alerts)
export const logAdminActivity = async (
  adminId: string,
  action: string,
  resource?: string,
  details?: any,
  req?: Request
) => {
  try {
    // 🚨 OCTOPUS PROTOCOL: Activity-based emoji logging
    const actionEmojis: Record<string, string> = {
      'create': '➕',
      'update': '✏️',
      'delete': '🗑️',
      'approve': '✅',
      'reject': '❌',
      'export': '📤',
      'import': '📥',
      'access': '🔑',
      'login': '🔐',
      'logout': '🚪',
      'fraud_check': '🚨',
      'payment': '💳',
      'refund': '💸',
    };
    
    const emoji = actionEmojis[action.toLowerCase()] || '📋';
    const ip = req?.ip || req?.socket?.remoteAddress || 'unknown';
    
    logger.info(`${emoji} ADMIN ACTION: ${action} | Resource: ${resource || 'N/A'} | Admin: ${adminId} | IP: ${ip}`);
    
    if (details && Object.keys(details).length > 0) {
      logger.info(`   → Details: ${JSON.stringify(details).substring(0, 200)}`);
    }
    
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