import { Router } from 'express';
import { z } from 'zod';
import { walkSessionService } from '../services/WalkSessionService';
import { requireAuth } from '../customAuth';

const router = Router();

// Check-in: Walker starts walk session
router.post('/check-in', requireAuth, async (req, res) => {
  try {
    const schema = z.object({
      walkId: z.number(),
      location: z.object({
        latitude: z.number(),
        longitude: z.number(),
        accuracy: z.number(),
      }),
      deviceInfo: z.string().optional().default('unknown'),
    });

    const data = schema.parse(req.body);
    const walkerId = req.user!.uid;

    const result = await walkSessionService.checkIn({
      walkId: data.walkId,
      walkerId,
      timestamp: new Date(),
      location: data.location,
      deviceInfo: data.deviceInfo,
    });

    res.json(result);
  } catch (error) {
    console.error('[WALK SESSION] Check-in error:', error);
    res.status(400).json({
      error: error instanceof Error ? error.message : 'Failed to check in',
    });
  }
});

// Check-out: Walker completes walk session
router.post('/check-out', requireAuth, async (req, res) => {
  try {
    const schema = z.object({
      walkId: z.number(),
      location: z.object({
        latitude: z.number(),
        longitude: z.number(),
        accuracy: z.number(),
      }),
      totalDistance: z.number(), // meters
      totalDuration: z.number(), // seconds
      vitalData: z.object({
        heartRateAvg: z.number(),
        heartRateMax: z.number(),
        steps: z.number(),
        hydrationStops: z.number(),
        photosTaken: z.number(),
      }),
      routePolyline: z.string(), // Encoded GPS coordinates
    });

    const data = schema.parse(req.body);
    const walkerId = req.user!.uid;

    const result = await walkSessionService.checkOut({
      walkId: data.walkId,
      walkerId,
      timestamp: new Date(),
      location: data.location,
      totalDistance: data.totalDistance,
      totalDuration: data.totalDuration,
      vitalData: data.vitalData,
      routePolyline: data.routePolyline,
    });

    res.json(result);
  } catch (error) {
    console.error('[WALK SESSION] Check-out error:', error);
    res.status(400).json({
      error: error instanceof Error ? error.message : 'Failed to check out',
    });
  }
});

// Update GPS location during active walk
router.post('/gps-update', requireAuth, async (req, res) => {
  try {
    const schema = z.object({
      walkId: z.number(),
      location: z.object({
        latitude: z.number(),
        longitude: z.number(),
        accuracy: z.number(),
        timestamp: z.string().transform((val) => new Date(val)),
      }),
    });

    const data = schema.parse(req.body);
    const walkerId = req.user!.uid;

    await walkSessionService.updateGPSLocation(
      data.walkId,
      walkerId,
      data.location
    );

    res.json({ success: true });
  } catch (error) {
    console.error('[WALK SESSION] GPS update error:', error);
    res.status(400).json({
      error: error instanceof Error ? error.message : 'Failed to update GPS',
    });
  }
});

// Update vital data during active walk
router.post('/vital-update', requireAuth, async (req, res) => {
  try {
    const schema = z.object({
      walkId: z.number(),
      vitalData: z.object({
        heartRate: z.number().optional(),
        steps: z.number().optional(),
        hydrationStops: z.number().optional(),
        timestamp: z.string().transform((val) => new Date(val)),
      }),
    });

    const data = schema.parse(req.body);
    const walkerId = req.user!.uid;

    await walkSessionService.updateVitalData(
      data.walkId,
      walkerId,
      data.vitalData
    );

    res.json({ success: true });
  } catch (error) {
    console.error('[WALK SESSION] Vital data update error:', error);
    res.status(400).json({
      error: error instanceof Error ? error.message : 'Failed to update vital data',
    });
  }
});

// Get active session details.
//
// P0-1 fix (2026-08-18): previously this handler passed only `walkId` to
// getActiveSession, which loaded by walkId alone and returned the raw
// walk row + live GPS + vitals + route polyline to ANY authenticated
// caller. Cross-user leak — a customer could enumerate walkIds and read
// another customer's live pet-walk.
//
// Now:
//   • callerUid is threaded into the service
//   • the service authorizes caller ∈ { owner, assigned walker } via
//     the walker_profiles.walkerId → userId join (also fixes P1-14:
//     walk_bookings.walkerId is a WALKER-UUID, not a Firebase UID; a
//     direct compare would have silently locked walkers out)
//   • unauthorized callers get the same "no active session" 404 as
//     "not found" (privacy 404 — do not confirm existence)
//   • the response is a strict SafeLiveSessionDTO — no raw walk row
router.get('/:walkId/active', requireAuth, async (req, res) => {
  try {
    const walkId = parseInt(req.params.walkId);
    if (isNaN(walkId)) {
      return res.status(400).json({ error: 'Invalid walk ID' });
    }
    const callerUid = req.user?.uid;
    if (!callerUid) {
      return res.status(401).json({ error: 'AUTH_REQUIRED' });
    }
    const session = await walkSessionService.getActiveSession(walkId, callerUid);
    if (!session) {
      return res.status(404).json({ error: 'No active session found for this walk' });
    }
    res.json(session);
  } catch (error) {
    // Log full error server-side, return a stable generic client message —
    // never leak error.message (it may reveal query / schema details).
    console.error('[WALK SESSION] Get active session error:', error);
    res.status(500).json({ error: 'Failed to get active session' });
  }
});

// OWNER TRACKING: Get owner's active walk sessions
router.get('/owner/active-walks', requireAuth, async (req, res) => {
  try {
    const ownerId = req.user!.uid;
    const activeWalks = await walkSessionService.getOwnerActiveWalks(ownerId);

    res.json({
      success: true,
      walks: activeWalks,
    });
  } catch (error) {
    console.error('[WALK SESSION] Get owner active walks error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get active walks',
    });
  }
});

// OWNER TRACKING: Get real-time location for specific walk
router.get('/owner/:walkId/live-location', requireAuth, async (req, res) => {
  try {
    const walkId = parseInt(req.params.walkId);
    const ownerId = req.user!.uid;
    
    if (isNaN(walkId)) {
      return res.status(400).json({
        error: 'Invalid walk ID',
      });
    }
    
    const liveLocation = await walkSessionService.getOwnerLiveTracking(walkId, ownerId);

    if (!liveLocation) {
      return res.status(404).json({
        error: 'Walk not found or not authorized',
      });
    }

    res.json(liveLocation);
  } catch (error) {
    console.error('[WALK SESSION] Get owner live location error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get live location',
    });
  }
});

export default router;
