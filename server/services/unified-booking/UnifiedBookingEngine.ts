/**
 * PETWASH UNIFIED BOOKING ENGINE
 * ================================
 * One booking engine for all PetWash services
 * 
 * GUARANTEES:
 * - Every wash, paid or free, has a Booking
 * - Every Booking has exactly one primary Transaction
 * - Transactions are immutable
 * - Admin actions are logged as Events
 * - HR and Finance rely on the same data
 * - Human and Machine are both Resources
 * - Frontend never bypasses backend truth
 * 
 * This is the PetWash spine.
 */

import { nanoid } from 'nanoid';
import { db } from '../../db';
import { bookings, type InsertBooking } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { logger } from '../../lib/logger';
import { transactionStampService } from './TransactionStampService';
import { eventLogService } from './EventLogService';
import type {
  UnifiedBooking,
  UnifiedBookingStatus,
  PricingSnapshot,
  CreateBookingParams,
  QuoteParams,
  ConfirmParams,
  AdminFreeWashParams,
  SERVICE_CONFIGS,
  Role,
  Currency,
  CreditBreakdown,
  CompletionReceiptData
} from './types';

const ISRAEL_VAT_RATE = 0.18;

/**
 * Generate unique booking number: PWB-YYYYMMDD-XXXXXX
 */
function generateBookingNumber(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const unique = nanoid(6).toUpperCase();
  return `PWB-${dateStr}-${unique}`;
}

/**
 * Calculate VAT from gross amount
 */
function calculateVAT(amount: number, rate: number = ISRAEL_VAT_RATE): number {
  return Math.round(amount * rate * 100) / 100;
}

export class UnifiedBookingEngine {
  
  /**
   * STEP 1: Create Draft
   * ====================
   * Creates a booking in DRAFT status with no payment
   */
  async createDraft(params: CreateBookingParams): Promise<UnifiedBooking> {
    const bookingId = `bkg_${nanoid(16)}`;
    const bookingNumber = generateBookingNumber();

    const booking: UnifiedBooking = {
      id: bookingId,
      bookingNumber,
      platform: 'PETWASH',
      serviceId: params.serviceId,
      resourceId: params.resourceId,
      resourceType: params.resourceType,
      userId: params.userId,
      startTime: params.startTime,
      endTime: params.endTime,
      status: 'DRAFT',
      priceSnapshot: {
        gross: 0,
        vat: 0,
        net: 0,
        currency: 'ILS',
        vatRate: ISRAEL_VAT_RATE,
        breakdown: {}
      },
      metadata: params.metadata,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    try {
      const dbBooking: InsertBooking = {
        id: booking.id,
        bookingNumber: booking.bookingNumber,
        platformId: params.serviceId.split('_')[0].toLowerCase() || 'shared_services',
        userId: params.userId,
        startTime: params.startTime,
        endTime: params.endTime,
        status: 'draft',
        subtotal: '0',
        total: '0',
        currency: 'ILS',
        serviceType: params.serviceId,
        platformData: {
          resourceId: params.resourceId,
          resourceType: params.resourceType,
          unifiedEngine: true,
          ...params.metadata
        }
      };

      await db.insert(bookings).values(dbBooking);

      await eventLogService.logBookingCreated({
        bookingId: booking.id,
        userId: params.userId,
        userRole: 'USER',
        serviceId: params.serviceId,
        resourceId: params.resourceId
      });

      logger.info('[UnifiedBooking] Draft created', {
        bookingId: booking.id,
        bookingNumber: booking.bookingNumber,
        serviceId: params.serviceId
      });

      return booking;
    } catch (error: any) {
      logger.error('[UnifiedBooking] Failed to create draft', {
        error: error.message,
        params
      });
      throw error;
    }
  }

  /**
   * STEP 2: Quote
   * =============
   * Calculate and attach price to booking
   * Status changes to QUOTED
   */
  async quote(params: QuoteParams): Promise<UnifiedBooking> {
    const { booking, price, breakdown, loyaltyDiscount, promoCode } = params;
    
    const vat = calculateVAT(price);
    const net = Math.round((price - vat) * 100) / 100;
    const platformFee = Math.round(price * 0.15 * 100) / 100;
    const providerPayout = Math.round((price - platformFee) * 100) / 100;

    booking.priceSnapshot = {
      gross: price,
      vat,
      net,
      currency: 'ILS',
      vatRate: ISRAEL_VAT_RATE,
      breakdown: breakdown || { base: price },
      loyaltyDiscount: loyaltyDiscount || 0,
      promoDiscount: promoCode ? price * 0.1 : 0,
      platformFee,
      providerPayout
    };

    booking.status = 'QUOTED';
    booking.updatedAt = new Date();

    try {
      await db.update(bookings)
        .set({
          status: 'quoted',
          subtotal: price.toString(),
          total: price.toString(),
          platformFee: platformFee.toString(),
          providerPayout: providerPayout.toString(),
          discount: (loyaltyDiscount || 0).toString(),
          platformData: {
            ...(booking.metadata || {}),
            priceSnapshot: booking.priceSnapshot,
            quotedAt: new Date().toISOString()
          },
          updatedAt: new Date()
        })
        .where(eq(bookings.id, booking.id));

      await eventLogService.logStatusChange({
        bookingId: booking.id,
        previousStatus: 'DRAFT',
        newStatus: 'QUOTED',
        changedBy: booking.userId,
        changedByRole: 'USER',
        reason: 'Price quoted'
      });

      logger.info('[UnifiedBooking] Quoted', {
        bookingId: booking.id,
        gross: price,
        vat,
        net
      });

      return booking;
    } catch (error: any) {
      logger.error('[UnifiedBooking] Failed to quote', {
        error: error.message,
        bookingId: booking.id
      });
      throw error;
    }
  }

  /**
   * STEP 3: Confirm
   * ===============
   * Record payment and confirm booking
   * Creates immutable transaction record
   */
  async confirm(params: ConfirmParams): Promise<{
    booking: UnifiedBooking;
    transactionId: string;
    creditBreakdown?: CreditBreakdown;
  }> {
    const { booking, paymentProvider, paymentReference, confirmedBy, creditBreakdown, redemptionSessionId } = params;

    try {
      const grossAmount = booking.priceSnapshot.gross;
      const hasCreditPayment = creditBreakdown && creditBreakdown.totalCreditsAppliedCents > 0;
      const cashPaidCents = creditBreakdown?.cashPaidCents ?? Math.round(grossAmount * 100);
      const creditsAppliedCents = creditBreakdown?.totalCreditsAppliedCents ?? 0;

      let transactionType: 'PAID' | 'COMPLIMENTARY' | 'PROMO' = 'PAID';
      if (grossAmount === 0) {
        transactionType = 'COMPLIMENTARY';
      } else if (hasCreditPayment && cashPaidCents === 0) {
        transactionType = 'PROMO';
      }

      const effectiveProvider = hasCreditPayment && cashPaidCents === 0 ? 'WALLET_CREDITS' : paymentProvider;

      const transaction = await transactionStampService.stamp({
        bookingId: booking.id,
        amount: grossAmount,
        type: transactionType,
        provider: effectiveProvider,
        providerRef: paymentReference,
        stampedBy: confirmedBy,
        vatRate: booking.priceSnapshot.vatRate,
      });

      booking.status = 'CONFIRMED';
      booking.updatedAt = new Date();

      const paymentMetadata: Record<string, any> = {
        ...(booking.metadata || {}),
        priceSnapshot: booking.priceSnapshot,
        transactionId: transaction.id,
        confirmedAt: new Date().toISOString(),
      };

      if (hasCreditPayment) {
        paymentMetadata.creditBreakdown = {
          egiftCents: creditBreakdown!.egiftCents,
          washPackages: creditBreakdown!.washPackages,
          loyaltyPointsCents: creditBreakdown!.loyaltyPointsCents,
          promoCents: creditBreakdown!.promoCents,
          referralCents: creditBreakdown!.referralCents,
          totalCreditsAppliedCents: creditsAppliedCents,
          cashPaidCents,
          redemptionSessionId: redemptionSessionId || creditBreakdown!.redemptionSessionId,
        };
        paymentMetadata.paymentSplit = {
          creditsILS: (creditsAppliedCents / 100).toFixed(2),
          cashILS: (cashPaidCents / 100).toFixed(2),
          totalILS: grossAmount.toFixed(2),
        };
      }

      await db.update(bookings)
        .set({
          status: 'confirmed',
          paymentStatus: 'paid',
          paymentMethod: hasCreditPayment 
            ? (cashPaidCents > 0 ? `${effectiveProvider.toLowerCase()}+wallet` : 'wallet_credits')
            : paymentProvider.toLowerCase(),
          paymentIntentId: paymentReference,
          confirmedAt: new Date(),
          platformData: paymentMetadata,
          updatedAt: new Date()
        })
        .where(eq(bookings.id, booking.id));

      await eventLogService.logStatusChange({
        bookingId: booking.id,
        previousStatus: 'QUOTED',
        newStatus: 'CONFIRMED',
        changedBy: confirmedBy,
        changedByRole: 'USER',
        reason: hasCreditPayment
          ? `Payment confirmed: ₪${(creditsAppliedCents / 100).toFixed(2)} credits + ₪${(cashPaidCents / 100).toFixed(2)} cash`
          : 'Payment confirmed'
      });

      await eventLogService.logPaymentReceived({
        bookingId: booking.id,
        transactionId: transaction.id,
        userId: confirmedBy,
        amount: grossAmount,
        provider: effectiveProvider
      });

      if (hasCreditPayment) {
        await eventLogService.log({
          actorId: confirmedBy,
          actorRole: 'USER',
          action: 'CREDIT_APPLIED',
          bookingId: booking.id,
          transactionId: transaction.id,
          description: `Credits applied: e-gift ₪${(creditBreakdown!.egiftCents / 100).toFixed(2)}, wash packages ${creditBreakdown!.washPackages}, loyalty ₪${(creditBreakdown!.loyaltyPointsCents / 100).toFixed(2)}, promo ₪${(creditBreakdown!.promoCents / 100).toFixed(2)}`,
          meta: { creditBreakdown, redemptionSessionId },
        });
      }

      logger.info('[UnifiedBooking] Confirmed', {
        bookingId: booking.id,
        transactionId: transaction.id,
        amount: grossAmount,
        creditBreakdown: hasCreditPayment ? {
          creditsApplied: (creditsAppliedCents / 100).toFixed(2),
          cashPaid: (cashPaidCents / 100).toFixed(2),
        } : undefined,
      });

      return { booking, transactionId: transaction.id, creditBreakdown };
    } catch (error: any) {
      logger.error('[UnifiedBooking] Failed to confirm', {
        error: error.message,
        bookingId: booking.id
      });
      throw error;
    }
  }

  /**
   * STEP 4: Start
   * =============
   * Mark booking as in progress (service started)
   */
  async start(booking: UnifiedBooking, startedBy: string): Promise<UnifiedBooking> {
    booking.status = 'IN_PROGRESS';
    booking.updatedAt = new Date();

    try {
      await db.update(bookings)
        .set({
          status: 'in_progress',
          startedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(bookings.id, booking.id));

      await eventLogService.logStatusChange({
        bookingId: booking.id,
        previousStatus: 'CONFIRMED',
        newStatus: 'IN_PROGRESS',
        changedBy: startedBy,
        changedByRole: 'PROVIDER',
        reason: 'Service started'
      });

      logger.info('[UnifiedBooking] Started', { bookingId: booking.id });

      return booking;
    } catch (error: any) {
      logger.error('[UnifiedBooking] Failed to start', {
        error: error.message,
        bookingId: booking.id
      });
      throw error;
    }
  }

  /**
   * STEP 5: Complete
   * ================
   * Mark booking as completed
   */
  async complete(
    booking: UnifiedBooking, 
    completedBy: string,
    receiptData?: CompletionReceiptData
  ): Promise<{
    booking: UnifiedBooking;
    receiptNumber?: string;
    receiptId?: number;
    reconciliationId?: string;
  }> {
    booking.status = 'COMPLETED';
    booking.updatedAt = new Date();

    try {
      await db.update(bookings)
        .set({
          status: 'completed',
          completedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(bookings.id, booking.id));

      await eventLogService.logStatusChange({
        bookingId: booking.id,
        previousStatus: 'IN_PROGRESS',
        newStatus: 'COMPLETED',
        changedBy: completedBy,
        changedByRole: 'PROVIDER',
        reason: 'Service completed'
      });

      let receiptNumber: string | undefined;
      let receiptId: number | undefined;
      let reconciliationId: string | undefined;

      if (receiptData && booking.priceSnapshot.gross > 0) {
        try {
          const { IsraeliDigitalReceiptService } = await import('../IsraeliDigitalReceiptService');
          
          const platformData = booking.metadata || {};
          const creditBreakdown = platformData.creditBreakdown;
          const paymentMethod = creditBreakdown
            ? (creditBreakdown.cashPaidCents > 0 ? 'nayax+wallet' : 'wallet_credits')
            : 'nayax';

          const receiptResult = await IsraeliDigitalReceiptService.generateReceipt({
            platform: booking.serviceId.split('_')[0] || booking.platform,
            bookingId: booking.id,
            nayaxTransactionId: platformData.transactionId,
            customerEmail: receiptData.customerEmail,
            customerName: receiptData.customerName,
            customerPhone: receiptData.customerPhone,
            providerName: receiptData.providerName,
            providerId: receiptData.providerId,
            serviceDescription: receiptData.serviceDescription,
            serviceDescriptionHe: receiptData.serviceDescriptionHe,
            subtotalAmount: booking.priceSnapshot.net,
            platformFeeAmount: booking.priceSnapshot.platformFee || 0,
            totalAmount: booking.priceSnapshot.gross,
            paymentMethod,
            providerPayoutAmount: booking.priceSnapshot.providerPayout,
            brokerCommissionAmount: booking.priceSnapshot.platformFee,
          });

          if (receiptResult.success) {
            receiptNumber = receiptResult.receiptNumber;
            receiptId = receiptResult.receiptId;

            await db.update(bookings)
              .set({
                platformData: {
                  ...platformData,
                  receiptNumber,
                  receiptId,
                  receiptGeneratedAt: new Date().toISOString(),
                }
              })
              .where(eq(bookings.id, booking.id));

            await eventLogService.log({
              actorId: 'system',
              actorRole: 'ADMIN',
              action: 'RECEIPT_GENERATED',
              bookingId: booking.id,
              description: `Israeli digital receipt ${receiptNumber} generated for booking ${booking.bookingNumber}`,
              meta: {
                receiptNumber,
                receiptId,
                totalAmount: booking.priceSnapshot.gross,
                vatAmount: booking.priceSnapshot.vat,
                creditBreakdown: creditBreakdown || null,
              },
            });

            logger.info('[UnifiedBooking] Receipt generated on completion', {
              bookingId: booking.id,
              receiptNumber,
              totalAmount: booking.priceSnapshot.gross,
            });
          } else {
            logger.warn('[UnifiedBooking] Receipt generation failed but booking completed', {
              bookingId: booking.id,
              error: receiptResult.error,
            });
          }
        } catch (receiptError: any) {
          logger.error('[UnifiedBooking] Receipt generation error (non-blocking)', {
            bookingId: booking.id,
            error: receiptError.message,
          });
        }
      }

      logger.info('[UnifiedBooking] Completed', { 
        bookingId: booking.id,
        receiptNumber,
      });

      return { booking, receiptNumber, receiptId, reconciliationId };
    } catch (error: any) {
      logger.error('[UnifiedBooking] Failed to complete', {
        error: error.message,
        bookingId: booking.id
      });
      throw error;
    }
  }

  /**
   * STEP 6: Cancel
   * ==============
   * Cancel booking with reason
   */
  async cancel(
    booking: UnifiedBooking, 
    cancelledBy: string, 
    cancelledByRole: Role,
    reason: string
  ): Promise<UnifiedBooking> {
    const previousStatus = booking.status;
    booking.status = 'CANCELLED';
    booking.updatedAt = new Date();

    try {
      await db.update(bookings)
        .set({
          status: 'cancelled',
          cancelledBy,
          cancelledAt: new Date(),
          cancellationReason: reason,
          updatedAt: new Date()
        })
        .where(eq(bookings.id, booking.id));

      await eventLogService.logStatusChange({
        bookingId: booking.id,
        previousStatus,
        newStatus: 'CANCELLED',
        changedBy: cancelledBy,
        changedByRole: cancelledByRole,
        reason
      });

      // ── §17b MANDATORY CANCELLATION STAMP ─────────────────────────────────
      // Israeli Consumer Protection Law requires every cancellation to be
      // permanently recorded in the immutable transaction ledger, even when
      // no money changes hands.  The stamp preserves: who cancelled, when,
      // why, and the full service address captured at booking time.
      const platformData = (booking as any).platformData as Record<string, any> | undefined;
      await transactionStampService.stampCancellation({
        bookingId: booking.id,
        cancelledBy,
        cancelledByRole,
        reason,
        originalServiceTime: booking.startTime?.toISOString?.() ?? undefined,
        serviceAddress:    platformData?.serviceAddress    ?? platformData?.address    ?? undefined,
        serviceCity:       platformData?.serviceCity       ?? platformData?.city       ?? undefined,
        servicePostalCode: platformData?.servicePostalCode ?? platformData?.postalCode ?? undefined,
      });

      logger.info('[UnifiedBooking] Cancelled + stamped (§17b)', {
        bookingId: booking.id,
        cancelledBy,
        cancelledByRole,
        reason,
      });

      return booking;
    } catch (error: any) {
      logger.error('[UnifiedBooking] Failed to cancel', {
        error: error.message,
        bookingId: booking.id
      });
      throw error;
    }
  }

  /**
   * STEP 7: Refund
   * ==============
   * Process refund (creates new transaction, doesn't modify original)
   */
  async refund(
    booking: UnifiedBooking,
    refundAmount: number,
    processedBy: string,
    processedByRole: Role,
    reason: string,
    isPartial: boolean = false
  ): Promise<{ booking: UnifiedBooking; refundTransactionId: string }> {
    try {
      const refundTransaction = await transactionStampService.stampRefund({
        bookingId: booking.id,
        originalTransactionId: booking.metadata?.transactionId || 'unknown',
        refundAmount,
        reason,
        stampedBy: processedBy,
        isPartial
      });

      booking.status = 'REFUNDED';
      booking.updatedAt = new Date();

      await db.update(bookings)
        .set({
          status: 'refunded',
          refundAmount: refundAmount.toString(),
          refundProcessedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(bookings.id, booking.id));

      await eventLogService.logRefundProcessed({
        bookingId: booking.id,
        transactionId: refundTransaction.id,
        processedBy,
        processedByRole,
        amount: refundAmount,
        reason
      });

      logger.info('[UnifiedBooking] Refunded', {
        bookingId: booking.id,
        refundAmount,
        refundTransactionId: refundTransaction.id
      });

      return { booking, refundTransactionId: refundTransaction.id };
    } catch (error: any) {
      logger.error('[UnifiedBooking] Failed to refund', {
        error: error.message,
        bookingId: booking.id
      });
      throw error;
    }
  }

  /**
   * ADMIN OPERATION: Grant Free Wash
   * =================================
   * Creates a complete booking with complimentary transaction
   * Fully audited for HR/Finance
   */
  async adminGrantFreeWash(params: AdminFreeWashParams): Promise<{
    booking: UnifiedBooking;
    transactionId: string;
  }> {
    const endTime = new Date(params.startTime.getTime() + params.minutes * 60000);

    const booking = await this.createDraft({
      serviceId: 'K9000_WASH',
      resourceId: `${params.machineId}${params.bay ? `_${params.bay}` : ''}`,
      resourceType: 'MACHINE',
      userId: 'SYSTEM',
      startTime: params.startTime,
      endTime,
      metadata: {
        adminGranted: true,
        grantedBy: params.adminId,
        reason: params.reason || 'Admin granted free wash',
        minutes: params.minutes
      }
    });

    await this.quote({
      booking,
      price: 0,
      breakdown: { base: 0, adminDiscount: 0 }
    });

    const result = await this.confirm({
      booking,
      paymentProvider: 'ADMIN',
      paymentReference: `FREE_WASH_${params.adminId}`,
      confirmedBy: params.adminId
    });

    await eventLogService.logAdminFreeWash({
      adminId: params.adminId,
      bookingId: booking.id,
      machineId: params.machineId,
      bay: params.bay,
      minutes: params.minutes,
      reason: params.reason
    });

    logger.info('[UnifiedBooking] Admin granted free wash', {
      bookingId: booking.id,
      adminId: params.adminId,
      machineId: params.machineId,
      minutes: params.minutes
    });

    return result;
  }

  /**
   * FRONTEND FLOW: Complete Booking
   * ================================
   * Convenience method for frontend booking flows
   * Draft → Quote → Confirm in one call
   */
  async frontendBookingFlow(params: {
    serviceId: string;
    resourceId: string;
    resourceType: 'HUMAN' | 'MACHINE';
    userId: string;
    startTime: Date;
    endTime: Date;
    price: number;
    paymentProvider: string;
    paymentReference?: string;
    metadata?: Record<string, any>;
  }): Promise<{
    bookingId: string;
    bookingNumber: string;
    status: UnifiedBookingStatus;
    transactionId: string;
  }> {
    let booking = await this.createDraft({
      serviceId: params.serviceId,
      resourceId: params.resourceId,
      resourceType: params.resourceType,
      userId: params.userId,
      startTime: params.startTime,
      endTime: params.endTime,
      metadata: params.metadata
    });

    booking = await this.quote({
      booking,
      price: params.price
    });

    const result = await this.confirm({
      booking,
      paymentProvider: params.paymentProvider,
      paymentReference: params.paymentReference,
      confirmedBy: params.userId
    });

    return {
      bookingId: result.booking.id,
      bookingNumber: result.booking.bookingNumber,
      status: result.booking.status,
      transactionId: result.transactionId
    };
  }
}

export const unifiedBookingEngine = new UnifiedBookingEngine();
