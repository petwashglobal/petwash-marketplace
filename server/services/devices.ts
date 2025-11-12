/**
 * Device Management Service
 * Quick helpers for passkey device checks
 */

import { db as firestoreDb } from '../lib/firebase-admin';
import { logger } from '../lib/logger';

/**
 * Check if user has any registered passkey devices
 * Used for RBAC enforcement
 */
export async function hasAnyPasskeyForUser(userId: string): Promise<boolean> {
  try {
    const snapshot = await firestoreDb
      .collection('users')
      .doc(userId)
      .collection('webauthnCredentials')
      .where('revoked', '==', false)
      .limit(1)
      .get();

    return !snapshot.empty;
  } catch (error) {
    logger.error('[Devices] Failed to check if user has passkey', { userId, error });
    return false;
  }
}

/**
 * Count user's active passkey devices
 */
export async function countUserPasskeys(userId: string): Promise<number> {
  try {
    const snapshot = await firestoreDb
      .collection('users')
      .doc(userId)
      .collection('webauthnCredentials')
      .where('revoked', '==', false)
      .get();

    return snapshot.size;
  } catch (error) {
    logger.error('[Devices] Failed to count user passkeys', { userId, error });
    return 0;
  }
}
