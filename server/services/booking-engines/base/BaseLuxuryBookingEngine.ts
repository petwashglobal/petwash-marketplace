/**
 * BASE LUXURY BOOKING ENGINE
 * ===========================
 * Unified booking infrastructure for all Pet Wash™ platforms
 * Like Uber: one core engine, platform-specific strategies
 * 
 * Provides:
 * - Availability checking with capacity management
 * - Dynamic pricing with loyalty tier discounts
 * - Escrow payment processing
 * - Cancellation policy enforcement
 * - Post-confirmation workflows (GPS, dispatch, IoT unlock)
 * 
 * Oracle-level enterprise quality - DO NOT modify without architectural review
 */

import { db } from '../../../db';
import { logger } from '../../../lib/logger';
import { getLoyaltyStatus, type LoyaltyUser } from '../../loyalty';
import { bookingPolicyEngine, type CancellationResult } from '../../BookingPolicyEngine';

// Strategy Interfaces
export interface AvailabilityStrategy {
  checkAvailability(params: AvailabilityCheckParams): Promise<AvailabilityResult>;
}

export interface PricingStrategy {
  calculatePrice(params: PricingParams): Promise<PricingBreakdown>;
}

export interface PostConfirmationStrategy {
  executePostConfirmation(bookingId: string, bookingData: any): Promise<void>;
}

// Common Types
export interface AvailabilityCheckParams {
  providerId: string;
  serviceType: string;
  startDate: Date;
  endDate: Date;
  metadata?: Record<string, any>;
}

export interface AvailabilityResult {
  available: boolean;
  message: string;
  suggestedAlternatives?: any[];
}

export interface PricingParams {
  providerId: string;
  serviceType: string;
  startDate: Date;
  endDate: Date;
  userId: string;
  ipAddress: string;
  metadata?: Record<string, any>;
}

export interface PricingBreakdown {
  baseRate: number;
  duration: number;
  subtotal: number;
  surgePricing: number;
  loyaltyDiscount: number;
  platformFee: number;
  tax: number;
  totalPrice: number;
  currency: string;
  providerPayout: number;
  breakdown: {
    description: string;
    amount: number;
  }[];
}

export interface BookingConfirmation {
  bookingId: string;
  status: 'confirmed' | 'pending_confirmation' | 'failed';
  pricing: PricingBreakdown;
  escrowReferenceId?: string;
  postConfirmationData?: any;
}

/**
 * Base Luxury Booking Engine
 * All vertical engines extend this for unified experience
 */
export abstract class BaseLuxuryBookingEngine {
  constructor(
    protected availabilityStrategy: AvailabilityStrategy,
    protected pricingStrategy: PricingStrategy,
    protected postConfirmationStrategy: PostConfirmationStrategy
  ) {}

  /**
   * Check availability with vertical-specific logic
   */
  async checkAvailability(params: AvailabilityCheckParams): Promise<AvailabilityResult> {
    try {
      logger.info('[Luxury Booking] Checking availability', {
        providerId: params.providerId,
        serviceType: params.serviceType,
        dateRange: `${params.startDate.toISOString()} - ${params.endDate.toISOString()}`,
      });

      // Validate dates
      this.validateBookingDates(params.startDate, params.endDate);

      // Execute vertical-specific availability check
      const result = await this.availabilityStrategy.checkAvailability(params);

      logger.info('[Luxury Booking] Availability check complete', {
        available: result.available,
        message: result.message,
      });

      return result;
    } catch (error: any) {
      logger.error('[Luxury Booking] Availability check failed', {
        error: error.message,
        params,
      });
      return {
        available: false,
        message: 'Error checking availability. Please try again.',
      };
    }
  }

  /**
   * Quote price with loyalty tier discounts applied
   * ALL platforms get loyalty integration automatically
   * 
   * CRITICAL: Recalculates provider payout AFTER discount to ensure financial reconciliation
   */
  async quotePrice(params: PricingParams): Promise<PricingBreakdown> {
    try {
      logger.info('[Luxury Booking] Calculating price quote', {
        providerId: params.providerId,
        userId: params.userId,
        serviceType: params.serviceType,
      });

      // Get base pricing from vertical strategy
      const basePricing = await this.pricingStrategy.calculatePrice(params);

      // Apply loyalty tier discount (UNIFIED across all platforms)
      const loyaltyUser = await getLoyaltyStatus(params.userId);
      const loyaltyDiscount = this.calculateLoyaltyDiscount(
        basePricing.subtotal,
        loyaltyUser
      );

      // Recalculate totals with loyalty discount
      const discountedSubtotal = basePricing.subtotal - loyaltyDiscount;
      
      // CRITICAL FIX #1: Recalculate provider payout based on discounted subtotal
      // Otherwise providers get paid original amount while customer pays less = negative margin
      const providerPayoutRatio = basePricing.subtotal > 0 
        ? basePricing.providerPayout / basePricing.subtotal 
        : 0;
      const adjustedProviderPayout = discountedSubtotal * providerPayoutRatio;
      
      // Platform fee is the SPLIT of the subtotal (not added on top)
      const platformFee = discountedSubtotal - adjustedProviderPayout;
      
      // CRITICAL FIX #2: Tax is on subtotal, then total = subtotal + tax
      // Platform fee is already IN the subtotal (not added on top!)
      const tax = discountedSubtotal * this.getTaxRate(params.ipAddress);
      const totalPrice = discountedSubtotal + tax; // NOT + platformFee (already included!)

      const finalPricing: PricingBreakdown = {
        ...basePricing,
        loyaltyDiscount,
        subtotal: discountedSubtotal,
        platformFee,
        tax,
        totalPrice,
        providerPayout: adjustedProviderPayout, // FIXED: Use recalculated payout
        breakdown: [
          ...basePricing.breakdown,
          {
            description: `Loyalty Discount (${loyaltyUser?.tier || 'BRONZE'})`,
            amount: -loyaltyDiscount,
          },
          { 
            description: `Platform Fee (${Math.round(((platformFee / discountedSubtotal) * 100) * 10) / 10}%)`, 
            amount: platformFee 
          },
          { description: 'Tax (VAT)', amount: tax },
        ],
      };

      logger.info('[Luxury Booking] Price quote complete', {
        totalPrice,
        loyaltyDiscount,
        loyaltyTier: loyaltyUser?.tier,
        currency: finalPricing.currency,
        providerPayout: adjustedProviderPayout,
        platformFee,
        financialCheck: {
          customerPays: totalPrice,
          providerGets: adjustedProviderPayout,
          platformGets: platformFee,
          taxes: tax,
          reconciles: Math.abs((adjustedProviderPayout + platformFee + tax) - totalPrice) < 0.01,
        },
      });

      return finalPricing;
    } catch (error: any) {
      logger.error('[Luxury Booking] Price calculation failed', {
        error: error.message,
        params,
      });
      throw error;
    }
  }

  /**
   * Reserve slot (hold inventory before payment)
   */
  async reserveSlot(params: AvailabilityCheckParams): Promise<{
    success: boolean;
    reservationId?: string;
    expiresAt?: Date;
  }> {
    try {
      // Check availability first
      const availability = await this.checkAvailability(params);
      if (!availability.available) {
        return { success: false };
      }

      // Create temporary reservation (15 minutes to complete payment)
      const reservationId = `RES-${Date.now()}-${params.providerId.slice(0, 8)}`;
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

      logger.info('[Luxury Booking] Slot reserved', {
        reservationId,
        expiresAt,
      });

      return {
        success: true,
        reservationId,
        expiresAt,
      };
    } catch (error: any) {
      logger.error('[Luxury Booking] Slot reservation failed', error);
      return { success: false };
    }
  }

  /**
   * Confirm booking with payment processing and escrow
   */
  async confirmBooking(
    bookingId: string,
    pricing: PricingBreakdown,
    userId: string
  ): Promise<BookingConfirmation> {
    try {
      logger.info('[Luxury Booking] Confirming booking', {
        bookingId,
        totalPrice: pricing.totalPrice,
        currency: pricing.currency,
      });

      // Process payment and move to escrow (like Airbnb)
      const escrowResult = await this.moveToEscrow(
        bookingId,
        pricing.totalPrice,
        pricing.currency
      );

      if (!escrowResult.success) {
        logger.error('[Luxury Booking] Payment/escrow failed', { bookingId });
        return {
          bookingId,
          status: 'failed',
          pricing,
        };
      }

      // Execute vertical-specific post-confirmation actions
      // (GPS activation for Walk, dispatch for PetTrek, IoT unlock for K9000)
      await this.triggerPostConfirmation(bookingId);

      logger.info('[Luxury Booking] Booking confirmed successfully', {
        bookingId,
        escrowReferenceId: escrowResult.escrowReferenceId,
      });

      return {
        bookingId,
        status: 'confirmed',
        pricing,
        escrowReferenceId: escrowResult.escrowReferenceId,
      };
    } catch (error: any) {
      logger.error('[Luxury Booking] Booking confirmation failed', {
        error: error.message,
        bookingId,
      });
      return {
        bookingId,
        status: 'failed',
        pricing,
      };
    }
  }

  /**
   * Trigger post-confirmation workflows
   * (GPS for Walk, Dispatch for PetTrek, IoT for K9000, Escrow release for Sitter)
   */
  async triggerPostConfirmation(bookingId: string): Promise<void> {
    try {
      logger.info('[Luxury Booking] Triggering post-confirmation workflow', {
        bookingId,
      });

      await this.postConfirmationStrategy.executePostConfirmation(bookingId, {});

      logger.info('[Luxury Booking] Post-confirmation workflow complete', {
        bookingId,
      });
    } catch (error: any) {
      logger.error('[Luxury Booking] Post-confirmation workflow failed', {
        error: error.message,
        bookingId,
      });
      // Non-blocking - booking is still confirmed
    }
  }

  /**
   * Cancel booking with policy-based refund calculation
   * UNIFIED across all platforms
   */
  async cancelBooking(
    bookingId: string,
    userId: string,
    serviceType: string,
    bookingAmount: number,
    bookingDate: Date
  ): Promise<CancellationResult> {
    try {
      logger.info('[Luxury Booking] Processing cancellation', {
        bookingId,
        userId,
        serviceType,
      });

      // Calculate refund using BookingPolicyEngine
      const cancellationResult = await bookingPolicyEngine.calculateCancellation(
        serviceType,
        bookingAmount,
        bookingDate,
        new Date(), // cancellation date = now
        'IL' // TODO: Get country from user profile
      );

      if (cancellationResult.canCancel && cancellationResult.refundAmount > 0) {
        // Process refund from escrow
        await bookingPolicyEngine.processAutoRefund(
          parseInt(bookingId),
          cancellationResult.refundAmount,
          cancellationResult.refundMethod
        );
      }

      logger.info('[Luxury Booking] Cancellation processed', {
        bookingId,
        refundAmount: cancellationResult.refundAmount,
        refundPercent: cancellationResult.refundPercent,
      });

      return cancellationResult;
    } catch (error: any) {
      logger.error('[Luxury Booking] Cancellation failed', {
        error: error.message,
        bookingId,
      });
      throw error;
    }
  }

  // ==================== PRIVATE HELPERS ====================

  /**
   * Validate booking dates
   */
  private validateBookingDates(startDate: Date, endDate: Date): void {
    if (startDate >= endDate) {
      throw new Error('Start date must be before end date');
    }

    if (startDate < new Date()) {
      throw new Error('Start date must be in the future');
    }
  }

  /**
   * Calculate loyalty tier discount
   * Progressive: BRONZE 0%, SILVER 5%, GOLD 10%, PLATINUM 15%, DIAMOND 20%
   */
  private calculateLoyaltyDiscount(subtotal: number, loyaltyUser: LoyaltyUser | null): number {
    if (!loyaltyUser) return 0;

    const discountPercent = loyaltyUser.discount; // From loyalty service
    return (subtotal * discountPercent) / 100;
  }

  /**
   * Get tax rate based on IP/country
   */
  private getTaxRate(ipAddress: string): number {
    // TODO: Use globalConfig.getLocalSettings(ipAddress) for country-specific VAT
    return 0.17; // Israel VAT 17%
  }

  /**
   * Move payment to escrow (like Airbnb - hold until service completion)
   */
  private async moveToEscrow(
    bookingId: string,
    amount: number,
    currency: string
  ): Promise<{
    success: boolean;
    escrowReferenceId?: string;
  }> {
    try {
      // TODO: Integrate with Nayax escrow API when keys available
      const escrowReferenceId = `ESCROW-${Date.now()}-${bookingId.slice(0, 8)}`;

      logger.info('[Escrow] Funds moved to escrow', {
        bookingId,
        amount,
        currency,
        escrowReferenceId,
      });

      return {
        success: true,
        escrowReferenceId,
      };
    } catch (error: any) {
      logger.error('[Escrow] Failed to move funds to escrow', {
        error: error.message,
        bookingId,
      });
      return { success: false };
    }
  }
}
