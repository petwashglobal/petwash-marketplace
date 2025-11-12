/**
 * Gemini AI Watchdog API Routes
 * Admin-only routes for managing and monitoring the watchdog system
 */

import { Router } from 'express';
import { logger } from '../lib/logger';
import GeminiWatchdogService from '../services/GeminiWatchdogService';
import { db } from '../db';
import { 
  watchdogIssues, 
  watchdogUserStruggles, 
  watchdogAutoFixes,
  watchdogCheckoutMonitoring,
  watchdogRegistrationMonitoring,
  watchdogUserJourneys
} from '../../shared/schema-gemini-watchdog';
import { eq, desc, and, sql } from 'drizzle-orm';

const router = Router();

/**
 * Get watchdog status and statistics
 */
router.get('/status', async (req, res) => {
  try {
    const status = await GeminiWatchdogService.getStatus();
    res.json({ success: true, status });
  } catch (error: any) {
    logger.error('[Gemini Watchdog API] Failed to get status', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get all open issues
 */
router.get('/issues', async (req, res) => {
  try {
    const { status = 'open', limit = 50 } = req.query;
    
    const issues = await db.query.watchdogIssues.findMany({
      where: status === 'all' ? undefined : eq(watchdogIssues.status, status as string),
      orderBy: [desc(watchdogIssues.detectedAt)],
      limit: parseInt(limit as string)
    });

    res.json({ success: true, issues });
  } catch (error: any) {
    logger.error('[Gemini Watchdog API] Failed to get issues', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get user struggles
 */
router.get('/struggles', async (req, res) => {
  try {
    const { resolved = 'false', limit = 50 } = req.query;
    
    const struggles = await db.query.watchdogUserStruggles.findMany({
      where: resolved === 'all' ? undefined : eq(watchdogUserStruggles.resolved, resolved === 'true'),
      orderBy: [desc(watchdogUserStruggles.detectedAt)],
      limit: parseInt(limit as string)
    });

    res.json({ success: true, struggles });
  } catch (error: any) {
    logger.error('[Gemini Watchdog API] Failed to get struggles', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get auto-fixes history
 */
router.get('/auto-fixes', async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    
    const autoFixes = await db.query.watchdogAutoFixes.findMany({
      orderBy: [desc(watchdogAutoFixes.appliedAt)],
      limit: parseInt(limit as string)
    });

    res.json({ success: true, autoFixes });
  } catch (error: any) {
    logger.error('[Gemini Watchdog API] Failed to get auto-fixes', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get checkout monitoring data
 */
router.get('/checkout', async (req, res) => {
  try {
    const { userId, step, limit = 100 } = req.query;
    
    let where = undefined;
    if (userId) {
      where = eq(watchdogCheckoutMonitoring.userId, userId as string);
    } else if (step) {
      where = eq(watchdogCheckoutMonitoring.step, step as string);
    }
    
    const checkouts = await db.query.watchdogCheckoutMonitoring.findMany({
      where,
      orderBy: [desc(watchdogCheckoutMonitoring.timestamp)],
      limit: parseInt(limit as string)
    });

    res.json({ success: true, checkouts });
  } catch (error: any) {
    logger.error('[Gemini Watchdog API] Failed to get checkout data', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get registration monitoring data
 */
router.get('/registration', async (req, res) => {
  try {
    const { step, limit = 100 } = req.query;
    
    const registrations = await db.query.watchdogRegistrationMonitoring.findMany({
      where: step ? eq(watchdogRegistrationMonitoring.step, step as string) : undefined,
      orderBy: [desc(watchdogRegistrationMonitoring.timestamp)],
      limit: parseInt(limit as string)
    });

    res.json({ success: true, registrations });
  } catch (error: any) {
    logger.error('[Gemini Watchdog API] Failed to get registration data', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get user journey analytics
 */
router.get('/journeys', async (req, res) => {
  try {
    const { userId, journey, limit = 100 } = req.query;
    
    let where = undefined;
    if (userId) {
      where = eq(watchdogUserJourneys.userId, userId as string);
    } else if (journey) {
      where = eq(watchdogUserJourneys.journey, journey as string);
    }
    
    const journeys = await db.query.watchdogUserJourneys.findMany({
      where,
      orderBy: [desc(watchdogUserJourneys.timestamp)],
      limit: parseInt(limit as string)
    });

    // Calculate success rate
    const totalJourneys = journeys.length;
    const successfulJourneys = journeys.filter(j => j.success).length;
    const successRate = totalJourneys > 0 ? (successfulJourneys / totalJourneys) * 100 : 0;

    res.json({ 
      success: true, 
      journeys,
      analytics: {
        total: totalJourneys,
        successful: successfulJourneys,
        failed: totalJourneys - successfulJourneys,
        successRate: successRate.toFixed(2)
      }
    });
  } catch (error: any) {
    logger.error('[Gemini Watchdog API] Failed to get journeys', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Track user action (called by frontend/backend)
 */
router.post('/track-action', async (req, res) => {
  try {
    const { userId, sessionId, action, success, context } = req.body;

    if (!userId || !sessionId || !action || typeof success !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: userId, sessionId, action, success'
      });
    }

    await GeminiWatchdogService.trackUserAction({
      userId,
      sessionId,
      action,
      success,
      context
    });

    res.json({ success: true, message: 'Action tracked' });
  } catch (error: any) {
    logger.error('[Gemini Watchdog API] Failed to track action', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Track checkout step (called by payment routes)
 */
router.post('/track-checkout', async (req, res) => {
  try {
    const { userId, sessionId, step, amount, paymentMethod, errorMessage } = req.body;

    if (!userId || !sessionId || !step) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: userId, sessionId, step'
      });
    }

    await GeminiWatchdogService.trackCheckout({
      userId,
      sessionId,
      step,
      amount,
      paymentMethod,
      errorMessage
    });

    res.json({ success: true, message: 'Checkout tracked' });
  } catch (error: any) {
    logger.error('[Gemini Watchdog API] Failed to track checkout', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Track registration step (called by auth routes)
 */
router.post('/track-registration', async (req, res) => {
  try {
    const { sessionId, step, email, failureReason } = req.body;

    if (!sessionId || !step) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: sessionId, step'
      });
    }

    await GeminiWatchdogService.trackRegistration({
      sessionId,
      step,
      email,
      failureReason
    });

    res.json({ success: true, message: 'Registration tracked' });
  } catch (error: any) {
    logger.error('[Gemini Watchdog API] Failed to track registration', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Resolve an issue manually
 */
router.patch('/issues/:id/resolve', async (req, res) => {
  try {
    const { id } = req.params;

    await db.update(watchdogIssues)
      .set({ 
        status: 'resolved', 
        resolvedAt: new Date() 
      })
      .where(eq(watchdogIssues.id, parseInt(id)));

    res.json({ success: true, message: 'Issue resolved' });
  } catch (error: any) {
    logger.error('[Gemini Watchdog API] Failed to resolve issue', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Mark user struggle as resolved
 */
router.patch('/struggles/:id/resolve', async (req, res) => {
  try {
    const { id } = req.params;

    await db.update(watchdogUserStruggles)
      .set({ 
        resolved: true, 
        resolvedAt: new Date() 
      })
      .where(eq(watchdogUserStruggles.id, parseInt(id)));

    res.json({ success: true, message: 'Struggle resolved' });
  } catch (error: any) {
    logger.error('[Gemini Watchdog API] Failed to resolve struggle', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
