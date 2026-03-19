/**
 * PROVIDER TRUST METRICS — Real data only.
 *
 * Computes metrics from actual booking_requests rows.
 * Returns null for any metric when there is insufficient real data.
 * NEVER invent or estimate — null means "we don't know yet".
 *
 * Minimum thresholds before publishing a metric:
 *   completedBookingsCount  — always shown (0 is valid)
 *   repeatClientCount       — only shown when completedBookingsCount >= 2
 *   responseRatePct         — only shown when >= 5 total incoming requests
 *   avgResponseTimeMinutes  — only shown when >= 5 responded bookings
 */

import { db } from '../db';
import { bookingRequests, providerProfiles } from '@shared/schema';
import { eq, and, sql, count, countDistinct } from 'drizzle-orm';
import { logger } from '../lib/logger';

const MIN_BOOKINGS_FOR_RATE  = 5;  // need 5+ requests before showing response rate
const MIN_BOOKINGS_FOR_TIME  = 5;  // need 5+ responses before showing avg response time
const MIN_REPEAT_THRESHOLD   = 2;  // need 2+ completed bookings before showing repeat count

export interface ProviderTrustMetrics {
  completedBookingsCount: number;        // always real (0 = new provider)
  repeatClientCount: number | null;      // null = below threshold
  responseRatePct: number | null;        // null = below threshold
  avgResponseTimeMinutes: number | null; // null = below threshold
  isNew: boolean;                        // true if completedBookingsCount < 3
  lastActiveAt: Date | null;             // from providerProfiles.lastPresenceAt
  backgroundCheckStatus: string | null;  // 'approved' | 'pending' | null
  hasFencedYard: boolean | null;
  hasNoPetsAtHome: boolean | null;
}

export async function computeProviderTrustMetrics(
  providerId: string,
): Promise<ProviderTrustMetrics> {
  try {
    // ── 1. Count completed bookings ─────────────────────────────────────────
    const [completedRow] = await db
      .select({ cnt: count() })
      .from(bookingRequests)
      .where(
        and(
          eq(bookingRequests.providerId, providerId),
          eq(bookingRequests.status, 'completed'),
        ),
      );
    const completedBookingsCount = Number(completedRow?.cnt ?? 0);

    // ── 2. Repeat clients — distinct owners who booked ≥2 completed times ──
    // We use a subquery: count(ownerId) grouped by ownerId, then count those with cnt >= 2
    let repeatClientCount: number | null = null;
    if (completedBookingsCount >= MIN_REPEAT_THRESHOLD) {
      const repeatRows = await db.execute(sql`
        SELECT COUNT(*) AS cnt
        FROM (
          SELECT owner_id
          FROM booking_requests
          WHERE provider_id = ${providerId}
            AND status = 'completed'
          GROUP BY owner_id
          HAVING COUNT(*) >= 2
        ) sub
      `);
      repeatClientCount = Number((repeatRows.rows[0] as any)?.cnt ?? 0);
    }

    // ── 3. Response rate ─────────────────────────────────────────────────────
    // Defined as: % of incoming booking requests where the provider responded
    // within 24 hours (status changed from 'pending' to anything else within 24h).
    // We detect "responded" by checking provider_response IS NOT NULL
    // OR status != 'pending' AND the first status_history entry after pending
    // has a timestamp within 24h of created_at.
    //
    // Simpler safe approach: count requests where status != 'pending'
    // as "responded", then compute rate. This isn't perfect but is real.
    let responseRatePct: number | null = null;
    let avgResponseTimeMinutes: number | null = null;

    const [totalRequestsRow] = await db
      .select({ cnt: count() })
      .from(bookingRequests)
      .where(eq(bookingRequests.providerId, providerId));
    const totalRequests = Number(totalRequestsRow?.cnt ?? 0);

    if (totalRequests >= MIN_BOOKINGS_FOR_RATE) {
      // Count requests that left 'pending' state (provider took action)
      const respondedRows = await db.execute(sql`
        SELECT COUNT(*) AS cnt
        FROM booking_requests
        WHERE provider_id = ${providerId}
          AND status != 'pending'
      `);
      const responded = Number((respondedRows.rows[0] as any)?.cnt ?? 0);
      responseRatePct = Math.round((responded / totalRequests) * 100);
    }

    // ── 4. Average response time ─────────────────────────────────────────────
    // Extract the timestamp of the first non-pending status from status_history JSONB
    // status_history is [{status, timestamp, note}, ...]
    if (totalRequests >= MIN_BOOKINGS_FOR_TIME) {
      const timeRows = await db.execute(sql`
        SELECT
          AVG(
            EXTRACT(EPOCH FROM (
              (elem->>'timestamp')::timestamptz - created_at
            )) / 60
          ) AS avg_minutes
        FROM booking_requests,
          LATERAL (
            SELECT elem
            FROM jsonb_array_elements(status_history::jsonb) elem
            WHERE elem->>'status' != 'pending'
            ORDER BY (elem->>'timestamp')::timestamptz
            LIMIT 1
          ) first_response
        WHERE provider_id = ${providerId}
          AND status != 'pending'
          AND jsonb_array_length(status_history::jsonb) > 0
      `);
      const raw = Number((timeRows.rows[0] as any)?.avg_minutes);
      if (!isNaN(raw) && raw > 0 && raw < 20160) { // cap at 2 weeks
        avgResponseTimeMinutes = Math.round(raw);
      }
    }

    // ── 5. Fetch provider profile for home setup & last active ───────────────
    const [profile] = await db
      .select({
        lastPresenceAt: providerProfiles.lastPresenceAt,
        backgroundCheckStatus: providerProfiles.backgroundCheckStatus,
        hasFencedYard: providerProfiles.hasFencedYard,
        hasNoPetsAtHome: providerProfiles.hasNoPetsAtHome,
      })
      .from(providerProfiles)
      .where(eq(providerProfiles.userId, providerId));

    return {
      completedBookingsCount,
      repeatClientCount,
      responseRatePct,
      avgResponseTimeMinutes,
      isNew: completedBookingsCount < 3,
      lastActiveAt: profile?.lastPresenceAt ?? null,
      backgroundCheckStatus: profile?.backgroundCheckStatus ?? null,
      hasFencedYard: profile?.hasFencedYard ?? null,
      hasNoPetsAtHome: profile?.hasNoPetsAtHome ?? null,
    };
  } catch (err) {
    logger.error('[TrustMetrics] compute failed', { providerId, err });
    throw err;
  }
}

/**
 * Compute, then persist results back into provider_profiles cache columns.
 * Called after booking completion and on nightly cron.
 */
export async function refreshAndCacheProviderTrustMetrics(
  providerId: string,
): Promise<ProviderTrustMetrics> {
  const metrics = await computeProviderTrustMetrics(providerId);

  await db
    .update(providerProfiles)
    .set({
      completedBookingsCount: metrics.completedBookingsCount,
      repeatClientCount: metrics.repeatClientCount ?? undefined,
      responseRatePct: metrics.responseRatePct ?? undefined,
      avgResponseTimeMinutes: metrics.avgResponseTimeMinutes ?? undefined,
      trustMetricsUpdatedAt: new Date(),
    })
    .where(eq(providerProfiles.userId, providerId));

  return metrics;
}

/** Format response time for display: "< 1 hour", "~2 hours", "< 1 day" */
export function formatResponseTime(minutes: number | null): string | null {
  if (minutes === null) return null;
  if (minutes < 60)  return `< 1 hour`;
  if (minutes < 120) return `~1 hour`;
  if (minutes < 1440) return `~${Math.round(minutes / 60)} hours`;
  return `~1 day`;
}

/**
 * Backfill trust metrics for all providers who have never had metrics computed
 * (trustMetricsUpdatedAt IS NULL) or whose metrics are stale (> 6h old).
 *
 * Called once on startup (non-blocking) and can be triggered via admin endpoint.
 * Returns { refreshed, skipped, errors } counts.
 */
export async function backfillAllProviderTrustMetrics(): Promise<{
  refreshed: number; skipped: number; errors: number;
}> {
  const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
  const cutoff = new Date(Date.now() - SIX_HOURS_MS);

  // Fetch all providers who need a refresh
  const staleProviders = await db
    .select({ userId: providerProfiles.userId })
    .from(providerProfiles)
    .where(
      sql`${providerProfiles.trustMetricsUpdatedAt} IS NULL
        OR ${providerProfiles.trustMetricsUpdatedAt} < ${cutoff}`
    );

  let refreshed = 0;
  let skipped   = 0;
  let errors    = 0;

  for (const { userId } of staleProviders) {
    try {
      await refreshAndCacheProviderTrustMetrics(userId);
      refreshed++;
    } catch (err) {
      logger.warn('[TrustBackfill] Failed for provider', { userId, err });
      errors++;
    }
  }

  logger.info('[TrustBackfill] Complete', { refreshed, skipped, errors, total: staleProviders.length });
  return { refreshed, skipped, errors };
}
