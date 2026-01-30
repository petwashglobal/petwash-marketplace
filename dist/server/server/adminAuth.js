import { storage } from "./storage";
import { logger } from './lib/logger';
import { isSuperAdmin } from './middleware/rbac';
// Admin authentication middleware (Firebase-based)
export const requireAdmin = async (req, res, next) => {
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
        }
        catch (error) {
            return res.status(401).json({ message: "Invalid or expired session" });
        }
        // Check if user is admin in Firestore OR is a hardcoded super admin
        const { db: firestoreDb } = await import('./lib/firebase-admin');
        const userDoc = await firestoreDb.collection('users').doc(decodedClaims.uid).get();
        const userData = userDoc.data();
        const userEmail = decodedClaims.email?.toLowerCase() || '';
        // Allow access if user is in super admin list OR has admin role in Firestore
        const isSuperAdminUser = isSuperAdmin(userEmail);
        const hasAdminRole = userData?.role === 'admin' || userData?.role === 'super_admin';
        if (!isSuperAdminUser && !hasAdminRole) {
            logger.warn(`[Admin Auth] Access denied for ${userEmail} - not super admin and role=${userData?.role}`);
            return res.status(403).json({ message: "Admin access required" });
        }
        logger.info(`[Admin Auth] Access granted: ${userEmail} (superAdmin=${isSuperAdminUser}, role=${userData?.role || 'none'})`);
        // 🚨 OCTOPUS PROTOCOL: Admin Override Logging
        const endpoint = req.path;
        const method = req.method;
        const ip = req.ip || req.socket?.remoteAddress || 'unknown';
        logger.info(`🚨 HEAD OFFICE OVERRIDE by ${decodedClaims.uid} | ${method} ${endpoint} | IP: ${ip}`);
        // For backwards compatibility, set session adminId
        req.session.adminId = decodedClaims.uid;
        // Try to get admin user from storage
        const admin = await storage.getAdminUser(decodedClaims.uid);
        if (admin) {
            req.adminUser = admin;
            logger.info(`   → Admin Details: ${admin.email} | Role: ${admin.role} | Regions: ${admin.regions?.join(', ') || 'ALL'}`);
        }
        next();
    }
    catch (error) {
        logger.error('Admin auth error:', error);
        res.status(500).json({ message: "Authentication error" });
    }
};
// Authenticated role middleware - validates session and checks roles
export const requireAuthenticatedRole = (allowedRoles) => {
    return async (req, res, next) => {
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
            }
            catch (error) {
                return res.status(401).json({ message: "Invalid or expired session" });
            }
            // Check if user has one of the allowed roles in Firestore OR is a super admin
            const { db: firestoreDb } = await import('./lib/firebase-admin');
            const userDoc = await firestoreDb.collection('users').doc(decodedClaims.uid).get();
            const userData = userDoc.data();
            const userEmail = decodedClaims.email?.toLowerCase() || '';
            // Super admins bypass role checks
            const isSuperAdminUser = isSuperAdmin(userEmail);
            const hasAllowedRole = userData?.role && allowedRoles.includes(userData.role);
            if (!isSuperAdminUser && !hasAllowedRole) {
                logger.warn(`[Role Auth] Access denied for ${userEmail} - role=${userData?.role}, required=${allowedRoles.join(',')}`);
                return res.status(403).json({ message: "Insufficient permissions for this operation" });
            }
            // 🚨 OCTOPUS PROTOCOL: Role-Based Override Logging
            const endpoint = req.path;
            const method = req.method;
            const ip = req.ip || req.socket?.remoteAddress || 'unknown';
            const role = userData.role;
            // Different emoji based on role level
            const roleEmoji = role === 'super_admin' ? '👑' : role === 'regional_admin' ? '🏢' : '👤';
            logger.info(`${roleEmoji} ${role.toUpperCase()} ACCESS by ${decodedClaims.uid} | ${method} ${endpoint} | IP: ${ip}`);
            // Set session adminId for backwards compatibility
            req.session.adminId = decodedClaims.uid;
            // Try to get admin user from storage
            const admin = await storage.getAdminUser(decodedClaims.uid);
            if (admin) {
                req.adminUser = admin;
                logger.info(`   → Details: ${admin.email} | Allowed Roles: ${allowedRoles.join(', ')}`);
            }
            next();
        }
        catch (error) {
            logger.error('Role auth error:', error);
            res.status(500).json({ message: "Authentication error" });
        }
    };
};
// Role-based authorization middleware (requires req.adminUser to be populated)
export const requireRole = (allowedRoles) => {
    return async (req, res, next) => {
        const adminUser = req.adminUser;
        // Check if the request has firebaseUser with email for super admin check
        // Also check adminUser email as fallback
        const userEmail = req.firebaseUser?.email?.toLowerCase()
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
export const logAdminActivity = async (adminId, action, resource, details, req) => {
    try {
        // 🚨 OCTOPUS PROTOCOL: Activity-based emoji logging
        const actionEmojis = {
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
    }
    catch (error) {
        logger.error('Failed to log admin activity:', error);
    }
};
// Admin login helper
export const loginAdmin = async (email, password) => {
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
    }
    catch (error) {
        logger.error('Admin login error:', error);
        return null;
    }
};
// Check if user has access to specific region
export const hasRegionAccess = (admin, region) => {
    if (admin.role === "super_admin")
        return true;
    const regions = Array.isArray(admin.regions) ? admin.regions : [];
    return regions.includes(region);
};
// Check if user can manage specific resource
export const canManageResource = (admin, resourceType, resourceRegion) => {
    if (admin.role === "super_admin")
        return true;
    if (admin.role === "support") {
        // Support staff can only view, not manage
        return false;
    }
    if (admin.role === "regional_admin" && resourceRegion) {
        return hasRegionAccess(admin, resourceRegion);
    }
    return false;
};
