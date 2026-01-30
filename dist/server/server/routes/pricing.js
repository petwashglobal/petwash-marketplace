import { Router } from 'express';
import { PRICING_TIERS, recommendPricingTier, getPaymentRetrySchedule } from '../utils/pricingStrategies';
const router = Router();
/**
 * GET /api/pricing/tiers - Get all available pricing tiers
 */
router.get('/tiers', (req, res) => {
    res.json(PRICING_TIERS);
});
/**
 * GET /api/pricing/recommend - Get recommended tier based on usage
 */
router.get('/recommend', async (req, res) => {
    try {
        const monthlyUsage = parseInt(req.query.monthlyUsage) || 0;
        const recommendation = recommendPricingTier(monthlyUsage);
        res.json(recommendation);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to get recommendation' });
    }
});
/**
 * GET /api/pricing/retry-schedule/:attempt - Get payment retry schedule
 */
router.get('/retry-schedule/:attempt', (req, res) => {
    const attemptNumber = parseInt(req.params.attempt);
    const schedule = getPaymentRetrySchedule(attemptNumber);
    res.json(schedule);
});
export default router;
