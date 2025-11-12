/**
 * Test Luxury Launch Email
 * Send beautiful brand launch emails to team
 */

import { Router } from 'express';
import { sendLuxuryLaunchEmail } from '../email/luxury-email-service';
import { logger } from '../lib/logger';

const router = Router();

/**
 * POST /api/test-luxury-launch
 * Send luxury brand launch emails to team members
 */
router.post('/test-luxury-launch', async (req, res) => {
  try {
    const { recipients } = req.body;

    if (!recipients || !Array.isArray(recipients)) {
      return res.status(400).json({ 
        error: 'Recipients array required',
        example: {
          recipients: [
            { email: 'test@example.com', name: 'Test User', language: 'en' }
          ]
        }
      });
    }

    logger.info('[Luxury Launch] Sending launch emails', { count: recipients.length });

    // Send emails to all recipients in parallel
    const results = await Promise.allSettled(
      recipients.map((recipient: any) => 
        sendLuxuryLaunchEmail(
          recipient.email,
          recipient.name,
          recipient.language || 'en'
        )
      )
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    logger.info('[Luxury Launch] Email sending complete', { successful, failed });

    res.json({
      success: true,
      message: `Sent ${successful} luxury launch emails`,
      stats: {
        total: recipients.length,
        successful,
        failed
      },
      recipients: recipients.map((r: any, index: number) => ({
        email: r.email,
        name: r.name,
        language: r.language || 'en',
        status: results[index].status === 'fulfilled' ? 'sent' : 'failed'
      }))
    });

  } catch (error) {
    logger.error('[Luxury Launch] Error sending emails', error);
    res.status(500).json({ 
      error: 'Failed to send luxury launch emails',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
