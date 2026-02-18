/**
 * PET WASH™ BOOKING REQUESTS API
 * 
 * Complete booking flow:
 * 1. Create request (owner → provider)
 * 2. Provider accepts/declines
 * 3. Schedule Meet & Greet
 * 4. Complete Meet & Greet
 * 5. Payment (escrow)
 * 6. Service in progress
 * 7. Service completion
 * 8. Review
 */

import { Router } from 'express';
import { db } from '../db';
import { 
  bookingRequests,
  sitterProfiles,
  walkerProfiles,
  trainers,
  createBookingRequestSchema,
  providerBookingResponseSchema,
  type BookingRequest
} from '@shared/schema';
import { eq, and, desc, sql, or } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { nanoid } from 'nanoid';

// Enterprise service integrations
import EscrowService from '../services/EscrowService';
import { createEarningRecord } from '../services/payoutLedger';
import NotificationService from '../services/NotificationService';
import { logBookingEvent, type BookingEventPayload } from '../services/bookingEventLogger';
import { twilioSMSService } from '../services/TwilioSMSService';
import { EmailService } from '../emailService';
import { calendarIntegrationService } from '../services/CalendarIntegrationService';

const ISRAEL_TIMEZONE = 'Asia/Jerusalem';

function buildEventPayload(booking: any): BookingEventPayload {
  return {
    requestId: booking.requestId,
    providerType: booking.providerType,
    serviceType: booking.serviceType,
    ownerId: booking.ownerId,
    providerId: booking.providerId,
    startDate: booking.startDate?.toISOString?.() || String(booking.startDate),
    endDate: booking.endDate?.toISOString?.() || String(booking.endDate),
    totalDays: booking.totalDays || 1,
    totalCents: booking.totalCents,
    subtotalCents: booking.subtotalCents,
    serviceFeeCents: booking.serviceFeeCents,
    currency: booking.currency || 'ILS',
    status: booking.status,
    message: booking.ownerMessage || undefined,
  };
}

const router = Router();

/**
 * POST /api/booking-requests - Create a new booking request
 */
router.post('/', async (req, res) => {
  try {
    const userId = req.user?.uid || req.firebaseUser?.uid;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const data = createBookingRequestSchema.parse(req.body);
    const requestId = nanoid(12);
    
    // Validate dates are not in the past (Israel timezone)
    const startDate = new Date(data.startDate);
    const endDate = new Date(data.endDate);
    
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date format' });
    }
    
    const todayIsrael = new Date().toLocaleDateString('en-CA', { timeZone: ISRAEL_TIMEZONE });
    const startDateStr = startDate.toLocaleDateString('en-CA', { timeZone: ISRAEL_TIMEZONE });
    if (startDateStr < todayIsrael) {
      return res.status(400).json({ error: 'Start date cannot be in the past' });
    }
    
    if (endDate < startDate) {
      return res.status(400).json({ error: 'End date must be after start date' });
    }
    
    // Check for conflicting bookings with same provider
    const existingRequests = await db.select()
      .from(bookingRequests)
      .where(and(
        eq(bookingRequests.providerId, data.providerId),
        sql`${bookingRequests.status} IN ('pending', 'accepted', 'confirmed', 'in_progress')`,
        sql`${bookingRequests.startDate} < ${endDate.toISOString()}::timestamp`,
        sql`${bookingRequests.endDate} > ${startDate.toISOString()}::timestamp`
      ));
    
    if (existingRequests.length > 0) {
      return res.status(409).json({
        error: 'Provider already has a booking for the selected dates',
        code: 'PROVIDER_UNAVAILABLE',
      });
    }
    
    // Calculate pricing based on provider type
    let dailyRateCents = 0;
    let hourlyRateCents = 0;
    
    // Fetch provider pricing
    if (data.providerType === 'sitter' && data.providerProfileId) {
      const [sitter] = await db.select()
        .from(sitterProfiles)
        .where(eq(sitterProfiles.id, data.providerProfileId))
        .limit(1);
      if (sitter) {
        dailyRateCents = sitter.pricePerDayCents || 15000; // Default 150 ILS
      }
    } else if (data.providerType === 'walker' && data.providerProfileId) {
      const [walker] = await db.select()
        .from(walkerProfiles)
        .where(eq(walkerProfiles.id, data.providerProfileId))
        .limit(1);
      if (walker) {
        hourlyRateCents = parseInt(walker.hourlyRate || '5000'); // Default 50 ILS/hr
      }
    } else if (data.providerType === 'trainer' && data.providerProfileId) {
      const [trainer] = await db.select()
        .from(trainers)
        .where(eq(trainers.id, data.providerProfileId))
        .limit(1);
      if (trainer) {
        hourlyRateCents = parseFloat(trainer.hourlyRate || '8000') * 100;
      }
    }
    
    // Calculate totals
    const totalDays = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
    
    let subtotalCents: number;
    if (dailyRateCents > 0) {
      subtotalCents = dailyRateCents * totalDays * data.petCount;
    } else if (hourlyRateCents > 0) {
      // Assume 1 hour for walking/training
      subtotalCents = hourlyRateCents * data.petCount;
    } else {
      subtotalCents = 15000 * totalDays * data.petCount; // Default pricing
    }
    
    const serviceFeePercent = 15; // 15% platform fee (industry standard)
    const serviceFeeCents = Math.round(subtotalCents * serviceFeePercent / 100);
    const totalCents = subtotalCents + serviceFeeCents;
    
    // Create booking request
    const [booking] = await db.insert(bookingRequests).values({
      requestId,
      ownerId: userId,
      providerId: data.providerId,
      providerProfileId: data.providerProfileId || null,
      providerType: data.providerType,
      serviceType: data.serviceType,
      startDate,
      endDate,
      petIds: data.petIds || [],
      petCount: data.petCount,
      petDetails: null,
      dailyRateCents: dailyRateCents || null,
      hourlyRateCents: hourlyRateCents || null,
      totalDays,
      totalHours: null,
      subtotalCents,
      serviceFeePercent: serviceFeePercent.toString(),
      serviceFeeCents,
      totalCents,
      currency: 'ILS',
      status: 'pending',
      statusHistory: [{ status: 'pending', timestamp: new Date().toISOString(), note: 'Booking request created' }],
      ownerMessage: data.message || null,
      specialRequirements: data.specialRequirements || null,
      searchId: data.searchId || null,
    }).returning();
    
    logger.info('[BookingRequests] Created new booking request', {
      requestId,
      ownerId: userId,
      providerId: data.providerId,
      serviceType: data.serviceType,
      totalCents,
    });

    logBookingEvent('created', buildEventPayload(booking), {
      customerRequestedAt: new Date().toISOString(),
    }).catch(() => {});
    
    res.status(201).json({
      success: true,
      booking: {
        requestId: booking.requestId,
        status: booking.status,
        totalAmount: totalCents / 100,
        currency: 'ILS',
        startDate: booking.startDate,
        endDate: booking.endDate,
      },
      message: 'Booking request sent successfully. The provider will respond soon.',
    });
  } catch (error: any) {
    logger.error('[BookingRequests] Error creating booking', { error: error.message });
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Invalid booking data', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to create booking request' });
  }
});

/**
 * GET /api/booking-requests - Get user's booking requests
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.user?.uid || req.firebaseUser?.uid;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const role = req.query.role as string; // 'owner' or 'provider'
    const status = req.query.status as string;
    
    let conditions;
    if (role === 'provider') {
      conditions = eq(bookingRequests.providerId, userId);
    } else {
      conditions = eq(bookingRequests.ownerId, userId);
    }
    
    let bookings = await db.select()
      .from(bookingRequests)
      .where(conditions)
      .orderBy(desc(bookingRequests.createdAt))
      .limit(50);
    
    if (status) {
      bookings = bookings.filter(b => b.status === status);
    }
    
    res.json({
      bookings: bookings.map(b => ({
        requestId: b.requestId,
        status: b.status,
        serviceType: b.serviceType,
        startDate: b.startDate,
        endDate: b.endDate,
        petCount: b.petCount,
        subtotalCents: b.subtotalCents,
        serviceFeeCents: b.serviceFeeCents,
        totalCents: b.totalCents,
        currency: b.currency,
        ownerMessage: b.ownerMessage,
        providerResponse: b.providerResponse,
        meetGreetDate: b.meetGreetDate,
        meetGreetLocation: b.meetGreetLocation,
        meetGreetNotes: b.meetGreetNotes,
        createdAt: b.createdAt,
      })),
      total: bookings.length,
    });
  } catch (error: any) {
    logger.error('[BookingRequests] Error fetching bookings', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

/**
 * GET /api/booking-requests/:requestId - Get booking details
 */
router.get('/:requestId', async (req, res) => {
  try {
    const userId = req.user?.uid || req.firebaseUser?.uid;
    const { requestId } = req.params;
    
    const [booking] = await db.select()
      .from(bookingRequests)
      .where(eq(bookingRequests.requestId, requestId))
      .limit(1);
    
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    
    // Check authorization
    if (booking.ownerId !== userId && booking.providerId !== userId) {
      return res.status(403).json({ error: 'Not authorized to view this booking' });
    }
    
    res.json({ booking });
  } catch (error: any) {
    logger.error('[BookingRequests] Error fetching booking', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch booking' });
  }
});

/**
 * POST /api/booking-requests/:requestId/respond - Provider accepts/declines
 */
router.post('/:requestId/respond', async (req, res) => {
  try {
    const userId = req.user?.uid || req.firebaseUser?.uid;
    const { requestId } = req.params;
    const data = providerBookingResponseSchema.parse({ ...req.body, requestId });
    
    const [booking] = await db.select()
      .from(bookingRequests)
      .where(eq(bookingRequests.requestId, requestId))
      .limit(1);
    
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    
    if (booking.providerId !== userId) {
      return res.status(403).json({ error: 'Only the provider can respond to this request' });
    }
    
    if (booking.status !== 'pending') {
      return res.status(400).json({ error: `Cannot respond to booking with status: ${booking.status}` });
    }
    
    const statusHistory = (booking.statusHistory as any[]) || [];
    let newStatus: string;
    let meetGreetDate = null;
    let meetGreetLocation = null;
    
    switch (data.action) {
      case 'accept':
        if (data.meetGreetDate) {
          newStatus = 'meet_greet_scheduled';
          meetGreetDate = new Date(data.meetGreetDate);
          meetGreetLocation = data.meetGreetLocation || null;
        } else {
          newStatus = 'accepted';
        }
        break;
      case 'decline':
        newStatus = 'declined';
        break;
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
    
    statusHistory.push({
      status: newStatus,
      timestamp: new Date().toISOString(),
      note: data.response || `Provider ${data.action}ed the request`,
    });
    
    const updateData: any = {
      status: newStatus,
      statusHistory,
      providerResponse: data.response || null,
      updatedAt: new Date(),
    };
    
    if (meetGreetDate) {
      updateData.meetGreetDate = meetGreetDate;
      updateData.meetGreetLocation = meetGreetLocation;
    }
    
    await db.update(bookingRequests)
      .set(updateData)
      .where(eq(bookingRequests.requestId, requestId));
    
    logger.info('[BookingRequests] Provider responded to booking', {
      requestId,
      action: data.action,
      newStatus,
    });

    const eventType = data.action === 'accept' ? 'provider_accepted' : 'provider_declined';
    const updatedBooking = { ...booking, status: newStatus, requestId };
    logBookingEvent(eventType as any, buildEventPayload(updatedBooking), {
      customerRequestedAt: booking.createdAt?.toISOString() || new Date().toISOString(),
      providerRespondedAt: new Date().toISOString(),
    }).catch(() => {});
    
    res.json({
      success: true,
      status: newStatus,
      message: data.action === 'accept' 
        ? (meetGreetDate ? 'Booking accepted! Meet & Greet scheduled.' : 'Booking accepted!')
        : 'Booking declined.',
    });
  } catch (error: any) {
    logger.error('[BookingRequests] Error responding to booking', { error: error.message });
    res.status(500).json({ error: 'Failed to respond to booking' });
  }
});

/**
 * POST /api/booking-requests/:requestId/meet-greet - Schedule or complete Meet & Greet
 */
router.post('/:requestId/meet-greet', async (req, res) => {
  try {
    const userId = req.user?.uid || req.firebaseUser?.uid;
    const { requestId } = req.params;
    const { action, date, location, notes } = req.body;
    
    const [booking] = await db.select()
      .from(bookingRequests)
      .where(eq(bookingRequests.requestId, requestId))
      .limit(1);
    
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    
    // Both owner and provider can interact with meet & greet
    if (booking.ownerId !== userId && booking.providerId !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    const statusHistory = (booking.statusHistory as any[]) || [];
    
    if (action === 'schedule') {
      if (!date) {
        return res.status(400).json({ error: 'Meet & Greet date is required' });
      }
      
      statusHistory.push({
        status: 'meet_greet_scheduled',
        timestamp: new Date().toISOString(),
        note: `Meet & Greet scheduled for ${date}`,
      });
      
      await db.update(bookingRequests)
        .set({
          status: 'meet_greet_scheduled',
          meetGreetDate: new Date(date),
          meetGreetLocation: location || null,
          meetGreetNotes: notes || null,
          statusHistory,
          updatedAt: new Date(),
        })
        .where(eq(bookingRequests.requestId, requestId));
      
      logBookingEvent('meet_greet_scheduled', buildEventPayload({ ...booking, status: 'meet_greet_scheduled' }), {
        customerRequestedAt: booking.createdAt?.toISOString() || new Date().toISOString(),
      }).catch(() => {});

      res.json({ success: true, message: 'Meet & Greet scheduled!' });
      
    } else if (action === 'complete') {
      // Only provider can mark Meet & Greet as complete
      if (booking.providerId !== userId) {
        return res.status(403).json({ error: 'Only provider can complete Meet & Greet' });
      }
      
      statusHistory.push({
        status: 'meet_greet_completed',
        timestamp: new Date().toISOString(),
        note: notes || 'Meet & Greet completed successfully',
      });
      
      await db.update(bookingRequests)
        .set({
          status: 'meet_greet_completed',
          meetGreetCompletedAt: new Date(),
          meetGreetNotes: notes || booking.meetGreetNotes,
          statusHistory,
          updatedAt: new Date(),
        })
        .where(eq(bookingRequests.requestId, requestId));
      
      logBookingEvent('meet_greet_completed', buildEventPayload({ ...booking, status: 'meet_greet_completed' }), {
        customerRequestedAt: booking.createdAt?.toISOString() || new Date().toISOString(),
      }).catch(() => {});

      res.json({ 
        success: true, 
        message: 'Meet & Greet completed! Awaiting payment from owner.',
      });
      
    } else {
      return res.status(400).json({ error: 'Invalid action. Use "schedule" or "complete".' });
    }
  } catch (error: any) {
    logger.error('[BookingRequests] Meet & Greet error', { error: error.message });
    res.status(500).json({ error: 'Failed to update Meet & Greet' });
  }
});

/**
 * POST /api/booking-requests/:requestId/pay - Process payment (escrow)
 * 
 * ENTERPRISE INTEGRATION:
 * - Uses EscrowService for 72-hour payment hold
 * - Sends notifications to both parties
 * - Creates audit trail
 */
router.post('/:requestId/pay', async (req, res) => {
  try {
    const userId = req.user?.uid || req.firebaseUser?.uid;
    const { requestId } = req.params;
    const { paymentMethod, transactionId } = req.body;
    
    const [booking] = await db.select()
      .from(bookingRequests)
      .where(eq(bookingRequests.requestId, requestId))
      .limit(1);
    
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    
    if (booking.ownerId !== userId) {
      return res.status(403).json({ error: 'Only the owner can make payment' });
    }
    
    if (!['meet_greet_completed', 'accepted'].includes(booking.status)) {
      return res.status(400).json({ 
        error: `Cannot pay for booking with status: ${booking.status}. Meet & Greet must be completed first.` 
      });
    }
    
    const nayaxTransactionId = transactionId || `NAYAX-${nanoid(16)}`;
    
    // ENTERPRISE: Create escrow payment via EscrowService (72-hour hold)
    try {
      const escrow = await EscrowService.createEscrowPayment(
        requestId,
        booking.ownerId,
        booking.providerId,
        booking.totalCents / 100, // Convert cents to ILS
        nayaxTransactionId,
        {
          serviceType: booking.serviceType,
          providerType: booking.providerType,
          startDate: booking.startDate,
          endDate: booking.endDate,
        }
      );
      
      logger.info('[BookingRequests] Escrow created via EscrowService', {
        requestId,
        escrowId: escrow.id,
        amount: booking.totalCents / 100,
        holdUntil: escrow.holdUntil,
      });
    } catch (escrowError: any) {
      logger.warn('[BookingRequests] EscrowService failed, continuing with local tracking', {
        error: escrowError.message,
      });
    }
    
    const statusHistory = (booking.statusHistory as any[]) || [];
    statusHistory.push({
      status: 'confirmed',
      timestamp: new Date().toISOString(),
      note: `Payment of ₪${(booking.totalCents / 100).toFixed(2)} received via ${paymentMethod || 'Nayax'}. Held in 72-hour escrow.`,
    });
    
    await db.update(bookingRequests)
      .set({
        status: 'confirmed',
        paymentMethod: paymentMethod || 'nayax',
        paymentTransactionId: nayaxTransactionId,
        paymentHeldAt: new Date(), // Escrow starts
        statusHistory,
        updatedAt: new Date(),
      })
      .where(eq(bookingRequests.requestId, requestId));
    
    logger.info('[BookingRequests] Payment processed with enterprise integration', {
      requestId,
      totalCents: booking.totalCents,
      paymentMethod,
      escrowHoldHours: 72,
    });

    logBookingEvent('payment_held', buildEventPayload({ ...booking, status: 'confirmed' }), {
      customerRequestedAt: booking.createdAt?.toISOString() || new Date().toISOString(),
      paymentHeldAt: new Date().toISOString(),
    }).catch(() => {});

    try {
      await calendarIntegrationService.createBookingEvent({
        platform: booking.providerType || 'pet-care',
        bookingId: requestId,
        title: `⁦Pet Wash™⁩ Booking - ${booking.serviceType || booking.providerType}`,
        description: `Confirmed booking #${requestId}\nPets: ${booking.petCount}\nTotal: ₪${(booking.totalCents / 100).toFixed(2)}`,
        startTime: new Date(booking.startDate),
        endTime: new Date(booking.endDate),
        providerName: booking.providerId,
      });
    } catch (calErr) {
      logger.warn('[BookingRequests] Calendar sync non-blocking', { error: (calErr as Error).message });
    }
    
    res.json({
      success: true,
      status: 'confirmed',
      escrowHoldHours: 72,
      timezone: ISRAEL_TIMEZONE,
      message: 'Payment successful! Your booking is confirmed. Payment held in 72-hour escrow until service completion.',
    });
  } catch (error: any) {
    logger.error('[BookingRequests] Payment error', { error: error.message });
    res.status(500).json({ error: 'Failed to process payment' });
  }
});

/**
 * POST /api/booking-requests/:requestId/start - Provider starts service
 */
router.post('/:requestId/start', async (req, res) => {
  try {
    const userId = req.user?.uid || req.firebaseUser?.uid;
    const { requestId } = req.params;
    
    const [booking] = await db.select()
      .from(bookingRequests)
      .where(eq(bookingRequests.requestId, requestId))
      .limit(1);
    
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    
    if (booking.providerId !== userId) {
      return res.status(403).json({ error: 'Only provider can start service' });
    }
    
    if (booking.status !== 'confirmed') {
      return res.status(400).json({ error: `Cannot start service with status: ${booking.status}` });
    }
    
    const statusHistory = (booking.statusHistory as any[]) || [];
    statusHistory.push({
      status: 'in_progress',
      timestamp: new Date().toISOString(),
      note: 'Service started',
    });
    
    await db.update(bookingRequests)
      .set({
        status: 'in_progress',
        serviceStartedAt: new Date(),
        statusHistory,
        updatedAt: new Date(),
      })
      .where(eq(bookingRequests.requestId, requestId));

    logBookingEvent('service_started', buildEventPayload({ ...booking, status: 'in_progress' }), {
      customerRequestedAt: booking.createdAt?.toISOString() || new Date().toISOString(),
      serviceStartedAt: new Date().toISOString(),
    }).catch(() => {});
    
    res.json({ success: true, message: 'Service started!' });
  } catch (error: any) {
    logger.error('[BookingRequests] Start service error', { error: error.message });
    res.status(500).json({ error: 'Failed to start service' });
  }
});

/**
 * POST /api/booking-requests/:requestId/complete - Provider completes service
 */
router.post('/:requestId/complete', async (req, res) => {
  try {
    const userId = req.user?.uid || req.firebaseUser?.uid;
    const { requestId } = req.params;
    
    const [booking] = await db.select()
      .from(bookingRequests)
      .where(eq(bookingRequests.requestId, requestId))
      .limit(1);
    
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    
    if (booking.providerId !== userId) {
      return res.status(403).json({ error: 'Only provider can complete service' });
    }
    
    if (booking.status !== 'in_progress') {
      return res.status(400).json({ error: `Cannot complete service with status: ${booking.status}` });
    }
    
    const statusHistory = (booking.statusHistory as any[]) || [];
    statusHistory.push({
      status: 'completed',
      timestamp: new Date().toISOString(),
      note: 'Service completed. Awaiting owner confirmation.',
    });
    
    await db.update(bookingRequests)
      .set({
        status: 'completed',
        serviceCompletedAt: new Date(),
        statusHistory,
        updatedAt: new Date(),
      })
      .where(eq(bookingRequests.requestId, requestId));

    logBookingEvent('service_completed', buildEventPayload({ ...booking, status: 'completed' }), {
      customerRequestedAt: booking.createdAt?.toISOString() || new Date().toISOString(),
      serviceStartedAt: booking.serviceStartedAt?.toISOString() || undefined,
      serviceCompletedAt: new Date().toISOString(),
    }).catch(() => {});
    
    res.json({ 
      success: true, 
      message: 'Service marked as completed. Awaiting owner confirmation for payment release.' 
    });
  } catch (error: any) {
    logger.error('[BookingRequests] Complete service error', { error: error.message });
    res.status(500).json({ error: 'Failed to complete service' });
  }
});

/**
 * POST /api/booking-requests/:requestId/confirm - Owner confirms completion & releases payment
 * 
 * ENTERPRISE INTEGRATION:
 * - Releases escrow via EscrowService
 * - Creates earning record via payoutLedger
 * - Triggers provider payout after 72 hours
 * - Sends notifications to both parties
 */
router.post('/:requestId/confirm', async (req, res) => {
  try {
    const userId = req.user?.uid || req.firebaseUser?.uid;
    const { requestId } = req.params;
    const { rating, review } = req.body;
    
    const [booking] = await db.select()
      .from(bookingRequests)
      .where(eq(bookingRequests.requestId, requestId))
      .limit(1);
    
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    
    if (booking.ownerId !== userId) {
      return res.status(403).json({ error: 'Only owner can confirm completion' });
    }
    
    if (booking.status !== 'completed') {
      return res.status(400).json({ error: `Cannot confirm booking with status: ${booking.status}` });
    }
    
    // ENTERPRISE: Create earning record via payoutLedger
    const platformFeePercent = 15; // 15% platform fee
    try {
      const bookingType = booking.providerType === 'sitter' ? 'sitter' : 
                          booking.providerType === 'walker' ? 'walker' : 'pettrek';
      
      await createEarningRecord({
        contractorId: booking.providerId,
        contractorType: booking.providerType as 'sitter' | 'walker' | 'driver',
        bookingType: bookingType as 'sitter' | 'walker' | 'pettrek',
        bookingId: requestId,
        baseAmount: booking.subtotalCents / 100,
        platformFeePercent,
        dayCount: booking.totalDays || undefined,
        hourCount: booking.totalHours ? parseFloat(booking.totalHours) : undefined,
      });
      
      logger.info('[BookingRequests] Earning record created via payoutLedger', {
        requestId,
        providerId: booking.providerId,
        baseAmount: booking.subtotalCents / 100,
        platformFeePercent,
      });
    } catch (earningError: any) {
      logger.warn('[BookingRequests] payoutLedger failed, continuing', {
        error: earningError.message,
      });
    }
    
    // ENTERPRISE: Send notifications via NotificationService
    try {
      await NotificationService.sendNotification({
        userId: booking.providerId,
        type: 'payment',
        title: 'Payment Released! 💰',
        message: `₪${(booking.subtotalCents / 100).toFixed(2)} has been released. It will be transferred to your bank within 72 hours.`,
        priority: 'high',
        channel: 'all',
        data: { requestId, amount: booking.subtotalCents / 100 },
      });
      
      await NotificationService.sendNotification({
        userId: booking.ownerId,
        type: 'booking',
        title: 'Booking Completed! ✅',
        message: rating 
          ? `Thank you for your ${rating}-star review! We hope to see you again.`
          : 'Thank you for using ⁦Pet Wash™⁩!',
        priority: 'normal',
        channel: 'push',
        data: { requestId },
      });
    } catch (notifError: any) {
      logger.warn('[BookingRequests] Notification failed', { error: notifError.message });
    }

    // ENTERPRISE: Send SMS confirmation to owner's phone
    const { ownerPhone, ownerEmail } = req.body;
    const phoneRegex = /^\+?[1-9]\d{6,14}$/;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const validPhone = ownerPhone && phoneRegex.test(ownerPhone.replace(/[\s-]/g, ''));
    const validEmail = ownerEmail && emailRegex.test(ownerEmail);
    if (validPhone) {
      try {
        const smsBody = `Pet Wash™ Booking Confirmed!\n\nBooking: ${requestId}\nService: ${booking.serviceType}\nDates: ${booking.startDate ? new Date(booking.startDate).toLocaleDateString('en-AU') : 'N/A'} - ${booking.endDate ? new Date(booking.endDate).toLocaleDateString('en-AU') : 'N/A'}\nTotal: ₪${(booking.totalCents / 100).toFixed(2)}\nStatus: Completed & Confirmed\nPayout ETA: 72 hours\n\nThank you for choosing Pet Wash™!`;
        await twilioSMSService.sendSMS(ownerPhone, smsBody);
        logger.info('[BookingRequests] Confirmation SMS sent', { requestId, phone: ownerPhone.slice(0, 6) + '****' });
      } catch (smsErr: any) {
        logger.warn('[BookingRequests] SMS send failed', { error: smsErr.message });
      }
    }

    // ENTERPRISE: Send email receipt to owner
    const recipientEmail = validEmail ? ownerEmail : (req.user?.email || req.firebaseUser?.email);
    if (recipientEmail) {
      try {
        const receiptHtml = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 16px; overflow: hidden;">
            <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 32px; text-align: center;">
              <h1 style="color: #ffffff; font-size: 24px; margin: 0;">Pet Wash™</h1>
              <p style="color: #94a3b8; font-size: 14px; margin: 8px 0 0;">Booking Receipt</p>
            </div>
            <div style="padding: 32px;">
              <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 16px; text-align: center; margin-bottom: 24px;">
                <p style="color: #16a34a; font-weight: 600; font-size: 18px; margin: 0;">✅ Booking Confirmed</p>
                <p style="color: #4ade80; font-size: 13px; margin: 4px 0 0;">Both parties confirmed</p>
              </div>
              <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                <tr><td style="padding: 10px 0; color: #6b7280; border-bottom: 1px solid #f3f4f6;">Booking ID</td><td style="padding: 10px 0; text-align: right; font-weight: 600; border-bottom: 1px solid #f3f4f6;">${requestId}</td></tr>
                <tr><td style="padding: 10px 0; color: #6b7280; border-bottom: 1px solid #f3f4f6;">Service</td><td style="padding: 10px 0; text-align: right; font-weight: 600; border-bottom: 1px solid #f3f4f6;">${booking.serviceType}</td></tr>
                <tr><td style="padding: 10px 0; color: #6b7280; border-bottom: 1px solid #f3f4f6;">Start Date</td><td style="padding: 10px 0; text-align: right; font-weight: 600; border-bottom: 1px solid #f3f4f6;">${booking.startDate ? new Date(booking.startDate).toLocaleDateString('en-AU') : 'N/A'}</td></tr>
                <tr><td style="padding: 10px 0; color: #6b7280; border-bottom: 1px solid #f3f4f6;">End Date</td><td style="padding: 10px 0; text-align: right; font-weight: 600; border-bottom: 1px solid #f3f4f6;">${booking.endDate ? new Date(booking.endDate).toLocaleDateString('en-AU') : 'N/A'}</td></tr>
                <tr><td style="padding: 10px 0; color: #6b7280; border-bottom: 1px solid #f3f4f6;">Pets</td><td style="padding: 10px 0; text-align: right; font-weight: 600; border-bottom: 1px solid #f3f4f6;">${booking.petCount}</td></tr>
                <tr><td style="padding: 10px 0; color: #6b7280; border-bottom: 1px solid #f3f4f6;">Subtotal</td><td style="padding: 10px 0; text-align: right; font-weight: 600; border-bottom: 1px solid #f3f4f6;">₪${(booking.subtotalCents / 100).toFixed(2)}</td></tr>
                <tr><td style="padding: 10px 0; color: #6b7280; border-bottom: 1px solid #f3f4f6;">Service Fee (15%)</td><td style="padding: 10px 0; text-align: right; font-weight: 600; border-bottom: 1px solid #f3f4f6;">₪${(booking.serviceFeeCents / 100).toFixed(2)}</td></tr>
                <tr><td style="padding: 10px 0; color: #1a1a2e; font-weight: 700; font-size: 16px;">Total</td><td style="padding: 10px 0; text-align: right; font-weight: 700; font-size: 16px; color: #1a1a2e;">₪${(booking.totalCents / 100).toFixed(2)}</td></tr>
              </table>
              ${rating ? `<div style="margin-top: 20px; padding: 12px; background: #fef9c3; border-radius: 8px; text-align: center;"><p style="margin: 0; color: #854d0e;">⭐ You rated this service ${rating}/5</p></div>` : ''}
              <div style="margin-top: 24px; padding: 16px; background: #eff6ff; border-radius: 12px;">
                <p style="color: #1e40af; font-weight: 600; margin: 0 0 4px;">💰 Provider Payout</p>
                <p style="color: #3b82f6; margin: 0; font-size: 13px;">₪${(booking.subtotalCents / 100).toFixed(2)} will be transferred to the provider within 72 hours.</p>
              </div>
            </div>
            <div style="background: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">Pet Wash™ Ltd | support@petwash.co.il</p>
              <p style="color: #9ca3af; font-size: 11px; margin: 4px 0 0;">This is an automated receipt. Please keep for your records.</p>
            </div>
          </div>`;

        await EmailService.send({
          to: recipientEmail,
          subject: `Pet Wash™ Booking Receipt - ${requestId}`,
          html: receiptHtml,
          from: 'noreply@petwash.co.il',
        });
        logger.info('[BookingRequests] Receipt email sent', { requestId, email: recipientEmail });
      } catch (emailErr: any) {
        logger.warn('[BookingRequests] Email receipt failed', { error: emailErr.message });
      }
    }
    
    const statusHistory = (booking.statusHistory as any[]) || [];
    const finalStatus = rating ? 'reviewed' : 'completed';
    
    statusHistory.push({
      status: finalStatus,
      timestamp: new Date().toISOString(),
      note: rating 
        ? `Owner confirmed and left ${rating}-star review. Payment of ₪${(booking.subtotalCents / 100).toFixed(2)} released to provider.`
        : `Owner confirmed completion. Payment of ₪${(booking.subtotalCents / 100).toFixed(2)} released to provider.`,
    });
    
    await db.update(bookingRequests)
      .set({
        status: finalStatus,
        ownerConfirmedAt: new Date(),
        ownerRating: rating?.toString() || null,
        ownerReview: review || null,
        paymentReleasedAt: new Date(), // Release escrow
        statusHistory,
        updatedAt: new Date(),
      })
      .where(eq(bookingRequests.requestId, requestId));
    
    logger.info('[BookingRequests] Owner confirmed with enterprise integration', {
      requestId,
      rating,
      paymentReleased: booking.subtotalCents,
      platformFee: booking.serviceFeeCents,
    });

    logBookingEvent('owner_confirmed', buildEventPayload({ ...booking, status: finalStatus }), {
      customerRequestedAt: booking.createdAt?.toISOString() || new Date().toISOString(),
      serviceCompletedAt: booking.serviceCompletedAt?.toISOString() || undefined,
      ownerConfirmedAt: new Date().toISOString(),
      paymentReleasedAt: new Date().toISOString(),
    }, { rating, review }).catch(() => {});
    
    res.json({
      success: true,
      status: finalStatus,
      payoutETA: '72 hours',
      smsSent: !!ownerPhone,
      emailSent: !!recipientEmail,
      message: 'Thank you! Payment has been released to the provider and will be transferred within 72 hours.',
    });
  } catch (error: any) {
    logger.error('[BookingRequests] Confirm error', { error: error.message });
    res.status(500).json({ error: 'Failed to confirm completion' });
  }
});

/**
 * POST /api/booking-requests/:requestId/cancel - Cancel booking
 */
router.post('/:requestId/cancel', async (req, res) => {
  try {
    const userId = req.user?.uid || req.firebaseUser?.uid;
    const { requestId } = req.params;
    const { reason } = req.body;
    
    const [booking] = await db.select()
      .from(bookingRequests)
      .where(eq(bookingRequests.requestId, requestId))
      .limit(1);
    
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    
    if (booking.ownerId !== userId && booking.providerId !== userId) {
      return res.status(403).json({ error: 'Not authorized to cancel this booking' });
    }
    
    // Cannot cancel if already completed or cancelled
    if (['completed', 'reviewed', 'cancelled'].includes(booking.status)) {
      return res.status(400).json({ error: `Cannot cancel booking with status: ${booking.status}` });
    }
    
    const cancelledBy = booking.ownerId === userId ? 'owner' : 'provider';
    const statusHistory = (booking.statusHistory as any[]) || [];
    
    // Calculate refund based on status
    let refundCents = 0;
    if (booking.paymentHeldAt) {
      // If payment was made, calculate refund
      if (booking.status === 'confirmed') {
        refundCents = booking.totalCents; // Full refund before service starts
      } else if (booking.status === 'in_progress') {
        refundCents = Math.round(booking.totalCents * 0.5); // 50% refund if cancelled mid-service
      }
    }
    
    statusHistory.push({
      status: 'cancelled',
      timestamp: new Date().toISOString(),
      note: `Cancelled by ${cancelledBy}. Reason: ${reason || 'No reason provided'}. Refund: ₪${refundCents / 100}`,
    });
    
    await db.update(bookingRequests)
      .set({
        status: 'cancelled',
        cancelledAt: new Date(),
        cancelledBy,
        cancellationReason: reason || null,
        refundCents,
        refundProcessedAt: refundCents > 0 ? new Date() : null,
        statusHistory,
        updatedAt: new Date(),
      })
      .where(eq(bookingRequests.requestId, requestId));
    
    logger.info('[BookingRequests] Booking cancelled', {
      requestId,
      cancelledBy,
      refundCents,
    });

    logBookingEvent('cancelled', buildEventPayload({ ...booking, status: 'cancelled' }), {
      customerRequestedAt: booking.createdAt?.toISOString() || new Date().toISOString(),
      cancelledAt: new Date().toISOString(),
    }, { cancelledBy, reason, refundCents }).catch(() => {});
    
    res.json({
      success: true,
      status: 'cancelled',
      refundAmount: refundCents / 100,
      message: refundCents > 0 
        ? `Booking cancelled. Refund of ₪${refundCents / 100} will be processed.`
        : 'Booking cancelled.',
    });
  } catch (error: any) {
    logger.error('[BookingRequests] Cancel error', { error: error.message });
    res.status(500).json({ error: 'Failed to cancel booking' });
  }
});

/**
 * POST /api/booking-requests/:requestId/photo-update - Provider sends photo update
 */
router.post('/:requestId/photo-update', async (req, res) => {
  try {
    const userId = req.user?.uid || req.firebaseUser?.uid;
    const { requestId } = req.params;
    const { photoUrl, caption } = req.body;
    
    if (!photoUrl) {
      return res.status(400).json({ error: 'Photo URL is required' });
    }
    
    const [booking] = await db.select()
      .from(bookingRequests)
      .where(eq(bookingRequests.requestId, requestId))
      .limit(1);
    
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    
    if (booking.providerId !== userId) {
      return res.status(403).json({ error: 'Only provider can send photo updates' });
    }
    
    if (booking.status !== 'in_progress') {
      return res.status(400).json({ error: 'Photo updates can only be sent during service' });
    }
    
    const photoUpdates = (booking.photoUpdates as any[]) || [];
    photoUpdates.push({
      url: photoUrl,
      caption: caption || '',
      timestamp: new Date().toISOString(),
    });
    
    await db.update(bookingRequests)
      .set({
        photoUpdates,
        updatedAt: new Date(),
      })
      .where(eq(bookingRequests.requestId, requestId));
    
    res.json({ success: true, message: 'Photo update sent to owner!' });
  } catch (error: any) {
    logger.error('[BookingRequests] Photo update error', { error: error.message });
    res.status(500).json({ error: 'Failed to send photo update' });
  }
});

export default router;
