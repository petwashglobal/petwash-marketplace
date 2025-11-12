/**
 * GPS Tracking API Routes for Walk My Pet™
 */

import { Router } from 'express';
import { GPSTrackingService } from '../services/GPSTrackingService';
import { requireAuth } from '../customAuth';
import { logger } from '../lib/logger';

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
    logger.error('[GPS API] Start walk failed', error);
    res.status(500).json({ error: error.message });
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
    logger.error('[GPS API] Update location failed', error);
    res.status(500).json({ error: error.message });
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
    logger.error('[GPS API] End walk failed', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get real-time location of active walk (for owner tracking)
 * GET /api/gps/walk/:sessionId/location
 */
router.get('/walk/:sessionId/location', requireAuth, async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const location = await GPSTrackingService.getCurrentLocation(sessionId);
    
    if (!location) {
      return res.status(404).json({ error: 'Active session not found' });
    }
    
    res.json({
      success: true,
      ...location,
    });
  } catch (error: any) {
    logger.error('[GPS API] Get location failed', error);
    res.status(500).json({ error: error.message });
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
    logger.error('[GPS API] Get history failed', error);
    res.status(500).json({ error: error.message });
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
    logger.error('[GPS API] Get active walks failed', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
