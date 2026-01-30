/**
 * Security Events Audit Log
 * Comprehensive logging of all security-related actions
 */
import { db } from '../lib/firebase-admin';
import { logger } from '../lib/logger';
/**
 * Log a security event to Firestore audit trail
 * Collection: securityEvents
 */
export async function logSecurityEvent(opts) {
    const { uid, type, ip, userAgent, meta = {} } = opts;
    const now = Date.now();
    try {
        await db.collection('securityEvents').add({
            uid,
            type,
            ip: ip || null,
            userAgent: userAgent || null,
            meta,
            createdAt: now,
            timestamp: new Date(now).toISOString(),
        });
        logger.info('[Security Event]', { uid, type, ip });
    }
    catch (error) {
        logger.error('[Security Events] Failed to log event', { uid, type, error });
    }
}
/**
 * Get recent security events for a user
 */
export async function getUserSecurityEvents(uid, limit = 50) {
    try {
        const snapshot = await db
            .collection('securityEvents')
            .where('uid', '==', uid)
            .orderBy('createdAt', 'desc')
            .limit(limit)
            .get();
        return snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
        }));
    }
    catch (error) {
        logger.error('[Security Events] Failed to get user events', { uid, error });
        return [];
    }
}
/**
 * Count failed auth attempts in time window
 * Used for burst detection
 */
export async function countFailedAttempts(uid, windowMinutes = 10) {
    try {
        const since = Date.now() - windowMinutes * 60 * 1000;
        const snapshot = await db
            .collection('securityEvents')
            .where('uid', '==', uid)
            .where('type', '==', 'PASSKEY_AUTH_FAILED')
            .where('createdAt', '>=', since)
            .get();
        return snapshot.size;
    }
    catch (error) {
        logger.error('[Security Events] Failed to count failed attempts', { uid, error });
        return 0;
    }
}
