/**
 * PetTrek™ Fare Estimation Service
 * Dynamic pricing for pet transport with surge multipliers
 * 
 * Features:
 * - Base fare + distance + time calculations
 * - Surge pricing for peak hours
 * - 20% platform commission split
 * - Real-time fare estimates
 * 
 * Commission Structure:
 * - Platform: 20% of final fare
 * - Driver: 80% of final fare
 */

import { logger } from '../lib/logger';

// Pricing Configuration (ILS)
const COMMISSION_RATE_TRANSPORT = 0.20; // 20% platform fee
const BASE_FARE = 15.00; // ILS base fare
const RATE_PER_KM = 4.50; // ILS per kilometer
const RATE_PER_MINUTE = 0.75; // ILS per minute

// Surge Pricing
const SURGE_MULTIPLIER_PEAK = 1.5; // 50% increase during peak hours
const PEAK_HOURS = [
  { start: 7, end: 9 },   // Morning rush: 7am-9am
  { start: 16, end: 19 }, // Evening rush: 4pm-7pm
];

export interface Location {
  latitude: number;
  longitude: number;
}

export interface FareEstimate {
  estimatedFare: number;
  driverPayout: number;
  platformCommission: number;
  baseFare: number;
  distanceFare: number;
  timeFare: number;
  surgeFare: number;
  breakdown: {
    distanceKm: number;
    estimatedMinutes: number;
    isPeakTime: boolean;
    surgeMultiplier: number;
  };
}

export interface RouteInfo {
  distanceKm: number;
  durationMinutes: number;
}

export class PetTrekFareEstimationService {
  /**
   * Calculate distance and estimated time between two points
   * Uses Haversine formula for distance calculation
   */
  private calculateDistanceAndTime(
    start: Location,
    end: Location
  ): RouteInfo {
    // Haversine formula to calculate distance between two lat/lng points
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRad(end.latitude - start.latitude);
    const dLon = this.toRad(end.longitude - start.longitude);
    
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(start.latitude)) *
        Math.cos(this.toRad(end.latitude)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distanceKm = R * c;
    
    // Estimate driving time: average 40 km/h in city traffic
    const durationMinutes = Math.ceil((distanceKm / 40) * 60);
    
    return {
      distanceKm: Math.round(distanceKm * 100) / 100, // Round to 2 decimals
      durationMinutes
    };
  }

  /**
   * Convert degrees to radians
   */
  private toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Check if current time is peak hour
   */
  private isPeakTime(date: Date = new Date()): boolean {
    const hour = date.getHours();
    
    return PEAK_HOURS.some(
      (period) => hour >= period.start && hour < period.end
    );
  }

  /**
   * Get surge multiplier based on current demand
   * In production, this would check real-time demand data
   */
  private getSurgeMultiplier(isPeakTime: boolean): number {
    if (isPeakTime) {
      return SURGE_MULTIPLIER_PEAK;
    }
    return 1.0;
  }

  /**
   * Calculate fare estimate for a trip
   * 
   * @param start - Pickup location
   * @param end - Dropoff location
   * @param scheduledTime - Optional scheduled pickup time (for peak detection)
   * @returns Detailed fare breakdown
   */
  getFareEstimate(
    start: Location,
    end: Location,
    scheduledTime?: Date
  ): FareEstimate {
    try {
      // Calculate route info
      const routeInfo = this.calculateDistanceAndTime(start, end);
      
      // Check if peak time
      const isPeak = this.isPeakTime(scheduledTime);
      const surgeMultiplier = this.getSurgeMultiplier(isPeak);
      
      // Calculate base costs
      const baseFare = BASE_FARE;
      const distanceFare = routeInfo.distanceKm * RATE_PER_KM;
      const timeFare = routeInfo.durationMinutes * RATE_PER_MINUTE;
      
      // Subtotal before surge
      let subtotal = baseFare + distanceFare + timeFare;
      
      // Apply surge pricing
      const surgeFare = isPeak ? subtotal * (surgeMultiplier - 1) : 0;
      subtotal = subtotal * surgeMultiplier;
      
      // Calculate commission
      const platformCommission = subtotal * COMMISSION_RATE_TRANSPORT;
      const driverPayout = subtotal * (1 - COMMISSION_RATE_TRANSPORT);
      
      logger.info('[PetTrek Fare] Estimate calculated', {
        distanceKm: routeInfo.distanceKm,
        durationMinutes: routeInfo.durationMinutes,
        estimatedFare: subtotal.toFixed(2),
        isPeakTime: isPeak,
        surgeMultiplier
      });
      
      return {
        estimatedFare: Math.round(subtotal * 100) / 100,
        driverPayout: Math.round(driverPayout * 100) / 100,
        platformCommission: Math.round(platformCommission * 100) / 100,
        baseFare: Math.round(baseFare * 100) / 100,
        distanceFare: Math.round(distanceFare * 100) / 100,
        timeFare: Math.round(timeFare * 100) / 100,
        surgeFare: Math.round(surgeFare * 100) / 100,
        breakdown: {
          distanceKm: routeInfo.distanceKm,
          estimatedMinutes: routeInfo.durationMinutes,
          isPeakTime: isPeak,
          surgeMultiplier
        }
      };
    } catch (error) {
      logger.error('[PetTrek Fare] Error calculating estimate:', error);
      throw error;
    }
  }

  /**
   * Get pricing configuration (for display to users)
   */
  getPricingConfig() {
    return {
      baseFare: BASE_FARE,
      perKmRate: RATE_PER_KM,
      perMinuteRate: RATE_PER_MINUTE,
      commissionRate: COMMISSION_RATE_TRANSPORT * 100, // as percentage
      surgeMultiplier: SURGE_MULTIPLIER_PEAK,
      peakHours: PEAK_HOURS,
      currency: 'ILS'
    };
  }

  /**
   * Estimate total trip cost including potential surge
   * Returns range: [minimum fare, maximum fare with surge]
   */
  getFareRange(start: Location, end: Location): { min: number; max: number } {
    const normalFare = this.getFareEstimate(start, end, new Date());
    const peakFare = normalFare.estimatedFare * SURGE_MULTIPLIER_PEAK;
    
    return {
      min: normalFare.estimatedFare,
      max: Math.round(peakFare * 100) / 100
    };
  }
}

export const fareEstimationService = new PetTrekFareEstimationService();
