/**
 * THE SITTER SUITE™ - Backend API Routes
 * 
 * Revolutionary pet sitting marketplace with Nayax split payments
 * Like Booking.com/Airbnb - Apple-level premium experience
 */

import { Router } from 'express';
import { db } from '../db';
import {
  sitterProfiles,
  petProfilesForSitting,
  sitterBookings,
  sitterReviews,
  insertSitterProfileSchema,
  insertPetProfileForSittingSchema,
  insertSitterBookingSchema,
  insertSitterReviewSchema,
  type SitterProfile,
  type PetProfileForSitting,
  type SitterBooking,
  type SitterReview,
} from '@shared/schema';
import { eq, and, desc, sql, gte, lte } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { nanoid } from 'nanoid';
import { nayaxSitterMarketplace } from '../services/NayaxSitterMarketplaceService';
import { sitterAITriageService } from '../services/SitterAITriageService';
import { requireLoyaltyMember } from '../middleware/loyalty';
import { geocodeAddress } from '../services/location/MapsService';
import { buildAllNavigationLinks } from '../utils/navigation';

const router = Router();

// ==================== SITTER PROFILES ====================

/**
 * GET /api/sitter-suite/sitters - Browse available sitters
 */
router.get('/sitters', async (req, res) => {
  try {
    const { city, specialization, minRating } = req.query;
    
    // SELECT only the columns that exist in our simplified schema
    const sitters = await db.select({
      id: sitterProfiles.id,
      userId: sitterProfiles.userId,
      firstName: sitterProfiles.firstName,
      lastName: sitterProfiles.lastName,
      email: sitterProfiles.email,
      phone: sitterProfiles.phone,
      city: sitterProfiles.city,
      bio: sitterProfiles.bio,
      yearsOfExperience: sitterProfiles.yearsOfExperience,
      pricePerDayCents: sitterProfiles.pricePerDayCents,
      profilePictureUrl: sitterProfiles.profilePictureUrl,
      rating: sitterProfiles.rating,
      totalBookings: sitterProfiles.totalBookings,
      isActive: sitterProfiles.isActive,
      isVerified: sitterProfiles.isVerified,
      createdAt: sitterProfiles.createdAt,
    })
    .from(sitterProfiles)
    .where(eq(sitterProfiles.isActive, true))
    .orderBy(desc(sitterProfiles.rating))
    .limit(50);
    
    logger.info('[Sitter Suite] Sitters browsed', {
      count: sitters.length,
      city,
      specialization,
    });
    
    res.json(sitters);
  } catch (error) {
    logger.error('[Sitter Suite] Error fetching sitters', error);
    res.status(500).json({ error: 'Failed to fetch sitters' });
  }
});

/**
 * GET /api/sitter-suite/sitters/:id - Get sitter profile
 */
router.get('/sitters/:id', async (req, res) => {
  try {
    const sitterId = parseInt(req.params.id);
    
    // SELECT only the columns that exist in our simplified schema
    const [sitter] = await db
      .select({
        id: sitterProfiles.id,
        userId: sitterProfiles.userId,
        firstName: sitterProfiles.firstName,
        lastName: sitterProfiles.lastName,
        email: sitterProfiles.email,
        phone: sitterProfiles.phone,
        city: sitterProfiles.city,
        bio: sitterProfiles.bio,
        yearsOfExperience: sitterProfiles.yearsOfExperience,
        pricePerDayCents: sitterProfiles.pricePerDayCents,
        profilePictureUrl: sitterProfiles.profilePictureUrl,
        rating: sitterProfiles.rating,
        totalBookings: sitterProfiles.totalBookings,
        isActive: sitterProfiles.isActive,
        isVerified: sitterProfiles.isVerified,
        createdAt: sitterProfiles.createdAt,
      })
      .from(sitterProfiles)
      .where(eq(sitterProfiles.id, sitterId));
    
    if (!sitter) {
      return res.status(404).json({ error: 'Sitter not found' });
    }
    
    // Get reviews - SELECT only existing columns
    const reviews = await db
      .select({
        id: sitterReviews.id,
        sitterId: sitterReviews.sitterId,
        rating: sitterReviews.rating,
        comment: sitterReviews.comment,
        createdAt: sitterReviews.createdAt,
      })
      .from(sitterReviews)
      .where(eq(sitterReviews.sitterId, sitterId))
      .orderBy(desc(sitterReviews.createdAt))
      .limit(10);
    
    res.json({
      sitter,
      reviews,
    });
  } catch (error) {
    logger.error('[Sitter Suite] Error fetching sitter', error);
    res.status(500).json({ error: 'Failed to fetch sitter' });
  }
});

/**
 * POST /api/sitter-suite/sitters - Create sitter profile
 */
router.post('/sitters', async (req, res) => {
  try {
    const validatedData = insertSitterProfileSchema.parse(req.body);
    
    const [newSitter] = await db
      .insert(sitterProfiles)
      .values(validatedData)
      .returning();
    
    logger.info('[Sitter Suite] Sitter profile created', {
      sitterId: newSitter.id,
      city: newSitter.city,
    });
    
    res.status(201).json(newSitter);
  } catch (error) {
    logger.error('[Sitter Suite] Error creating sitter', error);
    res.status(400).json({ error: 'Failed to create sitter profile' });
  }
});

// ==================== PET PROFILES ====================

/**
 * GET /api/sitter-suite/pets - Get user's pets for sitting
 */
router.get('/pets', async (req, res) => {
  try {
    const userId = req.query.userId as string;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId required' });
    }
    
    const pets = await db
      .select()
      .from(petProfilesForSitting)
      .where(eq(petProfilesForSitting.userId, userId));
    
    res.json(pets);
  } catch (error) {
    logger.error('[Sitter Suite] Error fetching pets', error);
    res.status(500).json({ error: 'Failed to fetch pets' });
  }
});

/**
 * POST /api/sitter-suite/pets - Create pet profile for sitting
 */
router.post('/pets', async (req, res) => {
  try {
    const validatedData = insertPetProfileForSittingSchema.parse(req.body);
    
    const [newPet] = await db
      .insert(petProfilesForSitting)
      .values(validatedData)
      .returning();
    
    logger.info('[Sitter Suite] Pet profile created', {
      petId: newPet.id,
      name: newPet.name,
      userId: newPet.userId,
    });
    
    res.status(201).json(newPet);
  } catch (error) {
    logger.error('[Sitter Suite] Error creating pet profile', error);
    res.status(400).json({ error: 'Failed to create pet profile' });
  }
});

// ==================== BOOKINGS ====================

/**
 * POST /api/sitter-suite/bookings - Create new booking with AI triage (LOYALTY MEMBERS ONLY)
 */
router.post('/bookings', requireLoyaltyMember, async (req, res) => {
  try {
    const {
      ownerId,
      sitterId,
      petId,
      startDate,
      endDate,
      specialInstructions,
      ownerPaymentToken,
    } = req.body;
    
    // Fetch sitter and pet info
    const [sitter] = await db
      .select()
      .from(sitterProfiles)
      .where(eq(sitterProfiles.id, sitterId));
    
    const [pet] = await db
      .select()
      .from(petProfilesForSitting)
      .where(eq(petProfilesForSitting.id, petId));
    
    if (!sitter || !pet) {
      return res.status(404).json({ error: 'Sitter or pet not found' });
    }
    
    // Calculate days and fees
    const start = new Date(startDate);
    const end = new Date(endDate);
    const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    
    const fees = nayaxSitterMarketplace.calculateBookingTotal(
      sitter.pricePerDayCents,
      totalDays
    );
    
    // AI Triage Analysis
    const triageResult = await sitterAITriageService.analyzeBookingUrgency({
      startDate: start,
      endDate: end,
      petType: pet.breed,
      specialNeeds: pet.specialNeeds || undefined,
      allergies: pet.allergies ? JSON.stringify(pet.allergies) : undefined,
      city: sitter.city,
      ownerMessage: specialInstructions,
    });
    
    // Generate booking ID
    const bookingId = `SITTER_${nanoid(12)}`;
    
    // Process payment via Nayax
    const paymentResult = await nayaxSitterMarketplace.processBookingPayment({
      bookingId,
      ownerId,
      sitterId,
      pricePerDayCents: sitter.pricePerDayCents,
      totalDays,
      ownerPaymentToken,
    });
    
    if (!paymentResult.success) {
      logger.error('[Sitter Suite] Payment failed', {
        bookingId,
        error: paymentResult.error,
      });
      return res.status(400).json({ error: paymentResult.error });
    }
    
    // Create booking record
    const [newBooking] = await db
      .insert(sitterBookings)
      .values({
        bookingId,
        ownerId,
        sitterId,
        petId,
        startDate: start,
        endDate: end,
        totalDays,
        basePriceCents: fees.basePriceCents,
        platformServiceFeeCents: fees.platformServiceFeeCents,
        brokerCutCents: fees.brokerCutCents,
        sitterPayoutCents: fees.sitterPayoutCents,
        totalChargeCents: fees.totalChargeCents,
        nayaxTransactionId: paymentResult.nayaxTransactionId,
        paymentStatus: 'captured',
        urgencyScore: triageResult.urgencyScore,
        aiTriageNotes: triageResult.triageNotes,
        specialInstructions,
        status: 'confirmed',
        confirmedAt: new Date(),
      })
      .returning();
    
    logger.info('[Sitter Suite] ✅ Booking created successfully', {
      bookingId,
      urgencyScore: triageResult.urgencyScore,
      brokerProfit: fees.brokerCut, // Our 5% cut 💰
      sitterPayout: fees.sitterPayout,
    });
    
    // Generate navigation links to sitter's location
    let navigationLinks = undefined;
    if (sitter.latitude && sitter.longitude) {
      navigationLinks = buildAllNavigationLinks({
        lat: parseFloat(sitter.latitude),
        lng: parseFloat(sitter.longitude),
        label: `Pet Sitting: ${sitter.displayName}`,
      });
    }
    
    res.status(201).json({
      booking: newBooking,
      triage: triageResult,
      fees,
      navigation: navigationLinks,
    });
    
  } catch (error) {
    logger.error('[Sitter Suite] Error creating booking', error);
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

/**
 * GET /api/sitter-suite/bookings - Get user's bookings
 */
router.get('/bookings', async (req, res) => {
  try {
    const userId = req.query.userId as string;
    const role = req.query.role as 'owner' | 'sitter'; // owner or sitter
    
    if (!userId || !role) {
      return res.status(400).json({ error: 'userId and role required' });
    }
    
    let bookings;
    
    if (role === 'owner') {
      bookings = await db
        .select()
        .from(sitterBookings)
        .where(eq(sitterBookings.ownerId, userId))
        .orderBy(desc(sitterBookings.createdAt));
    } else {
      // Get sitter profile first
      const [sitterProfile] = await db
        .select()
        .from(sitterProfiles)
        .where(eq(sitterProfiles.userId, userId));
      
      if (!sitterProfile) {
        return res.json([]);
      }
      
      bookings = await db
        .select()
        .from(sitterBookings)
        .where(eq(sitterBookings.sitterId, sitterProfile.id))
        .orderBy(desc(sitterBookings.createdAt));
    }
    
    res.json(bookings);
  } catch (error) {
    logger.error('[Sitter Suite] Error fetching bookings', error);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

/**
 * PATCH /api/sitter-suite/bookings/:id/complete - Complete booking and trigger sitter payout
 */
router.patch('/bookings/:id/complete', async (req, res) => {
  try {
    const bookingId = parseInt(req.params.id);
    
    const [booking] = await db
      .select()
      .from(sitterBookings)
      .where(eq(sitterBookings.id, bookingId));
    
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    
    // Process sitter payout
    const payoutResult = await nayaxSitterMarketplace.processSitterPayout({
      bookingId: booking.bookingId,
      sitterId: booking.sitterId,
      sitterPayoutCents: booking.sitterPayoutCents,
      sitterBankAccount: 'TBD', // Get from sitter profile
    });
    
    if (!payoutResult.success) {
      return res.status(500).json({ error: 'Payout failed' });
    }
    
    // Update booking status
    const [updatedBooking] = await db
      .update(sitterBookings)
      .set({
        status: 'completed',
        payoutStatus: 'completed',
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(sitterBookings.id, bookingId))
      .returning();
    
    logger.info('[Sitter Suite] ✅ Booking completed, sitter paid', {
      bookingId: booking.bookingId,
      payoutCents: booking.sitterPayoutCents,
    });
    
    res.json(updatedBooking);
    
  } catch (error) {
    logger.error('[Sitter Suite] Error completing booking', error);
    res.status(500).json({ error: 'Failed to complete booking' });
  }
});

// ==================== REVIEWS ====================

/**
 * POST /api/sitter-suite/reviews - Submit review for completed booking
 */
router.post('/reviews', async (req, res) => {
  try {
    const validatedData = insertSitterReviewSchema.parse(req.body);
    
    const [newReview] = await db
      .insert(sitterReviews)
      .values(validatedData)
      .returning();
    
    // Update sitter's average rating
    const allReviews = await db
      .select()
      .from(sitterReviews)
      .where(eq(sitterReviews.sitterId, validatedData.sitterId));
    
    const avgRating = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;
    
    await db
      .update(sitterProfiles)
      .set({ 
        rating: avgRating.toFixed(2),
        updatedAt: new Date(),
      })
      .where(eq(sitterProfiles.id, validatedData.sitterId));
    
    logger.info('[Sitter Suite] Review submitted', {
      sitterId: validatedData.sitterId,
      rating: validatedData.rating,
      newAvgRating: avgRating.toFixed(2),
    });
    
    res.status(201).json(newReview);
  } catch (error) {
    logger.error('[Sitter Suite] Error submitting review', error);
    res.status(400).json({ error: 'Failed to submit review' });
  }
});

// ==================== PROXIMITY SEARCH (Like Uber) ====================

/**
 * POST /api/sitter-suite/search/nearby - Find sitters near user location
 * LOYALTY MEMBERS ONLY
 */
router.post('/search/nearby', async (req, res) => {
  try {
    const { latitude, longitude, radiusKm, loyaltyTier } = req.body;
    
    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Location coordinates required' });
    }

    // CRITICAL: Verify loyalty membership (only verified members can book)
    const { proximitySearch } = await import('../services/SitterProximitySearch');
    const isEligible = await proximitySearch.isEligibleToBook(
      req.session?.userId || 'anonymous',
      loyaltyTier
    );

    if (!isEligible) {
      logger.warn('[Proximity Search] Non-loyalty member attempted search', {
        userId: req.session?.userId,
        loyaltyTier,
      });
      return res.status(403).json({
        error: 'Loyalty membership required',
        message: 'Join our loyalty program to book pet sitters',
      });
    }

    const sitters = await proximitySearch.findSittersNearby(
      { latitude, longitude },
      radiusKm || 25
    );

    logger.info('[Proximity Search] Sitters found nearby', {
      count: sitters.length,
      radiusKm: radiusKm || 25,
    });

    res.json(sitters);
  } catch (error) {
    logger.error('[Proximity Search] Error', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

/**
 * GET /api/sitter-suite/sitters/:id/reviews - Get Uber-style reviews for sitter
 */
router.get('/sitters/:id/reviews', async (req, res) => {
  try {
    const sitterId = parseInt(req.params.id);
    
    const reviews = await db
      .select()
      .from(sitterReviews)
      .where(eq(sitterReviews.sitterId, sitterId))
      .orderBy(desc(sitterReviews.createdAt))
      .limit(50);
    
    // Calculate rating breakdown (like Uber)
    const ratingCounts = {
      5: reviews.filter(r => r.rating === 5).length,
      4: reviews.filter(r => r.rating === 4).length,
      3: reviews.filter(r => r.rating === 3).length,
      2: reviews.filter(r => r.rating === 2).length,
      1: reviews.filter(r => r.rating === 1).length,
    };

    const avgRating = reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 0;

    res.json({
      reviews,
      stats: {
        averageRating: Math.round(avgRating * 10) / 10,
        totalReviews: reviews.length,
        ratingBreakdown: ratingCounts,
      },
    });
  } catch (error) {
    logger.error('[Sitter Suite] Error fetching reviews', error);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

export default router;
