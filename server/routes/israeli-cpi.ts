/**
 * Israeli CPI (Consumer Price Index) Routes
 * מדד המחירים לצרכן - API Routes
 * 
 * Endpoints for managing and querying CPI data
 */

import express, { Request, Response } from 'express';
import IsraeliCPIService from '../services/IsraeliCPIService';
import { requireAdmin } from '../middleware/rbac';
import { requireAuth } from '../customAuth';
import { logger } from '../lib/logger';

const router = express.Router();

/**
 * GET /api/israeli-cpi/latest
 * Get the latest CPI index value
 * קבלת המדד האחרון
 * Public endpoint (no auth required)
 */
router.get('/latest', async (req: Request, res: Response) => {
  try {
    const latestCPI = await IsraeliCPIService.getLatestCPI();
    
    if (!latestCPI) {
      return res.status(404).json({ 
        error: 'No CPI data available',
        errorHe: 'אין נתוני מדד זמינים'
      });
    }

    res.json({
      month: latestCPI.month,
      indexValue: parseFloat(latestCPI.indexValue),
      yearOverYearChange: latestCPI.yearOverYearChange ? parseFloat(latestCPI.yearOverYearChange) : null,
      source: latestCPI.source,
      publishedAt: latestCPI.publishedAt,
    });
  } catch (error) {
    logger.error('[CPI API] Failed to get latest CPI', error);
    res.status(500).json({ error: 'Failed to retrieve CPI data' });
  }
});

/**
 * GET /api/israeli-cpi/month/:month
 * Get CPI for a specific month
 * קבלת המדד לחודש מסוים
 * @param month - Format: "2025-01" or "YYYY-MM"
 * Public endpoint (no auth required)
 */
router.get('/month/:month', async (req: Request, res: Response) => {
  try {
    const { month } = req.params;
    
    // Validate month format (YYYY-MM)
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ 
        error: 'Invalid month format. Use YYYY-MM (e.g., 2025-01)',
        errorHe: 'פורמט חודש לא תקין. השתמש ב-YYYY-MM (למשל, 2025-01)'
      });
    }

    const cpi = await IsraeliCPIService.getCPIForMonth(month);
    
    if (!cpi) {
      return res.status(404).json({ 
        error: `CPI data not found for month: ${month}`,
        errorHe: `לא נמצאו נתוני מדד לחודש: ${month}`
      });
    }

    res.json({
      month: cpi.month,
      indexValue: parseFloat(cpi.indexValue),
      yearOverYearChange: cpi.yearOverYearChange ? parseFloat(cpi.yearOverYearChange) : null,
      source: cpi.source,
      publishedAt: cpi.publishedAt,
    });
  } catch (error) {
    logger.error('[CPI API] Failed to get CPI for month', error, { month: req.params.month });
    res.status(500).json({ error: 'Failed to retrieve CPI data' });
  }
});

/**
 * GET /api/israeli-cpi/history
 * Get CPI history (last N months)
 * קבלת היסטוריית המדד
 * @query limit - Number of months (default: 24)
 * Public endpoint (no auth required)
 */
router.get('/history', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 24;
    
    if (limit < 1 || limit > 120) {
      return res.status(400).json({ 
        error: 'Limit must be between 1 and 120',
        errorHe: 'המגבלה חייבת להיות בין 1 ל-120'
      });
    }

    const history = await IsraeliCPIService.getCPIHistory(limit);

    res.json({
      count: history.length,
      data: history.map(cpi => ({
        month: cpi.month,
        indexValue: parseFloat(cpi.indexValue),
        yearOverYearChange: cpi.yearOverYearChange ? parseFloat(cpi.yearOverYearChange) : null,
        source: cpi.source,
        publishedAt: cpi.publishedAt,
      })),
    });
  } catch (error) {
    logger.error('[CPI API] Failed to get CPI history', error);
    res.status(500).json({ error: 'Failed to retrieve CPI history' });
  }
});

/**
 * POST /api/israeli-cpi/calculate
 * Calculate CPI-indexed amount (הצמדה למדד)
 * @body originalAmount - Original amount in ILS
 * @body baseMonth - Base month (format: "2024-01")
 * @body currentMonth - Current month (optional, defaults to latest)
 * Public endpoint (no auth required)
 */
router.post('/calculate', async (req: Request, res: Response) => {
  try {
    const { originalAmount, baseMonth, currentMonth } = req.body;

    // Validation
    if (!originalAmount || typeof originalAmount !== 'number') {
      return res.status(400).json({ 
        error: 'originalAmount is required and must be a number',
        errorHe: 'originalAmount נדרש וחייב להיות מספר'
      });
    }

    if (!baseMonth || !/^\d{4}-\d{2}$/.test(baseMonth)) {
      return res.status(400).json({ 
        error: 'baseMonth is required and must be in YYYY-MM format',
        errorHe: 'baseMonth נדרש וחייב להיות בפורמט YYYY-MM'
      });
    }

    if (currentMonth && !/^\d{4}-\d{2}$/.test(currentMonth)) {
      return res.status(400).json({ 
        error: 'currentMonth must be in YYYY-MM format',
        errorHe: 'currentMonth חייב להיות בפורמט YYYY-MM'
      });
    }

    const result = await IsraeliCPIService.calculateIndexedAmount(
      originalAmount,
      baseMonth,
      currentMonth
    );

    res.json(result);
  } catch (error: any) {
    logger.error('[CPI API] Failed to calculate indexed amount', error, { 
      body: req.body });
    res.status(500).json({ 
      error: error.message || 'Failed to calculate indexed amount',
      errorHe: 'נכשל בחישוב סכום מוצמד'
    });
  }
});

/**
 * POST /api/israeli-cpi/calculate-rent
 * Calculate rent adjustment based on CPI (הצמדה לשכר דירה)
 * @body originalRent - Original monthly rent in ILS
 * @body contractStartMonth - Contract start month (format: "2024-01")
 * @body adjustmentMonth - Adjustment month (optional, defaults to latest)
 * Requires authentication
 */
router.post('/calculate-rent', requireAuth, async (req: Request, res: Response) => {
  try {
    const { originalRent, contractStartMonth, adjustmentMonth } = req.body;

    // Validation
    if (!originalRent || typeof originalRent !== 'number') {
      return res.status(400).json({ 
        error: 'originalRent is required and must be a number',
        errorHe: 'originalRent נדרש וחייב להיות מספר'
      });
    }

    if (!contractStartMonth || !/^\d{4}-\d{2}$/.test(contractStartMonth)) {
      return res.status(400).json({ 
        error: 'contractStartMonth is required and must be in YYYY-MM format',
        errorHe: 'contractStartMonth נדרש וחייב להיות בפורמט YYYY-MM'
      });
    }

    const result = await IsraeliCPIService.calculateRentAdjustment(
      originalRent,
      contractStartMonth,
      adjustmentMonth
    );

    res.json(result);
  } catch (error: any) {
    logger.error('[CPI API] Failed to calculate rent adjustment', error, { 
      body: req.body });
    res.status(500).json({ 
      error: error.message || 'Failed to calculate rent adjustment',
      errorHe: 'נכשל בחישוב התאמת שכר דירה'
    });
  }
});

/**
 * POST /api/israeli-cpi/add
 * Add new CPI index entry
 * הוספת מדד חדש
 * Admin only
 */
router.post('/add', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { month, indexValue, yearOverYearChange, source } = req.body;

    // Validation
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ 
        error: 'month is required and must be in YYYY-MM format',
        errorHe: 'month נדרש וחייב להיות בפורמט YYYY-MM'
      });
    }

    if (!indexValue || typeof indexValue !== 'number') {
      return res.status(400).json({ 
        error: 'indexValue is required and must be a number',
        errorHe: 'indexValue נדרש וחייב להיות מספר'
      });
    }

    const newEntry = await IsraeliCPIService.addCPIIndex(
      month,
      indexValue,
      yearOverYearChange || null,
      source || 'Manual'
    );

    logger.info('[CPI API] New CPI index added', {
      month,
      indexValue,
      adminId: req.firebaseUser?.uid || req.user?.uid,
    });

    res.status(201).json({
      success: true,
      data: {
        month: newEntry.month,
        indexValue: parseFloat(newEntry.indexValue),
        yearOverYearChange: newEntry.yearOverYearChange ? parseFloat(newEntry.yearOverYearChange) : null,
        source: newEntry.source,
        publishedAt: newEntry.publishedAt,
      },
    });
  } catch (error: any) {
    logger.error('[CPI API] Failed to add CPI index', error, { 
      body: req.body });
    res.status(500).json({ 
      error: error.message || 'Failed to add CPI index',
      errorHe: 'נכשל בהוספת מדד'
    });
  }
});

/**
 * GET /api/israeli-cpi/status
 * Check if CPI data is up to date
 * בדיקה האם המדד מעודכן
 * Admin only
 */
router.get('/status', requireAdmin, async (req: Request, res: Response) => {
  try {
    const latest = await IsraeliCPIService.getLatestCPI();
    const isCurrent = await IsraeliCPIService.isCPIDataCurrent();

    res.json({
      isCurrent,
      latestMonth: latest?.month || null,
      latestValue: latest ? parseFloat(latest.indexValue) : null,
      lastPublished: latest?.publishedAt || null,
      message: isCurrent 
        ? 'CPI data is up to date' 
        : 'CPI data needs update (publish monthly on 15th)',
      messageHe: isCurrent 
        ? 'נתוני המדד מעודכנים' 
        : 'נתוני המדד זקוקים לעדכון (מתפרסם ב-15 לחודש)',
    });
  } catch (error) {
    logger.error('[CPI API] Failed to check CPI status', error);
    res.status(500).json({ error: 'Failed to check CPI status' });
  }
});

/**
 * POST /api/israeli-cpi/seed
 * Seed initial CPI data (2024-2025)
 * נתונים ראשוניים של המדד
 * Admin only - One-time setup
 */
router.post('/seed', requireAdmin, async (req: Request, res: Response) => {
  try {
    await IsraeliCPIService.seedInitialData();

    logger.info('[CPI API] CPI data seeded successfully', {
      adminId: req.firebaseUser?.uid || req.user?.uid,
    });

    res.json({
      success: true,
      message: 'CPI data seeded successfully',
      messageHe: 'נתוני המדד נוספו בהצלחה',
    });
  } catch (error: any) {
    logger.error('[CPI API] Failed to seed CPI data', error);
    res.status(500).json({ 
      error: error.message || 'Failed to seed CPI data',
      errorHe: 'נכשל בהוספת נתוני המדד'
    });
  }
});

export default router;
