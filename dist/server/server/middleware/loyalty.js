/**
 * LOYALTY VERIFICATION MIDDLEWARE
 * Reusable Express middleware for protecting premium routes
 *
 * Usage:
 * - requireLoyaltyMember - Any loyalty tier required
 * - requireTier('GOLD') - Minimum tier required
 */
import { getLoyaltyStatus, hasTierLevel } from '../services/loyalty';
import { logger } from '../lib/logger';
/**
 * Require user to be a loyalty member (any tier)
 */
export async function requireLoyaltyMember(req, res, next) {
    try {
        // Get Firebase UID from authenticated user
        const userId = req.user?.uid || req.headers['x-user-id'];
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'authentication_required',
                message: 'Please sign in to access this feature',
            });
        }
        // Check loyalty status
        const loyaltyUser = await getLoyaltyStatus(userId);
        if (!loyaltyUser) {
            return res.status(403).json({
                success: false,
                error: 'loyalty_membership_required',
                message: 'This feature is exclusive to Pet Wash™ loyalty members. Complete a wash or booking to join our loyalty program.',
            });
        }
        // Attach loyalty info to request for downstream use
        req.loyaltyUser = loyaltyUser;
        logger.info('[LoyaltyMiddleware] Member verified', {
            userId,
            tier: loyaltyUser.tier,
            points: loyaltyUser.points,
        });
        next();
    }
    catch (error) {
        logger.error('[LoyaltyMiddleware] Verification failed', {
            error: error.message,
        });
        res.status(500).json({
            success: false,
            error: 'verification_failed',
            message: 'Failed to verify loyalty membership',
        });
    }
}
/**
 * Require user to meet minimum tier level
 *
 * Usage: requireTier('GOLD')
 */
export function requireTier(minimumTier) {
    return async (req, res, next) => {
        try {
            const userId = req.user?.uid || req.headers['x-user-id'];
            if (!userId) {
                return res.status(401).json({
                    success: false,
                    error: 'authentication_required',
                    message: 'Please sign in to access this feature',
                });
            }
            // Check if user meets tier requirement
            const loyaltyUser = await getLoyaltyStatus(userId);
            if (!loyaltyUser) {
                return res.status(403).json({
                    success: false,
                    error: 'loyalty_membership_required',
                    message: `This feature requires ${minimumTier} tier membership. Join our loyalty program to unlock premium features.`,
                });
            }
            const hasTier = await hasTierLevel(userId, minimumTier);
            if (!hasTier) {
                return res.status(403).json({
                    success: false,
                    error: 'insufficient_tier',
                    message: `This feature requires ${minimumTier} tier or higher. Your current tier: ${loyaltyUser.tier}`,
                    currentTier: loyaltyUser.tier,
                    requiredTier: minimumTier,
                });
            }
            // Attach loyalty info to request
            req.loyaltyUser = loyaltyUser;
            logger.info('[LoyaltyMiddleware] Tier requirement met', {
                userId,
                tier: loyaltyUser.tier,
                required: minimumTier,
            });
            next();
        }
        catch (error) {
            logger.error('[LoyaltyMiddleware] Tier verification failed', {
                error: error.message,
            });
            res.status(500).json({
                success: false,
                error: 'verification_failed',
                message: 'Failed to verify tier requirement',
            });
        }
    };
}
/**
 * Optional loyalty enrichment (doesn't block non-members)
 * Adds loyalty info to request if available
 */
export async function enrichWithLoyalty(req, res, next) {
    try {
        const userId = req.user?.uid || req.headers['x-user-id'];
        if (userId) {
            const loyaltyUser = await getLoyaltyStatus(userId);
            if (loyaltyUser) {
                req.loyaltyUser = loyaltyUser;
                logger.debug('[LoyaltyMiddleware] Request enriched with loyalty data', {
                    userId,
                    tier: loyaltyUser.tier,
                });
            }
        }
        next();
    }
    catch (error) {
        // Don't fail the request if enrichment fails
        logger.warn('[LoyaltyMiddleware] Enrichment failed (non-critical)', {
            error: error.message,
        });
        next();
    }
}
