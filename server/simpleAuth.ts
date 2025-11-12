import bcrypt from 'bcrypt';
import { db } from './db';
import { customers } from '@shared/schema';
import { eq } from 'drizzle-orm';
import type { Request, Response, NextFunction } from 'express';
import { logger } from './lib/logger';

const SALT_ROUNDS = 12;

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Middleware to require authentication
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session || !(req.session as any).userId) {
    logger.debug('[Simple Auth] No session found - unauthorized');
    return res.status(401).json({ ok: false, error: 'Authentication required' });
  }

  next();
}

/**
 * Get current user from session
 */
export async function getCurrentUser(req: Request) {
  const session = req.session as any;
  
  if (!session || !session.userId) {
    return null;
  }

  try {
    const result = await db
      .select({
        id: customers.id,
        email: customers.email,
        firstName: customers.firstName,
        lastName: customers.lastName,
        phone: customers.phone,
        loyaltyTier: customers.loyaltyTier,
        totalSpent: customers.totalSpent,
        washBalance: customers.washBalance,
        profilePictureUrl: customers.profilePictureUrl,
        petType: customers.petType,
        isVerified: customers.isVerified,
      })
      .from(customers)
      .where(eq(customers.id, session.userId))
      .limit(1);

    return result[0] || null;
  } catch (error) {
    logger.error('[Simple Auth] Error fetching current user:', error);
    return null;
  }
}
