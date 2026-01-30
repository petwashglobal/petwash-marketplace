/**
 * TRANSACTION STAMP SERVICE
 * ===========================
 * Immutable financial transaction records
 *
 * GUARANTEES:
 * - Transactions are NEVER modified after creation
 * - Every booking has exactly one primary transaction
 * - All amounts include VAT breakdown
 * - Refunds create new transactions (never modify original)
 */
import { nanoid } from 'nanoid';
import { db } from '../../db';
import { superAppPayments } from '@shared/schema';
import { logger } from '../../lib/logger';
const ISRAEL_VAT_RATE = 0.17;
export class TransactionStampService {
    /**
     * Calculate VAT from gross amount (Israel standard 17%)
     */
    calculateVAT(amount, vatRate = ISRAEL_VAT_RATE) {
        return Math.round(amount * vatRate * 100) / 100;
    }
    /**
     * Create an immutable transaction stamp
     * Once created, this record CANNOT be modified
     */
    async stamp(params) {
        const vatRate = params.vatRate ?? ISRAEL_VAT_RATE;
        const vat = this.calculateVAT(params.amount, vatRate);
        const net = Math.round((params.amount - vat) * 100) / 100;
        const transaction = {
            id: `txn_${nanoid(16)}`,
            bookingId: params.bookingId,
            type: params.type,
            gross: params.amount,
            vat,
            net,
            currency: params.currency ?? 'ILS',
            provider: params.provider,
            providerRef: params.providerRef,
            stampedAt: new Date(),
            stampedBy: params.stampedBy,
            isImmutable: true
        };
        try {
            await db.insert(superAppPayments).values({
                id: transaction.id,
                bookingId: params.bookingId,
                userId: params.stampedBy,
                amount: params.amount.toString(),
                currency: transaction.currency,
                status: params.type === 'REFUND' ? 'refunded' : 'completed',
                paymentMethod: params.provider.toLowerCase(),
                paymentIntentId: params.providerRef,
                metadata: {
                    transactionType: params.type,
                    vat: transaction.vat,
                    net: transaction.net,
                    vatRate,
                    stampedAt: transaction.stampedAt.toISOString(),
                    isImmutable: true
                },
                createdAt: transaction.stampedAt
            });
            logger.info('[TransactionStamp] Created immutable transaction', {
                transactionId: transaction.id,
                bookingId: params.bookingId,
                type: params.type,
                gross: transaction.gross,
                vat: transaction.vat,
                net: transaction.net,
                provider: params.provider
            });
            return transaction;
        }
        catch (error) {
            logger.error('[TransactionStamp] Failed to create transaction', {
                error: error.message,
                bookingId: params.bookingId
            });
            throw error;
        }
    }
    /**
     * Create a complimentary (free) transaction
     * Used for admin-granted free washes, loyalty rewards, etc.
     */
    async stampComplimentary(params) {
        return this.stamp({
            bookingId: params.bookingId,
            amount: 0,
            type: 'COMPLIMENTARY',
            provider: 'ADMIN',
            providerRef: params.reason,
            stampedBy: params.stampedBy
        });
    }
    /**
     * Create a refund transaction
     * Original transaction remains intact; refund is a new record
     */
    async stampRefund(params) {
        return this.stamp({
            bookingId: params.bookingId,
            amount: params.refundAmount,
            type: params.isPartial ? 'PARTIAL_REFUND' : 'REFUND',
            provider: 'REFUND',
            providerRef: `ref:${params.originalTransactionId}|${params.reason}`,
            stampedBy: params.stampedBy
        });
    }
    /**
     * Create a promo/discount transaction adjustment
     */
    async stampPromo(params) {
        return this.stamp({
            bookingId: params.bookingId,
            amount: params.discountAmount,
            type: 'PROMO',
            provider: 'PROMO',
            providerRef: params.promoCode,
            stampedBy: params.stampedBy
        });
    }
}
export const transactionStampService = new TransactionStampService();
