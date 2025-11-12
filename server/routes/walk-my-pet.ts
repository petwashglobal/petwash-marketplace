import { Router } from 'express';
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
  type InsertWalkerProfile,
  type InsertWalkBooking,
  type InsertWalkGpsTracking,
  type InsertWalkerReview
} from '../../shared/schema';
import { eq, and, gte, lte, sql, desc, asc } from 'drizzle-orm';
import { z } from 'zod';
import crypto from 'crypto';
import { requireLoyaltyMember } from '../middleware/loyalty';
import { calculateDistance } from '../services/location/MapsService';
import { buildAllNavigationLinks } from '../utils/navigation';

const router = Router();

// =================== WALKER REGISTRATION & PROFILES ===================

// Create walker profile (first step of registration)
router.post('/api/walkers/register', async (req, res) => {
  try {
    const userId = req.body.userId || (req as any).user?.uid;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const walkerData: InsertWalkerProfile = {
      ...req.body,
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

// Get walker profile
router.get('/api/walkers/:walkerId', async (req, res) => {
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
router.patch('/api/walkers/:walkerId', async (req, res) => {
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
router.post('/api/walkers/search', async (req, res) => {
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

// Create walk booking (LOYALTY MEMBERS ONLY)
router.post('/api/walks/book', requireLoyaltyMember, async (req, res) => {
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

    // Get walker details for pricing
    const [walker] = await db
      .select()
      .from(walkerProfiles)
      .where(eq(walkerProfiles.walkerId, walkerId))
      .limit(1);

    if (!walker) {
      return res.status(404).json({ error: 'Walker not found' });
    }

    if (!walker.isAvailable || walker.verificationStatus !== 'verified') {
      return res.status(400).json({ error: 'Walker is not available for bookings' });
    }

    // Calculate pricing
    const hourlyRate = parseFloat(walker.baseHourlyRate);
    const hours = durationMinutes / 60;
    const walkerRate = hourlyRate * hours;
    
    // Platform commission: 24% total (Owner pays 6%, Walker pays 18%)
    const platformFeeOwner = walkerRate * 0.06;
    const platformFeeSitter = walkerRate * 0.18;
    const totalCost = walkerRate + platformFeeOwner; // Owner pays base + 6%
    const walkerPayout = walkerRate - platformFeeSitter; // Walker receives base - 18% = 82%

    const bookingData: InsertWalkBooking = {
      bookingId: `WALK-${new Date().getFullYear()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
      ownerId,
      walkerId,
      scheduledDate: new Date(scheduledDate),
      scheduledStartTime,
      durationMinutes,
      pickupLatitude: pickupLatitude.toString(),
      pickupLongitude: pickupLongitude.toString(),
      pickupAddress,
      geofenceRadiusMeters: 500, // Default 500m safe zone
      geofenceCenterLat: pickupLatitude.toString(),
      geofenceCenterLon: pickupLongitude.toString(),
      petName,
      petBreed,
      petWeight,
      petSpecialNeeds,
      walkerRate: walkerRate.toFixed(2),
      platformFeeOwner: platformFeeOwner.toFixed(2),
      platformFeeSitter: platformFeeSitter.toFixed(2),
      totalCost: totalCost.toFixed(2),
      walkerPayout: walkerPayout.toFixed(2),
      currency: walker.currency || 'ILS',
      status: 'pending',
      confirmationCode: Math.floor(100000 + Math.random() * 900000).toString(), // 6-digit code
      isLiveTrackingActive: false,
      isVideoStreamActive: false,
      isDroneMonitoringActive: walker.hasDroneAccess || false,
      geofenceViolationCount: 0,
      emergencyStopTriggered: false,
      ownerNotified: false,
    };

    const [newBooking] = await db.insert(walkBookings).values(bookingData).returning();

    // Create alert for walker
    await db.insert(walkAlerts).values({
      alertId: `ALERT-${crypto.randomUUID()}`,
      bookingId: newBooking.bookingId,
      alertType: 'new_booking',
      severity: 'info',
      title: 'New Walk Request',
      message: `You have a new walk request for ${scheduledDate} at ${scheduledStartTime}`,
      actionRequired: true,
      sentToWalker: true,
      isRead: false,
    });

    // Generate navigation links for pickup location
    const navigationLinks = buildAllNavigationLinks({
      lat: parseFloat(pickupLatitude),
      lng: parseFloat(pickupLongitude),
      label: `Walk Pickup: ${petName}`,
    });

    res.status(201).json({ 
      success: true, 
      booking: newBooking,
      navigation: navigationLinks,
      message: 'Walk booked successfully! Walker will confirm shortly.'
    });
  } catch (error: any) {
    console.error('[Walk My Pet] Booking error:', error);
    res.status(500).json({ error: 'Failed to create booking', details: error.message });
  }
});

// EMERGENCY/ASAP WALK REQUEST (Rover/Wag "Book Now" model) - LOYALTY MEMBERS ONLY
router.post('/api/walks/emergency-request', requireLoyaltyMember, async (req, res) => {
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

// Get booking details
router.get('/api/walks/:bookingId', async (req, res) => {
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
router.post('/api/walks/:bookingId/confirm', async (req, res) => {
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

    res.json({ success: true, booking: updatedBooking });
  } catch (error: any) {
    console.error('[Walk My Pet] Confirm booking error:', error);
    res.status(500).json({ error: 'Failed to confirm booking' });
  }
});

// Start walk (walker initiates)
router.post('/api/walks/:bookingId/start', async (req, res) => {
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
router.post('/api/walks/:bookingId/gps', async (req, res) => {
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
router.get('/api/walks/:bookingId/gps/live', async (req, res) => {
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
router.post('/api/walks/:bookingId/complete', async (req, res) => {
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
router.post('/api/walkers/:walkerId/review', async (req, res) => {
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
router.get('/api/walkers/:walkerId/reviews', async (req, res) => {
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
router.get('/api/users/:userId/walks', async (req, res) => {
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
router.get('/api/walkers/:walkerId/walks', async (req, res) => {
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

export default router;
