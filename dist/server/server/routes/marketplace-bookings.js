import { Router } from 'express';
import { db } from '../db';
import { bookings, bookingStatusHistory, escrowHoldings, providerRateCards, providerAvailability, quoteRequests, sitterProfiles, walkerProfiles, users } from '@shared/schema';
import { eq, and, desc, sql, gte, lte } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { logger } from '../lib/logger';
import bookingLifecycleService from '../services/BookingLifecycleService';
import { EmailService } from '../emailService';
const router = Router();
// Helper to generate friendly display names from provider IDs
function formatProviderName(providerId) {
    // Extract meaningful name from provider ID patterns like "user-ido", "demo-sitter-1", etc.
    const id = providerId.replace(/^(user-|demo-|provider-)/i, '');
    const parts = id.split(/[-_]/);
    // Capitalize first part and return
    if (parts.length > 0 && parts[0].length > 1) {
        const name = parts[0];
        return name.charAt(0).toUpperCase() + name.slice(1);
    }
    return 'Pet Care Pro';
}
router.post('/quote', async (req, res) => {
    try {
        const { providerId, platform, serviceType, startDate, endDate, petCount = 1, addons = [], customerId, slotId, lockToken } = req.body;
        // Also check header for authenticated user
        const userId = customerId || req.headers['x-user-id'];
        const quote = await bookingLifecycleService.calculateQuote(providerId, platform, serviceType, new Date(startDate), new Date(endDate), petCount, addons, userId);
        // Persist the quote to database and generate a quoteId
        const quoteId = `QUOTE-${nanoid(12)}`;
        await db.insert(quoteRequests).values({
            quoteId,
            customerId: userId || 'anonymous',
            providerId: String(providerId),
            platform,
            serviceType: serviceType || 'standard',
            startDate: new Date(startDate).toISOString().split('T')[0],
            endDate: new Date(endDate).toISOString().split('T')[0],
            petCount,
            baseAmountCents: quote.baseAmountCents,
            additionalPetsCents: quote.additionalPetsCents,
            weekendSurchargeCents: quote.weekendSurchargeCents,
            durationDiscountCents: quote.durationDiscountCents,
            comboDiscountCents: quote.comboDiscountCents,
            loyaltyDiscountCents: quote.loyaltyDiscountCents,
            platformFeeCents: quote.platformFeeCents,
            vatCents: quote.vatCents,
            totalCents: quote.totalCents,
            providerEarningsCents: quote.providerEarningsCents,
            status: 'pending',
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minute expiry
        });
        logger.info('[MarketplaceBookings] Quote created', { quoteId, userId, providerId, totalCents: quote.totalCents });
        res.json({
            success: true,
            quoteId,
            quote,
            breakdown: {
                baseAmount: (quote.baseAmountCents / 100).toFixed(2),
                additionalPets: (quote.additionalPetsCents / 100).toFixed(2),
                addons: (quote.addonsCents / 100).toFixed(2),
                weekendSurcharge: (quote.weekendSurchargeCents / 100).toFixed(2),
                durationDiscount: (quote.durationDiscountCents / 100).toFixed(2),
                comboDiscount: (quote.comboDiscountCents / 100).toFixed(2),
                loyaltyDiscount: (quote.loyaltyDiscountCents / 100).toFixed(2),
                subtotal: (quote.subtotalCents / 100).toFixed(2),
                platformFee: (quote.platformFeeCents / 100).toFixed(2),
                vat: (quote.vatCents / 100).toFixed(2),
                total: (quote.totalCents / 100).toFixed(2),
                providerEarnings: (quote.providerEarningsCents / 100).toFixed(2),
            },
            appliedDiscounts: quote.appliedDiscounts,
            loyaltyInfo: quote.loyaltyInfo
        });
    }
    catch (error) {
        logger.error('[MarketplaceBookings] Quote error', { error: error.message });
        res.status(400).json({ success: false, error: error.message });
    }
});
router.post('/create', async (req, res) => {
    try {
        const userId = req.headers['x-user-id'];
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        const { providerId, providerProfileId, platformId, serviceType, startTime, endTime, petIds, selectedAddons, specialRequests, quoteId } = req.body;
        const result = await bookingLifecycleService.createBooking({
            customerId: userId,
            providerId,
            providerProfileId,
            platformId,
            serviceType,
            startTime: new Date(startTime),
            endTime: new Date(endTime),
            petIds,
            selectedAddons,
            specialRequests,
            quoteId
        });
        res.json({
            success: true,
            booking: result,
            nextStatus: 'quote_sent'
        });
    }
    catch (error) {
        logger.error('[MarketplaceBookings] Create error', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});
router.post('/:quoteId/checkout', async (req, res) => {
    try {
        const { quoteId } = req.params;
        const userId = req.headers['x-user-id'];
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required'
            });
        }
        const { slotId, lockToken, petIds, specialInstructions } = req.body;
        // Validate required fields
        if (!slotId || !lockToken) {
            return res.status(400).json({
                success: false,
                error: 'Missing slot reservation details'
            });
        }
        // Fetch the quote to verify it exists and get pricing data
        // Query by quoteId field (the QUOTE-xxx string), not the serial id
        const [quote] = await db.select()
            .from(quoteRequests)
            .where(eq(quoteRequests.quoteId, quoteId))
            .limit(1);
        if (!quote) {
            return res.status(404).json({
                success: false,
                error: 'Quote not found or expired'
            });
        }
        // Check if quote is expired (quotes expire after 15 minutes)
        const quoteAge = Date.now() - new Date(quote.createdAt).getTime();
        const QUOTE_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes
        if (quoteAge > QUOTE_EXPIRY_MS) {
            return res.status(400).json({
                success: false,
                error: 'Quote expired. Please request a new quote.'
            });
        }
        // Verify slot lock is still valid
        const [slot] = await db.select()
            .from(providerAvailability)
            .where(eq(providerAvailability.id, slotId))
            .limit(1);
        if (!slot) {
            return res.status(400).json({
                success: false,
                error: 'Time slot not found'
            });
        }
        // Verify slot belongs to the quoted provider
        if (slot.providerId && String(slot.providerId) !== String(quote.providerId)) {
            return res.status(400).json({
                success: false,
                error: 'Slot does not match the quoted provider'
            });
        }
        // Check if slot lock token matches and hasn't expired
        if (slot.lockToken !== lockToken) {
            return res.status(400).json({
                success: false,
                error: 'Slot reservation expired. Please select a new time.'
            });
        }
        if (slot.lockExpiresAt && new Date(slot.lockExpiresAt) < new Date()) {
            return res.status(400).json({
                success: false,
                error: 'Slot reservation expired. Please select a new time.'
            });
        }
        // Create the booking using the booking lifecycle service
        const bookingResult = await bookingLifecycleService.createBooking({
            customerId: userId,
            providerId: quote.providerId,
            providerProfileId: slot.profileId ? String(slot.profileId) : quote.providerId,
            platformId: quote.platform,
            serviceType: quote.serviceType || 'standard',
            startTime: new Date(slot.startTime),
            endTime: new Date(slot.endTime),
            petIds: petIds || [],
            selectedAddons: [],
            specialRequests: specialInstructions || '',
            quoteId
        });
        // Use the bookingId returned by the service (the actual persisted ID)
        const bookingId = bookingResult.bookingId;
        const bookingNumber = bookingResult.bookingNumber;
        // Mark the slot as booked (remove lock, mark confirmed)
        await db.update(providerAvailability)
            .set({
            status: 'confirmed',
            lockToken: null,
            lockExpiresAt: null,
            bookedBy: userId
        })
            .where(eq(providerAvailability.id, slotId));
        // Create escrow record for 72-hour hold
        const escrowId = nanoid(16);
        const releaseEligibleAt = new Date();
        releaseEligibleAt.setHours(releaseEligibleAt.getHours() + 72); // 72-hour escrow
        await db.insert(escrowHoldings).values({
            id: escrowId,
            bookingId,
            grossAmountCents: quote.totalCents || 0,
            platformFeeCents: quote.platformFeeCents || 0,
            vatCents: quote.vatCents || 0,
            netProviderAmountCents: quote.providerEarningsCents || 0,
            status: 'pending_payment',
            releaseEligibleAt,
            createdAt: new Date()
        });
        // Generate invoice number: INV-YYYYMMDD-XXXX
        const now = new Date();
        const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
        const invoiceNumber = `INV-${datePart}-${nanoid(6).toUpperCase()}`;
        // Look up customer and provider details for email
        const [customer] = await db.select()
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);
        // Try to get provider name from sitter or walker profiles
        let providerName = 'Your Service Provider';
        const [sitterProfile] = await db.select()
            .from(sitterProfiles)
            .where(eq(sitterProfiles.userId, quote.providerId))
            .limit(1);
        if (sitterProfile?.displayName) {
            providerName = sitterProfile.displayName;
        }
        else {
            const [walkerProfile] = await db.select()
                .from(walkerProfiles)
                .where(eq(walkerProfiles.userId, quote.providerId))
                .limit(1);
            if (walkerProfile?.displayName) {
                providerName = walkerProfile.displayName;
            }
        }
        // Platform name mapping
        const platformNames = {
            sitter_suite: 'The Sitter Suite™',
            walk_my_pet: 'Walk My Pet™',
            pet_trek: 'PetTrek™',
            grooming: 'Premium Grooming',
            training_academy: 'Training Academy',
            daycare: 'Pet Daycare',
            k9000: 'K9000™ Self-Wash'
        };
        const platformName = platformNames[quote.platform || ''] || quote.platform || 'Pet Wash™ Service';
        // Persist invoice number to booking record (in platformData JSON field)
        await db.update(bookings)
            .set({
            platformData: sql `COALESCE(platform_data, '{}'::jsonb) || ${JSON.stringify({ invoiceNumber, invoiceGeneratedAt: new Date().toISOString() })}::jsonb`
        })
            .where(eq(bookings.id, bookingId));
        logger.info('[MarketplaceBookings] Invoice number persisted', { bookingId, invoiceNumber });
        // Send booking confirmation email (async, don't block response)
        if (customer?.email) {
            const customerName = customer.displayName || customer.firstName || customer.email.split('@')[0];
            EmailService.sendBookingConfirmation({
                email: customer.email,
                customerName,
                bookingId,
                invoiceNumber,
                platformName,
                serviceType: quote.serviceType || 'Standard Service',
                providerName,
                startDate: new Date(slot.startTime),
                endDate: new Date(slot.endTime),
                totalAmountCents: quote.totalCents || 0,
                loyaltyDiscountCents: quote.loyaltyDiscountCents || 0,
                escrowReleaseDate: releaseEligibleAt,
                language: 'he' // Default to Hebrew for Israeli market
            }).catch(err => {
                logger.error('[MarketplaceBookings] Failed to send confirmation email', { error: err.message });
            });
        }
        // In production, we would generate a Nayax payment URL here
        // For now, return demo mode response
        const isNayaxConfigured = process.env.NAYAX_API_KEY && process.env.NAYAX_MERCHANT_ID;
        if (isNayaxConfigured) {
            // TODO: Generate real Nayax payment URL
            // const paymentUrl = await nayaxService.createPaymentSession({
            //   amountCents: quote.totalCents,
            //   bookingId,
            //   returnUrl: `${process.env.APP_URL}/bookings/${bookingId}/success`,
            //   cancelUrl: `${process.env.APP_URL}/bookings/${bookingId}/cancel`
            // });
            return res.json({
                success: true,
                bookingId,
                bookingNumber,
                invoiceNumber,
                paymentUrl: `/payment/nayax/${bookingId}` // Placeholder
            });
        }
        // Demo mode - booking created without payment
        logger.info('[MarketplaceBookings] Checkout completed (demo mode)', {
            bookingId,
            bookingNumber,
            quoteId,
            userId,
            invoiceNumber
        });
        res.json({
            success: true,
            bookingId,
            bookingNumber,
            invoiceNumber,
            message: 'Booking created successfully (demo mode - payment skipped)'
        });
    }
    catch (error) {
        logger.error('[MarketplaceBookings] Checkout error', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});
router.get('/my-bookings', async (req, res) => {
    try {
        const userId = req.headers['x-user-id'];
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        const role = req.query.role || 'customer';
        const limit = parseInt(req.query.limit) || 50;
        const userBookings = await bookingLifecycleService.getUserBookings(userId, role, limit);
        res.json({ success: true, bookings: userBookings });
    }
    catch (error) {
        logger.error('[MarketplaceBookings] Fetch error', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});
router.get('/:bookingId', async (req, res) => {
    try {
        const { bookingId } = req.params;
        const booking = await bookingLifecycleService.getBookingWithHistory(bookingId);
        if (!booking) {
            return res.status(404).json({ error: 'Booking not found' });
        }
        res.json({ success: true, booking });
    }
    catch (error) {
        logger.error('[MarketplaceBookings] Get error', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});
router.post('/:bookingId/transition', async (req, res) => {
    try {
        const userId = req.headers['x-user-id'];
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        const { bookingId } = req.params;
        const { newStatus, role = 'customer', reason } = req.body;
        await bookingLifecycleService.transitionStatus(bookingId, newStatus, userId, role, reason);
        const updatedBooking = await bookingLifecycleService.getBookingWithHistory(bookingId);
        res.json({
            success: true,
            booking: updatedBooking,
            message: `Status updated to ${newStatus}`
        });
    }
    catch (error) {
        logger.error('[MarketplaceBookings] Transition error', { error: error.message });
        res.status(400).json({ success: false, error: error.message });
    }
});
router.post('/:bookingId/confirm', async (req, res) => {
    try {
        const userId = req.headers['x-user-id'];
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        const { bookingId } = req.params;
        const { role = 'customer' } = req.body;
        const targetStatus = role === 'provider' ? 'provider_confirmed' : 'owner_confirmed';
        await bookingLifecycleService.transitionStatus(bookingId, targetStatus, userId, role, 'Booking confirmed');
        res.json({ success: true, status: targetStatus });
    }
    catch (error) {
        logger.error('[MarketplaceBookings] Confirm error', { error: error.message });
        res.status(400).json({ success: false, error: error.message });
    }
});
router.post('/:bookingId/start', async (req, res) => {
    try {
        const userId = req.headers['x-user-id'];
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        const { bookingId } = req.params;
        await bookingLifecycleService.transitionStatus(bookingId, 'in_progress', userId, 'provider', 'Service started');
        res.json({ success: true, status: 'in_progress' });
    }
    catch (error) {
        logger.error('[MarketplaceBookings] Start error', { error: error.message });
        res.status(400).json({ success: false, error: error.message });
    }
});
router.post('/:bookingId/complete', async (req, res) => {
    try {
        const userId = req.headers['x-user-id'];
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        const { bookingId } = req.params;
        const { role = 'provider' } = req.body;
        const targetStatus = role === 'provider'
            ? 'provider_completion_review'
            : 'owner_completion_review';
        await bookingLifecycleService.transitionStatus(bookingId, targetStatus, userId, role, 'Service marked complete');
        const booking = await bookingLifecycleService.getBookingWithHistory(bookingId);
        const ownerReviewed = booking?.statusHistory.some(h => h.toStatus === 'owner_completion_review');
        const providerReviewed = booking?.statusHistory.some(h => h.toStatus === 'provider_completion_review');
        if (ownerReviewed && providerReviewed) {
            await bookingLifecycleService.transitionStatus(bookingId, 'completed', 'system', 'system', 'Both parties confirmed completion');
        }
        const updatedBooking = await bookingLifecycleService.getBookingWithHistory(bookingId);
        res.json({ success: true, booking: updatedBooking });
    }
    catch (error) {
        logger.error('[MarketplaceBookings] Complete error', { error: error.message });
        res.status(400).json({ success: false, error: error.message });
    }
});
router.post('/:bookingId/cancel', async (req, res) => {
    try {
        const userId = req.headers['x-user-id'];
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        const { bookingId } = req.params;
        const { reason, role = 'customer' } = req.body;
        await bookingLifecycleService.transitionStatus(bookingId, 'cancelled', userId, role, reason || 'Booking cancelled');
        res.json({ success: true, status: 'cancelled' });
    }
    catch (error) {
        logger.error('[MarketplaceBookings] Cancel error', { error: error.message });
        res.status(400).json({ success: false, error: error.message });
    }
});
router.get('/:bookingId/history', async (req, res) => {
    try {
        const { bookingId } = req.params;
        const history = await db.select()
            .from(bookingStatusHistory)
            .where(eq(bookingStatusHistory.bookingId, bookingId))
            .orderBy(desc(bookingStatusHistory.changedAt));
        res.json({ success: true, history });
    }
    catch (error) {
        logger.error('[MarketplaceBookings] History error', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});
router.get('/:bookingId/escrow', async (req, res) => {
    try {
        const { bookingId } = req.params;
        const [escrow] = await db.select()
            .from(escrowHoldings)
            .where(eq(escrowHoldings.bookingId, bookingId))
            .limit(1);
        if (!escrow) {
            return res.status(404).json({ error: 'Escrow not found' });
        }
        res.json({
            success: true,
            escrow: {
                ...escrow,
                grossAmount: (escrow.grossAmountCents / 100).toFixed(2),
                platformFee: (escrow.platformFeeCents / 100).toFixed(2),
                vat: (escrow.vatCents / 100).toFixed(2),
                providerAmount: (escrow.netProviderAmountCents / 100).toFixed(2),
                hoursUntilRelease: escrow.releaseEligibleAt
                    ? Math.max(0, Math.ceil((new Date(escrow.releaseEligibleAt).getTime() - Date.now()) / (1000 * 60 * 60)))
                    : null
            }
        });
    }
    catch (error) {
        logger.error('[MarketplaceBookings] Escrow error', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});
router.get('/provider/:providerId/rate-card', async (req, res) => {
    try {
        const { providerId } = req.params;
        const { platform, serviceType } = req.query;
        let query = db.select()
            .from(providerRateCards)
            .where(eq(providerRateCards.providerId, providerId));
        const rateCards = await query;
        res.json({
            success: true,
            rateCards: rateCards.map(card => ({
                ...card,
                baseRatePerNight: card.baseRatePerNightCents ? (card.baseRatePerNightCents / 100).toFixed(2) : null,
                baseRatePerHour: card.baseRatePerHourCents ? (card.baseRatePerHourCents / 100).toFixed(2) : null,
                baseRatePerVisit: card.baseRatePerVisitCents ? (card.baseRatePerVisitCents / 100).toFixed(2) : null,
                additionalPetSurcharge: card.additionalPetSurchargeCents ? (card.additionalPetSurchargeCents / 100).toFixed(2) : null,
            }))
        });
    }
    catch (error) {
        logger.error('[MarketplaceBookings] Rate card error', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});
// MadPaws-style provider search with availability filtering
router.get('/search/providers', async (req, res) => {
    try {
        const { platform, serviceType, startDate, endDate, city, minRating = 0, page = 1, limit = 20 } = req.query;
        const offset = (Number(page) - 1) * Number(limit);
        const platformStr = platform;
        const cityStr = city;
        // Build query with filters
        let whereConditions = [eq(providerRateCards.isActive, true)];
        if (platform) {
            whereConditions.push(eq(providerRateCards.platform, platformStr));
        }
        if (serviceType) {
            whereConditions.push(eq(providerRateCards.serviceType, serviceType));
        }
        // Fetch rate cards
        const rateCards = await db.select()
            .from(providerRateCards)
            .where(and(...whereConditions))
            .limit(Number(limit) * 5) // Fetch more to filter by city later
            .offset(offset);
        // Filter by availability if dates provided
        let availableRateCards = rateCards;
        if (startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            const providerIds = rateCards.map(rc => rc.providerId);
            if (providerIds.length > 0) {
                // Find providers unavailable during requested dates
                const unavailableProviders = await db.selectDistinct({ providerId: providerAvailability.providerId })
                    .from(providerAvailability)
                    .where(and(sql `${providerAvailability.providerId} IN (${sql.join(providerIds.map(id => sql `${id}`), sql `, `)})`, gte(providerAvailability.date, start), lte(providerAvailability.date, end), eq(providerAvailability.isAvailable, false)));
                const unavailableIds = new Set(unavailableProviders.map(p => p.providerId));
                availableRateCards = rateCards.filter(rc => !unavailableIds.has(rc.providerId));
            }
        }
        // Enrich with profile data based on platform
        const providerIds = availableRateCards.map(rc => rc.providerId);
        let profileMap = new Map();
        if (providerIds.length > 0) {
            if (platformStr === 'sitter_suite') {
                const profiles = await db.select({
                    userId: sitterProfiles.userId,
                    firstName: sitterProfiles.firstName,
                    lastName: sitterProfiles.lastName,
                    bio: sitterProfiles.bio,
                    profilePhotoUrl: sitterProfiles.profilePictureUrl,
                    city: sitterProfiles.city,
                    rating: sitterProfiles.rating,
                    totalBookings: sitterProfiles.totalBookings,
                })
                    .from(sitterProfiles)
                    .where(sql `${sitterProfiles.userId} IN (${sql.join(providerIds.map(id => sql `${id}`), sql `, `)})`);
                profiles.forEach(p => {
                    profileMap.set(p.userId, {
                        displayName: `${p.firstName} ${p.lastName}`,
                        bio: p.bio,
                        profilePhotoUrl: p.profilePhotoUrl,
                        city: p.city,
                        rating: p.rating ? parseFloat(p.rating) : null,
                        reviewCount: p.totalBookings || 0,
                    });
                });
            }
            else if (platformStr === 'walk_my_pet') {
                const profiles = await db.select({
                    walkerId: walkerProfiles.walkerId,
                    firstName: walkerProfiles.firstName,
                    lastName: walkerProfiles.lastName,
                    bio: walkerProfiles.bio,
                    profilePhotoUrl: walkerProfiles.profilePictureUrl,
                    city: walkerProfiles.city,
                    rating: walkerProfiles.rating,
                    totalWalks: walkerProfiles.totalWalks,
                })
                    .from(walkerProfiles)
                    .where(sql `${walkerProfiles.walkerId} IN (${sql.join(providerIds.map(id => sql `${id}`), sql `, `)})`);
                profiles.forEach(p => {
                    profileMap.set(p.walkerId, {
                        displayName: `${p.firstName} ${p.lastName}`,
                        bio: p.bio,
                        profilePhotoUrl: p.profilePhotoUrl,
                        city: p.city,
                        rating: p.rating ? parseFloat(p.rating) : null,
                        reviewCount: p.totalWalks || 0,
                    });
                });
            }
        }
        // Format response using actual rate card values enriched with profile data
        const results = availableRateCards.map(provider => {
            const profile = profileMap.get(provider.providerId);
            return {
                id: provider.providerId,
                platform: provider.platform,
                serviceType: provider.serviceType,
                displayName: profile?.displayName || profile?.businessName || profile?.firstName || formatProviderName(provider.providerId),
                bio: profile?.bio || null,
                profilePhotoUrl: profile?.profilePhotoUrl || null,
                location: profile?.city || null,
                rating: profile?.rating || null,
                reviewCount: profile?.reviewCount || 0,
                pricing: {
                    perNight: provider.baseRatePerNightCents ? (provider.baseRatePerNightCents / 100).toFixed(2) : null,
                    perHour: provider.baseRatePerHourCents ? (provider.baseRatePerHourCents / 100).toFixed(2) : null,
                    additionalPet: provider.additionalPetSurchargeCents ? (provider.additionalPetSurchargeCents / 100).toFixed(2) : null,
                    currency: 'ILS'
                },
                maxPets: provider.maxPets || 4,
                acceptedPetTypes: provider.enabledAddons || ['dog', 'cat'],
                addons: provider.enabledAddons || [],
                instantBooking: provider.minBookingHours === 0,
                cancellationPolicy: 'flexible',
            };
        });
        // Filter by city if specified (case-insensitive partial match for Hebrew/English)
        let filteredResults = results;
        if (cityStr && cityStr.trim().length > 0) {
            const searchCity = cityStr.trim().toLowerCase();
            filteredResults = results.filter(r => {
                if (!r.location)
                    return false;
                const providerCity = r.location.toLowerCase();
                // Match if provider city contains search term or search term contains provider city
                return providerCity.includes(searchCity) || searchCity.includes(providerCity);
            });
        }
        // Filter by minimum rating if specified
        if (Number(minRating) > 0) {
            filteredResults = filteredResults.filter(r => (r.rating || 0) >= Number(minRating));
        }
        // Apply pagination limit
        const paginatedResults = filteredResults.slice(0, Number(limit));
        res.json({
            success: true,
            providers: paginatedResults,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total: filteredResults.length,
                hasMore: filteredResults.length > Number(limit)
            },
            filters: { platform, serviceType, startDate, endDate, city, minRating }
        });
    }
    catch (error) {
        logger.error('[MarketplaceBookings] Provider search error', { error: error?.message || String(error) });
        res.status(500).json({ success: false, error: error?.message || 'Search failed' });
    }
});
// Get provider availability calendar
router.get('/provider/:providerId/availability', async (req, res) => {
    try {
        const { providerId } = req.params;
        const { startDate, endDate, platform } = req.query;
        const start = startDate ? new Date(startDate) : new Date();
        const end = endDate ? new Date(endDate) : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 90 days
        const availability = await db.select()
            .from(providerAvailability)
            .where(and(eq(providerAvailability.providerId, providerId), gte(providerAvailability.date, start), lte(providerAvailability.date, end), platform ? eq(providerAvailability.platform, platform) : sql `true`))
            .orderBy(providerAvailability.date);
        // Create date map for easy lookup
        const dateMap = {};
        availability.forEach(slot => {
            const dateStr = slot.date.toISOString().split('T')[0];
            dateMap[dateStr] = {
                available: slot.isAvailable || false,
                price: slot.customPriceCents ? slot.customPriceCents / 100 : undefined,
                bookingsCount: slot.currentBookingsCount || 0
            };
        });
        res.json({
            success: true,
            providerId,
            availability: dateMap,
            range: { start: start.toISOString(), end: end.toISOString() }
        });
    }
    catch (error) {
        logger.error('[MarketplaceBookings] Availability error', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});
// Provider updates their availability
router.post('/provider/:providerId/availability', async (req, res) => {
    try {
        const userId = req.headers['x-user-id'];
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        const { providerId } = req.params;
        const { dates, isAvailable, customPrice, platform, maxBookings, notes } = req.body;
        // Validate provider owns this rate card
        const [rateCard] = await db.select()
            .from(providerRateCards)
            .where(and(eq(providerRateCards.providerId, providerId), eq(providerRateCards.providerId, userId)))
            .limit(1);
        // For now, allow any authenticated user to update for testing
        // In production, enforce ownership check
        const results = [];
        for (const dateStr of dates) {
            const date = new Date(dateStr);
            const [existing] = await db.select()
                .from(providerAvailability)
                .where(and(eq(providerAvailability.providerId, providerId), eq(providerAvailability.date, date), eq(providerAvailability.platform, platform || 'sitter_suite')))
                .limit(1);
            if (existing) {
                await db.update(providerAvailability)
                    .set({
                    isAvailable,
                    customPriceCents: customPrice ? Math.round(customPrice * 100) : null,
                    maxBookingsPerDay: maxBookings,
                    notes,
                    updatedAt: new Date()
                })
                    .where(eq(providerAvailability.id, existing.id));
                results.push({ date: dateStr, action: 'updated' });
            }
            else {
                await db.insert(providerAvailability).values({
                    providerId,
                    platform: platform || 'sitter_suite',
                    date,
                    isAvailable,
                    customPriceCents: customPrice ? Math.round(customPrice * 100) : null,
                    maxBookingsPerDay: maxBookings || 1,
                    notes
                });
                results.push({ date: dateStr, action: 'created' });
            }
        }
        res.json({ success: true, updates: results });
    }
    catch (error) {
        logger.error('[MarketplaceBookings] Update availability error', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});
// Provider creates/updates their rate card
router.post('/provider/rate-card', async (req, res) => {
    try {
        const userId = req.headers['x-user-id'];
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        const { platform, serviceType, baseRatePerNight, baseRatePerHour, baseRatePerVisit, additionalPetSurcharge, weekendSurchargePercent, holidaySurchargePercent, maxPets, acceptedPetTypes, addons, instantBooking, cancellationPolicy, displayName, bio, profilePhotoUrl, location } = req.body;
        // Check if rate card exists
        const [existing] = await db.select()
            .from(providerRateCards)
            .where(and(eq(providerRateCards.providerId, userId), eq(providerRateCards.platform, platform), eq(providerRateCards.serviceType, serviceType)))
            .limit(1);
        const rateCardData = {
            baseRatePerNightCents: baseRatePerNight ? Math.round(baseRatePerNight * 100) : null,
            baseRatePerHourCents: baseRatePerHour ? Math.round(baseRatePerHour * 100) : null,
            baseRatePerVisitCents: baseRatePerVisit ? Math.round(baseRatePerVisit * 100) : null,
            additionalPetSurchargeCents: additionalPetSurcharge ? Math.round(additionalPetSurcharge * 100) : null,
            weekendSurchargePercent: weekendSurchargePercent || 0,
            holidaySurchargePercent: holidaySurchargePercent || 0,
            maxPets: maxPets || 4,
            acceptedPetTypes: acceptedPetTypes || ['dog', 'cat'],
            addonsAvailable: addons || [],
            instantBooking: instantBooking || false,
            cancellationPolicy: cancellationPolicy || 'flexible',
            displayName,
            bio,
            profilePhotoUrl,
            location,
            isActive: true,
            updatedAt: new Date()
        };
        if (existing) {
            await db.update(providerRateCards)
                .set(rateCardData)
                .where(eq(providerRateCards.id, existing.id));
            res.json({ success: true, action: 'updated', rateCardId: existing.rateCardId });
        }
        else {
            const rateCardId = `RATE-${nanoid(12)}`;
            await db.insert(providerRateCards).values({
                rateCardId,
                providerId: userId,
                platform,
                serviceType,
                ...rateCardData
            });
            res.json({ success: true, action: 'created', rateCardId });
        }
    }
    catch (error) {
        logger.error('[MarketplaceBookings] Rate card error', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});
router.post('/process-escrow-releases', async (req, res) => {
    try {
        const adminKey = req.headers['x-admin-key'];
        if (adminKey !== process.env.ADMIN_API_KEY) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        const releasedCount = await bookingLifecycleService.processEscrowReleases();
        res.json({
            success: true,
            message: `Released ${releasedCount} escrow holdings`
        });
    }
    catch (error) {
        logger.error('[MarketplaceBookings] Escrow release error', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});
export default router;
