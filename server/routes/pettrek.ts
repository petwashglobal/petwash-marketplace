import { Router } from 'express';
import { z } from 'zod';
import { fareEstimationService } from '../services/PetTrekFareEstimationService';
import { dispatchService } from '../services/PetTrekDispatchService';
import { db } from '../db';
import { pettrekTrips, pettrekProviders, pettrekGpsTracking, pettrekDispatchRecords } from '@shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import { requireAuth } from '../customAuth';
import { requireLoyaltyMember } from '../middleware/loyalty';
import { buildAllNavigationLinks } from '../utils/navigation';

const router = Router();

// =================== CUSTOMER ENDPOINTS ===================

// Get fare estimate
router.post('/fare-estimate', requireAuth, async (req, res) => {
  try {
    const schema = z.object({
      pickupLatitude: z.number(),
      pickupLongitude: z.number(),
      dropoffLatitude: z.number(),
      dropoffLongitude: z.number(),
      scheduledPickupTime: z.string().optional().transform(val => val ? new Date(val) : undefined),
    });

    const data = schema.parse(req.body);

    const estimate = fareEstimationService.getFareEstimate(
      { latitude: data.pickupLatitude, longitude: data.pickupLongitude },
      { latitude: data.dropoffLatitude, longitude: data.dropoffLongitude },
      data.scheduledPickupTime
    );

    res.json(estimate);
  } catch (error) {
    console.error('[PETTREK] Fare estimate error:', error);
    res.status(400).json({
      error: error instanceof Error ? error.message : 'Failed to calculate fare',
    });
  }
});

// Request a new trip (LOYALTY MEMBERS ONLY)
router.post('/request-trip', requireAuth, requireLoyaltyMember, async (req, res) => {
  try {
    const schema = z.object({
      petName: z.string(),
      petType: z.string(),
      petSize: z.string(),
      petWeight: z.number().optional(),
      specialInstructions: z.string().optional(),
      serviceType: z.string(), // transport | sitting | stay
      pickupLatitude: z.number(),
      pickupLongitude: z.number(),
      pickupAddress: z.string(),
      dropoffLatitude: z.number(),
      dropoffLongitude: z.number(),
      dropoffAddress: z.string(),
      scheduledPickupTime: z.string().transform(val => new Date(val)),
    });

    const data = schema.parse(req.body);
    const customerId = req.user!.uid;

    // Generate trip ID
    const tripId = `TRK-${Date.now()}`;

    // Calculate fare estimate
    const fareEstimate = fareEstimationService.getFareEstimate(
      { latitude: data.pickupLatitude, longitude: data.pickupLongitude },
      { latitude: data.dropoffLatitude, longitude: data.dropoffLongitude },
      data.scheduledPickupTime
    );

    // Create trip record
    const [trip] = await db.insert(pettrekTrips).values({
      tripId,
      customerId,
      petName: data.petName,
      petType: data.petType,
      petSize: data.petSize,
      petWeight: data.petWeight?.toString(),
      specialInstructions: data.specialInstructions,
      serviceType: data.serviceType,
      pickupLatitude: data.pickupLatitude.toString(),
      pickupLongitude: data.pickupLongitude.toString(),
      pickupAddress: data.pickupAddress,
      dropoffLatitude: data.dropoffLatitude.toString(),
      dropoffLongitude: data.dropoffLongitude.toString(),
      dropoffAddress: data.dropoffAddress,
      scheduledPickupTime: data.scheduledPickupTime,
      status: 'requested',
      estimatedFare: fareEstimate.estimatedFare.toString(),
      baseFare: fareEstimate.baseFare.toString(),
      distanceFare: fareEstimate.distanceFare.toString(),
      timeFare: fareEstimate.timeFare.toString(),
      surgeFare: fareEstimate.surgeFare.toString(),
      platformCommission: fareEstimate.platformCommission.toString(),
      driverPayout: fareEstimate.driverPayout.toString(),
      estimatedDistance: fareEstimate.breakdown.distanceKm.toString(),
      estimatedDuration: fareEstimate.breakdown.estimatedMinutes,
      isPeakTime: fareEstimate.breakdown.isPeakTime,
      surgeMultiplier: fareEstimate.breakdown.surgeMultiplier.toString(),
    }).returning();

    // Dispatch to nearby drivers
    const dispatchResult = await dispatchService.dispatchTrip(
      trip.id,
      data.pickupLatitude,
      data.pickupLongitude,
      data.petSize
    );

    // Generate navigation links for pickup location
    const navigationLinks = buildAllNavigationLinks({
      lat: data.pickupLatitude,
      lng: data.pickupLongitude,
      label: `Pet Transport Pickup: ${data.petName}`,
    });

    res.json({
      success: true,
      trip: {
        id: trip.id,
        tripId: trip.tripId,
        status: trip.status,
        fareEstimate,
      },
      dispatch: dispatchResult,
      navigation: navigationLinks,
    });
  } catch (error) {
    console.error('[PETTREK] Request trip error:', error);
    res.status(400).json({
      error: error instanceof Error ? error.message : 'Failed to request trip',
    });
  }
});

// Get active trips for customer
router.get('/trips/active', requireAuth, async (req, res) => {
  try {
    const customerId = req.user!.uid;

    const trips = await db
      .select()
      .from(pettrekTrips)
      .where(
        and(
          eq(pettrekTrips.customerId, customerId),
          sql`${pettrekTrips.status} IN ('requested', 'dispatched', 'accepted', 'in_progress')`
        )
      )
      .orderBy(sql`${pettrekTrips.createdAt} DESC`);

    res.json({ success: true, trips });
  } catch (error) {
    console.error('[PETTREK] Get active trips error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to fetch trips',
    });
  }
});

// Get trip details with driver info
router.get('/trips/:tripId/details', requireAuth, async (req, res) => {
  try {
    const tripId = parseInt(req.params.tripId);
    const customerId = req.user!.uid;

    const trip = await db
      .select()
      .from(pettrekTrips)
      .where(
        and(
          eq(pettrekTrips.id, tripId),
          eq(pettrekTrips.customerId, customerId)
        )
      )
      .limit(1);

    if (trip.length === 0) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    // Get driver info if assigned
    let driverInfo = null;
    if (trip[0].providerId) {
      const driver = await db
        .select()
        .from(pettrekProviders)
        .where(eq(pettrekProviders.id, trip[0].providerId))
        .limit(1);

      if (driver.length > 0) {
        driverInfo = {
          firstName: driver[0].firstName,
          lastName: driver[0].lastName,
          vehicleType: driver[0].vehicleType,
          vehicleColor: driver[0].vehicleColor,
          licensePlate: driver[0].licensePlate,
          averageRating: driver[0].averageRating,
        };
      }
    }

    res.json({
      success: true,
      trip: trip[0],
      driver: driverInfo,
    });
  } catch (error) {
    console.error('[PETTREK] Get trip details error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to fetch trip details',
    });
  }
});

// Get live GPS tracking for active trip
router.get('/trips/:tripId/live-location', requireAuth, async (req, res) => {
  try {
    const tripId = parseInt(req.params.tripId);
    const customerId = req.user!.uid;

    // Verify trip ownership
    const trip = await db
      .select()
      .from(pettrekTrips)
      .where(
        and(
          eq(pettrekTrips.id, tripId),
          eq(pettrekTrips.customerId, customerId)
        )
      )
      .limit(1);

    if (trip.length === 0) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    // Get latest GPS location
    const latestLocation = await db
      .select()
      .from(pettrekGpsTracking)
      .where(eq(pettrekGpsTracking.tripId, tripId))
      .orderBy(sql`${pettrekGpsTracking.recordedAt} DESC`)
      .limit(1);

    res.json({
      success: true,
      tripStatus: trip[0].status,
      lastKnownLocation: latestLocation.length > 0 ? latestLocation[0] : null,
    });
  } catch (error) {
    console.error('[PETTREK] Get live location error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to fetch live location',
    });
  }
});

// =================== PROVIDER/DRIVER ENDPOINTS ===================

// Get pending jobs for driver
router.get('/provider/jobs', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.uid;

    // Get provider profile
    const provider = await db
      .select()
      .from(pettrekProviders)
      .where(eq(pettrekProviders.userId, userId))
      .limit(1);

    if (provider.length === 0) {
      return res.status(404).json({ error: 'Provider profile not found' });
    }

    // Get pending dispatch records
    const pendingJobs = await db
      .select({
        dispatchRecord: pettrekDispatchRecords,
        trip: pettrekTrips,
      })
      .from(pettrekDispatchRecords)
      .innerJoin(pettrekTrips, eq(pettrekDispatchRecords.tripId, pettrekTrips.id))
      .where(
        and(
          eq(pettrekDispatchRecords.providerId, provider[0].id),
          eq(pettrekDispatchRecords.responseStatus, 'pending'),
          eq(pettrekDispatchRecords.isExpired, false)
        )
      )
      .orderBy(sql`${pettrekDispatchRecords.dispatchedAt} DESC`);

    res.json({ success: true, jobs: pendingJobs });
  } catch (error) {
    console.error('[PETTREK] Get provider jobs error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to fetch jobs',
    });
  }
});

// Accept a trip
router.post('/provider/accept-trip', requireAuth, async (req, res) => {
  try {
    const schema = z.object({
      dispatchRecordId: z.number(),
    });

    const data = schema.parse(req.body);
    const userId = req.user!.uid;

    // Get provider profile
    const provider = await db
      .select()
      .from(pettrekProviders)
      .where(eq(pettrekProviders.userId, userId))
      .limit(1);

    if (provider.length === 0) {
      return res.status(404).json({ error: 'Provider profile not found' });
    }

    const success = await dispatchService.acceptTrip(
      data.dispatchRecordId,
      provider[0].id
    );

    if (success) {
      res.json({ success: true, message: 'Trip accepted successfully' });
    } else {
      res.status(400).json({ success: false, error: 'Failed to accept trip' });
    }
  } catch (error) {
    console.error('[PETTREK] Accept trip error:', error);
    res.status(400).json({
      error: error instanceof Error ? error.message : 'Failed to accept trip',
    });
  }
});

// Decline a trip
router.post('/provider/decline-trip', requireAuth, async (req, res) => {
  try {
    const schema = z.object({
      dispatchRecordId: z.number(),
      reason: z.string(),
      notes: z.string().optional(),
    });

    const data = schema.parse(req.body);

    const success = await dispatchService.declineTrip(
      data.dispatchRecordId,
      data.reason,
      data.notes
    );

    if (success) {
      res.json({ success: true, message: 'Trip declined' });
    } else {
      res.status(400).json({ success: false, error: 'Failed to decline trip' });
    }
  } catch (error) {
    console.error('[PETTREK] Decline trip error:', error);
    res.status(400).json({
      error: error instanceof Error ? error.message : 'Failed to decline trip',
    });
  }
});

// Start trip (pickup)
router.post('/provider/start-trip', requireAuth, async (req, res) => {
  try {
    const schema = z.object({
      tripId: z.number(),
      location: z.object({
        latitude: z.number(),
        longitude: z.number(),
        accuracy: z.number(),
      }),
      pickupPhotoUrl: z.string().optional(),
    });

    const data = schema.parse(req.body);

    await db
      .update(pettrekTrips)
      .set({
        status: 'in_progress',
        actualPickupTime: new Date(),
        pickupPhotoUrl: data.pickupPhotoUrl,
        photoUploadedAtPickup: !!data.pickupPhotoUrl,
        isLiveTrackingActive: true,
        lastKnownLatitude: data.location.latitude.toString(),
        lastKnownLongitude: data.location.longitude.toString(),
        lastGPSUpdate: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(pettrekTrips.id, data.tripId));

    // Record initial GPS location
    await db.insert(pettrekGpsTracking).values({
      tripId: data.tripId,
      latitude: data.location.latitude.toString(),
      longitude: data.location.longitude.toString(),
      accuracy: data.location.accuracy.toString(),
      recordedAt: new Date(),
    });

    res.json({ success: true, message: 'Trip started' });
  } catch (error) {
    console.error('[PETTREK] Start trip error:', error);
    res.status(400).json({
      error: error instanceof Error ? error.message : 'Failed to start trip',
    });
  }
});

// Update GPS location during trip
router.post('/provider/gps-update', requireAuth, async (req, res) => {
  try {
    const schema = z.object({
      tripId: z.number(),
      location: z.object({
        latitude: z.number(),
        longitude: z.number(),
        accuracy: z.number(),
        heading: z.number().optional(),
        speed: z.number().optional(),
      }),
      distanceToDestination: z.number().optional(),
      estimatedArrival: z.number().optional(),
    });

    const data = schema.parse(req.body);

    // Update trip's last known location
    await db
      .update(pettrekTrips)
      .set({
        lastKnownLatitude: data.location.latitude.toString(),
        lastKnownLongitude: data.location.longitude.toString(),
        lastGPSUpdate: new Date(),
      })
      .where(eq(pettrekTrips.id, data.tripId));

    // Record GPS tracking point
    await db.insert(pettrekGpsTracking).values({
      tripId: data.tripId,
      latitude: data.location.latitude.toString(),
      longitude: data.location.longitude.toString(),
      accuracy: data.location.accuracy.toString(),
      heading: data.location.heading?.toString(),
      speed: data.location.speed?.toString(),
      distanceToDestination: data.distanceToDestination?.toString(),
      estimatedArrival: data.estimatedArrival,
      recordedAt: new Date(),
    });

    res.json({ success: true });
  } catch (error) {
    console.error('[PETTREK] GPS update error:', error);
    res.status(400).json({
      error: error instanceof Error ? error.message : 'Failed to update GPS',
    });
  }
});

// Complete trip (dropoff)
router.post('/provider/complete-trip', requireAuth, async (req, res) => {
  try {
    const schema = z.object({
      tripId: z.number(),
      location: z.object({
        latitude: z.number(),
        longitude: z.number(),
        accuracy: z.number(),
      }),
      dropoffPhotoUrl: z.string().optional(),
      actualDistance: z.number(), // km
      actualDuration: z.number(), // minutes
    });

    const data = schema.parse(req.body);

    // Get trip for final fare calculation
    const trip = await db
      .select()
      .from(pettrekTrips)
      .where(eq(pettrekTrips.id, data.tripId))
      .limit(1);

    if (trip.length === 0) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    // Calculate final fare based on actual distance/time
    const finalFareEstimate = fareEstimationService.getFareEstimate(
      {
        latitude: parseFloat(trip[0].pickupLatitude),
        longitude: parseFloat(trip[0].pickupLongitude),
      },
      {
        latitude: data.location.latitude,
        longitude: data.location.longitude,
      }
    );

    await db
      .update(pettrekTrips)
      .set({
        status: 'completed',
        actualDropoffTime: new Date(),
        dropoffPhotoUrl: data.dropoffPhotoUrl,
        photoUploadedAtDropoff: !!data.dropoffPhotoUrl,
        actualDistance: data.actualDistance.toString(),
        actualDuration: data.actualDuration,
        finalFare: finalFareEstimate.estimatedFare.toString(),
        platformCommission: finalFareEstimate.platformCommission.toString(),
        driverPayout: finalFareEstimate.driverPayout.toString(),
        isLiveTrackingActive: false,
        paymentStatus: 'pending', // Will be processed by payment service
        updatedAt: new Date(),
      })
      .where(eq(pettrekTrips.id, data.tripId));

    res.json({
      success: true,
      message: 'Trip completed',
      finalFare: finalFareEstimate,
    });
  } catch (error) {
    console.error('[PETTREK] Complete trip error:', error);
    res.status(400).json({
      error: error instanceof Error ? error.message : 'Failed to complete trip',
    });
  }
});

// Toggle provider online status
router.post('/provider/toggle-online', requireAuth, async (req, res) => {
  try {
    const schema = z.object({
      isOnline: z.boolean(),
      location: z.object({
        latitude: z.number(),
        longitude: z.number(),
      }).optional(),
    });

    const data = schema.parse(req.body);
    const userId = req.user!.uid;

    const updateData: any = {
      isOnline: data.isOnline,
      updatedAt: new Date(),
    };

    if (data.location) {
      updateData.lastKnownLatitude = data.location.latitude.toString();
      updateData.lastKnownLongitude = data.location.longitude.toString();
      updateData.lastLocationUpdate = new Date();
    }

    await db
      .update(pettrekProviders)
      .set(updateData)
      .where(eq(pettrekProviders.userId, userId));

    res.json({ success: true, isOnline: data.isOnline });
  } catch (error) {
    console.error('[PETTREK] Toggle online error:', error);
    res.status(400).json({
      error: error instanceof Error ? error.message : 'Failed to update online status',
    });
  }
});

// Get provider stats and profile
router.get('/provider/stats', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.uid;

    const provider = await db
      .select()
      .from(pettrekProviders)
      .where(eq(pettrekProviders.userId, userId))
      .limit(1);

    if (provider.length === 0) {
      return res.status(404).json({ error: 'Provider profile not found' });
    }

    res.json({
      success: true,
      stats: {
        totalTrips: provider[0].totalTrips || 0,
        completedTrips: provider[0].completedTrips || 0,
        averageRating: parseFloat(provider[0].averageRating?.toString() || '0'),
        totalEarnings: parseFloat(provider[0].totalEarnings?.toString() || '0'),
        isOnline: provider[0].isOnline || false,
        isAvailable: provider[0].isAvailable || false,
        firstName: provider[0].firstName,
        lastName: provider[0].lastName,
      },
    });
  } catch (error) {
    console.error('[PETTREK] Get provider stats error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to fetch stats',
    });
  }
});

// Get active trips for provider
router.get('/provider/active-trips', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.uid;

    const provider = await db
      .select()
      .from(pettrekProviders)
      .where(eq(pettrekProviders.userId, userId))
      .limit(1);

    if (provider.length === 0) {
      return res.status(404).json({ error: 'Provider profile not found' });
    }

    const activeTrips = await db
      .select()
      .from(pettrekTrips)
      .where(
        and(
          eq(pettrekTrips.providerId, provider[0].id),
          sql`${pettrekTrips.status} IN ('accepted', 'in_progress')`
        )
      )
      .orderBy(sql`${pettrekTrips.scheduledPickupTime} ASC`);

    res.json({ success: true, trips: activeTrips });
  } catch (error) {
    console.error('[PETTREK] Get active trips error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to fetch active trips',
    });
  }
});

// Get trip history for provider
router.get('/provider/trip-history', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.uid;

    const provider = await db
      .select()
      .from(pettrekProviders)
      .where(eq(pettrekProviders.userId, userId))
      .limit(1);

    if (provider.length === 0) {
      return res.status(404).json({ error: 'Provider profile not found' });
    }

    const tripHistory = await db
      .select()
      .from(pettrekTrips)
      .where(
        and(
          eq(pettrekTrips.providerId, provider[0].id),
          sql`${pettrekTrips.status} IN ('completed', 'canceled')`
        )
      )
      .orderBy(sql`${pettrekTrips.createdAt} DESC`)
      .limit(50);

    res.json({ success: true, trips: tripHistory });
  } catch (error) {
    console.error('[PETTREK] Get trip history error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to fetch trip history',
    });
  }
});

export default router;
