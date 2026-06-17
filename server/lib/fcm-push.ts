/**
 * Shared FCM push helper — sends to ALL of a user's registered devices using the
 * REAL token store: Firestore fcmTokens/{userId}/devices/{deviceId} (written by the
 * client at client/src/lib/fcm-notifications.ts:saveFCMToken). Prunes invalid tokens.
 *
 * This is the canonical place to read device tokens. The old booking-chat push read
 * recipient.customClaims.fcmToken, which is never written anywhere — so chat pushes
 * never fired. Use sendPushToUser() instead.
 */
import admin, { db as firestore } from './firebase-admin';
import { logger } from './logger';

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

/** All FCM device tokens for a user (across devices). Empty array on error/none. */
export async function getUserFcmTokens(userId: string): Promise<Array<{ token: string; deviceId: string }>> {
  try {
    const snap = await firestore.collection('fcmTokens').doc(userId).collection('devices').get();
    const tokens: Array<{ token: string; deviceId: string }> = [];
    snap.forEach((doc) => {
      const data = doc.data();
      if (data?.token) tokens.push({ token: data.token, deviceId: doc.id });
    });
    return tokens;
  } catch (err) {
    logger.error(`[FCM] Failed to fetch tokens for ${userId}`, err);
    return [];
  }
}

const INVALID_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);

/**
 * Send a push to every device a user has registered. Prunes tokens FCM reports as
 * invalid. Never throws — returns the number of devices the push was delivered to.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<number> {
  const devices = await getUserFcmTokens(userId);
  if (devices.length === 0) return 0;

  try {
    const resp = await admin.messaging().sendEachForMulticast({
      tokens: devices.map((d) => d.token),
      notification: { title: payload.title, body: payload.body },
      ...(payload.data ? { data: payload.data } : {}),
    });

    // Prune tokens FCM says are dead so we don't keep retrying them.
    await Promise.all(
      resp.responses.map(async (r, i) => {
        if (!r.success && r.error && INVALID_TOKEN_CODES.has(r.error.code)) {
          try {
            await firestore
              .collection('fcmTokens')
              .doc(userId)
              .collection('devices')
              .doc(devices[i].deviceId)
              .delete();
          } catch {
            /* best-effort prune */
          }
        }
      }),
    );

    return resp.successCount;
  } catch (err) {
    logger.warn(`[FCM] sendPushToUser failed for ${userId}`, err);
    return 0;
  }
}
