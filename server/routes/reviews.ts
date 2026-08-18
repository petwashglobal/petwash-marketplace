/**
 * Two-Sided Review System API Routes (2026 Contractor Lifecycle)
 * Supports owner → contractor AND contractor → owner reviews
 * Includes automatic flagging, AI trust scoring, and moderation
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { db } from '../db';
import {
  contractorReviews,
  contractorTrustScores,
  reviewFlaggingRules,
  insertContractorReviewSchema,
  sitterBookings,
  sitterProfiles,
  walkBookings,
  walkerProfiles,
  pettrekTrips,
  trainerBookings,
} from '@shared/schema';
import { bookings, providers } from '@shared/super-app-schema';
import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import { auth } from '../lib/firebase-admin';
import { logger } from '../lib/logger';
import { nanoid } from 'nanoid';
import { triggerTrustScoreUpdate } from '../services/trustScoring';

/**
 * Advisory-lock key for concurrent review submission — P1-16 idempotency.
 * contractorReviews has no unique constraint on (bookingId,reviewType,reviewerId)
 * so a plain SELECT-then-INSERT races. SHA-256 (not SHA-1) — this hash is a
 * mutex key, not a cryptographic primitive.
 */
function reviewLockKey(bookingId: string, reviewType: string, reviewerId: string): bigint {
  const digest = crypto
    .createHash('sha256')
    .update(`review:${bookingId}:${reviewType}:${reviewerId}`)
    .digest();
  return BigInt('0x' + digest.subarray(0, 8).toString('hex')) & BigInt('0x7fffffffffffffff');
}

/**
 * Resolve a sitter's Firebase UID from the integer sitter_profiles.id used
 * by sitter_bookings.sitterId. P1-14 fix: prior code compared the integer
 * FK to a Firebase UID string — the comparison is always false, so
 * contractor_to_owner sitter reviews were silently impossible AND
 * owner_to_contractor reviews' subjectId targeted the wrong contractor id.
 */
async function resolveSitterUid(sitterProfileId: number | null | undefined): Promise<string | null> {
  if (sitterProfileId == null) return null;
  const [row] = await db
    .select({ userId: sitterProfiles.userId })
    .from(sitterProfiles)
    .where(eq(sitterProfiles.id, sitterProfileId))
    .limit(1);
  return (row?.userId || null) as string | null;
}

/**
 * Resolve a walker's Firebase UID from the WALKER-uuid stored in
 * walk_bookings.walkerId (references walker_profiles.walkerId). P1-14 fix
 * (sibling to resolveSitterUid): identical shape.
 */
async function resolveWalkerUid(walkerUuid: string | null | undefined): Promise<string | null> {
  if (!walkerUuid) return null;
  const [row] = await db
    .select({ userId: walkerProfiles.userId })
    .from(walkerProfiles)
    .where(eq(walkerProfiles.walkerId, walkerUuid))
    .limit(1);
  return (row?.userId || null) as string | null;
}

const router = Router();

// Firebase authentication middleware
async function requireAuth(req: Request, res: Response, next: Function) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized - No token provided' });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(token, true);
    
    req.body.userId = decodedToken.uid;
    req.body.userEmail = decodedToken.email;
    next();
  } catch (error) {
    logger.error('Auth error', error);
    return res.status(401).json({ error: 'Unauthorized - Invalid token' });
  }
}

// =================== SUBMIT REVIEW ===================

/**
 * Submit a review (owner → contractor OR contractor → owner)
 * POST /api/reviews/submit
 */
router.post('/submit', requireAuth, async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;
    const {
      bookingType,
      bookingId,
      reviewType,
      overallRating,
      punctualityRating,
      communicationRating,
      professionalismRating,
      cleanlinessRating,
      safetyRating,
      reviewText,
      reviewPhotos
    } = req.body;

    // Validate basic fields
    if (!bookingType || !bookingId || !reviewType || !overallRating) {
      return res.status(400).json({ 
        error: 'Missing required fields: bookingType, bookingId, reviewType, overallRating' 
      });
    }

    if (overallRating < 1 || overallRating > 5) {
      return res.status(400).json({ error: 'Overall rating must be between 1 and 5' });
    }

    // CRITICAL SECURITY: Verify booking exists and user has permission to review
    let booking: any;
    let isOwner = false;
    let isContractor = false;
    let subjectId: string;
    let subjectName: string;
    let subjectType: string;

    if (bookingType === 'sitter') {
      const [sitterBooking] = await db
        .select()
        .from(sitterBookings)
        .where(eq(sitterBookings.id, parseInt(bookingId)))
        .limit(1);

      if (!sitterBooking) {
        return res.status(404).json({ error: 'Booking not found' });
      }

      // Check if booking is completed
      if (sitterBooking.status !== 'completed') {
        return res.status(403).json({ error: 'Can only review completed bookings' });
      }

      booking = sitterBooking;
      isOwner = sitterBooking.ownerId === userId;
      // P1-14 FIX (2026-08-18): sitterBookings.sitterId is an INTEGER FK to
      // sitter_profiles.id — string-comparing it to a Firebase UID always
      // yields false. Resolve the sitter's Firebase UID via the join.
      const sitterUid = await resolveSitterUid(sitterBooking.sitterId as number | null);
      isContractor = sitterUid != null && sitterUid === userId;

      // Set subject based on review direction
      if (reviewType === 'owner_to_contractor') {
        if (!isOwner) {
          return res.status(403).json({ error: 'You are not the owner of this booking' });
        }
        if (!sitterUid) {
          return res.status(500).json({ error: 'Failed to resolve sitter identity' });
        }
        subjectId = sitterUid;
        subjectName = `Sitter ${sitterBooking.sitterId}`;
        subjectType = 'sitter';
      } else if (reviewType === 'contractor_to_owner') {
        if (!isContractor) {
          return res.status(403).json({ error: 'You are not the sitter for this booking' });
        }
        subjectId = sitterBooking.ownerId;
        subjectName = `Owner ${sitterBooking.ownerId}`;
        subjectType = 'owner';
      } else {
        return res.status(400).json({ error: 'Invalid review type. Must be: owner_to_contractor or contractor_to_owner' });
      }

    } else if (bookingType === 'walker') {
      const [walkBooking] = await db
        .select()
        .from(walkBookings)
        .where(eq(walkBookings.bookingId, bookingId))
        .limit(1);

      if (!walkBooking) {
        return res.status(404).json({ error: 'Walk booking not found' });
      }

      if (walkBooking.status !== 'completed') {
        return res.status(403).json({ error: 'Can only review completed walk bookings' });
      }

      booking = walkBooking;
      isOwner = walkBooking.ownerId === userId;
      // P1-14 FIX (2026-08-18): walkBookings.walkerId stores a WALKER-uuid
      // (references walker_profiles.walkerId), NOT a Firebase UID. Compare
      // against the resolved Firebase UID from the join.
      const walkerUid = await resolveWalkerUid(walkBooking.walkerId);
      isContractor = walkerUid != null && walkerUid === userId;

      if (reviewType === 'owner_to_contractor') {
        if (!isOwner) {
          return res.status(403).json({ error: 'You are not the owner of this walk booking' });
        }
        if (!walkerUid) {
          return res.status(500).json({ error: 'Failed to resolve walker identity' });
        }
        subjectId = walkerUid;
        subjectName = `Walker ${walkBooking.walkerId}`;
        subjectType = 'walker';
      } else if (reviewType === 'contractor_to_owner') {
        if (!isContractor) {
          return res.status(403).json({ error: 'You are not the walker for this booking' });
        }
        subjectId = walkBooking.ownerId;
        subjectName = `Owner ${walkBooking.ownerId}`;
        subjectType = 'owner';
      } else {
        return res.status(400).json({ error: 'Invalid review type. Must be: owner_to_contractor or contractor_to_owner' });
      }

    } else if (bookingType === 'pettrek') {
      const [trip] = await db
        .select()
        .from(pettrekTrips)
        .where(eq(pettrekTrips.tripId, bookingId))
        .limit(1);

      if (!trip) {
        return res.status(404).json({ error: 'PetTrek trip not found' });
      }

      if (trip.status !== 'completed') {
        return res.status(403).json({ error: 'Can only review completed trips' });
      }

      booking = trip;
      isOwner = trip.ownerId === userId;
      isContractor = trip.driverId === userId;

      if (reviewType === 'owner_to_contractor') {
        if (!isOwner) {
          return res.status(403).json({ error: 'You are not the owner of this trip' });
        }
        subjectId = trip.driverId;
        subjectName = `Driver ${trip.driverId}`;
        subjectType = 'driver';
      } else if (reviewType === 'contractor_to_owner') {
        if (!isContractor) {
          return res.status(403).json({ error: 'You are not the driver for this trip' });
        }
        subjectId = trip.ownerId;
        subjectName = `Owner ${trip.ownerId}`;
        subjectType = 'owner';
      } else {
        return res.status(400).json({ error: 'Invalid review type. Must be: owner_to_contractor or contractor_to_owner' });
      }

    } else if (bookingType === 'trainer' || bookingType === 'academy') {
      // PetWash Academy reviews (2026-07-31 fix): the review route rejected every
      // academy booking, so trainers could never be reviewed. trainer_bookings keys:
      // userId = owner, trainerUserId = trainer's uid, bookingStatus.
      const [trainerBooking] = await db
        .select()
        .from(trainerBookings)
        .where(eq(trainerBookings.bookingId, bookingId))
        .limit(1);

      if (!trainerBooking) {
        return res.status(404).json({ error: 'Academy booking not found' });
      }
      if (trainerBooking.bookingStatus !== 'completed') {
        return res.status(403).json({ error: 'Can only review completed academy bookings' });
      }

      booking = trainerBooking;
      isOwner = trainerBooking.userId === userId;
      isContractor = (trainerBooking.trainerUserId ?? '') === userId;

      if (reviewType === 'owner_to_contractor') {
        if (!isOwner) {
          return res.status(403).json({ error: 'You are not the owner of this academy booking' });
        }
        subjectId = trainerBooking.trainerUserId ?? String(trainerBooking.trainerId);
        subjectName = `Trainer ${trainerBooking.trainerId}`;
        subjectType = 'trainer';
      } else if (reviewType === 'contractor_to_owner') {
        if (!isContractor) {
          return res.status(403).json({ error: 'You are not the trainer for this booking' });
        }
        subjectId = trainerBooking.userId;
        subjectName = `Owner ${trainerBooking.userId}`;
        subjectType = 'owner';
      } else {
        return res.status(400).json({ error: 'Invalid review type. Must be: owner_to_contractor or contractor_to_owner' });
      }

    } else {
      return res.status(400).json({ error: 'Invalid booking type. Must be: sitter, walker, pettrek, or trainer' });
    }

    // P1-16 IDEMPOTENCY GATE (2026-08-18): the check-then-insert must be
    // atomic under a per-review pg_advisory_xact_lock. Without this, two
    // concurrent submits from the same reviewer both pass the SELECT and
    // both INSERT (contractorReviews has no unique constraint on
    // (bookingId, reviewType, reviewerId)). The check + insert are unified
    // below inside the transaction; this variable carries the "already
    // reviewed" verdict out of the tx.
    const lockKey = reviewLockKey(bookingId, reviewType, userId);
    let alreadyReviewed = false;

    // Generate review ID
    const reviewId = `REV-${new Date().getFullYear()}-${nanoid(8).toUpperCase()}`;

    // Get reviewer name from Firebase
    let reviewerName = 'Anonymous';
    try {
      const userRecord = await auth.getUser(userId);
      reviewerName = userRecord.displayName || userRecord.email || 'Anonymous';
    } catch (error) {
      logger.warn('Could not fetch reviewer name from Firebase', error);
    }

    // Determine reviewer type
    const reviewerType = reviewType === 'owner_to_contractor' ? 'owner' : 'contractor';

    // Check for flagged keywords (automatic flagging with rule-based visibility)
    const flaggedKeywords: string[] = [];
    let isFlagged = false;
    let flaggedReason: string | null = null;
    let shouldAutoHide = false; // Respect rule.autoHideReview setting

    if (reviewText) {
      const rules = await db
        .select()
        .from(reviewFlaggingRules)
        .where(eq(reviewFlaggingRules.isActive, true));

      const reviewTextLower = reviewText.toLowerCase();
      
      for (const rule of rules) {
        if (reviewTextLower.includes(rule.keyword.toLowerCase())) {
          flaggedKeywords.push(rule.keyword);
          isFlagged = true;
          flaggedReason = rule.flagReason;
          
          // Respect the rule's autoHideReview setting
          if (rule.autoHideReview) {
            shouldAutoHide = true;
          }
          
          logger.warn('[Review Flagging] Review flagged', {
            reviewId,
            keyword: rule.keyword,
            reason: rule.flagReason,
            severity: rule.severity,
            autoHide: rule.autoHideReview,
            requireModeration: rule.requireModeration
          });

          // Send email alert to management if required by rule
          if (rule.notifyManagement) {
            logger.error('[Review Flagging] Management notification required', {
              reviewId,
              keyword: rule.keyword,
              severity: rule.severity,
              bookingId
            });
            
            // Import EmailService dynamically to avoid circular dependencies
            const { EmailService } = await import('../emailService');
            await EmailService.send({
              to: 'management@petwash.co.il',
              subject: `🚨 Review Flagged: ${rule.severity} - ${rule.keyword}`,
              html: `
                <h2 style="color: #d32f2f;">🚨 Flagged Review Alert</h2>
                <p><strong>Severity:</strong> ${rule.severity}</p>
                <p><strong>Keyword:</strong> ${rule.keyword}</p>
                <p><strong>Reason:</strong> ${rule.flagReason}</p>
                <p><strong>Review ID:</strong> ${reviewId}</p>
                <p><strong>Booking ID:</strong> ${bookingId}</p>
                <p><strong>Auto-Hidden:</strong> ${rule.autoHideReview ? 'Yes' : 'No'}</p>
                <p><strong>Requires Moderation:</strong> ${rule.requireModeration ? 'Yes' : 'No'}</p>
                <hr>
                <p><small>Please review this flagged content in the admin dashboard.</small></p>
              `,
            }).catch(err => logger.error('[Review Flagging] Failed to send management notification', err));
          }

          // Only check first match for simplicity (critical keywords typically checked first)
          break;
        }
      }
    }

    // ATOMIC CHECK + INSERT — under the pg_advisory_xact_lock keyed on
    // (bookingId, reviewType, reviewerId). Concurrent submitter with the
    // same tuple blocks here until we commit; if we insert, they see the
    // row on their check and 400 out; if we detect an existing row first,
    // they hit the same 400. Exactly one INSERT per (booking, reviewType,
    // reviewer). See P1-16.
    let review: any = null;
    await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${lockKey}::bigint)`);
      const existing = await tx
        .select({ id: contractorReviews.id })
        .from(contractorReviews)
        .where(
          and(
            eq(contractorReviews.bookingId, bookingId),
            eq(contractorReviews.reviewType, reviewType),
            eq(contractorReviews.reviewerId, userId),
          ),
        )
        .limit(1);
      if (existing.length > 0) {
        alreadyReviewed = true;
        return;
      }
      const [inserted] = await tx.insert(contractorReviews).values({
        reviewId,
        bookingType,
        bookingId,
        reviewType,
        reviewerId: userId,
        reviewerName,
        reviewerType,
        subjectId,
        subjectName,
        subjectType,
        overallRating,
        punctualityRating: punctualityRating || null,
        communicationRating: communicationRating || null,
        professionalismRating: professionalismRating || null,
        cleanlinessRating: cleanlinessRating || null,
        safetyRating: safetyRating || null,
        reviewText: reviewText || null,
        reviewPhotos: reviewPhotos || [],
        isFlagged,
        flaggedKeywords: flaggedKeywords.length > 0 ? flaggedKeywords : null,
        flaggedReason: flaggedReason,
        flaggedAt: isFlagged ? new Date() : null,
        moderationStatus: isFlagged ? 'pending' : 'approved',
        isVerifiedBooking: true,
        isVisible: !shouldAutoHide,
        isPublic: true,
      }).returning();
      review = inserted;
    });

    if (alreadyReviewed) {
      return res.status(400).json({ error: 'You have already reviewed this booking' });
    }
    if (!review) {
      logger.error('[Reviews] Insert returned no row', { reviewId, bookingId, reviewType });
      return res.status(500).json({ error: 'Failed to submit review' });
    }

    // Update trust score asynchronously (for contractor being reviewed)
    if (reviewType === 'owner_to_contractor') {
      triggerTrustScoreUpdate(subjectId, 'review_submitted').catch(err => {
        logger.error('[Trust Score] Failed to update', err, { contractorId: subjectId });
      });
    }

    logger.info('[Reviews] Review submitted', {
      reviewId,
      reviewType,
      rating: overallRating,
      flagged: isFlagged
    });

    res.json({
      success: true,
      review: {
        reviewId: review.reviewId,
        overallRating: review.overallRating,
        isFlagged: review.isFlagged,
        isVisible: review.isVisible
      }
    });
  } catch (error: any) {
    logger.error('[Reviews] Submit review error', error);
    res.status(500).json({ error: error.message || 'Failed to submit review' });
  }
});

// =================== GET TRUST SCORE ===================
//
// MUST be registered BEFORE the /:platform/:providerId catch-all below —
// both are 2-segment routes and Express matches in registration order.
// Registering trust-score after the catch-all lets /api/reviews/trust-score/:id
// silently resolve to the review-list handler (platform="trust-score"),
// returning the wrong shape.

/**
 * Get contractor trust score
 * GET /api/reviews/trust-score/:contractorId
 */
router.get('/trust-score/:contractorId', async (req: Request, res: Response) => {
  try {
    const { contractorId } = req.params;

    const [trustScore] = await db
      .select()
      .from(contractorTrustScores)
      .where(eq(contractorTrustScores.contractorId, contractorId))
      .limit(1);

    if (!trustScore) {
      // Return default score for new contractors
      return res.json({
        success: true,
        contractorId,
        publicTrustScore: 4.50,
        totalReviews: 0,
        totalBookings: 0,
        isRecommended: false,
        isPremiumBadge: false,
      });
    }

    res.json({
      success: true,
      contractorId: trustScore.contractorId,
      publicTrustScore: parseFloat(trustScore.publicTrustScore || '4.50'),
      totalReviews: trustScore.totalReviews,
      totalBookings: trustScore.totalBookings,
      isRecommended: trustScore.isRecommended,
      isPremiumBadge: trustScore.isPremiumBadge,
      lastCalculatedAt: trustScore.lastCalculatedAt,
    });
  } catch (error: any) {
    logger.error('[Trust Score] Get score error', error);
    res.status(500).json({ error: error.message || 'Failed to get trust score' });
  }
});

// =================== GET REVIEWS ===================

/**
 * Get reviews for a provider by platform + providerId
 * GET /api/reviews/:platform/:providerId
 * Frontend marketplace hook uses this format.
 */
router.get('/:platform/:providerId', async (req: Request, res: Response) => {
  const { platform, providerId } = req.params;
  const { limit = 20 } = req.query;

  try {
    const reviews = await db
      .select()
      .from(contractorReviews)
      .where(
        and(
          eq(contractorReviews.subjectId, providerId),
          eq(contractorReviews.isVisible, true),
          eq(contractorReviews.isPublic, true)
        )
      )
      .orderBy(desc(contractorReviews.createdAt))
      .limit(Math.min(Number(limit) || 20, 50)); // clamp — was unbounded (?limit=99999999 dumped all)

    const totalReviews = reviews.length;
    const avgOverallRating = totalReviews > 0
      ? reviews.reduce((sum, r) => sum + (r.overallRating || 0), 0) / totalReviews
      : 0;

    return res.json({
      success: true,
      platform,
      providerId,
      totalReviews,
      avgOverallRating: parseFloat(avgOverallRating.toFixed(2)),
      reviews: reviews.map(r => ({
        reviewId: r.reviewId,
        customerName: r.reviewerName,
        rating: r.overallRating,
        overallRating: r.overallRating,
        comment: r.reviewText,
        reviewText: r.reviewText,
        reviewPhotos: r.reviewPhotos,
        highlights: r.highlights,
        hasResponse: r.hasResponse,
        responseText: r.responseText,
        createdAt: r.createdAt,
      })),
    });
  } catch (error: any) {
    logger.error('[Reviews] Get reviews by platform/provider error', error);
    return res.status(500).json({ error: error.message || 'Failed to get reviews' });
  }
});

/**
 * Get reviews for a specific contractor or owner
 * GET /api/reviews/:subjectId?type=contractor&limit=20
 */
router.get('/:subjectId', async (req: Request, res: Response) => {
  try {
    const { subjectId } = req.params;
    const { type = 'contractor', limit = 20 } = req.query;

    const reviews = await db
      .select()
      .from(contractorReviews)
      .where(
        and(
          eq(contractorReviews.subjectId, subjectId),
          eq(contractorReviews.isVisible, true),
          eq(contractorReviews.isPublic, true)
        )
      )
      .orderBy(desc(contractorReviews.createdAt))
      .limit(Math.min(Number(limit) || 20, 50)); // clamp — was unbounded (?limit=99999999 dumped all)

    // Calculate average ratings
    const totalReviews = reviews.length;
    const avgOverallRating = totalReviews > 0
      ? reviews.reduce((sum, r) => sum + (r.overallRating || 0), 0) / totalReviews
      : 0;

    res.json({
      success: true,
      subjectId,
      totalReviews,
      avgOverallRating: parseFloat(avgOverallRating.toFixed(2)),
      reviews: reviews.map(r => ({
        reviewId: r.reviewId,
        reviewerName: r.reviewerName,
        overallRating: r.overallRating,
        punctualityRating: r.punctualityRating,
        communicationRating: r.communicationRating,
        professionalismRating: r.professionalismRating,
        reviewText: r.reviewText,
        reviewPhotos: r.reviewPhotos,
        highlights: r.highlights,
        hasResponse: r.hasResponse,
        responseText: r.responseText,
        createdAt: r.createdAt,
      }))
    });
  } catch (error: any) {
    logger.error('[Reviews] Get reviews error', error);
    res.status(500).json({ error: error.message || 'Failed to get reviews' });
  }
});

// =================== RESPOND TO REVIEW ===================

/**
 * Contractor/owner can respond to a review
 * POST /api/reviews/:reviewId/respond
 */
router.post('/:reviewId/respond', requireAuth, async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;
    const { reviewId } = req.params;
    const { responseText } = req.body;

    if (!responseText) {
      return res.status(400).json({ error: 'Response text is required' });
    }

    // Get review
    const [review] = await db
      .select()
      .from(contractorReviews)
      .where(eq(contractorReviews.reviewId, reviewId))
      .limit(1);

    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    // Check if user is the subject of the review
    if (review.subjectId !== userId) {
      return res.status(403).json({ error: 'You can only respond to reviews about you' });
    }

    // Check if already responded
    if (review.hasResponse) {
      return res.status(400).json({ error: 'You have already responded to this review' });
    }

    // Update review with response
    await db
      .update(contractorReviews)
      .set({
        hasResponse: true,
        responseText,
        respondedAt: new Date(),
        respondedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(contractorReviews.reviewId, reviewId));

    logger.info('[Reviews] Response added', { reviewId, userId });

    res.json({ success: true, message: 'Response added successfully' });
  } catch (error: any) {
    logger.error('[Reviews] Respond to review error', error);
    res.status(500).json({ error: error.message || 'Failed to respond to review' });
  }
});

// =================== GET TRUST SCORE ===================

export default router;
