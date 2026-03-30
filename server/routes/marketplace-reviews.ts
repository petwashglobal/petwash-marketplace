/**
 * Phase 8 — Marketplace Reviews
 * POST /api/marketplace-reviews        — submit review (customer, after completion)
 * GET  /api/marketplace-reviews/provider/:providerId — provider's public reviews
 * GET  /api/marketplace-reviews/stats/:providerId    — rating avg + count for provider card
 */

import { Router, Request, Response } from 'express';
import { db, pool } from '../db';
import { marketplaceReviews, bookings, providerProfiles } from '@shared/schema';
import { eq, and, desc, sql, avg, count } from 'drizzle-orm';
import { auth } from '../lib/firebase-admin';
import { logger } from '../lib/logger';

const router = Router();

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

// POST /api/marketplace-reviews
router.post('/', async (req: Request, res: Response) => {
  try {
    const uid = await requireAuth(req, res);
    if (!uid) return;

    const { bookingId, overallRating, reviewText } = req.body;

    if (!bookingId || !overallRating) {
      return res.status(400).json({ error: 'bookingId and overallRating are required' });
    }
    if (overallRating < 1 || overallRating > 5) {
      return res.status(400).json({ error: 'overallRating must be between 1 and 5' });
    }

    const [booking] = await db.select()
      .from(bookings)
      .where(eq(bookings.id, bookingId))
      .limit(1);

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    if (booking.userId !== uid) {
      return res.status(403).json({ error: 'You can only review your own bookings' });
    }
    if (!['completed', 'reviewed', 'inquiry', 'confirmed'].includes(booking.status)) {
      return res.status(400).json({ error: 'Booking must be completed before reviewing' });
    }

    const existing = await db.select({ id: marketplaceReviews.id })
      .from(marketplaceReviews)
      .where(and(
        eq(marketplaceReviews.bookingId, bookingId),
        eq(marketplaceReviews.customerId, uid)
      ))
      .limit(1);

    if (existing.length > 0) {
      return res.status(409).json({ error: 'You have already reviewed this booking' });
    }

    const providerId = booking.providerId || '';
    const isFlagged = overallRating <= 2;

    const [review] = await db.insert(marketplaceReviews).values({
      bookingId,
      customerId: uid,
      providerId,
      overallRating,
      reviewText: reviewText || null,
      isVisible: true,
      isFlagged,
      flagReason: isFlagged ? `Low rating: ${overallRating}/5` : null,
    }).returning();

    // Update booking customerRating
    await db.update(bookings)
      .set({ customerRating: String(overallRating) as any })
      .where(eq(bookings.id, bookingId));

    // Refresh provider rating avg + count in providerProfiles
    if (providerId) {
      await pool.query(
        `UPDATE provider_profiles SET
           rating_avg = (
             SELECT ROUND(AVG(overall_rating)::numeric, 2)
             FROM marketplace_reviews
             WHERE provider_id = $1 AND is_visible = TRUE
           ),
           rating_count = (
             SELECT COUNT(*)
             FROM marketplace_reviews
             WHERE provider_id = $1 AND is_visible = TRUE
           ),
           updated_at = NOW()
         WHERE user_id = $1`,
        [providerId]
      );
    }

    logger.info('[MarketplaceReviews] Review submitted', {
      reviewId: review.id,
      bookingId,
      providerId,
      overallRating,
      isFlagged,
    });

    res.status(201).json({
      success: true,
      review: {
        id: review.id,
        overallRating: review.overallRating,
        isFlagged: review.isFlagged,
      },
    });
  } catch (error: any) {
    logger.error('[MarketplaceReviews] Submit error', error);
    res.status(500).json({ error: error.message || 'Failed to submit review' });
  }
});

// GET /api/marketplace-reviews/stats/:providerId
// Public — used by provider cards in booking flow
router.get('/stats/:providerId', async (req: Request, res: Response) => {
  try {
    const { providerId } = req.params;

    const result = await pool.query(
      `SELECT
         ROUND(AVG(overall_rating)::numeric, 1) AS avg_rating,
         COUNT(*) AS review_count
       FROM marketplace_reviews
       WHERE provider_id = $1 AND is_visible = TRUE`,
      [providerId]
    );

    const row = result.rows[0];
    res.json({
      success: true,
      avgRating: row?.avg_rating ? parseFloat(row.avg_rating) : null,
      reviewCount: parseInt(row?.review_count || '0', 10),
    });
  } catch (error: any) {
    logger.error('[MarketplaceReviews] Stats error', error);
    res.status(500).json({ error: 'Failed to fetch rating stats' });
  }
});

// GET /api/marketplace-reviews/provider/:providerId
// Returns recent public reviews for a provider
router.get('/provider/:providerId', async (req: Request, res: Response) => {
  try {
    const { providerId } = req.params;
    const limit = Math.min(20, parseInt(req.query.limit as string || '10', 10));

    const reviews = await db.select({
      id: marketplaceReviews.id,
      overallRating: marketplaceReviews.overallRating,
      reviewText: marketplaceReviews.reviewText,
      createdAt: marketplaceReviews.createdAt,
    })
      .from(marketplaceReviews)
      .where(and(
        eq(marketplaceReviews.providerId, providerId),
        eq(marketplaceReviews.isVisible, true)
      ))
      .orderBy(desc(marketplaceReviews.createdAt))
      .limit(limit);

    const [stats] = await db.select({
      avgRating: sql<string>`ROUND(AVG(${marketplaceReviews.overallRating})::numeric, 1)`,
      reviewCount: count(marketplaceReviews.id),
    })
      .from(marketplaceReviews)
      .where(and(
        eq(marketplaceReviews.providerId, providerId),
        eq(marketplaceReviews.isVisible, true)
      ));

    res.json({
      success: true,
      avgRating: stats?.avgRating ? parseFloat(stats.avgRating) : null,
      reviewCount: stats?.reviewCount ?? 0,
      reviews: reviews.map(r => ({
        id: r.id,
        rating: r.overallRating,
        text: r.reviewText,
        createdAt: r.createdAt,
      })),
    });
  } catch (error: any) {
    logger.error('[MarketplaceReviews] Provider reviews error', error);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

// GET /api/marketplace-reviews/my-reviews
// Returns reviews written by the current user (for checking if already reviewed)
router.get('/my-reviews', async (req: Request, res: Response) => {
  try {
    const uid = await requireAuth(req, res);
    if (!uid) return;

    const reviews = await db.select({
      id: marketplaceReviews.id,
      bookingId: marketplaceReviews.bookingId,
      overallRating: marketplaceReviews.overallRating,
      createdAt: marketplaceReviews.createdAt,
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
