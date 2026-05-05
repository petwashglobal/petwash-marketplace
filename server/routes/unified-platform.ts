/**
 * 🐙 Unified Platform API Routes
 * Central endpoints for cross-platform features
 */

import { Router } from 'express';
import { requireAuth } from '../customAuth';
import { requireActive } from '../middleware/requireActive';
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
    logger.error('[Unified Platform] Failed to get service health', error);
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
    logger.error('[Wallet API] Failed to get balance', error);
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
    logger.error('[Wallet API] Failed to get transactions', error);
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
    logger.error('[Wallet API] Failed to get platform spending', error);
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
    logger.error('[Messaging API] Failed to get preferences', error);
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
    logger.error('[Messaging API] Failed to update preferences', error);
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
    logger.error('[Messaging API] Failed to get history', error);
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
    logger.error('[Analytics API] Failed to get user activity', error);
    res.status(500).json({ error: 'Failed to get user activity' });
  }
});

/**
 * Get revenue by platform (admin only)
 */
router.get('/analytics/revenue/by-platform', requireAuth, async (req: any, res) => {
  try {
    // ✅ SECURITY: Admin-only endpoint
    const { checkUserIsAdmin } = await import('../lib/adminCheck');
    if (!await checkUserIsAdmin(req.user.uid)) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const startDate = new Date(req.query.startDate as string);
    const endDate = new Date(req.query.endDate as string);
    
    const breakdown = await analytics.getRevenueByPlatform(startDate, endDate);
    res.json({ breakdown });
  } catch (error) {
    logger.error('[Analytics API] Failed to get revenue breakdown', error);
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
    logger.error('[Analytics API] Failed to get platform health', error);
    res.status(500).json({ error: 'Failed to get platform health' });
  }
});

/**
 * Get AI-powered insights (admin only)
 */
router.get('/analytics/insights', requireAuth, async (req: any, res) => {
  try {
    // ✅ SECURITY: Admin-only endpoint
    const { checkUserIsAdmin } = await import('../lib/adminCheck');
    if (!await checkUserIsAdmin(req.user.uid)) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const timeframe = req.query.timeframe as 'day' | 'week' | 'month' || 'week';
    const insights = await analytics.generateInsights(timeframe);
    res.json({ insights });
  } catch (error) {
    logger.error('[Analytics API] Failed to generate insights', error);
    res.status(500).json({ error: 'Failed to generate insights' });
  }
});

// ==================== EVENT BUS ENDPOINTS ====================

/**
 * Get recent events (admin only, for debugging)
 */
router.get('/events/recent', requireAuth, async (req: any, res) => {
  try {
    // ✅ SECURITY: Admin-only endpoint
    const { checkUserIsAdmin } = await import('../lib/adminCheck');
    if (!await checkUserIsAdmin(req.user.uid)) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const limit = parseInt(req.query.limit as string) || 100;
    const events = eventBus.getHistory(limit);
    res.json({ events });
  } catch (error) {
    logger.error('[Events API] Failed to get recent events', error);
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
    logger.error('[Events API] Failed to get user events', error);
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
    logger.error('[CDP API] Failed to get customer profile', error);
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
    logger.error('[CDP API] Failed to get customer journey', error);
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
    logger.error('[CDP API] Failed to track activity', error);
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
    logger.error('[CDP API] Failed to refresh profile', error);
    res.status(500).json({ error: 'Failed to refresh profile' });
  }
});

// ==================== PROGRAMMATIC MARKETING ENDPOINTS ====================

/**
 * Get all marketing campaigns
 */
router.get('/marketing/campaigns', requireAuth, async (req: any, res) => {
  try {
    // ✅ SECURITY: Admin-only endpoint
    const { checkUserIsAdmin } = await import('../lib/adminCheck');
    if (!await checkUserIsAdmin(req.user.uid)) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const campaigns = await programmatic.getAllCampaigns();
    res.json({ campaigns });
  } catch (error) {
    logger.error('[Marketing API] Failed to get campaigns', error);
    res.status(500).json({ error: 'Failed to get campaigns' });
  }
});

/**
 * Create marketing campaign
 */
router.post('/marketing/campaigns', requireAuth, async (req: any, res) => {
  try {
    // ✅ SECURITY: Admin-only endpoint
    const { checkUserIsAdmin } = await import('../lib/adminCheck');
    if (!await checkUserIsAdmin(req.user.uid)) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const campaign = await programmatic.createCampaign(req.body);
    res.json(campaign);
  } catch (error) {
    logger.error('[Marketing API] Failed to create campaign', error);
    res.status(500).json({ error: 'Failed to create campaign' });
  }
});

/**
 * Launch campaign
 */
router.post('/marketing/campaigns/:id/launch', requireAuth, async (req: any, res) => {
  try {
    // ✅ SECURITY: Admin-only endpoint
    const { checkUserIsAdmin } = await import('../lib/adminCheck');
    if (!await checkUserIsAdmin(req.user.uid)) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    await programmatic.launchCampaign(req.params.id);
    res.json({ success: true });
  } catch (error) {
    logger.error('[Marketing API] Failed to launch campaign', error);
    res.status(500).json({ error: 'Failed to launch campaign' });
  }
});

/**
 * Get campaign performance
 */
router.get('/marketing/campaigns/:id/performance', requireAuth, async (req: any, res) => {
  try {
    // ✅ SECURITY: Admin-only endpoint
    const { checkUserIsAdmin } = await import('../lib/adminCheck');
    if (!await checkUserIsAdmin(req.user.uid)) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const performance = await programmatic.getCampaignPerformance(req.params.id);
    res.json(performance);
  } catch (error) {
    logger.error('[Marketing API] Failed to get campaign performance', error);
    res.status(500).json({ error: 'Failed to get campaign performance' });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// PR-W47 — DISABLED 2026-05  (financial safety / no live caller)
//
// Both /wallet/add-funds and /wallet/deduct-funds were defined here but
// never wired from any client (grep over client/ + server/ returned zero
// callers). They allowed an authenticated user to:
//   • credit themselves arbitrary promo balance (add-funds — no payment proof)
//   • debit their wallet with no booking-id, no idempotency, no ledger row
//     (deduct-funds — UnifiedWalletService.deductFunds writes wallet but NOT
//      credit_transactions, so the drift detector would WARN every call)
//
// Both routes now return 410 GONE with a forensic message. The
// UnifiedWalletService class itself is left intact (no breaking imports);
// it remains usable internally when callers wire it through
// walletService.addCredits + walletIdempotencyKeys.
//
// If a legitimate use-case emerges, the replacement endpoint must:
//   1. specify an explicit source (booking, voucher activation, etc.)
//   2. write a credit_transactions row via walletService / WalletLedger
//   3. require an Idempotency-Key header (PR-W4 pattern)
//   4. emit an audit_events row when admin-initiated
//   5. ship with idempotency-replay tests
// ─────────────────────────────────────────────────────────────────────────

router.post('/wallet/add-funds', requireAuth, requireActive, async (_req, res) => {
  return res.status(410).json({
    error: 'GONE',
    code: 'UNIFIED_WALLET_ADD_FUNDS_DISABLED',
    message:
      'This endpoint has been disabled. Wallet credits must come from a verified payment source. ' +
      'Use POST /api/credit-wallet/topup with a Nayax transaction ID.',
    messageHe:
      'הנקודה הזו הושבתה. זיכויי ארנק חייבים להגיע ממקור תשלום מאומת. ' +
      'השתמש ב-POST /api/credit-wallet/topup עם מזהה עסקת Nayax.',
  });
});

router.post('/wallet/deduct-funds', requireAuth, requireActive, async (_req, res) => {
  return res.status(410).json({
    error: 'GONE',
    code: 'UNIFIED_WALLET_DEDUCT_FUNDS_DISABLED',
    message:
      'This endpoint has been disabled. Wallet debits must reference a booking, ' +
      'voucher, or kiosk redemption. Use the booking checkout or K9000 redeem path.',
    messageHe:
      'הנקודה הזו הושבתה. חיובי ארנק חייבים להפנות להזמנה, שובר או מימוש קיוסק.',
  });
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
    logger.error('[Messaging API] Failed to get unread count', error);
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
    logger.error('[Messaging API] Failed to mark as read', error);
    res.status(500).json({ error: 'Failed to mark as read' });
  }
});

export default router;
