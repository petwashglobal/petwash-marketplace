/**
 * PROVIDER RANKING — Smart matching score (0–100).
 *
 * Layered on top of the trust score. Factors:
 *   trust_score         × 0.40  → max 40 pts  (null → 0, with new-provider floor)
 *   avg_rating (0–5)    × 0.25  → max 25 pts  (rating/5 × 100 × 0.25)
 *   completion_rate_pct × 0.15  → max 15 pts
 *   recency_boost              → max 10 pts  (last active ≤7d=10, ≤14d=6, ≤30d=3, else 0)
 *   profile_completeness       → max 10 pts  (bio=3, avatar=3, working hours=4)
 *
 * Penalties (applied after base):
 *   acceptance_rate_pct < 50%    → −10
 *   cancellation_rate_pct > 20%  → −20
 *   cancellation_rate_pct > 10%  → −10
 *   cancellation_rate_pct > 5%   → −5
 *
 * New provider floor:
 *   completedBookingsCount = 0 → base of 50 (gets listed, never tops experienced providers)
 *
 * Admin controls:
 *   ranking_override (if set) → replaces computed score entirely
 *   ranking_boosted_until     → if now < expiry, adds +15 bonus (capped at 100)
 */

import { db } from '../db';
import { providerProfiles } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';
import { logger } from '../lib/logger';

export interface RankingInput {
  trustScore: number | null;
  ratingAvg: number | string | null;
  completionRatePct: number | null;
  cancellationRatePct: number | null;
  acceptanceRatePct: number | null;
  completedBookingsCount: number | null;
  lastPresenceAt: Date | null;
  bio: string | null;
  rankingOverride: number | null;
  rankingBoostUntil: Date | null;
  // profile completeness hints
  avatarUrl?: string | null;
  workingHours?: unknown;
}

export function computeRankingScore(input: RankingInput): number {
  // ── Admin override takes full precedence ────────────────────────────────────
  if (input.rankingOverride !== null && input.rankingOverride !== undefined) {
    let score = input.rankingOverride;
    // Boost still applies on top of override
    if (input.rankingBoostUntil && new Date() < input.rankingBoostUntil) {
      score = Math.min(100, score + 15);
    }
    return Math.max(0, Math.min(100, score));
  }

  const isNew = !input.completedBookingsCount || input.completedBookingsCount === 0;

  // ── New provider: use flat floor so they appear mid-list ────────────────────
  if (isNew) {
    let newScore = 50;
    // Profile completeness bonus still applies
    if (input.bio && input.bio.trim().length > 20) newScore += 3;
    if (input.avatarUrl) newScore += 2;
    // Boost
    if (input.rankingBoostUntil && new Date() < input.rankingBoostUntil) {
      newScore = Math.min(100, newScore + 15);
    }
    return Math.max(0, Math.min(100, newScore));
  }

  let score = 0;

  // ── Trust score component (40%) ─────────────────────────────────────────────
  const trust = input.trustScore ?? 0;
  score += trust * 0.40;

  // ── Rating component (25%) — rating 0–5 normalised to 0–100 ─────────────────
  const rating = typeof input.ratingAvg === 'string'
    ? parseFloat(input.ratingAvg)
    : (input.ratingAvg ?? 0);
  score += Math.min(rating / 5, 1) * 100 * 0.25;

  // ── Completion rate component (15%) ─────────────────────────────────────────
  if (input.completionRatePct !== null) {
    score += input.completionRatePct * 0.15;
  }

  // ── Recency boost (max 10) ───────────────────────────────────────────────────
  if (input.lastPresenceAt) {
    const daysSince = (Date.now() - input.lastPresenceAt.getTime()) / 86_400_000;
    if (daysSince <= 7)  score += 10;
    else if (daysSince <= 14) score += 6;
    else if (daysSince <= 30) score += 3;
  }

  // ── Profile completeness (max 10) ────────────────────────────────────────────
  if (input.bio && input.bio.trim().length > 20) score += 3;
  if (input.avatarUrl) score += 3;
  const wh = input.workingHours as Record<string, { active: boolean }> | null;
  const hasWorkingHours = wh && Object.values(wh).some(d => d?.active);
  if (hasWorkingHours) score += 4;

  // ── Penalties ────────────────────────────────────────────────────────────────
  if (input.acceptanceRatePct !== null && input.acceptanceRatePct < 50)  score -= 10;
  if (input.cancellationRatePct !== null) {
    if (input.cancellationRatePct > 20)  score -= 20;
    else if (input.cancellationRatePct > 10) score -= 10;
    else if (input.cancellationRatePct > 5)  score -= 5;
  }

  // ── Admin boost ──────────────────────────────────────────────────────────────
  if (input.rankingBoostUntil && new Date() < input.rankingBoostUntil) {
    score += 15;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

export async function refreshAndCacheProviderRankingScore(
  providerId: string,
): Promise<number> {
  const [row] = await db
    .select({
      trustScore: providerProfiles.trustScore,
      ratingAvg: providerProfiles.ratingAvg,
      completionRatePct: providerProfiles.completionRatePct,
      cancellationRatePct: providerProfiles.cancellationRatePct,
      acceptanceRatePct: providerProfiles.acceptanceRatePct,
      completedBookingsCount: providerProfiles.completedBookingsCount,
      lastPresenceAt: providerProfiles.lastPresenceAt,
      bio: providerProfiles.bio,
      rankingOverride: providerProfiles.rankingOverride,
      rankingBoostUntil: providerProfiles.rankingBoostUntil,
      workingHours: providerProfiles.workingHours,
    })
    .from(providerProfiles)
    .where(eq(providerProfiles.userId, providerId));

  if (!row) {
    logger.warn('[Ranking] Provider not found', { providerId });
    return 0;
  }

  const score = computeRankingScore({
    trustScore: row.trustScore,
    ratingAvg: row.ratingAvg,
    completionRatePct: row.completionRatePct,
    cancellationRatePct: row.cancellationRatePct,
    acceptanceRatePct: row.acceptanceRatePct,
    completedBookingsCount: row.completedBookingsCount,
    lastPresenceAt: row.lastPresenceAt,
    bio: row.bio,
    rankingOverride: row.rankingOverride,
    rankingBoostUntil: row.rankingBoostUntil,
    workingHours: row.workingHours,
  });

  await db
    .update(providerProfiles)
    .set({ rankingScore: score, rankingUpdatedAt: new Date() })
    .where(eq(providerProfiles.userId, providerId));

  return score;
}

export async function backfillAllProviderRankingScores(): Promise<{
  refreshed: number;
  skipped: number;
  errors: number;
  total: number;
}> {
  const SIX_HOURS = 6 * 60 * 60 * 1000;

  const allProviders = await db
    .select({
      userId: providerProfiles.userId,
      rankingUpdatedAt: providerProfiles.rankingUpdatedAt,
    })
    .from(providerProfiles);

  let refreshed = 0, skipped = 0, errors = 0;

  for (const p of allProviders) {
    const stale =
      !p.rankingUpdatedAt ||
      Date.now() - p.rankingUpdatedAt.getTime() > SIX_HOURS;

    if (!stale) { skipped++; continue; }

    try {
      await refreshAndCacheProviderRankingScore(p.userId);
      refreshed++;
    } catch (err) {
      errors++;
      logger.error('[RankingBackfill] Failed', { userId: p.userId, err });
    }
  }

  logger.info('[RankingBackfill] Complete', { refreshed, skipped, errors, total: allProviders.length });
  return { refreshed, skipped, errors, total: allProviders.length };
}

/** Tier label for UI badge display */
export function rankingTier(score: number | null): 'new' | 'rising' | 'trusted' | 'top' | null {
  if (score === null || score === undefined) return null;
  if (score < 50) return 'new';
  if (score < 65) return 'rising';
  if (score < 80) return 'trusted';
  return 'top';
}
