import { Router } from 'express';
import { WhatsAppMetaService } from '../services/WhatsAppMetaService';
import { logger } from '../lib/logger';
import { validateFirebaseToken } from '../middleware/firebase-auth';

const router = Router();

/**
 * Send Launch Event WhatsApp Notification
 * Sends festive launch notification for PetWash pilot in Kfar Saba with Municipality
 */
router.post('/api/launch-event/notify', validateFirebaseToken, async (req, res) => {
  try {
    const { phoneNumber, language } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    // Validate phone number format (E.164 format: +972XXXXXXXXX)
    if (!WhatsAppMetaService.isValidPhoneNumber(phoneNumber)) {
      return res.status(400).json({ 
        error: 'Invalid phone number format. Use E.164 format: +972XXXXXXXXX' 
      });
    }

    // Send WhatsApp message via Meta Cloud API
    const result = await WhatsAppMetaService.sendLaunchEventInvitation({
      phoneNumber,
      language: language || 'he',
      recipientName: req.firebaseUser?.email?.split('@')[0] || '',
    });

    if (result) {
      logger.info('[Launch Event] Notification sent successfully', {
        userId: req.firebaseUser?.uid,
        phoneNumber: phoneNumber.substring(0, 8) + '***', // Privacy
      });

      res.json({
        success: true,
        message: 'Launch event notification sent successfully via Meta WhatsApp Cloud API',
      });
    } else {
      logger.error('[Launch Event] Failed to send notification', {
        userId: req.firebaseUser?.uid,
      });

      res.status(500).json({
        error: 'Failed to send notification. Please try again later.',
      });
    }
  } catch (error) {
    logger.error('[Launch Event] Error sending notification', error);
    res.status(500).json({
      error: 'Internal server error',
    });
  }
});

export default router;
