/**
 * Google Services Routes - 2025
 * Handles Google Business Profile, Google Maps Places API, and review management
 */

import { Router } from 'express';
import { logger } from '../lib/logger';
import { db as firestore } from '../lib/firebase-admin';

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
 * GET /api/places/autocomplete - Server-side Google Places Autocomplete proxy
 * API key stays server-side. No browser key needed.
 */
router.get('/places-autocomplete', async (req, res) => {
  try {
    const { input, language, components, types } = req.query;

    if (!input || typeof input !== 'string' || input.length < 2) {
      return res.status(400).json({ error: 'Input query required (min 2 chars)' });
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      logger.error('[Places Proxy] GOOGLE_MAPS_API_KEY not configured');
      return res.status(503).json({ error: 'Address search unavailable' });
    }

    const params = new URLSearchParams({
      input: input as string,
      key: apiKey,
      language: (language as string) || 'iw',
    });
    if (components) params.append('components', components as string);
    if (types) params.append('types', types as string);

    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params}`
    );
    const data = await response.json();

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      logger.warn('[Places Proxy] Google API error', { status: data.status, error: data.error_message });
      return res.status(502).json({ error: 'Address search failed', googleStatus: data.status });
    }

    res.json({
      predictions: (data.predictions || []).map((p: any) => ({
        placeId: p.place_id,
        description: p.description,
        mainText: p.structured_formatting?.main_text,
        secondaryText: p.structured_formatting?.secondary_text,
      })),
    });
  } catch (error) {
    logger.error('[Places Proxy] Autocomplete error:', error);
    res.status(500).json({ error: 'Address search failed' });
  }
});

/**
 * GET /api/places/details - Server-side Google Place Details proxy
 * Returns structured address components for form auto-fill.
 */
router.get('/places-details', async (req, res) => {
  try {
    const { placeId, language } = req.query;

    if (!placeId || typeof placeId !== 'string') {
      return res.status(400).json({ error: 'placeId required' });
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ error: 'Address details unavailable' });
    }

    const params = new URLSearchParams({
      place_id: placeId,
      key: apiKey,
      language: (language as string) || 'iw',
      fields: 'address_components,formatted_address,geometry,name',
    });

    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?${params}`
    );
    const data = await response.json();

    if (data.status !== 'OK') {
      return res.status(502).json({ error: 'Failed to get address details', googleStatus: data.status });
    }

    const result = data.result;
    const components = result.address_components || [];

    const getComponent = (type: string) =>
      components.find((c: any) => c.types.includes(type))?.long_name || '';

    res.json({
      formattedAddress: result.formatted_address,
      streetNumber: getComponent('street_number'),
      street: getComponent('route'),
      city: getComponent('locality') || getComponent('administrative_area_level_2'),
      state: getComponent('administrative_area_level_1'),
      postalCode: getComponent('postal_code'),
      country: getComponent('country'),
      countryCode: components.find((c: any) => c.types.includes('country'))?.short_name || '',
      lat: result.geometry?.location?.lat,
      lng: result.geometry?.location?.lng,
    });
  } catch (error) {
    logger.error('[Places Proxy] Details error:', error);
    res.status(500).json({ error: 'Failed to get address details' });
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
