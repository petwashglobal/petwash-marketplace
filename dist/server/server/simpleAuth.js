import bcrypt from 'bcrypt';
import { db } from './db';
import { customers } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { logger } from './lib/logger';
const SALT_ROUNDS = 12;
/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password) {
    return bcrypt.hash(password, SALT_ROUNDS);
}
/**
 * Verify a password against a hash
 */
export async function verifyPassword(password, hash) {
    return bcrypt.compare(password, hash);
}
/**
 * Middleware to require authentication
 */
export function requireAuth(req, res, next) {
    if (!req.session || !req.session.userId) {
        logger.debug('[Simple Auth] No session found - unauthorized');
        return res.status(401).json({ ok: false, error: 'Authentication required' });
    }
    next();
}
/**
 * Get current user from session
 */
export async function getCurrentUser(req) {
    const session = req.session;
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
    }
    catch (error) {
        logger.error('[Simple Auth] Error fetching current user:', error);
        return null;
    }
}
