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
  bookingRequests,
  users,
} from '@shared/schema';
import { eq, and, or, sql, gte, lte, inArray, desc, count } from 'drizzle-orm';
import { logger } from '../lib/logger';
import {
  computeProviderTrustMetrics,
  refreshAndCacheProviderTrustMetrics,
  formatResponseTime,
} from '../utils/providerTrustMetrics';

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
      // ── Background check (real from backgroundCheckStatus field) ──
      hasBackgroundCheck: profile?.backgroundCheckStatus === 'approved',
      backgroundCheckStatus: profile?.backgroundCheckStatus ?? null,
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
    platform,
    minRating,
    maxPrice,
    minPrice,
    petType,
    availableThisWeek,
    backgroundCheckOnly,
    fencedYardOnly,
    noPetsAtHomeOnly,
    sortBy = 'rating',
    location,
    limit = '24',
    offset = '0',
  } = req.query as Record<string, string>;

  try {
    // Build WHERE conditions
    const conditions: any[] = [];

    if (minRating && Number(minRating) > 0) {
      conditions.push(
        gte(providerProfiles.ratingAvg, String(minRating)),
      );
    }
    if (availableThisWeek === 'true') {
      conditions.push(
        or(
          eq(providerProfiles.availabilityState, 'online'),
          eq(providerProfiles.availabilityState, 'available'),
        ),
      );
    }
    if (backgroundCheckOnly === 'true') {
      conditions.push(eq(providerProfiles.backgroundCheckStatus, 'approved'));
    }
    if (fencedYardOnly === 'true') {
      conditions.push(eq(providerProfiles.hasFencedYard, true));
    }
    if (noPetsAtHomeOnly === 'true') {
      conditions.push(eq(providerProfiles.hasNoPetsAtHome, true));
    }

    // Build ORDER BY
    let orderByClause;
    switch (sortBy) {
      case 'price':    orderByClause = sql`pp.rating_avg ASC`;   break; // placeholder until price in profile
      case 'reviews':  orderByClause = sql`pp.rating_count DESC`; break;
      case 'new':      orderByClause = sql`pp.created_at DESC`;  break;
      default:         orderByClause = sql`pp.rating_avg DESC`;  break; // 'rating' or 'distance'
    }

    const rows = await db.execute(sql`
      SELECT
        pp.user_id          AS "userId",
        u.first_name        AS "firstName",
        u.last_name         AS "lastName",
        pp.rating_avg       AS "ratingAvg",
        pp.rating_count     AS "ratingCount",
        pp.availability_state AS "availabilityState",
        pp.last_presence_at AS "lastPresenceAt",
        pp.background_check_status AS "backgroundCheckStatus",
        pp.has_fenced_yard  AS "hasFencedYard",
        pp.has_no_pets_at_home AS "hasNoPetsAtHome",
        pp.completed_bookings_count AS "completedBookingsCount",
        pp.repeat_client_count AS "repeatClientCount",
        pp.response_rate_pct AS "responseRatePct",
        pp.avg_response_time_minutes AS "avgResponseTimeMinutes",
        pp.created_at       AS "createdAt",
        -- Is provider saved by current user?
        CASE WHEN sp.id IS NOT NULL THEN true ELSE false END AS "isSavedByUser"
      FROM provider_profiles pp
      LEFT JOIN users u ON u.id = pp.user_id
      LEFT JOIN saved_providers sp
        ON sp.provider_id = pp.user_id AND sp.user_id = ${uid ?? ''}
      WHERE true
        ${conditions.length > 0 ? sql`AND ${sql.join(conditions, sql` AND `)}` : sql``}
      ORDER BY ${orderByClause}
      LIMIT ${Number(limit)}
      OFFSET ${Number(offset)}
    `);

    // Get saved provider IDs for this user
    let savedIds: string[] = [];
    if (uid) {
      const savedRows = await db
        .select({ providerId: savedProviders.providerId })
        .from(savedProviders)
        .where(eq(savedProviders.userId, uid));
      savedIds = savedRows.map(r => r.providerId);
    }

    const providers = (rows.rows as any[]).map(row => ({
      userId: row.userId,
      name: [row.firstName, row.lastName].filter(Boolean).join(' ') || null,
      ratingAvg: row.ratingAvg ? Number(row.ratingAvg) : null,
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
    // Upsert — ignore if already saved
    await db.execute(sql`
      INSERT INTO saved_providers (user_id, provider_id, platform)
      VALUES (${uid}, ${providerId}, ${platform ?? null})
      ON CONFLICT DO NOTHING
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

export default router;
