/**
 * PET WASH ACADEMY™ - Backend API Routes
 * 
 * Professional pet trainer marketplace integrated with unified ecosystem
 * Modular service connecting to central Payments & Ledger (Nayax Israel)
 */

import { Router } from 'express';
import { db } from '../db';
import {
  trainers,
  trainerBookings,
  contractorReviews,
  insertTrainerSchema,
  insertTrainerBookingSchema,
  type Trainer,
  type TrainerBooking,
} from '@shared/schema';
import { eq, and, desc, sql, gte, lte, or, ilike } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { nanoid } from 'nanoid';
import { requireLoyaltyMember } from '../middleware/loyalty';
import { geocodeAddress } from '../services/location/MapsService';
import { buildAllNavigationLinks } from '../utils/navigation';

const router = Router();

// ==================== PUBLIC ENDPOINTS ====================

/**
 * GET /api/academy/trainers - Browse verified trainers
 * Public endpoint - no auth required
 */
router.get('/trainers', async (req, res) => {
  try {
    const { city, specialty, minRating, serviceType, language } = req.query;
    
    // Base query: only verified, active trainers
    let query = db
      .select()
      .from(trainers)
      .where(
        and(
          eq(trainers.isActive, true),
          eq(trainers.verificationStatus, 'approved'),
          eq(trainers.isAcceptingBookings, true)
        )
      );
    
    // Apply filters (basic implementation - enhance with proper filtering in production)
    // Note: For advanced filtering, implement proper SQL queries with drizzle-orm
    
    const allTrainers = await query
      .orderBy(desc(trainers.averageRating), desc(trainers.totalSessions))
      .limit(50);
    
    // Filter by specialty if provided
    let filteredTrainers = allTrainers;
    if (specialty) {
      filteredTrainers = allTrainers.filter(t => 
        t.specialties?.includes(specialty as string)
      );
    }
    
    // Filter by service type if provided
    if (serviceType) {
      filteredTrainers = filteredTrainers.filter(t => 
        t.serviceTypes?.includes(serviceType as string)
      );
    }
    
    // Filter by minimum rating if provided
    if (minRating) {
      const minRatingNum = parseFloat(minRating as string);
      filteredTrainers = filteredTrainers.filter(t => 
        parseFloat(t.averageRating || '0') >= minRatingNum
      );
    }
    
    logger.info('[Academy] Trainers browsed', {
      count: filteredTrainers.length,
      city,
      specialty,
    });
    
    res.json(filteredTrainers);
  } catch (error) {
    logger.error('[Academy] Error fetching trainers', error);
    res.status(500).json({ error: 'Failed to fetch trainers' });
  }
});

/**
 * GET /api/academy/trainers/:id - Get trainer profile with reviews
 * Public endpoint - no auth required
 */
router.get('/trainers/:id', async (req, res) => {
  try {
    const trainerId = parseInt(req.params.id);
    
    const [trainer] = await db
      .select()
      .from(trainers)
      .where(eq(trainers.id, trainerId));
    
    if (!trainer) {
      return res.status(404).json({ error: 'Trainer not found' });
    }
    
    // Get reviews from unified contractorReviews table
    const reviews = await db
      .select()
      .from(contractorReviews)
      .where(
        and(
          eq(contractorReviews.subjectId, trainer.userId),
          eq(contractorReviews.reviewType, 'owner_to_contractor'),
          eq(contractorReviews.isVisible, true)
        )
      )
      .orderBy(desc(contractorReviews.createdAt))
      .limit(20);
    
    res.json({
      trainer,
      reviews,
    });
  } catch (error) {
    logger.error('[Academy] Error fetching trainer', error);
    res.status(500).json({ error: 'Failed to fetch trainer' });
  }
});

/**
 * GET /api/academy/specialties - Get available training specialties
 * Public endpoint - returns common training categories
 */
router.get('/specialties', async (req, res) => {
  try {
    const specialties = [
      { id: 'obedience', nameEn: 'Obedience Training', nameHe: 'אילוף צייתנות' },
      { id: 'puppy_training', nameEn: 'Puppy Training', nameHe: 'אילוף גורים' },
      { id: 'agility', nameEn: 'Agility Training', nameHe: 'אג\'יליטי' },
      { id: 'behavioral', nameEn: 'Behavioral Modification', nameHe: 'שינוי התנהגות' },
      { id: 'leash_training', nameEn: 'Leash Training', nameHe: 'אילוף רצועה' },
      { id: 'socialization', nameEn: 'Socialization', nameHe: 'סוציאליזציה' },
      { id: 'protection', nameEn: 'Protection Training', nameHe: 'אילוף שמירה' },
      { id: 'therapy', nameEn: 'Therapy Dog Training', nameHe: 'אילוף כלבי טיפול' },
    ];
    
    res.json(specialties);
  } catch (error) {
    logger.error('[Academy] Error fetching specialties', error);
    res.status(500).json({ error: 'Failed to fetch specialties' });
  }
});

// ==================== AUTHENTICATED ENDPOINTS (USER) ====================

/**
 * POST /api/academy/bookings - Create trainer booking (LOYALTY MEMBERS ONLY)
 * Authenticated endpoint - requires valid Firebase user + loyalty membership
 */
router.post('/bookings', requireLoyaltyMember, async (req, res) => {
  try {
    // Check authentication (middleware should set req.user)
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const validatedData = insertTrainerBookingSchema.parse({
      ...req.body,
      userId: req.user.uid,
      bookingId: `TRN-${new Date().getFullYear()}-${nanoid(8)}`,
    });
    
    // Get trainer details
    const [trainer] = await db
      .select()
      .from(trainers)
      .where(eq(trainers.id, validatedData.trainerId));
    
    if (!trainer || !trainer.isActive || !trainer.isAcceptingBookings) {
      return res.status(400).json({ error: 'Trainer not available for booking' });
    }
    
    // Calculate pricing
    const durationHours = validatedData.sessionDuration / 60;
    const totalAmount = parseFloat(trainer.hourlyRate) * durationHours;
    const platformFee = totalAmount * (parseFloat(trainer.commissionRate) / 100);
    const trainerPayout = totalAmount - platformFee;
    
    // Create booking with pricing
    const [newBooking] = await db
      .insert(trainerBookings)
      .values({
        ...validatedData,
        trainerUserId: trainer.userId,
        hourlyRate: trainer.hourlyRate,
        totalAmount: totalAmount.toFixed(2),
        platformFee: platformFee.toFixed(2),
        trainerPayout: trainerPayout.toFixed(2),
        currency: 'ILS',
        bookingStatus: 'pending',
        paymentStatus: 'pending',
        escrowStatus: 'pending',
        autoReleaseAt: new Date(Date.now() + 72 * 60 * 60 * 1000), // 72 hours
      })
      .returning();
    
    logger.info('[Academy] Booking created', {
      bookingId: newBooking.bookingId,
      trainerId: trainer.id,
      totalAmount,
      userId: req.user.uid,
    });
    
    // TODO: Integrate with central Payments & Ledger service for Nayax authorization
    // This should call the unified payment service instead of handling Nayax directly
    
    // Generate navigation links to trainer's location
    let navigationLinks = undefined;
    if (trainer.latitude && trainer.longitude) {
      navigationLinks = buildAllNavigationLinks({
        lat: parseFloat(trainer.latitude),
        lng: parseFloat(trainer.longitude),
        label: `Training Session: ${trainer.displayName}`,
      });
    }
    
    res.status(201).json({
      ...newBooking,
      navigation: navigationLinks,
    });
  } catch (error) {
    logger.error('[Academy] Error creating booking', error);
    res.status(400).json({ error: 'Failed to create booking' });
  }
});

/**
 * GET /api/academy/bookings - Get user's trainer bookings
 * Authenticated endpoint - returns user's booking history
 */
router.get('/bookings', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const userBookings = await db
      .select()
      .from(trainerBookings)
      .where(eq(trainerBookings.userId, req.user.uid))
      .orderBy(desc(trainerBookings.createdAt));
    
    // Get trainer details for each booking
    const bookingsWithTrainers = await Promise.all(
      userBookings.map(async (booking) => {
        const [trainer] = await db
          .select()
          .from(trainers)
          .where(eq(trainers.id, booking.trainerId));
        
        return {
          ...booking,
          trainer,
        };
      })
    );
    
    res.json(bookingsWithTrainers);
  } catch (error) {
    logger.error('[Academy] Error fetching bookings', error);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

/**
 * GET /api/academy/bookings/:id - Get booking details
 * Authenticated endpoint - returns detailed booking info
 */
router.get('/bookings/:id', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const bookingId = req.params.id;
    
    const [booking] = await db
      .select()
      .from(trainerBookings)
      .where(eq(trainerBookings.bookingId, bookingId));
    
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    
    // Verify ownership
    if (booking.userId !== req.user.uid && booking.trainerUserId !== req.user.uid) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Get trainer details
    const [trainer] = await db
      .select()
      .from(trainers)
      .where(eq(trainers.id, booking.trainerId));
    
    res.json({
      ...booking,
      trainer,
    });
  } catch (error) {
    logger.error('[Academy] Error fetching booking', error);
    res.status(500).json({ error: 'Failed to fetch booking' });
  }
});

/**
 * POST /api/academy/bookings/:id/cancel - Cancel booking
 * Authenticated endpoint - cancels booking and processes refund
 */
router.post('/bookings/:id/cancel', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const bookingId = req.params.id;
    const { reason } = req.body;
    
    const [booking] = await db
      .select()
      .from(trainerBookings)
      .where(eq(trainerBookings.bookingId, bookingId));
    
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    
    // Verify ownership
    if (booking.userId !== req.user.uid && booking.trainerUserId !== req.user.uid) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Check if cancellation is allowed
    if (booking.bookingStatus === 'completed' || booking.bookingStatus === 'cancelled') {
      return res.status(400).json({ error: 'Booking cannot be cancelled' });
    }
    
    // Update booking status
    const [updatedBooking] = await db
      .update(trainerBookings)
      .set({
        bookingStatus: 'cancelled',
        cancelledAt: new Date(),
        cancelledBy: booking.userId === req.user.uid ? 'user' : 'trainer',
        cancellationReason: reason || 'User cancelled',
        updatedAt: new Date(),
      })
      .where(eq(trainerBookings.bookingId, bookingId))
      .returning();
    
    logger.info('[Academy] Booking cancelled', {
      bookingId,
      cancelledBy: req.user.uid,
      reason,
    });
    
    // TODO: Process refund through central Payments & Ledger service
    // This should call the unified refund service for Nayax processing
    
    res.json(updatedBooking);
  } catch (error) {
    logger.error('[Academy] Error cancelling booking', error);
    res.status(500).json({ error: 'Failed to cancel booking' });
  }
});

// ==================== ADMIN ENDPOINTS ====================

/**
 * POST /api/academy/admin/trainers - Create trainer profile (admin only)
 * Admin endpoint - creates new trainer
 */
router.post('/admin/trainers', async (req, res) => {
  try {
    // Check admin role (middleware should verify this)
    if (!req.user?.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const validatedData = insertTrainerSchema.parse({
      ...req.body,
      trainerId: `TR-${new Date().getFullYear()}-${nanoid(8)}`,
      verificationStatus: 'pending',
    });
    
    const [newTrainer] = await db
      .insert(trainers)
      .values(validatedData)
      .returning();
    
    logger.info('[Academy] Trainer created by admin', {
      trainerId: newTrainer.trainerId,
      email: newTrainer.email,
    });
    
    res.status(201).json(newTrainer);
  } catch (error) {
    logger.error('[Academy] Error creating trainer', error);
    res.status(400).json({ error: 'Failed to create trainer' });
  }
});

/**
 * PATCH /api/academy/admin/trainers/:id/verify - Approve/reject trainer
 * Admin endpoint - updates verification status
 */
router.patch('/admin/trainers/:id/verify', async (req, res) => {
  try {
    if (!req.user?.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const trainerId = parseInt(req.params.id);
    const { status, reason } = req.body; // status: 'approved' | 'rejected' | 'suspended'
    
    const [updatedTrainer] = await db
      .update(trainers)
      .set({
        verificationStatus: status,
        verifiedAt: status === 'approved' ? new Date() : null,
        verifiedBy: req.user.uid,
        isCertified: status === 'approved',
        suspensionReason: status === 'suspended' ? reason : null,
        updatedAt: new Date(),
      })
      .where(eq(trainers.id, trainerId))
      .returning();
    
    logger.info('[Academy] Trainer verification updated', {
      trainerId,
      status,
      verifiedBy: req.user.uid,
    });
    
    res.json(updatedTrainer);
  } catch (error) {
    logger.error('[Academy] Error verifying trainer', error);
    res.status(500).json({ error: 'Failed to verify trainer' });
  }
});

/**
 * GET /api/academy/admin/trainers - Get all trainers (admin view)
 * Admin endpoint - includes pending/rejected trainers
 */
router.get('/admin/trainers', async (req, res) => {
  try {
    if (!req.user?.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const { status } = req.query;
    
    let query = db.select().from(trainers);
    
    if (status) {
      query = query.where(eq(trainers.verificationStatus, status as string));
    }
    
    const allTrainers = await query.orderBy(desc(trainers.createdAt));
    
    res.json(allTrainers);
  } catch (error) {
    logger.error('[Academy] Error fetching admin trainers', error);
    res.status(500).json({ error: 'Failed to fetch trainers' });
  }
});

/**
 * DELETE /api/academy/admin/trainers/:id - Delete trainer
 * Admin endpoint - removes trainer from system
 */
router.delete('/admin/trainers/:id', async (req, res) => {
  try {
    if (!req.user?.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const trainerId = parseInt(req.params.id);
    
    await db
      .delete(trainers)
      .where(eq(trainers.id, trainerId));
    
    logger.info('[Academy] Trainer deleted', {
      trainerId,
      deletedBy: req.user.uid,
    });
    
    res.json({ success: true });
  } catch (error) {
    logger.error('[Academy] Error deleting trainer', error);
    res.status(500).json({ error: 'Failed to delete trainer' });
  }
});

/**
 * GET /api/academy/admin/stats - Get Academy statistics
 * Admin endpoint - returns platform metrics
 */
router.get('/admin/stats', async (req, res) => {
  try {
    if (!req.user?.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    // Get trainer counts by status
    const trainerStats = await db
      .select({
        status: trainers.verificationStatus,
        count: sql<number>`count(*)`,
      })
      .from(trainers)
      .groupBy(trainers.verificationStatus);
    
    // Get booking stats
    const bookingStats = await db
      .select({
        status: trainerBookings.bookingStatus,
        count: sql<number>`count(*)`,
        totalRevenue: sql<number>`sum(${trainerBookings.totalAmount})`,
      })
      .from(trainerBookings)
      .groupBy(trainerBookings.bookingStatus);
    
    res.json({
      trainers: trainerStats,
      bookings: bookingStats,
    });
  } catch (error) {
    logger.error('[Academy] Error fetching stats', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

export default router;
