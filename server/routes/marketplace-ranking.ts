/**
 * MARKETPLACE RANKING ENGINE — Phase 9
 *
 * Computes a 0-100 rankingScore for every provider using:
 *   trustComponent      = trustScore × 0.45            (0-45 pts)
 *   ratingComponent     = ratingAvg × 8 × confidence   (0-40 pts)
 *   newProviderBoost    = +10 if < 3 reviews            (starvation guard)
 *   availabilityBoost   = inverse of upcoming density   (0-15 pts)
 *   atRiskPenalty       = −50 if trustScore ≤ 40        (strong suppression)
 *   adminBoost          = +15 if rankingBoostUntil active
 *
 * Operator overrides (rankingOverride column) replace the computed score entirely.
 *
 * Tiers derived from final score:
 *   Prestige ≥ 80 | Gold ≥ 60 | Silver ≥ 40 | Bronze < 40 | At-risk | New
 */

import { Router } from 'express';
import { db } from '../db';
import {
  providerProfiles,
  bookings,
  bookingDisputes,
} from '@shared/schema';
import { eq, and, gte, lt, sql, isNull, or } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { auth } from '../lib/firebase-admin';

const router = Router();

// ─── Types ────────────────────────────────────────────────────────────────────

export type ProviderTier = 'prestige' | 'gold' | 'silver' | 'bronze' | 'at_risk' | 'new';

export interface RankingResult {
  userId: string;
  rankingScore: number;
  tier: ProviderTier;
  components: {
    trustComponent: number;
    ratingComponent: number;
    newProviderBoost: number;
    availabilityBoost: number;
    atRiskPenalty: number;
    adminBoost: number;
  };
}

// ─── Core algorithm ───────────────────────────────────────────────────────────

/**
 * Returns the upcoming booking count for a provider in the next 7 days.
 * Used to compute availabilityBoost.
 */
async function getUpcomingBookingCount(userId: string): Promise<number> {
  const now = new Date();
  const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(bookings)
    .where(
      and(
        eq(bookings.providerId, userId),
        gte(bookings.startTime, now),
        lt(bookings.startTime, sevenDaysLater),
        sql`${bookings.status} IN ('accepted','confirmed','started')`
      )
    );

  return row?.count ?? 0;
}

/**
 * Derives availability boost from upcoming booking count.
 * Empty schedule → maximum boost (marketplace wants these slots filled).
 * Fully booked → no boost (let demand flow to others).
 */
function availabilityBoostFromCount(count: number): number {
  if (count === 0) return 15;
  if (count <= 2) return 8;
  if (count <= 4) return 3;
  return 0;
}

/**
 * Derives provider tier from final ranking score + trust data.
 */
export function getProviderTier(
  rankingScore: number | null,
  trustScore: number | null,
  ratingCount: number | null
): ProviderTier {
  if (trustScore !== null && trustScore <= 40) return 'at_risk';
  if (rankingScore === null) {
    return (ratingCount ?? 0) < 3 ? 'new' : 'silver';
  }
  if (rankingScore >= 80) return 'prestige';
  if (rankingScore >= 60) return 'gold';
  if (rankingScore >= 40) return 'silver';
  return 'bronze';
}

/**
 * Computes the full ranking score for a single provider and persists it to DB.
 * Safe to call after every review or on-demand.
 */
export async function computeAndPersistRankingScore(
  userId: string
): Promise<RankingResult | null> {
  try {
    // Fetch provider profile
    const [profile] = await db
      .select()
      .from(providerProfiles)
      .where(eq(providerProfiles.userId, userId))
      .limit(1);

    if (!profile) return null;

    const trustScore = profile.trustScore ?? null;
    const ratingAvg = parseFloat(profile.ratingAvg ?? '0') || 0;
    const ratingCount = profile.ratingCount ?? 0;
    const rankingOverride = profile.rankingOverride ?? null;
    const rankingBoostUntil = profile.rankingBoostUntil ?? null;

    // If admin has hard-set an override, just persist that and return
    if (rankingOverride !== null) {
      const tier = getProviderTier(rankingOverride, trustScore, ratingCount);
      await db
        .update(providerProfiles)
        .set({ rankingScore: rankingOverride, rankingUpdatedAt: new Date() })
        .where(eq(providerProfiles.userId, userId));
      return {
        userId,
        rankingScore: rankingOverride,
        tier,
        components: {
          trustComponent: 0,
          ratingComponent: 0,
          newProviderBoost: 0,
          availabilityBoost: 0,
          atRiskPenalty: 0,
          adminBoost: 0,
        },
      };
    }

    // ── Component calculations ────────────────────────────────────────────────

    // Trust component: 0-45 pts. Default 50 for new providers (neutral).
    const trustComponent = (trustScore ?? 50) * 0.45;

    // Rating component: 0-40 pts, confidence-weighted by review count.
    const confidenceWeight = Math.min(ratingCount / 10, 1);
    const ratingComponent = ratingAvg * 8 * confidenceWeight;

    // New provider boost: prevents starvation for providers with few reviews.
    const newProviderBoost = ratingCount < 3 ? 10 : 0;

    // Availability boost: inverse of upcoming booking density.
    const upcomingCount = await getUpcomingBookingCount(userId);
    const availabilityBoost = availabilityBoostFromCount(upcomingCount);

    // At-risk penalty: strong suppression when trust is compromised.
    const atRiskPenalty = trustScore !== null && trustScore <= 40 ? 50 : 0;

    // Temporary admin boost (e.g. new provider promotion).
    const adminBoost =
      rankingBoostUntil && rankingBoostUntil > new Date() ? 15 : 0;

    // ── Final score ───────────────────────────────────────────────────────────

    const raw =
      trustComponent +
      ratingComponent +
      newProviderBoost +
      availabilityBoost -
      atRiskPenalty +
      adminBoost;

    const rankingScore = Math.max(0, Math.min(100, Math.round(raw)));
    const tier = getProviderTier(rankingScore, trustScore, ratingCount);

    // Persist
    await db
      .update(providerProfiles)
      .set({ rankingScore, rankingUpdatedAt: new Date() })
      .where(eq(providerProfiles.userId, userId));

    logger.info('[Ranking] Score computed', {
      userId,
      rankingScore,
      tier,
      trustComponent: Math.round(trustComponent),
      ratingComponent: Math.round(ratingComponent),
      newProviderBoost,
      availabilityBoost,
      atRiskPenalty,
      adminBoost,
    });

    return {
      userId,
      rankingScore,
      tier,
      components: {
        trustComponent: Math.round(trustComponent),
        ratingComponent: Math.round(ratingComponent),
        newProviderBoost,
        availabilityBoost,
        atRiskPenalty,
        adminBoost,
      },
    };
  } catch (err: any) {
    logger.error('[Ranking] computeAndPersistRankingScore failed', {
      userId,
      error: err.message,
    });
    return null;
  }
}

// ─── Admin helper: verify admin token ─────────────────────────────────────────

async function requireAdmin(req: any, res: any): Promise<string | null> {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  try {
    const decoded = await auth.verifyIdToken(token, true);
    const adminSecret = process.env.ADMIN_SECRET || process.env.PETWASH_ADMIN_SECRET;
    const clientSecret = req.headers['x-admin-secret'];
    if (adminSecret && clientSecret !== adminSecret) {
      res.status(403).json({ error: 'Admin access required' });
      return null;
    }
    return decoded.uid;
  } catch {
    res.status(401).json({ error: 'Invalid token' });
    return null;
  }
}

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * POST /api/marketplace/rankings/recompute
 * Admin: recompute ranking scores for all providers in providerProfiles.
 */
router.post('/recompute', async (req, res) => {
  if (!(await requireAdmin(req, res))) return;

  try {
    const profiles = await db
      .select({ userId: providerProfiles.userId })
      .from(providerProfiles);

    let refreshed = 0;
    let errors = 0;

    for (const { userId } of profiles) {
      const result = await computeAndPersistRankingScore(userId);
      if (result) refreshed++;
      else errors++;
    }

    logger.info('[Ranking] Batch recompute complete', { refreshed, errors });
    res.json({ ok: true, refreshed, errors, total: profiles.length });
  } catch (err: any) {
    logger.error('[Ranking] Batch recompute failed', { error: err.message });
    res.status(500).json({ error: 'Recompute failed' });
  }
});

/**
 * GET /api/marketplace/rankings/providers
 * Admin: full ranked provider list for the intelligence dashboard.
 */
router.get('/providers', async (req, res) => {
  if (!(await requireAdmin(req, res))) return;

  try {
    const profiles = await db
      .select()
      .from(providerProfiles)
      .orderBy(sql`ranking_score DESC NULLS LAST`);

    // Fetch dispute counts per provider via bookings join
    const disputeRows = await db.execute(sql`
      SELECT b.provider_id, count(d.id)::int AS count
      FROM booking_disputes d
      JOIN bookings b ON b.id = d.booking_id
      WHERE b.provider_id IS NOT NULL
      GROUP BY b.provider_id
    `);

    const disputeMap = new Map<string, number>(
      (disputeRows.rows as any[]).map((r) => [r.provider_id, Number(r.count)])
    );

    // Fetch completed revenue per provider (subtotal in ILS)
    const revenueRows = await db
      .select({
        providerId: bookings.providerId,
        totalILS: sql<number>`sum(${bookings.subtotal})::float`,
      })
      .from(bookings)
      .where(eq(bookings.status, 'completed'))
      .groupBy(bookings.providerId);

    const revenueMap = new Map<string, number>(
      revenueRows
        .filter((r) => r.providerId)
        .map((r) => [r.providerId!, r.totalILS])
    );

    const result = profiles.map((p) => ({
      userId: p.userId,
      rankingScore: p.rankingScore,
      rankingOverride: p.rankingOverride,
      rankingBoostUntil: p.rankingBoostUntil,
      trustScore: p.trustScore,
      ratingAvg: p.ratingAvg,
      ratingCount: p.ratingCount,
      tier: getProviderTier(p.rankingScore, p.trustScore, p.ratingCount),
      disputeCount: disputeMap.get(p.userId) ?? 0,
      revenueILS: revenueMap.get(p.userId) ?? 0,
      rankingUpdatedAt: p.rankingUpdatedAt,
    }));

    res.json({ providers: result, total: result.length });
  } catch (err: any) {
    logger.error('[Ranking] GET /providers failed', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch ranked providers' });
  }
});

/**
 * PATCH /api/marketplace/rankings/:userId
 * Admin: set manual override, temporary boost, or reset.
 *
 * Body: { action: 'boost' | 'suppress' | 'reset' }
 * - boost:    sets rankingBoostUntil = now + 7 days (score gets +15)
 * - suppress: sets rankingOverride = 5 (pinned near bottom)
 * - reset:    clears rankingOverride and rankingBoostUntil
 */
router.patch('/:userId', async (req, res) => {
  if (!(await requireAdmin(req, res))) return;

  const { userId } = req.params;
  const { action } = req.body as { action: 'boost' | 'suppress' | 'reset' };

  if (!['boost', 'suppress', 'reset'].includes(action)) {
    return res.status(400).json({ error: 'action must be boost | suppress | reset' });
  }

  try {
    const now = new Date();

    if (action === 'boost') {
      const boostUntil = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      await db
        .update(providerProfiles)
        .set({
          rankingOverride: null,
          rankingBoostUntil: boostUntil,
          rankingUpdatedAt: now,
        })
        .where(eq(providerProfiles.userId, userId));
    } else if (action === 'suppress') {
      await db
        .update(providerProfiles)
        .set({
          rankingOverride: 5,
          rankingBoostUntil: null,
          rankingUpdatedAt: now,
        })
        .where(eq(providerProfiles.userId, userId));
    } else {
      await db
        .update(providerProfiles)
        .set({
          rankingOverride: null,
          rankingBoostUntil: null,
          rankingUpdatedAt: now,
        })
        .where(eq(providerProfiles.userId, userId));
    }

    // Recompute score with new settings
    await computeAndPersistRankingScore(userId);

    logger.info('[Ranking] Admin override applied', { userId, action });
    res.json({ ok: true, userId, action });
  } catch (err: any) {
    logger.error('[Ranking] Admin override failed', { userId, error: err.message });
    res.status(500).json({ error: 'Override failed' });
  }
});

export default router;
