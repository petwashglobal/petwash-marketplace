/**
 * Global Special Days Promotions API
 * 
 * Automatic discounts for international holidays
 */

import express, { type Router } from 'express';
import { 
  getTodaysPromotion, 
  getUpcomingPromotions,
  applyPromotionDiscount,
  hasPromotionOnDate,
  SPECIAL_DAYS_2025
} from '../services/globalPromotions';
import { logger } from '../lib/logger';
import { z } from 'zod';

const router: Router = express.Router();

/**
 * GET /api/promotions/today
 * Get today's active promotion
 */
router.get('/today', async (req, res) => {
  try {
    const { country } = req.query;
    
    const promotion = getTodaysPromotion(country as string);

    if (!promotion) {
      return res.json({
        success: true,
        hasPromotion: false,
        message: 'No special promotion today',
      });
    }

    res.json({
      success: true,
      hasPromotion: true,
      promotion,
    });

  } catch (error) {
    logger.error('[Promotions API] Error getting today\'s promotion:', error);
    res.status(500).json({ error: 'Failed to get promotion' });
  }
});

/**
 * GET /api/promotions/upcoming
 * Get upcoming promotions (next 30 days)
 */
router.get('/upcoming', async (req, res) => {
  try {
    const { country, days } = req.query;
    const daysAhead = days ? parseInt(days as string) : 30;

    const promotions = getUpcomingPromotions(daysAhead, country as string);

    res.json({
      success: true,
      count: promotions.length,
      promotions,
    });

  } catch (error) {
    logger.error('[Promotions API] Error getting upcoming promotions:', error);
    res.status(500).json({ error: 'Failed to get promotions' });
  }
});

/**
 * GET /api/promotions/all
 * Get all 2025 special days
 */
router.get('/all', async (req, res) => {
  try {
    res.json({
      success: true,
      count: SPECIAL_DAYS_2025.length,
      promotions: SPECIAL_DAYS_2025,
    });

  } catch (error) {
    logger.error('[Promotions API] Error getting all promotions:', error);
    res.status(500).json({ error: 'Failed to get promotions' });
  }
});

/**
 * POST /api/promotions/calculate
 * Calculate final price with promotion discount
 */
router.post('/calculate', async (req, res) => {
  try {
    const schema = z.object({
      basePrice: z.number().positive(),
      promotionId: z.string().optional(),
      existingDiscount: z.number().min(0).max(100).default(0),
    });

    const validation = schema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: validation.error.errors 
      });
    }

    const { basePrice, promotionId, existingDiscount } = validation.data;

    // Find promotion
    let promotion;
    if (promotionId) {
      promotion = SPECIAL_DAYS_2025.find(p => p.id === promotionId);
    } else {
      promotion = getTodaysPromotion();
    }

    if (!promotion) {
      return res.json({
        success: true,
        hasPromotion: false,
        finalPrice: basePrice,
        discountAmount: 0,
        discountPercent: 0,
      });
    }

    const result = applyPromotionDiscount(basePrice, promotion, existingDiscount);

    res.json({
      success: true,
      hasPromotion: true,
      promotion,
      ...result,
    });

  } catch (error) {
    logger.error('[Promotions API] Error calculating discount:', error);
    res.status(500).json({ error: 'Failed to calculate discount' });
  }
});

/**
 * GET /api/promotions/check/:date
 * Check if a specific date has a promotion
 */
router.get('/check/:date', async (req, res) => {
  try {
    const { date } = req.params;
    const { country } = req.query;

    const checkDate = new Date(date);
    
    if (isNaN(checkDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date format' });
    }

    const hasPromo = hasPromotionOnDate(checkDate, country as string);

    res.json({
      success: true,
      date,
      hasPromotion: hasPromo,
    });

  } catch (error) {
    logger.error('[Promotions API] Error checking date:', error);
    res.status(500).json({ error: 'Failed to check date' });
  }
});

export default router;
