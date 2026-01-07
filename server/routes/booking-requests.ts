/**
 * MADPAWS-STYLE BOOKING REQUESTS API
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

const router = Router();

/**
 * POST /api/booking-requests - Create a new booking request
 */
router.post('/', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const data = createBookingRequestSchema.parse(req.body);
    const requestId = nanoid(12);
    
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
    const startDate = new Date(data.startDate);
    const endDate = new Date(data.endDate);
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
    
    const serviceFeePercent = 15; // 15% platform fee like MadPaws
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
    const userId = req.headers['x-user-id'] as string;
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
    const userId = req.headers['x-user-id'] as string;
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
    const userId = req.headers['x-user-id'] as string;
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
    const userId = req.headers['x-user-id'] as string;
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
 */
router.post('/:requestId/pay', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
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
    
    const statusHistory = (booking.statusHistory as any[]) || [];
    statusHistory.push({
      status: 'confirmed',
      timestamp: new Date().toISOString(),
      note: `Payment received via ${paymentMethod || 'card'}. Booking confirmed!`,
    });
    
    await db.update(bookingRequests)
      .set({
        status: 'confirmed',
        paymentMethod: paymentMethod || 'nayax',
        paymentTransactionId: transactionId || `PAY-${nanoid(16)}`,
        paymentHeldAt: new Date(), // Escrow starts
        statusHistory,
        updatedAt: new Date(),
      })
      .where(eq(bookingRequests.requestId, requestId));
    
    logger.info('[BookingRequests] Payment processed', {
      requestId,
      totalCents: booking.totalCents,
      paymentMethod,
    });
    
    res.json({
      success: true,
      status: 'confirmed',
      message: 'Payment successful! Your booking is confirmed. Payment held in escrow until service completion.',
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
    const userId = req.headers['x-user-id'] as string;
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
    const userId = req.headers['x-user-id'] as string;
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
 */
router.post('/:requestId/confirm', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
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
    
    const statusHistory = (booking.statusHistory as any[]) || [];
    const finalStatus = rating ? 'reviewed' : 'completed';
    
    statusHistory.push({
      status: finalStatus,
      timestamp: new Date().toISOString(),
      note: rating 
        ? `Owner confirmed and left ${rating}-star review. Payment released to provider.`
        : 'Owner confirmed completion. Payment released to provider.',
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
    
    logger.info('[BookingRequests] Owner confirmed completion', {
      requestId,
      rating,
      paymentReleased: booking.totalCents,
    });
    
    res.json({
      success: true,
      status: finalStatus,
      message: 'Thank you! Payment has been released to the provider.',
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
    const userId = req.headers['x-user-id'] as string;
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
    const userId = req.headers['x-user-id'] as string;
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
