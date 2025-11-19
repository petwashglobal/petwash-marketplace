import express, { type Request, type Response } from 'express';
import { requireAuth } from '../customAuth';
import {
  getAllDepartments,
  getAllRoles,
  getAllPlatforms,
  getUserEffectiveRoles,
  assignRoleToUser,
  revokeRoleFromUser,
  isUserAdmin,
  initializeControlPanelRegistry,
} from '../services/ControlPanelRegistry';
import { logger } from '../lib/logger';
import { z } from 'zod';

const router = express.Router();

// Initialize registry on first load
let isInitialized = false;

async function ensureInitialized() {
  if (!isInitialized) {
    try {
      await initializeControlPanelRegistry();
      isInitialized = true;
    } catch (error) {
      logger.error('Failed to initialize Control Panel Registry:', error);
    }
  }
}

// ============================================================================
// PUBLIC ENDPOINTS - Registry data
// ============================================================================

/**
 * GET /api/control-panel/departments
 * Get all active departments
 */
router.get('/departments', requireAuth, async (req: Request, res: Response) => {
  try {
    await ensureInitialized();
    const departments = await getAllDepartments();
    res.json(departments);
  } catch (error) {
    logger.error('Error fetching departments:', error);
    res.status(500).json({ message: 'Failed to fetch departments' });
  }
});

/**
 * GET /api/control-panel/roles
 * Get all active roles with department information
 */
router.get('/roles', requireAuth, async (req: Request, res: Response) => {
  try {
    await ensureInitialized();
    const roles = await getAllRoles();
    res.json(roles);
  } catch (error) {
    logger.error('Error fetching roles:', error);
    res.status(500).json({ message: 'Failed to fetch roles' });
  }
});

/**
 * GET /api/control-panel/platforms
 * Get all active control panel platforms
 */
router.get('/platforms', requireAuth, async (req: Request, res: Response) => {
  try {
    await ensureInitialized();
    const platforms = await getAllPlatforms();
    res.json(platforms);
  } catch (error) {
    logger.error('Error fetching platforms:', error);
    res.status(500).json({ message: 'Failed to fetch platforms' });
  }
});

// ============================================================================
// USER ROLE MANAGEMENT ENDPOINTS
// ============================================================================

/**
 * GET /api/control-panel/user/:userId/roles
 * Get all roles assigned to a specific user
 */
router.get('/user/:userId/roles', requireAuth, async (req: Request, res: Response) => {
  try {
    await ensureInitialized();
    const { userId } = req.params;
    
    // Users can view their own roles, admins can view any user's roles
    const requestingUserId = (req as any).userId;
    const isAdmin = await isUserAdmin(requestingUserId);
    
    if (userId !== requestingUserId && !isAdmin) {
      return res.status(403).json({ 
        message: 'Access denied. You can only view your own roles.' 
      });
    }

    const userRoles = await getUserEffectiveRoles(userId);
    res.json(userRoles);
  } catch (error) {
    logger.error('Error fetching user roles:', error);
    res.status(500).json({ message: 'Failed to fetch user roles' });
  }
});

/**
 * POST /api/control-panel/user/:userId/roles
 * Assign a role to a user (admin only)
 */
router.post('/user/:userId/roles', requireAuth, async (req: Request, res: Response) => {
  try {
    await ensureInitialized();
    const { userId } = req.params;
    const requestingUserId = (req as any).userId;

    // Only admins can assign roles
    const isAdmin = await isUserAdmin(requestingUserId);
    if (!isAdmin) {
      return res.status(403).json({ 
        message: 'Access denied. Only admins can assign roles.' 
      });
    }

    // Validate request body
    const assignRoleSchema = z.object({
      roleKey: z.string().min(1, 'Role key is required'),
      scopeType: z.string().nullable().optional(),
      scopeId: z.string().nullable().optional(),
    });

    const validatedData = assignRoleSchema.parse(req.body);

    // Assign role
    const assigned = await assignRoleToUser(
      userId,
      validatedData.roleKey,
      validatedData.scopeType || null,
      validatedData.scopeId || null,
      requestingUserId
    );

    logger.info(`Role ${validatedData.roleKey} assigned to user ${userId} by ${requestingUserId}`);
    res.status(201).json(assigned);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        message: 'Validation error', 
        errors: error.errors 
      });
    }
    
    if (error instanceof Error) {
      if (error.message.includes('Role not found') || error.message.includes('already assigned')) {
        return res.status(400).json({ message: error.message });
      }
    }

    logger.error('Error assigning role:', error);
    res.status(500).json({ message: 'Failed to assign role' });
  }
});

/**
 * DELETE /api/control-panel/user/:userId/roles/:roleId
 * Revoke a role from a user (admin only)
 */
router.delete('/user/:userId/roles/:roleId', requireAuth, async (req: Request, res: Response) => {
  try {
    await ensureInitialized();
    const { userId, roleId } = req.params;
    const requestingUserId = (req as any).userId;

    // Only admins can revoke roles
    const isAdmin = await isUserAdmin(requestingUserId);
    if (!isAdmin) {
      return res.status(403).json({ 
        message: 'Access denied. Only admins can revoke roles.' 
      });
    }

    // Validate roleId is a number
    const userRoleId = parseInt(roleId, 10);
    if (isNaN(userRoleId)) {
      return res.status(400).json({ message: 'Invalid role ID' });
    }

    // Revoke role
    const revoked = await revokeRoleFromUser(userId, userRoleId);

    logger.info(`Role ${userRoleId} revoked from user ${userId} by ${requestingUserId}`);
    res.json({ message: 'Role revoked successfully', revoked });
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      return res.status(404).json({ message: error.message });
    }

    logger.error('Error revoking role:', error);
    res.status(500).json({ message: 'Failed to revoke role' });
  }
});

// ============================================================================
// INITIALIZATION ENDPOINT (Dev/Admin only)
// ============================================================================

/**
 * POST /api/control-panel/initialize
 * Manually trigger registry initialization (admin only)
 */
router.post('/initialize', requireAuth, async (req: Request, res: Response) => {
  try {
    const requestingUserId = (req as any).userId;
    const isAdmin = await isUserAdmin(requestingUserId);
    
    if (!isAdmin) {
      return res.status(403).json({ 
        message: 'Access denied. Only admins can initialize the registry.' 
      });
    }

    await initializeControlPanelRegistry();
    isInitialized = true;

    res.json({ message: 'Control Panel Registry initialized successfully' });
  } catch (error) {
    logger.error('Error initializing registry:', error);
    res.status(500).json({ message: 'Failed to initialize registry' });
  }
});

export default router;
