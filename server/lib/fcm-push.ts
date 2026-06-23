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

/**
 * App flavor a push is intended for. Matches the value the client writes onto
 * the device token (client/src/lib/fcm-notifications.ts) and the route
 * namespace: the customer/Prestige app is 'prestige'.
 */
export type PushFlavor = 'prestige' | 'provider';

/** All FCM device tokens for a user (across devices). Empty array on error/none. */
export async function getUserFcmTokens(
  userId: string,
): Promise<Array<{ token: string; deviceId: string; appFlavor?: string }>> {
  try {
    const snap = await firestore.collection('fcmTokens').doc(userId).collection('devices').get();
    const tokens: Array<{ token: string; deviceId: string; appFlavor?: string }> = [];
    snap.forEach((doc) => {
      const data = doc.data();
      if (data?.token) {
        tokens.push({
          token: data.token,
          deviceId: doc.id,
          appFlavor: typeof data?.appFlavor === 'string' ? data.appFlavor : undefined,
        });
      }
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
 *
 * APP-STRUCTURE REBUILD (SDD §6.6): an optional `requiredFlavor` routes the push
 * to only the matching app's devices (so a provider job alert never lands on the
 * customer's phone). Backward-compatible and OFF by default:
 *   - callers that omit `requiredFlavor` are unaffected;
 *   - filtering only applies when PUSH_FLAVOR_ROUTING_ENABLED === 'true';
 *   - devices registered before flavor tagging (appFlavor missing) are treated as
 *     eligible so no notification is lost during the transition;
 *   - if filtering would leave zero devices, we fall back to all devices rather
 *     than silently dropping the only delivery path.
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
  requiredFlavor?: PushFlavor,
): Promise<number> {
  let devices = await getUserFcmTokens(userId);
  if (devices.length === 0) return 0;

  if (process.env.PUSH_FLAVOR_ROUTING_ENABLED === 'true' && requiredFlavor) {
    const matched = devices.filter((d) => !d.appFlavor || d.appFlavor === requiredFlavor);
    if (matched.length > 0) devices = matched;
  }

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
