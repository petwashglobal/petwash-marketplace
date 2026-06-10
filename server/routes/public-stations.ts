/**
 * Public, read-only station directory — powers /locations and /stations/:slug.
 *
 * VISIBILITY ONLY. Serves marketing-safe fields from pet_wash_stations
 * (name, address, hours, amenities, payment methods, coarse status).
 * Deliberately NEVER exposes: heartbeats, telemetry, Nayax terminal IDs,
 * usage/revenue counters, firmware/hardware internals, maintenance dates.
 * No auth (public directory), rate-limited, no mutations of any kind.
 */
import { Router, Request, Response } from 'express';
import { db } from '../db';
import { petWashStations } from '@shared/schema-enterprise';
import { ne, eq, and } from 'drizzle-orm';
import { apiLimiter } from '../middleware/rateLimiter';
import { logger } from '../lib/logger';

const router = Router();

// Marketing-safe projection — single source of truth for both endpoints.
const PUBLIC_FIELDS = {
  stationCode: petWashStations.stationCode,
  stationName: petWashStations.stationName,
  address: petWashStations.address,
  city: petWashStations.city,
  postalCode: petWashStations.postalCode,
  latitude: petWashStations.latitude,
  longitude: petWashStations.longitude,
  locationType: petWashStations.locationType,
  parkingAvailable: petWashStations.parkingAvailable,
  wheelchairAccessible: petWashStations.wheelchairAccessible,
  outdoorType: petWashStations.outdoorType,
  operationalStatus: petWashStations.operationalStatus,
  operatingHours: petWashStations.operatingHours,
  acceptsCard: petWashStations.acceptsCard,
  acceptsMobile: petWashStations.acceptsMobile,
  acceptsCash: petWashStations.acceptsCash,
};

/**
 * GET /api/public/stations — all non-decommissioned stations.
 * Offline/maintenance stations ARE included with their honest status so the
 * page can say "temporarily unavailable" instead of pretending they vanished.
 */
router.get('/stations', apiLimiter, async (_req: Request, res: Response) => {
  try {
    const stations = await db
      .select(PUBLIC_FIELDS)
      .from(petWashStations)
      .where(ne(petWashStations.operationalStatus, 'decommissioned'))
      .orderBy(petWashStations.city, petWashStations.stationCode);
    res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600');
    res.json({ stations });
  } catch (err: any) {
    logger.error('[PublicStations] list failed', { err: err?.message });
    res.status(500).json({ error: 'Failed to load stations' });
  }
});

/**
 * GET /api/public/stations/:code — single station by stationCode
 * (case-insensitive; codes look like PWS-IL-TLV-001).
 */
router.get('/stations/:code', apiLimiter, async (req: Request, res: Response) => {
  try {
    const code = String(req.params.code || '').toUpperCase();
    if (!/^[A-Z0-9-]{3,40}$/.test(code)) {
      return res.status(400).json({ error: 'Invalid station code' });
    }
    const rows = await db
      .select(PUBLIC_FIELDS)
      .from(petWashStations)
      .where(and(
        eq(petWashStations.stationCode, code),
        ne(petWashStations.operationalStatus, 'decommissioned'),
      ))
      .limit(1);
    if (!rows.length) return res.status(404).json({ error: 'Station not found' });
    res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600');
    res.json({ station: rows[0] });
  } catch (err: any) {
    logger.error('[PublicStations] detail failed', { err: err?.message });
    res.status(500).json({ error: 'Failed to load station' });
  }
});

export default router;
