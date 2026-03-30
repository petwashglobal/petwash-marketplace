/**
 * Station Recommendation API — Phase 10, Task #22
 *
 * GET /api/stations/recommend?lat=&lng=&serviceType=
 *
 * Returns the top-3 active stations ranked by a composite score:
 *   distance    40%  (Haversine straight-line, normalised per batch)
 *   availability 35%  (1 - upcoming_bookings/MAX_LOAD, 7-day window)
 *   rating       25%  (avg overallRating from groomingFeedback, 1-5)
 *
 * If lat/lng are omitted the distance component is treated as 0 (neutral).
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

router.get('/', async (req, res) => {
  try {
    const lat = req.query.lat !== undefined ? parseFloat(req.query.lat as string) : null;
    const lng = req.query.lng !== undefined ? parseFloat(req.query.lng as string) : null;

    if ((lat !== null && isNaN(lat)) || (lng !== null && isNaN(lng))) {
      return res.status(400).json({ error: 'lat and lng must be valid numbers' });
    }

    const useGeo = lat !== null && lng !== null;

    // Single query: stations + locations + upcoming booking counts + avg ratings
    const rows = await db.execute(sql`
      SELECT
        s.id,
        s.name,
        s.name_he AS "nameHe",
        s.station_code AS "stationCode",
        l.city,
        l.address_line1 AS address,
        l.latitude,
        l.longitude,
        COALESCE(bc.upcoming, 0)::int AS upcoming,
        COALESCE(gf.avg_rating, 3)::float AS avg_rating,
        COALESCE(gf.rating_count, 0)::int AS rating_count
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
      LEFT JOIN (
        SELECT station_id,
               AVG(overall_rating)::float AS avg_rating,
               COUNT(*)::int AS rating_count
        FROM grooming_feedback
        WHERE is_visible = true
        GROUP BY station_id
      ) gf ON gf.station_id = s.id
      WHERE s.is_active = true
    `);

    const activeStations = rows.rows as any[];

    if (activeStations.length === 0) {
      return res.json({ stations: [] });
    }

    const distances: number[] = activeStations.map((s) => {
      if (!useGeo || s.latitude == null || s.longitude == null) return 0;
      return haversineKm(lat!, lng!, Number(s.latitude), Number(s.longitude));
    });

    const maxDist = Math.max(...distances.filter((d) => d > 0), 1);

    const scored = activeStations.map((s, i) => {
      const distKm = distances[i];
      const distScore = useGeo ? 1 - normalize(distKm, 0, maxDist) : 0.5;

      const upcoming = Number(s.upcoming);
      const availScore = 1 - Math.min(upcoming / BUSY_THRESHOLD, 1);

      const avgRating = Number(s.avg_rating);
      const ratingScore = normalize(avgRating, 1, 5);

      const composite = distScore * 0.4 + availScore * 0.35 + ratingScore * 0.25;

      const tier =
        composite >= 0.8
          ? 'prestige'
          : composite >= 0.6
          ? 'gold'
          : composite >= 0.4
          ? 'silver'
          : 'bronze';

      return {
        id: Number(s.id),
        name: s.name as string,
        nameHe: s.nameHe as string | null,
        stationCode: s.stationCode as string,
        city: s.city as string,
        address: s.address as string,
        distanceKm: useGeo && s.latitude != null ? Math.round(distKm * 10) / 10 : null,
        upcomingBookings: upcoming,
        availableSlots: Math.max(0, BUSY_THRESHOLD - upcoming),
        avgRating: Number(s.avg_rating) > 0 ? Math.round(Number(s.avg_rating) * 10) / 10 : null,
        ratingCount: Number(s.rating_count),
        score: Math.round(composite * 1000) / 1000,
        tier,
      };
    });

    scored.sort((a, b) => b.score - a.score);
    const top3 = scored.slice(0, 3);

    logger.info('[StationRecommend] Returned recommendations', {
      count: top3.length,
      useGeo,
    });

    return res.json({ stations: top3 });
  } catch (err: any) {
    logger.error('[StationRecommend] Error', { error: err.message });
    return res.status(500).json({ error: 'Failed to compute station recommendations' });
  }
});

export default router;
