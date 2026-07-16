/**
 * FCM (Firebase Cloud Messaging) API Routes
 * Push notification token management
 */

import { Router } from 'express';
import { FCMService } from '../services/FCMService';
import { requireAuth } from '../customAuth';
import { logger } from '../lib/logger';
import { recordPushDevice } from '../services/notificationAudit';

const router = Router();

/**
 * Register FCM token for push notifications
 * POST /api/fcm/register-token
 */
router.post('/register-token', requireAuth, async (req, res) => {
  try {
    const { token } = req.body;
    const userId = req.user!.uid;
    
    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }
    
    await FCMService.registerToken(userId, token);

    // Canonical Postgres token record (hashed + audited). Non-fatal — never blocks
    // registration. Fills push_devices so the §30א audit / token lifecycle is queryable.
    const { deviceType, deviceName, appVersion, locale, timezone } = req.body ?? {};
    await recordPushDevice({ userId, token, deviceType, deviceName, appVersion, locale, timezone });

    res.json({
      success: true,
      message: 'FCM token registered successfully',
    });
  } catch (error: any) {
    logger.error('[FCM API] Register token failed', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Remove FCM token (logout/device change)
 * POST /api/fcm/remove-token
 */
router.post('/remove-token', requireAuth, async (req, res) => {
  try {
    const { token } = req.body;
    const userId = req.user!.uid;
    
    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }
    
    await FCMService.removeToken(userId, token);
    
    res.json({
      success: true,
      message: 'FCM token removed successfully',
    });
  } catch (error: any) {
    logger.error('[FCM API] Remove token failed', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Test push notification (development only)
 * POST /api/fcm/test
 */
router.post('/test', requireAuth, async (req, res) => {
  try {
    const { title, body } = req.body;
    const userId = req.user!.uid;
    
    const success = await FCMService.sendToUser({
      userId,
      title: title || 'Test Notification',
      body: body || 'This is a test notification from ⁦PetWash™⁩',
      data: {
        type: 'test',
      },
    });
    
    res.json({
      success,
      message: success ? 'Test notification sent' : 'No FCM tokens found',
    });
  } catch (error: any) {
    logger.error('[FCM API] Test notification failed', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
