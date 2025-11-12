/**
 * Firebase Cloud Messaging (FCM) Push Notifications
 * 
 * Enterprise-grade push notification service for Android and iOS devices.
 * 
 * Supported Platforms:
 * - Android (via FCM)
 * - iOS (via APNs through FCM)
 * - Web (via FCM Web Push)
 * 
 * User Roles Supported:
 * - End users (pet owners)
 * - Service providers (sitters, walkers, drivers)
 * - Franchise staff (local managers, dispatchers)
 * - Franchise owners
 * - HQ administrators
 * - Technicians (K9000 maintenance)
 * 
 * Features:
 * - High priority delivery for time-sensitive notifications
 * - Custom data payload for deep linking
 * - Platform-specific configurations (Android/iOS)
 * - Badge count updates (iOS)
 * - Sound and vibration support
 * - Notification channels (Android)
 * 
 * Usage:
 * ```typescript
 * import { sendPush, sendMulticastPush } from './actions/sendPush';
 * 
 * // Single device
 * await sendPush(
 *   userDeviceToken,
 *   'New Job Offer!',
 *   'Dog walking request nearby - $25 for 1 hour',
 *   { jobId: '123', type: 'job_offer' }
 * );
 * 
 * // Multiple devices
 * await sendMulticastPush(
 *   [token1, token2, token3],
 *   'Station Alert',
 *   'K9000 unit #42 requires maintenance'
 * );
 * ```
 */

import admin from 'firebase-admin';
import { logger } from '../lib/logger';

// Ensure Firebase Admin is initialized
if (!admin.apps.length) {
  try {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!serviceAccount) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT environment variable not set');
    }
    
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(serviceAccount)),
    });
    
    logger.info('[FCM] Firebase Admin SDK initialized for push notifications');
  } catch (error) {
    logger.error('[FCM] Failed to initialize Firebase Admin SDK', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Notification priority levels
 */
export enum NotificationPriority {
  HIGH = 'high',     // Time-sensitive (job offers, emergencies)
  NORMAL = 'normal', // Standard notifications
}

/**
 * Push notification options
 */
export interface PushNotificationOptions {
  /**
   * Custom data payload for deep linking and app state
   */
  data?: Record<string, string>;
  
  /**
   * Notification priority (default: HIGH)
   */
  priority?: NotificationPriority;
  
  /**
   * Badge count for iOS app icon (default: unchanged)
   */
  badge?: number;
  
  /**
   * Sound file name (default: 'default')
   */
  sound?: string;
  
  /**
   * Notification channel ID for Android (default: 'default')
   */
  channelId?: string;
  
  /**
   * Image URL for rich notifications
   */
  imageUrl?: string;
  
  /**
   * Click action (deep link URL)
   */
  clickAction?: string;
}

/**
 * Send push notification to a single device
 * 
 * @param token - FCM device token
 * @param title - Notification title
 * @param body - Notification body text
 * @param options - Additional notification options
 * @returns FCM message ID on success
 * 
 * @example
 * // Job offer notification
 * await sendPush(
 *   deviceToken,
 *   'New Job Offer!',
 *   'Dog walking request nearby - $25 for 1 hour',
 *   {
 *     data: { jobId: '123', type: 'job_offer' },
 *     priority: NotificationPriority.HIGH,
 *     sound: 'job_offer.wav'
 *   }
 * );
 * 
 * // Emergency alert
 * await sendPush(
 *   deviceToken,
 *   'Emergency Alert',
 *   'K9000 unit malfunction detected',
 *   {
 *     data: { stationId: '42', severity: 'critical' },
 *     priority: NotificationPriority.HIGH
 *   }
 * );
 */
export async function sendPush(
  token: string,
  title: string,
  body: string,
  options: PushNotificationOptions = {}
): Promise<string> {
  try {
    const {
      data = {},
      priority = NotificationPriority.HIGH,
      badge,
      sound = 'default',
      channelId = 'default',
      imageUrl,
      clickAction,
    } = options;
    
    // Build FCM message
    const message: admin.messaging.Message = {
      token,
      notification: {
        title,
        body,
        imageUrl,
      },
      data,
      android: {
        priority: priority === NotificationPriority.HIGH ? 'high' : 'normal',
        notification: {
          channelId,
          sound,
          clickAction,
          priority: priority === NotificationPriority.HIGH ? 'max' : 'default',
          defaultSound: sound === 'default',
          defaultVibrateTimings: true,
        },
      },
      apns: {
        headers: {
          'apns-priority': priority === NotificationPriority.HIGH ? '10' : '5',
        },
        payload: {
          aps: {
            sound,
            badge,
            contentAvailable: true,
          },
        },
      },
      webpush: {
        notification: {
          title,
          body,
          icon: '/icon-192.png',
          badge: '/badge-72.png',
          image: imageUrl,
        },
      },
    };
    
    // Send notification
    const messageId = await admin.messaging().send(message);
    
    logger.info('[FCM] Push notification sent successfully', {
      messageId,
      title,
      priority,
    });
    
    return messageId;
  } catch (error) {
    logger.error('[FCM] Failed to send push notification', {
      error: error instanceof Error ? error.message : String(error),
      title,
      token: token.substring(0, 20) + '...', // Log partial token for debugging
    });
    throw error;
  }
}

/**
 * Send push notification to multiple devices (multicast)
 * 
 * @param tokens - Array of FCM device tokens (max 500)
 * @param title - Notification title
 * @param body - Notification body text
 * @param options - Additional notification options
 * @returns Multicast result with success/failure counts
 * 
 * @example
 * // Notify all walkers in a region
 * await sendMulticastPush(
 *   walkerTokens,
 *   'New Jobs Available',
 *   '5 new dog walking requests in your area'
 * );
 * 
 * // Broadcast to all franchise owners
 * await sendMulticastPush(
 *   franchiseOwnerTokens,
 *   'Monthly Report Ready',
 *   'Your franchise performance report is now available'
 * );
 */
export async function sendMulticastPush(
  tokens: string[],
  title: string,
  body: string,
  options: PushNotificationOptions = {}
): Promise<admin.messaging.BatchResponse> {
  try {
    if (tokens.length === 0) {
      throw new Error('No device tokens provided');
    }
    
    if (tokens.length > 500) {
      logger.warn('[FCM] Multicast limited to 500 tokens per batch', {
        requestedCount: tokens.length,
      });
      tokens = tokens.slice(0, 500);
    }
    
    const {
      data = {},
      priority = NotificationPriority.HIGH,
      badge,
      sound = 'default',
      channelId = 'default',
      imageUrl,
      clickAction,
    } = options;
    
    // Build multicast message
    const message: admin.messaging.MulticastMessage = {
      tokens,
      notification: {
        title,
        body,
        imageUrl,
      },
      data,
      android: {
        priority: priority === NotificationPriority.HIGH ? 'high' : 'normal',
        notification: {
          channelId,
          sound,
          clickAction,
          priority: priority === NotificationPriority.HIGH ? 'max' : 'default',
          defaultSound: sound === 'default',
          defaultVibrateTimings: true,
        },
      },
      apns: {
        headers: {
          'apns-priority': priority === NotificationPriority.HIGH ? '10' : '5',
        },
        payload: {
          aps: {
            sound,
            badge,
            contentAvailable: true,
          },
        },
      },
      webpush: {
        notification: {
          title,
          body,
          icon: '/icon-192.png',
          badge: '/badge-72.png',
          image: imageUrl,
        },
      },
    };
    
    // Send multicast
    const response = await admin.messaging().sendEachForMulticast(message);
    
    logger.info('[FCM] Multicast push notification sent', {
      successCount: response.successCount,
      failureCount: response.failureCount,
      totalTokens: tokens.length,
      title,
    });
    
    // Log failed tokens for cleanup
    if (response.failureCount > 0) {
      const failedTokens = response.responses
        .map((r, idx) => (r.success ? null : tokens[idx]))
        .filter(Boolean);
      
      logger.warn('[FCM] Some tokens failed', {
        failedCount: response.failureCount,
        failedTokens: failedTokens.slice(0, 10), // Log first 10 for debugging
      });
    }
    
    return response;
  } catch (error) {
    logger.error('[FCM] Failed to send multicast push notification', {
      error: error instanceof Error ? error.message : String(error),
      title,
      tokenCount: tokens.length,
    });
    throw error;
  }
}

/**
 * Send topic-based notification (pub/sub pattern)
 * 
 * @param topic - FCM topic name (e.g., 'all-walkers', 'franchise-123')
 * @param title - Notification title
 * @param body - Notification body text
 * @param options - Additional notification options
 * @returns FCM message ID on success
 * 
 * @example
 * // Notify all users subscribed to a topic
 * await sendTopicPush(
 *   'all-walkers',
 *   'Platform Update',
 *   'New features available in the walker app!'
 * );
 */
export async function sendTopicPush(
  topic: string,
  title: string,
  body: string,
  options: PushNotificationOptions = {}
): Promise<string> {
  try {
    const {
      data = {},
      priority = NotificationPriority.NORMAL,
      badge,
      sound = 'default',
      imageUrl,
    } = options;
    
    const message: admin.messaging.Message = {
      topic,
      notification: {
        title,
        body,
        imageUrl,
      },
      data,
      android: {
        priority: priority === NotificationPriority.HIGH ? 'high' : 'normal',
      },
      apns: {
        headers: {
          'apns-priority': priority === NotificationPriority.HIGH ? '10' : '5',
        },
        payload: {
          aps: {
            sound,
            badge,
          },
        },
      },
    };
    
    const messageId = await admin.messaging().send(message);
    
    logger.info('[FCM] Topic notification sent successfully', {
      messageId,
      topic,
      title,
    });
    
    return messageId;
  } catch (error) {
    logger.error('[FCM] Failed to send topic notification', {
      error: error instanceof Error ? error.message : String(error),
      topic,
      title,
    });
    throw error;
  }
}

/**
 * Subscribe device tokens to a topic
 * 
 * @param tokens - Array of FCM device tokens
 * @param topic - Topic name to subscribe to
 */
export async function subscribeToTopic(
  tokens: string | string[],
  topic: string
): Promise<void> {
  try {
    const tokenArray = Array.isArray(tokens) ? tokens : [tokens];
    
    const response = await admin.messaging().subscribeToTopic(tokenArray, topic);
    
    logger.info('[FCM] Devices subscribed to topic', {
      topic,
      successCount: response.successCount,
      failureCount: response.failureCount,
    });
  } catch (error) {
    logger.error('[FCM] Failed to subscribe to topic', {
      error: error instanceof Error ? error.message : String(error),
      topic,
    });
    throw error;
  }
}

/**
 * Unsubscribe device tokens from a topic
 * 
 * @param tokens - Array of FCM device tokens
 * @param topic - Topic name to unsubscribe from
 */
export async function unsubscribeFromTopic(
  tokens: string | string[],
  topic: string
): Promise<void> {
  try {
    const tokenArray = Array.isArray(tokens) ? tokens : [tokens];
    
    const response = await admin.messaging().unsubscribeFromTopic(tokenArray, topic);
    
    logger.info('[FCM] Devices unsubscribed from topic', {
      topic,
      successCount: response.successCount,
      failureCount: response.failureCount,
    });
  } catch (error) {
    logger.error('[FCM] Failed to unsubscribe from topic', {
      error: error instanceof Error ? error.message : String(error),
      topic,
    });
    throw error;
  }
}
