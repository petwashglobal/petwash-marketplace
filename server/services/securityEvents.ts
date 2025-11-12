/**
 * Security Events Audit Log
 * Comprehensive logging of all security-related actions
 */

import { db } from '../lib/firebase-admin';
import { logger } from '../lib/logger';

export type SecurityEventType =
  | 'PASSKEY_ENROLL_SUCCESS'
  | 'PASSKEY_ENROLL_FAILED'
  | 'PASSKEY_AUTH_SUCCESS'
  | 'PASSKEY_AUTH_FAILED'
  | 'PASSKEY_REVOKED'
  | 'NEW_DEVICE_ENROLLED'
  | 'DEVICE_RENAMED'
  | 'UNUSUAL_LOCATION_DETECTED'
  | 'MULTIPLE_FAILURES_DETECTED';

interface SecurityEventOptions {
  uid: string;
  type: SecurityEventType;
  ip?: string;
  userAgent?: string;
  meta?: Record<string, any>;
}

/**
 * Log a security event to Firestore audit trail
 * Collection: securityEvents
 */
export async function logSecurityEvent(opts: SecurityEventOptions): Promise<void> {
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
  } catch (error) {
    logger.error('[Security Events] Failed to log event', { uid, type, error });
  }
}

/**
 * Get recent security events for a user
 */
export async function getUserSecurityEvents(
  uid: string,
  limit: number = 50
): Promise<any[]> {
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
  } catch (error) {
    logger.error('[Security Events] Failed to get user events', { uid, error });
    return [];
  }
}

/**
 * Count failed auth attempts in time window
 * Used for burst detection
 */
export async function countFailedAttempts(
  uid: string,
  windowMinutes: number = 10
): Promise<number> {
  try {
    const since = Date.now() - windowMinutes * 60 * 1000;
    
    const snapshot = await db
      .collection('securityEvents')
      .where('uid', '==', uid)
      .where('type', '==', 'PASSKEY_AUTH_FAILED')
      .where('createdAt', '>=', since)
      .get();

    return snapshot.size;
  } catch (error) {
    logger.error('[Security Events] Failed to count failed attempts', { uid, error });
    return 0;
  }
}
