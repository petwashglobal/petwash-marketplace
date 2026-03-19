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
import { db } from '../db';
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
} from '../utils/providerTrustMetrics';

const SUPER_ADMIN_UID = 'vdiboz7IrUQEm2RbdO7VZLkBu552';

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
      // Use cached values
      metrics = {
        completedBookingsCount: profile.completedBookingsCount ?? 0,
        repeatClientCount: profile.repeatClientCount ?? null,
        responseRatePct: profile.responseRatePct ?? null,
        avgResponseTimeMinutes: profile.avgResponseTimeMinutes ?? null,
        isNew: (profile.completedBookingsCount ?? 0) < 3,
        lastActiveAt: profile.lastPresenceAt ?? null,
        backgroundCheckStatus: profile.backgroundCheckStatus ?? null,
        hasFencedYard: profile.hasFencedYard ?? null,
        hasNoPetsAtHome: profile.hasNoPetsAtHome ?? null,
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
      // ── Ratings (from provider_profiles, always shown) ──
      ratingAvg: profile?.ratingAvg ? Number(profile.ratingAvg) : null,
      ratingCount: profile?.ratingCount ?? null,
      // ── Trust metrics (null = hide in UI) ──
      completedBookingsCount: metrics.completedBookingsCount,
      repeatClientCount: metrics.repeatClientCount,         // null = hide
      responseRatePct: metrics.responseRatePct,             // null = hide
      avgResponseTimeMinutes: metrics.avgResponseTimeMinutes, // null = hide
      responseTimeLabel: formatResponseTime(metrics.avgResponseTimeMinutes), // null = hide
      isNew: metrics.isNew,
      // ── Background check — boolean only, never expose raw status string ──
      hasBackgroundCheck: profile?.backgroundCheckStatus === 'approved',
      // ── Home setup (null = provider hasn't filled this in yet) ──
      hasFencedYard: metrics.hasFencedYard,                 // null = hide
      hasNoPetsAtHome: metrics.hasNoPetsAtHome,             // null = hide
      // ── Availability (real from presence data) ──
      isAvailableNow,
      isAvailableThisWeek,
      lastActiveAt: metrics.lastActiveAt,
      // ── Provider account age ──
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
router.get('/providers/browse', async (req: Request, res: Response) => {
  const uid = getUid(req);

  const {
    minRating,
    availableThisWeek,
    backgroundCheckOnly,
    fencedYardOnly,
    noPetsAtHomeOnly,
    sortBy = 'rating',
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
    rating:   'pp.rating_avg DESC NULLS LAST',
    reviews:  'pp.rating_count DESC NULLS LAST',
    new:      'pp.created_at DESC',
    bookings: 'pp.completed_bookings_count DESC NULLS LAST',
  };
  const orderBy = orderByMap[sortBy] ?? orderByMap.rating;

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
    const { pool } = await import('../db');
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
    const rows = await db
      .select()
      .from(savedProviders)
      .where(eq(savedProviders.userId, uid))
      .orderBy(desc(savedProviders.createdAt));

    return res.json({ saved: rows.map(r => ({ providerId: r.providerId, platform: r.platform, savedAt: r.createdAt })) });
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

export default router;
