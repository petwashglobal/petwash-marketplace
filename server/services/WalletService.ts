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

  async confirmRedemption(sessionId: string, paymentConfirmed: boolean = false): Promise<boolean> {
    const [session] = await db.select()
      .from(redemptionSessions)
      .where(eq(redemptionSessions.sessionId, sessionId))
      .limit(1);

    if (!session) {
      throw new Error('Redemption session not found');
    }

    if (session.status === 'completed') {
      return true;
    }

    if (session.status === 'expired' || session.status === 'cancelled') {
      throw new Error(`Session is ${session.status}`);
    }

    if (new Date(session.expiresAt) < new Date()) {
      await db.update(redemptionSessions)
        .set({ status: 'expired', updatedAt: new Date() })
        .where(eq(redemptionSessions.sessionId, sessionId));
      throw new Error('Session expired');
    }

    if ((session.cashDueCents || 0) > 0 && !paymentConfirmed) {
      throw new Error('Cash payment required but not confirmed');
    }

    const [wallet] = await db.select()
      .from(walletAccounts)
      .where(eq(walletAccounts.walletId, session.walletId))
      .limit(1);

    if (!wallet) {
      throw new Error('Wallet not found');
    }

    const updates: Partial<typeof walletAccounts.$inferInsert> = {
      updatedAt: new Date(),
      lastActivityAt: new Date(),
    };

    if ((session.egiftAppliedCents || 0) > 0) {
      updates.egiftBalanceCents = (wallet.egiftBalanceCents || 0) - (session.egiftAppliedCents || 0);
      
      await db.insert(creditTransactions).values({
        transactionId: `TXN-${nanoid(12).toUpperCase()}`,
        walletId: session.walletId,
        creditType: 'egift',
        transactionType: 'redeem',
        amountCents: -(session.egiftAppliedCents || 0),
        balanceAfterCents: updates.egiftBalanceCents,
        redemptionSessionId: sessionId,
        platform: session.platform,
        bookingId: session.bookingId,
        description: `E-gift redeemed for ${session.platform} service`,
        initiatedBy: 'system',
      });
    }

    if ((session.washPackagesApplied || 0) > 0) {
      updates.washPackageCredits = (wallet.washPackageCredits || 0) - (session.washPackagesApplied || 0);
      
      await db.insert(creditTransactions).values({
        transactionId: `TXN-${nanoid(12).toUpperCase()}`,
        walletId: session.walletId,
        creditType: 'wash_package',
        transactionType: 'redeem',
        amountUnits: -(session.washPackagesApplied || 0),
        balanceAfterUnits: updates.washPackageCredits,
        redemptionSessionId: sessionId,
        platform: session.platform,
        bookingId: session.bookingId,
        description: `Wash package redeemed at ${session.stationId || 'station'}`,
        initiatedBy: 'system',
      });
    }

    if ((session.loyaltyPointsApplied || 0) > 0) {
      // loyaltyPointsApplied is in cents, convert back to points (1 point = 10 cents)
      const pointsToDeduct = Math.ceil((session.loyaltyPointsApplied || 0) / 10);
      updates.loyaltyPointsBalance = (wallet.loyaltyPointsBalance || 0) - pointsToDeduct;
      
      await db.insert(creditTransactions).values({
        transactionId: `TXN-${nanoid(12).toUpperCase()}`,
        walletId: session.walletId,
        creditType: 'loyalty_points',
        transactionType: 'redeem',
        amountUnits: -pointsToDeduct,
        balanceAfterUnits: updates.loyaltyPointsBalance,
        redemptionSessionId: sessionId,
        platform: session.platform,
        bookingId: session.bookingId,
        description: `Loyalty points redeemed (${session.loyaltyPointsApplied} ILS value)`,
        initiatedBy: 'system',
      });
    }

    if ((session.promoAppliedCents || 0) > 0) {
      updates.promoBalanceCents = Math.max(0, (wallet.promoBalanceCents || 0) - (session.promoAppliedCents || 0));
      
      await db.insert(creditTransactions).values({
        transactionId: `TXN-${nanoid(12).toUpperCase()}`,
        walletId: session.walletId,
        creditType: 'promo_credit',
        transactionType: 'redeem',
        amountCents: -(session.promoAppliedCents || 0),
        balanceAfterCents: updates.promoBalanceCents,
        redemptionSessionId: sessionId,
        platform: session.platform,
        bookingId: session.bookingId,
        description: `Promo credit redeemed for ${session.platform} service`,
        initiatedBy: 'system',
      });
    }

    await db.update(walletAccounts)
      .set(updates)
      .where(eq(walletAccounts.walletId, session.walletId));

    await db.update(redemptionSessions)
      .set({ 
        status: 'completed', 
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(redemptionSessions.sessionId, sessionId));

    logger.info('[Wallet] Redemption confirmed', { sessionId, walletId: session.walletId });
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
}

export const walletService = new WalletService();
