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
  providerRankingAudit,
} from '@shared/schema';
import { eq, and, gte, lt, sql, desc } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { auth } from '../lib/firebase-admin';
import { callerCanAdminMarketplaceRankings } from '../lib/marketplace-ranking-admin';

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

// ─── Auth helpers ─────────────────────────────────────────────────────────────

async function requireAdmin(req: any, res: any): Promise<string | null> {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  try {
    const decoded = await auth.verifyIdToken(token, true);
    if (!callerCanAdminMarketplaceRankings(decoded as any)) {
      res.status(403).json({ error: 'Admin access required' });
      return null;
    }

    // SECURITY (T08): Use timing-safe comparison — old `!==` leaks secret length via timing
    const { isValidAdminSecret } = await import('../lib/admin-secret');
    const adminSecretPresent = !!(process.env.ADMIN_SECRET || process.env.PETWASH_ADMIN_SECRET);
    if (adminSecretPresent && !isValidAdminSecret(req, 'ADMIN_SECRET') && !isValidAdminSecret(req, 'PETWASH_ADMIN_SECRET')) {
      res.status(403).json({ error: 'Admin access required' });
      return null;
    }
    return decoded.uid;
  } catch {
    res.status(401).json({ error: 'Invalid token' });
    return null;
  }
}

async function requireAuth(req: any, res: any): Promise<string | null> {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  try {
    const decoded = await auth.verifyIdToken(token, true);
    return decoded.uid;
  } catch {
    res.status(401).json({ error: 'Invalid token' });
    return null;
  }
}

// ─── Audit log helper ─────────────────────────────────────────────────────────

async function writeAuditLog(
  providerUserId: string,
  adminUid: string,
  action: string,
  note?: string
): Promise<void> {
  try {
    await db.insert(providerRankingAudit).values({
      providerUserId,
      adminUid,
      action,
      note: note ?? null,
    });
  } catch (err: any) {
    logger.error('[Ranking] Audit log write failed', { providerUserId, action, error: err.message });
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
      rankingFlaggedAt: p.rankingFlaggedAt,
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
 * Admin: set manual override, temporary boost, flag for review, or reset.
 *
 * Body: { action: 'boost' | 'suppress' | 'reset' | 'flag' | 'unflag', note?: string }
 * - boost:   sets rankingBoostUntil = now + 7 days (+15 to score)
 * - suppress: sets rankingOverride = 5 (pinned near bottom)
 * - reset:   clears rankingOverride, rankingBoostUntil, and rankingFlaggedAt
 * - flag:    sets rankingFlaggedAt = now (investigation state, does not alter score)
 * - unflag:  clears rankingFlaggedAt
 *
 * Every action is written to provider_ranking_audit for accountability.
 */
router.patch('/:userId', async (req, res) => {
  const adminUid = await requireAdmin(req, res);
  if (!adminUid) return;

  const { userId } = req.params;
  const { action, note } = req.body as {
    action: 'boost' | 'suppress' | 'reset' | 'flag' | 'unflag';
    note?: string;
  };

  if (!['boost', 'suppress', 'reset', 'flag', 'unflag'].includes(action)) {
    return res.status(400).json({ error: 'action must be boost | suppress | reset | flag | unflag' });
  }

  try {
    const now = new Date();

    if (action === 'boost') {
      const boostUntil = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      await db
        .update(providerProfiles)
        .set({ rankingOverride: null, rankingBoostUntil: boostUntil, rankingUpdatedAt: now })
        .where(eq(providerProfiles.userId, userId));
    } else if (action === 'suppress') {
      await db
        .update(providerProfiles)
        .set({ rankingOverride: 5, rankingBoostUntil: null, rankingUpdatedAt: now })
        .where(eq(providerProfiles.userId, userId));
    } else if (action === 'flag') {
      await db
        .update(providerProfiles)
        .set({ rankingFlaggedAt: now, rankingUpdatedAt: now })
        .where(eq(providerProfiles.userId, userId));
    } else if (action === 'unflag') {
      await db
        .update(providerProfiles)
        .set({ rankingFlaggedAt: null, rankingUpdatedAt: now })
        .where(eq(providerProfiles.userId, userId));
    } else {
      // reset
      await db
        .update(providerProfiles)
        .set({ rankingOverride: null, rankingBoostUntil: null, rankingFlaggedAt: null, rankingUpdatedAt: now })
        .where(eq(providerProfiles.userId, userId));
    }

    // Write audit log for every action
    await writeAuditLog(userId, adminUid, action, note);

    // Recompute score (no-op for flag/unflag since they don't change score)
    if (action !== 'flag' && action !== 'unflag') {
      await computeAndPersistRankingScore(userId);
    }

    logger.info('[Ranking] Admin override applied', { userId, action, adminUid });
    res.json({ ok: true, userId, action });
  } catch (err: any) {
    logger.error('[Ranking] Admin override failed', { userId, error: err.message });
    res.status(500).json({ error: 'Override failed' });
  }
});

/**
 * GET /api/marketplace/rankings/audit/:userId
 * Admin: fetch recent audit log entries for a specific provider.
 */
router.get('/audit/:userId', async (req, res) => {
  if (!(await requireAdmin(req, res))) return;

  const { userId } = req.params;

  try {
    const entries = await db
      .select()
      .from(providerRankingAudit)
      .where(eq(providerRankingAudit.providerUserId, userId))
      .orderBy(desc(providerRankingAudit.createdAt))
      .limit(20);

    res.json({ entries, total: entries.length });
  } catch (err: any) {
    logger.error('[Ranking] Audit fetch failed', { userId, error: err.message });
    res.status(500).json({ error: 'Failed to fetch audit log' });
  }
});

/**
 * GET /api/marketplace/rankings/my-ranking
 * Provider-authenticated: returns the provider's tier, score breakdown,
 * and a plain-language explanation of what affects their ranking.
 * This is the transparency layer providers need to understand and improve.
 */
router.get('/my-ranking', async (req, res) => {
  const uid = await requireAuth(req, res);
  if (!uid) return;

  try {
    const [profile] = await db
      .select()
      .from(providerProfiles)
      .where(eq(providerProfiles.userId, uid))
      .limit(1);

    if (!profile) {
      return res.status(404).json({ error: 'Provider profile not found' });
    }

    const trustScore = profile.trustScore ?? null;
    const ratingAvg = parseFloat(profile.ratingAvg ?? '0') || 0;
    const ratingCount = profile.ratingCount ?? 0;
    const rankingScore = profile.rankingScore;
    const rankingBoostUntil = profile.rankingBoostUntil ?? null;
    const rankingFlaggedAt = profile.rankingFlaggedAt ?? null;

    const tier = getProviderTier(rankingScore, trustScore, ratingCount);

    // Compute breakdown components for transparency
    const trustComponent = Math.round((trustScore ?? 50) * 0.45);
    const confidenceWeight = Math.min(ratingCount / 10, 1);
    const ratingComponent = Math.round(ratingAvg * 8 * confidenceWeight);
    const newProviderBoost = ratingCount < 3 ? 10 : 0;
    const atRiskPenalty = trustScore !== null && trustScore <= 40 ? 50 : 0;
    const adminBoost = rankingBoostUntil && new Date(rankingBoostUntil) > new Date() ? 15 : 0;

    // Dispute count (affects trustScore which affects ranking)
    const disputeRows = await db.execute(sql`
      SELECT count(d.id)::int AS count
      FROM booking_disputes d
      JOIN bookings b ON b.id = d.booking_id
      WHERE b.provider_id = ${uid}
        AND d.status = 'open'
    `);
    const openDisputeCount = Number((disputeRows.rows as any[])[0]?.count ?? 0);

    // Recent audit entries visible to the provider (only boost/suppress/flag — no admin UID shown)
    const auditRows = await db
      .select({
        action: providerRankingAudit.action,
        createdAt: providerRankingAudit.createdAt,
      })
      .from(providerRankingAudit)
      .where(eq(providerRankingAudit.providerUserId, uid))
      .orderBy(desc(providerRankingAudit.createdAt))
      .limit(5);

    res.json({
      tier,
      rankingScore,
      trustScore,
      ratingAvg: ratingAvg.toFixed(2),
      ratingCount,
      isFlagged: !!rankingFlaggedAt,
      breakdown: {
        trustComponent,
        ratingComponent,
        newProviderBoost,
        atRiskPenalty,
        adminBoost,
        // availabilityBoost is dynamic (based on upcoming bookings at compute time)
      },
      openDisputeCount,
      recentActions: auditRows,
      // Provider-facing explanation
      factors: {
        trust: {
          label: 'Trust Score',
          value: trustScore,
          impact: trustComponent,
          description: atRiskPenalty > 0
            ? 'Your trust score is below threshold — this applies a strong ranking penalty. Resolve open disputes to improve it.'
            : 'Based on completed bookings, cancellation rate, and disputes. Higher trust → higher ranking.',
        },
        rating: {
          label: 'Customer Rating',
          value: ratingAvg.toFixed(1),
          count: ratingCount,
          impact: ratingComponent,
          description: ratingCount < 3
            ? 'New provider boost active (+10 pts) while you build up reviews. Collect your first reviews to establish your rating component.'
            : 'Calculated from your average rating, weighted by number of reviews. More reviews strengthen the signal.',
        },
        availability: {
          label: 'Availability',
          impact: 'up to +15',
          description: 'Providers with open slots are boosted in results to maintain marketplace liquidity. Keeping your calendar open helps visibility.',
        },
        disputes: {
          label: 'Open Disputes',
          value: openDisputeCount,
          impact: openDisputeCount > 0 ? 'Reduces trust score' : 'None',
          description: openDisputeCount > 0
            ? `You have ${openDisputeCount} open dispute(s). Each unresolved dispute reduces your trust score.`
            : 'No open disputes. Maintaining a clean dispute record protects your trust score.',
        },
      },
    });
  } catch (err: any) {
    logger.error('[Ranking] my-ranking fetch failed', { uid, error: err.message });
    res.status(500).json({ error: 'Failed to fetch ranking data' });
  }
});

export default router;
