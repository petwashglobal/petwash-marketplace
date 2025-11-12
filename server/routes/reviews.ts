/**
 * Two-Sided Review System API Routes (2026 Contractor Lifecycle)
 * Supports owner → contractor AND contractor → owner reviews
 * Includes automatic flagging, AI trust scoring, and moderation
 */

import { Router, Request, Response } from 'express';
import { db } from '../db';
import {
  contractorReviews,
  contractorTrustScores,
  reviewFlaggingRules,
  insertContractorReviewSchema,
  sitterBookings,
  walkBookings,
  pettrekTrips
} from '@shared/schema';
import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import { auth } from '../lib/firebase-admin';
import { logger } from '../lib/logger';
import { nanoid } from 'nanoid';
import { triggerTrustScoreUpdate } from '../services/trustScoring';

const router = Router();

// Firebase authentication middleware
async function requireAuth(req: Request, res: Response, next: Function) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized - No token provided' });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(token);
    
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
      isContractor = sitterBooking.sitterId.toString() === userId;

      // Set subject based on review direction
      if (reviewType === 'owner_to_contractor') {
        if (!isOwner) {
          return res.status(403).json({ error: 'You are not the owner of this booking' });
        }
        subjectId = sitterBooking.sitterId.toString();
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
      isContractor = walkBooking.walkerId === userId;

      if (reviewType === 'owner_to_contractor') {
        if (!isOwner) {
          return res.status(403).json({ error: 'You are not the owner of this walk booking' });
        }
        subjectId = walkBooking.walkerId;
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

    } else {
      return res.status(400).json({ error: 'Invalid booking type. Must be: sitter, walker, or pettrek' });
    }

    // Check if review already exists for this booking
    const existingReview = await db
      .select()
      .from(contractorReviews)
      .where(
        and(
          eq(contractorReviews.bookingId, bookingId),
          eq(contractorReviews.reviewType, reviewType),
          eq(contractorReviews.reviewerId, userId)
        )
      )
      .limit(1);

    if (existingReview.length > 0) {
      return res.status(400).json({ error: 'You have already reviewed this booking' });
    }

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

          // Send Slack alert if required by rule
          if (rule.notifyManagement) {
            // TODO: Send Slack notification to management
            logger.error('[Review Flagging] Management notification required', {
              reviewId,
              keyword: rule.keyword,
              severity: rule.severity,
              bookingId
            });
          }

          // Only check first match for simplicity (critical keywords typically checked first)
          break;
        }
      }
    }

    // Insert review
    const [review] = await db.insert(contractorReviews).values({
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
      isVerifiedBooking: true, // Verified via booking validation above
      isVisible: !shouldAutoHide, // Only hide if rule explicitly requires it
      isPublic: true,
    }).returning();

    // Update trust score asynchronously (for contractor being reviewed)
    if (reviewType === 'owner_to_contractor') {
      triggerTrustScoreUpdate(subjectId, 'review_submitted').catch(err => {
        logger.error('[Trust Score] Failed to update', { contractorId: subjectId, error: err });
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

// =================== GET REVIEWS ===================

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
      .limit(Number(limit));

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

// =================== HELPER FUNCTIONS ===================

/**
 * Update contractor trust score (AI Trust Scoring Engine)
 * Combines review scores + vetting status + violations
 */
async function updateContractorTrustScore(
  contractorId: string,
  contractorType: 'sitter' | 'walker' | 'driver' | 'station_operator'
) {
  try {
    // Get all reviews for this contractor
    const reviews = await db
      .select()
      .from(contractorReviews)
      .where(
        and(
          eq(contractorReviews.subjectId, contractorId),
          eq(contractorReviews.reviewType, 'owner_to_contractor'),
          eq(contractorReviews.isVisible, true)
        )
      );

    const totalReviews = reviews.length;
    
    // Calculate average review score
    const avgReviewScore = totalReviews > 0
      ? reviews.reduce((sum, r) => sum + (r.overallRating || 0), 0) / totalReviews
      : 4.50;

    // Get total bookings (TODO: Query actual bookings from all platforms)
    const totalBookings = 0; // Placeholder

    // Calculate public trust score (4.0 - 5.0 scale)
    // Formula: Weighted average of review score + experience bonus
    let publicTrustScore = avgReviewScore;
    
    // Experience bonus: +0.10 for every 10 completed bookings (max +0.50)
    const experienceBonus = Math.min(0.50, (totalBookings / 10) * 0.10);
    publicTrustScore = Math.min(5.0, publicTrustScore + experienceBonus);

    // Determine badges
    const isRecommended = publicTrustScore >= 4.80 && totalReviews >= 10;
    const isPremiumBadge = publicTrustScore >= 4.95 && totalBookings >= 100;

    // Upsert trust score
    const existingScore = await db
      .select()
      .from(contractorTrustScores)
      .where(eq(contractorTrustScores.contractorId, contractorId))
      .limit(1);

    if (existingScore.length > 0) {
      await db
        .update(contractorTrustScores)
        .set({
          publicTrustScore: publicTrustScore.toFixed(2),
          reviewScore: avgReviewScore.toFixed(2),
          totalReviews,
          totalBookings,
          isRecommended,
          isPremiumBadge,
          lastCalculatedAt: new Date(),
          calculationNotes: `Updated based on ${totalReviews} reviews, avg ${avgReviewScore.toFixed(2)} stars`,
          updatedAt: new Date(),
        })
        .where(eq(contractorTrustScores.contractorId, contractorId));
    } else {
      await db.insert(contractorTrustScores).values({
        contractorId,
        contractorType,
        publicTrustScore: publicTrustScore.toFixed(2),
        reviewScore: avgReviewScore.toFixed(2),
        totalReviews,
        totalBookings,
        isRecommended,
        isPremiumBadge,
        calculationNotes: `Initial score based on ${totalReviews} reviews`,
      });
    }

    logger.info('[Trust Score] Updated', {
      contractorId,
      publicTrustScore: publicTrustScore.toFixed(2),
      totalReviews,
      isRecommended,
      isPremiumBadge
    });

  } catch (error) {
    logger.error('[Trust Score] Update error', { contractorId, error });
    throw error;
  }
}

export default router;
