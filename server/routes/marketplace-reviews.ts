/**
 * Phase 8 — Marketplace Reviews + Quality Score Engine
 *
 * POST /api/marketplace-reviews
 * GET  /api/marketplace-reviews/provider/:providerId
 * GET  /api/marketplace-reviews/stats/:providerId
 * GET  /api/marketplace-reviews/my-reviews
 *
 * Trust integrity rules (enforced server-side):
 *  1. Only bookings with status IN ('completed', 'reviewed') may be reviewed
 *  2. One review per booking per customer (409 on duplicate)
 *  3. Provider cannot review their own booking (403)
 *  4. Reviewer must be the booking owner (403)
 *
 * Quality score engine (T003/T004):
 *  After every review submission, `computeProviderQualityScore` recomputes:
 *    - avgRating (50% weight)
 *    - flaggedReviewRatio penalty
 *    - openDisputePenalty
 *    - completionRateBonus (if known)
 *  Result stored in providerProfiles.trustScore (0-100).
 *  Repeated-issue flag fires when:
 *    3+ flagged reviews in last 30 days  OR  2+ open disputes in last 60 days
 */

import { Router, Request, Response } from 'express';
import { db, pool } from '../db';
import { marketplaceReviews, bookings } from '@shared/schema';
import { eq, and, desc, sql, count } from 'drizzle-orm';
import { auth } from '../lib/firebase-admin';
import { logger } from '../lib/logger';
import { computeAndPersistRankingScore } from './marketplace-ranking';
import { validateFirebaseToken } from '../middleware/firebase-auth';

const router = Router();

// ─── Auth helper ────────────────────────────────────────────────────────────
async function requireAuth(req: Request, res: Response): Promise<string | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' });
    return null;
  }
  try {
    const token = authHeader.split('Bearer ')[1];
    const decoded = await auth.verifyIdToken(token, true);
    return decoded.uid;
  } catch {
    res.status(401).json({ error: 'Invalid token' });
    return null;
  }
}

// ─── Quality Score Engine (T003/T004) ────────────────────────────────────────
/**
 * Computes and persists a composite trust/quality score (0-100) for a provider.
 *
 * Formula:
 *   ratingComponent  = avgRating * 16          → max 80 pts  (5★ = 80)
 *   completionBonus  = completionRatePct * 0.20 → max 20 pts  (100% = 20)
 *   flagPenalty      = flaggedRatio * 20        → max -20 pts
 *   disputePenalty   = min(openDisputes * 5, 20)→ max -20 pts
 *
 * Repeated-issue cap: if 3+ flagged reviews in 30 days OR 2+ open disputes
 * in 60 days, score is capped at 40 (risk threshold) and logged.
 *
 * Returns { qualityScore, repeatedIssueDetected, atRisk } for transparency.
 */
async function computeProviderQualityScore(providerId: string): Promise<{
  qualityScore: number;
  repeatedIssueDetected: boolean;
  atRisk: boolean;
}> {
  // 1. Review stats
  const reviewStats = await pool.query(
    `SELECT
       COALESCE(ROUND(AVG(overall_rating)::numeric, 2), 0) AS avg_rating,
       COUNT(*)::int                                        AS total_count,
       COUNT(*) FILTER (WHERE is_flagged = TRUE)::int       AS flagged_count,
       COUNT(*) FILTER (
         WHERE is_flagged = TRUE
         AND   created_at >= NOW() - INTERVAL '30 days'
       )::int AS recent_flagged_count
     FROM marketplace_reviews
     WHERE provider_id = $1 AND is_visible = TRUE`,
    [providerId]
  );

  // 2. Dispute stats (open disputes in last 60 days)
  const disputeStats = await pool.query(
    `SELECT
       COUNT(*) FILTER (
         WHERE status IN ('open','under_review')
         AND   created_at >= NOW() - INTERVAL '60 days'
       )::int AS open_dispute_count,
       COUNT(*)::int AS total_dispute_count
     FROM booking_disputes
     WHERE booking_id IN (
       SELECT id FROM bookings WHERE provider_id = $1
     )`,
    [providerId]
  );

  // 3. Completion rate (from providerProfiles if computed)
  const profileStats = await pool.query(
    `SELECT
       COALESCE(completion_rate_pct, 0) AS completion_rate_pct
     FROM provider_profiles
     WHERE user_id = $1`,
    [providerId]
  );

  const rs  = reviewStats.rows[0];
  const ds  = disputeStats.rows[0];
  const ps  = profileStats.rows[0];

  const avgRating          = parseFloat(rs?.avg_rating        || '0');
  const totalCount         = parseInt(rs?.total_count         || '0', 10);
  const flaggedCount       = parseInt(rs?.flagged_count       || '0', 10);
  const recentFlaggedCount = parseInt(rs?.recent_flagged_count|| '0', 10);
  const openDisputeCount   = parseInt(ds?.open_dispute_count  || '0', 10);
  const completionRatePct  = parseInt(ps?.completion_rate_pct || '0', 10);

  // Composite score
  const ratingComponent = avgRating * 16;                              // 0-80
  const completionBonus = Math.min(completionRatePct * 0.2, 20);       // 0-20
  const flagRatio       = totalCount > 0 ? flaggedCount / totalCount : 0;
  const flagPenalty     = flagRatio * 20;                              // 0-20
  const disputePenalty  = Math.min(openDisputeCount * 5, 20);          // 0-20

  let qualityScore = Math.round(ratingComponent + completionBonus - flagPenalty - disputePenalty);
  qualityScore = Math.max(0, Math.min(100, qualityScore));

  // Repeated-issue detection
  const repeatedIssueDetected = recentFlaggedCount >= 3 || openDisputeCount >= 2;
  if (repeatedIssueDetected) {
    qualityScore = Math.min(qualityScore, 40);   // cap at risk threshold
    logger.warn('[QualityScore] Repeated issues detected for provider', {
      providerId,
      recentFlaggedCount,
      openDisputeCount,
      cappedScore: qualityScore,
    });
  }

  const atRisk = qualityScore <= 40;

  // Persist
  await pool.query(
    `UPDATE provider_profiles
     SET trust_score              = $2,
         trust_metrics_updated_at = NOW()
     WHERE user_id = $1`,
    [providerId, qualityScore]
  );

  logger.info('[QualityScore] Recomputed', {
    providerId,
    avgRating,
    totalCount,
    flaggedCount,
    openDisputeCount,
    qualityScore,
    repeatedIssueDetected,
  });

  return { qualityScore, repeatedIssueDetected, atRisk };
}

// ─── POST /api/marketplace-reviews ──────────────────────────────────────────
router.post('/', validateFirebaseToken, async (req: Request, res: Response) => {
  try {
    const uid = await requireAuth(req, res);
    if (!uid) return;

    const { bookingId, overallRating, reviewText } = req.body;

    if (!bookingId || !overallRating) {
      return res.status(400).json({ error: 'bookingId and overallRating are required' });
    }
    const rating = Number(overallRating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'overallRating must be an integer between 1 and 5' });
    }

    // ── Load booking ──────────────────────────────────────────────────────────
    const [booking] = await db.select()
      .from(bookings)
      .where(eq(bookings.id, bookingId))
      .limit(1);

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Trust integrity rule 1: reviewer must be the booking owner
    if (booking.userId !== uid) {
      return res.status(403).json({ error: 'You can only review your own bookings' });
    }

    // Trust integrity rule 2: provider cannot review their own service
    if (booking.providerId && booking.providerId === uid) {
      return res.status(403).json({ error: 'Providers cannot review their own bookings' });
    }

    // Trust integrity rule 3: only truly completed bookings qualify
    if (!['completed', 'reviewed'].includes(booking.status)) {
      return res.status(400).json({
        error: 'Review available only after the service is completed',
        bookingStatus: booking.status,
      });
    }

    // Trust integrity rule 4: one review per booking
    const [existing] = await db.select({ id: marketplaceReviews.id })
      .from(marketplaceReviews)
      .where(and(
        eq(marketplaceReviews.bookingId, bookingId),
        eq(marketplaceReviews.customerId, uid)
      ))
      .limit(1);

    if (existing) {
      return res.status(409).json({ error: 'You have already reviewed this booking' });
    }

    const providerId = booking.providerId || '';
    const isFlagged  = rating <= 2;

    // ── Insert review ─────────────────────────────────────────────────────────
    const [review] = await db.insert(marketplaceReviews).values({
      bookingId,
      customerId: uid,
      providerId,
      overallRating: rating,
      reviewText: reviewText?.trim() || null,
      isVisible:   true,
      isFlagged,
      flagReason: isFlagged ? `Low rating: ${rating}/5` : null,
    }).returning();

    // ── Mark booking as reviewed ──────────────────────────────────────────────
    await db.update(bookings)
      .set({ customerRating: String(rating) as any, status: 'reviewed' as any })
      .where(eq(bookings.id, bookingId));

    // ── Refresh ratingAvg / ratingCount ───────────────────────────────────────
    if (providerId) {
      await pool.query(
        `UPDATE provider_profiles SET
           rating_avg   = (SELECT ROUND(AVG(overall_rating)::numeric, 2)
                           FROM marketplace_reviews
                           WHERE provider_id = $1 AND is_visible = TRUE),
           rating_count = (SELECT COUNT(*)
                           FROM marketplace_reviews
                           WHERE provider_id = $1 AND is_visible = TRUE),
           updated_at   = NOW()
         WHERE user_id = $1`,
        [providerId]
      );

      // ── Quality score + repeated-issue detection (T003/T004) ─────────────────
      const { qualityScore, repeatedIssueDetected, atRisk } =
        await computeProviderQualityScore(providerId);

      // ── Phase 9: Recompute ranking score after every review ───────────────────
      computeAndPersistRankingScore(providerId).catch((err: any) =>
        logger.warn('[MarketplaceReviews] Ranking recompute failed (non-blocking)', {
          providerId, error: err.message,
        })
      );

      logger.info('[MarketplaceReviews] Review submitted', {
        reviewId: review.id, bookingId, providerId, rating, isFlagged,
        qualityScore, repeatedIssueDetected, atRisk,
      });

      return res.status(201).json({
        success: true,
        review: {
          id:            review.id,
          overallRating: review.overallRating,
          isFlagged:     review.isFlagged,
        },
        providerQuality: {
          qualityScore,
          repeatedIssueDetected,
          atRisk,
        },
      });
    }

    logger.info('[MarketplaceReviews] Review submitted (no provider)', { reviewId: review.id });
    res.status(201).json({
      success: true,
      review: { id: review.id, overallRating: review.overallRating, isFlagged: review.isFlagged },
    });
  } catch (error: any) {
    logger.error('[MarketplaceReviews] Submit error', error);
    res.status(500).json({ error: error.message || 'Failed to submit review' });
  }
});

// ─── GET /api/marketplace-reviews/stats/:providerId ─────────────────────────
router.get('/stats/:providerId', async (req: Request, res: Response) => {
  try {
    const { providerId } = req.params;

    const result = await pool.query(
      `SELECT
         ROUND(AVG(overall_rating)::numeric, 1) AS avg_rating,
         COUNT(*)::int                          AS review_count,
         trust_score
       FROM marketplace_reviews mr
       LEFT JOIN provider_profiles pp ON pp.user_id = mr.provider_id
       WHERE mr.provider_id = $1 AND mr.is_visible = TRUE
       GROUP BY pp.trust_score`,
      [providerId]
    );

    const row = result.rows[0];
    res.json({
      success:      true,
      avgRating:    row?.avg_rating    ? parseFloat(row.avg_rating) : null,
      reviewCount:  parseInt(row?.review_count || '0', 10),
      qualityScore: row?.trust_score   != null ? parseInt(row.trust_score, 10) : null,
    });
  } catch (error: any) {
    logger.error('[MarketplaceReviews] Stats error', error);
    res.status(500).json({ error: 'Failed to fetch rating stats' });
  }
});

// ─── GET /api/marketplace-reviews/provider/:providerId ──────────────────────
router.get('/provider/:providerId', async (req: Request, res: Response) => {
  try {
    const { providerId } = req.params;
    const limit = Math.min(20, parseInt(req.query.limit as string || '10', 10));

    const reviews = await db.select({
      id:            marketplaceReviews.id,
      overallRating: marketplaceReviews.overallRating,
      reviewText:    marketplaceReviews.reviewText,
      createdAt:     marketplaceReviews.createdAt,
    })
      .from(marketplaceReviews)
      .where(and(
        eq(marketplaceReviews.providerId, providerId),
        eq(marketplaceReviews.isVisible, true)
      ))
      .orderBy(desc(marketplaceReviews.createdAt))
      .limit(limit);

    const [stats] = await db.select({
      avgRating:   sql<string>`ROUND(AVG(${marketplaceReviews.overallRating})::numeric, 1)`,
      reviewCount: count(marketplaceReviews.id),
    })
      .from(marketplaceReviews)
      .where(and(
        eq(marketplaceReviews.providerId, providerId),
        eq(marketplaceReviews.isVisible, true)
      ));

    // Also fetch quality score from profile
    const profileRow = await pool.query(
      `SELECT trust_score FROM provider_profiles WHERE user_id = $1`,
      [providerId]
    );

    res.json({
      success:      true,
      avgRating:    stats?.avgRating   ? parseFloat(stats.avgRating) : null,
      reviewCount:  stats?.reviewCount ?? 0,
      qualityScore: profileRow.rows[0]?.trust_score != null
        ? parseInt(profileRow.rows[0].trust_score, 10)
        : null,
      reviews: reviews.map(r => ({
        id:        r.id,
        rating:    r.overallRating,
        text:      r.reviewText,
        createdAt: r.createdAt,
      })),
    });
  } catch (error: any) {
    logger.error('[MarketplaceReviews] Provider reviews error', error);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

// ─── GET /api/marketplace-reviews/my-reviews ────────────────────────────────
router.get('/my-reviews', validateFirebaseToken, async (req: Request, res: Response) => {
  try {
    const uid = await requireAuth(req, res);
    if (!uid) return;

    const reviews = await db.select({
      id:            marketplaceReviews.id,
      bookingId:     marketplaceReviews.bookingId,
      overallRating: marketplaceReviews.overallRating,
      createdAt:     marketplaceReviews.createdAt,
    })
      .from(marketplaceReviews)
      .where(eq(marketplaceReviews.customerId, uid))
      .orderBy(desc(marketplaceReviews.createdAt))
      .limit(50);

    res.json({ success: true, reviews });
  } catch (error: any) {
    logger.error('[MarketplaceReviews] My reviews error', error);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

export default router;
