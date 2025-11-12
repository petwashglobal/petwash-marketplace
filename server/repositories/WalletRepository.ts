import { db } from '../db';
import { walletBalances, walletTransactions } from '../../shared/schema-unified-platform';
import { eq, desc, and, gte, lte, sql } from 'drizzle-orm';

export interface WalletBalance {
  id: string;
  userId: string;
  balance: string;
  currency: string;
  loyaltyPoints: number;
  lastUpdated: Date;
}

export interface WalletTransaction {
  id: string;
  userId: string;
  amount: string;
  currency: string;
  type: string;
  platform: string;
  description: string;
  referenceId: string | null;
  balanceAfter: string;
  metadata: any;
  createdAt: Date;
}

export class WalletRepository {
  async getBalance(userId: string): Promise<WalletBalance | null> {
    const result = await db.select().from(walletBalances).where(eq(walletBalances.userId, userId)).limit(1);
    return result[0] || null;
  }

  async createBalance(userId: string, currency: string = 'ILS'): Promise<WalletBalance> {
    const result = await db.insert(walletBalances).values({
      userId,
      balance: '0.00',
      currency,
      loyaltyPoints: 0,
    }).returning();
    return result[0];
  }

  async updateBalance(userId: string, newBalance: string, loyaltyPoints?: number): Promise<WalletBalance> {
    const updateData: any = {
      balance: newBalance,
      lastUpdated: new Date(),
    };
    if (loyaltyPoints !== undefined) {
      updateData.loyaltyPoints = loyaltyPoints;
    }
    
    const result = await db.update(walletBalances)
      .set(updateData)
      .where(eq(walletBalances.userId, userId))
      .returning();
    return result[0];
  }

  async recordTransaction(transaction: {
    userId: string;
    amount: string;
    type: string;
    platform: string;
    description: string;
    referenceId?: string;
    balanceAfter: string;
    metadata?: any;
  }): Promise<WalletTransaction> {
    const result = await db.insert(walletTransactions).values({
      userId: transaction.userId,
      amount: transaction.amount,
      currency: 'ILS',
      type: transaction.type,
      platform: transaction.platform,
      description: transaction.description,
      referenceId: transaction.referenceId || null,
      balanceAfter: transaction.balanceAfter,
      metadata: transaction.metadata || null,
    }).returning();
    return result[0];
  }

  async getTransactionHistory(
    userId: string,
    options: {
      limit?: number;
      offset?: number;
      startDate?: Date;
      endDate?: Date;
      platform?: string;
    } = {}
  ): Promise<WalletTransaction[]> {
    const { limit = 50, offset = 0, startDate, endDate, platform } = options;
    
    let query = db.select().from(walletTransactions).where(eq(walletTransactions.userId, userId));
    
    const conditions: any[] = [eq(walletTransactions.userId, userId)];
    if (startDate) conditions.push(gte(walletTransactions.createdAt, startDate));
    if (endDate) conditions.push(lte(walletTransactions.createdAt, endDate));
    if (platform) conditions.push(eq(walletTransactions.platform, platform));
    
    return await db.select()
      .from(walletTransactions)
      .where(and(...conditions))
      .orderBy(desc(walletTransactions.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async getTotalSpending(userId: string, platform?: string): Promise<string> {
    const conditions: any[] = [
      eq(walletTransactions.userId, userId),
      eq(walletTransactions.type, 'debit')
    ];
    if (platform) conditions.push(eq(walletTransactions.platform, platform));
    
    const result = await db.select({
      total: sql<string>`COALESCE(SUM(CAST(${walletTransactions.amount} AS DECIMAL)), 0)::text`
    }).from(walletTransactions).where(and(...conditions));
    
    return result[0]?.total || '0';
  }

  async getTransactionCount(userId: string): Promise<number> {
    const result = await db.select({
      count: sql<number>`COUNT(*)::int`
    }).from(walletTransactions).where(eq(walletTransactions.userId, userId));
    
    return result[0]?.count || 0;
  }

  /**
   * Update balance and record transaction atomically with row-level lock
   */
  async updateBalanceAndRecordTransaction(
    userId: string,
    amountChange: string,
    type: 'debit' | 'credit',
    platform: string,
    description: string,
    referenceId?: string,
    metadata?: any
  ): Promise<{ balance: WalletBalance; transaction: WalletTransaction }> {
    return await db.transaction(async (tx) => {
      // Lock the balance row for update to prevent race conditions
      const balanceRows = await tx.select()
        .from(walletBalances)
        .where(eq(walletBalances.userId, userId))
        .for('update');
      
      if (balanceRows.length === 0) {
        throw new Error('Wallet balance not found');
      }

      const currentBalance = parseFloat(balanceRows[0].balance);
      const change = parseFloat(amountChange);
      const newBalance = type === 'credit' ? currentBalance + change : currentBalance - change;

      // Validate balance (prevent negative balance for debits)
      if (type === 'debit' && newBalance < 0) {
        throw new Error('Insufficient balance');
      }

      // Update balance
      const updatedBalance = await tx.update(walletBalances)
        .set({ 
          balance: newBalance.toFixed(2),
          lastUpdated: new Date()
        })
        .where(eq(walletBalances.userId, userId))
        .returning();

      // Record transaction
      const transaction = await tx.insert(walletTransactions)
        .values({
          userId,
          amount: amountChange,
          currency: 'ILS',
          type,
          platform,
          description,
          referenceId: referenceId || null,
          balanceAfter: newBalance.toFixed(2),
          metadata: metadata || null
        })
        .returning();

      return {
        balance: updatedBalance[0],
        transaction: transaction[0]
      };
    });
  }

  /**
   * Update loyalty points atomically
   */
  async updateLoyaltyPoints(userId: string, pointsChange: number): Promise<WalletBalance> {
    return await db.transaction(async (tx) => {
      // Lock the balance row
      const balanceRows = await tx.select()
        .from(walletBalances)
        .where(eq(walletBalances.userId, userId))
        .for('update');
      
      if (balanceRows.length === 0) {
        throw new Error('Wallet balance not found');
      }

      const newPoints = balanceRows[0].loyaltyPoints + pointsChange;

      if (newPoints < 0) {
        throw new Error('Insufficient loyalty points');
      }

      const updated = await tx.update(walletBalances)
        .set({ 
          loyaltyPoints: newPoints,
          lastUpdated: new Date()
        })
        .where(eq(walletBalances.userId, userId))
        .returning();

      return updated[0];
    });
  }
}

export const walletRepository = new WalletRepository();
