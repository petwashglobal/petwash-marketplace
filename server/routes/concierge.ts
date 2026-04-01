import { Router, type Response } from 'express';
import {
  createConciergeRequest,
  generateProactiveAlerts,
  createPremiumOnboarding,
  type PetCareConciergeRequest,
} from '../utils/appleCX';
import type { AuthenticatedRequest } from '../middleware/rbac';
import { pool } from '../db';
import { logger } from '../lib/logger';

const router = Router();

/**
 * POST /api/concierge/request - Create Pet Care Concierge request
 */
router.post('/request', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.firebaseUser!.uid;
    const requestData: PetCareConciergeRequest = { userId, ...req.body };
    const result = createConciergeRequest(requestData);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create concierge request' });
  }
});

/**
 * GET /api/concierge/alerts
 * Proactive care alerts based on the user's real wash/booking history.
 * Queries nayax_transactions for K9000 washes and pet profile for age.
 */
router.get('/alerts', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.firebaseUser!.uid;

    // ── Fetch real wash history from nayax_transactions ──────────────────────
    const washHistory = await pool.query(
      `SELECT
         MAX(completed_at)                          AS last_wash_date,
         COUNT(*)                                   AS total_washes,
         CASE WHEN COUNT(*) > 1 THEN
           EXTRACT(EPOCH FROM (MAX(completed_at) - MIN(completed_at)))
           / 86400 / NULLIF(COUNT(*) - 1, 0)
         ELSE NULL END                              AS avg_interval_days
       FROM nayax_transactions
       WHERE customer_uid = $1
         AND status = 'settled'
         AND wash_type IS NOT NULL`,
      [userId]
    );

    // ── Fetch pet age from pets table (first active pet) ─────────────────────
    const petInfo = await pool.query(
      `SELECT date_of_birth FROM pets
       WHERE owner_id = $1 AND is_active = true
       ORDER BY created_at ASC LIMIT 1`,
      [userId]
    );

    const row = washHistory.rows[0];
    const lastWashDate: Date | null = row?.last_wash_date
      ? new Date(row.last_wash_date)
      : null;
    const totalWashes: number = parseInt(row?.total_washes ?? '0');
    const avgIntervalDays: number = row?.avg_interval_days
      ? parseFloat(row.avg_interval_days)
      : 21; // industry default: 3 weeks

    let petAgeYears = 3; // safe default
    if (petInfo.rows[0]?.date_of_birth) {
      const dob = new Date(petInfo.rows[0].date_of_birth);
      petAgeYears = (Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    }

    const activity = {
      lastWashDate: lastWashDate ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      averageWashInterval: Math.round(avgIntervalDays),
      petAge: Math.round(petAgeYears),
      totalWashes,
    };

    const alerts = generateProactiveAlerts(userId, activity);
    res.json(alerts);
  } catch (error: any) {
    logger.error('[Concierge] Failed to build alerts from real data', { error: error.message });
    res.status(500).json({ error: 'Failed to get alerts' });
  }
});

/**
 * GET /api/concierge/onboarding - Premium onboarding experience
 */
router.get('/onboarding', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.firebaseUser!.uid;
    const onboarding = createPremiumOnboarding(userId);
    res.json(onboarding);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get onboarding' });
  }
});

export default router;
