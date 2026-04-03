/**
 * CUSTOMER INTELLIGENCE SERVICE
 * PETWASH SYSTEM INTELLIGENCE SPEC — Customer Trust & Behavior Scoring
 *
 * Computes and persists trust scores + behavior scores for customers
 * based on their booking history, cancellation rate, and engagement.
 *
 * Scores:
 *   trustScore  0-100  (50 = neutral, higher = more trustworthy)
 *   behaviorScore 0-100 (measures engagement depth and recency)
 *   riskLevel   0-100  (inverse of trust — used for friction logic)
 *
 * When to call recomputeCustomerProfile():
 *   - booking.completed
 *   - booking.cancelled
 *   - user first signs in (authenticated state)
 */

import { db } from '../db';
import { users, userIntelligenceProfiles, bookingRequests } from '../../shared/schema';
import { eq, count, sql, and } from 'drizzle-orm';
import { logger } from '../lib/logger';

// ── Pure scoring functions (spec §5) ────────────────────────────────────────

export function calculateCustomerTrustScore(input: {
  cancellationRate: number;
  completedBookings: number;
  noShowCount?: number;
}): number {
  let score = 50;
  score += Math.min(input.completedBookings * 1.5, 25);
  score -= Math.min(input.cancellationRate * 50, 25);
  score -= Math.min((input.noShowCount ?? 0) * 10, 20);
  return Math.max(0, Math.min(100, Math.round(score * 100) / 100));
}

export function calculateBehaviorScore(input: {
  bookingHistoryCount: number;
  repeatUsage?: number;
  recentActivityDaysAgo?: number;
}): number {
  let score = 40;
  score += Math.min(input.bookingHistoryCount * 2, 30);
  score += Math.min((input.repeatUsage ?? 0) * 3, 20);

  const daysAgo = input.recentActivityDaysAgo ?? 999;
  if (daysAgo <= 7)  score += 10;
  if (daysAgo > 30)  score -= 10;

  return Math.max(0, Math.min(100, Math.round(score * 100) / 100));
}

export function calculateRiskLevel(trustScore: number): number {
  return Math.max(0, Math.min(100, Math.round((100 - trustScore) * 100) / 100));
}

// ── DB operations ────────────────────────────────────────────────────────────

export async function getOrCreateIntelligenceProfile(
  userId: string,
  userType: 'customer' | 'provider' | 'admin' = 'customer',
) {
  const [existing] = await db
    .select()
    .from(userIntelligenceProfiles)
    .where(eq(userIntelligenceProfiles.userId, userId))
    .limit(1);

  if (existing) return existing;

  const [created] = await db
    .insert(userIntelligenceProfiles)
    .values({
      userId,
      userType,
      trustScore: '50',
      behaviorScore: '50',
      riskLevel: '50',
      bookingHistoryCount: 0,
      cancellationRate: '0',
      noShowCount: 0,
      repeatUsageCount: 0,
      preferences: {},
    })
    .onConflictDoNothing()
    .returning();

  if (created) return created;

  const [row] = await db
    .select()
    .from(userIntelligenceProfiles)
    .where(eq(userIntelligenceProfiles.userId, userId))
    .limit(1);

  return row;
}

/**
 * Full recompute from live DB data — call after any booking lifecycle change.
 */
export async function recomputeCustomerProfile(userId: string): Promise<void> {
  try {
    const completedResult = await db
      .select({ cnt: count() })
      .from(bookingRequests)
      .where(and(
        eq(bookingRequests.ownerId, userId),
        eq(bookingRequests.status, 'completed'),
      ));

    const cancelledResult = await db
      .select({ cnt: count() })
      .from(bookingRequests)
      .where(and(
        eq(bookingRequests.ownerId, userId),
        eq(bookingRequests.status, 'cancelled'),
      ));

    const totalResult = await db
      .select({ cnt: count() })
      .from(bookingRequests)
      .where(eq(bookingRequests.ownerId, userId));

    const completedBookings = Number(completedResult[0]?.cnt ?? 0);
    const cancelledBookings = Number(cancelledResult[0]?.cnt ?? 0);
    const totalBookings     = Number(totalResult[0]?.cnt ?? 0);

    const cancellationRate = totalBookings > 0
      ? cancelledBookings / totalBookings
      : 0;

    const lastBookingResult = await db
      .select({ updatedAt: bookingRequests.updatedAt })
      .from(bookingRequests)
      .where(eq(bookingRequests.ownerId, userId))
      .orderBy(sql`${bookingRequests.updatedAt} DESC`)
      .limit(1);

    const lastActivity = lastBookingResult[0]?.updatedAt;
    const recentActivityDaysAgo = lastActivity
      ? Math.floor((Date.now() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24))
      : undefined;

    const repeatUsageResult = await db
      .select({ providerId: bookingRequests.providerId, cnt: count() })
      .from(bookingRequests)
      .where(eq(bookingRequests.ownerId, userId))
      .groupBy(bookingRequests.providerId);

    const repeatUsageCount = repeatUsageResult.filter(r => Number(r.cnt) > 1).length;

    const trustScore = calculateCustomerTrustScore({
      cancellationRate,
      completedBookings,
    });

    const behaviorScore = calculateBehaviorScore({
      bookingHistoryCount: totalBookings,
      repeatUsage: repeatUsageCount,
      recentActivityDaysAgo,
    });

    const riskLevel = calculateRiskLevel(trustScore);

    await db
      .insert(userIntelligenceProfiles)
      .values({
        userId,
        userType: 'customer',
        trustScore:         trustScore.toFixed(2),
        behaviorScore:      behaviorScore.toFixed(2),
        riskLevel:          riskLevel.toFixed(2),
        bookingHistoryCount: totalBookings,
        cancellationRate:   cancellationRate.toFixed(4),
        noShowCount:        0,
        repeatUsageCount,
        recentActivityDaysAgo: recentActivityDaysAgo ?? null,
        preferences:        {},
      })
      .onConflictDoUpdate({
        target: userIntelligenceProfiles.userId,
        set: {
          trustScore:          trustScore.toFixed(2),
          behaviorScore:       behaviorScore.toFixed(2),
          riskLevel:           riskLevel.toFixed(2),
          bookingHistoryCount: totalBookings,
          cancellationRate:    cancellationRate.toFixed(4),
          repeatUsageCount,
          recentActivityDaysAgo: recentActivityDaysAgo ?? null,
          lastComputedAt:      new Date(),
          updatedAt:           new Date(),
        },
      });

    logger.info('[CustomerIntelligence] Profile recomputed', {
      userId, trustScore, behaviorScore, riskLevel, totalBookings,
    });
  } catch (err: any) {
    logger.error('[CustomerIntelligence] Recompute failed', { userId, err: err.message });
  }
}

// ── Customer journey state machine ───────────────────────────────────────────

export type CustomerJourneyState =
  | 'visitor'
  | 'browsing'
  | 'authenticated'
  | 'ready_to_book'
  | 'booked';

const JOURNEY_ORDER: CustomerJourneyState[] = [
  'visitor', 'browsing', 'authenticated', 'ready_to_book', 'booked',
];

/**
 * Advance the customer's journey state (only ever moves forward, never back).
 */
export async function advanceJourneyState(
  userId: string,
  targetState: CustomerJourneyState,
): Promise<void> {
  try {
    const [user] = await db
      .select({ journeyState: users.journeyState })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) return;

    const current = (user.journeyState ?? 'visitor') as CustomerJourneyState;
    const currentIdx = JOURNEY_ORDER.indexOf(current);
    const targetIdx  = JOURNEY_ORDER.indexOf(targetState);

    if (targetIdx <= currentIdx) return;

    await db
      .update(users)
      .set({ journeyState: targetState, updatedAt: new Date() })
      .where(eq(users.id, userId));

    logger.info('[CustomerIntelligence] Journey state advanced', {
      userId, from: current, to: targetState,
    });
  } catch (err: any) {
    logger.error('[CustomerIntelligence] Journey state advance failed', {
      userId, err: err.message,
    });
  }
}
