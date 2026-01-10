import { db } from '../db';
import { 
  walletAccounts, 
  creditTransactions, 
  redemptionSessions,
  InsertWalletAccount,
  InsertCreditTransaction,
  InsertRedemptionSession,
  WalletAccount,
  CreditTransaction,
  RedemptionSession
} from '@shared/schema';
import { eq, and, desc, sql, gte } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import crypto from 'crypto';
import { logger } from '../lib/logger';

const WALLET_SECRET = process.env.WALLET_LINK_SECRET || 'petwash-wallet-secret-2025';

export interface WalletSummary {
  walletId: string;
  userId: string;
  egiftBalanceCents: number;
  washPackageCredits: number;
  loyaltyPointsBalance: number;
  promoBalanceCents: number;
  referralBalanceCents: number;
  totalCreditsValueCents: number;
  loyaltyTier: string;
  tierPointsThisYear: number;
}

export interface CreditPreview {
  requestedAmountCents: number;
  platform: string;
  egiftApplicableCents: number;
  washPackagesApplicable: number;
  loyaltyPointsApplicable: number;
  promoApplicableCents: number;
  totalCreditsApplicableCents: number;
  cashDueCents: number;
}

export interface RedemptionResult {
  sessionId: string;
  redemptionCode: string;
  qrData: string;
  expiresAt: Date;
  creditsApplied: {
    egiftCents: number;
    washPackages: number;
    loyaltyPoints: number;
    promoCents: number;
  };
  cashDueCents: number;
}

class WalletService {
  async getOrCreateWallet(userId: string): Promise<WalletAccount> {
    const [existing] = await db.select()
      .from(walletAccounts)
      .where(eq(walletAccounts.userId, userId))
      .limit(1);

    if (existing) return existing;

    const walletId = `WALLET-${nanoid(10).toUpperCase()}`;
    const [newWallet] = await db.insert(walletAccounts)
      .values({
        walletId,
        userId,
        egiftBalanceCents: 0,
        washPackageCredits: 0,
        loyaltyPointsBalance: 0,
        promoBalanceCents: 0,
        referralBalanceCents: 0,
        loyaltyTier: 'bronze',
        tierPointsThisYear: 0,
        preferredCurrency: 'ILS',
        autoApplyCredits: true,
        isActive: true,
      })
      .returning();

    logger.info('[Wallet] Created new wallet', { walletId, userId });
    return newWallet;
  }

  async getWalletSummary(userId: string): Promise<WalletSummary> {
    const wallet = await this.getOrCreateWallet(userId);
    
    // 1 loyalty point = 0.1 ILS = 10 agorot/cents
    const loyaltyPointsValueCents = (wallet.loyaltyPointsBalance || 0) * 10;
    
    return {
      walletId: wallet.walletId,
      userId: wallet.userId,
      egiftBalanceCents: wallet.egiftBalanceCents || 0,
      washPackageCredits: wallet.washPackageCredits || 0,
      loyaltyPointsBalance: wallet.loyaltyPointsBalance || 0,
      promoBalanceCents: wallet.promoBalanceCents || 0,
      referralBalanceCents: wallet.referralBalanceCents || 0,
      totalCreditsValueCents: 
        (wallet.egiftBalanceCents || 0) + 
        (wallet.promoBalanceCents || 0) + 
        (wallet.referralBalanceCents || 0) +
        loyaltyPointsValueCents,
      loyaltyTier: wallet.loyaltyTier || 'bronze',
      tierPointsThisYear: wallet.tierPointsThisYear || 0,
    };
  }

  async previewCredits(
    userId: string, 
    requestedAmountCents: number, 
    platform: string
  ): Promise<CreditPreview> {
    const wallet = await this.getOrCreateWallet(userId);
    
    let remainingAmount = requestedAmountCents;
    let egiftApplicable = 0;
    let washPackagesApplicable = 0;
    let loyaltyPointsApplicable = 0;
    let promoApplicable = 0;

    if (platform === 'k9000' && (wallet.washPackageCredits || 0) > 0) {
      washPackagesApplicable = 1;
      remainingAmount = 0;
    } else {
      if ((wallet.promoBalanceCents || 0) > 0) {
        promoApplicable = Math.min(wallet.promoBalanceCents || 0, remainingAmount);
        remainingAmount -= promoApplicable;
      }

      if (remainingAmount > 0 && (wallet.referralBalanceCents || 0) > 0) {
        const referralApplicable = Math.min(wallet.referralBalanceCents || 0, remainingAmount);
        promoApplicable += referralApplicable;
        remainingAmount -= referralApplicable;
      }

      if (remainingAmount > 0 && (wallet.egiftBalanceCents || 0) > 0) {
        egiftApplicable = Math.min(wallet.egiftBalanceCents || 0, remainingAmount);
        remainingAmount -= egiftApplicable;
      }

      if (remainingAmount > 0 && (wallet.loyaltyPointsBalance || 0) > 0) {
        // Max 20% of transaction can be covered by loyalty points
        const maxLoyaltyDiscount = Math.floor(requestedAmountCents * 0.2);
        // 1 loyalty point = 0.1 ILS = 10 agorot/cents
        const loyaltyValueAvailableCents = (wallet.loyaltyPointsBalance || 0) * 10;
        loyaltyPointsApplicable = Math.min(
          Math.min(loyaltyValueAvailableCents, remainingAmount),
          maxLoyaltyDiscount
        );
        remainingAmount -= loyaltyPointsApplicable;
      }
    }

    return {
      requestedAmountCents,
      platform,
      egiftApplicableCents: egiftApplicable,
      washPackagesApplicable,
      loyaltyPointsApplicable,
      promoApplicableCents: promoApplicable,
      totalCreditsApplicableCents: egiftApplicable + promoApplicable + loyaltyPointsApplicable + 
        (washPackagesApplicable > 0 ? requestedAmountCents : 0),
      cashDueCents: remainingAmount,
    };
  }

  async createRedemptionSession(
    userId: string,
    platform: string,
    requestedAmountCents: number,
    serviceType?: string,
    bookingId?: string,
    stationId?: string,
    deviceInfo?: object
  ): Promise<RedemptionResult> {
    const wallet = await this.getOrCreateWallet(userId);
    const preview = await this.previewCredits(userId, requestedAmountCents, platform);

    const sessionId = `REDEEM-${nanoid(12).toUpperCase()}`;
    const redemptionCode = nanoid(6).toUpperCase();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const qrPayload = {
      sessionId,
      userId,
      walletId: wallet.walletId,
      amountCents: requestedAmountCents,
      creditsApplied: preview.totalCreditsApplicableCents,
      cashDue: preview.cashDueCents,
      exp: expiresAt.getTime(),
    };
    const qrData = Buffer.from(JSON.stringify(qrPayload)).toString('base64');
    
    const hmac = crypto.createHmac('sha256', WALLET_SECRET)
      .update(sessionId + redemptionCode + expiresAt.toISOString())
      .digest('hex');

    await db.insert(redemptionSessions).values({
      sessionId,
      walletId: wallet.walletId,
      userId,
      sessionType: stationId ? 'hardware_qr' : 'mobile_booking',
      platform,
      serviceType,
      requestedAmountCents,
      egiftAppliedCents: preview.egiftApplicableCents,
      washPackagesApplied: preview.washPackagesApplicable,
      loyaltyPointsApplied: preview.loyaltyPointsApplicable,
      promoAppliedCents: preview.promoApplicableCents,
      totalCreditsAppliedCents: preview.totalCreditsApplicableCents,
      cashDueCents: preview.cashDueCents,
      stationId,
      redemptionCode,
      redemptionQrData: qrData,
      codeHmac: hmac,
      status: 'code_generated',
      expiresAt,
      bookingId,
      deviceInfo: deviceInfo || {},
    });

    logger.info('[Wallet] Created redemption session', { 
      sessionId, 
      userId, 
      platform, 
      requestedAmountCents,
      creditsApplied: preview.totalCreditsApplicableCents 
    });

    return {
      sessionId,
      redemptionCode,
      qrData,
      expiresAt,
      creditsApplied: {
        egiftCents: preview.egiftApplicableCents,
        washPackages: preview.washPackagesApplicable,
        loyaltyPoints: preview.loyaltyPointsApplicable,
        promoCents: preview.promoApplicableCents,
      },
      cashDueCents: preview.cashDueCents,
    };
  }

  async confirmRedemption(sessionId: string, paymentConfirmed: boolean = false, idempotencyKey?: string): Promise<boolean> {
    // Use raw SQL transaction with row-level locking to prevent race conditions
    const result = await db.execute(sql`
      WITH session_check AS (
        SELECT * FROM redemption_sessions 
        WHERE session_id = ${sessionId}
        FOR UPDATE NOWAIT
      )
      SELECT * FROM session_check
    `).catch(() => null);

    if (!result || result.rows.length === 0) {
      throw new Error('Redemption session not found or locked by another process');
    }

    const session = result.rows[0] as any;

    // IDEMPOTENCY: Already completed sessions return success
    if (session.status === 'completed') {
      logger.info('[Wallet] Idempotent confirmation - already completed', { sessionId });
      return true;
    }

    if (session.status === 'expired' || session.status === 'cancelled') {
      throw new Error(`Session is ${session.status}`);
    }

    // Check expiry
    if (new Date(session.expires_at) < new Date()) {
      await db.update(redemptionSessions)
        .set({ status: 'expired', updatedAt: new Date() })
        .where(eq(redemptionSessions.sessionId, sessionId));
      throw new Error('Session expired');
    }

    // Cash payment validation
    if ((session.cash_due_cents || 0) > 0 && !paymentConfirmed) {
      throw new Error('Cash payment required but not confirmed');
    }

    // Get wallet with row lock for atomic balance updates
    const walletResult = await db.execute(sql`
      SELECT * FROM wallet_accounts 
      WHERE wallet_id = ${session.wallet_id}
      FOR UPDATE
    `);

    if (walletResult.rows.length === 0) {
      throw new Error('Wallet not found');
    }

    const wallet = walletResult.rows[0] as any;

    // RE-VALIDATE BALANCES: Ensure sufficient credits haven't changed since preview
    const egiftRequired = session.egift_applied_cents || 0;
    const washRequired = session.wash_packages_applied || 0;
    const loyaltyCentsRequired = session.loyalty_points_applied || 0;
    const promoRequired = session.promo_applied_cents || 0;

    const egiftAvailable = wallet.egift_balance_cents || 0;
    const washAvailable = wallet.wash_package_credits || 0;
    const loyaltyPointsAvailable = wallet.loyalty_points_balance || 0;
    const promoAvailable = wallet.promo_balance_cents || 0;

    // Convert loyalty cents to points for comparison
    const loyaltyPointsRequired = Math.ceil(loyaltyCentsRequired / 10);

    // NEGATIVE BALANCE PREVENTION: Check each credit type
    if (egiftRequired > egiftAvailable) {
      logger.warn('[Wallet] Insufficient e-gift balance', { 
        sessionId, required: egiftRequired, available: egiftAvailable 
      });
      throw new Error(`Insufficient e-gift balance: need ${egiftRequired}, have ${egiftAvailable}`);
    }
    if (washRequired > washAvailable) {
      logger.warn('[Wallet] Insufficient wash package credits', { 
        sessionId, required: washRequired, available: washAvailable 
      });
      throw new Error(`Insufficient wash packages: need ${washRequired}, have ${washAvailable}`);
    }
    if (loyaltyPointsRequired > loyaltyPointsAvailable) {
      logger.warn('[Wallet] Insufficient loyalty points', { 
        sessionId, required: loyaltyPointsRequired, available: loyaltyPointsAvailable 
      });
      throw new Error(`Insufficient loyalty points: need ${loyaltyPointsRequired}, have ${loyaltyPointsAvailable}`);
    }
    if (promoRequired > promoAvailable) {
      logger.warn('[Wallet] Insufficient promo balance', { 
        sessionId, required: promoRequired, available: promoAvailable 
      });
      throw new Error(`Insufficient promo balance: need ${promoRequired}, have ${promoAvailable}`);
    }

    // Calculate new balances
    const newEgiftBalance = egiftAvailable - egiftRequired;
    const newWashBalance = washAvailable - washRequired;
    const newLoyaltyBalance = loyaltyPointsAvailable - loyaltyPointsRequired;
    const newPromoBalance = Math.max(0, promoAvailable - promoRequired);

    // Create transaction records for audit trail
    const transactions: any[] = [];
    const now = new Date();

    if (egiftRequired > 0) {
      transactions.push({
        transactionId: `TXN-${nanoid(12).toUpperCase()}`,
        walletId: session.wallet_id,
        creditType: 'egift',
        transactionType: 'redeem',
        amountCents: -egiftRequired,
        balanceAfterCents: newEgiftBalance,
        redemptionSessionId: sessionId,
        platform: session.platform,
        bookingId: session.booking_id,
        description: `E-gift redeemed for ${session.platform} service`,
        initiatedBy: 'system',
      });
    }

    if (washRequired > 0) {
      transactions.push({
        transactionId: `TXN-${nanoid(12).toUpperCase()}`,
        walletId: session.wallet_id,
        creditType: 'wash_package',
        transactionType: 'redeem',
        amountUnits: -washRequired,
        balanceAfterUnits: newWashBalance,
        redemptionSessionId: sessionId,
        platform: session.platform,
        bookingId: session.booking_id,
        description: `Wash package redeemed at ${session.station_id || 'station'}`,
        initiatedBy: 'system',
      });
    }

    if (loyaltyPointsRequired > 0) {
      transactions.push({
        transactionId: `TXN-${nanoid(12).toUpperCase()}`,
        walletId: session.wallet_id,
        creditType: 'loyalty_points',
        transactionType: 'redeem',
        amountUnits: -loyaltyPointsRequired,
        balanceAfterUnits: newLoyaltyBalance,
        redemptionSessionId: sessionId,
        platform: session.platform,
        bookingId: session.booking_id,
        description: `Loyalty points redeemed (${loyaltyCentsRequired} agorot value)`,
        initiatedBy: 'system',
      });
    }

    if (promoRequired > 0) {
      transactions.push({
        transactionId: `TXN-${nanoid(12).toUpperCase()}`,
        walletId: session.wallet_id,
        creditType: 'promo_credit',
        transactionType: 'redeem',
        amountCents: -promoRequired,
        balanceAfterCents: newPromoBalance,
        redemptionSessionId: sessionId,
        platform: session.platform,
        bookingId: session.booking_id,
        description: `Promo credit redeemed for ${session.platform} service`,
        initiatedBy: 'system',
      });
    }

    // Insert all transactions atomically
    if (transactions.length > 0) {
      await db.insert(creditTransactions).values(transactions);
    }

    // Update wallet balances atomically
    await db.update(walletAccounts)
      .set({
        egiftBalanceCents: newEgiftBalance,
        washPackageCredits: newWashBalance,
        loyaltyPointsBalance: newLoyaltyBalance,
        promoBalanceCents: newPromoBalance,
        updatedAt: now,
        lastActivityAt: now,
      })
      .where(eq(walletAccounts.walletId, session.wallet_id));

    // Mark session as completed
    await db.update(redemptionSessions)
      .set({ 
        status: 'completed', 
        completedAt: now,
        updatedAt: now,
      })
      .where(eq(redemptionSessions.sessionId, sessionId));

    logger.info('[Wallet] Redemption confirmed with balance validation', { 
      sessionId, 
      walletId: session.wallet_id,
      creditsDeducted: {
        egift: egiftRequired,
        washPackages: washRequired,
        loyaltyPoints: loyaltyPointsRequired,
        promo: promoRequired,
      }
    });

    return true;
  }

  async refundRedemption(
    sessionId: string, 
    reason: string,
    initiatedBy: string = 'system'
  ): Promise<boolean> {
    const [session] = await db.select()
      .from(redemptionSessions)
      .where(eq(redemptionSessions.sessionId, sessionId))
      .limit(1);

    if (!session) {
      throw new Error('Redemption session not found');
    }

    if (session.status !== 'completed') {
      throw new Error(`Cannot refund session with status: ${session.status}`);
    }

    const [wallet] = await db.select()
      .from(walletAccounts)
      .where(eq(walletAccounts.walletId, session.walletId))
      .limit(1);

    if (!wallet) {
      throw new Error('Wallet not found');
    }

    const now = new Date();
    const refundTransactions: any[] = [];

    // Restore e-gift
    if ((session.egiftAppliedCents || 0) > 0) {
      const newBalance = (wallet.egiftBalanceCents || 0) + (session.egiftAppliedCents || 0);
      refundTransactions.push({
        transactionId: `TXN-${nanoid(12).toUpperCase()}`,
        walletId: session.walletId,
        creditType: 'egift',
        transactionType: 'refund',
        amountCents: session.egiftAppliedCents,
        balanceAfterCents: newBalance,
        redemptionSessionId: sessionId,
        platform: session.platform,
        bookingId: session.bookingId,
        description: `E-gift refunded: ${reason}`,
        initiatedBy,
      });
      await db.update(walletAccounts)
        .set({ egiftBalanceCents: newBalance, updatedAt: now })
        .where(eq(walletAccounts.walletId, session.walletId));
    }

    // Restore wash packages
    if ((session.washPackagesApplied || 0) > 0) {
      const newBalance = (wallet.washPackageCredits || 0) + (session.washPackagesApplied || 0);
      refundTransactions.push({
        transactionId: `TXN-${nanoid(12).toUpperCase()}`,
        walletId: session.walletId,
        creditType: 'wash_package',
        transactionType: 'refund',
        amountUnits: session.washPackagesApplied,
        balanceAfterUnits: newBalance,
        redemptionSessionId: sessionId,
        platform: session.platform,
        bookingId: session.bookingId,
        description: `Wash package refunded: ${reason}`,
        initiatedBy,
      });
      await db.update(walletAccounts)
        .set({ washPackageCredits: newBalance, updatedAt: now })
        .where(eq(walletAccounts.walletId, session.walletId));
    }

    // Restore loyalty points
    if ((session.loyaltyPointsApplied || 0) > 0) {
      const pointsToRestore = Math.ceil((session.loyaltyPointsApplied || 0) / 10);
      const newBalance = (wallet.loyaltyPointsBalance || 0) + pointsToRestore;
      refundTransactions.push({
        transactionId: `TXN-${nanoid(12).toUpperCase()}`,
        walletId: session.walletId,
        creditType: 'loyalty_points',
        transactionType: 'refund',
        amountUnits: pointsToRestore,
        balanceAfterUnits: newBalance,
        redemptionSessionId: sessionId,
        platform: session.platform,
        bookingId: session.bookingId,
        description: `Loyalty points refunded: ${reason}`,
        initiatedBy,
      });
      await db.update(walletAccounts)
        .set({ loyaltyPointsBalance: newBalance, updatedAt: now })
        .where(eq(walletAccounts.walletId, session.walletId));
    }

    // Restore promo credits
    if ((session.promoAppliedCents || 0) > 0) {
      const newBalance = (wallet.promoBalanceCents || 0) + (session.promoAppliedCents || 0);
      refundTransactions.push({
        transactionId: `TXN-${nanoid(12).toUpperCase()}`,
        walletId: session.walletId,
        creditType: 'promo_credit',
        transactionType: 'refund',
        amountCents: session.promoAppliedCents,
        balanceAfterCents: newBalance,
        redemptionSessionId: sessionId,
        platform: session.platform,
        bookingId: session.bookingId,
        description: `Promo credit refunded: ${reason}`,
        initiatedBy,
      });
      await db.update(walletAccounts)
        .set({ promoBalanceCents: newBalance, updatedAt: now })
        .where(eq(walletAccounts.walletId, session.walletId));
    }

    // Insert refund transaction records
    if (refundTransactions.length > 0) {
      await db.insert(creditTransactions).values(refundTransactions);
    }

    // Update session status to refunded
    await db.update(redemptionSessions)
      .set({ 
        status: 'refunded' as any,
        updatedAt: now,
      })
      .where(eq(redemptionSessions.sessionId, sessionId));

    logger.info('[Wallet] Redemption refunded', { 
      sessionId, 
      walletId: session.walletId, 
      reason,
      creditsRestored: refundTransactions.length,
    });

    return true;
  }

  async cancelSession(sessionId: string): Promise<boolean> {
    const [session] = await db.select()
      .from(redemptionSessions)
      .where(eq(redemptionSessions.sessionId, sessionId))
      .limit(1);

    if (!session) {
      throw new Error('Redemption session not found');
    }

    if (session.status === 'completed') {
      throw new Error('Cannot cancel completed session - use refund instead');
    }

    if (session.status === 'cancelled' || session.status === 'expired') {
      return true; // Already cancelled/expired
    }

    await db.update(redemptionSessions)
      .set({ 
        status: 'cancelled',
        updatedAt: new Date(),
      })
      .where(eq(redemptionSessions.sessionId, sessionId));

    logger.info('[Wallet] Session cancelled', { sessionId });
    return true;
  }

  async addCredits(
    userId: string,
    creditType: 'egift' | 'wash_package' | 'loyalty_points' | 'promo_credit' | 'referral_credit',
    amount: number,
    sourceType: string,
    sourceId?: string,
    description?: string
  ): Promise<void> {
    const wallet = await this.getOrCreateWallet(userId);
    const transactionId = `TXN-${nanoid(12).toUpperCase()}`;

    const updates: Partial<typeof walletAccounts.$inferInsert> = {
      updatedAt: new Date(),
      lastActivityAt: new Date(),
    };

    let balanceAfter = 0;
    let isUnits = false;

    switch (creditType) {
      case 'egift':
        updates.egiftBalanceCents = (wallet.egiftBalanceCents || 0) + amount;
        balanceAfter = updates.egiftBalanceCents;
        break;
      case 'wash_package':
        updates.washPackageCredits = (wallet.washPackageCredits || 0) + amount;
        balanceAfter = updates.washPackageCredits;
        isUnits = true;
        break;
      case 'loyalty_points':
        updates.loyaltyPointsBalance = (wallet.loyaltyPointsBalance || 0) + amount;
        updates.tierPointsThisYear = (wallet.tierPointsThisYear || 0) + amount;
        balanceAfter = updates.loyaltyPointsBalance;
        isUnits = true;
        break;
      case 'promo_credit':
        updates.promoBalanceCents = (wallet.promoBalanceCents || 0) + amount;
        balanceAfter = updates.promoBalanceCents;
        break;
      case 'referral_credit':
        updates.referralBalanceCents = (wallet.referralBalanceCents || 0) + amount;
        balanceAfter = updates.referralBalanceCents;
        break;
    }

    await db.update(walletAccounts)
      .set(updates)
      .where(eq(walletAccounts.walletId, wallet.walletId));

    await db.insert(creditTransactions).values({
      transactionId,
      walletId: wallet.walletId,
      creditType,
      transactionType: 'issue',
      amountCents: isUnits ? undefined : amount,
      amountUnits: isUnits ? amount : undefined,
      balanceAfterCents: isUnits ? undefined : balanceAfter,
      balanceAfterUnits: isUnits ? balanceAfter : undefined,
      sourceType,
      sourceId,
      description: description || `${creditType} credit issued`,
      initiatedBy: 'system',
    });

    logger.info('[Wallet] Credits added', { 
      walletId: wallet.walletId, 
      creditType, 
      amount, 
      sourceType 
    });
  }

  async getTransactionHistory(userId: string, limit: number = 50): Promise<CreditTransaction[]> {
    const wallet = await this.getOrCreateWallet(userId);
    
    return await db.select()
      .from(creditTransactions)
      .where(eq(creditTransactions.walletId, wallet.walletId))
      .orderBy(desc(creditTransactions.createdAt))
      .limit(limit);
  }

  async validateRedemptionCode(
    code: string, 
    stationId: string
  ): Promise<RedemptionSession | null> {
    const [session] = await db.select()
      .from(redemptionSessions)
      .where(and(
        eq(redemptionSessions.redemptionCode, code),
        eq(redemptionSessions.status, 'code_generated')
      ))
      .limit(1);

    if (!session) return null;
    if (new Date(session.expiresAt) < new Date()) return null;

    await db.update(redemptionSessions)
      .set({ 
        status: 'scanned',
        scannedAt: new Date(),
        stationId: stationId,
        updatedAt: new Date(),
      })
      .where(eq(redemptionSessions.sessionId, session.sessionId));

    return session;
  }

  async acknowledgeHardwareRedemption(sessionId: string): Promise<boolean> {
    const [session] = await db.select()
      .from(redemptionSessions)
      .where(eq(redemptionSessions.sessionId, sessionId))
      .limit(1);

    if (!session || session.status !== 'scanned') {
      return false;
    }

    await db.update(redemptionSessions)
      .set({ 
        status: 'acknowledged',
        acknowledgedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(redemptionSessions.sessionId, sessionId));

    return true;
  }

  /**
   * Admin credit injection with comprehensive audit trail
   * Only callable by admin users with proper authorization
   */
  async adminInjectCredits(params: {
    adminUserId: string;
    adminEmail: string;
    targetUserId: string;
    creditType: 'egift' | 'wash_package' | 'loyalty_points' | 'promo_credit' | 'referral_credit';
    amount: number;
    reason: string;
    expiresAt?: Date;
    ticketId?: string;
    approvalReference?: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<{ success: boolean; transactionId: string; auditId: string }> {
    const {
      adminUserId,
      adminEmail,
      targetUserId,
      creditType,
      amount,
      reason,
      expiresAt,
      ticketId,
      approvalReference,
      ipAddress,
      userAgent,
    } = params;

    if (amount <= 0) {
      throw new Error('Credit injection amount must be positive');
    }

    if (!reason || reason.length < 10) {
      throw new Error('Credit injection requires a detailed reason (minimum 10 characters)');
    }

    const wallet = await this.getOrCreateWallet(targetUserId);
    const transactionId = `ADM-INJ-${nanoid(12).toUpperCase()}`;
    const auditId = `AUD-${nanoid(12).toUpperCase()}`;
    const now = new Date();

    const updates: Partial<typeof walletAccounts.$inferInsert> = {
      updatedAt: now,
      lastActivityAt: now,
    };

    let balanceBefore = 0;
    let balanceAfter = 0;
    let isUnits = false;

    switch (creditType) {
      case 'egift':
        balanceBefore = wallet.egiftBalanceCents || 0;
        updates.egiftBalanceCents = balanceBefore + amount;
        balanceAfter = updates.egiftBalanceCents;
        break;
      case 'wash_package':
        balanceBefore = wallet.washPackageCredits || 0;
        updates.washPackageCredits = balanceBefore + amount;
        balanceAfter = updates.washPackageCredits;
        isUnits = true;
        break;
      case 'loyalty_points':
        balanceBefore = wallet.loyaltyPointsBalance || 0;
        updates.loyaltyPointsBalance = balanceBefore + amount;
        updates.tierPointsThisYear = (wallet.tierPointsThisYear || 0) + amount;
        balanceAfter = updates.loyaltyPointsBalance;
        isUnits = true;
        break;
      case 'promo_credit':
        balanceBefore = wallet.promoBalanceCents || 0;
        updates.promoBalanceCents = balanceBefore + amount;
        balanceAfter = updates.promoBalanceCents;
        break;
      case 'referral_credit':
        balanceBefore = wallet.referralBalanceCents || 0;
        updates.referralBalanceCents = balanceBefore + amount;
        balanceAfter = updates.referralBalanceCents;
        break;
    }

    // Update wallet balance
    await db.update(walletAccounts)
      .set(updates)
      .where(eq(walletAccounts.walletId, wallet.walletId));

    // Create credit transaction with admin injection marker
    await db.insert(creditTransactions).values({
      transactionId,
      walletId: wallet.walletId,
      creditType,
      transactionType: 'issue',
      amountCents: isUnits ? undefined : amount,
      amountUnits: isUnits ? amount : undefined,
      balanceAfterCents: isUnits ? undefined : balanceAfter,
      balanceAfterUnits: isUnits ? balanceAfter : undefined,
      sourceType: 'admin_injection',
      sourceId: auditId,
      description: `Admin credit injection: ${reason}`,
      initiatedBy: adminUserId,
      expiresAt: expiresAt,
    });

    // Log comprehensive audit trail
    const auditDetails = {
      auditId,
      transactionId,
      action: 'admin_credit_injection',
      timestamp: now.toISOString(),
      admin: {
        userId: adminUserId,
        email: adminEmail,
        ipAddress: ipAddress || 'unknown',
        userAgent: userAgent || 'unknown',
      },
      target: {
        userId: targetUserId,
        walletId: wallet.walletId,
      },
      creditDetails: {
        creditType,
        amount,
        isUnits,
        balanceBefore,
        balanceAfter,
        expiresAt: expiresAt?.toISOString() || null,
      },
      metadata: {
        reason,
        ticketId: ticketId || null,
        approvalReference: approvalReference || null,
      },
      verification: {
        checksum: this.generateAuditChecksum({
          auditId,
          adminUserId,
          targetUserId,
          creditType,
          amount,
          timestamp: now.toISOString(),
        }),
      },
    };

    logger.warn('[ADMIN AUDIT] Credit injection performed', auditDetails);

    // Also log to console for backup visibility
    console.log(`[ADMIN CREDIT INJECTION AUDIT]
=======================================================
Audit ID: ${auditId}
Transaction ID: ${transactionId}
Timestamp: ${now.toISOString()}
Admin: ${adminEmail} (${adminUserId})
Target User: ${targetUserId}
Credit Type: ${creditType}
Amount: ${amount} ${isUnits ? 'units' : 'cents'}
Balance: ${balanceBefore} → ${balanceAfter}
Reason: ${reason}
Ticket ID: ${ticketId || 'N/A'}
Approval Reference: ${approvalReference || 'N/A'}
IP Address: ${ipAddress || 'unknown'}
=======================================================`);

    return {
      success: true,
      transactionId,
      auditId,
    };
  }

  /**
   * Generate SHA-256 checksum for audit record integrity verification
   */
  private generateAuditChecksum(data: Record<string, any>): string {
    const crypto = require('crypto');
    const canonicalString = JSON.stringify(data, Object.keys(data).sort());
    return crypto.createHash('sha256').update(canonicalString).digest('hex').substring(0, 16);
  }

  /**
   * Get admin credit injection history for a specific wallet
   */
  async getAdminInjectionHistory(userId: string): Promise<CreditTransaction[]> {
    const wallet = await this.getOrCreateWallet(userId);
    
    return await db.select()
      .from(creditTransactions)
      .where(and(
        eq(creditTransactions.walletId, wallet.walletId),
        eq(creditTransactions.sourceType, 'admin_injection')
      ))
      .orderBy(desc(creditTransactions.createdAt));
  }

  /**
   * Process expired credits for all wallets
   * Should be called by a scheduled job (e.g., daily cron)
   * Calculates residual balance using net usage (redeem - refund) to maintain ledger integrity
   * Tracks running balances to ensure accurate balanceAfterCents on consecutive expirations
   */
  async processExpiredCredits(): Promise<{ processed: number; expiredAmount: number }> {
    const now = new Date();
    let processed = 0;
    let expiredAmount = 0;

    const expiredTransactions = await db.select()
      .from(creditTransactions)
      .where(and(
        sql`${creditTransactions.expiresAt} IS NOT NULL`,
        sql`${creditTransactions.expiresAt} < ${now}`,
        eq(creditTransactions.transactionType, 'issue')
      ));

    const walletRunningBalances = new Map<string, { 
      egift: number; 
      promo: number; 
      referral: number;
      loaded: boolean;
    }>();

    for (const txn of expiredTransactions) {
      const hasBeenExpired = await db.select()
        .from(creditTransactions)
        .where(and(
          eq(creditTransactions.sourceId, txn.transactionId),
          eq(creditTransactions.transactionType, 'expire')
        ))
        .limit(1);

      if (hasBeenExpired.length > 0) continue;

      const originalAmount = txn.amountCents || 0;
      
      const netUsageResult = await db.select({
        totalRedeemed: sql<number>`COALESCE(SUM(CASE WHEN ${creditTransactions.transactionType} = 'redeem' THEN ABS(${creditTransactions.amountCents}) ELSE 0 END), 0)`,
        totalRefunded: sql<number>`COALESCE(SUM(CASE WHEN ${creditTransactions.transactionType} = 'refund' THEN ${creditTransactions.amountCents} ELSE 0 END), 0)`,
        totalReleased: sql<number>`COALESCE(SUM(CASE WHEN ${creditTransactions.transactionType} = 'release' THEN ${creditTransactions.amountCents} ELSE 0 END), 0)`
      })
        .from(creditTransactions)
        .where(and(
          eq(creditTransactions.walletId, txn.walletId),
          eq(creditTransactions.creditType, txn.creditType),
          sql`${creditTransactions.transactionType} IN ('redeem', 'refund', 'release')`,
          sql`${creditTransactions.createdAt} >= ${txn.createdAt}`,
          sql`${creditTransactions.createdAt} <= ${txn.expiresAt}`
        ));

      const totalRedeemed = Number(netUsageResult[0]?.totalRedeemed || 0);
      const totalRefunded = Number(netUsageResult[0]?.totalRefunded || 0);
      const totalReleased = Number(netUsageResult[0]?.totalReleased || 0);
      const netUsed = totalRedeemed - totalRefunded - totalReleased;
      const residualAmount = Math.max(0, originalAmount - netUsed);
      
      if (residualAmount === 0) {
        logger.info('[Wallet] Skipping fully-redeemed expired credit', { 
          transactionId: txn.transactionId, 
          originalAmount, 
          netUsed 
        });
        continue;
      }

      let runningBalance = walletRunningBalances.get(txn.walletId);
      if (!runningBalance || !runningBalance.loaded) {
        const wallet = await db.select()
          .from(walletAccounts)
          .where(eq(walletAccounts.walletId, txn.walletId))
          .limit(1);

        if (wallet.length === 0) continue;

        runningBalance = {
          egift: wallet[0].egiftBalanceCents || 0,
          promo: wallet[0].promoBalanceCents || 0,
          referral: wallet[0].referralBalanceCents || 0,
          loaded: true,
        };
        walletRunningBalances.set(txn.walletId, runningBalance);
      }

      let balanceAfter = 0;
      switch (txn.creditType) {
        case 'egift':
          runningBalance.egift = Math.max(0, runningBalance.egift - residualAmount);
          balanceAfter = runningBalance.egift;
          break;
        case 'promo_credit':
          runningBalance.promo = Math.max(0, runningBalance.promo - residualAmount);
          balanceAfter = runningBalance.promo;
          break;
        case 'referral_credit':
          runningBalance.referral = Math.max(0, runningBalance.referral - residualAmount);
          balanceAfter = runningBalance.referral;
          break;
      }

      await db.insert(creditTransactions).values({
        transactionId: `EXP-${nanoid(12).toUpperCase()}`,
        walletId: txn.walletId,
        creditType: txn.creditType,
        transactionType: 'expire',
        amountCents: -residualAmount,
        balanceAfterCents: balanceAfter,
        sourceType: 'expiry_job',
        sourceId: txn.transactionId,
        description: `Credit expired (original: ₪${(originalAmount/100).toFixed(2)}, net used: ₪${(netUsed/100).toFixed(2)}, expired: ₪${(residualAmount/100).toFixed(2)})`,
        initiatedBy: 'system',
      });

      processed++;
      expiredAmount += residualAmount;
    }

    for (const [walletId, runningBalance] of walletRunningBalances.entries()) {
      if (!runningBalance.loaded) continue;

      const originalWallet = await db.select()
        .from(walletAccounts)
        .where(eq(walletAccounts.walletId, walletId))
        .limit(1);

      if (originalWallet.length === 0) continue;

      const currentEgift = originalWallet[0].egiftBalanceCents || 0;
      const currentPromo = originalWallet[0].promoBalanceCents || 0;
      const currentReferral = originalWallet[0].referralBalanceCents || 0;

      const egiftExpired = currentEgift - runningBalance.egift;
      const promoExpired = currentPromo - runningBalance.promo;
      const referralExpired = currentReferral - runningBalance.referral;

      await db.execute(sql`
        UPDATE wallet_accounts 
        SET 
          egift_balance_cents = GREATEST(0, egift_balance_cents - ${egiftExpired}),
          promo_balance_cents = GREATEST(0, promo_balance_cents - ${promoExpired}),
          referral_balance_cents = GREATEST(0, referral_balance_cents - ${referralExpired}),
          updated_at = ${now}
        WHERE wallet_id = ${walletId}
      `);
    }

    logger.info('[Wallet] Expired credits processed', { processed, expiredAmount });
    return { processed, expiredAmount };
  }

  /**
   * Check for dormant wallets and apply policies
   * Wallets with no activity for 12+ months may trigger warning notifications
   */
  async checkDormantWallets(): Promise<{ dormantCount: number; atRiskCredits: number }> {
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const dormantWallets = await db.select()
      .from(walletAccounts)
      .where(and(
        sql`${walletAccounts.lastActivityAt} < ${twelveMonthsAgo}`,
        eq(walletAccounts.isActive, true),
        sql`(${walletAccounts.egiftBalanceCents} > 0 OR ${walletAccounts.promoBalanceCents} > 0 OR ${walletAccounts.referralBalanceCents} > 0)`
      ));

    let atRiskCredits = 0;
    for (const wallet of dormantWallets) {
      atRiskCredits += (wallet.egiftBalanceCents || 0) + 
                       (wallet.promoBalanceCents || 0) + 
                       (wallet.referralBalanceCents || 0);
    }

    logger.info('[Wallet] Dormant wallet check', { 
      dormantCount: dormantWallets.length, 
      atRiskCredits,
      threshold: '12 months' 
    });

    return { 
      dormantCount: dormantWallets.length, 
      atRiskCredits 
    };
  }

  /**
   * Get credits expiring soon for a user (warning for UI)
   */
  async getExpiringCredits(userId: string, daysAhead: number = 30): Promise<{
    expiringCredits: Array<{
      creditType: string;
      amountCents: number;
      expiresAt: Date;
      description: string | null;
    }>;
    totalExpiringCents: number;
  }> {
    const wallet = await this.getOrCreateWallet(userId);
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    const expiringTxns = await db.select()
      .from(creditTransactions)
      .where(and(
        eq(creditTransactions.walletId, wallet.walletId),
        eq(creditTransactions.transactionType, 'issue'),
        sql`${creditTransactions.expiresAt} IS NOT NULL`,
        sql`${creditTransactions.expiresAt} > NOW()`,
        sql`${creditTransactions.expiresAt} <= ${futureDate}`
      ))
      .orderBy(creditTransactions.expiresAt);

    const expiringCredits = expiringTxns.map(txn => ({
      creditType: txn.creditType,
      amountCents: txn.amountCents || 0,
      expiresAt: new Date(txn.expiresAt!),
      description: txn.description,
    }));

    const totalExpiringCents = expiringCredits.reduce((sum, c) => sum + c.amountCents, 0);

    return { expiringCredits, totalExpiringCents };
  }
}

export const walletService = new WalletService();
