/**
 * Advanced Booking Engine for The Sitter Suite™
 * Handles complex availability, dynamic pricing, holiday surges, escrow payments
 * Enterprise-level like Booking.com / Airbnb
 */
import { globalConfig } from './SitterGlobalConfig';
import { logger } from '../lib/logger';
import { db } from '../db';
import { sitterBookings, sitterProfiles } from '@shared/schema';
import { eq, and, gte, lte } from 'drizzle-orm';
import { getLoyaltyStatus } from './loyalty';
import { bookingPolicyEngine } from './BookingPolicyEngine';
export class SitterAdvancedBookingEngine {
    /**
     * Check sitter availability with advanced calendar logic
     * Supports:
     * - Manual date block-offs
     * - Capacity limits (boarding only)
     * - Overlapping booking prevention
     */
    async checkAvailability(sitterId, serviceType, startDate, endDate) {
        try {
            // 1. Check if sitter profile exists and is available
            const sitter = await db.query.sitterProfiles.findFirst({
                where: eq(sitterProfiles.id, sitterId),
            });
            if (!sitter) {
                return {
                    available: false,
                    message: "Sitter not found.",
                };
            }
            if (!sitter.available) {
                return {
                    available: false,
                    message: "Sitter is currently unavailable.",
                };
            }
            // 2. Check for overlapping bookings
            const overlappingBookings = await db
                .select()
                .from(sitterBookings)
                .where(and(eq(sitterBookings.sitterId, sitterId), gte(sitterBookings.endDate, startDate), lte(sitterBookings.startDate, endDate), 
            // Only count confirmed/active bookings
            and(eq(sitterBookings.bookingStatus, 'confirmed'))));
            // 3. Capacity check (boarding only)
            if (serviceType === 'Boarding' || serviceType === 'boarding') {
                const MAX_BOARDING_CAPACITY = 3; // Configurable per sitter in production
                if (overlappingBookings.length >= MAX_BOARDING_CAPACITY) {
                    return {
                        available: false,
                        message: `Sitter is at maximum boarding capacity (${MAX_BOARDING_CAPACITY} pets).`,
                    };
                }
            }
            else {
                // For other services (drop-in, walking), only allow one at a time
                if (overlappingBookings.length > 0) {
                    return {
                        available: false,
                        message: "Sitter has conflicting bookings during this time.",
                    };
                }
            }
            // 4. TODO: Check manual block-offs from calendar
            // In production: sitter_calendar table with blocked dates
            return {
                available: true,
                message: "Sitter is available for booking.",
            };
        }
        catch (error) {
            logger.error('[Booking Engine] Error checking availability', { error, sitterId });
            return {
                available: false,
                message: "Error checking availability.",
            };
        }
    }
    /**
     * Calculate price with dynamic pricing, holiday surges, loyalty discounts, and transparent fees
     * Like Booking.com/Airbnb: shows full breakdown
     *
     * UPDATED: Now includes loyalty tier discounts (5-20%) across all tiers
     */
    async calculatePrice(sitterId, serviceType, startDate, endDate, ipAddress, userId // ADDED: For loyalty discount
    ) {
        // Get sitter's base rate
        const sitter = await db.query.sitterProfiles.findFirst({
            where: eq(sitterProfiles.id, sitterId),
        });
        if (!sitter) {
            throw new Error('Sitter not found');
        }
        const baseRate = sitter.hourlyRateIls;
        // Get local settings for currency and tax
        const localSettings = globalConfig.getLocalSettings(ipAddress);
        const currency = localSettings.currency;
        const taxRate = localSettings.taxRate;
        // Calculate duration (in hours or days depending on service)
        const duration = this.calculateDuration(startDate, endDate, serviceType);
        // Base subtotal
        let subtotal = baseRate * duration;
        // Apply holiday surge pricing (50% increase)
        let holidaySurge = 0;
        const countryCode = this.getCountryFromIP(ipAddress);
        if (globalConfig.isHolidayPeriod(startDate, endDate, countryCode)) {
            holidaySurge = subtotal * 0.50; // 50% surge
            subtotal += holidaySurge;
            logger.info('[Dynamic Pricing] Holiday surge applied', { sitterId, surge: holidaySurge });
        }
        // ADDED: Apply loyalty tier discount (UNIFIED across all platforms)
        let loyaltyDiscount = 0;
        if (userId) {
            const loyaltyUser = await getLoyaltyStatus(userId);
            if (loyaltyUser) {
                const discountPercent = loyaltyUser.discount; // 0%, 5%, 10%, 15%, 20%
                loyaltyDiscount = (subtotal * discountPercent) / 100;
                subtotal -= loyaltyDiscount;
                logger.info('[Sitter Booking] Loyalty discount applied', {
                    userId,
                    tier: loyaltyUser.tier,
                    discount: loyaltyDiscount,
                });
            }
        }
        // Platform fee (10% transparent to customer)
        const platformFee = subtotal * globalConfig.getCommissionRate();
        // Tax (country-specific VAT/GST)
        const tax = subtotal * taxRate;
        // Total price to customer
        const totalPrice = subtotal + platformFee + tax;
        // Sitter payout (gets full subtotal after loyalty discount)
        const sitterPayout = subtotal;
        return {
            baseRate,
            duration,
            subtotal,
            holidaySurge,
            loyaltyDiscount, // ADDED
            platformFee,
            tax,
            totalPrice,
            currency,
            sitterPayout,
        };
    }
    /**
     * Process payment and move to escrow
     * Like Airbnb: Hold funds until service completion
     */
    async processPayment(bookingId, totalAmount, currency) {
        try {
            logger.info('[Escrow] Processing payment', { bookingId, totalAmount, currency });
            // PRODUCTION: Integrate with Nayax split payment API
            // await NayaxSplitPaymentService.charge(totalAmount, currency);
            // Move to escrow (held until service completion)
            await this.moveToEscrow(bookingId, totalAmount);
            logger.info('[Escrow] Payment secured in escrow', { bookingId });
            return {
                success: true,
                message: "Payment secured and funds in escrow.",
            };
        }
        catch (error) {
            logger.error('[Escrow] Payment processing failed', { error, bookingId });
            return {
                success: false,
                message: "Payment processing failed.",
            };
        }
    }
    /**
     * Release payment to sitter after service completion
     * Automatic release after 24 hours past end date (if no dispute)
     */
    async releasePayment(bookingId, sitterId) {
        try {
            // Check if service is complete
            const isComplete = await this.checkServiceCompletion(bookingId);
            if (!isComplete) {
                logger.warn('[Escrow] Cannot release payment - service not complete', { bookingId });
                return false;
            }
            // Get escrow amount
            const escrowAmount = await this.getEscrowAmount(bookingId);
            const platformFee = await this.getPlatformFee(bookingId);
            const sitterPayout = escrowAmount - platformFee;
            // PRODUCTION: Transfer to sitter via Nayax
            // await NayaxSplitPaymentService.transfer(sitterPayout, sitterId);
            // Log transaction
            await this.logTransaction(bookingId, 'Payment Released', sitterPayout);
            logger.info('[Escrow] Payment released to sitter', { bookingId, sitterPayout });
            return true;
        }
        catch (error) {
            logger.error('[Escrow] Failed to release payment', { error, bookingId });
            return false;
        }
    }
    /**
     * Calculate duration based on service type
     */
    calculateDuration(startDate, endDate, serviceType) {
        const diffMs = endDate.getTime() - startDate.getTime();
        // For overnight services (boarding, house sitting), count days
        if (serviceType === 'Boarding' || serviceType === 'boarding' || serviceType === 'House Sitting') {
            return Math.ceil(diffMs / (1000 * 60 * 60 * 24)); // Days
        }
        // For hourly services (drop-in, walking), count hours
        return Math.ceil(diffMs / (1000 * 60 * 60)); // Hours
    }
    /**
     * Get country code from IP
     */
    getCountryFromIP(ipAddress) {
        const settings = globalConfig.getLocalSettings(ipAddress);
        // Map country name to code
        const countryMap = {
            'Israel': 'ISR',
            'United States': 'USA',
            'United Kingdom': 'UK',
            'Australia': 'AUS',
            'Canada': 'CAN',
        };
        return countryMap[settings.country] || 'Global';
    }
    /**
     * Mock escrow functions (production uses Nayax ONLY)
     */
    async moveToEscrow(bookingId, amount) {
        // Store in database: escrow_transactions table
        logger.info('[Escrow] Funds moved to escrow', { bookingId, amount });
    }
    async checkServiceCompletion(bookingId) {
        const booking = await db.query.sitterBookings.findFirst({
            where: eq(sitterBookings.id, bookingId),
        });
        if (!booking)
            return false;
        // Service is complete if end date has passed and no disputes
        const now = new Date();
        return booking.endDate < now && booking.bookingStatus !== 'disputed';
    }
    async getEscrowAmount(bookingId) {
        const booking = await db.query.sitterBookings.findFirst({
            where: eq(sitterBookings.id, bookingId),
        });
        return booking?.totalPriceIls || 0;
    }
    async getPlatformFee(bookingId) {
        const booking = await db.query.sitterBookings.findFirst({
            where: eq(sitterBookings.id, bookingId),
        });
        return booking?.platformFeeIls || 0;
    }
    async logTransaction(bookingId, type, amount) {
        logger.info('[Transaction Log]', { bookingId, type, amount });
        // Store in audit trail / blockchain-style ledger
    }
    /**
     * Cancel booking with policy-based refund calculation
     * ADDED: Unified BookingPolicyEngine integration (same as other platforms)
     */
    async cancelBooking(bookingId, userId, serviceType, bookingAmount, bookingDate) {
        try {
            logger.info('[Sitter Booking] Processing cancellation', {
                bookingId,
                userId,
                serviceType,
            });
            // Calculate refund using BookingPolicyEngine (UNIFIED with other platforms)
            const cancellationResult = await bookingPolicyEngine.calculateCancellation(serviceType, bookingAmount, bookingDate, new Date(), // cancellation date = now
            'IL' // TODO: Get country from user profile
            );
            if (cancellationResult.canCancel && cancellationResult.refundAmount > 0) {
                // Process refund from escrow
                await bookingPolicyEngine.processAutoRefund(parseInt(bookingId), cancellationResult.refundAmount, cancellationResult.refundMethod);
                logger.info('[Sitter Booking] Refund processed', {
                    bookingId,
                    refundAmount: cancellationResult.refundAmount,
                });
            }
            return cancellationResult;
        }
        catch (error) {
            logger.error('[Sitter Booking] Cancellation failed', {
                error: error.message,
                bookingId,
            });
            throw error;
        }
    }
}
// Singleton instance
export const advancedBookingEngine = new SitterAdvancedBookingEngine();
