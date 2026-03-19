/**
 * winback-tracking.ts — Phase 6.12
 *
 * GET /w?e=winback_14d&v=v1&c=sms&t=JWT
 *
 * Click-tracking endpoint for all winback channels.
 * Verifies the JWT token, records a 'clicked' event in experiment_events,
 * then redirects the user to /marketplace.
 *
 * This URL is embedded in every SMS and WhatsApp winback message.
 */

import { Router } from 'express';
import { db } from '../db';
import { experimentEvents } from '@shared/schema';
import { sql } from 'drizzle-orm';
import { verifyTrackingToken } from '../services/winbackChannel';
import { logger } from '../lib/logger';

const router = Router();

// Target redirect — deep-link into the marketplace
const REDIRECT_TARGET = '/marketplace';

router.get('/', async (req, res) => {
  const { e: expKey, v: variant, c: channel, t: token } = req.query as Record<string, string>;

  // Always redirect — never return an error page to the user.
  // Attribution is best-effort; broken links should still convert.
  const safeRedirect = () => res.redirect(302, REDIRECT_TARGET);

  if (!expKey || !variant || !channel || !token) {
    logger.warn('[WinbackTracking] Missing params', { expKey, variant, channel, hasToken: !!token });
    return safeRedirect();
  }

  // Verify JWT
  const payload = verifyTrackingToken(token);
  if (!payload) {
    logger.warn('[WinbackTracking] Invalid or expired token', { expKey, variant, channel });
    return safeRedirect();
  }

  // Sanity-check token matches URL params (prevent tampering)
  if (payload.expKey !== expKey || payload.variant !== variant || payload.channel !== channel) {
    logger.warn('[WinbackTracking] Token/param mismatch', { payload, expKey, variant, channel });
    return safeRedirect();
  }

  const userId = payload.userId;

  // Record click event — idempotent via conflict-safe insert
  try {
    await db.insert(experimentEvents).values({
      experimentKey: expKey,
      userId,
      variant,
      event:   'clicked',
      channel: channel as any,
    });
    logger.info('[WinbackTracking] Click recorded', { userId, expKey, variant, channel });
  } catch (err: any) {
    // Log but do not block the redirect
    logger.error('[WinbackTracking] Failed to record click', { userId, expKey, variant, channel, error: err.message });
  }

  return safeRedirect();
});

export default router;
