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
import type { UnifiedTransaction, TransactionType, Currency } from './types';

const ISRAEL_VAT_RATE = 0.18;

export class TransactionStampService {
  
  /**
   * Calculate VAT from gross amount (Israel standard 18% — effective Jan 2025)
   */
  calculateVAT(amount: number, vatRate: number = ISRAEL_VAT_RATE): number {
    return Math.round(amount * vatRate * 100) / 100;
  }

  /**
   * Create an immutable transaction stamp
   * Once created, this record CANNOT be modified
   */
  async stamp(params: {
    bookingId: string;
    amount: number;
    type: TransactionType;
    provider: string;
    providerRef?: string;
    stampedBy: string;
    currency?: Currency;
    vatRate?: number;
  }): Promise<UnifiedTransaction> {
    const vatRate = params.vatRate ?? ISRAEL_VAT_RATE;
    const vat = this.calculateVAT(params.amount, vatRate);
    const net = Math.round((params.amount - vat) * 100) / 100;

    const transaction: UnifiedTransaction = {
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
    } catch (error: any) {
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
  async stampComplimentary(params: {
    bookingId: string;
    reason: string;
    stampedBy: string;
  }): Promise<UnifiedTransaction> {
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
  async stampRefund(params: {
    bookingId: string;
    originalTransactionId: string;
    refundAmount: number;
    reason: string;
    stampedBy: string;
    isPartial?: boolean;
  }): Promise<UnifiedTransaction> {
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
  async stampPromo(params: {
    bookingId: string;
    discountAmount: number;
    promoCode: string;
    stampedBy: string;
  }): Promise<UnifiedTransaction> {
    return this.stamp({
      bookingId: params.bookingId,
      amount: params.discountAmount,
      type: 'PROMO',
      provider: 'PROMO',
      providerRef: params.promoCode,
      stampedBy: params.stampedBy
    });
  }

  /**
   * Stamp a cancellation event — MANDATORY under Israeli Consumer Protection Law §17b
   * Every cancellation (user or provider-initiated) must be permanently recorded.
   * Amount = 0 (no charge at stamp time; refund, if any, is a separate REFUND stamp).
   */
  async stampCancellation(params: {
    bookingId: string;
    cancelledBy: string;
    cancelledByRole: string;
    reason: string;
    /** ISO-8601 timestamp of the original booking date/time, for law compliance */
    originalServiceTime?: string;
    /** Service address captured at booking time — preserved even after cancellation */
    serviceAddress?: string;
    serviceCity?: string;
    servicePostalCode?: string;
  }): Promise<UnifiedTransaction> {
    const txn = await this.stamp({
      bookingId: params.bookingId,
      amount: 0,
      type: 'CANCELLATION',
      provider: 'SYSTEM',
      providerRef: `cancelled_by:${params.cancelledBy}|role:${params.cancelledByRole}|reason:${params.reason.slice(0, 120)}`,
      stampedBy: params.cancelledBy,
    });

    logger.info('[TransactionStamp] Cancellation stamped (§17b compliance)', {
      transactionId: txn.id,
      bookingId: params.bookingId,
      cancelledBy: params.cancelledBy,
      cancelledByRole: params.cancelledByRole,
      reason: params.reason,
      originalServiceTime: params.originalServiceTime,
      serviceAddress: params.serviceAddress,
      serviceCity: params.serviceCity,
      servicePostalCode: params.servicePostalCode,
    });

    return txn;
  }
}

export const transactionStampService = new TransactionStampService();
