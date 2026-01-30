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
  Currency
} from './types';

const ISRAEL_VAT_RATE = 0.17;

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
  }> {
    const { booking, paymentProvider, paymentReference, confirmedBy } = params;

    try {
      const transaction = await transactionStampService.stamp({
        bookingId: booking.id,
        amount: booking.priceSnapshot.gross,
        type: booking.priceSnapshot.gross === 0 ? 'COMPLIMENTARY' : 'PAID',
        provider: paymentProvider,
        providerRef: paymentReference,
        stampedBy: confirmedBy
      });

      booking.status = 'CONFIRMED';
      booking.updatedAt = new Date();

      await db.update(bookings)
        .set({
          status: 'confirmed',
          paymentStatus: 'paid',
          paymentMethod: paymentProvider.toLowerCase(),
          paymentIntentId: paymentReference,
          confirmedAt: new Date(),
          platformData: {
            ...(booking.metadata || {}),
            priceSnapshot: booking.priceSnapshot,
            transactionId: transaction.id,
            confirmedAt: new Date().toISOString()
          },
          updatedAt: new Date()
        })
        .where(eq(bookings.id, booking.id));

      await eventLogService.logStatusChange({
        bookingId: booking.id,
        previousStatus: 'QUOTED',
        newStatus: 'CONFIRMED',
        changedBy: confirmedBy,
        changedByRole: 'USER',
        reason: 'Payment confirmed'
      });

      await eventLogService.logPaymentReceived({
        bookingId: booking.id,
        transactionId: transaction.id,
        userId: confirmedBy,
        amount: booking.priceSnapshot.gross,
        provider: paymentProvider
      });

      logger.info('[UnifiedBooking] Confirmed', {
        bookingId: booking.id,
        transactionId: transaction.id,
        amount: booking.priceSnapshot.gross
      });

      return { booking, transactionId: transaction.id };
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
  async complete(booking: UnifiedBooking, completedBy: string): Promise<UnifiedBooking> {
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

      logger.info('[UnifiedBooking] Completed', { bookingId: booking.id });

      return booking;
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
        previousStatus: booking.status,
        newStatus: 'CANCELLED',
        changedBy: cancelledBy,
        changedByRole: cancelledByRole,
        reason
      });

      logger.info('[UnifiedBooking] Cancelled', {
        bookingId: booking.id,
        reason
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
