/**
 * UNIFIED LUXURY BOOKING FACADE
 * ==============================
 * Single entry point for all booking operations across ⁦Pet Wash™⁩ platforms
 * Routes to correct luxury engine based on platform type
 * 
 * Like Uber: One booking API, multiple service types
 * 
 * Supported Platforms:
 * - sitter_suite → SitterAdvancedBookingEngine (existing 7-star)
 * - walk_my_pet → WalkEliteBookingEngine (NEW - GPS integrated)
 * - pettrek → PetTrekChauffeurBookingEngine (NEW - Dispatch integrated)
 * - k9000 → K9000StationBookingEngine (NEW - IoT integrated)
 */

import { logger } from '../lib/logger';
import { 
  BaseLuxuryBookingEngine,
  type AvailabilityCheckParams,
  type AvailabilityResult,
  type PricingParams,
  type PricingBreakdown,
  type BookingConfirmation,
} from './booking-engines/base/BaseLuxuryBookingEngine';
import { walkEliteBookingEngine } from './booking-engines/walk/WalkEliteBookingEngine';
import { petTrekChauffeurBookingEngine } from './booking-engines/pettrek/PetTrekChauffeurBookingEngine';
import { k9000StationBookingEngine } from './booking-engines/k9000/K9000StationBookingEngine';
// TODO: Refactor SitterAdvancedBookingEngine to use base engine pattern
// import { sitterAdvancedBookingEngine } from './booking-engines/sitter/SitterAdvancedBookingEngine';

export type BookingPlatform = 'sitter_suite' | 'walk_my_pet' | 'pettrek' | 'k9000' | 'groomers' | 'shared_services';

/**
 * Unified Luxury Booking Facade
 * Single API for all booking operations
 */
export class UnifiedLuxuryBookingFacade {
  private engines: Map<BookingPlatform, BaseLuxuryBookingEngine>;

  constructor() {
    this.engines = new Map();

    // Register vertical engines
    this.engines.set('walk_my_pet', walkEliteBookingEngine);
    this.engines.set('pettrek', petTrekChauffeurBookingEngine);
    this.engines.set('k9000', k9000StationBookingEngine);
    
    // TODO: Register sitter engine after refactoring
    // this.engines.set('sitter_suite', sitterAdvancedBookingEngine);
  }

  /**
   * Check if platform has registered engine
   */
  hasEngine(platform: BookingPlatform): boolean {
    return this.engines.has(platform);
  }

  /**
   * Get booking engine for platform
   */
  private getEngine(platform: BookingPlatform): BaseLuxuryBookingEngine {
    const engine = this.engines.get(platform);
    
    if (!engine) {
      throw new Error(`No booking engine registered for platform: ${platform}`);
    }

    return engine;
  }

  /**
   * Check availability across any platform
   */
  async checkAvailability(
    platform: BookingPlatform,
    params: AvailabilityCheckParams
  ): Promise<AvailabilityResult> {
    try {
      logger.info('[Booking Facade] Checking availability', {
        platform,
        providerId: params.providerId,
        serviceType: params.serviceType,
      });

      const engine = this.getEngine(platform);
      const result = await engine.checkAvailability(params);

      logger.info('[Booking Facade] Availability check complete', {
        platform,
        available: result.available,
      });

      return result;
    } catch (error: any) {
      logger.error('[Booking Facade] Availability check failed', {
        platform,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get price quote with loyalty discounts across any platform
   */
  async quotePrice(
    platform: BookingPlatform,
    params: PricingParams
  ): Promise<PricingBreakdown> {
    try {
      logger.info('[Booking Facade] Calculating price quote', {
        platform,
        userId: params.userId,
        serviceType: params.serviceType,
      });

      const engine = this.getEngine(platform);
      const pricing = await engine.quotePrice(params);

      logger.info('[Booking Facade] Price quote complete', {
        platform,
        totalPrice: pricing.totalPrice,
        loyaltyDiscount: pricing.loyaltyDiscount,
        currency: pricing.currency,
      });

      return pricing;
    } catch (error: any) {
      logger.error('[Booking Facade] Price calculation failed', {
        platform,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Reserve slot across any platform
   */
  async reserveSlot(
    platform: BookingPlatform,
    params: AvailabilityCheckParams
  ): Promise<{ success: boolean; reservationId?: string; expiresAt?: Date }> {
    try {
      logger.info('[Booking Facade] Reserving slot', {
        platform,
        providerId: params.providerId,
      });

      const engine = this.getEngine(platform);
      const result = await engine.reserveSlot(params);

      logger.info('[Booking Facade] Slot reservation complete', {
        platform,
        success: result.success,
        reservationId: result.reservationId,
      });

      return result;
    } catch (error: any) {
      logger.error('[Booking Facade] Slot reservation failed', {
        platform,
        error: error.message,
      });
      return { success: false };
    }
  }

  /**
   * Confirm booking with payment and escrow across any platform
   * @param userId - CUSTOMER Firebase UID (who pays)
   * @param providerId - PROVIDER ID (who receives funds). Pass 'pending' for dispatch-style flows.
   */
  async confirmBooking(
    platform: BookingPlatform,
    bookingId: string,
    pricing: PricingBreakdown,
    userId: string,
    providerId: string = 'pending'
  ): Promise<BookingConfirmation> {
    try {
      logger.info('[Booking Facade] Confirming booking', {
        platform,
        bookingId,
        totalPrice: pricing.totalPrice,
        customerId: userId,
        providerId,
      });

      const engine = this.getEngine(platform);
      const confirmation = await engine.confirmBooking(bookingId, pricing, userId, providerId);

      logger.info('[Booking Facade] Booking confirmed', {
        platform,
        bookingId,
        status: confirmation.status,
        escrowReferenceId: confirmation.escrowReferenceId,
      });

      return confirmation;
    } catch (error: any) {
      logger.error('[Booking Facade] Booking confirmation failed', {
        platform,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Cancel booking with policy-based refund across any platform
   */
  async cancelBooking(
    platform: BookingPlatform,
    bookingId: string,
    userId: string,
    serviceType: string,
    bookingAmount: number,
    bookingDate: Date
  ): Promise<any> {
    try {
      logger.info('[Booking Facade] Cancelling booking', {
        platform,
        bookingId,
        userId,
      });

      const engine = this.getEngine(platform);
      const cancellationResult = await engine.cancelBooking(
        bookingId,
        userId,
        serviceType,
        bookingAmount,
        bookingDate
      );

      logger.info('[Booking Facade] Cancellation processed', {
        platform,
        bookingId,
        refundAmount: cancellationResult.refundAmount,
        refundPercent: cancellationResult.refundPercent,
      });

      return cancellationResult;
    } catch (error: any) {
      logger.error('[Booking Facade] Cancellation failed', {
        platform,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Platform-specific enhanced features
   */

  /**
   * Walk My Pet: Find nearby walkers
   */
  async findNearbyWalkers(
    latitude: number,
    longitude: number,
    maxDistance?: number
  ): Promise<any[]> {
    return walkEliteBookingEngine.findNearbyWalkers(latitude, longitude, maxDistance);
  }

  /**
   * PetTrek: Calculate fare estimate
   */
  async calculateFareEstimate(
    pickupLatitude: number,
    pickupLongitude: number,
    dropoffLatitude: number,
    dropoffLongitude: number,
    petSize: string,
    userId: string
  ): Promise<PricingBreakdown> {
    return petTrekChauffeurBookingEngine.calculateFareEstimate(
      pickupLatitude,
      pickupLongitude,
      dropoffLatitude,
      dropoffLongitude,
      petSize,
      userId
    );
  }

  /**
   * K9000: Find nearest station
   */
  async findNearestStation(
    latitude: number,
    longitude: number,
    maxDistance?: number
  ): Promise<any[]> {
    return k9000StationBookingEngine.findNearestStation(latitude, longitude, maxDistance);
  }
}

// Export singleton instance
export const unifiedBookingFacade = new UnifiedLuxuryBookingFacade();
