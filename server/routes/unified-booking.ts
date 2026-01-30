/**
 * UNIFIED BOOKING API ROUTES
 * ===========================
 * REST API for the Unified Booking Engine
 * 
 * All routes use the same engine, ensuring:
 * - Consistent booking lifecycle
 * - Immutable transactions
 * - Full audit trail
 */

import { Router, type Request, type Response } from 'express';
import { authMiddleware as requireAuth } from '../middleware/auth';
import { requireAdmin } from '../middleware/rbac';
import { logger } from '../lib/logger';
import { db } from '../db';
import { bookings } from '@shared/schema';
import { eq } from 'drizzle-orm';
import {
  unifiedBookingEngine,
  transactionStampService,
  eventLogService,
  SERVICE_CONFIGS,
  type UnifiedBooking,
  type UnifiedBookingStatus,
  type Role
} from '../services/unified-booking';

const router = Router();

/**
 * Helper: Load booking from database and convert to UnifiedBooking format
 */
async function loadBookingFromDB(bookingId: string): Promise<UnifiedBooking | null> {
  const [dbBooking] = await db
    .select()
    .from(bookings)
    .where(eq(bookings.id, bookingId));

  if (!dbBooking) return null;

  const platformData = dbBooking.platformData as Record<string, any> || {};
  
  return {
    id: dbBooking.id,
    bookingNumber: dbBooking.bookingNumber,
    platform: 'PETWASH',
    serviceId: dbBooking.serviceType || dbBooking.platformId,
    resourceId: platformData.resourceId || String(dbBooking.providerId || dbBooking.stationId || ''),
    resourceType: platformData.resourceType || (dbBooking.stationId ? 'MACHINE' : 'HUMAN'),
    userId: dbBooking.userId,
    startTime: new Date(dbBooking.startTime),
    endTime: new Date(dbBooking.endTime),
    status: (dbBooking.status?.toUpperCase() || 'DRAFT') as UnifiedBookingStatus,
    priceSnapshot: platformData.priceSnapshot || {
      gross: Number(dbBooking.total) || 0,
      vat: 0,
      net: Number(dbBooking.subtotal) || 0,
      currency: dbBooking.currency || 'ILS',
      vatRate: 0.17,
      breakdown: {},
      platformFee: Number(dbBooking.platformFee) || 0,
      providerPayout: Number(dbBooking.providerPayout) || 0
    },
    metadata: {
      ...platformData,
      transactionId: platformData.transactionId || dbBooking.paymentIntentId
    },
    createdAt: dbBooking.createdAt || new Date(),
    updatedAt: dbBooking.updatedAt || new Date()
  };
}

/**
 * GET /api/unified-booking/services
 * List available services and their pricing configs
 * This is a PUBLIC endpoint - no auth required
 */
router.get('/services', (_req: Request, res: Response) => {
  res.json({
    success: true,
    services: Object.values(SERVICE_CONFIGS)
  });
});

/**
 * POST /api/unified-booking/draft
 * Create a new booking draft
 */
router.post('/draft', requireAuth, async (req: Request, res: Response) => {
  try {
    const { serviceId, resourceId, resourceType, startTime, endTime, metadata } = req.body;
    const userId = req.user?.uid || req.body.userId;

    if (!serviceId || !resourceId || !userId || !startTime || !endTime) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: serviceId, resourceId, userId, startTime, endTime'
      });
    }

    const booking = await unifiedBookingEngine.createDraft({
      serviceId,
      resourceId,
      resourceType: resourceType || 'HUMAN',
      userId,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      metadata
    });

    logger.info('[UnifiedBookingAPI] Draft created', {
      bookingId: booking.id,
      userId
    });

    res.status(201).json({
      success: true,
      booking
    });
  } catch (error: any) {
    logger.error('[UnifiedBookingAPI] Failed to create draft', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/unified-booking/:bookingId/quote
 * Calculate and attach price quote to booking
 */
router.post('/:bookingId/quote', requireAuth, async (req: Request, res: Response) => {
  try {
    const { bookingId } = req.params;
    const { price, breakdown, loyaltyDiscount, promoCode } = req.body;

    if (price === undefined || price === null) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: price'
      });
    }

    const booking = await loadBookingFromDB(bookingId);
    if (!booking) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found'
      });
    }

    if (booking.userId !== req.user?.uid) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to modify this booking'
      });
    }

    const quotedBooking = await unifiedBookingEngine.quote({
      booking,
      price: Number(price),
      breakdown,
      loyaltyDiscount,
      promoCode
    });

    res.json({
      success: true,
      booking: quotedBooking,
      priceSnapshot: quotedBooking.priceSnapshot
    });
  } catch (error: any) {
    logger.error('[UnifiedBookingAPI] Failed to quote', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/unified-booking/:bookingId/confirm
 * Confirm booking with payment
 */
router.post('/:bookingId/confirm', requireAuth, async (req: Request, res: Response) => {
  try {
    const { bookingId } = req.params;
    const { paymentProvider, paymentReference } = req.body;
    const userId = req.user?.uid || '';

    const booking = await loadBookingFromDB(bookingId);
    if (!booking) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found'
      });
    }

    if (booking.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to confirm this booking'
      });
    }

    const result = await unifiedBookingEngine.confirm({
      booking,
      paymentProvider: paymentProvider || 'NAYAX',
      paymentReference,
      confirmedBy: userId
    });

    res.json({
      success: true,
      booking: result.booking,
      transactionId: result.transactionId
    });
  } catch (error: any) {
    logger.error('[UnifiedBookingAPI] Failed to confirm', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/unified-booking/:bookingId/start
 * Mark booking as in progress
 * Only the assigned provider or admin can start a booking
 */
router.post('/:bookingId/start', requireAuth, async (req: Request, res: Response) => {
  try {
    const { bookingId } = req.params;
    const startedBy = req.user?.uid || '';
    const isAdmin = req.user?.role === 'admin' || req.user?.role === 'super_admin';

    const booking = await loadBookingFromDB(bookingId);
    if (!booking) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found'
      });
    }

    const isProvider = booking.resourceType === 'HUMAN' && booking.resourceId === startedBy;
    const isOwner = booking.userId === startedBy;
    const isMachine = booking.resourceType === 'MACHINE';
    
    if (!isAdmin && !isProvider && !isOwner && !isMachine) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to start this booking'
      });
    }

    if (booking.status !== 'CONFIRMED') {
      return res.status(400).json({
        success: false,
        error: `Cannot start booking in status ${booking.status}. Must be CONFIRMED.`
      });
    }

    const updatedBooking = await unifiedBookingEngine.start(booking, startedBy);

    res.json({
      success: true,
      booking: updatedBooking,
      status: 'IN_PROGRESS'
    });
  } catch (error: any) {
    logger.error('[UnifiedBookingAPI] Failed to start', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/unified-booking/:bookingId/complete
 * Mark booking as completed
 * Only the assigned provider or admin can complete a booking
 */
router.post('/:bookingId/complete', requireAuth, async (req: Request, res: Response) => {
  try {
    const { bookingId } = req.params;
    const completedBy = req.user?.uid || '';
    const isAdmin = req.user?.role === 'admin' || req.user?.role === 'super_admin';

    const booking = await loadBookingFromDB(bookingId);
    if (!booking) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found'
      });
    }

    const isProvider = booking.resourceType === 'HUMAN' && booking.resourceId === completedBy;
    const isMachine = booking.resourceType === 'MACHINE';
    
    if (!isAdmin && !isProvider && !isMachine) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to complete this booking'
      });
    }

    if (booking.status !== 'IN_PROGRESS') {
      return res.status(400).json({
        success: false,
        error: `Cannot complete booking in status ${booking.status}. Must be IN_PROGRESS.`
      });
    }

    const updatedBooking = await unifiedBookingEngine.complete(booking, completedBy);

    res.json({
      success: true,
      booking: updatedBooking,
      status: 'COMPLETED'
    });
  } catch (error: any) {
    logger.error('[UnifiedBookingAPI] Failed to complete', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/unified-booking/:bookingId/cancel
 * Cancel booking
 */
router.post('/:bookingId/cancel', requireAuth, async (req: Request, res: Response) => {
  try {
    const { bookingId } = req.params;
    const { reason } = req.body;
    const cancelledBy = req.user?.uid || '';
    const role: Role = req.user?.role === 'admin' ? 'ADMIN' : 'USER';
    const ipAddress = req.ip || req.headers['x-forwarded-for'] as string;

    const booking = await loadBookingFromDB(bookingId);
    if (!booking) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found'
      });
    }

    if (booking.userId !== cancelledBy && role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to cancel this booking'
      });
    }

    const updatedBooking = await unifiedBookingEngine.cancel(
      booking,
      cancelledBy,
      role,
      reason || 'User requested cancellation'
    );

    res.json({
      success: true,
      booking: updatedBooking,
      status: 'CANCELLED'
    });
  } catch (error: any) {
    logger.error('[UnifiedBookingAPI] Failed to cancel', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/unified-booking/:bookingId/refund
 * Process refund (admin only)
 */
router.post('/:bookingId/refund', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { bookingId } = req.params;
    const { refundAmount, reason, isPartial } = req.body;
    const processedBy = req.user?.uid || '';
    const role: Role = req.user?.role === 'super_admin' ? 'SUPER_ADMIN' : 'ADMIN';

    if (!refundAmount || !reason) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: refundAmount, reason'
      });
    }

    const booking = await loadBookingFromDB(bookingId);
    if (!booking) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found'
      });
    }

    const result = await unifiedBookingEngine.refund(
      booking,
      Number(refundAmount),
      processedBy,
      role,
      reason,
      isPartial
    );

    res.json({
      success: true,
      booking: result.booking,
      refundTransactionId: result.refundTransactionId,
      status: 'REFUNDED'
    });
  } catch (error: any) {
    logger.error('[UnifiedBookingAPI] Failed to refund', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/unified-booking/admin/free-wash
 * Admin grants free wash (K9000)
 */
router.post('/admin/free-wash', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { machineId, bay, startTime, minutes, reason } = req.body;
    const adminId = req.user?.uid || '';

    if (!machineId || !startTime || !minutes) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: machineId, startTime, minutes'
      });
    }

    const result = await unifiedBookingEngine.adminGrantFreeWash({
      adminId,
      machineId,
      bay,
      startTime: new Date(startTime),
      minutes: Number(minutes),
      reason
    });

    logger.info('[UnifiedBookingAPI] Admin granted free wash', {
      adminId,
      bookingId: result.booking.id,
      machineId,
      minutes
    });

    res.json({
      success: true,
      booking: result.booking,
      transactionId: result.transactionId,
      message: `Free ${minutes}-minute wash granted on machine ${machineId}`
    });
  } catch (error: any) {
    logger.error('[UnifiedBookingAPI] Failed to grant free wash', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/unified-booking/flow
 * Complete booking flow: Draft → Quote → Confirm
 * Convenience endpoint for frontend
 */
router.post('/flow', requireAuth, async (req: Request, res: Response) => {
  try {
    const {
      serviceId,
      resourceId,
      resourceType,
      startTime,
      endTime,
      price,
      paymentProvider,
      paymentReference,
      metadata
    } = req.body;
    const userId = req.user?.uid || req.body.userId;

    if (!serviceId || !resourceId || !userId || !startTime || !endTime || price === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: serviceId, resourceId, userId, startTime, endTime, price'
      });
    }

    const result = await unifiedBookingEngine.frontendBookingFlow({
      serviceId,
      resourceId,
      resourceType: resourceType || 'HUMAN',
      userId,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      price: Number(price),
      paymentProvider: paymentProvider || 'NAYAX',
      paymentReference,
      metadata
    });

    res.status(201).json({
      success: true,
      ...result
    });
  } catch (error: any) {
    logger.error('[UnifiedBookingAPI] Flow failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
