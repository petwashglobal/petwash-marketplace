/**
 * K9000™ STATION BOOKING ENGINE
 * ==============================
 * IoT-integrated self-service wash station booking
 *
 * ⚠️  ARCHITECTURE SAFETY FENCE — READ BEFORE MODIFYING ⚠️
 * ----------------------------------------------------------
 * K9000 is a SELF-SERVICE IoT wash station. It does NOT use the
 * marketplace booking system.
 *
 * LIVE K9000 flows (do not add booking/escrow logic here):
 *   POST /api/k9000/start-session   — public terminal wash via Nayax
 *   POST /api/k9000/end-session     — ends terminal wash session
 *   POST /api/k9000/generate-qr    — member QR token for wash redemption
 *   POST /api/k9000/redeem-wash    — kiosk scans member QR
 *
 * THIS ENGINE (K9000StationBookingEngine) provides:
 *   - Station availability checks (IoT heartbeat, status)
 *   - findNearestStation() for map/location features
 *   - PostConfirmationStrategy stub (IoT unlock — NOT YET WIRED)
 *
 * RULES — enforce forever:
 *   ✗ No booking rows created for K9000 washes
 *   ✗ No escrow / payout_status for K9000 washes
 *   ✗ No provider payout logic for K9000 washes
 *   ✗ No appointment/scheduler logic for K9000 washes
 *   ✓ K9000 public terminal = Nayax payment + Firestore session
 *   ✓ K9000 member redeem = QR token + wash_package_credits decrement
 *
 * POST /api/platforms/k9000/bookings is BLOCKED at the route layer.
 * Do NOT remove that block or re-wire this engine to escrow paths.
 * ------------------------------------------------------------------
 *
 * Features:
 * - Real-time station availability monitoring
 * - Station health check integration
 * - Automatic IoT unlock on booking confirmation (stub — see PostConfirmationStrategy)
 * - Heartbeat validation before booking
 * - Maintenance mode detection
 *
 * Uses existing: stationsService (IoT control)
 */

import crypto from 'crypto';
import {
  BaseLuxuryBookingEngine,
  type AvailabilityStrategy,
  type PricingStrategy,
  type PostConfirmationStrategy,
  type AvailabilityCheckParams,
  type AvailabilityResult,
  type PricingParams,
  type PricingBreakdown,
} from '../base/BaseLuxuryBookingEngine';
import { db } from '../../../db';
import { stations } from '@shared/schema';
import { eq, and, gte, lte } from 'drizzle-orm';
import { logger } from '../../../lib/logger';

/**
 * K9000 availability strategy
 * Checks station status and health
 */
class K9000AvailabilityStrategy implements AvailabilityStrategy {
  async checkAvailability(params: AvailabilityCheckParams): Promise<AvailabilityResult> {
    try {
      const stationId = params.providerId;

      // Get station details from PostgreSQL
      const [station] = await db
        .select()
        .from(stations)
        .where(eq(stations.id, parseInt(stationId)))
        .limit(1);

      if (!station) {
        return {
          available: false,
          message: 'Station not found.',
        };
      }

      // Check station status
      if (station.status === 'offline') {
        return {
          available: false,
          message: 'Station is currently offline. Please choose another station.',
        };
      }

      if (station.status === 'maintenance') {
        return {
          available: false,
          message: 'Station is under maintenance. Please choose another station.',
        };
      }

      if (station.status === 'fault') {
        return {
          available: false,
          message: 'Station has a technical fault. Our team has been notified.',
        };
      }

      // Check if station heartbeat is recent (last 5 minutes)
      if (station.lastHeartbeat) {
        const lastHeartbeat = new Date(station.lastHeartbeat);
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        
        if (lastHeartbeat < fiveMinutesAgo) {
          logger.warn('[K9000 Booking] Station heartbeat is stale', {
            stationId,
            lastHeartbeat: lastHeartbeat.toISOString(),
          });
          
          return {
            available: false,
            message: 'Station connectivity issue detected. Please try another station.',
          };
        }
      }

      return {
        available: true,
        message: 'Station is available and ready to use.',
      };
    } catch (error: any) {
      logger.error('[K9000 Booking] Availability check failed', error);
      return {
        available: false,
        message: 'Error checking station availability.',
      };
    }
  }
}

/**
 * K9000 pricing strategy
 * Fixed pricing with VAT
 */
class K9000PricingStrategy implements PricingStrategy {
  async calculatePrice(params: PricingParams): Promise<PricingBreakdown> {
    const serviceType = params.serviceType;

    // Get base price for service type
    const baseRate = this.getBaseRate(serviceType);
    const durationMinutes = this.calculateDuration(params.startDate, params.endDate);
    
    const subtotal = baseRate;

    return {
      baseRate,
      duration: durationMinutes / 60, // Convert to hours for display
      subtotal,
      surgePricing: 0, // No surge for self-service
      loyaltyDiscount: 0, // Applied in base engine
      platformFee: 0, // No platform fee for self-service
      tax: 0, // Calculated in base engine
      totalPrice: subtotal,
      currency: 'ILS',
      providerPayout: 0, // Self-service - no provider payout
      breakdown: [
        { description: `${serviceType} Service`, amount: baseRate },
      ],
    };
  }

  private getBaseRate(serviceType: string): number {
    const rates: Record<string, number> = {
      'quick_wash': 25, // 10 minutes - 25 ILS
      'standard_wash': 40, // 20 minutes - 40 ILS
      'premium_wash': 60, // 30 minutes - 60 ILS
      'luxury_spa': 100, // 45 minutes - 100 ILS
    };
    return rates[serviceType] || 40;
  }

  private calculateDuration(startDate: Date, endDate: Date): number {
    const diffMs = endDate.getTime() - startDate.getTime();
    return Math.ceil(diffMs / (1000 * 60)); // Minutes
  }
}

/**
 * K9000 post-confirmation strategy
 * Generates IoT unlock token and reserves station
 */
class K9000PostConfirmationStrategy implements PostConfirmationStrategy {
  async executePostConfirmation(bookingId: string, bookingData: any): Promise<void> {
    try {
      // Generate IoT unlock token
      const unlockToken = this.generateUnlockToken(bookingId);

      logger.info('[K9000 Post-Confirmation] Station reserved and unlock token generated', {
        bookingId,
        unlockToken,
      });

      // TODO: Send unlock token to station via IoT service
      // await stationsService.sendUnlockCommand(stationId, unlockToken);

      // TODO: Schedule heartbeat monitoring during wash session
      // await stationsService.monitorSessionHeartbeat(bookingId);

    } catch (error: any) {
      logger.error('[K9000 Post-Confirmation] Failed to setup IoT unlock', {
        error: error.message,
        bookingId,
      });
      throw error;
    }
  }

  private generateUnlockToken(bookingId: string): string {
    // Generate secure 6-digit unlock code
    const token = crypto.randomInt(100000, 1000000).toString();
    return `K9-${token}-${bookingId.slice(-4)}`;
  }
}

/**
 * K9000™ Station Booking Engine
 * Self-service wash with IoT integration
 */
export class K9000StationBookingEngine extends BaseLuxuryBookingEngine {
  constructor() {
    super(
      new K9000AvailabilityStrategy(),
      new K9000PricingStrategy(),
      new K9000PostConfirmationStrategy()
    );
  }

  /**
   * Find nearest available station
   * GPS-based proximity search
   */
  async findNearestStation(
    latitude: number,
    longitude: number,
    maxDistance: number = 10 // km
  ): Promise<any[]> {
    try {
      // Get all online stations
      const allStations = await db
        .select()
        .from(stations)
        .where(
          and(
            eq(stations.status, 'online')
          )
        );

      // Calculate distance for each station
      const stationsWithDistance = allStations
        .filter((station) => station.latitude && station.longitude)
        .map((station) => {
          const distance = this.calculateDistance(
            latitude,
            longitude,
            parseFloat(station.latitude!),
            parseFloat(station.longitude!)
          );

          return {
            ...station,
            distance,
            estimatedWalkTime: Math.ceil((distance * 1000) / 80), // 80 meters/min walking
          };
        })
        .filter((station) => station.distance <= maxDistance)
        .sort((a, b) => a.distance - b.distance);

      logger.info('[K9000 Booking] Found nearby stations', {
        total: stationsWithDistance.length,
        maxDistance,
      });

      return stationsWithDistance;
    } catch (error: any) {
      logger.error('[K9000 Booking] Failed to find nearby stations', error);
      return [];
    }
  }

  /**
   * Calculate distance between two GPS coordinates (Haversine formula)
   */
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
}

// Export singleton instance
export const k9000StationBookingEngine = new K9000StationBookingEngine();
