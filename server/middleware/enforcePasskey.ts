/**
 * Passkey Enforcement Middleware
 * Requires L8+ users to have enrolled a passkey before accessing protected resources
 */

import type { Request, Response, NextFunction } from 'express';
import { getUserRoleLevel } from '../services/rbac';
import { hasAnyPasskeyForUser } from '../services/devices';
import { logger } from '../lib/logger';

/**
 * Enforce passkey enrollment for Level 8+ users
 * 
 * Policy:
 * - Level 9-10 (CEO, Director, Legal): Passkey mandatory
 * - Level 8 (Operations, Finance): Passkey mandatory
 * - Level 5 (Franchisee): Optional, encouraged
 * - Lower levels: Optional
 */
export async function enforcePasskeyForLevel8(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const uid = (req as any).firebaseUser?.uid;
    
    if (!uid) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Get user's access level
    const level = await getUserRoleLevel(uid);
    
    // If level < 8, no passkey required
    if (level < 8) {
      next();
      return;
    }

    // Check if user has enrolled a passkey
    const hasPasskey = await hasAnyPasskeyForUser(uid);
    
    if (hasPasskey) {
      next();
      return;
    }

    // User is L8+ but has no passkey - block access
    logger.warn('[Passkey Enforcement] L8+ user blocked - no passkey', {
      uid,
      level,
      path: req.path,
    });

    res.status(403).json({
      error: 'PASSKEY_REQUIRED',
      message: 'Your role requires passkey authentication. Please enroll a passkey to continue.',
      redirect: '/settings/security',
      level,
    });
  } catch (error) {
    logger.error('[Passkey Enforcement] Middleware error', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Soft passkey encouragement for Level 5+ (non-blocking)
 * Sets a flag in response headers but doesn't block
 */
export async function encouragePasskeyForLevel5(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const uid = (req as any).firebaseUser?.uid;
    
    if (!uid) {
      next();
      return;
    }

    const level = await getUserRoleLevel(uid);
    
    if (level >= 5) {
      const hasPasskey = await hasAnyPasskeyForUser(uid);
      
      if (!hasPasskey) {
        // Set header to indicate passkey is encouraged (frontend can show banner)
        res.setHeader('X-Passkey-Encouraged', 'true');
      }
    }

    next();
  } catch (error) {
    logger.error('[Passkey Encouragement] Middleware error', { error });
    next(); // Non-blocking, continue even on error
  }
}
