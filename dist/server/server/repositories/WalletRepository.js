import { db } from '../db';
import { walletBalances, walletTransactions } from '../../shared/schema-unified-platform';
import { eq, desc, and, gte, lte, sql } from 'drizzle-orm';
export class WalletRepository {
    async getBalance(userId) {
        const result = await db.select().from(walletBalances).where(eq(walletBalances.userId, userId)).limit(1);
        return result[0] || null;
    }
    async createBalance(userId, currency = 'ILS') {
        const result = await db.insert(walletBalances).values({
            userId,
            balance: '0.00',
            currency,
            loyaltyPoints: 0,
        }).returning();
        return result[0];
    }
    async updateBalance(userId, newBalance, loyaltyPoints) {
        const updateData = {
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
    async recordTransaction(transaction) {
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
    async getTransactionHistory(userId, options = {}) {
        const { limit = 50, offset = 0, startDate, endDate, platform } = options;
        let query = db.select().from(walletTransactions).where(eq(walletTransactions.userId, userId));
        const conditions = [eq(walletTransactions.userId, userId)];
        if (startDate)
            conditions.push(gte(walletTransactions.createdAt, startDate));
        if (endDate)
            conditions.push(lte(walletTransactions.createdAt, endDate));
        if (platform)
            conditions.push(eq(walletTransactions.platform, platform));
        return await db.select()
            .from(walletTransactions)
            .where(and(...conditions))
            .orderBy(desc(walletTransactions.createdAt))
            .limit(limit)
            .offset(offset);
    }
    async getTotalSpending(userId, platform) {
        const conditions = [
            eq(walletTransactions.userId, userId),
            eq(walletTransactions.type, 'debit')
        ];
        if (platform)
            conditions.push(eq(walletTransactions.platform, platform));
        const result = await db.select({
            total: sql `COALESCE(SUM(CAST(${walletTransactions.amount} AS DECIMAL)), 0)::text`
        }).from(walletTransactions).where(and(...conditions));
        return result[0]?.total || '0';
    }
    async getTransactionCount(userId) {
        const result = await db.select({
            count: sql `COUNT(*)::int`
        }).from(walletTransactions).where(eq(walletTransactions.userId, userId));
        return result[0]?.count || 0;
    }
    /**
     * Update balance and record transaction atomically with row-level lock
     */
    async updateBalanceAndRecordTransaction(userId, amountChange, type, platform, description, referenceId, metadata) {
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
    async updateLoyaltyPoints(userId, pointsChange) {
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
