/**
 * Google Services Routes - 2025
 * Handles Google Business Profile, Google Maps Places API, and review management
 */

import { Router } from 'express';
import { logger } from '../lib/logger';

const router = Router();

/**
 * GET /api/google/places/:placeId - Get Google Maps place details with reviews
 * Returns place information including up to 5 most recent reviews and photos
 */
router.get('/places/:placeId', async (req, res) => {
  try {
    const { placeId } = req.params;
    const language = req.query.language as string || 'iw';

    const { getGoogleMapsPlaces } = await import('../services/googleMapsPlaces');
    const placesService = getGoogleMapsPlaces();

    const placeDetails = await placesService.getPlaceDetails(placeId, language);

    if (!placeDetails) {
      return res.status(404).json({ error: 'Place not found' });
    }

    res.json(placeDetails);
  } catch (error) {
    logger.error('[Google Places] Failed to fetch place details:', error);
    res.status(500).json({ error: 'Failed to fetch place details' });
  }
});

/**
 * GET /api/google/places/photo - Get Google Maps photo URL
 * Proxy endpoint to fetch photos with proper attribution
 */
router.get('/places/photo', async (req, res) => {
  try {
    const { reference, maxWidth } = req.query;

    if (!reference) {
      return res.status(400).json({ error: 'Photo reference required' });
    }

    const { getGoogleMapsPlaces } = await import('../services/googleMapsPlaces');
    const placesService = getGoogleMapsPlaces();

    const photoUrl = placesService.getPhotoUrl(
      reference as string,
      maxWidth ? parseInt(maxWidth as string) : 400
    );

    // Redirect to Google's photo URL
    res.redirect(photoUrl);
  } catch (error) {
    logger.error('[Google Places] Failed to fetch photo:', error);
    res.status(500).json({ error: 'Failed to fetch photo' });
  }
});

/**
 * GET /api/google/reviews/summary - Get AI-generated review summary
 * Uses Gemini to summarize customer reviews
 */
router.get('/reviews/summary', async (req, res) => {
  try {
    const { placeId, language } = req.query;

    if (!placeId) {
      return res.status(400).json({ error: 'Place ID required' });
    }

    const { getGoogleMapsPlaces } = await import('../services/googleMapsPlaces');
    const placesService = getGoogleMapsPlaces();

    const placeDetails = await placesService.getPlaceDetails(placeId as string);
    if (!placeDetails) {
      return res.status(404).json({ error: 'Place not found' });
    }

    const summary = await placesService.generateReviewSummary(
      placeDetails.reviews,
      (language as 'he' | 'en') || 'he'
    );

    res.json({ summary, reviewCount: placeDetails.reviews.length });
  } catch (error) {
    logger.error('[Google Reviews] Failed to generate summary:', error);
    res.status(500).json({ error: 'Failed to generate review summary' });
  }
});

/**
 * GET /api/google/business/reviews - Get all reviews from Google Business Profile
 * Requires authentication (admin only)
 */
router.get('/business/reviews', async (req, res) => {
  try {
    // Check if user is admin
    const firebaseUser = (req as any).firebaseUser;
    if (!firebaseUser) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { getFirestore } = await import('firebase-admin/firestore');
    const firestore = getFirestore();
    const userDoc = await firestore.collection('users').doc(firebaseUser.uid).get();
    const userData = userDoc.data();

    if (userData?.role !== 'admin' && userData?.role !== 'ceo') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { getGoogleBusinessProfile } = await import('../services/googleBusinessProfile');
    const gbpService = getGoogleBusinessProfile();

    const allReviews = await gbpService.getAllReviews();
    res.json(allReviews);
  } catch (error) {
    logger.error('[Google Business] Failed to fetch reviews:', error);
    res.status(500).json({ error: 'Failed to fetch business reviews' });
  }
});

/**
 * POST /api/google/business/reviews/:reviewId/reply - Reply to a review
 * Requires authentication (admin only)
 */
router.post('/business/reviews/:reviewId/reply', async (req, res) => {
  try {
    // Check if user is admin
    const firebaseUser = (req as any).firebaseUser;
    if (!firebaseUser) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { getFirestore } = await import('firebase-admin/firestore');
    const firestore = getFirestore();
    const userDoc = await firestore.collection('users').doc(firebaseUser.uid).get();
    const userData = userDoc.data();

    if (userData?.role !== 'admin' && userData?.role !== 'ceo') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { reviewId } = req.params;
    const { replyText } = req.body;

    if (!replyText) {
      return res.status(400).json({ error: 'Reply text required' });
    }

    const { getGoogleBusinessProfile } = await import('../services/googleBusinessProfile');
    const gbpService = getGoogleBusinessProfile();

    await gbpService.replyToReview(reviewId, replyText);

    logger.info(`[Google Business] Review reply posted by ${userData?.email}`);
    res.json({ success: true });
  } catch (error) {
    logger.error('[Google Business] Failed to post review reply:', error);
    res.status(500).json({ error: 'Failed to post review reply' });
  }
});

/**
 * POST /api/google/business/reviews/auto-respond - Auto-respond to unanswered reviews
 * Uses Gemini AI to generate and post responses
 * Requires authentication (admin only)
 */
router.post('/business/reviews/auto-respond', async (req, res) => {
  try {
    // Check if user is admin
    const firebaseUser = (req as any).firebaseUser;
    if (!firebaseUser) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { getFirestore } = await import('firebase-admin/firestore');
    const firestore = getFirestore();
    const userDoc = await firestore.collection('users').doc(firebaseUser.uid).get();
    const userData = userDoc.data();

    if (userData?.role !== 'admin' && userData?.role !== 'ceo') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { language } = req.body;

    const { getGoogleBusinessProfile } = await import('../services/googleBusinessProfile');
    const gbpService = getGoogleBusinessProfile();

    const responseCount = await gbpService.autoRespondToReviews(language || 'he');

    logger.info(`[Google Business] Auto-responded to ${responseCount} reviews by ${userData?.email}`);
    res.json({ success: true, responseCount });
  } catch (error) {
    logger.error('[Google Business] Auto-respond failed:', error);
    res.status(500).json({ error: 'Failed to auto-respond to reviews' });
  }
});

/**
 * GET /api/google/business/stats - Get review statistics
 * Requires authentication (admin only)
 */
router.get('/business/stats', async (req, res) => {
  try {
    // Check if user is admin
    const firebaseUser = (req as any).firebaseUser;
    if (!firebaseUser) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { getFirestore } = await import('firebase-admin/firestore');
    const firestore = getFirestore();
    const userDoc = await firestore.collection('users').doc(firebaseUser.uid).get();
    const userData = userDoc.data();

    if (userData?.role !== 'admin' && userData?.role !== 'ceo') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { getGoogleBusinessProfile } = await import('../services/googleBusinessProfile');
    const gbpService = getGoogleBusinessProfile();

    const stats = await gbpService.getReviewStats();
    res.json(stats);
  } catch (error) {
    logger.error('[Google Business] Failed to fetch stats:', error);
    res.status(500).json({ error: 'Failed to fetch review statistics' });
  }
});

export default router;
