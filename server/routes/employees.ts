import { Router, Request, Response } from 'express';
import { db, auth as firebaseAdmin } from '../lib/firebase-admin';
import { 
  employeeProfileSchema, 
  insertEmployeeProfileSchema,
  FIRESTORE_PATHS 
} from '@shared/firestore-schema';
import { loadEmployeeProfile, requireRole, requirePermission } from '../middleware/roleAuth';
import { validateFirebaseToken } from '../middleware/firebase-auth';
import { logger } from '../lib/logger';
import { z } from 'zod';

const router = Router();

// All employee routes require authentication
router.use(validateFirebaseToken);
router.use(loadEmployeeProfile);

/**
 * GET /api/employees - List all employees
 * Admin and Ops only
 * Supports both new (employees/{uid}) and legacy (users/{uid}/employee/profile) paths
 */
router.get('/', requireRole(['admin', 'ops']), async (req: Request, res: Response) => {
  try {
    const employees: any[] = [];
    
    // Query new location: employees collection
    const newSnapshot = await db.collection('employees').get();
    newSnapshot.forEach((doc) => {
      const data = doc.data();
      employees.push({
        ...data,
        createdAt: data.createdAt?.toDate(),
        updatedAt: data.updatedAt?.toDate(),
        lastLoginAt: data.lastLoginAt?.toDate(),
      });
    });
    
    // Query legacy location: users/*/employee/profile
    const legacySnapshot = await db.collectionGroup('employee').get();
    legacySnapshot.forEach((doc) => {
      if (doc.id === 'profile') {
        const data = doc.data();
        // Only add if not already in new location
        const existsInNew = employees.some(e => e.uid === data.uid);
        if (!existsInNew) {
          employees.push({
            ...data,
            createdAt: data.createdAt?.toDate(),
            updatedAt: data.updatedAt?.toDate(),
            lastLoginAt: data.lastLoginAt?.toDate(),
          });
        }
      }
    });

    // Sort by creation date (newest first)
    employees.sort((a, b) => 
      (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0)
    );

    res.json({ employees });
  } catch (error) {
    logger.error('Error listing employees:', error);
    res.status(500).json({ error: 'Failed to list employees' });
  }
});

/**
 * GET /api/employees/:uid - Get specific employee
 * Admin and Ops only
 * Supports both new (employees/{uid}) and legacy (users/{uid}/employee/profile) paths
 */
router.get('/:uid', requireRole(['admin', 'ops']), async (req: Request, res: Response) => {
  try {
    const { uid } = req.params;
    
    // Try new path first
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
      return res.status(404).json({ error: 'Employee not found' });
    }

    const data = employeeDoc.data();
    const employee = {
      ...data,
      createdAt: data?.createdAt?.toDate(),
      updatedAt: data?.updatedAt?.toDate(),
      lastLoginAt: data?.lastLoginAt?.toDate(),
    };

    res.json({ employee });
  } catch (error) {
    logger.error('Error getting employee:', error);
    res.status(500).json({ error: 'Failed to get employee' });
  }
});

/**
 * POST /api/employees - Create new employee
 * Admin only
 */
router.post('/', requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validation = insertEmployeeProfileSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: validation.error.errors 
      });
    }
    
    const employeeData = validation.data;

    // Create Firebase Auth user
    const userRecord = await firebaseAdmin.createUser({
      email: employeeData.email,
      emailVerified: false,
      displayName: employeeData.fullName,
      disabled: false,
    });

    logger.info(`Created Firebase user for employee: ${userRecord.uid}`);

    // Create employee profile in Firestore at employees/{uid}
    const profile = {
      uid: userRecord.uid,
      fullName: employeeData.fullName,
      email: employeeData.email,
      phone: employeeData.phone || '',
      role: employeeData.role,
      stations: employeeData.stations || [],
      status: 'active', // Correct field name from schema
      employeeId: employeeData.employeeId || '',
      notes: employeeData.notes || '',
      createdAt: new Date(),
      createdBy: req.employee!.uid,
      updatedAt: new Date(),
    };

    // Store at employees/{uid}
    await db.collection('employees').doc(userRecord.uid).set(profile);

    logger.info(`Created employee profile for ${employeeData.email}`, {
      uid: userRecord.uid,
      role: employeeData.role,
      createdBy: req.employee!.email,
    });

    res.status(201).json({ 
      message: 'Employee created successfully',
      employee: profile,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Validation error', 
        details: error.errors 
      });
    }
    
    logger.error('Error creating employee:', error);
    res.status(500).json({ error: 'Failed to create employee' });
  }
});

/**
 * PUT /api/employees/:uid - Update employee
 * Admin only
 * Updates both new and legacy locations if they exist
 */
router.put('/:uid', requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const { uid } = req.params;
    
    // Validate partial update
    const updateSchema = insertEmployeeProfileSchema.partial();
    const validation = updateSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: validation.error.errors 
      });
    }
    
    const updates: any = validation.data;

    // Check new location
    const newDoc = await db.collection('employees').doc(uid).get();
    
    // Check legacy location
    const legacyDoc = await db
      .collection('users')
      .doc(uid)
      .collection('employee')
      .doc('profile')
      .get();

    if (!newDoc.exists && !legacyDoc.exists) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const updateData = {
      ...updates,
      updatedAt: new Date(),
    };

    // Update both locations if they exist (ensures consistency during migration)
    if (newDoc.exists) {
      await newDoc.ref.update(updateData);
    }
    
    if (legacyDoc.exists) {
      await legacyDoc.ref.update(updateData);
    }

    // Update Firebase Auth if email or name changed
    const authUpdates: any = {};
    if (updates.email) authUpdates.email = updates.email;
    if (updates.fullName) authUpdates.displayName = updates.fullName;
    
    if (Object.keys(authUpdates).length > 0) {
      await firebaseAdmin.updateUser(uid, authUpdates);
    }

    logger.info(`Updated employee ${uid}`, {
      updates,
      updatedBy: req.employee!.email,
    });

    res.json({ message: 'Employee updated successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Validation error', 
        details: error.errors 
      });
    }
    
    logger.error('Error updating employee:', error);
    res.status(500).json({ error: 'Failed to update employee' });
  }
});

/**
 * POST /api/employees/:uid/suspend - Suspend employee
 * Admin only
 * Updates both locations for backward compatibility
 */
router.post('/:uid/suspend', requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const { uid } = req.params;
    
    const updateData = {
      status: 'suspended',
      isActive: false,
      updatedAt: new Date(),
    };
    
    // Update both locations (new and legacy)
    const newDoc = await db.collection('employees').doc(uid).get();
    const legacyDoc = await db.collection('users').doc(uid).collection('employee').doc('profile').get();
    
    if (newDoc.exists) {
      await newDoc.ref.update(updateData);
    }
    if (legacyDoc.exists) {
      await legacyDoc.ref.update(updateData);
    }

    // Disable Firebase Auth
    await firebaseAdmin.updateUser(uid, { disabled: true });

    // Revoke all sessions
    await firebaseAdmin.revokeRefreshTokens(uid);

    logger.warn(`Employee suspended: ${uid}`, {
      suspendedBy: req.employee!.email,
    });

    res.json({ message: 'Employee suspended successfully' });
  } catch (error) {
    logger.error('Error suspending employee:', error);
    res.status(500).json({ error: 'Failed to suspend employee' });
  }
});

/**
 * POST /api/employees/:uid/activate - Activate employee
 * Admin only
 * Updates both locations for backward compatibility
 */
router.post('/:uid/activate', requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const { uid } = req.params;
    
    const updateData = {
      status: 'active',
      isActive: true,
      updatedAt: new Date(),
    };
    
    // Update both locations (new and legacy)
    const newDoc = await db.collection('employees').doc(uid).get();
    const legacyDoc = await db.collection('users').doc(uid).collection('employee').doc('profile').get();
    
    if (newDoc.exists) {
      await newDoc.ref.update(updateData);
    }
    if (legacyDoc.exists) {
      await legacyDoc.ref.update(updateData);
    }

    // Enable Firebase Auth
    await firebaseAdmin.updateUser(uid, { disabled: false });

    logger.info(`Employee activated: ${uid}`, {
      activatedBy: req.employee!.email,
    });

    res.json({ message: 'Employee activated successfully' });
  } catch (error) {
    logger.error('Error activating employee:', error);
    res.status(500).json({ error: 'Failed to activate employee' });
  }
});

/**
 * POST /api/employees/:uid/send-invite - Send password setup email
 * Admin only
 * Supports both locations
 */
router.post('/:uid/send-invite', requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const { uid } = req.params;
    
    // Try new location first
    let employeeDoc = await db.collection('employees').doc(uid).get();
    
    // Fallback to legacy location
    if (!employeeDoc.exists) {
      employeeDoc = await db.collection('users').doc(uid).collection('employee').doc('profile').get();
    }

    if (!employeeDoc.exists) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const employee = employeeDoc.data();
    
    // Generate password reset link
    const resetLink = await firebaseAdmin.generatePasswordResetLink(employee?.email);

    logger.info(`Password reset link generated for ${employee?.email}`, {
      uid,
      generatedBy: req.employee!.email,
    });

    res.json({ 
      message: 'Invite email sent successfully',
      resetLink,
    });
  } catch (error) {
    logger.error('Error sending invite:', error);
    res.status(500).json({ error: 'Failed to send invite' });
  }
});

/**
 * POST /api/employees/:uid/generate-mobile-link - Generate one-tap login link
 * Admin only
 * Supports both locations and field names
 */
router.post('/:uid/generate-mobile-link', requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const { uid } = req.params;
    const { redirect } = req.body;
    
    // Try new location first
    let employeeDoc = await db.collection('employees').doc(uid).get();
    
    // Fallback to legacy location
    if (!employeeDoc.exists) {
      employeeDoc = await db.collection('users').doc(uid).collection('employee').doc('profile').get();
    }

    if (!employeeDoc.exists) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const employee = employeeDoc.data();
    
    // Check if employee is active (support both field names)
    const isActive = employee?.status === 'active' || employee?.isActive === true;
    if (!isActive) {
      return res.status(403).json({ 
        error: 'Cannot generate link for inactive employee' 
      });
    }

    // Generate custom Firebase token (valid for 1 hour)
    const customToken = await firebaseAdmin.createCustomToken(uid);
    
    // Create one-tap login URL
    const baseUrl = process.env.BASE_URL || 'https://petwash.co.il';
    const redirectPath = redirect || '/m';
    const oneTapUrl = `${baseUrl}/ops/one-tap-employee?token=${encodeURIComponent(customToken)}&redirect=${encodeURIComponent(redirectPath)}`;
    
    logger.info(`Generated one-tap login link for employee ${employee?.email}`, {
      uid,
      redirect: redirectPath,
      generatedBy: req.employee!.email,
    });

    res.json({ 
      message: 'One-tap login link generated',
      url: oneTapUrl,
      expiresIn: '1 hour',
    });
  } catch (error) {
    logger.error('Error generating mobile link:', error);
    res.status(500).json({ error: 'Failed to generate mobile link' });
  }
});

/**
 * DELETE /api/employees/:uid - Delete employee (soft delete)
 * Admin only
 * Updates both locations for backward compatibility
 */
router.delete('/:uid', requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const { uid } = req.params;
    
    const updateData = {
      status: 'inactive',
      isActive: false,
      updatedAt: new Date(),
    };
    
    // Update both locations (new and legacy)
    const newDoc = await db.collection('employees').doc(uid).get();
    const legacyDoc = await db.collection('users').doc(uid).collection('employee').doc('profile').get();
    
    if (newDoc.exists) {
      await newDoc.ref.update(updateData);
    }
    if (legacyDoc.exists) {
      await legacyDoc.ref.update(updateData);
    }

    // Disable Firebase Auth
    await firebaseAdmin.updateUser(uid, { disabled: true });

    logger.warn(`Employee deleted (soft): ${uid}`, {
      deletedBy: req.employee!.email,
    });

    res.json({ message: 'Employee deleted successfully' });
  } catch (error) {
    logger.error('Error deleting employee:', error);
    res.status(500).json({ error: 'Failed to delete employee' });
  }
});

export default router;
