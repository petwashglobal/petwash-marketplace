/**
 * Station Performance Layer — Phase 10, Task #23
 *
 * Computes per-station trust and ranking scores, independent of the franchise owner score.
 *
 * Formula (mirrors provider ranking from marketplace-ranking.ts):
 *
 * TrustScore (0-100):
 *   base                    = 50 (neutral)
 *   ratingBonus             = (ratingAvg - 3) * 10   → -20 to +20
 *   completionBonus         = (completionRate - 0.5) * 20  → -10 to +10
 *   disputePenalty          = min(disputeCount * 5, 30)
 *   trustScore              = clamp(base + ratingBonus + completionBonus - disputePenalty, 0, 100)
 *
 * RankingScore (0-100):
 *   trustComponent          = trustScore × 0.45       (0-45 pts, same as provider)
 *   ratingComponent         = ratingAvg × 8 × confidence  (0-40 pts, same as provider)
 *   newStationBoost         = +10 if ratingCount < 3  (starvation guard)
 *   atRiskPenalty           = −50 if trustScore ≤ 40
 *   rankingScore            = clamp(sum, 0, 100)
 *
 * Tier thresholds (same as provider):
 *   prestige ≥ 80 | gold ≥ 60 | silver ≥ 40 | bronze < 40 | at_risk (trustScore ≤ 40)
 *
 * Routes:
 *   POST /api/stations/:stationId/recompute  (x-admin-secret header, same auth pattern as station-settlements)
 *   GET  /api/stations/:stationId/profile    (public)
 */

import { Router } from 'express';
import { db } from '../db';
import { stationProfiles, stations } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';
import { logger } from '../lib/logger';

export type StationTier = 'prestige' | 'gold' | 'silver' | 'bronze' | 'at_risk';

export interface StationScoreResult {
  stationId: number;
  trustScore: number;
  rankingScore: number;
  ratingAvg: number;
  ratingCount: number;
  disputeCount: number;
  completionRate: number;
  tier: StationTier;
  components: {
    ratingBonus: number;
    completionBonus: number;
    disputePenalty: number;
    trustComponent: number;
    ratingComponent: number;
    newStationBoost: number;
    atRiskPenalty: number;
  };
  lastComputedAt: Date;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function getStationTier(rankingScore: number, trustScore: number): StationTier {
  if (trustScore <= 40) return 'at_risk';
  if (rankingScore >= 80) return 'prestige';
  if (rankingScore >= 60) return 'gold';
  if (rankingScore >= 40) return 'silver';
  return 'bronze';
}

// ─── Core algorithm ───────────────────────────────────────────────────────────

/**
 * Aggregates grooming feedback, booking completion rate, and open disputes for a station,
 * computes trust + ranking scores, and upserts the result into station_profiles.
 * Safe to call on-demand or in a batch job.
 */
export async function computeStationScore(stationId: number): Promise<StationScoreResult | null> {
  try {
    // Verify station exists and is known
    const [station] = await db
      .select({ id: stations.id })
      .from(stations)
      .where(eq(stations.id, stationId))
      .limit(1);

    if (!station) {
      logger.warn('[StationPerf] Station not found', { stationId });
      return null;
    }

    // ── Aggregate ratings from grooming_feedback ──────────────────────────────
    const ratingRow = await db.execute(sql`
      SELECT
        COALESCE(AVG(overall_rating), 0)::float  AS rating_avg,
        COUNT(*)::int                             AS rating_count
      FROM grooming_feedback
      WHERE station_id = ${stationId}
        AND is_visible = true
    `);
    const rawRating = ratingRow.rows[0] as { rating_avg: number; rating_count: number };
    const ratingAvg = Number(rawRating.rating_avg);
    const ratingCount = Number(rawRating.rating_count);

    // ── Booking completion rate ────────────────────────────────────────────────
    const bookingRow = await db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
        COUNT(*) FILTER (WHERE status IN ('completed','cancelled','disputed'))::int AS total
      FROM bookings
      WHERE station_id = ${stationId}
    `);
    const rawBooking = bookingRow.rows[0] as { completed: number; total: number };
    const completedCount = Number(rawBooking.completed);
    const totalCount = Number(rawBooking.total);
    const completionRate = totalCount > 0 ? completedCount / totalCount : 1.0;

    // ── Open disputes tied to this station ────────────────────────────────────
    const disputeRow = await db.execute(sql`
      SELECT COUNT(*)::int AS dispute_count
      FROM booking_disputes d
      JOIN bookings b ON b.id::text = d.booking_id
      WHERE b.station_id = ${stationId}
        AND d.status = 'open'
    `);
    const disputeCount = Number((disputeRow.rows[0] as { dispute_count: number }).dispute_count);

    // ── TrustScore ────────────────────────────────────────────────────────────
    // Use neutral (3.0) for stations with no ratings yet — same starvation guard as providers
    const effectiveRatingAvg = ratingCount > 0 ? ratingAvg : 3.0;
    const ratingBonus = (effectiveRatingAvg - 3) * 10;
    const completionBonus = (completionRate - 0.5) * 20;
    const disputePenalty = Math.min(disputeCount * 5, 30);
    const trustScore = clamp(
      Math.round(50 + ratingBonus + completionBonus - disputePenalty),
      0,
      100
    );

    // ── RankingScore ──────────────────────────────────────────────────────────
    const confidenceWeight = Math.min(ratingCount / 10, 1);
    const trustComponent = trustScore * 0.45;
    const ratingComponent = ratingAvg > 0 ? ratingAvg * 8 * confidenceWeight : 0;
    const newStationBoost = ratingCount < 3 ? 10 : 0;
    const atRiskPenalty = trustScore <= 40 ? 50 : 0;

    const rawRankingScore =
      trustComponent + ratingComponent + newStationBoost - atRiskPenalty;
    const rankingScore = clamp(Math.round(rawRankingScore), 0, 100);

    const tier = getStationTier(rankingScore, trustScore);
    const now = new Date();

    // ── Upsert station_profiles ───────────────────────────────────────────────
    await db
      .insert(stationProfiles)
      .values({
        stationId,
        trustScore,
        rankingScore,
        ratingAvg: ratingAvg.toFixed(2),
        ratingCount,
        disputeCount,
        completionRate: completionRate.toFixed(4),
        lastComputedAt: now,
      })
      .onConflictDoUpdate({
        target: stationProfiles.stationId,
        set: {
          trustScore,
          rankingScore,
          ratingAvg: ratingAvg.toFixed(2),
          ratingCount,
          disputeCount,
          completionRate: completionRate.toFixed(4),
          lastComputedAt: now,
        },
      });

    // Also sync the denormalized columns on stations table (T22 ranking_score / trust_score)
    await db.execute(sql`
      UPDATE stations
      SET trust_score = ${trustScore},
          ranking_score = ${rankingScore},
          ranking_updated_at = ${now}
      WHERE id = ${stationId}
    `);

    logger.info('[StationPerf] Score computed', {
      stationId,
      trustScore,
      rankingScore,
      tier,
      ratingAvg,
      ratingCount,
      completionRate,
      disputeCount,
    });

    return {
      stationId,
      trustScore,
      rankingScore,
      ratingAvg,
      ratingCount,
      disputeCount,
      completionRate,
      tier,
      components: {
        ratingBonus: Math.round(ratingBonus),
        completionBonus: Math.round(completionBonus),
        disputePenalty,
        trustComponent: Math.round(trustComponent),
        ratingComponent: Math.round(ratingComponent),
        newStationBoost,
        atRiskPenalty,
      },
      lastComputedAt: now,
    };
  } catch (err: any) {
    logger.error('[StationPerf] computeStationScore failed', {
      stationId,
      error: err.message,
    });
    return null;
  }
}

// ─── Admin auth helper ────────────────────────────────────────────────────────

function requireAdminSecret(req: any, res: any): boolean {
  const adminSecret = process.env.ADMIN_SECRET || process.env.PETWASH_ADMIN_SECRET;
  const provided = req.headers['x-admin-secret'];
  if (!adminSecret || provided !== adminSecret) {
    res.status(403).json({ error: 'Admin access required' });
    return false;
  }
  return true;
}

// ─── Routes ───────────────────────────────────────────────────────────────────

const router = Router();

/**
 * POST /api/admin/stations/:stationId/recompute
 * Admin: recomputes trust + ranking scores for a single station.
 * Persists to station_profiles and syncs denormalized columns on stations.
 */
router.post('/:stationId/recompute', async (req, res) => {
  if (!requireAdminSecret(req, res)) return;

  const stationId = parseInt(req.params.stationId, 10);
  if (isNaN(stationId)) {
    return res.status(400).json({ error: 'stationId must be a positive integer' });
  }

  const result = await computeStationScore(stationId);
  if (!result) {
    return res.status(404).json({ error: 'Station not found or computation failed' });
  }

  return res.json({ ok: true, ...result });
});

/**
 * GET /api/stations/:stationId/profile
 * Public: returns the station's computed scores for marketplace display.
 * Returns 404 if the station doesn't exist; returns 200 with defaults if not yet computed.
 */
router.get('/:stationId/profile', async (req, res) => {
  const stationId = parseInt(req.params.stationId, 10);
  if (isNaN(stationId)) {
    return res.status(400).json({ error: 'stationId must be a positive integer' });
  }

  try {
    // Verify station existence
    const [station] = await db
      .select({ id: stations.id, name: stations.name, isActive: stations.isActive })
      .from(stations)
      .where(eq(stations.id, stationId))
      .limit(1);

    if (!station) {
      return res.status(404).json({ error: 'Station not found' });
    }

    // Fetch pre-computed profile (may not exist yet for new stations)
    const [profile] = await db
      .select()
      .from(stationProfiles)
      .where(eq(stationProfiles.stationId, stationId))
      .limit(1);

    if (!profile) {
      // Station exists but hasn't been scored yet — return neutral defaults
      return res.json({
        stationId,
        name: station.name,
        trustScore: 50,
        rankingScore: 50,
        ratingAvg: 0,
        ratingCount: 0,
        disputeCount: 0,
        completionRate: 1,
        tier: getStationTier(50, 50),
        lastComputedAt: null,
        computed: false,
      });
    }

    const trustScore = profile.trustScore;
    const rankingScore = profile.rankingScore;
    const tier = getStationTier(rankingScore, trustScore);

    return res.json({
      stationId,
      name: station.name,
      trustScore,
      rankingScore,
      ratingAvg: parseFloat(profile.ratingAvg),
      ratingCount: profile.ratingCount,
      disputeCount: profile.disputeCount,
      completionRate: parseFloat(profile.completionRate),
      tier,
      lastComputedAt: profile.lastComputedAt,
      computed: true,
    });
  } catch (err: any) {
    logger.error('[StationPerf] GET profile failed', { stationId, error: err.message });
    return res.status(500).json({ error: 'Failed to fetch station profile' });
  }
});

export default router;
