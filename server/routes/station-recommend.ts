/**
 * Station Recommendation API — Phase 10, Task #22
 *
 * GET /api/stations/recommend?lat=&lng=&serviceType=
 *
 * Returns the top-3 active stations ranked by a composite score:
 *   distance      40%  (Haversine, normalised; omitted / neutral when lat/lng absent)
 *   availability  35%  (1 - upcoming_bookings/BUSY_THRESHOLD, 7-day window)
 *   rankingScore  25%  (stations.ranking_score 0-100, defaults to 50 until T23 populates it)
 *
 * serviceType filter: if provided, restricts to stations whose `features` JSONB array
 * contains the requested service type (case-insensitive).  When no stations match the
 * filter the constraint is dropped and all active stations are considered (graceful
 * degradation), with a `serviceTypeFiltered: false` flag in the response.
 *
 * Inactive stations (`is_active = false`) are excluded entirely.
 */

import { Router } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { logger } from '../lib/logger';

const router = Router();

const BUSY_THRESHOLD = 20;

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function normalize(value: number, min: number, max: number): number {
  if (max === min) return 0.5;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

interface StationRow {
  id: number;
  name: string;
  nameHe: string | null;
  stationCode: string;
  city: string;
  address: string;
  latitude: string | null;
  longitude: string | null;
  upcoming: number;
  ranking_score: number;
}

async function fetchActiveStations(serviceType: string | null): Promise<{ rows: StationRow[]; serviceTypeFiltered: boolean }> {
  const baseQuery = sql`
    SELECT
      s.id,
      s.name,
      s.name_he          AS "nameHe",
      s.station_code     AS "stationCode",
      l.city,
      l.address_line1    AS address,
      l.latitude,
      l.longitude,
      COALESCE(bc.upcoming, 0)::int          AS upcoming,
      COALESCE(s.ranking_score, 50)::int     AS ranking_score
    FROM stations s
    INNER JOIN locations l ON l.id = s.location_id
    LEFT JOIN (
      SELECT station_id, COUNT(*)::int AS upcoming
      FROM bookings
      WHERE start_time >= NOW()
        AND start_time < NOW() + INTERVAL '7 days'
        AND status IN ('accepted','confirmed','started','pending')
      GROUP BY station_id
    ) bc ON bc.station_id = s.id
    WHERE s.is_active = true
  `;

  if (serviceType) {
    // Try to filter by serviceType in the features array
    const filtered = await db.execute(sql`
      ${baseQuery}
        AND EXISTS (
          SELECT 1 FROM unnest(s.features) f
          WHERE lower(f) = lower(${serviceType})
        )
    `);
    if (filtered.rows.length > 0) {
      return { rows: filtered.rows as StationRow[], serviceTypeFiltered: true };
    }
    // Graceful degradation: no stations offer this service type — return all
  }

  const all = await db.execute(baseQuery);
  return { rows: all.rows as StationRow[], serviceTypeFiltered: false };
}

router.get('/', async (req, res) => {
  try {
    const lat = req.query.lat !== undefined ? parseFloat(req.query.lat as string) : null;
    const lng = req.query.lng !== undefined ? parseFloat(req.query.lng as string) : null;
    const serviceType = (req.query.serviceType as string | undefined) || null;

    if ((lat !== null && isNaN(lat)) || (lng !== null && isNaN(lng))) {
      return res.status(400).json({ error: 'lat and lng must be valid numbers' });
    }

    const useGeo = lat !== null && lng !== null;

    const { rows: activeStations, serviceTypeFiltered } = await fetchActiveStations(serviceType);

    if (activeStations.length === 0) {
      return res.json({ stations: [], serviceTypeFiltered });
    }

    const distances: number[] = activeStations.map((s) => {
      if (!useGeo || s.latitude == null || s.longitude == null) return 0;
      return haversineKm(lat!, lng!, Number(s.latitude), Number(s.longitude));
    });

    const positiveDistances = distances.filter((d) => d > 0);
    const maxDist = positiveDistances.length > 0 ? Math.max(...positiveDistances) : 1;

    const scored = activeStations.map((s, i) => {
      const distKm = distances[i];
      // When no geo or station lacks coordinates: distance component treated as neutral (0.5)
      const distScore = (useGeo && s.latitude != null) ? 1 - normalize(distKm, 0, maxDist) : 0.5;

      const availScore = 1 - Math.min(Number(s.upcoming) / BUSY_THRESHOLD, 1);

      // rankingScore: 0-100 from stations table (COALESCE 50 = neutral until T23 populates it)
      const rankScore = Number(s.ranking_score) / 100;

      const composite = distScore * 0.40 + availScore * 0.35 + rankScore * 0.25;

      const tier =
        composite >= 0.8 ? 'prestige' :
        composite >= 0.6 ? 'gold' :
        composite >= 0.4 ? 'silver' : 'bronze';

      return {
        id: Number(s.id),
        name: s.name,
        nameHe: s.nameHe ?? null,
        stationCode: s.stationCode,
        city: s.city,
        address: s.address,
        distanceKm: (useGeo && s.latitude != null) ? Math.round(distKm * 10) / 10 : null,
        upcomingBookings: Number(s.upcoming),
        availableSlots: Math.max(0, BUSY_THRESHOLD - Number(s.upcoming)),
        rankingScore: Number(s.ranking_score),
        score: Math.round(composite * 1000) / 1000,
        tier,
      };
    });

    scored.sort((a, b) => b.score - a.score);
    const top3 = scored.slice(0, 3);

    logger.info('[StationRecommend] Returned recommendations', {
      count: top3.length,
      useGeo,
      serviceType: serviceType ?? 'any',
      serviceTypeFiltered,
    });

    return res.json({ stations: top3, serviceTypeFiltered });
  } catch (err: any) {
    logger.error('[StationRecommend] Error', { error: err.message });
    return res.status(500).json({ error: 'Failed to compute station recommendations' });
  }
});

export default router;
