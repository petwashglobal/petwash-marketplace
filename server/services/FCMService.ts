/**
 * Firebase Cloud Messaging (FCM) Service
 * Push notifications for booking updates, messages, and alerts
 */

import admin from '../lib/firebase-admin';
import { db as firestoreDb } from '../lib/firebase-admin';
import { logger } from '../lib/logger';

interface PushNotificationPayload {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
  clickAction?: string;
}

export class FCMService {
  
  /**
   * Send push notification to a specific user
   */
  static async sendToUser(payload: PushNotificationPayload): Promise<boolean> {
    try {
      // Get user's FCM tokens from Firestore
      const userDoc = await firestoreDb
        .collection('users')
        .doc(payload.userId)
        .get();
      
      if (!userDoc.exists) {
        logger.warn('[FCM] User not found', { userId: payload.userId });
        return false;
      }
      
      const userData = userDoc.data();
      const fcmTokens = userData?.fcmTokens || [];
      
      if (fcmTokens.length === 0) {
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
        tokens: fcmTokens,
      };
      
      // Send multicast message
      const response = await admin.messaging().sendEachForMulticast(message);
      
      logger.info('[FCM] Notification sent', {
        userId: payload.userId,
        successCount: response.successCount,
        failureCount: response.failureCount,
      });
      
      // Remove invalid tokens
      if (response.failureCount > 0) {
        const tokensToRemove: string[] = [];
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            tokensToRemove.push(fcmTokens[idx]);
          }
        });
        
        if (tokensToRemove.length > 0) {
          await this.removeTokens(payload.userId, tokensToRemove);
        }
      }
      
      return response.successCount > 0;
    } catch (error: any) {
      logger.error('[FCM] Failed to send notification', error);
      return false;
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
