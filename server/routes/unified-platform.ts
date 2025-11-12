/**
 * 🐙 Unified Platform API Routes
 * Central endpoints for cross-platform features
 */

import { Router } from 'express';
import { requireAuth } from '../customAuth';
import { apiGateway } from '../services/APIGateway';
import { eventBus } from '../services/EventBus';
import { unifiedWallet } from '../services/UnifiedWalletService';
import { messagingHub } from '../services/UnifiedMessagingHub';
import { analytics } from '../services/UnifiedAnalyticsService';
import { cdp } from '../services/CDPService';
import { programmatic } from '../services/ProgrammaticMarketingService';
import { logger } from '../lib/logger';

const router = Router();

// ==================== API GATEWAY ENDPOINTS ====================

/**
 * Get all registered platform services
 */
router.get('/services', (req, res) => {
  const services = apiGateway.getServices();
  res.json({ services });
});

/**
 * Get service health status
 */
router.get('/services/health', async (req, res) => {
  try {
    const health = await apiGateway.getServiceHealth();
    res.json({ health });
  } catch (error) {
    logger.error('[Unified Platform] Failed to get service health', { error });
    res.status(500).json({ error: 'Failed to get service health' });
  }
});

// ==================== WALLET ENDPOINTS ====================

/**
 * Get wallet balance
 */
router.get('/wallet/balance', requireAuth, async (req: any, res) => {
  try {
    const userId = req.user.uid;
    const balance = await unifiedWallet.getBalance(userId);
    res.json(balance);
  } catch (error) {
    logger.error('[Wallet API] Failed to get balance', { error });
    res.status(500).json({ error: 'Failed to get balance' });
  }
});

/**
 * Get wallet transactions
 */
router.get('/wallet/transactions', requireAuth, async (req: any, res) => {
  try {
    const userId = req.user.uid;
    const limit = parseInt(req.query.limit as string) || 50;
    const transactions = await unifiedWallet.getTransactions(userId, limit);
    res.json({ transactions });
  } catch (error) {
    logger.error('[Wallet API] Failed to get transactions', { error });
    res.status(500).json({ error: 'Failed to get transactions' });
  }
});

/**
 * Get platform spending breakdown
 */
router.get('/wallet/spending/by-platform', requireAuth, async (req: any, res) => {
  try {
    const userId = req.user.uid;
    const spending = await unifiedWallet.getPlatformSpending(userId);
    res.json({ spending });
  } catch (error) {
    logger.error('[Wallet API] Failed to get platform spending', { error });
    res.status(500).json({ error: 'Failed to get platform spending' });
  }
});

// ==================== MESSAGING ENDPOINTS ====================

/**
 * Get notification preferences
 */
router.get('/notifications/preferences', requireAuth, async (req: any, res) => {
  try {
    const userId = req.user.uid;
    const preferences = await messagingHub.getPreferences(userId);
    res.json(preferences);
  } catch (error) {
    logger.error('[Messaging API] Failed to get preferences', { error });
    res.status(500).json({ error: 'Failed to get preferences' });
  }
});

/**
 * Update notification preferences
 */
router.put('/notifications/preferences', requireAuth, async (req: any, res) => {
  try {
    const userId = req.user.uid;
    await messagingHub.updatePreferences(userId, req.body);
    res.json({ success: true });
  } catch (error) {
    logger.error('[Messaging API] Failed to update preferences', { error });
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

/**
 * Get notification history
 */
router.get('/notifications/history', requireAuth, async (req: any, res) => {
  try {
    const userId = req.user.uid;
    const limit = parseInt(req.query.limit as string) || 50;
    const history = await messagingHub.getHistory(userId, limit);
    res.json({ history });
  } catch (error) {
    logger.error('[Messaging API] Failed to get history', { error });
    res.status(500).json({ error: 'Failed to get history' });
  }
});

// ==================== ANALYTICS ENDPOINTS ====================

/**
 * Get cross-platform user activity
 */
router.get('/analytics/my-activity', requireAuth, async (req: any, res) => {
  try {
    const userId = req.user.uid;
    const activity = await analytics.getUserActivity(userId);
    res.json(activity);
  } catch (error) {
    logger.error('[Analytics API] Failed to get user activity', { error });
    res.status(500).json({ error: 'Failed to get user activity' });
  }
});

/**
 * Get revenue by platform (admin only)
 */
router.get('/analytics/revenue/by-platform', requireAuth, async (req: any, res) => {
  try {
    // TODO: Add admin check
    const startDate = new Date(req.query.startDate as string);
    const endDate = new Date(req.query.endDate as string);
    
    const breakdown = await analytics.getRevenueByPlatform(startDate, endDate);
    res.json({ breakdown });
  } catch (error) {
    logger.error('[Analytics API] Failed to get revenue breakdown', { error });
    res.status(500).json({ error: 'Failed to get revenue breakdown' });
  }
});

/**
 * Get platform health
 */
router.get('/analytics/health', async (req, res) => {
  try {
    const health = await analytics.getPlatformHealth();
    res.json({ health });
  } catch (error) {
    logger.error('[Analytics API] Failed to get platform health', { error });
    res.status(500).json({ error: 'Failed to get platform health' });
  }
});

/**
 * Get AI-powered insights (admin only)
 */
router.get('/analytics/insights', requireAuth, async (req: any, res) => {
  try {
    // TODO: Add admin check
    const timeframe = req.query.timeframe as 'day' | 'week' | 'month' || 'week';
    const insights = await analytics.generateInsights(timeframe);
    res.json({ insights });
  } catch (error) {
    logger.error('[Analytics API] Failed to generate insights', { error });
    res.status(500).json({ error: 'Failed to generate insights' });
  }
});

// ==================== EVENT BUS ENDPOINTS ====================

/**
 * Get recent events (admin only, for debugging)
 */
router.get('/events/recent', requireAuth, async (req: any, res) => {
  try {
    // TODO: Add admin check
    const limit = parseInt(req.query.limit as string) || 100;
    const events = eventBus.getHistory(limit);
    res.json({ events });
  } catch (error) {
    logger.error('[Events API] Failed to get recent events', { error });
    res.status(500).json({ error: 'Failed to get recent events' });
  }
});

/**
 * Get user events
 */
router.get('/events/my-events', requireAuth, async (req: any, res) => {
  try {
    const userId = req.user.uid;
    const limit = parseInt(req.query.limit as string) || 50;
    const events = eventBus.getUserEvents(userId, limit);
    res.json({ events });
  } catch (error) {
    logger.error('[Events API] Failed to get user events', { error });
    res.status(500).json({ error: 'Failed to get user events' });
  }
});

// ==================== CDP ENDPOINTS ====================

/**
 * Get unified customer 360 profile
 */
router.get('/cdp/profile', requireAuth, async (req: any, res) => {
  try {
    const userId = req.user.uid;
    const profile = await cdp.getCustomer360(userId);
    res.json(profile);
  } catch (error) {
    logger.error('[CDP API] Failed to get customer profile', { error });
    res.status(500).json({ error: 'Failed to get customer profile' });
  }
});

/**
 * Get customer journey
 */
router.get('/cdp/journey', requireAuth, async (req: any, res) => {
  try {
    const userId = req.user.uid;
    const limit = parseInt(req.query.limit as string) || 100;
    const journey = await cdp.getCustomerJourney(userId, limit);
    res.json({ journey });
  } catch (error) {
    logger.error('[CDP API] Failed to get customer journey', { error });
    res.status(500).json({ error: 'Failed to get customer journey' });
  }
});

/**
 * Track user activity
 */
router.post('/cdp/track', requireAuth, async (req: any, res) => {
  try {
    const userId = req.user.uid;
    await cdp.trackActivity({
      userId,
      platform: req.body.platform,
      action: req.body.action,
      resource: req.body.resource,
      resourceId: req.body.resourceId,
      metadata: req.body.metadata
    });
    res.json({ success: true });
  } catch (error) {
    logger.error('[CDP API] Failed to track activity', { error });
    res.status(500).json({ error: 'Failed to track activity' });
  }
});

/**
 * Refresh user profile (recalculate metrics)
 */
router.post('/cdp/refresh', requireAuth, async (req: any, res) => {
  try {
    const userId = req.user.uid;
    await cdp.refreshProfile(userId);
    res.json({ success: true });
  } catch (error) {
    logger.error('[CDP API] Failed to refresh profile', { error });
    res.status(500).json({ error: 'Failed to refresh profile' });
  }
});

// ==================== PROGRAMMATIC MARKETING ENDPOINTS ====================

/**
 * Get all marketing campaigns
 */
router.get('/marketing/campaigns', requireAuth, async (req: any, res) => {
  try {
    // TODO: Add admin check
    const campaigns = await programmatic.getAllCampaigns();
    res.json({ campaigns });
  } catch (error) {
    logger.error('[Marketing API] Failed to get campaigns', { error });
    res.status(500).json({ error: 'Failed to get campaigns' });
  }
});

/**
 * Create marketing campaign
 */
router.post('/marketing/campaigns', requireAuth, async (req: any, res) => {
  try {
    // TODO: Add admin check
    const campaign = await programmatic.createCampaign(req.body);
    res.json(campaign);
  } catch (error) {
    logger.error('[Marketing API] Failed to create campaign', { error });
    res.status(500).json({ error: 'Failed to create campaign' });
  }
});

/**
 * Launch campaign
 */
router.post('/marketing/campaigns/:id/launch', requireAuth, async (req: any, res) => {
  try {
    // TODO: Add admin check
    await programmatic.launchCampaign(req.params.id);
    res.json({ success: true });
  } catch (error) {
    logger.error('[Marketing API] Failed to launch campaign', { error });
    res.status(500).json({ error: 'Failed to launch campaign' });
  }
});

/**
 * Get campaign performance
 */
router.get('/marketing/campaigns/:id/performance', requireAuth, async (req: any, res) => {
  try {
    // TODO: Add admin check
    const performance = await programmatic.getCampaignPerformance(req.params.id);
    res.json(performance);
  } catch (error) {
    logger.error('[Marketing API] Failed to get campaign performance', { error });
    res.status(500).json({ error: 'Failed to get campaign performance' });
  }
});

/**
 * Add funds to wallet
 */
router.post('/wallet/add-funds', requireAuth, async (req: any, res) => {
  try {
    const userId = req.user.uid;
    const { amount, platform, description } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }
    
    const transaction = await unifiedWallet.addFunds(userId, amount, platform || 'system', description || 'Funds added');
    res.json(transaction);
  } catch (error) {
    logger.error('[Wallet API] Failed to add funds', { error });
    res.status(500).json({ error: 'Failed to add funds' });
  }
});

/**
 * Deduct funds from wallet
 */
router.post('/wallet/deduct-funds', requireAuth, async (req: any, res) => {
  try {
    const userId = req.user.uid;
    const { amount, platform, description, referenceId } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }
    
    const transaction = await unifiedWallet.deductFunds(userId, amount, platform || 'system', description || 'Funds deducted', referenceId);
    res.json(transaction);
  } catch (error: any) {
    logger.error('[Wallet API] Failed to deduct funds', { error });
    if (error.message === 'Insufficient balance') {
      res.status(400).json({ error: 'Insufficient balance' });
    } else {
      res.status(500).json({ error: 'Failed to deduct funds' });
    }
  }
});

/**
 * Get unread notification count
 */
router.get('/notifications/unread-count', requireAuth, async (req: any, res) => {
  try {
    const userId = req.user.uid;
    const count = await messagingHub.getUnreadCount(userId);
    res.json({ count });
  } catch (error) {
    logger.error('[Messaging API] Failed to get unread count', { error });
    res.status(500).json({ error: 'Failed to get unread count' });
  }
});

/**
 * Mark notification as read
 */
router.post('/notifications/:id/mark-read', requireAuth, async (req: any, res) => {
  try {
    await messagingHub.markAsRead(req.params.id);
    res.json({ success: true });
  } catch (error) {
    logger.error('[Messaging API] Failed to mark as read', { error });
    res.status(500).json({ error: 'Failed to mark as read' });
  }
});

export default router;
