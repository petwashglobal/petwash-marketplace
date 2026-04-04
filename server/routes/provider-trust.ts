/**
 * PROVIDER TRUST & DISCOVERY API
 *
 * GET  /api/providers/stats/:userId      — real trust metrics (null-safe)
 * GET  /api/providers/browse             — filter-backed provider search
 * GET  /api/saved-providers              — list saved providers for current user
 * POST /api/saved-providers/:providerId  — save a provider
 * DEL  /api/saved-providers/:providerId  — unsave a provider
 */

import { Router, Request, Response } from 'express';
import { db, pool } from '../db';
import {
  providerProfiles,
  savedProviders,
} from '@shared/schema';
import { eq, and, sql, desc } from 'drizzle-orm';
import { logger } from '../lib/logger';
import {
  computeProviderTrustMetrics,
  refreshAndCacheProviderTrustMetrics,
  formatResponseTime,
  backfillAllProviderTrustMetrics,
  VERIFIED_BADGE_IDS,
} from '../utils/providerTrustMetrics';
import {
  refreshAndCacheProviderRankingScore,
  backfillAllProviderRankingScores,
  rankingTier,
} from '../utils/providerRanking';
import { requireAuth } from '../middleware/gates';

// P0-FIX: SUPER_ADMIN_UID must be set as SUPER_ADMIN_UID environment variable.
// Hardcoded Firebase UIDs in source code are a security risk — anyone who reads
// the repo knows which account to target or can forge requests.
// Set this in your environment: SUPER_ADMIN_UID=<firebase-uid-of-super-admin>
const SUPER_ADMIN_UID = (() => {
  const uid = process.env.SUPER_ADMIN_UID;
  if (!uid) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FATAL: SUPER_ADMIN_UID environment variable is required in production');
    }
    // In non-production: warn loudly and disable super-admin routes entirely
    console.warn('[provider-trust] WARNING: SUPER_ADMIN_UID not set — all super-admin routes will return 403');
    return '__SUPER_ADMIN_UID_NOT_CONFIGURED__';
  }
  return uid;
})();

const router = Router();

// ─── Auth helper ─────────────────────────────────────────────────────────────
function getUid(req: Request): string | null {
  return (req as any).userId || req.user?.uid || null;
}

// ─── GET /api/providers/stats/:userId ────────────────────────────────────────
// Returns real trust metrics. Every field is null when data is unavailable.
// UI MUST hide trust chips when null — never show invented values.
router.get('/providers/stats/:userId', async (req: Request, res: Response) => {
  const { userId } = req.params;

  try {
    // Check cache freshness: refresh if older than 6 hours or missing
    const [profile] = await db
      .select({
        trustMetricsUpdatedAt: providerProfiles.trustMetricsUpdatedAt,
        completedBookingsCount: providerProfiles.completedBookingsCount,
        repeatClientCount: providerProfiles.repeatClientCount,
        responseRatePct: providerProfiles.responseRatePct,
        avgResponseTimeMinutes: providerProfiles.avgResponseTimeMinutes,
        acceptanceRatePct: providerProfiles.acceptanceRatePct,
        completionRatePct: providerProfiles.completionRatePct,
        cancellationRatePct: providerProfiles.cancellationRatePct,
        trustScore: providerProfiles.trustScore,
        badges: providerProfiles.badges,
        lastPresenceAt: providerProfiles.lastPresenceAt,
        availabilityState: providerProfiles.availabilityState,
        backgroundCheckStatus: providerProfiles.backgroundCheckStatus,
        hasFencedYard: providerProfiles.hasFencedYard,
        hasNoPetsAtHome: providerProfiles.hasNoPetsAtHome,
        createdAt: providerProfiles.createdAt,
        ratingAvg: providerProfiles.ratingAvg,
        ratingCount: providerProfiles.ratingCount,
      })
      .from(providerProfiles)
      .where(eq(providerProfiles.userId, userId));

    const SIX_HOURS = 6 * 60 * 60 * 1000;
    const stale =
      !profile ||
      !profile.trustMetricsUpdatedAt ||
      Date.now() - profile.trustMetricsUpdatedAt.getTime() > SIX_HOURS;

    let metrics;
    if (stale) {
      try {
        metrics = await refreshAndCacheProviderTrustMetrics(userId);
      } catch (_) {
        // If provider_profiles row doesn't exist yet, compute without caching
        metrics = await computeProviderTrustMetrics(userId);
      }
    } else {
      const badgeList = Array.isArray(profile.badges) ? (profile.badges as string[]) : [];
      if (profile.backgroundCheckStatus === 'approved' && !badgeList.includes('background_check')) {
        badgeList.push('background_check');
      }
      metrics = {
        completedBookingsCount: profile.completedBookingsCount ?? 0,
        repeatClientCount: profile.repeatClientCount ?? null,
        responseRatePct: profile.responseRatePct ?? null,
        avgResponseTimeMinutes: profile.avgResponseTimeMinutes ?? null,
        acceptanceRatePct: profile.acceptanceRatePct ?? null,
        completionRatePct: profile.completionRatePct ?? null,
        cancellationRatePct: profile.cancellationRatePct ?? null,
        trustScore: profile.trustScore ?? null,
        isNew: (profile.completedBookingsCount ?? 0) < 3,
        lastActiveAt: profile.lastPresenceAt ?? null,
        backgroundCheckStatus: profile.backgroundCheckStatus ?? null,
        hasFencedYard: profile.hasFencedYard ?? null,
        hasNoPetsAtHome: profile.hasNoPetsAtHome ?? null,
        badges: badgeList,
      };
    }

    const isAvailableNow =
      profile?.availabilityState === 'online' &&
      profile?.lastPresenceAt &&
      Date.now() - profile.lastPresenceAt.getTime() < 5 * 60 * 1000; // online in last 5 min

    // Derive "available this week" from availability state (not presence alone)
    const isAvailableThisWeek =
      profile?.availabilityState === 'online' ||
      profile?.availabilityState === 'available';

    return res.json({
      userId,
      // ── Ratings ──────────────────────────────────────────────────────────
      ratingAvg: profile?.ratingAvg ? Number(profile.ratingAvg) : null,
      ratingCount: profile?.ratingCount ?? null,
      // ── Trust score (null = new provider / insufficient data) ────────────
      trustScore: metrics.trustScore,
      // ── Trust metrics (null = hide in UI) ────────────────────────────────
      completedBookingsCount: metrics.completedBookingsCount,
      repeatClientCount: metrics.repeatClientCount,
      responseRatePct: metrics.responseRatePct,
      avgResponseTimeMinutes: metrics.avgResponseTimeMinutes,
      responseTimeLabel: formatResponseTime(metrics.avgResponseTimeMinutes),
      acceptanceRatePct: metrics.acceptanceRatePct,
      completionRatePct: metrics.completionRatePct,
      cancellationRatePct: metrics.cancellationRatePct,
      isNew: metrics.isNew,
      // ── Verified badges ───────────────────────────────────────────────────
      badges: metrics.badges,
      hasBackgroundCheck: profile?.backgroundCheckStatus === 'approved',
      // ── Home setup ────────────────────────────────────────────────────────
      hasFencedYard: metrics.hasFencedYard,
      hasNoPetsAtHome: metrics.hasNoPetsAtHome,
      // ── Availability ──────────────────────────────────────────────────────
      isAvailableNow,
      isAvailableThisWeek,
      lastActiveAt: metrics.lastActiveAt,
      // ── Account age ───────────────────────────────────────────────────────
      memberSince: profile?.createdAt ?? null,
    });
  } catch (err) {
    logger.error('[ProviderStats] Failed', { userId, err });
    return res.status(500).json({ error: 'Failed to load provider stats' });
  }
});

// ─── GET /api/providers/browse ───────────────────────────────────────────────
// Real filter-backed provider browse. Returns providerProfiles rows
// joined with users (name) and bookingRequests aggregate stats.
// All filters map to real DB predicates.
// SECURITY: requireAuth guards this endpoint because the response includes
// PII fields (last_name, background_check_status) and detailed capacity data
// that must not be exposed to unauthenticated callers.
router.get('/providers/browse', requireAuth, async (req: Request, res: Response) => {
  const uid = getUid(req);

  const {
    minRating,
    availableThisWeek,
    backgroundCheckOnly,
    fencedYardOnly,
    noPetsAtHomeOnly,
    sortBy = 'ranking',
    limit = '24',
    offset = '0',
    // price + petType — NOW DB-backed (price_from_cents, accepted_pets columns added in migration)
    minPrice,   // ILS (multiplied ×100 → agorot for DB comparison)
    maxPrice,   // ILS
    petType,    // 'dog' | 'cat' | 'rabbit' | 'bird' | 'all'
  } = req.query as Record<string, string>;

  // ── Build parameterized WHERE clauses (pure SQL, no Drizzle ORM objects) ──
  const whereParts: string[] = ['TRUE'];
  const params: any[] = [];

  // minRating — server-backed (DB column rating_avg)
  if (minRating && Number(minRating) > 0) {
    params.push(Number(minRating));
    whereParts.push(`pp.rating_avg >= $${params.length}`);
  }

  // availableThisWeek — server-backed (DB column availability_state)
  if (availableThisWeek === 'true') {
    whereParts.push(`pp.availability_state IN ('online', 'available')`);
  }

  // backgroundCheckOnly — server-backed (DB column background_check_status)
  if (backgroundCheckOnly === 'true') {
    whereParts.push(`pp.background_check_status = 'approved'`);
  }

  // fencedYardOnly — server-backed (DB column has_fenced_yard)
  if (fencedYardOnly === 'true') {
    whereParts.push(`pp.has_fenced_yard = TRUE`);
  }

  // noPetsAtHomeOnly — server-backed (DB column has_no_pets_at_home)
  if (noPetsAtHomeOnly === 'true') {
    whereParts.push(`pp.has_no_pets_at_home = TRUE`);
  }

  // minPrice — server-backed (DB column price_from_cents; ILS → agorot ×100)
  if (minPrice && Number(minPrice) > 0) {
    params.push(Math.round(Number(minPrice) * 100));
    whereParts.push(`pp.price_from_cents >= $${params.length}`);
  }

  // maxPrice — server-backed; providers with null price always pass through (no price set = show)
  if (maxPrice && Number(maxPrice) < 1000) {
    params.push(Math.round(Number(maxPrice) * 100));
    whereParts.push(`(pp.price_from_cents IS NULL OR pp.price_from_cents <= $${params.length})`);
  }

  // petType — server-backed (DB column accepted_pets TEXT[]; null/empty = accepts all pet types)
  if (petType && petType !== 'all') {
    const PET_WHITELIST = ['dog', 'cat', 'rabbit', 'bird', 'hamster', 'fish'];
    if (PET_WHITELIST.includes(petType)) {
      params.push(petType);
      whereParts.push(`(pp.accepted_pets IS NULL OR pp.accepted_pets = '{}' OR $${params.length} = ANY(pp.accepted_pets))`);
    }
  }

  // ── ORDER BY — pure SQL (no user input in column name, switch-guarded) ──
  const orderByMap: Record<string, string> = {
    ranking:   'COALESCE(pp.ranking_override, pp.ranking_score) DESC NULLS LAST, pp.rating_avg DESC NULLS LAST',
    rating:    'pp.rating_avg DESC NULLS LAST',
    reviews:   'pp.rating_count DESC NULLS LAST',
    new:       'pp.created_at DESC',
    bookings:  'pp.completed_bookings_count DESC NULLS LAST',
    price_asc: 'pp.price_from_cents ASC NULLS LAST',
    price_desc:'pp.price_from_cents DESC NULLS LAST',
    trust:     'pp.trust_score DESC NULLS LAST, pp.rating_avg DESC NULLS LAST',
  };
  const orderBy = orderByMap[sortBy] ?? orderByMap.ranking;

  const pageLimit  = Math.min(Math.max(Number(limit) || 24, 1), 100);
  const pageOffset = Math.max(Number(offset) || 0, 0);

  params.push(uid ?? '');
  const savedParam = params.length; // $N for uid in saved_providers join
  params.push(pageLimit);
  const limitParam = params.length;
  params.push(pageOffset);
  const offsetParam = params.length;

  const whereClause = whereParts.join(' AND ');

  try {
    const result = await pool.query(
      `SELECT
        pp.user_id                    AS "userId",
        u.first_name                  AS "firstName",
        u.last_name                   AS "lastName",
        pp.rating_avg                 AS "ratingAvg",
        pp.rating_count               AS "ratingCount",
        pp.availability_state         AS "availabilityState",
        pp.last_presence_at           AS "lastPresenceAt",
        pp.background_check_status    AS "backgroundCheckStatus",
        pp.has_fenced_yard            AS "hasFencedYard",
        pp.has_no_pets_at_home        AS "hasNoPetsAtHome",
        pp.completed_bookings_count   AS "completedBookingsCount",
        pp.repeat_client_count        AS "repeatClientCount",
        pp.response_rate_pct          AS "responseRatePct",
        pp.avg_response_time_minutes  AS "avgResponseTimeMinutes",
        pp.price_from_cents           AS "priceFromCents",
        pp.accepted_pets              AS "acceptedPets",
        pp.trust_score                AS "trustScore",
        pp.acceptance_rate_pct        AS "acceptanceRatePct",
        pp.completion_rate_pct        AS "completionRatePct",
        pp.cancellation_rate_pct      AS "cancellationRatePct",
        pp.badges                     AS "badges",
        pp.ranking_score              AS "rankingScore",
        pp.ranking_override           AS "rankingOverride",
        COALESCE(pp.ranking_override, pp.ranking_score) AS "effectiveRankingScore",
        pp.created_at                 AS "createdAt",
        CASE WHEN sp.id IS NOT NULL THEN TRUE ELSE FALSE END AS "isSavedByUser"
      FROM provider_profiles pp
      LEFT JOIN users u ON u.id = pp.user_id
      LEFT JOIN saved_providers sp
        ON sp.provider_id = pp.user_id AND sp.user_id = $${savedParam}
      WHERE ${whereClause}
      ORDER BY ${orderBy}
      LIMIT $${limitParam}
      OFFSET $${offsetParam}`,
      params,
    );

    // Also fetch saved IDs separately for isSavedByUser flag accuracy
    let savedIds: string[] = [];
    if (uid) {
      const savedRows = await db
        .select({ providerId: savedProviders.providerId })
        .from(savedProviders)
        .where(eq(savedProviders.userId, uid));
      savedIds = savedRows.map(r => r.providerId);
    }

    const providers = result.rows.map((row: any) => ({
      userId: row.userId,
      name: [row.firstName, row.lastName].filter(Boolean).join(' ') || null,
      ratingAvg: row.ratingAvg !== null ? Number(row.ratingAvg) : null,
      ratingCount: row.ratingCount ?? 0,
      isAvailableThisWeek:
        row.availabilityState === 'online' || row.availabilityState === 'available',
      hasBackgroundCheck: row.backgroundCheckStatus === 'approved',
      hasFencedYard: row.hasFencedYard ?? null,
      hasNoPetsAtHome: row.hasNoPetsAtHome ?? null,
      completedBookingsCount: row.completedBookingsCount ?? 0,
      repeatClientCount: row.repeatClientCount ?? null,
      responseRatePct: row.responseRatePct ?? null,
      avgResponseTimeMinutes: row.avgResponseTimeMinutes ?? null,
      responseTimeLabel: formatResponseTime(row.avgResponseTimeMinutes ?? null),
      isNew: (row.completedBookingsCount ?? 0) < 3,
      isSavedByUser: savedIds.includes(row.userId),
      // price + accepted pets — now DB-backed
      priceFromCents: row.priceFromCents ?? null,               // agorot; null = provider hasn't set a price
      priceFrom: row.priceFromCents != null ? Math.round(row.priceFromCents / 100) : null, // ILS
      acceptedPets: row.acceptedPets ?? [],                     // string[]; empty = accepts all
      memberSince: row.createdAt,
    }));

    return res.json({ providers, total: providers.length });
  } catch (err) {
    logger.error('[ProviderBrowse] Failed', { err });
    return res.status(500).json({ error: 'Browse query failed' });
  }
});

// ─── GET /api/saved-providers ────────────────────────────────────────────────
router.get('/saved-providers', async (req: Request, res: Response) => {
  const uid = getUid(req);
  if (!uid) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const rows = await pool.query<{
      provider_id: string;
      platform: string | null;
      created_at: Date;
      display_name: string | null;
      profile_pic_url: string | null;
    }>(
      `SELECT
         sp.provider_id,
         sp.platform,
         sp.created_at,
         TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')) AS display_name,
         u.profile_image_url AS profile_pic_url
       FROM saved_providers sp
       LEFT JOIN users u ON u.id = sp.provider_id
       WHERE sp.user_id = $1
       ORDER BY sp.created_at DESC`,
      [uid],
    );

    return res.json({
      saved: rows.rows.map(r => ({
        providerId:    r.provider_id,
        platform:      r.platform,
        savedAt:       r.created_at,
        displayName:   r.display_name?.trim() || null,
        profilePicUrl: r.profile_pic_url || null,
      })),
    });
  } catch (err) {
    logger.error('[SavedProviders] GET failed', { uid, err });
    return res.status(500).json({ error: 'Failed to load saved providers' });
  }
});

// ─── POST /api/saved-providers/:providerId ───────────────────────────────────
router.post('/saved-providers/:providerId', async (req: Request, res: Response) => {
  const uid = getUid(req);
  if (!uid) return res.status(401).json({ error: 'Unauthorized' });

  const { providerId } = req.params;
  const { platform } = req.body;

  try {
    // Verify the provider actually exists in provider_profiles
    const [providerExists] = await db
      .select({ userId: providerProfiles.userId })
      .from(providerProfiles)
      .where(eq(providerProfiles.userId, providerId));

    if (!providerExists) {
      return res.status(404).json({ error: 'Provider not found' });
    }

    // Upsert — ON CONFLICT on unique constraint (user_id, provider_id)
    await db.execute(sql`
      INSERT INTO saved_providers (user_id, provider_id, platform)
      VALUES (${uid}, ${providerId}, ${platform ?? null})
      ON CONFLICT ON CONSTRAINT uq_saved_provider_pair DO NOTHING
    `);
    return res.json({ saved: true, providerId });
  } catch (err) {
    logger.error('[SavedProviders] POST failed', { uid, providerId, err });
    return res.status(500).json({ error: 'Failed to save provider' });
  }
});

// ─── DELETE /api/saved-providers/:providerId ─────────────────────────────────
router.delete('/saved-providers/:providerId', async (req: Request, res: Response) => {
  const uid = getUid(req);
  if (!uid) return res.status(401).json({ error: 'Unauthorized' });

  const { providerId } = req.params;

  try {
    await db
      .delete(savedProviders)
      .where(
        and(
          eq(savedProviders.userId, uid),
          eq(savedProviders.providerId, providerId),
        ),
      );
    return res.json({ saved: false, providerId });
  } catch (err) {
    logger.error('[SavedProviders] DELETE failed', { uid, providerId, err });
    return res.status(500).json({ error: 'Failed to unsave provider' });
  }
});

// ─── GET /api/admin/providers/trust-overview ─────────────────────────────────
// Admin-only: list all providers sorted by trust score with badge/metric summary.
router.get('/admin/providers/trust-overview', async (req: Request, res: Response) => {
  const uid = getUid(req);
  if (!uid || uid !== SUPER_ADMIN_UID) {
    return res.status(403).json({ error: 'Forbidden — admin only' });
  }

  try {
    const result = await db.execute(sql`
      SELECT
        pp.user_id                    AS "userId",
        TRIM(COALESCE(u.first_name,'') || ' ' || COALESCE(u.last_name,'')) AS "displayName",
        pp.trust_score                AS "trustScore",
        pp.acceptance_rate_pct        AS "acceptanceRatePct",
        pp.completion_rate_pct        AS "completionRatePct",
        pp.cancellation_rate_pct      AS "cancellationRatePct",
        pp.response_rate_pct          AS "responseRatePct",
        pp.completed_bookings_count   AS "completedBookingsCount",
        pp.rating_avg                 AS "ratingAvg",
        pp.rating_count               AS "ratingCount",
        pp.badges                     AS "badges",
        pp.background_check_status    AS "backgroundCheckStatus",
        pp.trust_metrics_updated_at   AS "trustMetricsUpdatedAt"
      FROM provider_profiles pp
      LEFT JOIN users u ON u.id = pp.user_id
      ORDER BY pp.trust_score DESC NULLS LAST, pp.completed_bookings_count DESC NULLS LAST
      LIMIT 200
    `);

    return res.json({
      providers: (result.rows as any[]).map((r: any) => ({
        ...r,
        ratingAvg: r.ratingAvg !== null ? Number(r.ratingAvg) : null,
        badges: Array.isArray(r.badges) ? r.badges : [],
      })),
      total: result.rows.length,
    });
  } catch (err) {
    logger.error('[TrustOverview] Failed', { err });
    return res.status(500).json({ error: 'Failed to load trust overview' });
  }
});

// ─── PATCH /api/admin/providers/:userId/badges ────────────────────────────────
// Admin-only: grant or revoke verified badges on a provider profile.
// Body: { add?: string[], remove?: string[] }
// Valid badge IDs: id_verified | insured | licensed | background_check
router.patch('/admin/providers/:userId/badges', async (req: Request, res: Response) => {
  const uid = getUid(req);
  if (!uid || uid !== SUPER_ADMIN_UID) {
    return res.status(403).json({ error: 'Forbidden — admin only' });
  }

  const { userId } = req.params;
  const { add = [], remove = [] } = req.body as { add?: string[]; remove?: string[] };

  const allowedIds = [...VERIFIED_BADGE_IDS];
  const invalidAdd = (add as string[]).filter(b => !allowedIds.includes(b as any));
  const invalidRemove = (remove as string[]).filter(b => !allowedIds.includes(b as any));
  if (invalidAdd.length || invalidRemove.length) {
    return res.status(400).json({
      error: 'Invalid badge IDs',
      invalidAdd,
      invalidRemove,
      allowed: allowedIds,
    });
  }

  try {
    const [profile] = await db
      .select({ badges: providerProfiles.badges })
      .from(providerProfiles)
      .where(eq(providerProfiles.userId, userId));

    if (!profile) {
      return res.status(404).json({ error: 'Provider not found' });
    }

    const current: string[] = Array.isArray(profile.badges) ? (profile.badges as string[]) : [];
    const next = Array.from(new Set([
      ...current.filter(b => !(remove as string[]).includes(b)),
      ...(add as string[]),
    ]));

    await db
      .update(providerProfiles)
      .set({ badges: next })
      .where(eq(providerProfiles.userId, userId));

    // Immediately refresh trust score to reflect badge change
    try {
      await refreshAndCacheProviderTrustMetrics(userId);
    } catch (_) {
      // Non-fatal — badge update succeeded even if score refresh fails
    }

    logger.info('[AdminBadges] Updated', { adminUid: uid, providerId: userId, added: add, removed: remove, badges: next });
    return res.json({ userId, badges: next });
  } catch (err) {
    logger.error('[AdminBadges] Failed', { userId, err });
    return res.status(500).json({ error: 'Failed to update badges' });
  }
});

// ─── POST /api/admin/providers/backfill-trust-metrics ────────────────────────
// Admin-only: refreshes trust metrics for all providers who are stale (> 6h) or
// have never been computed. Non-destructive — idempotent. Safe to re-run.
router.post('/admin/providers/backfill-trust-metrics', async (req: Request, res: Response) => {
  const uid = getUid(req);
  if (!uid || uid !== SUPER_ADMIN_UID) {
    return res.status(403).json({ error: 'Forbidden — admin only' });
  }

  try {
    logger.info('[TrustBackfill] Admin-triggered backfill started', { triggeredBy: uid });
    // Run async — respond immediately with 202 then let the work run
    const resultPromise = backfillAllProviderTrustMetrics();
    resultPromise.then(result => {
      logger.info('[TrustBackfill] Admin-triggered backfill complete', result);
    }).catch(err => {
      logger.error('[TrustBackfill] Admin-triggered backfill error', { err });
    });

    return res.status(202).json({ message: 'Backfill started — check server logs for progress' });
  } catch (err) {
    logger.error('[TrustBackfill] Failed to start', { err });
    return res.status(500).json({ error: 'Failed to start backfill' });
  }
});

// ─── GET /api/admin/ranking/overview ─────────────────────────────────────────
// Admin-only: list all providers sorted by effective ranking score.
router.get('/admin/ranking/overview', async (req: Request, res: Response) => {
  const uid = getUid(req);
  if (!uid || uid !== SUPER_ADMIN_UID) {
    return res.status(403).json({ error: 'Forbidden — admin only' });
  }

  try {
    const result = await db.execute(sql`
      SELECT
        pp.user_id                    AS "userId",
        TRIM(COALESCE(u.first_name,'') || ' ' || COALESCE(u.last_name,'')) AS "displayName",
        pp.ranking_score              AS "rankingScore",
        pp.ranking_override           AS "rankingOverride",
        COALESCE(pp.ranking_override, pp.ranking_score) AS "effectiveRankingScore",
        pp.ranking_boosted_until      AS "rankingBoostUntil",
        pp.trust_score                AS "trustScore",
        pp.rating_avg                 AS "ratingAvg",
        pp.rating_count               AS "ratingCount",
        pp.acceptance_rate_pct        AS "acceptanceRatePct",
        pp.completion_rate_pct        AS "completionRatePct",
        pp.cancellation_rate_pct      AS "cancellationRatePct",
        pp.completed_bookings_count   AS "completedBookingsCount",
        pp.badges                     AS "badges",
        pp.ranking_updated_at         AS "rankingUpdatedAt"
      FROM provider_profiles pp
      LEFT JOIN users u ON u.id = pp.user_id
      ORDER BY COALESCE(pp.ranking_override, pp.ranking_score) DESC NULLS LAST, pp.rating_avg DESC NULLS LAST
      LIMIT 200
    `);

    return res.json({
      providers: (result.rows as any[]).map((r: any) => ({
        ...r,
        ratingAvg: r.ratingAvg !== null ? Number(r.ratingAvg) : null,
        badges: Array.isArray(r.badges) ? r.badges : [],
        tier: rankingTier(r.effectiveRankingScore),
        boostActive: r.rankingBoostUntil ? new Date() < new Date(r.rankingBoostUntil) : false,
      })),
      total: result.rows.length,
    });
  } catch (err) {
    logger.error('[RankingOverview] Failed', { err });
    return res.status(500).json({ error: 'Failed to load ranking overview' });
  }
});

// ─── PATCH /api/admin/providers/:userId/ranking ───────────────────────────────
// Admin-only: set or clear ranking_override + temporary boost.
// Body: { override?: number | null, boostDays?: number | null }
//   override: 0–100 integer — replaces computed score entirely (null clears)
//   boostDays: integer — extends boost until N days from now (null clears)
router.patch('/admin/providers/:userId/ranking', async (req: Request, res: Response) => {
  const uid = getUid(req);
  if (!uid || uid !== SUPER_ADMIN_UID) {
    return res.status(403).json({ error: 'Forbidden — admin only' });
  }

  const { userId } = req.params;
  const { override, boostDays } = req.body as {
    override?: number | null;
    boostDays?: number | null;
  };

  // Validate override
  if (override !== undefined && override !== null) {
    const v = Number(override);
    if (isNaN(v) || v < 0 || v > 100) {
      return res.status(400).json({ error: 'override must be 0–100 or null' });
    }
  }

  // Validate boostDays
  if (boostDays !== undefined && boostDays !== null) {
    const d = Number(boostDays);
    if (isNaN(d) || d < 0 || d > 365) {
      return res.status(400).json({ error: 'boostDays must be 0–365 or null' });
    }
  }

  const [existing] = await db
    .select({ userId: providerProfiles.userId })
    .from(providerProfiles)
    .where(eq(providerProfiles.userId, userId));

  if (!existing) {
    return res.status(404).json({ error: 'Provider not found' });
  }

  const boostUntil = boostDays === null
    ? null
    : boostDays !== undefined
      ? new Date(Date.now() + Number(boostDays) * 86_400_000)
      : undefined; // undefined = don't change

  const updatePayload: Record<string, any> = {};
  if (override !== undefined) updatePayload.rankingOverride = override === null ? null : Number(override);
  if (boostUntil !== undefined) updatePayload.rankingBoostUntil = boostUntil;

  if (Object.keys(updatePayload).length > 0) {
    await db
      .update(providerProfiles)
      .set(updatePayload as any)
      .where(eq(providerProfiles.userId, userId));
  }

  // Recompute ranking score to reflect the new override/boost
  const newScore = await refreshAndCacheProviderRankingScore(userId);

  logger.info('[AdminRanking] Override applied', {
    adminUid: uid, providerId: userId, override, boostDays, newScore,
  });

  return res.json({ userId, rankingScore: newScore, override, boostDays });
});

// ─── DELETE /api/admin/providers/:userId/ranking-override ─────────────────────
// Admin-only: clear ranking override and boost, revert to computed score.
router.delete('/admin/providers/:userId/ranking-override', async (req: Request, res: Response) => {
  const uid = getUid(req);
  if (!uid || uid !== SUPER_ADMIN_UID) {
    return res.status(403).json({ error: 'Forbidden — admin only' });
  }

  const { userId } = req.params;

  await db
    .update(providerProfiles)
    .set({ rankingOverride: null, rankingBoostUntil: null } as any)
    .where(eq(providerProfiles.userId, userId));

  const newScore = await refreshAndCacheProviderRankingScore(userId);

  logger.info('[AdminRanking] Override cleared', { adminUid: uid, providerId: userId, newScore });
  return res.json({ userId, rankingScore: newScore, override: null });
});

// ─── POST /api/admin/ranking/backfill ─────────────────────────────────────────
// Admin-only: recompute ranking_score for all stale providers.
router.post('/admin/ranking/backfill', async (req: Request, res: Response) => {
  const uid = getUid(req);
  if (!uid || uid !== SUPER_ADMIN_UID) {
    return res.status(403).json({ error: 'Forbidden — admin only' });
  }

  const resultPromise = backfillAllProviderRankingScores();
  resultPromise
    .then(r => logger.info('[RankingBackfill] Admin-triggered complete', r))
    .catch(err => logger.error('[RankingBackfill] Admin-triggered error', { err }));

  return res.status(202).json({ message: 'Ranking backfill started' });
});

export default router;
