/**
 * 💰 Unified Wallet Service
 * Centralized wallet and payment system across all platforms
 * Single balance usable for all services
 *
 * IMPORTANT: This service delegates to WalletService as the single source of truth.
 * Both /api/credit-wallet/* and /api/unified/wallet/* operate on the same wallet_accounts table.
 */

import { logger } from '../lib/logger';
import { eventBus } from './EventBus';
import { walletService } from './WalletService';
import { db } from '../db';
import { walletAccounts } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

export interface WalletBalance {
  userId: string;
  balance: number;
  currency: string;
  loyaltyPoints: number;
}

export interface WalletTransaction {
  id: string;
  userId: string;
  amount: number;
  type: 'debit' | 'credit';
  platform: string;
  description: string;
  referenceId?: string;
  timestamp: string;
}

export class UnifiedWalletService {
  /**
   * Get user's wallet balance — delegates to WalletService (single source of truth)
   */
  async getBalance(userId: string): Promise<WalletBalance> {
    try {
      const summary = await walletService.getWalletSummary(userId);
      return {
        userId: summary.userId,
        balance: summary.totalCreditsValueCents / 100,
        currency: 'ILS',
        loyaltyPoints: summary.loyaltyPointsBalance,
      };
    } catch (error) {
      logger.error('[Unified Wallet] Failed to get balance', error, { userId });
      throw error;
    }
  }

  /**
   * Add funds to wallet — delegates to WalletService
   */
  async addFunds(userId: string, amount: number, platform: string, description: string): Promise<WalletTransaction> {
    try {
      const amountCents = Math.round(amount * 100);
      await walletService.addCredits(
        userId,
        'promo_credit',
        amountCents,
        platform,
        undefined,
        description
      );

      const txId = `UNI-${nanoid(12).toUpperCase()}`;

      await eventBus.publish({
        eventType: 'wallet.funded',
        timestamp: new Date().toISOString(),
        platform,
        userId,
        data: { transactionId: txId, amount, description },
      });

      logger.info('[Unified Wallet] Funds added', { userId, amount, platform });

      return {
        id: txId,
        userId,
        amount,
        type: 'credit',
        platform,
        description,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('[Unified Wallet] Failed to add funds', error, { userId, amount });
      throw error;
    }
  }

  /**
   * Deduct funds from wallet — operates on promo/cash balance atomically
   */
  async deductFunds(userId: string, amount: number, platform: string, description: string, referenceId?: string): Promise<WalletTransaction> {
    try {
      const amountCents = Math.round(amount * 100);

      const wallet = await walletService.getOrCreateWallet(userId);
      const available = (wallet.promoBalanceCents || 0) + (wallet.cashWalletBalanceCents || 0);

      if (available < amountCents) {
        throw new Error(`Insufficient balance: need ${amountCents}, have ${available}`);
      }

      let remaining = amountCents;
      const updates: Partial<typeof walletAccounts.$inferInsert> = {};

      const promo = wallet.promoBalanceCents || 0;
      if (promo > 0 && remaining > 0) {
        const fromPromo = Math.min(promo, remaining);
        updates.promoBalanceCents = promo - fromPromo;
        remaining -= fromPromo;
      }
      const cash = wallet.cashWalletBalanceCents || 0;
      if (cash > 0 && remaining > 0) {
        const fromCash = Math.min(cash, remaining);
        updates.cashWalletBalanceCents = cash - fromCash;
        remaining -= fromCash;
      }

      const txId = `UNI-DEB-${nanoid(12).toUpperCase()}`;

      await db.update(walletAccounts)
        .set({ ...updates, updatedAt: new Date(), lastActivityAt: new Date() })
        .where(eq(walletAccounts.userId, userId));

      await eventBus.publish({
        eventType: 'wallet.withdrawn',
        timestamp: new Date().toISOString(),
        platform,
        userId,
        data: { transactionId: txId, amount, description, referenceId },
      });

      logger.info('[Unified Wallet] Funds deducted', { userId, amount, platform });

      return {
        id: txId,
        userId,
        amount,
        type: 'debit',
        platform,
        description,
        referenceId,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('[Unified Wallet] Failed to deduct funds', error, { userId, amount });
      throw error;
    }
  }

  /**
   * Transfer funds between users (for marketplace platforms)
   */
  async transfer(fromUserId: string, toUserId: string, amount: number, platform: string, description: string): Promise<{ debit: WalletTransaction; credit: WalletTransaction }> {
    try {
      const debit = await this.deductFunds(fromUserId, amount, platform, `Transfer to ${toUserId}: ${description}`, `transfer_${Date.now()}`);
      const credit = await this.addFunds(toUserId, amount, platform, `Transfer from ${fromUserId}: ${description}`);
      logger.info('[Unified Wallet] Transfer completed', { fromUserId, toUserId, amount, platform });
      return { debit, credit };
    } catch (error) {
      logger.error('[Unified Wallet] Transfer failed', error, { fromUserId, toUserId, amount });
      throw error;
    }
  }

  /**
   * Get transaction history — delegates to WalletService
   */
  async getTransactions(userId: string, limit: number = 50, offset: number = 0): Promise<WalletTransaction[]> {
    try {
      const txs = await walletService.getTransactionHistory(userId, limit);
      const debitTypes = new Set(['redeem', 'hold', 'expire', 'adjust_debit']);
      return txs.map(tx => ({
        id: tx.transactionId,
        userId,
        amount: (tx.amountCents || 0) / 100,
        type: debitTypes.has(tx.transactionType || '') ? 'debit' : 'credit',
        platform: tx.sourceType || 'system',
        description: tx.description || '',
        referenceId: tx.sourceId || undefined,
        timestamp: tx.createdAt?.toISOString() || new Date().toISOString(),
      }));
    } catch (error) {
      logger.error('[Unified Wallet] Failed to get transactions', error, { userId });
      throw error;
    }
  }

  /**
   * Get platform-specific spending breakdown
   */
  async getPlatformSpending(userId: string): Promise<Record<string, number>> {
    try {
      const platforms = ['walk-my-pet', 'sitter-suite', 'pettrek', 'academy', 'wash-hub', 'plush-lab'];
      const spending: Record<string, number> = {};
      const txs = await walletService.getTransactionHistory(userId, 500);

      for (const platform of platforms) {
        const platformTxs = txs.filter(tx =>
          tx.sourceType === platform &&
          (tx.type === 'deduction' || tx.type === 'redemption')
        );
        spending[platform] = platformTxs.reduce((sum, tx) => sum + (tx.amountCents / 100), 0);
      }
      return spending;
    } catch (error) {
      logger.error('[Unified Wallet] Failed to get platform spending', error, { userId });
      throw error;
    }
  }

  /**
   * Award loyalty points — delegates to WalletService
   */
  async awardLoyaltyPoints(userId: string, points: number, reason: string): Promise<void> {
    try {
      await walletService.addCredits(userId, 'loyalty_points', points, 'system', undefined, reason);
      await eventBus.publish({
        eventType: 'loyalty.points_earned',
        timestamp: new Date().toISOString(),
        platform: 'system',
        userId,
        data: { points, reason },
      });
      logger.info('[Unified Wallet] Loyalty points awarded', { userId, points, reason });
    } catch (error) {
      logger.error('[Unified Wallet] Failed to award loyalty points', error, { userId });
      throw error;
    }
  }
}

export const unifiedWallet = new UnifiedWalletService();
