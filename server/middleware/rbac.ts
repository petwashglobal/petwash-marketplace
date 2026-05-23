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

// Super Admin emails — loaded from SUPER_ADMIN_EMAILS environment variable only.
// No hardcoded fallback. If the env var is not set the list is empty (fail-closed).
// To configure: set SUPER_ADMIN_EMAILS as a comma-separated list in secrets.
// Example: SUPER_ADMIN_EMAILS=ceo@petwash.co.il,ops@petwash.co.il

function loadSuperAdmins(): string[] {
  const raw = process.env.SUPER_ADMIN_EMAILS || '';
  if (!raw.trim()) {
    logger.error('[RBAC] SUPER_ADMIN_EMAILS env var is not set — super-admin gate is CLOSED');
    return [];
  }
  // Detect unset placeholder created by CI bootstrap — treat as missing.
  if (raw.toUpperCase().includes('PLACEHOLDER')) {
    logger.error(
      '[RBAC] SUPER_ADMIN_EMAILS contains placeholder text — secret was never updated with real emails. ' +
      'Run: printf \'admin@example.com\' | gcloud secrets versions add SUPER_ADMIN_EMAILS --project=<PROJECT> --data-file=- ' +
      '— super-admin gate is CLOSED until this is fixed.',
    );
    return [];
  }
  return raw.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
}

// Lazily resolved on first call; re-read on each process if needed.
// To invalidate at runtime: clear the cache below (for hot-reload scenarios).
let _superAdminCache: string[] | null = null;
function getSuperAdmins(): string[] {
  if (_superAdminCache === null) {
    _superAdminCache = loadSuperAdmins();
  }
  return _superAdminCache;
}

// Extended Request with user role information
// Note: firebaseUser is already globally declared in Express Request by firebase-auth.ts
export interface AuthenticatedRequest extends Request {
  userRole?: {
    role: SystemRole;
    assignment: UserRoleAssignment;
    isSuperAdmin: boolean;
  };
  // KYC delete route flags
  isDeletingSelf?: boolean;
  isAdminDelete?: boolean;
}

/**
 * Check if an email matches the SUPER_ADMIN_EMAILS allowlist.
 *
 * SECURITY NOTE (PR-A P0-2): This primitive does NOT check
 * `email_verified`. New code must use {@link isSuperAdminVerified}
 * which gates on both the allowlist AND Firebase's email_verified
 * flag. Existing call sites are tracked for follow-up hardening; this
 * primitive is kept for backwards compatibility while those are
 * migrated route-by-route.
 */
export function isSuperAdmin(email: string): boolean {
  return getSuperAdmins().includes(email.toLowerCase());
}

/**
 * Strict super-admin check that requires Firebase to have verified the
 * email address. Use this on any new admin gate — if the user's email
 * is not yet verified the function returns false even when the email
 * matches SUPER_ADMIN_EMAILS.
 *
 * Why this exists (PR-A P0-2): the legacy primitive {@link isSuperAdmin}
 * checks only the email string. An attacker who registers an account
 * with an email matching the allowlist but who has not verified it
 * could otherwise pass the gate.
 *
 * Returns false if any of:
 *   - req.firebaseUser is missing
 *   - req.firebaseUser.email is empty
 *   - req.firebaseUser.email_verified is not strictly true
 *   - the email does not match SUPER_ADMIN_EMAILS
 */
export function isSuperAdminVerified(req: Request): boolean {
  const fu = req.firebaseUser;
  if (!fu) return false;
  if (fu.email_verified !== true) return false;
  const email = fu.email;
  if (!email) return false;
  return isSuperAdmin(email);
}

/**
 * Invalidate super-admin cache (call after updating SUPER_ADMIN_EMAILS at runtime).
 */
export function invalidateSuperAdminCache(): void {
  _superAdminCache = null;
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

/**
 * Require internal account type (blocks customer accounts from internal routes)
 * This enforces STRICT separation between public users and internal staff/contractors
 */
export async function requireInternalAccount(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.firebaseUser?.uid || !req.firebaseUser?.email) {
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'User not authenticated'
      });
    }

    const userEmail = req.firebaseUser.email.toLowerCase();

    // Super admins always have internal access
    if (isSuperAdmin(userEmail)) {
      return next();
    }

    // Check Firebase custom claims first (faster than Firestore)
    const { adminAuth } = await import('../lib/firebase-admin');
    const userRecord = await adminAuth.getUser(req.firebaseUser.uid);
    const claims = userRecord.customClaims || {};
    
    if (claims.accountType === 'internal') {
      return next();
    }

    // Fallback to Firestore check if claims not set
    const { db: firestoreDb } = await import('../lib/firebase-admin');
    const profileDoc = await firestoreDb
      .collection('users')
      .doc(req.firebaseUser.uid)
      .collection('profile')
      .doc('data')
      .get();

    if (!profileDoc.exists) {
      return res.status(403).json({ 
        error: 'Access denied',
        message: 'No profile found'
      });
    }

    const profileData = profileDoc.data();
    
    if (profileData?.accountType !== 'internal') {
      logger.warn(`Internal access denied for customer account: ${userEmail}`);
      return res.status(403).json({ 
        error: 'Access denied',
        message: 'This area is restricted to internal staff only'
      });
    }

    next();
  } catch (error) {
    logger.error('Error in requireInternalAccount middleware:', error);
    res.status(500).json({ error: 'Failed to verify account access' });
  }
}

/**
 * Require customer account type (for public-facing routes)
 * This prevents internal accounts from accidentally using customer features
 */
export async function requireCustomerAccount(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.firebaseUser?.uid) {
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'User not authenticated'
      });
    }

    const { db: firestoreDb } = await import('../lib/firebase-admin');
    const profileDoc = await firestoreDb
      .collection('users')
      .doc(req.firebaseUser.uid)
      .collection('profile')
      .doc('data')
      .get();

    if (!profileDoc.exists) {
      return next(); // Allow if no profile (new user)
    }

    const profileData = profileDoc.data();
    
    // Internal users should use internal dashboards, not customer features
    if (profileData?.accountType === 'internal') {
      return res.status(403).json({ 
        error: 'Access denied',
        message: 'Internal staff should use the admin dashboard instead'
      });
    }

    next();
  } catch (error) {
    logger.error('Error in requireCustomerAccount middleware:', error);
    res.status(500).json({ error: 'Failed to verify account access' });
  }
}

export const ROLE_HIERARCHY: Record<string, number> = {
  'public': 1,
  'pet_parent': 1,
  'provider': 2,
  'franchise_owner': 3,
  'pending_staff': 3,
  'staff': 4,
  // M8: accountant — read-only access to invoices ready_for_accountant +
  // the "mark entered in SUMIT" action. Cannot upload, approve, reject, or
  // see the SUMIT control panel. Slots between staff(4) and admin(6) so
  // existing access-level-6/8 checks still exclude accountants.
  'accountant': 5,
  'admin': 6,
  'hr': 7,
  'management': 8,
  'super_admin': 10,
};

export const PUBLIC_ALLOWED_ROUTES = [
  '/api/loyalty',
  '/api/gift-cards',
  '/api/egift',
  '/api/vouchers',
  '/api/wallet',
  '/api/credit-wallet',
  '/api/auth',
  '/api/profile',
  '/api/pets',
  '/api/marketplace-bookings/search',
  '/api/stations/public',
  '/api/referral',
  '/api/weather',
  '/api/k9000/public',
];

function getUserRoleFromClaims(claims: Record<string, any>): string {
  if (claims.role) return claims.role;
  if (claims.accountType === 'internal') return 'staff';
  if (claims.accountType === 'provider') return 'provider';
  return 'public';
}

export async function requirePublicUser(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.firebaseUser?.uid) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Please sign in to access this feature',
      });
    }
    next();
  } catch (error) {
    logger.error('Error in requirePublicUser middleware:', error);
    res.status(500).json({ error: 'Failed to verify access' });
  }
}

export async function blockPublicUser(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.firebaseUser?.uid || !req.firebaseUser?.email) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Please sign in to access this feature',
      });
    }

    const userEmail = req.firebaseUser.email.toLowerCase();

    if (isSuperAdmin(userEmail)) {
      return next();
    }

    const { adminAuth } = await import('../lib/firebase-admin');
    const userRecord = await adminAuth.getUser(req.firebaseUser.uid);
    const claims = (userRecord.customClaims || {}) as Record<string, any>;
    const role = getUserRoleFromClaims(claims);
    const roleLevel = ROLE_HIERARCHY[role] || 1;

    if (roleLevel <= ROLE_HIERARCHY['public']) {
      logger.warn(`[RBAC] Public user blocked from internal route: ${userEmail} -> ${req.path}`);
      return res.status(403).json({
        error: 'Access denied',
        message: 'This area is restricted to authorized personnel only',
        role: 'public',
      });
    }

    next();
  } catch (error) {
    logger.error('Error in blockPublicUser middleware:', error);
    res.status(500).json({ error: 'Failed to verify access level' });
  }
}

export async function requireMinRole(minRole: string) {
  const minLevel = ROLE_HIERARCHY[minRole] || 1;

  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.firebaseUser?.uid || !req.firebaseUser?.email) {
        return res.status(401).json({
          error: 'Authentication required',
        });
      }

      const userEmail = req.firebaseUser.email.toLowerCase();

      if (isSuperAdmin(userEmail)) {
        return next();
      }

      const { adminAuth } = await import('../lib/firebase-admin');
      const userRecord = await adminAuth.getUser(req.firebaseUser.uid);
      const claims = (userRecord.customClaims || {}) as Record<string, any>;
      const role = getUserRoleFromClaims(claims);
      const roleLevel = ROLE_HIERARCHY[role] || 1;

      if (roleLevel < minLevel) {
        logger.warn(`[RBAC] Insufficient role: ${userEmail} has ${role} (${roleLevel}), needs ${minRole} (${minLevel})`);
        return res.status(403).json({
          error: 'Access denied',
          message: `This action requires ${minRole} access or higher`,
        });
      }

      next();
    } catch (error) {
      logger.error('Error in requireMinRole middleware:', error);
      res.status(500).json({ error: 'Failed to verify access level' });
    }
  };
}

export function enforceSelfOnly(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  if (!req.firebaseUser?.uid) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const bodyUserId = req.body?.userId || req.body?.uid;
  const queryUserId = req.query?.userId || req.query?.uid;
  const paramUserId = req.params?.userId || req.params?.uid;

  const requestedUserId = bodyUserId || queryUserId || paramUserId;

  if (requestedUserId && requestedUserId !== req.firebaseUser.uid) {
    const userEmail = req.firebaseUser.email || 'unknown';
    if (!isSuperAdmin(userEmail)) {
      logger.warn(`[RBAC] Self-only violation: ${userEmail} tried to access data for ${requestedUserId}`);
      return res.status(403).json({
        error: 'Access denied',
        message: 'You can only access your own data',
      });
    }
  }

  next();
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
  requireAdmin,
  requireInternalAccount,
  requireCustomerAccount,
  requirePublicUser,
  blockPublicUser,
  requireMinRole,
  enforceSelfOnly,
  ROLE_HIERARCHY,
  PUBLIC_ALLOWED_ROUTES,
};
