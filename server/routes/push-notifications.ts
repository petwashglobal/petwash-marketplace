/**
 * Firebase Cloud Messaging (FCM) Push Notifications API
 * Sends push notifications to users' browsers/devices
 * 
 * MULTI-DEVICE SUPPORT:
 * - Each user can have multiple FCM tokens (different devices)
 * - Tokens stored in: fcmTokens/{userId}/devices/{deviceId}
 * - Cleanup only removes invalid device tokens, not entire user documents
 */

import { Router, Request, Response } from 'express';
import { db as firestore } from '../lib/firebase-admin';
import admin from 'firebase-admin';
import { validateFirebaseToken } from '../middleware/firebase-auth';
import { logger } from '../lib/logger';
import { pushNotificationSchema } from '@shared/firestore-fcm';
import { z } from 'zod';

const router = Router();

// All routes require authentication
router.use(validateFirebaseToken);

/**
 * Fetch all FCM tokens for a user (across all devices)
 */
async function getAllUserTokens(userId: string): Promise<Array<{ token: string; deviceId: string }>> {
  try {
    const devicesSnapshot = await firestore
      .collection('fcmTokens')
      .doc(userId)
      .collection('devices')
      .get();
    
    const tokens: Array<{ token: string; deviceId: string }> = [];
    devicesSnapshot.forEach(doc => {
      const data = doc.data();
      if (data?.token) {
        tokens.push({
          token: data.token,
          deviceId: doc.id,
        });
      }
    });
    
    return tokens;
  } catch (error) {
    logger.error(`[FCM] Failed to fetch tokens for user ${userId}:`, error);
    return [];
  }
}

/**
 * Delete a specific device token
 */
async function deleteDeviceToken(userId: string, deviceId: string): Promise<void> {
  try {
    await firestore
      .collection('fcmTokens')
      .doc(userId)
      .collection('devices')
      .doc(deviceId)
      .delete();
    
    logger.info(`[FCM] Deleted invalid token for user ${userId}, device ${deviceId}`);
  } catch (error) {
    logger.error(`[FCM] Failed to delete token for user ${userId}, device ${deviceId}:`, error);
  }
}

/**
 * POST /api/push-notifications/send
 * Send push notification to user(s)
 * Requires admin role for broadcasting
 */
router.post('/send', async (req: Request, res: Response) => {
  try {
    const validation = pushNotificationSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: validation.error.errors
      });
    }
    
    const body = validation.data;
    const senderId = (req as any).firebaseUser?.uid;

    if (!senderId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // If sending to multiple users, require admin role
    if (body.userIds && body.userIds.length > 1) {
      const senderEmail = (req as any).firebaseUser?.email;
      const adminEmails = ['nirhadad1@gmail.com', 'admin@petwash.co.il'];
      
      if (!adminEmails.includes(senderEmail || '')) {
        return res.status(403).json({ error: 'Admin access required for broadcast notifications' });
      }
    }

    // Get target user IDs
    const targetUserIds = body.userIds || (body.userId ? [body.userId] : []);

    if (targetUserIds.length === 0) {
      return res.status(400).json({ error: 'Must specify userId or userIds' });
    }

    // If specific device ID provided, send to that device only
    if (body.deviceId && body.userId) {
      const deviceTokens = await getAllUserTokens(body.userId);
      const deviceToken = deviceTokens.find(t => t.deviceId === body.deviceId);
      
      if (!deviceToken) {
        return res.status(404).json({ error: 'Device token not found' });
      }

      // Send to specific device
      const message: admin.messaging.Message = {
        notification: {
          title: body.title,
          body: body.body,
          imageUrl: body.icon,
        },
        data: {
          url: body.url || '/dashboard',
          tag: body.tag || 'petwash-notification',
          ...body.data,
        },
        webpush: {
          notification: {
            title: body.title,
            body: body.body,
            icon: body.icon || '/brand/petwash-logo-official.png',
            badge: body.badge || '/brand/petwash-logo-official.png',
            requireInteraction: body.requireInteraction || false,
            tag: body.tag || 'petwash-notification',
          },
          fcmOptions: {
            link: body.url || '/dashboard',
          },
        },
        token: deviceToken.token,
      };

      try {
        await admin.messaging().send(message);
        logger.info(`[FCM] Sent notification to user ${body.userId}, device ${body.deviceId}`);
        
        return res.json({
          success: true,
          successCount: 1,
          failureCount: 0,
          totalTokens: 1,
        });
      } catch (error: any) {
        // Clean up invalid token
        if (error.code === 'messaging/invalid-registration-token' || 
            error.code === 'messaging/registration-token-not-registered') {
          await deleteDeviceToken(body.userId, body.deviceId);
          return res.status(404).json({ error: 'Device token is invalid or expired' });
        }
        throw error;
      }
    }

    // Fetch all tokens for all target users (multi-device support)
    const tokenMap = new Map<string, Array<{ token: string; deviceId: string; userId: string }>>();
    const allTokens: string[] = [];
    
    for (const userId of targetUserIds) {
      const userTokens = await getAllUserTokens(userId);
      if (userTokens.length > 0) {
        // Map tokens to user and device IDs for cleanup later
        const mappedTokens = userTokens.map(t => ({ ...t, userId }));
        tokenMap.set(userId, mappedTokens);
        allTokens.push(...userTokens.map(t => t.token));
      }
    }

    if (allTokens.length === 0) {
      return res.status(404).json({ error: 'No FCM tokens found for target users' });
    }

    // Prepare notification payload
    const message: admin.messaging.MulticastMessage = {
      notification: {
        title: body.title,
        body: body.body,
        imageUrl: body.icon,
      },
      data: {
        url: body.url || '/dashboard',
        tag: body.tag || 'petwash-notification',
        ...body.data,
      },
      webpush: {
        notification: {
          title: body.title,
          body: body.body,
          icon: body.icon || '/brand/petwash-logo-official.png',
          badge: body.badge || '/brand/petwash-logo-official.png',
          requireInteraction: body.requireInteraction || false,
          tag: body.tag || 'petwash-notification',
        },
        fcmOptions: {
          link: body.url || '/dashboard',
        },
      },
      tokens: allTokens,
    };

    // Send notification
    const response = await admin.messaging().sendEachForMulticast(message);

    logger.info(`[FCM] Sent ${response.successCount}/${allTokens.length} notifications`, {
      successCount: response.successCount,
      failureCount: response.failureCount,
      targetUserIds,
    });

    // FIXED: Clean up ONLY the specific invalid device tokens, not entire user documents
    if (response.failureCount > 0) {
      const cleanupPromises: Promise<void>[] = [];
      
      response.responses.forEach((resp, idx) => {
        if (!resp.success && resp.error) {
          const errorCode = resp.error.code;
          if (
            errorCode === 'messaging/invalid-registration-token' ||
            errorCode === 'messaging/registration-token-not-registered'
          ) {
            const invalidToken = allTokens[idx];
            
            // Find which user and device this token belongs to
            for (const [userId, userTokens] of tokenMap.entries()) {
              const deviceToken = userTokens.find(t => t.token === invalidToken);
              if (deviceToken) {
                // Delete ONLY this specific device token, not the entire user document
                cleanupPromises.push(deleteDeviceToken(userId, deviceToken.deviceId));
                break; // Token found, stop searching
              }
            }
          }
        }
      });

      // Execute all cleanup operations in parallel
      await Promise.allSettled(cleanupPromises);
    }

    res.json({
      success: true,
      successCount: response.successCount,
      failureCount: response.failureCount,
      totalTokens: allTokens.length,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request body', details: error.errors });
    }
    
    logger.error('[FCM] Error sending push notification:', error);
    res.status(500).json({ error: 'Failed to send push notification' });
  }
});

/**
 * POST /api/push-notifications/test
 * Send test notification to current user (all devices)
 */
router.post('/test', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).firebaseUser?.uid;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Fetch all user's device tokens
    const deviceTokens = await getAllUserTokens(userId);
    
    if (deviceTokens.length === 0) {
      return res.status(404).json({ error: 'No FCM tokens registered for this user' });
    }

    // Send test notification to all user's devices
    const message: admin.messaging.MulticastMessage = {
      notification: {
        title: '🐾 Pet Wash™ Test Notification',
        body: `Push notifications are working! Sent to ${deviceTokens.length} device(s).`,
      },
      data: {
        url: '/dashboard',
        tag: 'test-notification',
      },
      webpush: {
        notification: {
          title: '🐾 Pet Wash™ Test Notification',
          body: `Push notifications are working! Sent to ${deviceTokens.length} device(s).`,
          icon: '/brand/petwash-logo-official.png',
          badge: '/brand/petwash-logo-official.png',
          requireInteraction: false,
        },
        fcmOptions: {
          link: '/dashboard',
        },
      },
      tokens: deviceTokens.map(t => t.token),
    };

    const response = await admin.messaging().sendEachForMulticast(message);

    // Clean up invalid tokens
    if (response.failureCount > 0) {
      const cleanupPromises: Promise<void>[] = [];
      
      response.responses.forEach((resp, idx) => {
        if (!resp.success && resp.error) {
          const errorCode = resp.error.code;
          if (
            errorCode === 'messaging/invalid-registration-token' ||
            errorCode === 'messaging/registration-token-not-registered'
          ) {
            const invalidDevice = deviceTokens[idx];
            cleanupPromises.push(deleteDeviceToken(userId, invalidDevice.deviceId));
          }
        }
      });

      await Promise.allSettled(cleanupPromises);
    }

    logger.info(`[FCM] Test notification sent to user ${userId} (${response.successCount}/${deviceTokens.length} devices)`);

    res.json({
      success: true,
      message: `Test notification sent to ${response.successCount} device(s)`,
      successCount: response.successCount,
      failureCount: response.failureCount,
      totalDevices: deviceTokens.length,
    });
  } catch (error: any) {
    logger.error('[FCM] Error sending test notification:', error);
    res.status(500).json({ error: 'Failed to send test notification' });
  }
});

/**
 * GET /api/push-notifications/status
 * Check if user has FCM tokens registered (list all devices)
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).firebaseUser?.uid;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const devicesSnapshot = await firestore
      .collection('fcmTokens')
      .doc(userId)
      .collection('devices')
      .get();
    
    if (devicesSnapshot.empty) {
      return res.json({
        registered: false,
        devices: [],
        message: 'No FCM tokens registered',
      });
    }

    const devices = devicesSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        deviceId: doc.id,
        deviceName: data.deviceName,
        browser: data.browser,
        platform: data.platform,
        createdAt: data.createdAt?.toDate(),
        updatedAt: data.updatedAt?.toDate(),
        lastUsed: data.lastUsed?.toDate(),
      };
    });

    res.json({
      registered: true,
      deviceCount: devices.length,
      devices,
    });
  } catch (error) {
    logger.error('[FCM] Error checking FCM status:', error);
    res.status(500).json({ error: 'Failed to check FCM status' });
  }
});

/**
 * DELETE /api/push-notifications/device/:deviceId
 * Remove a specific device token
 */
router.delete('/device/:deviceId', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).firebaseUser?.uid;
    const { deviceId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await deleteDeviceToken(userId, deviceId);

    res.json({
      success: true,
      message: 'Device token removed successfully',
    });
  } catch (error) {
    logger.error('[FCM] Error deleting device token:', error);
    res.status(500).json({ error: 'Failed to delete device token' });
  }
});

export default router;
