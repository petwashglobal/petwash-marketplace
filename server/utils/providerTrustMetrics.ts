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
 *   acceptanceRatePct       — only shown when >= 5 total requests
 *   completionRatePct       — only shown when >= 3 confirmed bookings
 *   cancellationRatePct     — only shown when >= 3 confirmed bookings
 *   trustScore              — only shown when >= 5 total requests
 *
 * Trust Score formula (0–100):
 *   completionRatePct  × 0.30 → max 30 pts
 *   acceptanceRatePct  × 0.20 → max 20 pts
 *   responseRatePct    × 0.15 → max 15 pts
 *   repeatClientRate   × 0.15 → max 15 pts (repeat_client_count / completed × 100)
 *   verifiedBadges     × 5 ea → max 20 pts  (id_verified, insured, licensed, background_check)
 *   cancellationPenalty        → −15 if >20%, −8 if >10%, −3 if >5%
 */

import { db } from '../db';
import { bookingRequests, providerProfiles } from '@shared/schema';
import { eq, and, sql, count } from 'drizzle-orm';
import { logger } from '../lib/logger';

const MIN_BOOKINGS_FOR_RATE     = 5;
const MIN_BOOKINGS_FOR_TIME     = 5;
const MIN_REPEAT_THRESHOLD      = 2;
const MIN_ACCEPTANCE_THRESHOLD  = 5;
const MIN_COMPLETION_THRESHOLD  = 3;
const MIN_TRUST_SCORE_THRESHOLD = 5;

/** Verified badge IDs that count toward trust score (5 pts each, max 20) */
export const VERIFIED_BADGE_IDS = ['id_verified', 'insured', 'licensed', 'background_check'] as const;
export type VerifiedBadgeId = typeof VERIFIED_BADGE_IDS[number];

export interface ProviderTrustMetrics {
  completedBookingsCount: number;
  repeatClientCount: number | null;
  responseRatePct: number | null;
  avgResponseTimeMinutes: number | null;
  acceptanceRatePct: number | null;
  completionRatePct: number | null;
  cancellationRatePct: number | null;
  trustScore: number | null;
  isNew: boolean;
  lastActiveAt: Date | null;
  backgroundCheckStatus: string | null;
  hasFencedYard: boolean | null;
  hasNoPetsAtHome: boolean | null;
  badges: string[];
}

export async function computeProviderTrustMetrics(
  providerId: string,
): Promise<ProviderTrustMetrics> {
  try {
    // ── 1. Count completed bookings ─────────────────────────────────────────
    const [completedRow] = await db
      .select({ cnt: count() })
      .from(bookingRequests)
      .where(and(
        eq(bookingRequests.providerId, providerId),
        eq(bookingRequests.status, 'completed'),
      ));
    const completedBookingsCount = Number(completedRow?.cnt ?? 0);

    // ── 2. Repeat clients ───────────────────────────────────────────────────
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

    // ── 3. Total requests ───────────────────────────────────────────────────
    const [totalRequestsRow] = await db
      .select({ cnt: count() })
      .from(bookingRequests)
      .where(eq(bookingRequests.providerId, providerId));
    const totalRequests = Number(totalRequestsRow?.cnt ?? 0);

    // ── 4. Response rate (% of requests where provider took action) ─────────
    let responseRatePct: number | null = null;
    if (totalRequests >= MIN_BOOKINGS_FOR_RATE) {
      const respondedRows = await db.execute(sql`
        SELECT COUNT(*) AS cnt
        FROM booking_requests
        WHERE provider_id = ${providerId}
          AND status != 'pending'
      `);
      const responded = Number((respondedRows.rows[0] as any)?.cnt ?? 0);
      responseRatePct = Math.round((responded / totalRequests) * 100);
    }

    // ── 5. Average response time (minutes to first non-pending status) ──────
    let avgResponseTimeMinutes: number | null = null;
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
      if (!isNaN(raw) && raw > 0 && raw < 20160) {
        avgResponseTimeMinutes = Math.round(raw);
      }
    }

    // ── 6. Acceptance rate (% of requests that reached accepted/confirmed) ──
    let acceptanceRatePct: number | null = null;
    if (totalRequests >= MIN_ACCEPTANCE_THRESHOLD) {
      const acceptedRows = await db.execute(sql`
        SELECT COUNT(*) AS cnt
        FROM booking_requests
        WHERE provider_id = ${providerId}
          AND status = ANY(ARRAY['accepted','confirmed','in_progress','completed']::booking_request_status[])
      `);
      const accepted = Number((acceptedRows.rows[0] as any)?.cnt ?? 0);
      acceptanceRatePct = Math.round((accepted / totalRequests) * 100);
    }

    // ── 7. Completion rate (confirmed → completed vs cancelled) ─────────────
    let completionRatePct: number | null = null;
    let cancellationRatePct: number | null = null;

    const confirmedRows = await db.execute(sql`
      SELECT COUNT(*) AS cnt
      FROM booking_requests
      WHERE provider_id = ${providerId}
        AND status = ANY(ARRAY['confirmed','in_progress','completed','cancelled']::booking_request_status[])
    `);
    const confirmedTotal = Number((confirmedRows.rows[0] as any)?.cnt ?? 0);

    if (confirmedTotal >= MIN_COMPLETION_THRESHOLD) {
      const completedFromConfirmed = await db.execute(sql`
        SELECT COUNT(*) AS cnt
        FROM booking_requests
        WHERE provider_id = ${providerId}
          AND status = ANY(ARRAY['completed']::booking_request_status[])
      `);
      const completedCount = Number((completedFromConfirmed.rows[0] as any)?.cnt ?? 0);
      completionRatePct = Math.round((completedCount / confirmedTotal) * 100);

      // Provider-initiated cancellations (cancelled bookings where provider had confirmed)
      const cancelledRows = await db.execute(sql`
        SELECT COUNT(*) AS cnt
        FROM booking_requests
        WHERE provider_id = ${providerId}
          AND status = 'cancelled'
      `);
      const cancelledCount = Number((cancelledRows.rows[0] as any)?.cnt ?? 0);
      cancellationRatePct = Math.round((cancelledCount / confirmedTotal) * 100);
    }

    // ── 8. Fetch provider profile for badges, home setup, last active ───────
    const [profile] = await db
      .select({
        lastPresenceAt: providerProfiles.lastPresenceAt,
        backgroundCheckStatus: providerProfiles.backgroundCheckStatus,
        hasFencedYard: providerProfiles.hasFencedYard,
        hasNoPetsAtHome: providerProfiles.hasNoPetsAtHome,
        badges: providerProfiles.badges,
      })
      .from(providerProfiles)
      .where(eq(providerProfiles.userId, providerId));

    const badgeList: string[] = Array.isArray(profile?.badges) ? (profile.badges as string[]) : [];

    // Automatically include background_check badge if background check is approved
    if (profile?.backgroundCheckStatus === 'approved' && !badgeList.includes('background_check')) {
      badgeList.push('background_check');
    }

    // ── 9. Trust score ───────────────────────────────────────────────────────
    let trustScore: number | null = null;
    if (totalRequests >= MIN_TRUST_SCORE_THRESHOLD) {
      let score = 0;

      if (completionRatePct !== null)  score += completionRatePct * 0.30;
      if (acceptanceRatePct !== null)  score += acceptanceRatePct * 0.20;
      if (responseRatePct !== null)    score += responseRatePct * 0.15;

      // Repeat client rate component (0–100 scale)
      if (repeatClientCount !== null && completedBookingsCount > 0) {
        const repeatRate = Math.min((repeatClientCount / completedBookingsCount) * 100, 100);
        score += repeatRate * 0.15;
      }

      // Verified badges: 5 pts each, max 20 pts
      const verifiedCount = badgeList.filter(b => VERIFIED_BADGE_IDS.includes(b as VerifiedBadgeId)).length;
      score += Math.min(verifiedCount * 5, 20);

      // Cancellation penalty
      if (cancellationRatePct !== null) {
        if (cancellationRatePct > 20) score -= 15;
        else if (cancellationRatePct > 10) score -= 8;
        else if (cancellationRatePct > 5)  score -= 3;
      }

      trustScore = Math.max(0, Math.min(100, Math.round(score)));
    }

    return {
      completedBookingsCount,
      repeatClientCount,
      responseRatePct,
      avgResponseTimeMinutes,
      acceptanceRatePct,
      completionRatePct,
      cancellationRatePct,
      trustScore,
      isNew: completedBookingsCount < 3,
      lastActiveAt: profile?.lastPresenceAt ?? null,
      backgroundCheckStatus: profile?.backgroundCheckStatus ?? null,
      hasFencedYard: profile?.hasFencedYard ?? null,
      hasNoPetsAtHome: profile?.hasNoPetsAtHome ?? null,
      badges: badgeList,
    };
  } catch (err) {
    logger.error('[TrustMetrics] compute failed', { providerId, err });
    throw err;
  }
}

/**
 * Compute then persist results into provider_profiles cache columns.
 * Called after booking completion events and on nightly cron.
 */
export async function refreshAndCacheProviderTrustMetrics(
  providerId: string,
): Promise<ProviderTrustMetrics> {
  const metrics = await computeProviderTrustMetrics(providerId);

  await db
    .update(providerProfiles)
    .set({
      completedBookingsCount:  metrics.completedBookingsCount,
      repeatClientCount:       metrics.repeatClientCount ?? undefined,
      responseRatePct:         metrics.responseRatePct ?? undefined,
      avgResponseTimeMinutes:  metrics.avgResponseTimeMinutes ?? undefined,
      acceptanceRatePct:       metrics.acceptanceRatePct ?? undefined,
      completionRatePct:       metrics.completionRatePct ?? undefined,
      cancellationRatePct:     metrics.cancellationRatePct ?? undefined,
      trustScore:              metrics.trustScore ?? undefined,
      trustMetricsUpdatedAt:   new Date(),
    })
    .where(eq(providerProfiles.userId, providerId));

  return metrics;
}

/**
 * Backfill trust metrics for all providers who are stale or have never been computed.
 * Non-destructive, idempotent. Safe to re-run.
 */
export async function backfillAllProviderTrustMetrics(): Promise<{
  refreshed: number;
  skipped: number;
  errors: number;
  total: number;
}> {
  const SIX_HOURS = 6 * 60 * 60 * 1000;

  const allProviders = await db
    .select({
      userId: providerProfiles.userId,
      trustMetricsUpdatedAt: providerProfiles.trustMetricsUpdatedAt,
    })
    .from(providerProfiles);

  let refreshed = 0, skipped = 0, errors = 0;

  for (const p of allProviders) {
    const stale =
      !p.trustMetricsUpdatedAt ||
      Date.now() - p.trustMetricsUpdatedAt.getTime() > SIX_HOURS;

    if (!stale) { skipped++; continue; }

    try {
      await refreshAndCacheProviderTrustMetrics(p.userId);
      refreshed++;
    } catch (err) {
      errors++;
      logger.error('[TrustBackfill] Provider failed', { userId: p.userId, err });
    }
  }

  logger.info('[TrustBackfill] Complete', { refreshed, skipped, errors, total: allProviders.length });
  return { refreshed, skipped, errors, total: allProviders.length };
}

/** Format avg response time into a human-readable label. Returns null if time is null. */
export function formatResponseTime(minutes: number | null): string | null {
  if (minutes === null) return null;
  if (minutes < 60) return `~${Math.round(minutes)}m`;
  const hours = minutes / 60;
  if (hours < 24) return `~${Math.round(hours)}h`;
  return `~${Math.round(hours / 24)}d`;
}

/** Trust score tier label */
export function trustScoreTier(score: number | null): 'new' | 'rising' | 'trusted' | 'top' | null {
  if (score === null) return null;
  if (score < 40) return 'rising';
  if (score < 65) return 'trusted';
  if (score < 85) return 'trusted';
  return 'top';
}
