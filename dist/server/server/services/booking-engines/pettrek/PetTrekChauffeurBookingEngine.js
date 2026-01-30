/**
 * PETTREK™ CHAUFFEUR BOOKING ENGINE
 * ==================================
 * Uber-style pet transport with driver matching and real-time dispatch
 *
 * Features:
 * - Multi-driver dispatch (top 3 nearest drivers simultaneously)
 * - Dynamic pricing with distance-based surge
 * - Vehicle capacity matching
 * - Real-time driver acceptance/decline workflow
 * - 30-second auto-expire for unaccepted dispatches
 *
 * Uses existing: PetTrekDispatchService
 */
import { BaseLuxuryBookingEngine, } from '../base/BaseLuxuryBookingEngine';
import { db } from '../../../db';
import { pettrekTrips } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { logger } from '../../../lib/logger';
import { dispatchService } from '../../PetTrekDispatchService';
/**
 * PetTrek availability strategy
 * Checks if drivers are available for route
 */
class PetTrekAvailabilityStrategy {
    async checkAvailability(params) {
        try {
            const metadata = params.metadata || {};
            const pickupLat = metadata.pickupLatitude || 0;
            const pickupLon = metadata.pickupLongitude || 0;
            const petSize = metadata.petSize || 'medium';
            // Find nearby drivers using dispatch service
            const nearbyDrivers = await dispatchService.findNearbyDrivers(pickupLat, pickupLon, petSize, 15 // 15km radius
            );
            if (nearbyDrivers.length === 0) {
                return {
                    available: false,
                    message: 'No drivers available in your area. Please try again later.',
                };
            }
            return {
                available: true,
                message: `${nearbyDrivers.length} driver(s) available near you.`,
                suggestedAlternatives: nearbyDrivers.slice(0, 3).map((driver) => ({
                    driverId: driver.providerId,
                    name: `${driver.firstName} ${driver.lastName}`,
                    distance: `${driver.distanceKm} km away`,
                    estimatedArrival: `${driver.estimatedArrivalMinutes} min`,
                    vehicleType: driver.vehicleType,
                    rating: driver.averageRating,
                })),
            };
        }
        catch (error) {
            logger.error('[PetTrek Booking] Availability check failed', error);
            return {
                available: false,
                message: 'Error checking driver availability.',
            };
        }
    }
}
/**
 * PetTrek pricing strategy
 * Distance-based with surge pricing
 */
class PetTrekPricingStrategy {
    async calculatePrice(params) {
        const metadata = params.metadata || {};
        const distanceKm = metadata.distanceKm || 10; // Default 10km
        const petSize = metadata.petSize || 'medium';
        // Base rate per km based on pet size
        const baseRatePerKm = this.getBaseRatePerKm(petSize);
        const minimumFare = 30; // Minimum 30 ILS per trip
        let subtotal = Math.max(distanceKm * baseRatePerKm, minimumFare);
        // Apply surge pricing (time-of-day or demand-based)
        const surgePricing = this.calculateSurgePricing(params.startDate, subtotal);
        subtotal += surgePricing;
        return {
            baseRate: baseRatePerKm,
            duration: distanceKm, // Distance in km (not time)
            subtotal,
            surgePricing,
            loyaltyDiscount: 0, // Applied in base engine
            platformFee: 0, // Calculated in base engine
            tax: 0, // Calculated in base engine
            totalPrice: subtotal,
            currency: 'ILS',
            providerPayout: subtotal * 0.75, // Driver gets 75% (25% platform fee)
            breakdown: [
                { description: `Base Rate (${distanceKm}km × ₪${baseRatePerKm}/km)`, amount: distanceKm * baseRatePerKm },
                { description: 'Minimum Fare Adjustment', amount: Math.max(0, minimumFare - (distanceKm * baseRatePerKm)) },
                { description: 'Peak Hours Surge', amount: surgePricing },
            ],
        };
    }
    getBaseRatePerKm(petSize) {
        const rates = {
            small: 8, // Small pet: 8 ILS/km
            medium: 10, // Medium pet: 10 ILS/km
            large: 12, // Large pet: 12 ILS/km
            xlarge: 15, // XL pet: 15 ILS/km
        };
        return rates[petSize.toLowerCase()] || 10;
    }
    calculateSurgePricing(startDate, subtotal) {
        const hour = startDate.getHours();
        const day = startDate.getDay();
        // Weekend surge (Friday afternoon - Saturday): 30%
        if ((day === 5 && hour >= 14) || day === 6) {
            return subtotal * 0.30;
        }
        // Weekday peak hours (7-9 AM, 5-7 PM): 20%
        if ((hour >= 7 && hour < 9) || (hour >= 17 && hour < 19)) {
            return subtotal * 0.20;
        }
        return 0;
    }
}
/**
 * PetTrek post-confirmation strategy
 * Dispatches trip to nearby drivers
 */
class PetTrekPostConfirmationStrategy {
    async executePostConfirmation(bookingId, bookingData) {
        try {
            // Get trip details
            const trip = await db.query.pettrekTrips.findFirst({
                where: eq(pettrekTrips.id, parseInt(bookingId)),
            });
            if (!trip) {
                throw new Error(`PetTrek trip ${bookingId} not found`);
            }
            const pickupLat = parseFloat(trip.pickupLatitude || '0');
            const pickupLon = parseFloat(trip.pickupLongitude || '0');
            const petSize = trip.petSize || 'medium';
            // Dispatch to top 3 nearest drivers simultaneously
            const dispatchResult = await dispatchService.dispatchTrip(parseInt(bookingId), pickupLat, pickupLon, petSize);
            logger.info('[PetTrek Post-Confirmation] Dispatched to drivers', {
                bookingId,
                driversDispatched: dispatchResult.dispatchedCount,
                message: dispatchResult.message,
            });
            if (!dispatchResult.success) {
                throw new Error('Failed to dispatch trip to drivers');
            }
        }
        catch (error) {
            logger.error('[PetTrek Post-Confirmation] Dispatch failed', {
                error: error.message,
                bookingId,
            });
            throw error;
        }
    }
}
/**
 * PetTrek™ Chauffeur Booking Engine
 * Uber-style pet transport with luxury features
 */
export class PetTrekChauffeurBookingEngine extends BaseLuxuryBookingEngine {
    constructor() {
        super(new PetTrekAvailabilityStrategy(), new PetTrekPricingStrategy(), new PetTrekPostConfirmationStrategy());
    }
    /**
     * Calculate fare estimate for route
     * Like Uber - show price before booking
     */
    async calculateFareEstimate(pickupLatitude, pickupLongitude, dropoffLatitude, dropoffLongitude, petSize, userId) {
        const distanceKm = this.calculateDistance(pickupLatitude, pickupLongitude, dropoffLatitude, dropoffLongitude);
        return this.quotePrice({
            providerId: 'ESTIMATE', // Not assigned yet
            serviceType: 'transport',
            startDate: new Date(),
            endDate: new Date(),
            userId,
            ipAddress: '0.0.0.0',
            metadata: {
                distanceKm: Math.round(distanceKm * 10) / 10, // Round to 1 decimal
                pickupLatitude,
                pickupLongitude,
                dropoffLatitude,
                dropoffLongitude,
                petSize,
            },
        });
    }
    /**
     * Calculate distance between two GPS coordinates (Haversine formula)
     */
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Earth's radius in km
        const dLat = this.toRad(lat2 - lat1);
        const dLon = this.toRad(lon2 - lon1);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.toRad(lat1)) *
                Math.cos(this.toRad(lat2)) *
                Math.sin(dLon / 2) *
                Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }
    toRad(degrees) {
        return degrees * (Math.PI / 180);
    }
}
// Export singleton instance
export const petTrekChauffeurBookingEngine = new PetTrekChauffeurBookingEngine();
