import { Router } from 'express';
import { randomInt, randomBytes } from 'crypto';
import { db } from '../db';
import { 
  walkerProfiles, 
  walkBookings, 
  walkGpsTracking,
  walkHealthData,
  walkBlockchainAudit,
  walkerReviews,
  walkAlerts,
  walkVideos,
  users,
  octopusBookings,
  octopusLedger,
  octopusInvoices,
  bookingRequests,
  providerApprovalQueue,
  walkSlotHolds,
  type InsertWalkerProfile,
  type InsertWalkBooking,
  type InsertWalkGpsTracking,
  type InsertWalkerReview
} from '../../shared/schema';
import { eq, and, gte, lte, lt, sql, desc, asc, isNotNull } from 'drizzle-orm';
import { z } from 'zod';
import crypto from 'crypto';
import { requireLoyaltyMember } from '../middleware/loyalty';
import { requireAuth } from '../customAuth';
import { calculateDistance } from '../services/location/MapsService';
import { buildAllNavigationLinks } from '../utils/navigation';
import { walkEliteBookingEngine } from '../services/booking-engines/walk/WalkEliteBookingEngine';
import { calendarIntegrationService } from '../services/CalendarIntegrationService';
import { IsraeliDigitalReceiptService } from '../services/IsraeliDigitalReceiptService';
import VATCalculatorService from '../services/VATCalculatorService';
import { logger } from '../lib/logger';
import { syncChatToBookingStatus, checkCancellationWindow } from '../lib/booking-chat-sync';
import { backupFinancialDocument } from '../services/gcsBackupService';
import { verifyCaptchaToken } from '../lib/verifyCaptcha';

const router = Router();

// =================== WALKER REGISTRATION & PROFILES ===================

// Create walker profile (first step of registration)
router.post('/walkers/register', async (req, res) => {
  try {
    const userId = req.body.userId || (req as any).user?.uid;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { captchaToken, ...bodyWithoutToken } = req.body;
    if (captchaToken) {
      const captchaResult = await verifyCaptchaToken(captchaToken, 'provider_register');
      if (!captchaResult.valid) {
        logger.warn('[Walk My Pet] Walker registration blocked by reCAPTCHA', { reason: captchaResult.reason, score: captchaResult.score, userId });
        return res.status(400).json({ error: 'Security check failed. Please try again.', reason: captchaResult.reason });
      }
    } else {
      logger.warn('[Walk My Pet] No captchaToken in walker registration — reCAPTCHA may not have loaded', { userId });
    }

    const walkerData: InsertWalkerProfile = {
      ...bodyWithoutToken,
      userId,
      walkerId: `WALKER-${crypto.randomUUID()}`,
      verificationStatus: 'pending',
      kycCompleted: false,
      averageRating: '0',
      totalWalks: 0,
      totalReviews: 0,
      acceptanceRate: '0',
      isAvailable: false, // Not available until verified
      isActive: true,
    };

    const [newWalker] = await db.insert(walkerProfiles).values(walkerData).returning();

    // Add to admin approval queue so staff can review the application
    try {
      await db.insert(providerApprovalQueue).values({
        providerId: newWalker.walkerId,
        platform: 'walk_my_pet',
        status: 'pending',
        priority: 'normal',
      });
    } catch (queueErr) {
      console.warn('[Walk My Pet] Could not add to approval queue (non-fatal):', queueErr);
    }
    
    res.status(201).json({ 
      success: true, 
      walker: newWalker,
      message: 'Walker profile created. Please complete KYC verification to activate.' 
    });
  } catch (error: any) {
    console.error('[Walk My Pet] Walker registration error:', error);
    res.status(500).json({ error: 'Failed to create walker profile', details: error.message });
  }
});

/**
 * PATCH /api/walk-my-pet/walkers/location - Update walker's live GPS location
 * Called by the walker dashboard to keep their position current for proximity matching
 */
router.patch('/walkers/location', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.uid;
    const { latitude, longitude } = req.body;

    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return res.status(400).json({ error: 'latitude and longitude (numbers) are required' });
    }

    const [updated] = await db
      .update(walkerProfiles)
      .set({ currentLatitude: latitude.toString(), currentLongitude: longitude.toString() })
      .where(eq(walkerProfiles.userId, userId))
      .returning({ walkerId: walkerProfiles.walkerId });

    if (!updated) {
      return res.status(404).json({ error: 'Walker profile not found' });
    }

    return res.json({ success: true });
  } catch (error: any) {
    console.error('[Walk My Pet] Error updating walker location:', error);
    return res.status(500).json({ error: 'Failed to update location' });
  }
});

// Get walker profile
router.get('/walkers/:walkerId', async (req, res) => {
  try {
    const { walkerId } = req.params;
    
    const [walker] = await db
      .select()
      .from(walkerProfiles)
      .where(eq(walkerProfiles.walkerId, walkerId))
      .limit(1);

    if (!walker) {
      return res.status(404).json({ error: 'Walker not found' });
    }

    res.json({ walker });
  } catch (error: any) {
    console.error('[Walk My Pet] Get walker error:', error);
    res.status(500).json({ error: 'Failed to fetch walker profile' });
  }
});

// Update walker profile
router.patch('/walkers/:walkerId', async (req, res) => {
  try {
    const { walkerId } = req.params;
    const userId = req.body.userId || (req as any).user?.uid;

    // Verify ownership
    const [walker] = await db
      .select()
      .from(walkerProfiles)
      .where(eq(walkerProfiles.walkerId, walkerId))
      .limit(1);

    if (!walker) {
      return res.status(404).json({ error: 'Walker not found' });
    }

    if (walker.userId !== userId && !(req as any).user?.isAdmin) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const [updatedWalker] = await db
      .update(walkerProfiles)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(walkerProfiles.walkerId, walkerId))
      .returning();

    res.json({ success: true, walker: updatedWalker });
  } catch (error: any) {
    console.error('[Walk My Pet] Update walker error:', error);
    res.status(500).json({ error: 'Failed to update walker profile' });
  }
});

// Search walkers by location (geolocation)
router.post('/walkers/search', async (req, res) => {
  try {
    const { latitude, longitude, radiusKm = 5, minRating = 0, hasBodyCamera, hasDroneAccess } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Latitude and longitude required' });
    }

    // Calculate bounding box for efficient search
    // 1 degree latitude ≈ 111km, longitude varies by latitude
    const latDelta = radiusKm / 111;
    const lonDelta = radiusKm / (111 * Math.cos(latitude * Math.PI / 180));

    let query = db
      .select()
      .from(walkerProfiles)
      .where(
        and(
          eq(walkerProfiles.verificationStatus, 'verified'),
          eq(walkerProfiles.isAvailable, true),
          eq(walkerProfiles.isActive, true),
          gte(walkerProfiles.averageRating, minRating.toString()),
          // Bounding box filter
          gte(walkerProfiles.currentLatitude, (latitude - latDelta).toString()),
          lte(walkerProfiles.currentLatitude, (latitude + latDelta).toString()),
          gte(walkerProfiles.currentLongitude, (longitude - lonDelta).toString()),
          lte(walkerProfiles.currentLongitude, (longitude + lonDelta).toString())
        )
      );

    const walkers = await query;

    // Calculate exact distance and filter by premium features (using shared MapsService)
    const walkersWithDistance = walkers
      .map(walker => {
        const walkerLat = parseFloat(walker.currentLatitude || '0');
        const walkerLon = parseFloat(walker.currentLongitude || '0');
        
        // Use shared distance calculation
        const distance = calculateDistance(latitude, longitude, walkerLat, walkerLon);

        return {
          ...walker,
          distanceKm: distance
        };
      })
      .filter(w => w.distanceKm <= radiusKm)
      .filter(w => !hasBodyCamera || w.hasBodyCamera)
      .filter(w => !hasDroneAccess || w.hasDroneAccess)
      .sort((a, b) => a.distanceKm - b.distanceKm);

    res.json({ 
      success: true, 
      walkers: walkersWithDistance,
      count: walkersWithDistance.length
    });
  } catch (error: any) {
    console.error('[Walk My Pet] Search walkers error:', error);
    res.status(500).json({ error: 'Failed to search walkers' });
  }
});

// =================== WALK BOOKING ===================

// Create walk booking - USING LUXURY ENGINE
router.post('/walks/book', requireAuth, async (req, res) => {
  try {
    const ownerId = req.body.ownerId || (req as any).user?.uid;
    if (!ownerId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { 
      walkerId, 
      scheduledDate, 
      scheduledStartTime, 
      durationMinutes,
      pickupLatitude,
      pickupLongitude,
      pickupAddress,
      petName,
      petBreed,
      petWeight,
      petSpecialNeeds
    } = req.body;

    // Validate required fields
    if (!walkerId || !scheduledDate || !scheduledStartTime || !durationMinutes || 
        !pickupLatitude || !pickupLongitude || !pickupAddress) {
      return res.status(400).json({ error: 'Missing required booking information' });
    }

    // Parse dates for luxury engine
    const startDateTime = new Date(`${scheduledDate}T${scheduledStartTime}`);
    const endDateTime = new Date(startDateTime.getTime() + durationMinutes * 60000);
    const scheduledDateOnly = new Date(scheduledDate); // Keep day-only for queries

    // Calculate distance (default 5km for walk radius)
    const distanceKm = 5; // Most walks are local 5km radius

    // STEP 1: Check availability using LUXURY ENGINE
    const availability = await walkEliteBookingEngine.checkAvailability({
      providerId: walkerId,
      serviceType: 'dog_walk',
      startDate: startDateTime,
      endDate: endDateTime,
      metadata: { 
        petName, 
        petBreed, 
        pickupAddress,
        pickupLatitude,
        pickupLongitude,
        distanceKm
      }
    });

    if (!availability.available) {
      return res.status(400).json({ error: availability.message });
    }

    // STEP 2: Get pricing quote using LUXURY ENGINE (with loyalty discounts!)
    const clientIP = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || 
                     req.socket.remoteAddress || 
                     '127.0.0.1';

    const pricing = await walkEliteBookingEngine.quotePrice({
      providerId: walkerId,
      serviceType: 'dog_walk',
      startDate: startDateTime,
      endDate: endDateTime,
      userId: ownerId,
      ipAddress: clientIP,
      metadata: { 
        durationMinutes,
        pickupLatitude,
        pickupLongitude,
        distanceKm,
        petName,
        petBreed,
        petWeight,
        petSpecialNeeds
      }
    });

    // Generate bookingId
    const bookingId = `WALK-${new Date().getFullYear()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    // UBER-STYLE: Create booking in pending_provider status
    // Escrow and payment are NOT created until walker accepts
    const bookingData: InsertWalkBooking = {
      bookingId,
      ownerId,
      walkerId,
      scheduledDate: scheduledDateOnly,
      scheduledStartTime,
      durationMinutes,
      pickupLatitude: pickupLatitude.toString(),
      pickupLongitude: pickupLongitude.toString(),
      pickupAddress,
      geofenceRadiusMeters: 500,
      geofenceCenterLat: pickupLatitude.toString(),
      geofenceCenterLon: pickupLongitude.toString(),
      petName,
      petBreed,
      petWeight,
      petSpecialNeeds,
      walkerRate: pricing.baseRate.toFixed(2),
      platformFeeOwner: (pricing.platformFee * 0.25).toFixed(2),
      platformFeeSitter: (pricing.platformFee * 0.75).toFixed(2),
      totalCost: pricing.totalPrice.toFixed(2),
      walkerPayout: pricing.providerPayout.toFixed(2),
      currency: pricing.currency,
      status: 'pending_provider',
      confirmationCode: randomInt(100000, 1000000).toString(),
      isLiveTrackingActive: false,
      isVideoStreamActive: false,
      isDroneMonitoringActive: false,
      geofenceViolationCount: 0,
      emergencyStopTriggered: false,
      ownerNotified: false,
    };

    const [newBooking] = await db.insert(walkBookings).values(bookingData).returning();

    // Record in Octopus Brain ledger (financial audit trail)
    const octopusId = `OB-WALK-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const priceCents = Math.round(pricing.totalPrice * 100);
    const platformFeeCents = Math.round(pricing.platformFee * 100);
    const providerShareCents = Math.round(pricing.providerPayout * 100);
    try {
      await db.insert(octopusBookings).values({
        id: octopusId,
        platform: 'PETTREK',
        status: 'DRAFT',
        userId: ownerId,
        providerId: walkerId,
        price: priceCents,
        platformFee: platformFeeCents,
        providerShare: providerShareCents,
        idempotencyKey: bookingId,
      });
      await db.insert(octopusLedger).values({
        id: `OL-${crypto.randomBytes(4).toString('hex')}`,
        type: 'BOOKING_CREATED',
        bookingId: octopusId,
        amount: priceCents,
        platform: 'PETTREK',
        metadata: { walkBookingId: bookingId, durationMinutes, ownerId, walkerId },
      });
      console.log(`[Octopus Brain] Walk booking recorded: ${octopusId} for ${bookingId}`);
    } catch (octopusErr) {
      console.warn('[Octopus Brain] Failed to record walk booking (non-blocking)', octopusErr);
    }

    // Create alert for walker (Uber-style notification)
    await db.insert(walkAlerts).values({
      alertId: `ALERT-${crypto.randomUUID()}`,
      bookingId: newBooking.bookingId,
      alertType: 'new_booking',
      severity: 'info',
      title: 'בקשת טיול חדשה!',
      message: `יש לך בקשת טיול חדשה ל-${scheduledDate} בשעה ${scheduledStartTime}. אנא אשר/י באפליקציה.`,
      actionRequired: true,
      sentToWalker: true,
      isRead: false,
    });

    // Notify walker via SMS (fire-and-forget)
    (async () => {
      try {
        const [walker] = await db.select().from(walkerProfiles).where(eq(walkerProfiles.id, parseInt(walkerId)));
        if (walker?.userId) {
          const [walkerUser] = await db.select().from(users).where(eq(users.firebaseUid, walker.userId));
          const walkerPhone = walkerUser?.phone || walkerUser?.phoneNumber;
          if (walkerPhone) {
            const { TwilioSMSService } = await import('../services/TwilioSMSService');
            const smsService = new TwilioSMSService();
            await smsService.sendSMS(
              walkerPhone,
              `🐾 ⁦Pet Wash™⁩ - בקשת טיול חדשה!\n` +
              `תאריך: ${scheduledDate} בשעה ${scheduledStartTime}\n` +
              `${durationMinutes} דקות · ₪${pricing.totalPrice.toFixed(0)}\n` +
              `אנא אשר/י את ההזמנה באפליקציה.`
            );
          }
        }
      } catch (notifErr) {
        console.warn('[Walk My Pet] Walker notification failed (non-blocking)', notifErr);
      }
    })();

    // Generate navigation links for pickup location
    const navigationLinks = buildAllNavigationLinks({
      lat: parseFloat(pickupLatitude),
      lng: parseFloat(pickupLongitude),
      label: `Walk Pickup: ${petName}`,
    });

    res.status(201).json({ 
      success: true, 
      booking: newBooking,
      status: 'pending_provider',
      navigation: navigationLinks,
      message: 'הבקשה נשלחה למטייל/ת. תקבל/י עדכון כשההזמנה תאושר.'
    });
  } catch (error: any) {
    console.error('[Walk My Pet] Booking error:', error);
    res.status(500).json({ error: 'Failed to create booking', details: error.message });
  }
});

/**
 * PATCH /api/walk-my-pet/bookings/:bookingId/provider-respond
 * Uber-style: Walker accepts or declines a walk request
 */
router.patch('/bookings/:bookingId/provider-respond', requireAuth, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { action, declineReason } = req.body;
    const providerUid = (req as any).user?.uid;
    
    if (!['accept', 'decline'].includes(action)) {
      return res.status(400).json({ error: 'Action must be accept or decline' });
    }

    const [booking] = await db
      .select()
      .from(walkBookings)
      .where(eq(walkBookings.bookingId, bookingId));
    
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    
    if (booking.status !== 'pending_provider') {
      return res.status(400).json({ error: `Booking is already ${booking.status}` });
    }

    const [walker] = await db
      .select()
      .from(walkerProfiles)
      .where(eq(walkerProfiles.walkerId, booking.walkerId));
    
    if (!walker || walker.userId !== providerUid) {
      return res.status(403).json({ error: 'Only the assigned walker can respond' });
    }
    
    if (action === 'accept') {
      // Confirm booking with luxury engine (escrow + audit trail)
      try {
        const pricing = {
          subtotal: parseFloat(booking.walkerRate || '0'),
          platformFee: parseFloat(booking.platformFeeOwner || '0') + parseFloat(booking.platformFeeSitter || '0'),
          providerPayout: parseFloat(booking.walkerPayout || '0'),
          totalPrice: parseFloat(booking.totalCost || '0'),
          loyaltyDiscount: 0,
          currency: booking.currency || 'ILS',
          breakdown: [],
          baseRate: parseFloat(booking.walkerRate || '0'),
        };

        await walkEliteBookingEngine.confirmBooking(
          booking.bookingId,
          pricing,
          booking.ownerId
        );
      } catch (escrowErr: any) {
        console.error(`[Walk My Pet] Escrow confirmation failed for ${bookingId}`, escrowErr);
      }

      await db
        .update(walkBookings)
        .set({
          status: 'confirmed',
          updatedAt: new Date(),
        })
        .where(eq(walkBookings.bookingId, bookingId));
      
      await syncChatToBookingStatus(bookingId, 'confirmed', 'walk_my_pet');
      
      logger.info(`[Walk My Pet] Walker ACCEPTED booking ${bookingId}`);

      // Update Octopus Brain: DRAFT → CONFIRMED + payment captured ledger
      try {
        const [octopusRecord] = await db.select().from(octopusBookings)
          .where(eq(octopusBookings.idempotencyKey, booking.bookingId)).limit(1);
        if (octopusRecord) {
          await db.update(octopusBookings)
            .set({ status: 'CONFIRMED', updatedAt: new Date() })
            .where(eq(octopusBookings.id, octopusRecord.id));
          await db.insert(octopusLedger).values({
            id: `OL-${crypto.randomBytes(4).toString('hex')}`,
            type: 'PAYMENT_CAPTURED',
            bookingId: octopusRecord.id,
            amount: octopusRecord.price,
            platform: 'PETTREK',
            metadata: { walkBookingId: booking.bookingId, escrowHoldHours: 72 },
          });
          logger.info('[Octopus Brain] Walk booking confirmed + payment captured', { octopusId: octopusRecord.id });
        }
      } catch (octopusErr) {
        logger.warn('[Octopus Brain] Failed to update walk booking status (non-blocking)', octopusErr);
      }

      // Generate Israeli digital receipt (non-blocking)
      try {
        const totalAmount = parseFloat(booking.totalCost || '0');
        const platformFeeAmount = parseFloat(booking.platformFeeOwner || '0') + parseFloat(booking.platformFeeSitter || '0');
        const walkerPayoutAmount = parseFloat(booking.walkerPayout || '0');
        await IsraeliDigitalReceiptService.generateReceipt({
          platform: 'walk-my-pet',
          bookingId: booking.bookingId,
          nayaxTransactionId: undefined,
          customerEmail: '',
          customerName: '',
          providerName: walker.businessName || `Walker ${walker.walkerId}`,
          providerId: walker.walkerId,
          providerType: 'walker',
          serviceDescription: `Dog walk - ${booking.durationMinutes} minutes`,
          serviceDescriptionHe: `טיול כלבים - ${booking.durationMinutes} דקות`,
          subtotalAmount: parseFloat(booking.walkerRate || '0'),
          platformFeeAmount,
          totalAmount,
          paymentMethod: 'Nayax Card Payment',
          providerPayoutAmount: walkerPayoutAmount,
          brokerCommissionAmount: platformFeeAmount,
        });
      } catch (receiptErr) {
        logger.warn('[Walk My Pet] Receipt generation after accept failed (non-blocking)', receiptErr);
      }

      // Record in P&L ledger for VAT accounting (non-blocking)
      try {
        await VATCalculatorService.recordTransaction(
          'walk-my-pet',
          booking.bookingId,
          parseFloat(booking.walkerRate || '0'),
          booking.bookingId,
          {
            walkerId: booking.walkerId,
            durationMinutes: booking.durationMinutes,
          }
        );
      } catch (vatErr) {
        logger.warn('[Walk My Pet] VAT ledger recording after accept failed (non-blocking)', vatErr);
      }

      // Add calendar event (non-blocking)
      calendarIntegrationService.createBookingEvent({
        platform: 'walk-my-pet',
        bookingId: booking.bookingId,
        title: `⁦Walk My Pet™⁩ - Dog Walk (${booking.durationMinutes} min)`,
        description: `Dog walking booking confirmed for ${booking.durationMinutes} minutes`,
        startTime: new Date(booking.scheduledDate),
        endTime: new Date(new Date(booking.scheduledDate).getTime() + (booking.durationMinutes || 60) * 60000),
        providerName: walker.businessName || `Walker ${walker.walkerId}`,
      }).catch(() => {});

      // Backup financial records to Google Cloud Storage (non-blocking)
      (async () => {
        try {
          await backupFinancialDocument({
            documentType: 'escrow_record',
            bookingId: booking.bookingId,
            platform: 'PETTREK',
            content: JSON.stringify({
              bookingId: booking.bookingId,
              ownerId: booking.ownerId,
              walkerId: booking.walkerId,
              totalCost: booking.totalCost,
              walkerPayout: booking.walkerPayout,
              platformFeeOwner: booking.platformFeeOwner,
              platformFeeSitter: booking.platformFeeSitter,
              confirmedAt: new Date().toISOString(),
              escrowHoldHours: 72,
              durationMinutes: booking.durationMinutes,
            }, null, 2),
          });
        } catch (gcsErr) {
          logger.warn('[GCS] Walk financial backup failed (non-blocking)', gcsErr);
        }
      })();
      
      res.json({
        success: true,
        status: 'confirmed',
        message: 'הטיול אושר! הלקוח/ה קיבל/ה הודעה.',
      });
    } else {
      await db
        .update(walkBookings)
        .set({
          status: 'cancelled',
          updatedAt: new Date(),
        })
        .where(eq(walkBookings.bookingId, bookingId));
      
      await syncChatToBookingStatus(bookingId, 'cancelled', 'walk_my_pet');
      
      logger.info(`[Walk My Pet] Walker DECLINED booking ${bookingId}, reason: ${declineReason}`);
      
      res.json({
        success: true,
        status: 'declined',
        message: 'הטיול נדחה. הלקוח/ה יקבל/תקבל הודעה.',
      });
    }
  } catch (error: any) {
    console.error('[Walk My Pet] Provider respond error:', error);
    res.status(500).json({ error: 'Failed to process provider response' });
  }
});

/**
 * GET /api/walk-my-pet/bookings/provider-pending
 * Get all pending walk requests for the authenticated walker
 */
router.get('/bookings/provider-pending', requireAuth, async (req, res) => {
  try {
    const providerUid = (req as any).user?.uid;
    
    const [walker] = await db
      .select()
      .from(walkerProfiles)
      .where(eq(walkerProfiles.userId, providerUid));
    
    if (!walker) {
      return res.json({ bookings: [], total: 0 });
    }
    
    const pendingBookings = await db
      .select()
      .from(walkBookings)
      .where(
        and(
          eq(walkBookings.walkerId, walker.walkerId),
          eq(walkBookings.status, 'pending_provider')
        )
      )
      .orderBy(desc(walkBookings.createdAt));
    
    res.json({ bookings: pendingBookings, total: pendingBookings.length });
  } catch (error: any) {
    console.error('[Walk My Pet] Fetch provider pending error:', error);
    res.status(500).json({ error: 'Failed to fetch pending bookings' });
  }
});

// EMERGENCY/ASAP WALK REQUEST (Pet Wash™ "Book Now" model)
router.post('/walks/emergency-request', requireAuth, async (req, res) => {
  try {
    const ownerId = req.body.ownerId || (req as any).user?.uid;
    if (!ownerId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { EmergencyWalkService } = await import('../services/EmergencyWalkService');
    
    const result = await EmergencyWalkService.requestEmergencyWalk({
      ownerId,
      ownerEmail: req.body.ownerEmail,
      petName: req.body.petName,
      petBreed: req.body.petBreed,
      petWeight: req.body.petWeight,
      specialInstructions: req.body.specialInstructions,
      location: {
        latitude: req.body.latitude,
        longitude: req.body.longitude,
        address: req.body.address,
      },
      walkDuration: req.body.walkDuration, // 30 or 60 minutes only
    });

    if (!result.success) {
      return res.status(400).json({ 
        success: false, 
        error: result.error 
      });
    }

    // Generate navigation links for emergency pickup location
    const navigationLinks = buildAllNavigationLinks({
      lat: req.body.latitude,
      lng: req.body.longitude,
      label: `Emergency Walk: ${req.body.petName}`,
    });

    res.status(201).json({
      success: true,
      bookingId: result.bookingId,
      matchedWalker: result.matchedWalker,
      pricing: result.pricing,
      surgePricing: result.surgePricing,
      eta: result.eta,
      navigation: navigationLinks,
      message: `Emergency walk confirmed! Walker ${result.matchedWalker?.walkerName} will arrive in ${result.matchedWalker?.estimatedArrivalMinutes} minutes.`,
    });
  } catch (error: any) {
    console.error('[Emergency Walk] Request failed:', error);
    res.status(500).json({ error: 'Failed to process emergency walk request', details: error.message });
  }
});

// =================== SLOT HOLDS (DB-persisted, double-booking prevention) ===================

router.post('/walks/holds', requireAuth, async (req, res) => {
  try {
    const { slotId, walkerId, estimatedAmount, walkDuration } = req.body;
    if (!slotId || !walkerId) {
      return res.status(400).json({ success: false, error: 'slotId and walkerId are required' });
    }
    const now = new Date();
    // Purge expired holds first (lazy cleanup)
    await db.delete(walkSlotHolds).where(lt(walkSlotHolds.expiresAt, now));
    // Check if walker slot is already held by an active hold
    const [existing] = await db.select()
      .from(walkSlotHolds)
      .where(and(eq(walkSlotHolds.walkerId, walkerId), gte(walkSlotHolds.expiresAt, now)))
      .limit(1);
    if (existing) {
      return res.status(409).json({ success: false, error: 'Walker slot currently held by another booking' });
    }
    const holdId = `HOLD-${randomBytes(6).toString('hex').toUpperCase()}`;
    const ttlMs = (walkDuration || 30) * 60 * 1000 + 5 * 60 * 1000; // walk duration + 5min buffer
    const expiresAt = new Date(Date.now() + ttlMs);
    await db.insert(walkSlotHolds).values({
      holdId,
      slotId,
      walkerId,
      estimatedAmount: String(estimatedAmount || 0),
      expiresAt,
    });
    return res.json({ success: true, holdId, slotId, estimatedAmount: estimatedAmount || 0, expiresAt: expiresAt.toISOString() });
  } catch (error: any) {
    console.error('[Walk Holds] Error:', error);
    res.status(500).json({ success: false, error: 'Failed to create slot hold' });
  }
});

// Get booking details
router.get('/walks/:bookingId', async (req, res) => {
  try {
    const { bookingId } = req.params;
    
    const [booking] = await db
      .select()
      .from(walkBookings)
      .where(eq(walkBookings.bookingId, bookingId))
      .limit(1);

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Get walker details
    const [walker] = await db
      .select()
      .from(walkerProfiles)
      .where(eq(walkerProfiles.walkerId, booking.walkerId))
      .limit(1);

    res.json({ 
      booking,
      walker: walker ? {
        walkerId: walker.walkerId,
        displayName: walker.displayName,
        profilePhotoUrl: walker.profilePhotoUrl,
        averageRating: walker.averageRating,
        totalWalks: walker.totalWalks,
        hasBodyCamera: walker.hasBodyCamera,
        hasDroneAccess: walker.hasDroneAccess,
      } : null
    });
  } catch (error: any) {
    console.error('[Walk My Pet] Get booking error:', error);
    res.status(500).json({ error: 'Failed to fetch booking' });
  }
});

// Walker confirms booking
router.post('/walks/:bookingId/confirm', async (req, res) => {
  try {
    const { bookingId } = req.params;
    const walkerId = req.body.walkerId;

    const [booking] = await db
      .select()
      .from(walkBookings)
      .where(eq(walkBookings.bookingId, bookingId))
      .limit(1);

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (booking.walkerId !== walkerId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    if (booking.status !== 'pending') {
      return res.status(400).json({ error: 'Booking already processed' });
    }

    const [updatedBooking] = await db
      .update(walkBookings)
      .set({ status: 'confirmed', updatedAt: new Date() })
      .where(eq(walkBookings.bookingId, bookingId))
      .returning();

    await syncChatToBookingStatus(bookingId, 'confirmed', 'walk_my_pet');

    // Notify owner
    await db.insert(walkAlerts).values({
      alertId: `ALERT-${crypto.randomUUID()}`,
      bookingId,
      alertType: 'booking_confirmed',
      severity: 'info',
      title: 'Walk Confirmed!',
      message: 'Your walker has confirmed the walk. See you soon!',
      actionRequired: false,
      sentToOwner: true,
      isRead: false,
    });

    calendarIntegrationService.createBookingEvent({
      platform: 'walk-my-pet',
      bookingId: booking.bookingId,
      title: `⁦Walk My Pet™⁩ - Dog Walk`,
      description: `Dog walk booking confirmed`,
      startTime: new Date(booking.scheduledDate),
      endTime: new Date(new Date(booking.scheduledDate).getTime() + (booking.durationMinutes || 30) * 60000),
      location: booking.pickupAddress || undefined,
      petName: booking.petName || undefined,
    }).catch(() => {});

    res.json({ success: true, booking: updatedBooking });
  } catch (error: any) {
    console.error('[Walk My Pet] Confirm booking error:', error);
    res.status(500).json({ error: 'Failed to confirm booking' });
  }
});

// Start walk (walker initiates)
router.post('/walks/:bookingId/start', async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { confirmationCode, latitude, longitude } = req.body;

    const [booking] = await db
      .select()
      .from(walkBookings)
      .where(eq(walkBookings.bookingId, bookingId))
      .limit(1);

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (booking.confirmationCode !== confirmationCode) {
      return res.status(400).json({ error: 'Invalid confirmation code' });
    }

    if (booking.status !== 'confirmed') {
      return res.status(400).json({ error: 'Booking not confirmed' });
    }

    const [updatedBooking] = await db
      .update(walkBookings)
      .set({ 
        status: 'in_progress',
        actualStartTime: new Date(),
        isLiveTrackingActive: true,
        updatedAt: new Date()
      })
      .where(eq(walkBookings.bookingId, bookingId))
      .returning();

    await syncChatToBookingStatus(bookingId, 'in_progress', 'walk_my_pet');

    // Record first GPS point
    await db.insert(walkGpsTracking).values({
      bookingId,
      latitude: latitude.toString(),
      longitude: longitude.toString(),
      isInsideGeofence: true,
      recordedAt: new Date(),
    });

    // Notify owner
    await db.insert(walkAlerts).values({
      alertId: `ALERT-${crypto.randomUUID()}`,
      bookingId,
      alertType: 'walk_started',
      severity: 'info',
      title: 'Walk Started!',
      message: 'Your dog\'s walk has begun. Track live location now!',
      actionRequired: false,
      sentToOwner: true,
      isRead: false,
    });

    res.json({ success: true, booking: updatedBooking, message: 'Walk started! Live tracking active.' });
  } catch (error: any) {
    console.error('[Walk My Pet] Start walk error:', error);
    res.status(500).json({ error: 'Failed to start walk' });
  }
});

// =================== GPS TRACKING ===================

// Upload GPS point (walker's device streams location)
router.post('/walks/:bookingId/gps', async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { latitude, longitude, accuracy, speed, heading, batteryLevel } = req.body;

    const [booking] = await db
      .select()
      .from(walkBookings)
      .where(eq(walkBookings.bookingId, bookingId))
      .limit(1);

    if (!booking || booking.status !== 'in_progress') {
      return res.status(400).json({ error: 'Walk not in progress' });
    }

    // Calculate distance from geofence center
    const centerLat = parseFloat(booking.geofenceCenterLat || '0');
    const centerLon = parseFloat(booking.geofenceCenterLon || '0');
    const R = 6371000; // Earth's radius in meters
    const dLat = (latitude - centerLat) * Math.PI / 180;
    const dLon = (longitude - centerLon) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(centerLat * Math.PI / 180) * Math.cos(latitude * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distanceMeters = R * c;

    const isInsideGeofence = distanceMeters <= (booking.geofenceRadiusMeters || 500);

    // Record GPS point
    await db.insert(walkGpsTracking).values({
      bookingId,
      latitude: latitude.toString(),
      longitude: longitude.toString(),
      accuracy: accuracy?.toString(),
      speed: speed?.toString(),
      heading: heading?.toString(),
      isInsideGeofence,
      distanceFromCenterMeters: distanceMeters.toFixed(2),
      batteryLevel,
      recordedAt: new Date(),
    });

    // Geofence violation check
    if (!isInsideGeofence) {
      const currentViolations = booking.geofenceViolationCount || 0;
      await db
        .update(walkBookings)
        .set({ 
          geofenceViolationCount: currentViolations + 1,
          updatedAt: new Date()
        })
        .where(eq(walkBookings.bookingId, bookingId));

      // Send alert to owner
      if (currentViolations === 0) { // First violation only
        await db.insert(walkAlerts).values({
          alertId: `ALERT-${crypto.randomUUID()}`,
          bookingId,
          alertType: 'geofence_exit',
          severity: 'warning',
          title: 'Geofence Alert',
          message: `Walker has left the designated safe zone (${distanceMeters.toFixed(0)}m away)`,
          actionRequired: false,
          sentToOwner: true,
          isRead: false,
        });
      }
    }

    res.json({ success: true, isInsideGeofence, distanceMeters: distanceMeters.toFixed(2) });
  } catch (error: any) {
    console.error('[Walk My Pet] GPS tracking error:', error);
    res.status(500).json({ error: 'Failed to record GPS data' });
  }
});

// Get live GPS tracking data
router.get('/walks/:bookingId/gps/live', async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { limit = 50 } = req.query;

    const gpsPoints = await db
      .select()
      .from(walkGpsTracking)
      .where(eq(walkGpsTracking.bookingId, bookingId))
      .orderBy(desc(walkGpsTracking.recordedAt))
      .limit(parseInt(limit as string));

    res.json({ success: true, gpsPoints: gpsPoints.reverse() });
  } catch (error: any) {
    console.error('[Walk My Pet] Get GPS data error:', error);
    res.status(500).json({ error: 'Failed to fetch GPS data' });
  }
});

// =================== WALK COMPLETION ===================

// Complete walk
router.post('/walks/:bookingId/complete', async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { completionNotes, healthData } = req.body;

    const [booking] = await db
      .select()
      .from(walkBookings)
      .where(eq(walkBookings.bookingId, bookingId))
      .limit(1);

    if (!booking || booking.status !== 'in_progress') {
      return res.status(400).json({ error: 'Walk not in progress' });
    }

    const actualDuration = booking.actualStartTime 
      ? Math.round((new Date().getTime() - new Date(booking.actualStartTime).getTime()) / 60000)
      : booking.durationMinutes;

    // Get all GPS points for blockchain verification
    const gpsPoints = await db
      .select()
      .from(walkGpsTracking)
      .where(eq(walkGpsTracking.bookingId, bookingId));

    // Calculate total distance
    let totalDistance = 0;
    for (let i = 1; i < gpsPoints.length; i++) {
      const lat1 = parseFloat(gpsPoints[i-1].latitude);
      const lon1 = parseFloat(gpsPoints[i-1].longitude);
      const lat2 = parseFloat(gpsPoints[i].latitude);
      const lon2 = parseFloat(gpsPoints[i].longitude);
      
      const R = 6371000; // meters
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      totalDistance += R * c;
    }

    // Update booking
    const [updatedBooking] = await db
      .update(walkBookings)
      .set({
        status: 'completed',
        actualEndTime: new Date(),
        actualDurationMinutes: actualDuration,
        walkCompletedSuccessfully: true,
        completionNotes,
        isLiveTrackingActive: false,
        updatedAt: new Date(),
      })
      .where(eq(walkBookings.bookingId, bookingId))
      .returning();

    await syncChatToBookingStatus(bookingId, 'completed', 'walk_my_pet');

    // Create blockchain audit record
    const previousBlock = await db
      .select()
      .from(walkBlockchainAudit)
      .orderBy(desc(walkBlockchainAudit.createdAt))
      .limit(1);

    const blockData = {
      bookingId,
      walkStartTimestamp: booking.actualStartTime!,
      walkEndTimestamp: new Date(),
      totalDurationSeconds: actualDuration * 60,
      totalDistanceMeters: Math.round(totalDistance),
      gpsDataPointsCount: gpsPoints.length,
      geofenceViolations: booking.geofenceViolationCount || 0,
      geofenceCompliancePercent: ((gpsPoints.filter(p => p.isInsideGeofence).length / gpsPoints.length) * 100).toFixed(2),
      amountPaidByOwner: booking.totalCost,
      amountPaidToWalker: booking.walkerPayout,
      platformCommission: (parseFloat(booking.platformFeeOwner) + parseFloat(booking.platformFeeSitter)).toFixed(2),
    };

    const blockString = JSON.stringify(blockData);
    const blockHash = crypto.createHash('sha256').update(blockString).digest('hex');
    const previousBlockHash = previousBlock[0]?.blockHash || '0';

    await db.insert(walkBlockchainAudit).values({
      ...blockData,
      blockHash,
      previousBlockHash,
      merkleRoot: crypto.createHash('sha256').update(gpsPoints.map(p => `${p.latitude},${p.longitude}`).join('|')).digest('hex'),
      verificationStatus: 'verified',
    });

    // Save health data if provided
    if (healthData) {
      await db.insert(walkHealthData).values({
        bookingId,
        ...healthData,
        distanceKm: (totalDistance / 1000).toFixed(2),
      });
    }

    // Notify owner
    await db.insert(walkAlerts).values({
      alertId: `ALERT-${crypto.randomUUID()}`,
      bookingId,
      alertType: 'completion',
      severity: 'info',
      title: 'Walk Completed!',
      message: `Walk completed successfully! Distance: ${(totalDistance/1000).toFixed(2)}km`,
      actionRequired: false,
      sentToOwner: true,
      isRead: false,
    });

    // Update walker stats
    await db.execute(sql`
      UPDATE walker_profiles 
      SET total_walks = total_walks + 1,
          updated_at = NOW()
      WHERE walker_id = ${booking.walkerId}
    `);

    res.json({ 
      success: true, 
      booking: updatedBooking,
      stats: {
        distanceKm: (totalDistance / 1000).toFixed(2),
        durationMinutes: actualDuration,
        gpsPointsRecorded: gpsPoints.length,
        blockchainHash: blockHash,
      }
    });
  } catch (error: any) {
    console.error('[Walk My Pet] Complete walk error:', error);
    res.status(500).json({ error: 'Failed to complete walk' });
  }
});

// =================== REVIEWS ===================

// Submit walker review
router.post('/walkers/:walkerId/review', async (req, res) => {
  try {
    const { walkerId } = req.params;
    const ownerId = req.body.ownerId || (req as any).user?.uid;
    
    const reviewData: InsertWalkerReview = {
      reviewId: `REV-${crypto.randomUUID()}`,
      ...req.body,
      walkerId,
      ownerId,
      isVerifiedWalk: true,
      isFlagged: false,
    };

    const [newReview] = await db.insert(walkerReviews).values(reviewData).returning();

    // Update walker's average rating
    const allReviews = await db
      .select()
      .from(walkerReviews)
      .where(eq(walkerReviews.walkerId, walkerId));

    const avgRating = allReviews.reduce((sum, r) => sum + r.overallRating, 0) / allReviews.length;

    await db
      .update(walkerProfiles)
      .set({ 
        averageRating: avgRating.toFixed(2),
        totalReviews: allReviews.length,
        updatedAt: new Date()
      })
      .where(eq(walkerProfiles.walkerId, walkerId));

    res.status(201).json({ success: true, review: newReview });
  } catch (error: any) {
    console.error('[Walk My Pet] Review error:', error);
    res.status(500).json({ error: 'Failed to submit review' });
  }
});

// Get walker reviews
router.get('/walkers/:walkerId/reviews', async (req, res) => {
  try {
    const { walkerId } = req.params;
    const { limit = 20, offset = 0 } = req.query;

    const reviews = await db
      .select()
      .from(walkerReviews)
      .where(eq(walkerReviews.walkerId, walkerId))
      .orderBy(desc(walkerReviews.createdAt))
      .limit(parseInt(limit as string))
      .offset(parseInt(offset as string));

    res.json({ success: true, reviews });
  } catch (error: any) {
    console.error('[Walk My Pet] Get reviews error:', error);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

// =================== USER BOOKINGS ===================

// Get user's bookings (as owner)
router.get('/users/:userId/walks', async (req, res) => {
  try {
    const { userId } = req.params;
    const { status } = req.query;

    let query = db
      .select()
      .from(walkBookings)
      .where(eq(walkBookings.ownerId, userId))
      .orderBy(desc(walkBookings.createdAt));

    if (status) {
      query = query.where(eq(walkBookings.status, status as string)) as any;
    }

    const bookings = await query;

    res.json({ success: true, bookings });
  } catch (error: any) {
    console.error('[Walk My Pet] Get user bookings error:', error);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// Get walker's bookings
router.get('/walkers/:walkerId/walks', async (req, res) => {
  try {
    const { walkerId } = req.params;
    const { status } = req.query;

    let query = db
      .select()
      .from(walkBookings)
      .where(eq(walkBookings.walkerId, walkerId))
      .orderBy(desc(walkBookings.createdAt));

    if (status) {
      query = query.where(eq(walkBookings.status, status as string)) as any;
    }

    const bookings = await query;

    res.json({ success: true, bookings });
  } catch (error: any) {
    console.error('[Walk My Pet] Get walker bookings error:', error);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// =================== WALK-MY-PET API (Frontend Compatible) ===================

// Get walker profile by numeric ID with reviews (for WalkerDetail.tsx)
router.get('/walker-detail/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid walker ID' });
    }
    
    const [walker] = await db
      .select()
      .from(walkerProfiles)
      .where(eq(walkerProfiles.id, id))
      .limit(1);

    if (!walker) {
      return res.status(404).json({ error: 'Walker not found' });
    }

    // Fetch reviews for this walker
    const reviews = await db
      .select()
      .from(walkerReviews)
      .where(eq(walkerReviews.walkerId, walker.walkerId))
      .orderBy(desc(walkerReviews.createdAt))
      .limit(10);

    // Transform to frontend expected format
    const walkerForFrontend = {
      id: walker.id,
      userId: walker.userId,
      firstName: walker.firstName || 'Walker',
      lastName: walker.lastName || '',
      email: walker.email || '',
      phone: walker.phone || '',
      city: walker.city || 'Tel Aviv',
      bio: walker.bio || '',
      yearsOfExperience: walker.yearsExperience || 0,
      pricePerWalkCents: walker.pricePerWalkCents || 5000,
      profilePictureUrl: walker.profilePhotoUrl,
      rating: walker.averageRating || '4.9',
      totalWalks: walker.totalWalks || 0,
      isActive: walker.isActive !== false,
      isVerified: walker.verificationStatus === 'verified',
    };

    const reviewsForFrontend = reviews.map(r => ({
      id: r.id,
      customerName: 'Verified Customer',
      rating: r.overallRating,
      comment: r.reviewText || '',
      createdAt: r.createdAt?.toISOString() || new Date().toISOString(),
      petType: 'Dog',
    }));

    res.json({ walker: walkerForFrontend, reviews: reviewsForFrontend });
  } catch (error: any) {
    console.error('[Walk My Pet] Get walker by ID error:', error);
    res.status(500).json({ error: 'Failed to fetch walker profile' });
  }
});

router.get('/walkers-list', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 12));
    const offset = (page - 1) * limit;
    const city = req.query.city as string | undefined;

    const conditions = [eq(walkerProfiles.isActive, true)];
    if (city && city !== 'all') {
      conditions.push(eq(walkerProfiles.city, city));
    }

    const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];

    const [countResult, walkers] = await Promise.all([
      db.select({ count: sql<number>`count(*)` })
        .from(walkerProfiles)
        .where(whereClause),
      db.select()
        .from(walkerProfiles)
        .where(whereClause)
        .orderBy(desc(walkerProfiles.averageRating))
        .limit(limit)
        .offset(offset),
    ]);

    const total = Number(countResult[0]?.count || 0);
    const totalPages = Math.ceil(total / limit);

    const walkersForFrontend = walkers.map(w => ({
      id: w.id,
      userId: w.userId,
      firstName: w.firstName || 'Walker',
      lastName: w.lastName || '',
      city: w.city || 'Tel Aviv',
      bio: w.bio || '',
      yearsOfExperience: w.yearsExperience || 0,
      pricePerWalkCents: w.pricePerWalkCents || 5000,
      profilePictureUrl: w.profilePhotoUrl,
      rating: w.averageRating || '4.9',
      totalWalks: w.totalWalks || 0,
      isActive: w.isActive !== false,
      isVerified: w.verificationStatus === 'verified',
    }));

    res.json({
      providers: walkersForFrontend,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
    });
  } catch (error: any) {
    console.error('[Walk My Pet] List walkers error:', error);
    res.status(500).json({ error: 'Failed to fetch walkers' });
  }
});

// =================== WALKER DASHBOARD ENDPOINTS ===================

// GET /api/walk-my-pet/walker/requests — pending walk requests for the authenticated walker
router.get('/walker/requests', requireAuth, async (req, res) => {
  try {
    const walkerId = (req as any).user?.uid;
    if (!walkerId) return res.status(401).json({ error: 'Authentication required' });

    const requests = await db.select()
      .from(bookingRequests)
      .where(and(
        eq(bookingRequests.providerId, walkerId),
        eq(bookingRequests.providerType, 'walker'),
        sql`${bookingRequests.status} = 'pending'`
      ))
      .orderBy(desc(bookingRequests.createdAt))
      .limit(50);

    const formatted = requests.map(r => ({
      id: r.requestId,
      dbId: r.id,
      ownerName: (r.petDetails as any)?.ownerName || 'Pet Owner',
      ownerPhoto: null,
      ownerPhone: '',
      petName: (r.petDetails as any)?.petName || 'Pet',
      petType: (r.petDetails as any)?.petType || 'dog',
      petBreed: (r.petDetails as any)?.petBreed || '',
      scheduledTime: r.startDate,
      duration: Math.round(Number(r.totalHours || 1) * 60),
      pickupAddress: (r.petDetails as any)?.address || '',
      dropoffAddress: (r.petDetails as any)?.address || '',
      status: 'scheduled',
      earnings: (r.subtotalCents || 0) / 100,
      currency: r.currency || 'ILS',
      specialInstructions: r.ownerMessage || null,
      distance: 0,
    }));

    res.json(formatted);
  } catch (error) {
    logger.error('[Walker Dashboard] Error fetching requests', error);
    res.status(500).json({ error: 'Failed to fetch walk requests' });
  }
});

// GET /api/walk-my-pet/walker/active — currently active walk
router.get('/walker/active', requireAuth, async (req, res) => {
  try {
    const walkerId = (req as any).user?.uid;
    if (!walkerId) return res.status(401).json({ error: 'Authentication required' });

    const [active] = await db.select()
      .from(bookingRequests)
      .where(and(
        eq(bookingRequests.providerId, walkerId),
        eq(bookingRequests.providerType, 'walker'),
        sql`${bookingRequests.status} IN ('accepted', 'in_progress')`
      ))
      .orderBy(desc(bookingRequests.serviceStartedAt))
      .limit(1);

    if (!active) return res.json(null);

    res.json({
      id: active.requestId,
      dbId: active.id,
      ownerName: (active.petDetails as any)?.ownerName || 'Pet Owner',
      ownerPhoto: null,
      ownerPhone: '',
      petName: (active.petDetails as any)?.petName || 'Pet',
      petType: (active.petDetails as any)?.petType || 'dog',
      petBreed: (active.petDetails as any)?.petBreed || '',
      scheduledTime: active.startDate,
      duration: Math.round(Number(active.totalHours || 1) * 60),
      pickupAddress: (active.petDetails as any)?.address || '',
      dropoffAddress: (active.petDetails as any)?.address || '',
      status: active.status === 'in_progress' ? 'in_progress' : 'scheduled',
      earnings: (active.subtotalCents || 0) / 100,
      currency: active.currency || 'ILS',
      specialInstructions: active.ownerMessage || null,
      distance: 0,
    });
  } catch (error) {
    logger.error('[Walker Dashboard] Error fetching active walk', error);
    res.status(500).json({ error: 'Failed to fetch active walk' });
  }
});

// GET /api/walk-my-pet/walker/completed — completed walks history
router.get('/walker/completed', requireAuth, async (req, res) => {
  try {
    const walkerId = (req as any).user?.uid;
    if (!walkerId) return res.status(401).json({ error: 'Authentication required' });

    const completed = await db.select()
      .from(bookingRequests)
      .where(and(
        eq(bookingRequests.providerId, walkerId),
        eq(bookingRequests.providerType, 'walker'),
        sql`${bookingRequests.status} = 'completed'`
      ))
      .orderBy(desc(bookingRequests.serviceCompletedAt))
      .limit(100);

    const formatted = completed.map(r => ({
      id: r.requestId,
      dbId: r.id,
      ownerName: (r.petDetails as any)?.ownerName || 'Pet Owner',
      ownerPhoto: null,
      ownerPhone: '',
      petName: (r.petDetails as any)?.petName || 'Pet',
      petType: (r.petDetails as any)?.petType || 'dog',
      petBreed: (r.petDetails as any)?.petBreed || '',
      scheduledTime: r.startDate,
      completedAt: r.serviceCompletedAt,
      duration: Math.round(Number(r.totalHours || 1) * 60),
      pickupAddress: (r.petDetails as any)?.address || '',
      dropoffAddress: (r.petDetails as any)?.address || '',
      status: 'completed',
      earnings: (r.subtotalCents || 0) / 100,
      currency: r.currency || 'ILS',
      specialInstructions: null,
      distance: 0,
      rating: r.ownerRating ? Number(r.ownerRating) : null,
      review: r.ownerReview || null,
    }));

    res.json(formatted);
  } catch (error) {
    logger.error('[Walker Dashboard] Error fetching completed walks', error);
    res.status(500).json({ error: 'Failed to fetch completed walks' });
  }
});

// GET /api/walk-my-pet/walker/earnings — earnings summary
router.get('/walker/earnings', requireAuth, async (req, res) => {
  try {
    const walkerId = (req as any).user?.uid;
    if (!walkerId) return res.status(401).json({ error: 'Authentication required' });

    const allCompleted = await db.select()
      .from(bookingRequests)
      .where(and(
        eq(bookingRequests.providerId, walkerId),
        eq(bookingRequests.providerType, 'walker'),
        sql`${bookingRequests.status} = 'completed'`
      ));

    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const totalCents = allCompleted.reduce((sum, r) => sum + (r.subtotalCents || 0), 0);
    const weeklyCents = allCompleted
      .filter(r => r.serviceCompletedAt && new Date(r.serviceCompletedAt) >= startOfWeek)
      .reduce((sum, r) => sum + (r.subtotalCents || 0), 0);
    const monthlyCents = allCompleted
      .filter(r => r.serviceCompletedAt && new Date(r.serviceCompletedAt) >= startOfMonth)
      .reduce((sum, r) => sum + (r.subtotalCents || 0), 0);

    const pending = await db.select()
      .from(bookingRequests)
      .where(and(
        eq(bookingRequests.providerId, walkerId),
        eq(bookingRequests.providerType, 'walker'),
        sql`${bookingRequests.status} IN ('accepted', 'in_progress')`
      ));

    const pendingCents = pending.reduce((sum, r) => sum + (r.subtotalCents || 0), 0);

    res.json({
      total: totalCents / 100,
      weekly: weeklyCents / 100,
      monthly: monthlyCents / 100,
      pending: pendingCents / 100,
      currency: 'ILS',
      totalWalks: allCompleted.length,
    });
  } catch (error) {
    logger.error('[Walker Dashboard] Error fetching earnings', error);
    res.status(500).json({ error: 'Failed to fetch earnings' });
  }
});

// GET /api/walk-my-pet/walker/reviews — reviews received by the walker
router.get('/walker/reviews', requireAuth, async (req, res) => {
  try {
    const walkerId = (req as any).user?.uid;
    if (!walkerId) return res.status(401).json({ error: 'Authentication required' });

    const reviewed = await db.select()
      .from(bookingRequests)
      .where(and(
        eq(bookingRequests.providerId, walkerId),
        eq(bookingRequests.providerType, 'walker'),
        isNotNull(bookingRequests.ownerRating)
      ))
      .orderBy(desc(bookingRequests.serviceCompletedAt))
      .limit(50);

    const formatted = reviewed.map(r => ({
      id: r.requestId,
      ownerName: (r.petDetails as any)?.ownerName || 'Pet Owner',
      ownerPhoto: null,
      rating: r.ownerRating ? Number(r.ownerRating) : 5,
      comment: r.ownerReview || '',
      petName: (r.petDetails as any)?.petName || 'Pet',
      date: r.serviceCompletedAt || r.updatedAt,
    }));

    const avgRating = formatted.length > 0
      ? formatted.reduce((sum, r) => sum + r.rating, 0) / formatted.length
      : 5.0;

    res.json({
      reviews: formatted,
      averageRating: Math.round(avgRating * 10) / 10,
      totalReviews: formatted.length,
    });
  } catch (error) {
    logger.error('[Walker Dashboard] Error fetching reviews', error);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

// GET /api/walk-my-pet/walker/achievements — walker achievements
router.get('/walker/achievements', requireAuth, async (req, res) => {
  try {
    const walkerId = (req as any).user?.uid;
    if (!walkerId) return res.status(401).json({ error: 'Authentication required' });

    const allCompleted = await db.select()
      .from(bookingRequests)
      .where(and(
        eq(bookingRequests.providerId, walkerId),
        eq(bookingRequests.providerType, 'walker'),
        sql`${bookingRequests.status} = 'completed'`
      ));

    const totalWalks = allCompleted.length;
    const reviewed = allCompleted.filter(r => r.ownerRating);
    const avgRating = reviewed.length > 0
      ? reviewed.reduce((sum, r) => sum + Number(r.ownerRating || 0), 0) / reviewed.length
      : 5.0;

    res.json([
      {
        id: 'first_walk',
        title: 'First Walk',
        description: 'Complete your first dog walk',
        icon: 'paw',
        progress: Math.min(totalWalks, 1),
        target: 1,
        earned: totalWalks >= 1,
      },
      {
        id: 'ten_walks',
        title: 'Pack Leader',
        description: 'Complete 10 walks',
        icon: 'star',
        progress: Math.min(totalWalks, 10),
        target: 10,
        earned: totalWalks >= 10,
      },
      {
        id: 'fifty_walks',
        title: 'Marathon Walker',
        description: 'Complete 50 walks',
        icon: 'trophy',
        progress: Math.min(totalWalks, 50),
        target: 50,
        earned: totalWalks >= 50,
      },
      {
        id: 'top_rated',
        title: 'Top Rated',
        description: 'Maintain a 4.9+ rating with 5+ reviews',
        icon: 'award',
        progress: reviewed.length >= 5 && avgRating >= 4.9 ? 1 : 0,
        target: 1,
        earned: reviewed.length >= 5 && avgRating >= 4.9,
      },
    ]);
  } catch (error) {
    logger.error('[Walker Dashboard] Error fetching achievements', error);
    res.status(500).json({ error: 'Failed to fetch achievements' });
  }
});

// POST /api/walk-my-pet/walker/accept/:walkId — accept a pending walk request
router.post('/walker/accept/:walkId', requireAuth, async (req, res) => {
  try {
    const walkerId = (req as any).user?.uid;
    if (!walkerId) return res.status(401).json({ error: 'Authentication required' });

    const { walkId } = req.params;

    const [updated] = await db.update(bookingRequests)
      .set({
        status: 'accepted',
        providerResponse: req.body.message || 'Walk accepted',
        updatedAt: new Date(),
      })
      .where(and(
        eq(bookingRequests.requestId, walkId),
        eq(bookingRequests.providerId, walkerId),
        sql`${bookingRequests.status} = 'pending'`
      ))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'Walk request not found or cannot be accepted' });
    }

    res.json({ success: true, walk: updated });
  } catch (error) {
    logger.error('[Walker Dashboard] Error accepting walk', error);
    res.status(500).json({ error: 'Failed to accept walk' });
  }
});

// POST /api/walk-my-pet/walker/reject/:walkId — reject a pending walk request
router.post('/walker/reject/:walkId', requireAuth, async (req, res) => {
  try {
    const walkerId = (req as any).user?.uid;
    if (!walkerId) return res.status(401).json({ error: 'Authentication required' });

    const { walkId } = req.params;

    const [updated] = await db.update(bookingRequests)
      .set({
        status: 'cancelled',
        cancelledBy: 'provider',
        cancellationReason: req.body.reason || 'Walker unavailable',
        cancelledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(
        eq(bookingRequests.requestId, walkId),
        eq(bookingRequests.providerId, walkerId),
        sql`${bookingRequests.status} = 'pending'`
      ))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'Walk request not found or cannot be rejected' });
    }

    res.json({ success: true });
  } catch (error) {
    logger.error('[Walker Dashboard] Error rejecting walk', error);
    res.status(500).json({ error: 'Failed to reject walk' });
  }
});

// POST /api/walk-my-pet/walker/start/:walkId — start an accepted walk
router.post('/walker/start/:walkId', requireAuth, async (req, res) => {
  try {
    const walkerId = (req as any).user?.uid;
    if (!walkerId) return res.status(401).json({ error: 'Authentication required' });

    const { walkId } = req.params;

    const [updated] = await db.update(bookingRequests)
      .set({
        status: 'in_progress',
        serviceStartedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(
        eq(bookingRequests.requestId, walkId),
        eq(bookingRequests.providerId, walkerId),
        sql`${bookingRequests.status} = 'accepted'`
      ))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'Walk not found or not in accepted state' });
    }

    res.json({ success: true, walk: updated });
  } catch (error) {
    logger.error('[Walker Dashboard] Error starting walk', error);
    res.status(500).json({ error: 'Failed to start walk' });
  }
});

export default router;
