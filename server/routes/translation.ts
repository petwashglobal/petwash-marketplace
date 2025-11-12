/**
 * Gemini AI Translation API Routes
 * Perfect translations with API monitoring
 */

import express, { type Router } from 'express';
import { 
  translateWithGemini, 
  batchTranslate, 
  getTranslationMetrics,
  getQualityScore,
  healthCheck 
} from '../services/geminiTranslation';
import { logger } from '../lib/logger';
import { z } from 'zod';

const router: Router = express.Router();

// Validation schemas
const translateSchema = z.object({
  text: z.string().min(1, 'Text is required'),
  targetLanguage: z.enum(['he', 'en', 'ar', 'ru', 'fr', 'es']),
  sourceLanguage: z.enum(['he', 'en', 'ar', 'ru', 'fr', 'es']).optional(),
  context: z.string().optional(),
});

const batchTranslateSchema = z.object({
  texts: z.array(z.string()).min(1, 'At least one text required'),
  targetLanguage: z.enum(['he', 'en', 'ar', 'ru', 'fr', 'es']),
  sourceLanguage: z.enum(['he', 'en', 'ar', 'ru', 'fr', 'es']).optional(),
  context: z.string().optional(),
});

/**
 * POST /api/translate
 * Translate text using Gemini AI (NOT Google Translate!)
 */
router.post('/', async (req, res) => {
  try {
    const validation = translateSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: validation.error.errors 
      });
    }

    const { text, targetLanguage, sourceLanguage, context } = validation.data;

    logger.info(`[Translation API] Translating to ${targetLanguage}`);

    const result = await translateWithGemini(
      text,
      targetLanguage,
      sourceLanguage,
      context
    );

    // Check if translation actually happened
    if (!result.success) {
      return res.status(500).json({
        error: 'Translation failed',
        message: result.error || 'Gemini AI translation service unavailable',
        fallbackUsed: true,
        originalText: text,
      });
    }

    res.json({
      success: true,
      translatedText: result.translatedText,
      targetLanguage,
      sourceLanguage: sourceLanguage || 'auto',
      provider: 'gemini-ai',
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    logger.error('[Translation API] Error:', error);
    res.status(500).json({ 
      error: 'Translation failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/translate/batch
 * Translate multiple texts in parallel
 */
router.post('/batch', async (req, res) => {
  try {
    const validation = batchTranslateSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: validation.error.errors 
      });
    }

    const { texts, targetLanguage, sourceLanguage, context } = validation.data;

    logger.info(`[Translation API] Batch translating ${texts.length} texts to ${targetLanguage}`);

    const results = await batchTranslate(
      texts,
      targetLanguage,
      sourceLanguage,
      context
    );

    // Check if any translations failed
    const failures = results.filter(r => !r.success);
    
    res.json({
      success: failures.length === 0,
      results,
      successCount: results.filter(r => r.success).length,
      failureCount: failures.length,
      count: results.length,
      targetLanguage,
      sourceLanguage: sourceLanguage || 'auto',
      provider: 'gemini-ai',
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    logger.error('[Translation API] Batch error:', error);
    res.status(500).json({ 
      error: 'Batch translation failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/translate/metrics
 * Get translation API monitoring metrics
 */
router.get('/metrics', async (req, res) => {
  try {
    const metrics = getTranslationMetrics();
    const qualityScore = getQualityScore();

    res.json({
      success: true,
      metrics: {
        ...metrics,
        qualityScore,
        successRate: metrics.totalRequests > 0 
          ? ((metrics.successfulTranslations / metrics.totalRequests) * 100).toFixed(2) + '%'
          : 'N/A',
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    logger.error('[Translation API] Metrics error:', error);
    res.status(500).json({ error: 'Failed to get metrics' });
  }
});

/**
 * GET /api/translate/health
 * Health check for Gemini AI translation service
 */
router.get('/health', async (req, res) => {
  try {
    const health = await healthCheck();

    res.json({
      success: health.healthy,
      health,
      provider: 'gemini-ai',
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    logger.error('[Translation API] Health check error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Health check failed' 
    });
  }
});

export default router;
