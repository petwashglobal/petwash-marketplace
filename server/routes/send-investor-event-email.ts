/**
 * Send Investor Launch Event Email
 * Luxury event invitation
 */

import { Router } from 'express';
import { sendInvestorLaunchEventEmail } from '../email/luxury-email-service';
import { logger } from '../lib/logger';

const router = Router();

/**
 * POST /api/send-investor-event-email
 * Send luxury investor launch event email
 */
router.post('/send-investor-event-email', async (req, res) => {
  try {
    const { email, name, language = 'he', cc } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email required' });
    }

    logger.info('[Investor Event Email] Sending invitation', { email, name, cc });

    const success = await sendInvestorLaunchEventEmail(email, name, language, cc);

    if (success) {
      logger.info('[Investor Event Email] Sent successfully', { email, cc });
      res.json({
        success: true,
        message: 'Luxury investor launch event invitation sent successfully',
        email,
        cc
      });
    } else {
      logger.warn('[Investor Event Email] Failed to send', { email });
      res.status(500).json({
        error: 'Failed to send invitation email'
      });
    }

  } catch (error) {
    logger.error('[Investor Event Email] Error', error);
    res.status(500).json({
      error: 'Failed to send invitation',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
