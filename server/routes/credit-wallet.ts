import { Router } from 'express';
import { walletService } from '../services/WalletService';
import { logger } from '../lib/logger';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';

const router = Router();

// Rate limiters for redemption endpoints to prevent abuse
const redemptionRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 redemptions per 15 min per user
  message: { success: false, error: 'Too many redemption requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.headers['x-user-id'] as string || 'anonymous',
  validate: { xForwardedForHeader: false, ip: false },
});

const nayaxValidationRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 validations per minute per station
  message: { success: false, error: 'Rate limit exceeded for code validation' },
  keyGenerator: (req) => req.body?.stationId || 'default-station',
  validate: { xForwardedForHeader: false, ip: false },
});

const previewSchema = z.object({
  requestedAmountCents: z.number().min(0),
  platform: z.enum(['walker', 'sitter', 'pettrek', 'k9000', 'plush_lab']),
});

const createRedemptionSchema = z.object({
  platform: z.enum(['walker', 'sitter', 'pettrek', 'k9000', 'plush_lab']),
  requestedAmountCents: z.number().min(0),
  serviceType: z.string().optional(),
  bookingId: z.string().optional(),
  stationId: z.string().optional(),
  deviceInfo: z.record(z.any()).optional(),
});

const addCreditsSchema = z.object({
  creditType: z.enum(['egift', 'wash_package', 'loyalty_points', 'promo_credit', 'referral_credit']),
  amount: z.number().min(1),
  sourceType: z.string(),
  sourceId: z.string().optional(),
  description: z.string().optional(),
});

router.get('/summary', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const summary = await walletService.getWalletSummary(userId);
    res.json({ success: true, wallet: summary });
  } catch (error: any) {
    logger.error('[Credit Wallet] Summary error', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/preview', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const parsed = previewSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.message });
    }

    const { requestedAmountCents, platform } = parsed.data;
    const preview = await walletService.previewCredits(userId, requestedAmountCents, platform);
    
    res.json({ success: true, preview });
  } catch (error: any) {
    logger.error('[Credit Wallet] Preview error', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/redemptions', redemptionRateLimiter, async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const parsed = createRedemptionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.message });
    }

    const { platform, requestedAmountCents, serviceType, bookingId, stationId, deviceInfo } = parsed.data;
    
    const result = await walletService.createRedemptionSession(
      userId,
      platform,
      requestedAmountCents,
      serviceType,
      bookingId,
      stationId,
      deviceInfo
    );
    
    res.json({ success: true, redemption: result });
  } catch (error: any) {
    logger.error('[Credit Wallet] Create redemption error', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/redemptions/:sessionId/confirm', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const { sessionId } = req.params;
    const { paymentConfirmed, idempotencyKey } = req.body;
    
    const success = await walletService.confirmRedemption(sessionId, paymentConfirmed, idempotencyKey);
    
    res.json({ success, message: success ? 'Redemption confirmed' : 'Confirmation failed' });
  } catch (error: any) {
    logger.error('[Credit Wallet] Confirm redemption error', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/redemptions/:sessionId/refund', async (req, res) => {
  try {
    const adminId = req.headers['x-admin-id'] as string;
    const isInternalRequest = req.headers['x-internal-service'] === 'petwash-backend';
    
    if (!adminId && !isInternalRequest) {
      logger.warn('[Credit Wallet] Unauthorized refund attempt', { ip: req.ip });
      return res.status(403).json({ 
        success: false, 
        error: 'Admin authorization required for refunds' 
      });
    }

    const { sessionId } = req.params;
    const { reason } = req.body;
    
    if (!reason || typeof reason !== 'string') {
      return res.status(400).json({ success: false, error: 'Refund reason required' });
    }
    
    const success = await walletService.refundRedemption(sessionId, reason, adminId || 'internal-service');
    
    logger.info('[Credit Wallet] Refund processed', { sessionId, adminId, reason });
    res.json({ success, message: success ? 'Credits refunded successfully' : 'Refund failed' });
  } catch (error: any) {
    logger.error('[Credit Wallet] Refund error', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/redemptions/:sessionId/cancel', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const { sessionId } = req.params;
    
    const success = await walletService.cancelSession(sessionId);
    
    res.json({ success, message: success ? 'Session cancelled' : 'Cancel failed' });
  } catch (error: any) {
    logger.error('[Credit Wallet] Cancel session error', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/transactions', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const limit = parseInt(req.query.limit as string) || 50;
    const transactions = await walletService.getTransactionHistory(userId, limit);
    
    res.json({ success: true, transactions });
  } catch (error: any) {
    logger.error('[Credit Wallet] Transactions error', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/credits/add', async (req, res) => {
  try {
    // SECURITY: Only admin can add credits to wallets
    const adminId = req.headers['x-admin-id'] as string;
    const isInternalRequest = req.headers['x-internal-service'] === 'petwash-backend';
    
    if (!adminId && !isInternalRequest) {
      logger.warn('[Credit Wallet] Unauthorized credit add attempt', { 
        ip: req.ip, 
        body: req.body 
      });
      return res.status(403).json({ 
        success: false, 
        error: 'Admin authorization required to add credits' 
      });
    }

    const parsed = addCreditsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.message });
    }

    const { creditType, amount, sourceType, sourceId, description } = parsed.data;
    const targetUserId = req.body.userId;
    
    if (!targetUserId) {
      return res.status(400).json({ success: false, error: 'Target userId required' });
    }
    
    await walletService.addCredits(
      targetUserId,
      creditType,
      amount,
      sourceType,
      sourceId,
      description
    );
    
    logger.info('[Credit Wallet] Credits added by admin', { 
      adminId: adminId || 'internal-service',
      targetUserId,
      creditType,
      amount 
    });
    
    res.json({ success: true, message: 'Credits added successfully' });
  } catch (error: any) {
    logger.error('[Credit Wallet] Add credits error', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/nayax/validate-code', nayaxValidationRateLimiter, async (req, res) => {
  try {
    const stationApiKey = req.headers['x-station-key'] as string;
    if (!stationApiKey) {
      return res.status(401).json({ success: false, error: 'Station API key required' });
    }

    const { code, stationId } = req.body;
    if (!code || !stationId) {
      return res.status(400).json({ success: false, error: 'Code and stationId required' });
    }

    const session = await walletService.validateRedemptionCode(code, stationId);
    
    if (!session) {
      return res.status(404).json({ success: false, error: 'Invalid or expired code' });
    }

    res.json({ 
      success: true, 
      session: {
        sessionId: session.sessionId,
        platform: session.platform,
        totalCreditsAppliedCents: session.totalCreditsAppliedCents,
        cashDueCents: session.cashDueCents,
        washPackagesApplied: session.washPackagesApplied,
      }
    });
  } catch (error: any) {
    logger.error('[Credit Wallet] Nayax validate code error', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/nayax/acknowledge', async (req, res) => {
  try {
    const stationApiKey = req.headers['x-station-key'] as string;
    if (!stationApiKey) {
      return res.status(401).json({ success: false, error: 'Station API key required' });
    }

    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ success: false, error: 'Session ID required' });
    }

    const success = await walletService.acknowledgeHardwareRedemption(sessionId);
    
    if (!success) {
      return res.status(400).json({ success: false, error: 'Cannot acknowledge session' });
    }

    await walletService.confirmRedemption(sessionId, true);

    res.json({ success: true, message: 'Redemption acknowledged and completed' });
  } catch (error: any) {
    logger.error('[Credit Wallet] Nayax acknowledge error', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
