/**
 * 💰 Unified Wallet Service
 * Centralized wallet and payment system across all platforms
 * Single balance usable for all services
 */

import { logger } from '../lib/logger';
import { eventBus } from './EventBus';
import { walletRepository } from '../repositories/WalletRepository';

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
   * Get user's wallet balance across all platforms
   */
  async getBalance(userId: string): Promise<WalletBalance> {
    try {
      let walletBalance = await walletRepository.getBalance(userId);
      
      // Create wallet if doesn't exist
      if (!walletBalance) {
        walletBalance = await walletRepository.createBalance(userId);
      }

      const balance: WalletBalance = {
        userId: walletBalance.userId,
        balance: parseFloat(walletBalance.balance),
        currency: walletBalance.currency,
        loyaltyPoints: walletBalance.loyaltyPoints
      };

      logger.info('[Unified Wallet] Retrieved balance', { userId, balance: balance.balance });
      return balance;
    } catch (error) {
      logger.error('[Unified Wallet] Failed to get balance', { error, userId });
      throw error;
    }
  }

  /**
   * Add funds to wallet
   */
  async addFunds(userId: string, amount: number, platform: string, description: string): Promise<WalletTransaction> {
    try {
      // Ensure wallet exists
      await this.getBalance(userId);

      // Update balance and record transaction atomically
      const result = await walletRepository.updateBalanceAndRecordTransaction(
        userId,
        amount.toFixed(2),
        'credit',
        platform,
        description
      );

      const newBalance = parseFloat(result.balance.balance);

      // Publish event
      await eventBus.publish({
        eventType: 'wallet.funded',
        timestamp: new Date().toISOString(),
        platform,
        userId,
        data: {
          transactionId: result.transaction.id,
          amount,
          description,
          newBalance
        }
      });

      logger.info('[Unified Wallet] Funds added', { userId, amount, platform, newBalance });
      
      return {
        id: result.transaction.id,
        userId: result.transaction.userId,
        amount: parseFloat(result.transaction.amount),
        type: 'credit',
        platform: result.transaction.platform,
        description: result.transaction.description,
        timestamp: result.transaction.createdAt.toISOString()
      };
    } catch (error) {
      logger.error('[Unified Wallet] Failed to add funds', { error, userId, amount });
      throw error;
    }
  }

  /**
   * Deduct funds from wallet
   */
  async deductFunds(userId: string, amount: number, platform: string, description: string, referenceId?: string): Promise<WalletTransaction> {
    try {
      // Update balance and record transaction atomically (includes balance check)
      const result = await walletRepository.updateBalanceAndRecordTransaction(
        userId,
        amount.toFixed(2),
        'debit',
        platform,
        description,
        referenceId
      );

      const newBalance = parseFloat(result.balance.balance);

      // Publish event
      await eventBus.publish({
        eventType: 'wallet.withdrawn',
        timestamp: new Date().toISOString(),
        platform,
        userId,
        data: {
          transactionId: result.transaction.id,
          amount,
          description,
          referenceId,
          newBalance
        }
      });

      logger.info('[Unified Wallet] Funds deducted', { userId, amount, platform, newBalance });
      
      return {
        id: result.transaction.id,
        userId: result.transaction.userId,
        amount: parseFloat(result.transaction.amount),
        type: 'debit',
        platform: result.transaction.platform,
        description: result.transaction.description,
        referenceId: result.transaction.referenceId || undefined,
        timestamp: result.transaction.createdAt.toISOString()
      };
    } catch (error) {
      logger.error('[Unified Wallet] Failed to deduct funds', { error, userId, amount });
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
      logger.error('[Unified Wallet] Transfer failed', { error, fromUserId, toUserId, amount });
      throw error;
    }
  }

  /**
   * Get transaction history
   */
  async getTransactions(userId: string, limit: number = 50, offset: number = 0): Promise<WalletTransaction[]> {
    try {
      const transactions = await walletRepository.getTransactionHistory(userId, { limit, offset });
      
      return transactions.map(tx => ({
        id: tx.id,
        userId: tx.userId,
        amount: parseFloat(tx.amount),
        type: tx.type as 'debit' | 'credit',
        platform: tx.platform,
        description: tx.description,
        referenceId: tx.referenceId || undefined,
        timestamp: tx.createdAt.toISOString()
      }));
    } catch (error) {
      logger.error('[Unified Wallet] Failed to get transactions', { error, userId });
      throw error;
    }
  }

  /**
   * Get platform-specific spending
   */
  async getPlatformSpending(userId: string): Promise<Record<string, number>> {
    try {
      const platforms = ['walk-my-pet', 'sitter-suite', 'pettrek', 'academy', 'wash-hub', 'plush-lab'];
      const spending: Record<string, number> = {};

      for (const platform of platforms) {
        const total = await walletRepository.getTotalSpending(userId, platform);
        spending[platform] = parseFloat(total);
      }

      return spending;
    } catch (error) {
      logger.error('[Unified Wallet] Failed to get platform spending', { error, userId });
      throw error;
    }
  }

  /**
   * Award loyalty points
   */
  async awardLoyaltyPoints(userId: string, points: number, reason: string): Promise<void> {
    try {
      // Ensure wallet exists
      await this.getBalance(userId);

      // Update loyalty points atomically
      const updated = await walletRepository.updateLoyaltyPoints(userId, points);
      const newPoints = updated.loyaltyPoints;

      await eventBus.publish({
        eventType: 'loyalty.points_earned',
        timestamp: new Date().toISOString(),
        platform: 'system',
        userId,
        data: { points, reason, newTotal: newPoints }
      });

      logger.info('[Unified Wallet] Loyalty points awarded', { userId, points, reason, newTotal: newPoints });
    } catch (error) {
      logger.error('[Unified Wallet] Failed to award loyalty points', { error, userId });
      throw error;
    }
  }
}

// Singleton instance
export const unifiedWallet = new UnifiedWalletService();
