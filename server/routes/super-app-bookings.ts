import { Router } from 'express';
import { bookingService } from '../services/booking-service';
import { requireAuth } from '../customAuth';
import { apiLimiter } from '../middleware/rateLimiter';
import { z } from 'zod';
import { logger } from '../lib/logger';
import { FinancialDocumentService } from '../services/FinancialDocumentService';
import {
  dispatchNotifications,
  buildBookingCancelledSms,
  buildRefundIssuedSms,
} from '../services/PetWashNotificationEngine';

const router = Router();

// Platform context middleware - enforces tenant isolation
const requirePlatformContext = (req: any, res: any, next: any) => {
  const platformId = req.params.platformId;
  
  const validPlatforms = [
    'k9000',
    'walk_my_pet',
    'sitter_suite',
    'groomers',
    'shared_services'
    // 'pettrek' — LEGALLY BLOCKED: not licensed in Israel. Removed March 2026.
  ];

  // LEGAL BLOCK: PetTrek-specific hard rejection before generic invalid platform check
  if (platformId === 'pettrek' || platformId === 'pet_trek') {
    return res.status(403).json({
      error: 'service_legally_blocked',
      code: 'PETTREK_NOT_LICENSED',
      message: 'PetTrek™ is not available — service pending licensing in Israel.',
    });
  }

  if (!platformId || !validPlatforms.includes(platformId)) {
    return res.status(400).json({ 
      error: 'Invalid platform ID',
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

// Payment intent creation schema validation
const createPaymentIntentSchema = z.object({
  amountCents: z.number().int().positive().optional(), // Optional - defaults to booking total
  deviceType: z.enum(['WEB', 'IOS', 'ANDROID']).optional().default('WEB'),
});

// POST /api/platforms/:platformId/bookings - Create booking
router.post(
  '/:platformId/bookings',
  requireAuth,
  requirePlatformContext,
  apiLimiter,
  async (req: any, res: any) => {
    try {
      const userId = req.firebaseUser?.uid || req.user?.uid;
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
        userId: req.firebaseUser?.uid || req.user?.uid,
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
      const userId = req.firebaseUser?.uid || req.user?.uid;
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
        userId: req.firebaseUser?.uid || req.user?.uid,
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
      const userId = req.firebaseUser?.uid || req.user?.uid;
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
        userId: req.firebaseUser?.uid || req.user?.uid,
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
      const userId = req.firebaseUser?.uid || req.user?.uid;
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
        userId: req.firebaseUser?.uid || req.user?.uid,
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
      const userId = req.firebaseUser?.uid || req.user?.uid;
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
        userId: req.firebaseUser?.uid || req.user?.uid,
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

// GET /api/platforms/:platformId/stations/:stationId - Get single station for K9000
router.get(
  '/:platformId/stations/:stationId',
  requirePlatformContext,
  apiLimiter,
  async (req: any, res: any) => {
    try {
      const platformId = req.platformContext.platformId;
      const stationId = parseInt(req.params.stationId, 10);

      if (platformId !== 'k9000') {
        return res.status(404).json({ error: 'Stations not available for this platform' });
      }

      if (isNaN(stationId)) {
        return res.status(400).json({ error: 'Invalid station ID' });
      }

      const { db } = await import('../db');
      const { stations } = await import('@shared/schema');
      const { eq } = await import('drizzle-orm');

      const [station] = await db
        .select()
        .from(stations)
        .where(eq(stations.id, stationId));

      if (!station) {
        return res.status(404).json({ error: 'Station not found' });
      }

      res.json({ station });
    } catch (error: any) {
      logger.error('Failed to fetch station', { error: error.message });
      res.status(500).json({ error: 'Failed to fetch station' });
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
      const marketplacePlatforms = ['walk_my_pet', 'sitter_suite', 'groomers']; // 'pettrek' excluded — legally blocked
      if (!marketplacePlatforms.includes(platformId)) {
        return res.status(404).json({ 
          error: 'Providers not available for this platform' 
        });
      }

      const { db } = await import('../db');
      const { providers, walkerProfiles } = await import('@shared/schema');
      const { eq } = await import('drizzle-orm');

      // walk_my_pet uses walkerProfiles as the source of truth (contains walkerId for booking engine)
      if (platformId === 'walk_my_pet') {
        const { and } = await import('drizzle-orm');
        const idFilter = req.query.id ? parseInt(req.query.id as string) : null;
        const whereClause = idFilter && !isNaN(idFilter)
          ? and(eq(walkerProfiles.isActive, true), eq(walkerProfiles.id, idFilter))
          : eq(walkerProfiles.isActive, true);
        const walkers = await db
          .select()
          .from(walkerProfiles)
          .where(whereClause);

        // Map walkerProfiles fields to the shape BookingFlow.tsx expects
        const mappedWalkers = walkers.map((w) => ({
          id: w.id,
          walkerId: w.walkerId,
          userId: w.userId,
          businessName: w.displayName,
          displayName: w.displayName,
          profilePictureUrl: w.profilePhotoUrl,
          bio: w.bio,
          serviceArea: w.city,
          rating: w.averageRating ? parseFloat(w.averageRating) : 5.0,
          yearsOfExperience: w.yearsOfExperience,
          hourlyRate: w.baseHourlyRate ? parseFloat(w.baseHourlyRate) : 60,
          latitude: w.currentLatitude ? parseFloat(w.currentLatitude) : null,
          longitude: w.currentLongitude ? parseFloat(w.currentLongitude) : null,
          isAvailable: w.isAvailable,
          verificationStatus: w.verificationStatus,
          specializations: w.specializations,
          certifications: w.certifications,
          hasBodyCamera: w.hasBodyCamera,
          hasDroneAccess: w.hasDroneAccess,
          platformId,
        }));

        return res.json(mappedWalkers);
      }

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
      const userId = req.firebaseUser?.uid || req.user?.uid;
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
        userId: req.firebaseUser?.uid || req.user?.uid,
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
      const userId = req.firebaseUser?.uid || req.user?.uid;
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
        userId: req.firebaseUser?.uid || req.user?.uid,
        platformId: req.platformContext?.platformId,
        bookingId: req.params.bookingId
      });

      res.status(400).json({ 
        error: error.message || 'Failed to cancel booking'
      });
    }
  }
);

// ============================================================================
// BOOKING-2: PAYMENT INTENT ROUTES - NAYAX EXCLUSIVE
// ============================================================================

// POST /api/platforms/:platformId/bookings/:bookingId/payment-intents - Create payment intent
router.post(
  '/:platformId/bookings/:bookingId/payment-intents',
  requireAuth,
  requirePlatformContext,
  apiLimiter,
  async (req: any, res: any) => {
    try {
      const userId = req.firebaseUser?.uid || req.user?.uid;
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const platformId = req.platformContext.platformId;
      const bookingId = req.params.bookingId;

      // VALIDATION: Verify booking exists
      const existingBooking = await bookingService.getBookingById(bookingId);

      if (!existingBooking) {
        return res.status(404).json({ error: 'Booking not found' });
      }

      // SECURITY: Verify platform isolation
      if (existingBooking.platformId !== platformId) {
        return res.status(403).json({ error: 'Booking does not belong to this platform' });
      }

      // SECURITY: Verify user ownership
      const isCustomer = existingBooking.userId === userId;
      
      if (!isCustomer) {
        return res.status(403).json({ error: 'Unauthorized to create payment intent for this booking' });
      }

      // VALIDATION: Check booking state (only draft/pending_payment can create intent)
      const allowedStatuses = ['draft', 'pending_payment'];
      if (!allowedStatuses.includes(existingBooking.status)) {
        return res.status(409).json({ 
          error: `Cannot create payment intent for booking with status ${existingBooking.status}`,
          allowedStatuses 
        });
      }

      // VALIDATION: Check for existing active payment intent (idempotency)
      const { db } = await import('../db');
      const { paymentIntents } = await import('@shared/schema');
      const { eq, and } = await import('drizzle-orm');

      const existingIntents = await db
        .select()
        .from(paymentIntents)
        .where(
          and(
            eq(paymentIntents.bookingId, bookingId),
            eq(paymentIntents.status, 'pending')
          )
        );

      if (existingIntents.length > 0) {
        // Return existing intent (idempotency)
        const existingIntent = existingIntents[0];
        return res.json({
          id: existingIntent.id,
          bookingId: existingIntent.bookingId,
          status: existingIntent.status,
          gateway: 'NAYAX',
          nayaxAuthorizationId: existingIntent.nayaxAuthorizationId,
          authorizedAmount: existingIntent.authorizedAmount,
          currency: existingIntent.currency,
          vat: existingIntent.vat,
          createdAt: existingIntent.createdAt,
        });
      }

      // VALIDATION: Request body
      let validatedBody;
      try {
        validatedBody = createPaymentIntentSchema.parse(req.body);
      } catch (error: any) {
        return res.status(400).json({ 
          error: 'Invalid request body',
          details: error.errors 
        });
      }

      // ISRAEL PRODUCTION: ILS only
      if (existingBooking.currency !== 'ILS') {
        return res.status(400).json({ 
          error: 'Currency must be ILS (Israel production)',
          providedCurrency: existingBooking.currency
        });
      }

      // Get amount from request body or use booking total
      const amountCents = validatedBody.amountCents || existingBooking.totalCents;

      // VALIDATION: Amount must match booking total
      if (validatedBody.amountCents && validatedBody.amountCents !== existingBooking.totalCents) {
        return res.status(400).json({ 
          error: 'Amount does not match booking total',
          expectedAmountCents: existingBooking.totalCents,
          providedAmountCents: validatedBody.amountCents
        });
      }

      // Import PaymentGatewayService
      const { default: PaymentGatewayService } = await import('../services/PaymentGatewayService');

      // Create payment intent - Israel production version
      const result = await PaymentGatewayService.createPaymentIntent({
        bookingId,
        userId,
        platformId,
        amountCents,
        providerId: existingBooking.providerId?.toString(),
      });

      // Handle service errors
      if (!result.success) {
        logger.error('Payment intent creation failed', result.error, {
          bookingId,
          userId,
        });
        
        return res.status(400).json({ 
          error: result.error
        });
      }

      // Audit log
      logger.info('Payment intent created for booking', {
        paymentIntentId: result.id,
        bookingId,
        bookingNumber: existingBooking.bookingNumber,
        platformId,
        userId,
        amountCents,
        currency: result.currency,
        nayaxAuthorizationId: result.nayaxAuthorizationId,
      });

      res.status(201).json(result);
    } catch (error: any) {
      logger.error('Payment intent creation failed', {
        error: error.message,
        userId: req.firebaseUser?.uid || req.user?.uid,
        platformId: req.platformContext?.platformId,
        bookingId: req.params.bookingId
      });

      res.status(500).json({ 
        error: error.message || 'Failed to create payment intent'
      });
    }
  }
);

// GET /api/platforms/:platformId/bookings/:bookingId/payment-intents - Get payment intent status
router.get(
  '/:platformId/bookings/:bookingId/payment-intents',
  requireAuth,
  requirePlatformContext,
  apiLimiter,
  async (req: any, res: any) => {
    try {
      const userId = req.firebaseUser?.uid || req.user?.uid;
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const platformId = req.platformContext.platformId;
      const bookingId = req.params.bookingId;

      // VALIDATION: Verify booking exists
      const existingBooking = await bookingService.getBookingById(bookingId);

      if (!existingBooking) {
        return res.status(404).json({ error: 'Booking not found' });
      }

      // SECURITY: Verify platform isolation
      if (existingBooking.platformId !== platformId) {
        return res.status(403).json({ error: 'Booking does not belong to this platform' });
      }

      // SECURITY: Verify user ownership
      const isCustomer = existingBooking.userId === userId;
      
      if (!isCustomer) {
        return res.status(403).json({ error: 'Unauthorized to access payment intent for this booking' });
      }

      // Get payment intents for booking
      const { db } = await import('../db');
      const { paymentIntents } = await import('@shared/schema');
      const { eq } = await import('drizzle-orm');

      const intents = await db
        .select()
        .from(paymentIntents)
        .where(eq(paymentIntents.bookingId, bookingId))
        .orderBy(sql`${paymentIntents.createdAt} DESC`);

      res.json(intents);
    } catch (error: any) {
      logger.error('Failed to fetch payment intents', {
        error: error.message,
        userId: req.firebaseUser?.uid || req.user?.uid,
        platformId: req.platformContext?.platformId,
        bookingId: req.params.bookingId
      });

      res.status(500).json({ 
        error: 'Failed to fetch payment intents'
      });
    }
  }
);

// POST /api/platforms/:platformId/bookings/:bookingId/complete - Mark booking as completed
router.post(
  '/:platformId/bookings/:bookingId/complete',
  requireAuth,
  requirePlatformContext,
  apiLimiter,
  async (req: any, res: any) => {
    try {
      const userId = req.firebaseUser?.uid || req.user?.uid;
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const platformId = req.platformContext.platformId;
      const bookingId = req.params.bookingId;

      // Get booking
      const existingBooking = await bookingService.getBookingById(bookingId);

      if (!existingBooking) {
        return res.status(404).json({ error: 'Booking not found' });
      }

      // SECURITY: Verify platform isolation
      if (existingBooking.platformId !== platformId) {
        return res.status(403).json({ error: 'Booking does not belong to this platform' });
      }

      // SECURITY: Only provider can complete booking
      const isProvider = existingBooking.providerId && existingBooking.providerId.toString() === userId;
      
      if (!isProvider) {
        return res.status(403).json({ error: 'Only the provider can complete this booking' });
      }

      // Update booking to completed
      const { db } = await import('../db');
      const { bookings } = await import('@shared/schema');
      const { eq } = await import('drizzle-orm');

      const [updatedBooking] = await db.update(bookings)
        .set({
          status: 'completed',
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(bookings.id, bookingId))
        .returning();

      logger.info('Booking marked as completed', {
        bookingId,
        platformId,
        providerId: existingBooking.providerId,
      });

      res.json({ 
        success: true,
        booking: updatedBooking,
        message: 'Booking completed. Escrow will be released after 72 hours.',
      });
    } catch (error: any) {
      logger.error('Failed to complete booking', {
        error: error.message,
        userId: req.firebaseUser?.uid || req.user?.uid,
        platformId: req.platformContext?.platformId,
        bookingId: req.params.bookingId
      });

      res.status(500).json({ 
        error: 'Failed to complete booking'
      });
    }
  }
);

// POST /api/platforms/:platformId/bookings/:bookingId/cancel - Cancel booking and trigger refund
router.post(
  '/:platformId/bookings/:bookingId/cancel',
  requireAuth,
  requirePlatformContext,
  apiLimiter,
  async (req: any, res: any) => {
    try {
      const userId = req.firebaseUser?.uid || req.user?.uid;
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const platformId = req.platformContext.platformId;
      const bookingId = req.params.bookingId;
      const { reason } = req.body;

      if (!reason) {
        return res.status(400).json({ error: 'Cancellation reason required' });
      }

      // Get booking
      const existingBooking = await bookingService.getBookingById(bookingId);

      if (!existingBooking) {
        return res.status(404).json({ error: 'Booking not found' });
      }

      // SECURITY: Verify platform isolation
      if (existingBooking.platformId !== platformId) {
        return res.status(403).json({ error: 'Booking does not belong to this platform' });
      }

      // SECURITY: Only customer or provider can cancel
      const isCustomer = existingBooking.userId === userId;
      const isProvider = existingBooking.providerId && existingBooking.providerId.toString() === userId;
      
      if (!isCustomer && !isProvider) {
        return res.status(403).json({ error: 'Unauthorized to cancel this booking' });
      }

      // Update booking to cancelled
      const { db } = await import('../db');
      const { bookings, superAppPayouts } = await import('@shared/schema');
      const { eq } = await import('drizzle-orm');
      const ProviderPayoutService = (await import('../services/ProviderPayoutService')).default;

      const [updatedBooking] = await db.update(bookings)
        .set({
          status: 'cancelled',
          paymentStatus: 'refunded',
          cancellationReason: reason,
          cancelledBy: isCustomer ? 'customer' : 'provider',
          cancelledAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(bookings.id, bookingId))
        .returning();

      // Cancel escrow and trigger refund
      const [payout] = await db.select()
        .from(superAppPayouts)
        .where(eq(superAppPayouts.bookingId, bookingId))
        .limit(1);

      const refundAmount = payout?.amount ?? updatedBooking.totalPrice ?? '0';

      if (payout && payout.status === 'in_escrow') {
        await ProviderPayoutService.cancelEscrowAndRefund(payout.id, reason);
      }

      logger.info('Booking cancelled', {
        bookingId,
        platformId,
        cancelledBy: isCustomer ? 'customer' : 'provider',
        reason,
      });

      // ── Financial documents + notifications (fire-and-forget) ──
      (async () => {
        try {
          const { users } = await import('@shared/schema');
          const { eq } = await import('drizzle-orm');
          const { db } = await import('../db');

          const [customer] = await db.select({ email: users.email, phone: users.phone })
            .from(users).where(eq(users.id, updatedBooking.userId)).limit(1);

          const bookingRef = updatedBooking.bookingNumber || bookingId;
          const serviceName = updatedBooking.serviceType || updatedBooking.platformId || 'שירות';
          const cancelledByLabel = isCustomer ? 'לקוח' : 'ספק';
          const issuedAt = new Date().toLocaleDateString('he-IL');
          const refundILS = parseFloat(String(refundAmount)).toFixed(2);

          const cancelHtml = `<!DOCTYPE html><html><body style="font-family:Arial;direction:rtl;text-align:right;padding:24px;">
<h2>PetWash™ — הזמנה בוטלה</h2>
<table style="border-collapse:collapse;width:100%;max-width:480px;">
  <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#555;">מס׳ הזמנה</td><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">${bookingRef}</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#555;">שירות</td><td style="padding:8px;border-bottom:1px solid #eee;">${serviceName}</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#555;">בוטל על ידי</td><td style="padding:8px;border-bottom:1px solid #eee;">${cancelledByLabel}</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#555;">סיבה</td><td style="padding:8px;border-bottom:1px solid #eee;">${reason}</td></tr>
  <tr><td style="padding:8px;color:#555;">תאריך</td><td style="padding:8px;">${issuedAt}</td></tr>
</table>
<p style="margin-top:16px;font-size:12px;color:#888;">PetWash Ltd. | support@petwash.co.il</p>
</body></html>`;

          const cancellationDocRef = await FinancialDocumentService.create({
            userId: updatedBooking.userId,
            bookingId,
            documentType: 'cancellation_notice',
            issuedByEntity: 'PetWash',
            documentPayloadJson: {
              bookingRef,
              serviceName,
              cancelledBy: isCustomer ? 'customer' : 'provider',
              reason,
              refundAmount: refundILS,
              currency: 'ILS',
            },
            renderedHtml: cancelHtml,
            idempotencyKey: `cancellation_notice:${bookingId}:${updatedBooking.userId}`,
          });

          await dispatchNotifications({
            userId: updatedBooking.userId,
            eventType: 'booking_cancelled',
            templateKey: 'customer_booking_cancelled',
            bookingId,
            channels: ['sms', 'push'],
            sms: customer?.phone ? {
              to: customer.phone,
              text: buildBookingCancelledSms({ bookingRef, serviceName }),
            } : undefined,
            push: {
              userId: updatedBooking.userId,
              title: `הזמנה בוטלה – Pet Wash™`,
              body: `הזמנה מס׳ ${bookingRef} בוטלה. ${payout ? 'זיכוי יועבר תוך 5-7 ימי עסקים.' : ''}`,
              data: { bookingId, documentRef: cancellationDocRef, type: 'booking_cancelled' },
            },
            debugPayload: {
              bookingRef,
              smsText: buildBookingCancelledSms({ bookingRef, serviceName }),
              pushTitle: `הזמנה בוטלה – Pet Wash™`,
              pushBody: `הזמנה מס׳ ${bookingRef} בוטלה`,
              documentRef: cancellationDocRef,
            },
          });

          // ── Refund receipt (only when a payout was in escrow) ──
          if (payout) {
            const refundHtml = `<!DOCTYPE html><html><body style="font-family:Arial;direction:rtl;text-align:right;padding:24px;">
<h2>PetWash™ — אישור זיכוי</h2>
<table style="border-collapse:collapse;width:100%;max-width:480px;">
  <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#555;">מס׳ הזמנה</td><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">${bookingRef}</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#555;">סכום זיכוי</td><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;color:#1a7a1a;">₪${refundILS}</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#555;">עיבוד זיכוי</td><td style="padding:8px;border-bottom:1px solid #eee;">5-7 ימי עסקים</td></tr>
  <tr><td style="padding:8px;color:#555;">תאריך</td><td style="padding:8px;">${issuedAt}</td></tr>
</table>
<p style="margin-top:16px;font-size:12px;color:#888;">PetWash Ltd. | support@petwash.co.il</p>
</body></html>`;

            const refundDocRef = await FinancialDocumentService.create({
              userId: updatedBooking.userId,
              bookingId,
              transactionId: payout.id,
              documentType: 'refund_receipt',
              issuedByEntity: 'PetWash',
              documentPayloadJson: {
                bookingRef,
                refundAmount: refundILS,
                currency: payout.currency || 'ILS',
                payoutId: payout.id,
                reason,
              },
              renderedHtml: refundHtml,
              idempotencyKey: `refund_receipt:${bookingId}:${updatedBooking.userId}`,
            });

            await dispatchNotifications({
              userId: updatedBooking.userId,
              eventType: 'refund_issued',
              templateKey: 'customer_refund_issued',
              bookingId,
              transactionId: payout.id,
              channels: ['sms', 'push'],
              sms: customer?.phone ? {
                to: customer.phone,
                text: buildRefundIssuedSms({ bookingRef, refundAmount: refundILS }),
              } : undefined,
              push: {
                userId: updatedBooking.userId,
                title: `זיכוי יועבר – Pet Wash™ ↩️`,
                body: `זיכוי של ₪${refundILS} עבור הזמנה ${bookingRef} יועבר תוך 5-7 ימי עסקים`,
                data: { bookingId, documentRef: refundDocRef, type: 'refund_issued' },
              },
              debugPayload: {
                bookingRef,
                refundAmount: refundILS,
                smsText: buildRefundIssuedSms({ bookingRef, refundAmount: refundILS }),
                pushTitle: `זיכוי יועבר – Pet Wash™ ↩️`,
                pushBody: `זיכוי ₪${refundILS} עבור הזמנה ${bookingRef}`,
                documentRef: refundDocRef,
              },
            });
          }
        } catch (notifErr: any) {
          logger.error('[Booking] Post-cancellation notification failed silently', { error: notifErr?.message });
        }
      })();

      res.json({ 
        success: true,
        booking: updatedBooking,
        message: 'Booking cancelled. Refund will be processed within 5-7 business days.',
      });
    } catch (error: any) {
      logger.error('Failed to cancel booking', {
        error: error.message,
        userId: req.firebaseUser?.uid || req.user?.uid,
        platformId: req.platformContext?.platformId,
        bookingId: req.params.bookingId
      });

      res.status(500).json({ 
        error: 'Failed to cancel booking'
      });
    }
  }
);

export default router;
