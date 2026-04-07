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
  providerApprovalQueue,
  type Trainer,
  type TrainerBooking,
} from '@shared/schema';
import { eq, and, desc, sql, gte, lte, or, ilike } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { nanoid } from 'nanoid';
import { requireLoyaltyMember } from '../middleware/loyalty';
import { requireAuth } from '../customAuth';
import { requireAdmin as requireAdminMiddleware } from '../adminAuth';
import { geocodeAddress } from '../services/location/MapsService';
import { buildAllNavigationLinks } from '../utils/navigation';
import { walletService } from '../services/WalletService';
import { dispatchAcademySms } from '../services/academySmsHelper';

const router = Router();

router.get('/', (req, res) => {
  res.json({
    platform: 'Pet Wash Academy',
    status: 'active',
    version: '2.0',
    services: ['trainer-marketplace', 'certifications', 'courses'],
    certified: true
  });
});

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
    
    // Transform trainers to match frontend interface
    const transformedTrainers = filteredTrainers.map(t => ({
      ...t,
      fullName: `${t.firstName || ''} ${t.lastName || ''}`.trim() || 'Trainer',
      city: t.serviceArea || 'Israel',
      experienceYears: t.yearsOfExperience || 0,
    }));
    
    res.json(transformedTrainers);
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
    
    const [trainerData] = await db
      .select()
      .from(trainers)
      .where(eq(trainers.id, trainerId));
    
    if (!trainerData) {
      return res.status(404).json({ error: 'Trainer not found' });
    }
    
    // Transform trainer data to match frontend interface
    const trainer = {
      ...trainerData,
      fullName: `${trainerData.firstName || ''} ${trainerData.lastName || ''}`.trim() || 'Trainer',
      city: trainerData.serviceArea || 'Israel',
      experienceYears: trainerData.yearsOfExperience || 0,
      coverPhotoUrl: null,
      availableDays: trainerData.availabilitySchedule ? [trainerData.availabilitySchedule] : null,
    };
    
    // Get reviews from unified contractorReviews table
    const reviews = await db
      .select()
      .from(contractorReviews)
      .where(
        and(
          eq(contractorReviews.subjectId, trainerData.userId),
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
 * POST /api/academy/bookings - Create trainer booking
 * Authenticated endpoint - requires valid Firebase user
 */
router.post('/bookings', requireAuth, async (req, res) => {
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
    
    // Wallet hold (Academy = 100% cap)
    const walletCreditAppliedCents: number = Number(req.body.walletCreditAppliedCents ?? 0);
    const totalAmountCents = Math.round(totalAmount * 100);

    let holdResult: { heldCents: number; holdKey: string } | null = null;
    if (walletCreditAppliedCents > 0) {
      const preview = await walletService.previewRedemption({
        userId: req.user.uid,
        subtotalCents: totalAmountCents,
        divisionCode: 'academy',
      });
      const heldCents = Math.min(preview.applicableCents, walletCreditAppliedCents);
      if (heldCents > 0) {
        const walletHoldResult = await walletService.holdBookingWallet({
          userId: req.user.uid,
          amountCents: heldCents,
          bookingId: validatedData.bookingId,
          divisionCode: 'academy',
          ipAddress: req.ip ?? null,
        });
        holdResult = { heldCents, holdKey: walletHoldResult.txnId };
      }
    }

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
        // Wallet lifecycle
        walletHoldCents: holdResult?.heldCents ?? 0,
        walletHoldKey: holdResult?.holdKey ?? null,
        financeState: holdResult ? 'hold_active' : 'none',
      })
      .returning();
    
    logger.info('[Academy] Booking created', {
      bookingId: newBooking.bookingId,
      trainerId: trainer.id,
      totalAmount,
      userId: req.user.uid,
      walletHoldCents: newBooking.walletHoldCents,
      financeState: newBooking.financeState,
    });
    
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
 * GET /api/academy/trainer-bookings - Get trainer's incoming bookings
 * Trainer-only endpoint - returns all bookings assigned to this trainer
 */
router.get('/trainer-bookings', async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });

    const myBookings = await db
      .select()
      .from(trainerBookings)
      .where(eq(trainerBookings.trainerUserId, req.user.uid))
      .orderBy(desc(trainerBookings.createdAt));

    res.json(myBookings);
  } catch (error) {
    logger.error('[Academy] Error fetching trainer bookings', error);
    res.status(500).json({ error: 'Failed to fetch trainer bookings' });
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
    
    // Wallet release or refund based on finance_state
    let walletUpdates: Record<string, unknown> = {};
    if (booking.financeState === 'hold_active' && booking.walletHoldCents > 0) {
      const releaseResult = await walletService.releaseBookingHold({
        userId: booking.userId,
        amountCents: booking.walletHoldCents,
        bookingId,
        divisionCode: 'academy',
        ipAddress: req.ip ?? null,
      });
      walletUpdates = { financeState: 'released', walletReleaseKey: releaseResult.txnId };
      logger.info('[Academy] Wallet hold released on cancel', { bookingId, releasedCents: booking.walletHoldCents, txnId: releaseResult.txnId });
    } else if (booking.financeState === 'debited' && booking.walletDebitedCents > 0) {
      const refundResult = await walletService.refundBookingWallet({
        userId: booking.userId,
        amountCents: booking.walletDebitedCents,
        bookingId,
        divisionCode: 'academy',
        ipAddress: req.ip ?? null,
      });
      walletUpdates = { financeState: 'refunded', walletRefundKey: refundResult.txnId, walletRefundedCents: booking.walletDebitedCents };
      logger.info('[Academy] Wallet refunded on cancel', { bookingId, refundedCents: booking.walletDebitedCents, txnId: refundResult.txnId });
    }

    if (Object.keys(walletUpdates).length > 0) {
      await db.update(trainerBookings)
        .set({ ...walletUpdates, updatedAt: new Date() })
        .where(eq(trainerBookings.bookingId, bookingId));
    }

    logger.info('[Academy] Booking cancelled', {
      bookingId,
      cancelledBy: req.user.uid,
      reason,
    });

    // 2.7C/D — fire-and-forget SMS to trainer + customer
    const cancelEvent = (walletUpdates.financeState === 'refunded')
      ? 'cancelled_refund'
      : 'cancelled_release';
    dispatchAcademySms({
      bookingId,
      amountCents:    cancelEvent === 'cancelled_refund'
                        ? booking.walletDebitedCents
                        : booking.walletHoldCents,
      event:          cancelEvent,
      trainerUserId:  booking.trainerUserId,
      customerUserId: booking.userId,
    });

    res.json({ ...updatedBooking, ...walletUpdates });
  } catch (error) {
    logger.error('[Academy] Error cancelling booking', error);
    res.status(500).json({ error: 'Failed to cancel booking' });
  }
});

/**
 * POST /api/academy/bookings/:id/confirm - Trainer confirms booking → debit wallet hold
 * Trainer-only endpoint – only the assigned trainer may confirm
 */
router.post('/bookings/:id/confirm', requireAuth, async (req, res) => {
  try {
    const bookingId = req.params.id;

    const [booking] = await db
      .select()
      .from(trainerBookings)
      .where(eq(trainerBookings.bookingId, bookingId));

    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.trainerUserId !== req.user!.uid) {
      return res.status(403).json({ error: 'Only the assigned trainer can confirm this booking' });
    }
    if (booking.bookingStatus !== 'pending') {
      return res.status(400).json({ error: `Cannot confirm booking in status: ${booking.bookingStatus}` });
    }

    const walletUpdates: Record<string, unknown> = {
      bookingStatus: 'confirmed',
      confirmedAt: new Date(),
      paymentStatus: 'completed',
      escrowStatus: 'held',
      escrowHeldAt: new Date(),
      updatedAt: new Date(),
    };

    if (booking.financeState === 'hold_active' && booking.walletHoldCents > 0) {
      const debitResult = await walletService.debitBookingFromHold({
        userId: booking.userId,
        amountCents: booking.walletHoldCents,
        bookingId,
        divisionCode: 'academy',
        ipAddress: req.ip ?? null,
      });
      walletUpdates.financeState = 'debited';
      walletUpdates.walletDebitKey = debitResult.txnId;
      walletUpdates.walletDebitedCents = booking.walletHoldCents;
      logger.info('[Academy] Wallet debited on confirm', { bookingId, debitedCents: booking.walletHoldCents, txnId: debitResult.txnId });
    }

    const [confirmed] = await db
      .update(trainerBookings)
      .set(walletUpdates)
      .where(eq(trainerBookings.bookingId, bookingId))
      .returning();

    logger.info('[Academy] Booking confirmed', { bookingId, trainerId: booking.trainerId });

    // 2.7C/D — fire-and-forget SMS to trainer + customer
    dispatchAcademySms({
      bookingId,
      amountCents:    booking.walletHoldCents,
      event:          'confirmed',
      trainerUserId:  booking.trainerUserId,
      customerUserId: booking.userId,
    });

    res.json(confirmed);
  } catch (error) {
    logger.error('[Academy] Error confirming booking', error);
    res.status(500).json({ error: 'Failed to confirm booking' });
  }
});

/**
 * POST /api/academy/bookings/:id/complete - Mark session as done, queue trainer payout
 * Trainer-only endpoint – only the assigned trainer may complete.
 * Payout integration (Nayax transfer) is not yet live; sets payoutStatus='pending_transfer'
 * so ops can release manually when the integration ships.
 */
router.post('/bookings/:id/complete', requireAuth, async (req, res) => {
  try {
    const bookingId = req.params.id;

    const [booking] = await db
      .select()
      .from(trainerBookings)
      .where(eq(trainerBookings.bookingId, bookingId));

    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.trainerUserId !== req.user!.uid) {
      return res.status(403).json({ error: 'Only the assigned trainer can complete this booking' });
    }
    if (booking.bookingStatus !== 'confirmed') {
      return res.status(400).json({ error: `Cannot complete booking in status: ${booking.bookingStatus}` });
    }

    // Trainer payout — Nayax transfer integration not yet live.
    // Record pending_transfer so ops can release manually.
    logger.info('[Academy] Trainer payout queued for manual processing (Nayax transfer integration pending)', {
      bookingId,
      trainerId: booking.trainerId,
      trainerUserId: booking.trainerUserId,
      amountILS: booking.trainerPayout,
    });

    const [completed] = await db
      .update(trainerBookings)
      .set({
        bookingStatus: 'completed',
        payoutStatus: 'pending_transfer',
        updatedAt: new Date(),
      })
      .where(eq(trainerBookings.bookingId, bookingId))
      .returning();

    logger.info('[Academy] Booking completed', { bookingId, trainerId: booking.trainerId });

    // fire-and-forget SMS to trainer + customer
    dispatchAcademySms({
      bookingId,
      amountCents:    Math.round(parseFloat(booking.trainerPayout) * 100),
      event:          'completed',
      trainerUserId:  booking.trainerUserId,
      customerUserId: booking.userId,
    });

    res.json(completed);
  } catch (error) {
    logger.error('[Academy] Error completing booking', error);
    res.status(500).json({ error: 'Failed to complete booking' });
  }
});

/**
 * GET /api/academy/trainer/earnings — earnings summary for authenticated trainer
 * Returns total/weekly/monthly earnings plus payout-status breakdown.
 */
router.get('/trainer/earnings', requireAuth, async (req, res) => {
  try {
    const trainerUid = req.user!.uid;

    const allBookings = await db.select()
      .from(trainerBookings)
      .where(eq(trainerBookings.trainerUserId, trainerUid));

    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const completed = allBookings.filter(b => b.bookingStatus === 'completed');
    const active = allBookings.filter(b => b.bookingStatus === 'confirmed');

    const toC = (b: typeof allBookings[0]) => Math.round(parseFloat(b.trainerPayout) * 100);

    const pendingTransferBookings = completed.filter(b => b.payoutStatus === 'pending_transfer');
    const paidOutBookings = completed.filter(b => b.payoutStatus === 'paid_out');
    const failedPayoutBookings = completed.filter(b => b.payoutStatus === 'failed');

    const totalCents = completed.reduce((sum, b) => sum + toC(b), 0);
    const weeklyCents = completed
      .filter(b => b.updatedAt && new Date(b.updatedAt) >= startOfWeek)
      .reduce((sum, b) => sum + toC(b), 0);
    const monthlyCents = completed
      .filter(b => b.updatedAt && new Date(b.updatedAt) >= startOfMonth)
      .reduce((sum, b) => sum + toC(b), 0);
    const pendingCents = active.reduce((sum, b) => sum + toC(b), 0);
    const pendingTransferCents = pendingTransferBookings.reduce((sum, b) => sum + toC(b), 0);
    const paidOutCents = paidOutBookings.reduce((sum, b) => sum + toC(b), 0);
    const failedPayoutCents = failedPayoutBookings.reduce((sum, b) => sum + toC(b), 0);

    res.json({
      total: totalCents / 100,
      weekly: weeklyCents / 100,
      monthly: monthlyCents / 100,
      pending: pendingCents / 100,
      pendingTransfer: pendingTransferCents / 100,
      paidOut: paidOutCents / 100,
      failedPayout: failedPayoutCents / 100,
      completedSessionsAwaitingTransfer: pendingTransferBookings.length,
      currency: 'ILS',
      totalSessions: completed.length,
    });
  } catch (error) {
    logger.error('[Academy] Error fetching trainer earnings', error);
    res.status(500).json({ error: 'Failed to fetch trainer earnings' });
  }
});

/**
 * POST /api/academy/trainers/register - Trainer self-registration
 * Public endpoint - trainer applies to join the platform, starts as pending
 */
router.post('/trainers/register', async (req, res) => {
  try {
    const userId = req.body.userId || (req as any).user?.uid;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { firstName, lastName, email, phone, bio, specialties, yearsOfExperience, hourlyRate, serviceTypes, serviceArea, languages } = req.body;

    if (!firstName || !lastName || !email || !phone || !hourlyRate) {
      return res.status(400).json({ error: 'Missing required fields: firstName, lastName, email, phone, hourlyRate' });
    }

    const existing = await db.select({ id: trainers.id }).from(trainers).where(eq(trainers.userId, userId)).limit(1);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'A trainer profile already exists for this account' });
    }

    const [newTrainer] = await db.insert(trainers).values({
      trainerId: `TR-${new Date().getFullYear()}-${nanoid(8)}`,
      userId,
      firstName,
      lastName,
      email,
      phone,
      bio: bio || null,
      specialties: Array.isArray(specialties) ? specialties : [],
      yearsOfExperience: yearsOfExperience ? parseInt(yearsOfExperience) : 0,
      hourlyRate: String(parseFloat(hourlyRate)),
      serviceTypes: Array.isArray(serviceTypes) ? serviceTypes : [],
      serviceArea: serviceArea || null,
      languages: Array.isArray(languages) ? languages : ['he', 'en'],
      verificationStatus: 'pending',
      isActive: false,
      isCertified: false,
    }).returning();

    logger.info('[Academy] Trainer self-registered', { trainerId: newTrainer.trainerId, email: newTrainer.email });

    // Add to admin approval queue so staff can review the application
    try {
      await db.insert(providerApprovalQueue).values({
        providerId: newTrainer.trainerId,
        platform: 'academy',
        status: 'pending',
        priority: 'normal',
      });
    } catch (queueErr) {
      logger.warn('[Academy] Could not add to approval queue (non-fatal)', { queueErr });
    }

    res.status(201).json({ success: true, trainer: newTrainer, message: 'Application submitted. You will be notified once verified.' });
  } catch (error) {
    logger.error('[Academy] Trainer registration error', error);
    res.status(500).json({ error: 'Failed to submit trainer application' });
  }
});

// ==================== ADMIN ENDPOINTS ====================
// All /admin/* routes require Firebase auth + verified admin claims.
// requireAdminMiddleware populates (req as any).user; the isAdmin flag is set
// by the gate below so that existing handler-level checks continue to work.
router.use('/admin', requireAuth, requireAdminMiddleware, (req: any, _res: any, next: any) => {
  if (req.user) req.user.isAdmin = true;
  next();
});

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
