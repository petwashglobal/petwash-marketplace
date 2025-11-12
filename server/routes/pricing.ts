import { Router, type Request, type Response } from 'express';
import { 
  PRICING_TIERS, 
  recommendPricingTier,
  getPaymentRetrySchedule 
} from '../utils/pricingStrategies';
import type { AuthenticatedRequest } from '../middleware/rbac';

const router = Router();

/**
 * GET /api/pricing/tiers - Get all available pricing tiers
 */
router.get('/tiers', (req: Request, res: Response) => {
  res.json(PRICING_TIERS);
});

/**
 * GET /api/pricing/recommend - Get recommended tier based on usage
 */
router.get('/recommend', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const monthlyUsage = parseInt(req.query.monthlyUsage as string) || 0;
    const recommendation = recommendPricingTier(monthlyUsage);
    res.json(recommendation);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get recommendation' });
  }
});

/**
 * GET /api/pricing/retry-schedule/:attempt - Get payment retry schedule
 */
router.get('/retry-schedule/:attempt', (req: Request, res: Response) => {
  const attemptNumber = parseInt(req.params.attempt);
  const schedule = getPaymentRetrySchedule(attemptNumber);
  res.json(schedule);
});

export default router;
