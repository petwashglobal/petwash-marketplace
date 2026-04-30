import { Router } from 'express';
import { walletService } from '../services/WalletService';
import { logger } from '../lib/logger';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { db } from '../db';
import { creditTransactions, walletAccounts, unifiedVouchers, unifiedVoucherLedger } from '@shared/schema';
import { eq, or, inArray, and, desc, sql } from 'drizzle-orm';
import { isSuperAdmin } from '../middleware/rbac';

const router = Router();

// Rate limiters for redemption endpoints to prevent abuse
const redemptionRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 redemptions per 15 min per user
  message: { success: false, error: 'Too many redemption requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req as any).user?.uid || (req as any).firebaseUser?.uid || 'anonymous',
  validate: { xForwardedForHeader: false, ip: false, default: false },
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
  platform: z.enum(['walker', 'sitter', 'pettrek', 'k9000', 'plush_lab', 'academy']),
});

const createRedemptionSchema = z.object({
  platform: z.enum(['walker', 'sitter', 'pettrek', 'k9000', 'plush_lab', 'academy']),
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

const topupRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // max 5 top-ups per hour per user
  message: { success: false, error: 'Too many top-up requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req as any).user?.uid || (req as any).firebaseUser?.uid || 'anonymous',
  validate: { xForwardedForHeader: false, ip: false, default: false },
});

const topupSchema = z.object({
  amountCents: z.number().int().min(100).max(100000),
  nayaxTxId: z.string().optional(),
  description: z.string().optional(),
});

router.post('/topup', topupRateLimiter, async (req, res) => {
  try {
    const userId = req.user?.uid || req.firebaseUser?.uid;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const parsed = topupSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.message });
    }

    const { amountCents, nayaxTxId, description } = parsed.data;

    // SECURITY: Admin status derived ONLY from the server-side Firebase-verified email.
    // The x-admin-id header was removed — clients can set arbitrary headers, making it
    // trivially exploitable for unlimited self-crediting.
    const userEmail = (req.firebaseUser as any)?.email || (req.user as any)?.email || '';
    const isAdminUser = isSuperAdmin(userEmail);

    if (!nayaxTxId && !isAdminUser) {
      return res.status(403).json({ success: false, error: 'Top-up requires Nayax transaction ID' });
    }

    if (isAdminUser && !nayaxTxId) {
      logger.warn('[Credit Wallet] Super-admin manual top-up (no Nayax txId)', {
        adminEmail: userEmail,
        userId,
        amountCents,
      });
    }

    await walletService.addCredits(
      userId,
      'egift',
      amountCents,
      'nayax_topup',
      nayaxTxId,
      description || 'Wallet top-up via Nayax'
    );

    const walletSummary = await walletService.getWalletSummary(userId);

    logger.info('[Credit Wallet] Top-up processed', { userId, amountCents, nayaxTxId });
    res.json({ success: true, amountCents, walletSummary });
  } catch (error: any) {
    logger.error('[Credit Wallet] Top-up error', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/activity', async (req, res) => {
  try {
    const userId = req.user?.uid || req.firebaseUser?.uid;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 30, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    // Get user's wallet
    const [wallet] = await db.select({ walletId: walletAccounts.walletId })
      .from(walletAccounts)
      .where(eq(walletAccounts.userId, userId))
      .limit(1);

    // Get user's unified voucher IDs
    const userVouchers = await db.select({ id: unifiedVouchers.id })
      .from(unifiedVouchers)
      .where(
        or(
          eq(unifiedVouchers.ownerUserId, userId),
          eq(unifiedVouchers.purchasedByUserId, userId)
        )
      );

    const voucherIds = userVouchers.map(v => v.id);

    // Fetch wallet credit transactions
    const walletActivities: any[] = [];
    if (wallet) {
      const txns = await db.select()
        .from(creditTransactions)
        .where(eq(creditTransactions.walletId, wallet.walletId))
        .orderBy(desc(creditTransactions.createdAt));

      for (const txn of txns) {
        walletActivities.push({
          id: txn.transactionId,
          type: 'wallet_credit',
          event: txn.transactionType,
          description: txn.description || txn.transactionType,
          amountCents: txn.amountCents ?? null,
          amountWashes: txn.amountUnits ?? null,
          channel: txn.platform || null,
          platform: txn.platform || null,
          createdAt: txn.createdAt,
          referenceId: txn.sourceId || txn.redemptionSessionId || null,
        });
      }
    }

    // Fetch unified voucher ledger entries
    const ledgerActivities: any[] = [];
    if (voucherIds.length > 0) {
      const ledgerEntries = await db.select({
        id: unifiedVoucherLedger.id,
        voucherId: unifiedVoucherLedger.voucherId,
        event: unifiedVoucherLedger.event,
        deltaValue: unifiedVoucherLedger.deltaValue,
        deltaWashes: unifiedVoucherLedger.deltaWashes,
        channel: unifiedVoucherLedger.channel,
        notes: unifiedVoucherLedger.notes,
        externalRef: unifiedVoucherLedger.externalRef,
        createdAt: unifiedVoucherLedger.createdAt,
      })
        .from(unifiedVoucherLedger)
        .where(inArray(unifiedVoucherLedger.voucherId, voucherIds))
        .orderBy(desc(unifiedVoucherLedger.createdAt));

      for (const entry of ledgerEntries) {
        const deltaValueCents = entry.deltaValue
          ? Math.round(parseFloat(entry.deltaValue as string) * 100)
          : null;
        ledgerActivities.push({
          id: entry.id,
          type: 'voucher_ledger',
          event: entry.event,
          description: entry.notes || `Voucher ${entry.event} (${entry.voucherId})`,
          amountCents: deltaValueCents !== 0 ? deltaValueCents : null,
          amountWashes: entry.deltaWashes !== 0 ? entry.deltaWashes : null,
          channel: entry.channel || null,
          platform: entry.channel || null,
          createdAt: entry.createdAt,
          referenceId: entry.externalRef || entry.voucherId,
        });
      }
    }

    // Merge and sort all activities by createdAt DESC
    const combined = [...walletActivities, ...ledgerActivities].sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });

    const total = combined.length;
    const activities = combined.slice(offset, offset + limit);

    res.json({ success: true, activities, total });
  } catch (error: any) {
    logger.error('[Credit Wallet] Activity error', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/summary', async (req, res) => {
  try {
    const userId = req.user?.uid || req.firebaseUser?.uid;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const summary = await walletService.getWalletSummary(userId);

    // Fetch unified voucher aggregates
    const activeStatuses = ['ISSUED', 'ACTIVE', 'PARTIALLY_REDEEMED'];
    const userActiveVouchers = await db.select({
      voucherType: unifiedVouchers.voucherType,
      valueRemaining: unifiedVouchers.valueRemaining,
      washesRemaining: unifiedVouchers.washesRemaining,
      status: unifiedVouchers.status,
    })
      .from(unifiedVouchers)
      .where(
        and(
          or(
            eq(unifiedVouchers.ownerUserId, userId),
            eq(unifiedVouchers.purchasedByUserId, userId)
          ),
          inArray(unifiedVouchers.status, activeStatuses)
        )
      );

    let totalPlatformCreditRemainingCents = 0;
    let totalWashPackagesRemaining = 0;
    const activeVoucherCount = userActiveVouchers.length;

    for (const v of userActiveVouchers) {
      if (v.voucherType === 'PLATFORM_CREDIT' && v.valueRemaining) {
        totalPlatformCreditRemainingCents += Math.round(parseFloat(v.valueRemaining as string) * 100);
      } else if (v.voucherType === 'WASH_PACKAGE' && v.washesRemaining) {
        totalWashPackagesRemaining += v.washesRemaining;
      }
    }

    res.json({
      success: true,
      wallet: {
        ...summary,
        unifiedVouchers: {
          totalPlatformCreditRemainingCents,
          totalWashPackagesRemaining,
          activeVoucherCount,
        },
      },
    });
  } catch (error: any) {
    logger.error('[Credit Wallet] Summary error', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/preview', async (req, res) => {
  try {
    const userId = req.user?.uid || req.firebaseUser?.uid;
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
    const userId = req.user?.uid || req.firebaseUser?.uid;
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
    const userId = req.user?.uid || req.firebaseUser?.uid;
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
    const adminEmail = (req.firebaseUser as any)?.email || (req.user as any)?.email || '';

    if (!isSuperAdmin(adminEmail)) {
      logger.warn('[Credit Wallet] Unauthorized refund attempt', { ip: req.ip, email: adminEmail });
      return res.status(403).json({ 
        success: false, 
        error: 'Admin authorization required for refunds' 
      });
    }
    const adminId = adminEmail;

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
    const userId = req.user?.uid || req.firebaseUser?.uid;
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

router.get('/redemptions/:sessionId/status', async (req, res) => {
  try {
    const userId = req.user?.uid || req.firebaseUser?.uid;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const { sessionId } = req.params;
    const { db } = await import('../db');
    const { redemptionSessions } = await import('@shared/schema');
    const { eq, and } = await import('drizzle-orm');

    const [session] = await db
      .select()
      .from(redemptionSessions)
      .where(and(
        eq(redemptionSessions.sessionId, sessionId),
        eq(redemptionSessions.userId, userId)
      ));

    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    res.json({ success: true, status: session.status, session });
  } catch (error: any) {
    logger.error('[Credit Wallet] Get session status error', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/transactions', async (req, res) => {
  try {
    const userId = req.user?.uid || req.firebaseUser?.uid;
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
    // SECURITY: Only super admins (verified server-side via Firebase email) can add credits.
    const adminEmail = (req.firebaseUser as any)?.email || (req.user as any)?.email || '';

    if (!isSuperAdmin(adminEmail)) {
      logger.warn('[Credit Wallet] Unauthorized credit add attempt', { ip: req.ip, email: adminEmail });
      return res.status(403).json({ 
        success: false, 
        error: 'Admin authorization required to add credits' 
      });
    }
    const adminId = adminEmail;

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

const adminInjectSchema = z.object({
  targetUserId: z.string().min(1),
  creditType: z.enum(['egift', 'wash_package', 'loyalty_points', 'promo_credit', 'referral_credit']),
  amount: z.number().min(1),
  reason: z.string().min(10),
  expiresAt: z.string().datetime().optional(),
  ticketId: z.string().optional(),
  approvalReference: z.string().optional(),
});

router.post('/admin/inject', async (req, res) => {
  try {
    // SECURITY: Admin identity derived from server-verified Firebase token only.
    // All x-admin-* headers were removed — they are client-controllable and exploitable.
    const adminEmail = (req.firebaseUser as any)?.email || (req.user as any)?.email || '';
    const adminUserId = (req.firebaseUser as any)?.uid || (req.user as any)?.uid || '';

    if (!adminEmail || !adminUserId) {
      return res.status(401).json({ success: false, error: 'Admin authentication required' });
    }

    if (!isSuperAdmin(adminEmail)) {
      logger.warn('[Credit Wallet] Unauthorized admin injection attempt', { adminUserId, adminEmail, ip: req.ip });
      return res.status(403).json({ success: false, error: 'Insufficient permissions for credit injection' });
    }

    const parsed = adminInjectSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.message });
    }

    const { targetUserId, creditType, amount, reason, expiresAt, ticketId, approvalReference } = parsed.data;

    const result = await walletService.adminInjectCredits({
      adminUserId,
      adminEmail,
      targetUserId,
      creditType,
      amount,
      reason,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      ticketId,
      approvalReference,
      ipAddress: req.ip || req.headers['x-forwarded-for'] as string,
      userAgent: req.headers['user-agent'],
    });

    res.json({ 
      success: true, 
      message: 'Credits injected successfully',
      transactionId: result.transactionId,
      auditId: result.auditId,
    });
  } catch (error: any) {
    logger.error('[Credit Wallet] Admin inject error', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/admin/injection-history/:userId', async (req, res) => {
  try {
    const adminEmail = (req.firebaseUser as any)?.email || (req.user as any)?.email || '';
    if (!adminEmail) {
      return res.status(401).json({ success: false, error: 'Admin authentication required' });
    }
    if (!isSuperAdmin(adminEmail)) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    const { userId } = req.params;
    const history = await walletService.getAdminInjectionHistory(userId);

    res.json({ success: true, injections: history });
  } catch (error: any) {
    logger.error('[Credit Wallet] Admin injection history error', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/expiring-credits', async (req, res) => {
  try {
    const userId = req.user?.uid || req.firebaseUser?.uid;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const daysAhead = parseInt(req.query.days as string) || 30;
    const result = await walletService.getExpiringCredits(userId, daysAhead);

    res.json({ 
      success: true, 
      expiringCredits: result.expiringCredits,
      totalExpiringCents: result.totalExpiringCents,
      daysAhead
    });
  } catch (error: any) {
    logger.error('[Credit Wallet] Get expiring credits error', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/admin/process-expired-credits', async (req, res) => {
  try {
    const cronSecret = (req.headers['x-cron-secret'] as string) || '';
    const expectedCronSecret = process.env.CRON_SECRET || '';
    const adminEmail = (req.firebaseUser as any)?.email || (req.user as any)?.email || '';

    const { timingSafeEqual } = await import('crypto');
    const validCronSecret =
      expectedCronSecret.length > 0 &&
      cronSecret.length === expectedCronSecret.length &&
      timingSafeEqual(Buffer.from(cronSecret), Buffer.from(expectedCronSecret));
    if (!validCronSecret && !isSuperAdmin(adminEmail)) {
      logger.warn('[Credit Wallet] Unauthorized expired-credits trigger', { ip: req.ip, email: adminEmail });
      return res.status(403).json({ success: false, error: 'Unauthorized' });
    }

    const result = await walletService.processExpiredCredits();

    logger.info('[Credit Wallet] Expired credits processed', { 
      triggeredBy: isSuperAdmin(adminEmail) ? adminEmail : 'cron',
      ...result 
    });

    res.json({ 
      success: true, 
      message: `Processed ${result.processed} expired credit entries`,
      ...result
    });
  } catch (error: any) {
    logger.error('[Credit Wallet] Process expired credits error', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/admin/dormant-wallets', async (req, res) => {
  try {
    const adminEmail = (req.firebaseUser as any)?.email || (req.user as any)?.email || '';
    if (!adminEmail) {
      return res.status(401).json({ success: false, error: 'Admin authentication required' });
    }
    if (!isSuperAdmin(adminEmail)) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    const result = await walletService.checkDormantWallets();

    res.json({ 
      success: true, 
      ...result
    });
  } catch (error: any) {
    logger.error('[Credit Wallet] Dormant wallets check error', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
