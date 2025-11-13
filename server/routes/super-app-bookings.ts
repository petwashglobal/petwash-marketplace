import { Router } from 'express';
import { bookingService } from '../services/booking-service';
import { requireAuth } from '../customAuth';
import { apiLimiter } from '../middleware/rateLimiter';
import { z } from 'zod';
import { logger } from '../lib/logger';

const router = Router();

// Platform context middleware - enforces tenant isolation
const requirePlatformContext = (req: any, res: any, next: any) => {
  const platformId = req.params.platformId;
  
  const validPlatforms = [
    'k9000',
    'walk_my_pet',
    'sitter_suite',
    'pettrek',
    'groomers',
    'shared_services'
  ];

  if (!platformId || !validPlatforms.includes(platformId)) {
    return res.status(400).json({ 
      error: 'Invalid platform ID',
      validPlatforms 
    });
  }

  // Attach verified platformId to request (never trust body input)
  req.platformContext = {
    platformId,
    verifiedAt: new Date()
  };

  next();
};

// Booking creation schema validation
const createBookingSchema = z.object({
  // SECURITY: platformId comes from route params, not body
  providerId: z.number().optional(),
  stationId: z.number().optional(),
  pickupLocationId: z.number().optional(),
  dropoffLocationId: z.number().optional(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  timezone: z.string().optional().default('Asia/Jerusalem'),
  petIds: z.array(z.number()).optional(),
  items: z.array(z.object({
    itemType: z.string(),
    name: z.string(),
    nameHe: z.string().optional(),
    description: z.string().optional(),
    quantity: z.number().optional().default(1),
    unitPrice: z.number().positive()
  })),
  serviceType: z.string().optional(),
  serviceDescription: z.string().optional(),
  specialRequests: z.string().optional(),
  platformData: z.any().optional()
});

// POST /api/platforms/:platformId/bookings - Create booking
router.post(
  '/:platformId/bookings',
  requireAuth,
  requirePlatformContext,
  apiLimiter,
  async (req: any, res: any) => {
    try {
      const userId = req.user?.uid;
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      // Validate request body
      const validatedData = createBookingSchema.parse(req.body);

      // SECURITY: Use platformId from route params (verified by middleware)
      const platformId = req.platformContext.platformId;

      // Create booking
      const booking = await bookingService.createBooking({
        ...validatedData,
        platformId, // From route params, not body
        userId
      });

      // Audit log
      logger.info('Booking created', {
        bookingId: booking.id,
        bookingNumber: booking.bookingNumber,
        platformId,
        userId,
        providerId: booking.providerId,
        stationId: booking.stationId,
        total: booking.total,
        status: booking.status
      });

      res.status(201).json(booking);
    } catch (error: any) {
      logger.error('Booking creation failed', {
        error: error.message,
        userId: req.user?.uid,
        platformId: req.platformContext?.platformId
      });

      res.status(400).json({ 
        error: error.message || 'Failed to create booking'
      });
    }
  }
);

// GET /api/platforms/:platformId/bookings - Get user's bookings for this platform
router.get(
  '/:platformId/bookings',
  requireAuth,
  requirePlatformContext,
  apiLimiter,
  async (req: any, res: any) => {
    try {
      const userId = req.user?.uid;
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const platformId = req.platformContext.platformId;
      
      // Parse query filters
      const filters: any = { platformId };
      
      if (req.query.status) {
        filters.status = req.query.status;
      }

      if (req.query.fromDate) {
        filters.fromDate = new Date(req.query.fromDate);
      }

      if (req.query.toDate) {
        filters.toDate = new Date(req.query.toDate);
      }

      const bookings = await bookingService.getUserBookings(userId, filters);

      res.json(bookings);
    } catch (error: any) {
      logger.error('Failed to fetch user bookings', {
        error: error.message,
        userId: req.user?.uid,
        platformId: req.platformContext?.platformId
      });

      res.status(500).json({ 
        error: 'Failed to fetch bookings'
      });
    }
  }
);

// GET /api/platforms/:platformId/bookings/:bookingId - Get booking details
router.get(
  '/:platformId/bookings/:bookingId',
  requireAuth,
  requirePlatformContext,
  apiLimiter,
  async (req: any, res: any) => {
    try {
      const userId = req.user?.uid;
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const platformId = req.platformContext.platformId;
      const bookingId = req.params.bookingId;

      const booking = await bookingService.getBookingById(bookingId);

      if (!booking) {
        return res.status(404).json({ error: 'Booking not found' });
      }

      // SECURITY: Verify platform isolation
      if (booking.platformId !== platformId) {
        return res.status(403).json({ error: 'Booking does not belong to this platform' });
      }

      // SECURITY: Verify user ownership or provider access
      if (booking.userId !== userId) {
        // Check if user is the provider
        // TODO: Add provider lookup to verify ownership
        return res.status(403).json({ error: 'Unauthorized access to booking' });
      }

      res.json(booking);
    } catch (error: any) {
      logger.error('Failed to fetch booking', {
        error: error.message,
        userId: req.user?.uid,
        platformId: req.platformContext?.platformId,
        bookingId: req.params.bookingId
      });

      res.status(500).json({ 
        error: 'Failed to fetch booking'
      });
    }
  }
);

// PATCH /api/platforms/:platformId/bookings/:bookingId/status - Update booking status
router.patch(
  '/:platformId/bookings/:bookingId/status',
  requireAuth,
  requirePlatformContext,
  apiLimiter,
  async (req: any, res: any) => {
    try {
      const userId = req.user?.uid;
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const platformId = req.platformContext.platformId;
      const bookingId = req.params.bookingId;
      const { status, reason } = req.body;

      if (!status) {
        return res.status(400).json({ error: 'Status is required' });
      }

      // Get existing booking to verify ownership
      const existingBooking = await bookingService.getBookingById(bookingId);

      if (!existingBooking) {
        return res.status(404).json({ error: 'Booking not found' });
      }

      // SECURITY: Verify platform isolation
      if (existingBooking.platformId !== platformId) {
        return res.status(403).json({ error: 'Booking does not belong to this platform' });
      }

      // SECURITY: Verify user ownership or provider access
      const isCustomer = existingBooking.userId === userId;
      
      // SECURITY FIX: Verify authenticated user is the actual provider
      let isProvider = false;
      if (existingBooking.providerId) {
        const { db } = await import('../db');
        const { providers } = await import('@shared/schema');
        const { eq, and } = await import('drizzle-orm');
        
        const [provider] = await db
          .select()
          .from(providers)
          .where(
            and(
              eq(providers.id, existingBooking.providerId),
              eq(providers.userId, userId),
              eq(providers.platformId, platformId)
            )
          );
        
        isProvider = !!provider;
      }

      if (!isCustomer && !isProvider) {
        return res.status(403).json({ error: 'Unauthorized to update this booking' });
      }

      // Role-based status transition rules
      const customerAllowedStatuses = ['cancelled'];
      const providerAllowedStatuses = ['confirmed', 'declined', 'in_progress', 'completed'];

      if (isCustomer && !isProvider && !customerAllowedStatuses.includes(status)) {
        return res.status(403).json({ 
          error: 'Customers can only cancel bookings',
          allowedStatuses: customerAllowedStatuses
        });
      }

      if (isProvider && !isCustomer && !providerAllowedStatuses.includes(status)) {
        return res.status(403).json({ 
          error: 'Invalid status transition for provider',
          allowedStatuses: providerAllowedStatuses
        });
      }

      // Update booking status
      const updatedBooking = await bookingService.updateBookingStatus(
        bookingId,
        status,
        userId,
        reason
      );

      // Audit log
      logger.info('Booking status updated', {
        bookingId,
        bookingNumber: existingBooking.bookingNumber,
        platformId,
        userId,
        oldStatus: existingBooking.status,
        newStatus: status,
        updatedBy: userId
      });

      res.json(updatedBooking);
    } catch (error: any) {
      logger.error('Booking status update failed', {
        error: error.message,
        userId: req.user?.uid,
        platformId: req.platformContext?.platformId,
        bookingId: req.params.bookingId
      });

      res.status(400).json({ 
        error: error.message || 'Failed to update booking status'
      });
    }
  }
);

// GET /api/platforms/:platformId/provider/bookings - Get provider's bookings
router.get(
  '/:platformId/provider/bookings',
  requireAuth,
  requirePlatformContext,
  apiLimiter,
  async (req: any, res: any) => {
    try {
      const userId = req.user?.uid;
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const platformId = req.platformContext.platformId;

      // SECURITY: Fetch provider record to verify user is a provider and get providerId
      const { db } = await import('../db');
      const { providers } = await import('@shared/schema');
      const { eq, and } = await import('drizzle-orm');

      const providerRecords = await db
        .select()
        .from(providers)
        .where(
          and(
            eq(providers.userId, userId),
            eq(providers.platformId, platformId)
          )
        );

      if (providerRecords.length === 0) {
        return res.status(404).json({ 
          error: 'Provider account not found',
          message: 'You need to set up a provider account for this platform first'
        });
      }

      const provider = providerRecords[0];

      // Parse query filters
      const filters: any = { 
        platformId,
        providerId: provider.id
      };
      
      if (req.query.status) {
        filters.status = req.query.status;
      }

      if (req.query.fromDate) {
        filters.fromDate = new Date(req.query.fromDate);
      }

      if (req.query.toDate) {
        filters.toDate = new Date(req.query.toDate);
      }

      const bookings = await bookingService.getProviderBookings(provider.id, filters);

      res.json(bookings);
    } catch (error: any) {
      logger.error('Failed to fetch provider bookings', {
        error: error.message,
        userId: req.user?.uid,
        platformId: req.platformContext?.platformId
      });

      res.status(500).json({ 
        error: 'Failed to fetch provider bookings'
      });
    }
  }
);

// GET /api/platforms/:platformId/stations - Get stations for K9000 platform
router.get(
  '/:platformId/stations',
  requirePlatformContext,
  apiLimiter,
  async (req: any, res: any) => {
    try {
      const platformId = req.platformContext.platformId;

      // Only K9000 platform has stations
      if (platformId !== 'k9000') {
        return res.status(404).json({ 
          error: 'Stations not available for this platform' 
        });
      }

      const { db } = await import('../db');
      const { stations } = await import('@shared/schema');
      const { eq } = await import('drizzle-orm');

      const stationList = await db
        .select()
        .from(stations)
        .where(eq(stations.platformId, platformId));

      res.json(stationList);
    } catch (error: any) {
      logger.error('Failed to fetch stations', {
        error: error.message,
        platformId: req.platformContext?.platformId
      });

      res.status(500).json({ 
        error: 'Failed to fetch stations'
      });
    }
  }
);

// GET /api/platforms/:platformId/providers - Get providers for marketplace platforms
router.get(
  '/:platformId/providers',
  requirePlatformContext,
  apiLimiter,
  async (req: any, res: any) => {
    try {
      const platformId = req.platformContext.platformId;

      // Only marketplace platforms have providers
      const marketplacePlatforms = ['walk_my_pet', 'sitter_suite', 'pettrek', 'groomers'];
      if (!marketplacePlatforms.includes(platformId)) {
        return res.status(404).json({ 
          error: 'Providers not available for this platform' 
        });
      }

      const { db } = await import('../db');
      const { providers } = await import('@shared/schema');
      const { eq } = await import('drizzle-orm');

      const providerList = await db
        .select()
        .from(providers)
        .where(eq(providers.platformId, platformId));

      res.json(providerList);
    } catch (error: any) {
      logger.error('Failed to fetch providers', {
        error: error.message,
        platformId: req.platformContext?.platformId
      });

      res.status(500).json({ 
        error: 'Failed to fetch providers'
      });
    }
  }
);

// ============================================================================
// BOOKING CONTRACT ROUTES - Explicit state transition endpoints
// ============================================================================

// POST /api/platforms/:platformId/bookings/:bookingId/confirm - Confirm booking
router.post(
  '/:platformId/bookings/:bookingId/confirm',
  requireAuth,
  requirePlatformContext,
  apiLimiter,
  async (req: any, res: any) => {
    try {
      const userId = req.user?.uid;
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const platformId = req.platformContext.platformId;
      const bookingId = req.params.bookingId;

      // Get existing booking to verify ownership
      const existingBooking = await bookingService.getBookingById(bookingId);

      if (!existingBooking) {
        return res.status(404).json({ error: 'Booking not found' });
      }

      // SECURITY: Verify platform isolation
      if (existingBooking.platformId !== platformId) {
        return res.status(403).json({ error: 'Booking does not belong to this platform' });
      }

      // SECURITY FIX: Verify authenticated user is the provider (only providers can confirm)
      let isProvider = false;
      if (existingBooking.providerId) {
        const { db } = await import('../db');
        const { providers } = await import('@shared/schema');
        const { eq, and } = await import('drizzle-orm');
        
        const [provider] = await db
          .select()
          .from(providers)
          .where(
            and(
              eq(providers.id, existingBooking.providerId),
              eq(providers.userId, userId),
              eq(providers.platformId, platformId)
            )
          );
        
        isProvider = !!provider;
      }

      if (!isProvider) {
        return res.status(403).json({ 
          error: 'Only the assigned provider can confirm this booking' 
        });
      }

      // Confirm booking with state guards and payment verification
      const confirmedBooking = await bookingService.confirmBooking(bookingId, userId);

      // Audit log
      logger.info('Booking confirmed', {
        bookingId,
        bookingNumber: existingBooking.bookingNumber,
        platformId,
        providerId: existingBooking.providerId,
        confirmedBy: userId
      });

      res.json(confirmedBooking);
    } catch (error: any) {
      logger.error('Booking confirmation failed', {
        error: error.message,
        userId: req.user?.uid,
        platformId: req.platformContext?.platformId,
        bookingId: req.params.bookingId
      });

      res.status(400).json({ 
        error: error.message || 'Failed to confirm booking'
      });
    }
  }
);

// POST /api/platforms/:platformId/bookings/:bookingId/cancel - Cancel booking
router.post(
  '/:platformId/bookings/:bookingId/cancel',
  requireAuth,
  requirePlatformContext,
  apiLimiter,
  async (req: any, res: any) => {
    try {
      const userId = req.user?.uid;
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const platformId = req.platformContext.platformId;
      const bookingId = req.params.bookingId;
      const { reason } = req.body;

      if (!reason || reason.trim().length === 0) {
        return res.status(400).json({ error: 'Cancellation reason is required' });
      }

      // Get existing booking to verify ownership
      const existingBooking = await bookingService.getBookingById(bookingId);

      if (!existingBooking) {
        return res.status(404).json({ error: 'Booking not found' });
      }

      // SECURITY: Verify platform isolation
      if (existingBooking.platformId !== platformId) {
        return res.status(403).json({ error: 'Booking does not belong to this platform' });
      }

      // SECURITY: Verify user ownership or provider access
      const isCustomer = existingBooking.userId === userId;
      
      let isProvider = false;
      if (existingBooking.providerId) {
        const { db } = await import('../db');
        const { providers } = await import('@shared/schema');
        const { eq, and } = await import('drizzle-orm');
        
        const [provider] = await db
          .select()
          .from(providers)
          .where(
            and(
              eq(providers.id, existingBooking.providerId),
              eq(providers.userId, userId),
              eq(providers.platformId, platformId)
            )
          );
        
        isProvider = !!provider;
      }

      if (!isCustomer && !isProvider) {
        return res.status(403).json({ error: 'Unauthorized to cancel this booking' });
      }

      // Cancel booking with state guards and reason capture
      const cancelledBooking = await bookingService.cancelBooking(
        bookingId,
        userId,
        reason
      );

      // Audit log
      logger.info('Booking cancelled', {
        bookingId,
        bookingNumber: existingBooking.bookingNumber,
        platformId,
        cancelledBy: userId,
        role: isCustomer ? 'customer' : 'provider',
        reason
      });

      res.json(cancelledBooking);
    } catch (error: any) {
      logger.error('Booking cancellation failed', {
        error: error.message,
        userId: req.user?.uid,
        platformId: req.platformContext?.platformId,
        bookingId: req.params.bookingId
      });

      res.status(400).json({ 
        error: error.message || 'Failed to cancel booking'
      });
    }
  }
);

export default router;
