import { db } from '../db';
import { bookings, bookingPets, bookingItems, bookingStatusHistory, escrowHoldings, providerRateCards, BOOKING_STATUS_TRANSITIONS, PETWASH_COMMISSION_RATE } from '@shared/schema';
import { eq, and, lte, sql, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { logger } from '../lib/logger';
const VAT_RATE = 0.18;
const ESCROW_HOURS = 72;
// Loyalty tier thresholds and discounts
const LOYALTY_TIERS = {
    bronze: { minBookings: 3, minRating: 4.0, discountPercent: 3 },
    silver: { minBookings: 10, minRating: 4.2, discountPercent: 5 },
    gold: { minBookings: 25, minRating: 4.5, discountPercent: 8 },
    platinum: { minBookings: 50, minRating: 4.7, discountPercent: 10 },
    diamond: { minBookings: 100, minRating: 4.8, discountPercent: 15 },
};
// Multi-pet + long-stay combo discount
const COMBO_DISCOUNTS = {
    // pets >= 2 AND nights >= 7 = 5% extra
    multiPetWeekly: { minPets: 2, minNights: 7, discountPercent: 5 },
    // pets >= 3 AND nights >= 14 = 10% extra
    multiPetBiweekly: { minPets: 3, minNights: 14, discountPercent: 10 },
    // pets >= 2 AND nights >= 30 = 12% extra
    multiPetMonthly: { minPets: 2, minNights: 30, discountPercent: 12 },
};
class BookingLifecycleService {
    async getCustomerLoyaltyInfo(customerId) {
        if (!customerId)
            return null;
        try {
            const result = await db.select({
                completedCount: sql `COUNT(*) FILTER (WHERE status = 'completed')`,
                avgRating: sql `AVG(customer_rating)`,
            })
                .from(bookings)
                .where(eq(bookings.userId, customerId));
            const completedBookings = Number(result[0]?.completedCount) || 0;
            const averageRating = Number(result[0]?.avgRating) || 0;
            // Determine tier (highest matching)
            let tier = 'none';
            let discountPercent = 0;
            for (const [tierName, thresholds] of Object.entries(LOYALTY_TIERS).reverse()) {
                if (completedBookings >= thresholds.minBookings && averageRating >= thresholds.minRating) {
                    tier = tierName;
                    discountPercent = thresholds.discountPercent;
                    break;
                }
            }
            return { tier, completedBookings, averageRating, discountPercent };
        }
        catch (error) {
            logger.warn('[BookingLifecycle] Could not fetch loyalty info', { customerId, error });
            return null;
        }
    }
    calculateComboDiscount(petCount, nights) {
        // Check for combo discounts (multi-pet + long-stay)
        if (petCount >= COMBO_DISCOUNTS.multiPetMonthly.minPets && nights >= COMBO_DISCOUNTS.multiPetMonthly.minNights) {
            return { discountPercent: COMBO_DISCOUNTS.multiPetMonthly.discountPercent, discountName: 'Multi-pet monthly package (12% off)' };
        }
        if (petCount >= COMBO_DISCOUNTS.multiPetBiweekly.minPets && nights >= COMBO_DISCOUNTS.multiPetBiweekly.minNights) {
            return { discountPercent: COMBO_DISCOUNTS.multiPetBiweekly.discountPercent, discountName: 'Multi-pet bi-weekly package (10% off)' };
        }
        if (petCount >= COMBO_DISCOUNTS.multiPetWeekly.minPets && nights >= COMBO_DISCOUNTS.multiPetWeekly.minNights) {
            return { discountPercent: COMBO_DISCOUNTS.multiPetWeekly.discountPercent, discountName: 'Multi-pet weekly package (5% off)' };
        }
        return { discountPercent: 0, discountName: null };
    }
    async calculateQuote(providerId, platform, serviceType, startDate, endDate, petCount = 1, addons = [], customerId) {
        const rateCard = await db.select()
            .from(providerRateCards)
            .where(and(eq(providerRateCards.providerId, providerId), eq(providerRateCards.platform, platform), eq(providerRateCards.serviceType, serviceType), eq(providerRateCards.isActive, true)))
            .limit(1);
        if (!rateCard.length) {
            throw new Error(`No rate card found for provider ${providerId} on ${platform}`);
        }
        const card = rateCard[0];
        // Validate dates
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            throw new Error('Invalid date format provided');
        }
        if (endDate <= startDate) {
            throw new Error('End date must be after start date');
        }
        // Validate pet count
        if (petCount < 1) {
            throw new Error('At least 1 pet is required');
        }
        if (petCount > 10) {
            throw new Error('Maximum 10 pets per booking');
        }
        const nights = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        const hours = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60));
        let baseAmountCents = 0;
        if (card.baseRatePerNightCents && nights > 0) {
            baseAmountCents = card.baseRatePerNightCents * nights;
        }
        else if (card.baseRatePerHourCents && hours > 0) {
            baseAmountCents = card.baseRatePerHourCents * hours;
        }
        else if (card.baseRatePerVisitCents) {
            baseAmountCents = card.baseRatePerVisitCents;
        }
        const additionalPetsCents = petCount > 1
            ? (petCount - 1) * (card.additionalPetSurchargeCents || 0)
            : 0;
        let addonsCents = 0;
        const addonPricing = card.addonPricing || {};
        for (const addon of addons) {
            if (addonPricing[addon]) {
                addonsCents += addonPricing[addon];
            }
        }
        const startDay = startDate.getDay();
        const isWeekend = startDay === 5 || startDay === 6;
        const weekendSurchargeCents = isWeekend && card.weekendSurchargePercent
            ? Math.round(baseAmountCents * (card.weekendSurchargePercent / 100))
            : 0;
        const holidaySurchargeCents = 0;
        const appliedDiscounts = [];
        // Duration discount (provider-defined)
        let durationDiscountCents = 0;
        if (nights >= 30 && card.monthlyDiscountPercent) {
            durationDiscountCents = Math.round(baseAmountCents * (card.monthlyDiscountPercent / 100));
            appliedDiscounts.push(`Monthly stay discount (${card.monthlyDiscountPercent}% off)`);
        }
        else if (nights >= 7 && card.weeklyDiscountPercent) {
            durationDiscountCents = Math.round(baseAmountCents * (card.weeklyDiscountPercent / 100));
            appliedDiscounts.push(`Weekly stay discount (${card.weeklyDiscountPercent}% off)`);
        }
        // Combo discount (multi-pet + long-stay)
        const combo = this.calculateComboDiscount(petCount, nights);
        const preComboTotal = baseAmountCents + additionalPetsCents + addonsCents + weekendSurchargeCents - durationDiscountCents;
        const comboDiscountCents = combo.discountPercent > 0
            ? Math.round(preComboTotal * (combo.discountPercent / 100))
            : 0;
        if (combo.discountName) {
            appliedDiscounts.push(combo.discountName);
        }
        // Loyalty discount (based on customer history)
        const loyaltyInfo = await this.getCustomerLoyaltyInfo(customerId);
        const postComboTotal = preComboTotal - comboDiscountCents;
        const loyaltyDiscountCents = loyaltyInfo && loyaltyInfo.discountPercent > 0
            ? Math.round(postComboTotal * (loyaltyInfo.discountPercent / 100))
            : 0;
        if (loyaltyInfo && loyaltyInfo.tier !== 'none') {
            appliedDiscounts.push(`${loyaltyInfo.tier.charAt(0).toUpperCase() + loyaltyInfo.tier.slice(1)} member bonus (${loyaltyInfo.discountPercent}% off)`);
        }
        const subtotalCents = postComboTotal - loyaltyDiscountCents;
        const platformFeeCents = Math.round(subtotalCents * PETWASH_COMMISSION_RATE);
        const vatCents = Math.round(platformFeeCents * VAT_RATE);
        const totalCents = subtotalCents + vatCents;
        const providerEarningsCents = subtotalCents - platformFeeCents;
        return {
            baseAmountCents,
            additionalPetsCents,
            addonsCents,
            weekendSurchargeCents,
            holidaySurchargeCents,
            durationDiscountCents,
            comboDiscountCents,
            loyaltyDiscountCents,
            subtotalCents,
            platformFeeCents,
            vatCents,
            totalCents,
            providerEarningsCents,
            appliedDiscounts,
            loyaltyInfo: loyaltyInfo || undefined
        };
    }
    async createBooking(input) {
        const bookingId = nanoid(16);
        const bookingNumber = `PW-${Date.now().toString(36).toUpperCase()}-${nanoid(4).toUpperCase()}`;
        const quote = await this.calculateQuote(input.providerId, input.platformId, input.serviceType, input.startTime, input.endTime, input.petIds.length, input.selectedAddons);
        await db.insert(bookings).values({
            id: bookingId,
            bookingNumber,
            platformId: input.platformId,
            userId: input.customerId,
            providerId: input.providerProfileId,
            startTime: input.startTime,
            endTime: input.endTime,
            serviceType: input.serviceType,
            subtotal: (quote.subtotalCents / 100).toFixed(2),
            platformFee: (quote.platformFeeCents / 100).toFixed(2),
            providerPayout: (quote.providerEarningsCents / 100).toFixed(2),
            total: (quote.totalCents / 100).toFixed(2),
            status: 'inquiry',
            paymentStatus: 'pending',
            specialRequests: input.specialRequests,
            currency: 'ILS',
        });
        for (const petId of input.petIds) {
            await db.insert(bookingPets).values({
                bookingId,
                petId,
            });
        }
        if (input.selectedAddons?.length) {
            for (const addon of input.selectedAddons) {
                await db.insert(bookingItems).values({
                    bookingId,
                    itemType: 'addon',
                    name: addon,
                    quantity: 1,
                    unitPrice: '0',
                    totalPrice: '0',
                });
            }
        }
        await this.recordStatusChange(bookingId, null, 'inquiry', input.customerId, 'customer', 'Booking created');
        logger.info('[BookingLifecycle] Booking created', { bookingId, bookingNumber });
        return { bookingId, bookingNumber };
    }
    async transitionStatus(bookingId, newStatus, actorUserId, actorRole, reason) {
        const [booking] = await db.select()
            .from(bookings)
            .where(eq(bookings.id, bookingId))
            .limit(1);
        if (!booking) {
            throw new Error(`Booking ${bookingId} not found`);
        }
        const currentStatus = booking.status;
        const allowedTransitions = BOOKING_STATUS_TRANSITIONS[currentStatus] || [];
        if (!allowedTransitions.includes(newStatus)) {
            throw new Error(`Invalid transition from ${currentStatus} to ${newStatus}`);
        }
        await db.update(bookings)
            .set({
            status: newStatus,
            updatedAt: new Date(),
            ...(newStatus === 'provider_confirmed' && { confirmedAt: new Date() }),
            ...(newStatus === 'in_progress' && { startedAt: new Date() }),
            ...(newStatus === 'completed' && { completedAt: new Date() }),
            ...(newStatus === 'cancelled' && {
                cancelledAt: new Date(),
                cancelledBy: actorUserId,
                cancellationReason: reason
            }),
        })
            .where(eq(bookings.id, bookingId));
        await this.recordStatusChange(bookingId, currentStatus, newStatus, actorUserId, actorRole, reason);
        if (newStatus === 'deposit_received') {
            await this.createEscrowHolding(bookingId);
        }
        if (newStatus === 'completed') {
            await this.scheduleEscrowRelease(bookingId);
        }
        logger.info('[BookingLifecycle] Status transitioned', {
            bookingId,
            from: currentStatus,
            to: newStatus
        });
    }
    async recordStatusChange(bookingId, fromStatus, toStatus, userId, role, reason) {
        await db.insert(bookingStatusHistory).values({
            bookingId,
            fromStatus,
            toStatus,
            changedByUserId: userId,
            changedByRole: role,
            reason,
        });
    }
    async createEscrowHolding(bookingId) {
        const [booking] = await db.select()
            .from(bookings)
            .where(eq(bookings.id, bookingId))
            .limit(1);
        if (!booking)
            return;
        const grossAmountCents = Math.round(parseFloat(booking.total) * 100);
        const platformFeeCents = Math.round(parseFloat(booking.platformFee || '0') * 100);
        const vatCents = Math.round(platformFeeCents * VAT_RATE);
        const netProviderAmountCents = grossAmountCents - platformFeeCents - vatCents;
        await db.insert(escrowHoldings).values({
            escrowId: `ESC-${nanoid(12)}`,
            bookingId,
            customerId: booking.userId,
            providerId: String(booking.providerId || ''),
            grossAmountCents,
            platformFeeCents,
            vatCents,
            netProviderAmountCents,
            status: 'held',
            capturedAt: new Date(),
        });
        logger.info('[BookingLifecycle] Escrow holding created', { bookingId, grossAmountCents });
    }
    async scheduleEscrowRelease(bookingId) {
        const releaseTime = new Date(Date.now() + ESCROW_HOURS * 60 * 60 * 1000);
        await db.update(escrowHoldings)
            .set({
            serviceCompletedAt: new Date(),
            releaseEligibleAt: releaseTime,
            status: 'releasing',
            updatedAt: new Date(),
        })
            .where(eq(escrowHoldings.bookingId, bookingId));
        logger.info('[BookingLifecycle] Escrow release scheduled', {
            bookingId,
            releaseEligibleAt: releaseTime
        });
    }
    async getBookingWithHistory(bookingId) {
        const [booking] = await db.select()
            .from(bookings)
            .where(eq(bookings.id, bookingId))
            .limit(1);
        if (!booking)
            return null;
        const history = await db.select()
            .from(bookingStatusHistory)
            .where(eq(bookingStatusHistory.bookingId, bookingId))
            .orderBy(desc(bookingStatusHistory.changedAt));
        const pets = await db.select()
            .from(bookingPets)
            .where(eq(bookingPets.bookingId, bookingId));
        const items = await db.select()
            .from(bookingItems)
            .where(eq(bookingItems.bookingId, bookingId));
        const [escrow] = await db.select()
            .from(escrowHoldings)
            .where(eq(escrowHoldings.bookingId, bookingId))
            .limit(1);
        return {
            ...booking,
            statusHistory: history,
            pets,
            items,
            escrow,
        };
    }
    async getUserBookings(userId, role, limit = 50) {
        const field = role === 'customer' ? bookings.userId : sql `${bookings.providerId}::text`;
        return db.select()
            .from(bookings)
            .where(eq(role === 'customer' ? bookings.userId : sql `${bookings.providerId}::text`, userId))
            .orderBy(desc(bookings.createdAt))
            .limit(limit);
    }
    async processEscrowReleases() {
        const now = new Date();
        const eligibleEscrows = await db.select()
            .from(escrowHoldings)
            .where(and(eq(escrowHoldings.status, 'releasing'), lte(escrowHoldings.releaseEligibleAt, now)));
        let releasedCount = 0;
        for (const escrow of eligibleEscrows) {
            try {
                await db.update(escrowHoldings)
                    .set({
                    status: 'released',
                    releasedAt: now,
                    updatedAt: now,
                })
                    .where(eq(escrowHoldings.id, escrow.id));
                await db.update(bookings)
                    .set({
                    payoutStatus: 'completed',
                    payoutDate: now,
                    updatedAt: now,
                })
                    .where(eq(bookings.id, escrow.bookingId));
                releasedCount++;
                logger.info('[BookingLifecycle] Escrow released', {
                    escrowId: escrow.escrowId,
                    bookingId: escrow.bookingId,
                    amountCents: escrow.netProviderAmountCents
                });
            }
            catch (error) {
                logger.error('[BookingLifecycle] Escrow release failed', {
                    escrowId: escrow.escrowId,
                    error
                });
            }
        }
        return releasedCount;
    }
}
export const bookingLifecycleService = new BookingLifecycleService();
export default bookingLifecycleService;
