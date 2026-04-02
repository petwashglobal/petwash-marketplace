/**
 * Privacy Settings API
 * Manages user privacy preferences and tracking consent
 * 
 * AUDIT: Every consent change is logged to user_consents table with timestamp,
 * IP, user-agent, and change delta — required by Israeli Privacy Law Amendment 13, 2025
 */

import { Router, Response } from 'express';
import { db, pool } from '../db';
import { users } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { requireAuth } from '../customAuth';
import type { Request } from 'express';

const router = Router();

// ── Consent audit helper ──────────────────────────────────────────────────────
async function logConsentChange(
  userId: string,
  changes: Record<string, boolean | undefined>,
  req: Request,
) {
  const ip = req.ip || (req.headers['x-forwarded-for'] as string) || 'unknown';
  const ua = req.headers['user-agent'] || null;
  const traceId = (req as any).traceId || null;

  const entries = Object.entries(changes)
    .filter(([, v]) => v !== undefined)
    .map(([key, value]) => ({
      type: key,
      accepted: value as boolean,
    }));

  if (entries.length === 0) return;

  try {
    for (const { type, accepted } of entries) {
      await pool.query(
        `INSERT INTO user_consents
           (user_id, consent_type, consent_version, consent_text_hash, accepted, ip, user_agent, source, trace_id)
         VALUES ($1, $2, '2026.1', 'privacy-settings-change', $3, $4, $5, 'privacy_settings_ui', $6)`,
        [userId, type, accepted, ip, ua, traceId],
      );
    }
    logger.info('[Privacy] Consent audit logged', { userId, entries: entries.map(e => `${e.type}=${e.accepted}`) });
  } catch (err) {
    logger.warn('[Privacy] Consent audit log failed (non-blocking)', err);
  }
}

// ── GET /api/privacy/settings ─────────────────────────────────────────────────
router.get('/settings', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.uid;

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
      analyticsConsent: user.analyticsConsent ?? false,
      ipTrackingConsent: user.ipTrackingConsent ?? false,
      emailTrackingConsent: user.emailTrackingConsent ?? false,
      marketingConsent: user.marketingConsent ?? false,
      privacyConsentUpdatedAt: user.privacyConsentUpdatedAt,
    });
  } catch (error) {
    logger.error('[Privacy] Failed to get privacy settings', error);
    res.status(500).json({ error: 'Failed to get privacy settings' });
  }
});

// ── PUT /api/privacy/settings ─────────────────────────────────────────────────
router.put('/settings', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.uid;
    const { analyticsConsent, ipTrackingConsent, emailTrackingConsent, marketingConsent } = req.body;

    const updates = {
      analyticsConsent: analyticsConsent ?? false,
      ipTrackingConsent: ipTrackingConsent ?? false,
      emailTrackingConsent: emailTrackingConsent ?? false,
      marketingConsent: marketingConsent ?? false,
      privacyConsentUpdatedAt: new Date(),
    };

    await db.update(users).set(updates).where(eq(users.id, userId));

    await logConsentChange(
      userId,
      { analyticsConsent, ipTrackingConsent, emailTrackingConsent, marketingConsent },
      req,
    );

    logger.info('[Privacy] Updated privacy settings', { userId, updates });

    res.json({
      success: true,
      analyticsConsent: updates.analyticsConsent,
      ipTrackingConsent: updates.ipTrackingConsent,
      emailTrackingConsent: updates.emailTrackingConsent,
      marketingConsent: updates.marketingConsent,
    });
  } catch (error) {
    logger.error('[Privacy] Failed to update privacy settings', error);
    res.status(500).json({ error: 'Failed to update privacy settings' });
  }
});

// ── POST /api/privacy/opt-out-all ─────────────────────────────────────────────
// "Nuclear option" — disable all tracking and marketing in one tap
router.post('/opt-out-all', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.uid;

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

    await logConsentChange(
      userId,
      { analyticsConsent: false, ipTrackingConsent: false, emailTrackingConsent: false, marketingConsent: false },
      req,
    );

    logger.info('[Privacy] User opted out of all tracking', { userId });

    res.json({ success: true, message: 'All tracking disabled' });
  } catch (error) {
    logger.error('[Privacy] Failed to opt out', error);
    res.status(500).json({ error: 'Failed to opt out' });
  }
});

export default router;
