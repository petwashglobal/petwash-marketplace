/**
 * Firebase Cloud Messaging (FCM) Service
 * Push notifications for booking updates, messages, and alerts
 */

import admin from '../lib/firebase-admin';
import { db as firestoreDb } from '../lib/firebase-admin';
import { logger } from '../lib/logger';
import { getUserFcmTokens, INVALID_TOKEN_CODES } from '../lib/fcm-push';

interface PushNotificationPayload {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
  clickAction?: string;
}

/** Where a token was registered, so an invalid one is pruned from the right store. */
type TokenSource =
  | { source: 'device'; deviceId: string }   // Firestore fcmTokens/{uid}/devices/{deviceId}
  | { source: 'legacy' };                     // array field users/{uid}.fcmTokens

/**
 * Merge the two historically-divergent token stores into ONE de-duplicated send
 * list, remembering each token's origin. Pure/synchronous so it is unit-testable
 * without Firebase.
 *
 * Web clients (client/src/lib/fcm-notifications.ts) write to the `devices`
 * subcollection; POST /api/fcm/register-token writes the legacy `users` array.
 * Reading only one store is exactly why booking/receipt/promo push silently never
 * delivered to web users. Read BOTH.
 */
export function mergePushTokens(
  deviceTokens: Array<{ token: string; deviceId: string }>,
  legacyTokens: string[],
): Map<string, TokenSource> {
  const bySource = new Map<string, TokenSource>();
  for (const { token, deviceId } of deviceTokens) {
    if (token && !bySource.has(token)) bySource.set(token, { source: 'device', deviceId });
  }
  for (const token of legacyTokens) {
    if (token && !bySource.has(token)) bySource.set(token, { source: 'legacy' });
  }
  return bySource;
}

export class FCMService {
  
  /**
   * Send push notification to a specific user
   */
  static async sendToUser(payload: PushNotificationPayload): Promise<boolean> {
    try {
      // Unified token read. The web client fills the Firestore subcollection
      // fcmTokens/{uid}/devices/{deviceId}; POST /api/fcm/register-token fills the
      // legacy array users/{uid}.fcmTokens. This service historically read ONLY the
      // array, so web-registered devices never received booking/receipt/promo push
      // (silent no-op). Read BOTH stores so every device is reached regardless of
      // which path registered it.
      const [deviceTokens, legacyTokens] = await Promise.all([
        getUserFcmTokens(payload.userId),
        this.getLegacyArrayTokens(payload.userId),
      ]);

      const bySource = mergePushTokens(deviceTokens, legacyTokens);
      const tokens = Array.from(bySource.keys());

      if (tokens.length === 0) {
        logger.info('[FCM] No FCM tokens for user', { userId: payload.userId });
        return false;
      }

      // Build notification message
      const message = {
        notification: {
          title: payload.title,
          body: payload.body,
          imageUrl: payload.imageUrl,
        },
        data: payload.data || {},
        tokens,
      };

      // Send multicast message
      const response = await admin.messaging().sendEachForMulticast(message);

      logger.info('[FCM] Notification sent', {
        userId: payload.userId,
        deviceCount: tokens.length,
        successCount: response.successCount,
        failureCount: response.failureCount,
      });

      // Prune ONLY tokens FCM reports as permanently dead, from their own store.
      // A transient/quota failure must not delete an otherwise-valid token.
      if (response.failureCount > 0) {
        const legacyToRemove: string[] = [];
        const deviceDocsToRemove: string[] = [];
        response.responses.forEach((resp, idx) => {
          if (resp.success) return;
          if (!resp.error || !INVALID_TOKEN_CODES.has(resp.error.code)) return;
          const src = bySource.get(tokens[idx]);
          if (src?.source === 'device') deviceDocsToRemove.push(src.deviceId);
          else legacyToRemove.push(tokens[idx]);
        });

        if (legacyToRemove.length > 0) {
          await this.removeTokens(payload.userId, legacyToRemove);
        }
        await Promise.all(
          deviceDocsToRemove.map((deviceId) =>
            firestoreDb
              .collection('fcmTokens')
              .doc(payload.userId)
              .collection('devices')
              .doc(deviceId)
              .delete()
              .catch(() => { /* best-effort prune */ }),
          ),
        );
      }

      return response.successCount > 0;
    } catch (error: any) {
      logger.error('[FCM] Failed to send notification', error);
      return false;
    }
  }

  /**
   * Legacy array token store: users/{uid}.fcmTokens (written by
   * POST /api/fcm/register-token). Returns [] when the user/doc is absent.
   */
  private static async getLegacyArrayTokens(userId: string): Promise<string[]> {
    try {
      const userDoc = await firestoreDb.collection('users').doc(userId).get();
      if (!userDoc.exists) return [];
      const tokens = userDoc.data()?.fcmTokens;
      return Array.isArray(tokens) ? tokens.filter((t): t is string => typeof t === 'string' && !!t) : [];
    } catch (err) {
      logger.warn('[FCM] Failed to read legacy array tokens', { userId, err });
      return [];
    }
  }
  
  /**
   * Register FCM token for a user
   */
  static async registerToken(userId: string, token: string): Promise<void> {
    try {
      const userRef = firestoreDb.collection('users').doc(userId);
      
      await userRef.update({
        fcmTokens: admin.firestore.FieldValue.arrayUnion(token),
        lastTokenUpdate: new Date(),
      });
      
      logger.info('[FCM] Token registered', { userId });
    } catch (error: any) {
      logger.error('[FCM] Failed to register token', error);
      throw error;
    }
  }
  
  /**
   * Remove FCM token for a user
   */
  static async removeToken(userId: string, token: string): Promise<void> {
    try {
      const userRef = firestoreDb.collection('users').doc(userId);
      
      await userRef.update({
        fcmTokens: admin.firestore.FieldValue.arrayRemove(token),
      });
      
      logger.info('[FCM] Token removed', { userId });
    } catch (error: any) {
      logger.error('[FCM] Failed to remove token', error);
    }
  }
  
  /**
   * Remove multiple invalid tokens
   */
  private static async removeTokens(userId: string, tokens: string[]): Promise<void> {
    try {
      const userRef = firestoreDb.collection('users').doc(userId);
      
      for (const token of tokens) {
        await userRef.update({
          fcmTokens: admin.firestore.FieldValue.arrayRemove(token),
        });
      }
      
      logger.info('[FCM] Invalid tokens removed', {
        userId,
        count: tokens.length,
      });
    } catch (error: any) {
      logger.error('[FCM] Failed to remove tokens', error);
    }
  }
  
  /**
   * Send booking update notification
   */
  static async sendBookingUpdate(params: {
    userId: string;
    bookingId: string;
    status: string;
    serviceType: string;
  }): Promise<void> {
    const statusMessages: Record<string, string> = {
      confirmed: 'Your booking has been confirmed!',
      in_progress: 'Your service is now in progress',
      completed: 'Your service has been completed',
      cancelled: 'Your booking has been cancelled',
    };
    
    await this.sendToUser({
      userId: params.userId,
      title: `Booking ${params.status}`,
      body: statusMessages[params.status] || `Booking status: ${params.status}`,
      data: {
        type: 'booking_update',
        bookingId: params.bookingId,
        status: params.status,
        serviceType: params.serviceType,
      },
      clickAction: `/bookings/${params.bookingId}`,
    });
  }
  
  /**
   * Send new message notification
   */
  static async sendNewMessage(params: {
    userId: string;
    conversationId: string;
    senderName: string;
    message: string;
  }): Promise<void> {
    await this.sendToUser({
      userId: params.userId,
      title: `New message from ${params.senderName}`,
      body: params.message,
      data: {
        type: 'new_message',
        conversationId: params.conversationId,
      },
      clickAction: `/chat/${params.conversationId}`,
    });
  }
  
  /**
   * Send walker arrival notification
   */
  static async sendWalkerArrived(params: {
    ownerId: string;
    walkerName: string;
    bookingId: string;
  }): Promise<void> {
    await this.sendToUser({
      userId: params.ownerId,
      title: 'Walker has arrived! 🐕',
      body: `${params.walkerName} is here to walk your pet`,
      data: {
        type: 'walker_arrived',
        bookingId: params.bookingId,
      },
      clickAction: `/bookings/${params.bookingId}`,
    });
  }
  
  /**
   * Send payout notification
   */
  static async sendPayoutNotification(params: {
    providerId: string;
    amount: number;
    currency: string;
  }): Promise<void> {
    await this.sendToUser({
      userId: params.providerId,
      title: 'Payout processed! 💰',
      body: `${params.currency}${params.amount} has been transferred to your account`,
      data: {
        type: 'payout',
        amount: params.amount.toString(),
        currency: params.currency,
      },
      clickAction: '/provider/earnings',
    });
  }
  
  /**
   * Send review request notification
   */
  static async sendReviewRequest(params: {
    userId: string;
    providerName: string;
    serviceType: string;
    bookingId: string;
  }): Promise<void> {
    await this.sendToUser({
      userId: params.userId,
      title: 'How was your experience? ⭐',
      body: `Please rate your ${params.serviceType} with ${params.providerName}`,
      data: {
        type: 'review_request',
        bookingId: params.bookingId,
      },
      clickAction: `/bookings/${params.bookingId}/review`,
    });
  }
}

export default FCMService;

export async function sendPushNotification(
  userId: string,
  payload: { title: string; body: string; data?: Record<string, string>; imageUrl?: string; clickAction?: string }
): Promise<boolean> {
  return FCMService.sendToUser({ userId, ...payload });
}
