/**
 * GPS Tracking API Routes for ⁦Walk My Pet™⁩
 */

import { Router } from 'express';
import { GPSTrackingService } from '../services/GPSTrackingService';
import { requireAuth } from '../customAuth';
import { logger } from '../lib/logger';
import { db as firestoreDb } from '../lib/firebase-admin';
import { isSuperAdminVerified } from '../middleware/rbac';
import { sendSanitizedError } from '../lib/sanitizeErrorResponse';

const router = Router();

/**
 * Start a new walk session (walker check-in)
 * POST /api/gps/walk/start
 */
router.post('/walk/start', requireAuth, async (req, res) => {
  try {
    const { bookingId, petId, latitude, longitude, accuracy } = req.body;
    const walkerId = req.user!.uid;
    
    if (!bookingId || !petId || latitude == null || longitude == null) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Get booking to verify owner
    const bookingRef = await req.firestore!.collection('bookings').doc(bookingId).get();
    if (!bookingRef.exists) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    
    const booking = bookingRef.data();
    const ownerId = booking.ownerId || booking.userId;
    
    const sessionId = await GPSTrackingService.startWalkSession({
      bookingId,
      walkerId,
      ownerId,
      petId,
      location: {
        latitude,
        longitude,
        accuracy,
        timestamp: new Date(),
      },
    });
    
    res.json({
      success: true,
      sessionId,
      message: 'Walk session started',
    });
  } catch (error: any) {
    sendSanitizedError(res, error, 'GPS_START_WALK_FAILED', { logContext: { op: 'start-walk' } });
  }
});

/**
 * Update walker's real-time location
 * POST /api/gps/walk/update-location
 */
router.post('/walk/update-location', requireAuth, async (req, res) => {
  try {
    const { sessionId, latitude, longitude, accuracy, altitude } = req.body;
    const walkerId = req.user!.uid;
    
    if (!sessionId || latitude == null || longitude == null) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    await GPSTrackingService.updateLocation({
      sessionId,
      walkerId,
      location: {
        latitude,
        longitude,
        accuracy,
        altitude,
        timestamp: new Date(),
      },
    });
    
    res.json({
      success: true,
      message: 'Location updated',
    });
  } catch (error: any) {
    sendSanitizedError(res, error, 'GPS_UPDATE_LOCATION_FAILED', { logContext: { op: 'update-location' } });
  }
});

/**
 * End walk session (walker check-out)
 * POST /api/gps/walk/end
 */
router.post('/walk/end', requireAuth, async (req, res) => {
  try {
    const { sessionId, latitude, longitude, accuracy } = req.body;
    const walkerId = req.user!.uid;
    
    if (!sessionId || latitude == null || longitude == null) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const result = await GPSTrackingService.endWalkSession({
      sessionId,
      walkerId,
      location: {
        latitude,
        longitude,
        accuracy,
        timestamp: new Date(),
      },
    });
    
    res.json({
      success: true,
      message: 'Walk session ended',
      totalDistance: result.totalDistance,
      totalDuration: result.totalDuration,
      routePath: result.routePath,
    });
  } catch (error: any) {
    sendSanitizedError(res, error, 'GPS_END_WALK_FAILED', { logContext: { op: 'end-walk' } });
  }
});

/**
 * Get real-time location of active walk (for owner tracking)
 * GET /api/gps/walk/:sessionId/location
 *
 * OWNER-CHECK (2026-08-23 auth-audit CRIT #3): previously only required
 * `requireAuth`. Any authenticated user could pass ANY sessionId (stale
 * link, guessed, enumerated) and stream a walker's live GPS trail plus
 * the owner's tracking session. Now checks the walk_sessions doc up
 * front and rejects if the caller is neither the walker, the owner,
 * nor an authorized super-admin. 404 on missing session (unchanged),
 * 403 on wrong-party access (do not disclose whether the session
 * exists to a non-participant).
 */
router.get('/walk/:sessionId/location', requireAuth, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const uid = req.user!.uid;

    // Read the participants BEFORE returning any location data.
    const sessionSnap = await firestoreDb
      .collection('walk_sessions')
      .doc(sessionId)
      .get();

    if (!sessionSnap.exists) {
      return res.status(404).json({ error: 'Active session not found' });
    }

    const session = sessionSnap.data() as { walkerId?: string; ownerId?: string } | undefined;
    const isWalker = !!session?.walkerId && session.walkerId === uid;
    const isOwner = !!session?.ownerId && session.ownerId === uid;
    // #240 migration: paired shape — allowlist + email_verified.
    const isAdmin = isSuperAdminVerified(req as any);

    if (!isWalker && !isOwner && !isAdmin) {
      logger.warn('[GPS API] Unauthorized location read blocked', {
        uid,
        sessionId,
      });
      return res.status(403).json({ error: 'Not a participant in this walk' });
    }

    const location = await GPSTrackingService.getCurrentLocation(sessionId);

    if (!location) {
      return res.status(404).json({ error: 'Active session not found' });
    }

    res.json({
      success: true,
      ...location,
    });
  } catch (error: any) {
    sendSanitizedError(res, error, 'GPS_GET_LOCATION_FAILED', { logContext: { op: 'get-location' } });
  }
});

/**
 * Get walker's walk history
 * GET /api/gps/walker/history
 */
router.get('/walker/history', requireAuth, async (req, res) => {
  try {
    const walkerId = req.user!.uid;
    const limit = parseInt(req.query.limit as string) || 20;
    
    const history = await GPSTrackingService.getWalkerHistory(walkerId, limit);
    
    res.json({
      success: true,
      walks: history,
    });
  } catch (error: any) {
    sendSanitizedError(res, error, 'GPS_GET_HISTORY_FAILED', { logContext: { op: 'get-history' } });
  }
});

/**
 * Get owner's active walks (for tracking)
 * GET /api/gps/owner/active-walks
 */
router.get('/owner/active-walks', requireAuth, async (req, res) => {
  try {
    const ownerId = req.user!.uid;
    
    const activeWalks = await GPSTrackingService.getOwnerActiveWalks(ownerId);
    
    res.json({
      success: true,
      activeWalks,
    });
  } catch (error: any) {
    sendSanitizedError(res, error, 'GPS_GET_ACTIVE_WALKS_FAILED', { logContext: { op: 'get-active-walks' } });
  }
});

/**
 * Register a user's current device GPS location (passive stamp).
 * Used for on-demand provider/customer matching.
 * POST /api/gps/user-location
 * Body: { latitude, longitude, accuracy, role: 'customer'|'provider' }
 */
router.post('/user-location', requireAuth, async (req, res) => {
  try {
    const { latitude, longitude, accuracy, role = 'customer' } = req.body;
    const userId = req.user!.uid;

    if (latitude == null || longitude == null) {
      return res.status(400).json({ error: 'latitude and longitude are required' });
    }

    const stamp = {
      userId,
      role,
      latitude: Number(latitude),
      longitude: Number(longitude),
      accuracy: accuracy ? Number(accuracy) : null,
      timestamp: new Date().toISOString(),
      source: 'device_gps',
    };

    // Store in Firestore user_locations collection (TTL 24h logic handled client-side)
    if (req.firestore) {
      await req.firestore.collection('user_locations').doc(userId).set(stamp, { merge: false });
    }

    logger.info('[GPS] User location stamped', { userId, role, latitude, longitude });

    res.json({ success: true, stamp });
  } catch (error: any) {
    sendSanitizedError(res, error, 'GPS_USER_STAMP_FAILED', { logContext: { op: 'user-stamp' } });
  }
});

/**
 * Get live location stamps for admin/Octopus Brain panel.
 * GET /api/gps/live-locations
 */
router.get('/live-locations', requireAuth, async (req, res) => {
  try {
    if (!req.firestore) return res.json({ success: true, locations: [] });

    const snapshot = await req.firestore.collection('user_locations')
      .orderBy('timestamp', 'desc')
      .limit(50)
      .get();

    const locations = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json({ success: true, locations, total: locations.length });
  } catch (error: any) {
    sendSanitizedError(res, error, 'GPS_LIVE_LOCATIONS_FAILED', { logContext: { op: 'live-locations' } });
  }
});

export default router;
