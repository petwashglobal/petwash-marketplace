import { Router } from 'express';
import { walletService } from '../services/WalletService';
import { logger } from '../lib/logger';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { redisRateLimitStore } from '../middleware/rateLimiterRedisStore';
import { db } from '../db';
import { creditTransactions, walletAccounts, unifiedVouchers, unifiedVoucherLedger, walletIdempotencyKeys } from '@shared/schema';
import { eq, or, inArray, and, desc, sql } from 'drizzle-orm';
import { isSuperAdminVerified } from '../middleware/rbac';
import { requireNayaxStationDevice } from '../middleware/nayaxStationDeviceAuth';
// Modernity SEV-1 #1 (2026-08-20 audit): wrap every money-mutating POST in
// the canonical audit middleware so admin dashboards can filter on
// action_type. Read-only GETs remain untouched.
import { auditMiddleware as auditLogMiddleware } from '../middleware/auditLog';
import { deriveTopupIdempotencyKey } from '../lib/topup-idempotency';
import { deriveAdminCreditIdempotencyKey } from '../lib/admin-credit-idempotency';
import { verifyNayaxTopup, type WalletTopupVerifyReason } from '../lib/wallet-topup-verify';
import { assertOperatingControl } from '../lib/petwashOperatingControlGateway';
import type { CreditType } from '../../shared/petwash-operating-system';

const router = Router();

// Release-blocker A6 + B3 (CEO 2026-09-02): every money-touching limiter
// in this file now uses the Redis-backed store so the cap is enforced
// across the whole Cloud Run fleet instead of per-pod (which multiplied
// the permitted rate by the pod count).
const redemptionRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 redemptions per 15 min per user
  message: { success: false, error: 'Too many redemption requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req as any).user?.uid || (req as any).firebaseUser?.uid || 'anonymous',
  validate: { xForwardedForHeader: false, ip: false, default: false },
  store: redisRateLimitStore('wallet_redemption'),
});

const nayaxValidationRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 validations per minute per station
  message: { success: false, error: 'Rate limit exceeded for code validation' },
  keyGenerator: (req) => req.body?.stationId || 'default-station',
  validate: { xForwardedForHeader: false, ip: false },
  store: redisRateLimitStore('wallet_nayax_validate'),
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

function mapWalletCreditType(creditType: z.infer<typeof addCreditsSchema>['creditType']): CreditType {
  if (creditType === 'egift') return 'E_GIFT_CARD';
  if (creditType === 'wash_package') return 'STORE_CREDIT';
  if (creditType === 'loyalty_points') return 'LOYALTY_CREDIT';
  return 'PROMOTIONAL_CREDIT';
}

function sourceLooksPaid(sourceType: string): boolean {
  return /payment|receipt|sumit|nayax|paid/i.test(sourceType);
}

// Release-blocker A6 (CEO 2026-09-02): wallet top-up limiter MUST use
// the shared Redis store — the previous in-memory default scaled with
// pod count, so N pods = 5N top-ups/hour per user.
const topupRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // max 5 top-ups per hour per user (across all pods)
  message: { success: false, error: 'Too many top-up requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req as any).user?.uid || (req as any).firebaseUser?.uid || 'anonymous',
  validate: { xForwardedForHeader: false, ip: false, default: false },
  store: redisRateLimitStore('wallet_topup'),
});

const topupSchema = z.object({
  amountCents: z.number().int().min(100).max(100000),
  nayaxTxId: z.string().optional(),
  description: z.string().optional(),
});

router.post('/topup', topupRateLimiter, auditLogMiddleware('WALLET_TOPUP'), async (req, res) => {
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

    // #240 migration: allowlist + email_verified. The x-admin-id header
    // path is dead; admin status derives from the Firebase-verified email.
    const userEmail = (req.firebaseUser as any)?.email || (req.user as any)?.email || '';
    const isAdminUser = isSuperAdminVerified(req as any);

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

    // ── PR-J: Nayax verification (forensic audit F-05) ─────────────────────
    // Reject any non-admin top-up whose (nayaxTxId, amountCents, userId)
    // tuple does not match the locally-recorded nayaxTransactions row.
    // Runs BEFORE the idempotency lock so we don't burn an idempotency
    // row on a rejected txn. Admin manual top-ups (no nayaxTxId) skip
    // verification — that path is logged + audited above.
    if (!isAdminUser && nayaxTxId) {
      const verify = await verifyNayaxTopup({ userId, nayaxTxId, claimedAmountCents: amountCents });
      if (!verify.ok) {
        const reason: WalletTopupVerifyReason = verify.reason;
        logger.warn('[Credit Wallet] Top-up verification rejected', {
          userId, nayaxTxId, amountCents, reason,
        });
        return res.status(402).json({
          success: false,
          error: 'Top-up could not be verified against the Nayax transaction record.',
          errorCode: 'PAYMENT_NOT_VERIFIED',
          reason,
        });
      }
    }

    // ── PR-W4: idempotency guard ─────────────────────────────────────────────
    // Two POSTs with the same nayaxTxId must NOT result in two credits.
    // We try-insert the idempotency row BEFORE crediting:
    //   • If the insert succeeds we have an exclusive lock; do the credit;
    //     then update the row with the response so future identical
    //     requests return the cached payload.
    //   • If the insert hits the unique constraint, look up the existing
    //     row. If it has a cached response → return it (idempotent hit).
    //     If status='pending' → first request is still in flight; return
    //     409 so the client backs off.
    //   • On error during the credit, delete our idempotency row so the
    //     client can retry cleanly. Best-effort delete; if it fails, the
    //     30-day expiry sweeps the row eventually.
    const idemKey = deriveTopupIdempotencyKey(
      nayaxTxId,
      typeof req.headers['idempotency-key'] === 'string'
        ? (req.headers['idempotency-key'] as string)
        : undefined,
    );
    let idemRowOwned = false;

    if (idemKey) {
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const inserted = await db
        .insert(walletIdempotencyKeys)
        .values({
          idempotencyKey: idemKey,
          endpoint: '/topup',
          status: 'pending',
          expiresAt,
        })
        .onConflictDoNothing()
        .returning({ id: walletIdempotencyKeys.id });

      if (inserted.length === 0) {
        const [existing] = await db
          .select()
          .from(walletIdempotencyKeys)
          .where(eq(walletIdempotencyKeys.idempotencyKey, idemKey))
          .limit(1);
        if (existing?.responseJson) {
          logger.info('[Credit Wallet] Idempotent topup hit — returning cached', {
            userId, idemKey,
          });
          try {
            return res.json(JSON.parse(existing.responseJson));
          } catch {
            // Bad cached JSON — fall through to a clean error.
          }
        }
        logger.warn('[Credit Wallet] Topup race — first request still in flight', {
          userId, idemKey, existingStatus: existing?.status,
        });
        return res.status(409).json({
          success: false,
          error: 'Top-up with this transaction id is already being processed.',
          errorCode: 'IDEMPOTENCY_IN_FLIGHT',
        });
      }
      idemRowOwned = true;
    }

    let response: { success: true; amountCents: number; walletSummary: unknown };
    try {
      await walletService.addCredits(
        userId,
        'egift',
        amountCents,
        'nayax_topup',
        nayaxTxId,
        description || 'Wallet top-up via Nayax'
      );

      const walletSummary = await walletService.getWalletSummary(userId);
      response = { success: true, amountCents, walletSummary };
    } catch (creditErr) {
      // Roll back the idempotency lock so the client can retry cleanly.
      if (idemRowOwned && idemKey) {
        try {
          await db
            .delete(walletIdempotencyKeys)
            .where(eq(walletIdempotencyKeys.idempotencyKey, idemKey));
        } catch (delErr) {
          logger.warn('[Credit Wallet] Failed to roll back idempotency row on error', {
            userId, idemKey, error: String(delErr),
          });
        }
      }
      throw creditErr;
    }

    if (idemRowOwned && idemKey) {
      try {
        await db
          .update(walletIdempotencyKeys)
          .set({ responseJson: JSON.stringify(response), status: 'success' })
          .where(eq(walletIdempotencyKeys.idempotencyKey, idemKey));
      } catch (updateErr) {
        // Non-fatal — the response is sent; future retries will fall through
        // to the in-flight branch and 409 until the 30-day expiry sweeps.
        logger.warn('[Credit Wallet] Failed to record idempotency response (non-blocking)', {
          userId, idemKey, error: String(updateErr),
        });
      }
    }

    logger.info('[Credit Wallet] Top-up processed', { userId, amountCents, nayaxTxId });

    // SHADOW dual-write to canonical `legal_acceptances` (Lane D §D9).
    // A successful wallet top-up implies the customer just re-agreed to
    // the wallet/eGift terms on the top-up screen; today the acceptance
    // is only implicit. This shadow write records the acceptance in the
    // canonical ledger so wallet_egift_terms migrates from LEGACY-ONLY
    // → DUAL-WRITE-SHADOW without a cutover. Best-effort: MUST NOT
    // fail the customer-facing top-up (the money already landed). The
    // recordLegalAcceptance service traps its own DB errors and emits
    // the LEGAL_ACCEPTANCE_SHADOW_MISSING signal + AlertEngine card.
    void (async () => {
      try {
        const { recordLegalAcceptance } = await import('../services/LegalAcceptanceService');
        const { getLegalDocument } = await import('@shared/lib/legalDocumentRegistry');
        const doc = getLegalDocument('wallet_egift_terms');
        if (!doc) return;
        const r = await recordLegalAcceptance({
          userId,
          documentKey: 'wallet_egift_terms',
          docVersion: doc.currentVersion,
          language: 'he',
          ipAddress: req.ip || (req.socket as any)?.remoteAddress || null,
          userAgent: req.get('user-agent') || null,
          source: 'client',
          actorRole: 'self',
          metadata: {
            origin: '/api/credit-wallet/topup',
            amountCents,
            nayaxTxId: nayaxTxId ?? null,
            isAdmin: isAdminUser,
          },
        });
        if (!r.ok) {
          logger.warn('[Credit Wallet] wallet_egift_terms shadow write failed — legacy authority stands', {
            userId, errorCode: r.errorCode,
          });
        }
      } catch (shadowErr: any) {
        logger.warn('[Credit Wallet] wallet_egift_terms shadow write threw — legacy authority stands', {
          userId, errorMessage: shadowErr?.message ?? String(shadowErr),
        });
      }
    })();

    res.json(response);
  } catch (error: any) {
    logger.error('[Credit Wallet] Top-up error', { error: error.message });
    res.status(500).json({ success: false, error: 'Wallet operation failed', code: 'WALLET_500' });
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
    res.status(500).json({ success: false, error: 'Wallet operation failed', code: 'WALLET_500' });
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
    res.status(500).json({ success: false, error: 'Wallet operation failed', code: 'WALLET_500' });
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
    res.status(500).json({ success: false, error: 'Wallet operation failed', code: 'WALLET_500' });
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
    res.status(500).json({ success: false, error: 'Wallet operation failed', code: 'WALLET_500' });
  }
});

router.post('/redemptions/:sessionId/confirm', auditLogMiddleware('WALLET_BURN'), async (req, res) => {
  try {
    const userId = req.user?.uid || req.firebaseUser?.uid;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const { sessionId } = req.params;
    const { paymentConfirmed, idempotencyKey } = req.body;

    // Pass userId so a user can only confirm their OWN session (IDOR fix
    // 2026-07-05, cross-exam #3) — matches the /cancel route pattern.
    const success = await walletService.confirmRedemption(sessionId, paymentConfirmed, idempotencyKey, userId);
    
    res.json({ success, message: success ? 'Redemption confirmed' : 'Confirmation failed' });
  } catch (error: any) {
    logger.error('[Credit Wallet] Confirm redemption error', { error: error.message });
    res.status(500).json({ success: false, error: 'Wallet operation failed', code: 'WALLET_500' });
  }
});

router.post('/redemptions/:sessionId/refund', auditLogMiddleware('REFUND'), async (req, res) => {
  try {
    const adminEmail = (req.firebaseUser as any)?.email || (req.user as any)?.email || '';

    if (!isSuperAdminVerified(req as any)) {
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
    res.status(500).json({ success: false, error: 'Wallet operation failed', code: 'WALLET_500' });
  }
});

router.post('/redemptions/:sessionId/cancel', async (req, res) => {
  try {
    const userId = req.user?.uid || req.firebaseUser?.uid;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const { sessionId } = req.params;

    // Pass userId so a user can only cancel their OWN session (IDOR fix 2026-06-18).
    const success = await walletService.cancelSession(sessionId, userId);

    res.json({ success, message: success ? 'Session cancelled' : 'Cancel failed' });
  } catch (error: any) {
    logger.error('[Credit Wallet] Cancel session error', { error: error.message });
    res.status(500).json({ success: false, error: 'Wallet operation failed', code: 'WALLET_500' });
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
    res.status(500).json({ success: false, error: 'Wallet operation failed', code: 'WALLET_500' });
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
    res.status(500).json({ success: false, error: 'Wallet operation failed', code: 'WALLET_500' });
  }
});

router.post('/credits/add', auditLogMiddleware('CREDIT_WALLET_ADJUST'), async (req, res) => {
  try {
    // SECURITY: Only super admins (verified server-side via Firebase email) can add credits.
    const adminEmail = (req.firebaseUser as any)?.email || (req.user as any)?.email || '';
    const adminUserId = (req.firebaseUser as any)?.uid || (req.user as any)?.uid || '';

    if (!isSuperAdminVerified(req as any)) {
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

    if (!assertOperatingControl(req, res, {
      actionType: 'WALLET_CREDIT_CREATE',
      route: 'POST /api/credit-wallet/credits/add',
      targetId: `wallet:${targetUserId}`,
      creditType: mapWalletCreditType(creditType),
      paidOrFree: sourceLooksPaid(sourceType) ? 'paid' : 'free',
      facts: {
        manualStaffCredit: true,
        paymentReferenceExists: Boolean(sourceId && sourceLooksPaid(sourceType)),
        receiptReferenceExists: Boolean(sourceId && /receipt|sumit/i.test(sourceType)),
        refundCaseExists: Boolean(sourceId && /refund/i.test(sourceType)),
        sourceEvidenceExists: Boolean(sourceId),
      },
      money: {
        creditOriginalAmountCents: amount,
        manualCreditThresholdCents: 5_000,
      },
    })) {
      return;
    }

    // ── PR-W7: idempotency guard (mirrors the PR-W4 /topup pattern) ─────────
    // Prevents an admin double-click from creating two credit_transactions
    // rows for the same logical "add credits" action. Uses an explicit
    // Idempotency-Key header when supplied; otherwise falls back to a
    // deterministic body fingerprint so even admins who forget the header
    // are protected against accidental double-submit.
    const idemKey = deriveAdminCreditIdempotencyKey(
      'credits-add',
      typeof req.headers['idempotency-key'] === 'string'
        ? (req.headers['idempotency-key'] as string)
        : undefined,
      `${targetUserId}|${creditType}|${amount}|${sourceType}|${sourceId ?? ''}`,
    );
    let idemRowOwned = false;
    {
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const inserted = await db
        .insert(walletIdempotencyKeys)
        .values({
          idempotencyKey: idemKey,
          endpoint: '/credits/add',
          status: 'pending',
          expiresAt,
        })
        .onConflictDoNothing()
        .returning({ id: walletIdempotencyKeys.id });

      if (inserted.length === 0) {
        const [existing] = await db
          .select()
          .from(walletIdempotencyKeys)
          .where(eq(walletIdempotencyKeys.idempotencyKey, idemKey))
          .limit(1);

        if (existing?.status === 'success' && existing.responseJson) {
          logger.info('[Credit Wallet] /credits/add idempotent hit', { idemKey });
          try {
            return res.json(JSON.parse(existing.responseJson));
          } catch {
            return res.json({ success: true, message: 'Credits added successfully (idempotent)' });
          }
        }
        return res.status(409).json({
          success: false,
          error: 'Duplicate request in flight or already processed.',
          code: 'IDEMPOTENCY_IN_FLIGHT',
        });
      }
      idemRowOwned = true;
    }

    try {
      await walletService.addCredits(
        targetUserId,
        creditType,
        amount,
        sourceType,
        sourceId,
        description
      );
    } catch (creditErr) {
      // Best-effort: release our idempotency row so the client can retry.
      if (idemRowOwned) {
        try {
          await db
            .delete(walletIdempotencyKeys)
            .where(eq(walletIdempotencyKeys.idempotencyKey, idemKey));
        } catch {
          // 30-day expiry will sweep this row eventually.
        }
      }
      throw creditErr;
    }

    logger.info('[Credit Wallet] Credits added by admin', {
      adminId: adminId || 'internal-service',
      targetUserId,
      creditType,
      amount
    });

    // PR-W1: write a discrete audit_events row so this older /credits/add
    // path matches the auditing rigour of /admin/inject. Money-flow logic
    // is unchanged — this is a pure audit-trail addition. Fire-and-forget;
    // logAuditEvent already swallows DB errors internally.
    try {
      const { logAuditEvent } = await import('../middleware/auditLog');
      await logAuditEvent({
        actorUserId: adminUserId || adminEmail,
        actorRole: 'super_admin',
        actionType: 'WALLET_ADMIN_CREDITS_ADD',
        targetType: 'wallet',
        targetId: targetUserId,
        ip: req.ip || req.headers['x-forwarded-for']?.toString(),
        userAgent: req.headers['user-agent'],
        traceId: (req as any).traceId,
        metadata: {
          adminEmail,
          creditType,
          amount,
          sourceType,
          sourceId: sourceId ?? null,
          description: description ?? null,
          route: '/credits/add',
        },
      });
    } catch (auditErr) {
      logger.warn('[Credit Wallet] Audit log failed (non-blocking)', { error: String(auditErr) });
    }

    const responsePayload = { success: true, message: 'Credits added successfully' };
    // PR-W7: stamp the idempotency row with status='success' + cached
    // payload so a same-key replay returns the original response instead
    // of a duplicate credit.
    try {
      await db
        .update(walletIdempotencyKeys)
        .set({ status: 'success', responseJson: JSON.stringify(responsePayload) })
        .where(eq(walletIdempotencyKeys.idempotencyKey, idemKey));
    } catch (idemErr) {
      logger.warn('[Credit Wallet] /credits/add idempotency stamp failed (non-fatal)', {
        error: String(idemErr),
        idemKey,
      });
    }
    res.json(responsePayload);
  } catch (error: any) {
    logger.error('[Credit Wallet] Add credits error', { error: error.message });
    res.status(500).json({ success: false, error: 'Wallet operation failed', code: 'WALLET_500' });
  }
});

// SECURITY (2026-09-05 wallet-money audit): `x-station-key` used to be
// read, checked only for emptiness, and then never compared against any
// registered credential — `x-station-key: anything` authenticated. The
// header is now resolved against the real station device registry by
// requireNayaxStationDevice (constant-time confirm, fail-closed 403),
// and bound to the station named in the body so one bay's key cannot
// drive another's.
router.post('/nayax/validate-code', nayaxValidationRateLimiter, requireNayaxStationDevice({
  bindBodyStationId: true,
  route: 'POST /api/credit-wallet/nayax/validate-code',
}), async (req, res) => {
  try {
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
    res.status(500).json({ success: false, error: 'Wallet operation failed', code: 'WALLET_500' });
  }
});

// SECURITY (2026-09-05 wallet-money audit): this route BURNS wallet credit
// and marks a hardware redemption completed. It previously accepted any
// non-empty `x-station-key`, so a customer holding their own sessionId
// could confirm the wash as delivered over plain HTTP without ever being
// at the K9000 — credit spent, no wash. Now gated on a registered station
// device credential (fail-closed 403).
router.post('/nayax/acknowledge', auditLogMiddleware('WALLET_BURN'), requireNayaxStationDevice({
  route: 'POST /api/credit-wallet/nayax/acknowledge',
}), async (req, res) => {
  try {
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
    res.status(500).json({ success: false, error: 'Wallet operation failed', code: 'WALLET_500' });
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

router.post('/admin/inject', auditLogMiddleware('CREDIT_WALLET_ADJUST'), async (req, res) => {
  try {
    // SECURITY: Admin identity derived from server-verified Firebase token only.
    // All x-admin-* headers were removed — they are client-controllable and exploitable.
    const adminEmail = (req.firebaseUser as any)?.email || (req.user as any)?.email || '';
    const adminUserId = (req.firebaseUser as any)?.uid || (req.user as any)?.uid || '';

    if (!adminEmail || !adminUserId) {
      return res.status(401).json({ success: false, error: 'Admin authentication required' });
    }

    if (!isSuperAdminVerified(req as any)) {
      logger.warn('[Credit Wallet] Unauthorized admin injection attempt', { adminUserId, adminEmail, ip: req.ip });
      return res.status(403).json({ success: false, error: 'Insufficient permissions for credit injection' });
    }

    const parsed = adminInjectSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.message });
    }

    const { targetUserId, creditType, amount, reason, expiresAt, ticketId, approvalReference } = parsed.data;

    if (!assertOperatingControl(req, res, {
      actionType: 'WALLET_CREDIT_CREATE',
      route: 'POST /api/credit-wallet/admin/inject',
      targetId: `wallet:${targetUserId}`,
      creditType: mapWalletCreditType(creditType),
      paidOrFree: 'free',
      facts: {
        manualStaffCredit: true,
        refundCaseExists: Boolean(ticketId && /refund/i.test(ticketId)),
        sourceEvidenceExists: Boolean(ticketId || approvalReference),
        localControlApproved: Boolean(approvalReference),
      },
      money: {
        creditOriginalAmountCents: amount,
        manualCreditThresholdCents: 5_000,
      },
    })) {
      return;
    }

    // ── PR-W7: idempotency guard (mirrors PR-W4 /topup) ─────────────────────
    // Same de-dup mechanic as /credits/add. Reason text is used in the
    // body fingerprint so two genuinely different injections with the same
    // (target, type, amount, ticket) are still distinguishable.
    const idemKey = deriveAdminCreditIdempotencyKey(
      'admin-inject',
      typeof req.headers['idempotency-key'] === 'string'
        ? (req.headers['idempotency-key'] as string)
        : undefined,
      `${targetUserId}|${creditType}|${amount}|${ticketId ?? ''}|${approvalReference ?? ''}|${(reason || '').slice(0, 32)}`,
    );
    let idemRowOwned = false;
    {
      const ttlExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const inserted = await db
        .insert(walletIdempotencyKeys)
        .values({
          idempotencyKey: idemKey,
          endpoint: '/admin/inject',
          status: 'pending',
          expiresAt: ttlExpiresAt,
        })
        .onConflictDoNothing()
        .returning({ id: walletIdempotencyKeys.id });

      if (inserted.length === 0) {
        const [existing] = await db
          .select()
          .from(walletIdempotencyKeys)
          .where(eq(walletIdempotencyKeys.idempotencyKey, idemKey))
          .limit(1);

        if (existing?.status === 'success' && existing.responseJson) {
          logger.info('[Credit Wallet] /admin/inject idempotent hit', { idemKey });
          try {
            return res.json(JSON.parse(existing.responseJson));
          } catch {
            return res.json({ success: true, message: 'Credits injected successfully (idempotent)' });
          }
        }
        return res.status(409).json({
          success: false,
          error: 'Duplicate injection in flight or already processed.',
          code: 'IDEMPOTENCY_IN_FLIGHT',
        });
      }
      idemRowOwned = true;
    }

    let result: { transactionId: string; auditId?: string };
    try {
      result = await walletService.adminInjectCredits({
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
    } catch (injectErr) {
      if (idemRowOwned) {
        try {
          await db
            .delete(walletIdempotencyKeys)
            .where(eq(walletIdempotencyKeys.idempotencyKey, idemKey));
        } catch {
          // 30-day expiry will clean up.
        }
      }
      throw injectErr;
    }

    const responsePayload = {
      success: true,
      message: 'Credits injected successfully',
      transactionId: result.transactionId,
      auditId: result.auditId,
    };
    try {
      await db
        .update(walletIdempotencyKeys)
        .set({ status: 'success', responseJson: JSON.stringify(responsePayload) })
        .where(eq(walletIdempotencyKeys.idempotencyKey, idemKey));
    } catch (idemErr) {
      logger.warn('[Credit Wallet] /admin/inject idempotency stamp failed (non-fatal)', {
        error: String(idemErr),
        idemKey,
      });
    }
    res.json(responsePayload);
  } catch (error: any) {
    logger.error('[Credit Wallet] Admin inject error', { error: error.message });
    res.status(500).json({ success: false, error: 'Wallet operation failed', code: 'WALLET_500' });
  }
});

router.get('/admin/injection-history/:userId', async (req, res) => {
  try {
    const adminEmail = (req.firebaseUser as any)?.email || (req.user as any)?.email || '';
    if (!adminEmail) {
      return res.status(401).json({ success: false, error: 'Admin authentication required' });
    }
    if (!isSuperAdminVerified(req as any)) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    const { userId } = req.params;
    const history = await walletService.getAdminInjectionHistory(userId);

    res.json({ success: true, injections: history });
  } catch (error: any) {
    logger.error('[Credit Wallet] Admin injection history error', { error: error.message });
    res.status(500).json({ success: false, error: 'Wallet operation failed', code: 'WALLET_500' });
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
    res.status(500).json({ success: false, error: 'Wallet operation failed', code: 'WALLET_500' });
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
    if (!validCronSecret && !isSuperAdminVerified(req as any)) {
      logger.warn('[Credit Wallet] Unauthorized expired-credits trigger', { ip: req.ip, email: adminEmail });
      return res.status(403).json({ success: false, error: 'Unauthorized' });
    }

    const result = await walletService.processExpiredCredits();

    logger.info('[Credit Wallet] Expired credits processed', { 
      triggeredBy: isSuperAdminVerified(req as any) ? adminEmail : 'cron',
      ...result 
    });

    res.json({ 
      success: true, 
      message: `Processed ${result.processed} expired credit entries`,
      ...result
    });
  } catch (error: any) {
    logger.error('[Credit Wallet] Process expired credits error', { error: error.message });
    res.status(500).json({ success: false, error: 'Wallet operation failed', code: 'WALLET_500' });
  }
});

router.get('/admin/dormant-wallets', async (req, res) => {
  try {
    const adminEmail = (req.firebaseUser as any)?.email || (req.user as any)?.email || '';
    if (!adminEmail) {
      return res.status(401).json({ success: false, error: 'Admin authentication required' });
    }
    if (!isSuperAdminVerified(req as any)) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    const result = await walletService.checkDormantWallets();

    res.json({ 
      success: true, 
      ...result
    });
  } catch (error: any) {
    logger.error('[Credit Wallet] Dormant wallets check error', { error: error.message });
    res.status(500).json({ success: false, error: 'Wallet operation failed', code: 'WALLET_500' });
  }
});

export default router;
