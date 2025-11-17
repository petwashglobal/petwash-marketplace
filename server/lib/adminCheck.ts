import { Request, Response, NextFunction } from "express";
import { logger } from './logger';

/**
 * Reusable admin role check helper
 * ✅ SECURITY: Validates user has admin or super_admin role via Firestore
 * 
 * Usage:
 * 1. As middleware: router.get('/admin-route', validateFirebaseToken, requireAdminRole, handler)
 * 2. Inline check: const isAdmin = await checkUserIsAdmin(uid);
 */

/**
 * Check if user has admin role (returns boolean)
 */
export async function checkUserIsAdmin(uid: string): Promise<boolean> {
  try {
    const { db: firestoreDb } = await import('./firebase-admin');
    const userDoc = await firestoreDb.collection('users').doc(uid).get();
    const userData = userDoc.data();
    
    return userData?.role === 'admin' || userData?.role === 'super_admin';
  } catch (error) {
    logger.error('[AdminCheck] Error checking admin status:', error);
    return false;
  }
}

/**
 * Express middleware - requires admin role
 * Use after validateFirebaseToken middleware
 */
export async function requireAdminRole(req: any, res: Response, next: NextFunction) {
  const uid = req.firebaseUser?.uid;
  
  if (!uid) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  const isAdmin = await checkUserIsAdmin(uid);
  
  if (!isAdmin) {
    logger.warn(`[AdminCheck] 🚨 Unauthorized admin access attempt by ${uid} to ${req.method} ${req.path}`);
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  logger.info(`[AdminCheck] ✅ Admin access granted to ${uid} for ${req.method} ${req.path}`);
  next();
}
