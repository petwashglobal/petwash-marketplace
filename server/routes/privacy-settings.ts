/**
 * Privacy Settings API
 * Manages user privacy preferences and tracking consent
 */

import { Router, Response } from 'express';
import { db } from '../lib/db';
import { users } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { logger } from '../lib/logger';
import type { AuthenticatedRequest } from '../middleware/auth';
import { requireAuth } from '../middleware/auth';

const router = Router();

/**
 * GET /api/privacy/settings
 * Get current user's privacy settings
 */
router.get('/settings', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.uid;

    const [user] = await db
      .select({
        analyticsConsent: users.analyticsConsent,
        ipTrackingConsent: users.ipTrackingConsent,
        emailTrackingConsent: users.emailTrackingConsent,
        marketingConsent: users.marketingConsent,
        privacyConsentUpdatedAt: users.privacyConsentUpdatedAt,
      })
      .from(users)
      .where(eq(users.id, userId));

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({
      analyticsConsent: user.analyticsConsent || false,
      ipTrackingConsent: user.ipTrackingConsent || false,
      emailTrackingConsent: user.emailTrackingConsent || false,
      marketingConsent: user.marketingConsent || false,
      privacyConsentUpdatedAt: user.privacyConsentUpdatedAt,
    });
  } catch (error) {
    logger.error('[Privacy] Failed to get privacy settings', error);
    res.status(500).json({ error: 'Failed to get privacy settings' });
  }
});

/**
 * PUT /api/privacy/settings
 * Update privacy preferences
 */
router.put('/settings', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.uid;
    const { analyticsConsent, ipTrackingConsent, emailTrackingConsent, marketingConsent } = req.body;

    await db
      .update(users)
      .set({
        analyticsConsent: analyticsConsent ?? false,
        ipTrackingConsent: ipTrackingConsent ?? false,
        emailTrackingConsent: emailTrackingConsent ?? false,
        marketingConsent: marketingConsent ?? false,
        privacyConsentUpdatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    logger.info('[Privacy] Updated privacy settings', {
      userId,
      analyticsConsent,
      ipTrackingConsent,
      emailTrackingConsent,
      marketingConsent,
    });

    res.json({
      success: true,
      analyticsConsent: analyticsConsent ?? false,
      ipTrackingConsent: ipTrackingConsent ?? false,
      emailTrackingConsent: emailTrackingConsent ?? false,
      marketingConsent: marketingConsent ?? false,
    });
  } catch (error) {
    logger.error('[Privacy] Failed to update privacy settings', error);
    res.status(500).json({ error: 'Failed to update privacy settings' });
  }
});

/**
 * POST /api/privacy/opt-out-all
 * Disable all tracking (nuclear option)
 */
router.post('/opt-out-all', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.uid;

    await db
      .update(users)
      .set({
        analyticsConsent: false,
        ipTrackingConsent: false,
        emailTrackingConsent: false,
        marketingConsent: false,
        privacyConsentUpdatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    logger.info('[Privacy] User opted out of all tracking', { userId });

    res.json({
      success: true,
      message: 'All tracking disabled',
    });
  } catch (error) {
    logger.error('[Privacy] Failed to opt out', error);
    res.status(500).json({ error: 'Failed to opt out' });
  }
});

export default router;
