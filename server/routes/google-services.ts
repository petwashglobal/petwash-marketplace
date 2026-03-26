/**
 * Google Services Routes — PetWash™
 * ===================================
 * Handles Google Maps Places API and Google Business Profile.
 *
 * GOOGLE ARCHITECTURE POLICY — Section 2.6 (Maps/Places)
 * -------------------------------------------------------
 * STATUS: KEEP — active production integration
 *
 * PURPOSE:
 *   - Location autocomplete for booking/address input (Places Autocomplete API)
 *   - Place details and reviews for K9000 station display (Places Details API)
 *   - Business profile photo proxy with proper attribution
 *
 * SCOPE REQUIRED:
 *   - GOOGLE_MAPS_API_KEY — restricted to Places API only (no broad access)
 *   - API key should be restricted to server IP + referrer petwash.co.il in GCP Console
 *
 * FAILURE SEMANTICS:
 *   - Google Maps is Google-OPTIONAL (Section 4.2 of policy)
 *   - A Maps outage degrades location UX but never blocks payments or tax docs
 *   - Rate limiting is enforced at the proxy level (placesAutocompleteLimiter, placesDetailsLimiter)
 *   - Abuse detection: session token validation, IP-based limits
 *
 * CANONICAL DATA:
 *   - Station locations (lat/lng, address) are stored in PostgreSQL
 *   - Maps API is used for display and search only — never as the source of truth
 *
 * WHAT MAPS MUST NOT DO:
 *   - Store payment or wallet data
 *   - Be used as the booking source of truth
 *   - Hold customer PII beyond the request/response lifecycle
 */

import { Router } from 'express';
import { logger } from '../lib/logger';
import { db as firestore } from '../lib/firebase-admin';
import rateLimit from 'express-rate-limit';

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

import { randomUUID } from 'crypto';

logger.info('[GoogleMaps] keyPresent=' + !!process.env.GOOGLE_MAPS_API_KEY);

// ── Fix 1: Per-IP rate limiter with spike logging on limit hit ────────────────
const placesAutocompleteLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip || 'unknown',
  validate: { xForwardedForHeader: false, ip: false, default: false },
  handler: (req, res) => {
    logger.warn('[Places Proxy] IP rate limit HIT - possible abuse or fast typist', {
      ip: req.ip,
      origin: req.headers['origin'],
      userAgent: (req.headers['user-agent'] as string)?.substring(0, 80),
    });
    res.status(429).json({ error: 'Too many address searches, please slow down', reasonCode: 'RATE_LIMITED' });
  },
});

// ── Details rate limiter — one place lookup per autocomplete selection ────────
// Details should only be called once per selected prediction; 20/min per IP
// is generous for normal use while blocking enumeration scraping.
const placesDetailsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip || 'unknown',
  validate: { xForwardedForHeader: false, ip: false, default: false },
  handler: (req, res) => {
    logger.warn('[Places Proxy] Details rate limit HIT - possible place enumeration', {
      ip: req.ip,
      origin: req.headers['origin'],
      userAgent: (req.headers['user-agent'] as string)?.substring(0, 80),
    });
    res.status(429).json({ error: 'Too many address lookups, please slow down', reasonCode: 'DETAILS_RATE_LIMITED' });
  },
});

// ── Fix 4: Per-session rate limiter (second limiter keyed by session UUID) ────
// Limits one browser session to 50 req/min regardless of IP rotation.
const placesSessionLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const session = req.headers['x-places-session'] as string | undefined;
    return session && /^[0-9a-f-]{36}$/.test(session)
      ? `session:${session}`
      : `ip-fallback:${req.ip || 'unknown'}`;
  },
  validate: { xForwardedForHeader: false, ip: false, default: false },
  handler: (req, res) => {
    logger.warn('[Places Proxy] SESSION rate limit HIT - possible scraper', {
      session: (req.headers['x-places-session'] as string)?.substring(0, 12) + '...',
      ip: req.ip,
      origin: req.headers['origin'],
    });
    res.status(429).json({ error: 'Too many searches from this session', reasonCode: 'SESSION_RATE_LIMITED' });
  },
});

// ── Fix 2: Strict hostname matching ──────────────────────────────────────────
// Accepts exact domain match OR subdomain (e.g. app.petwash.co.il ✓, petwash.co.il.evil.com ✗)
function isAllowedHostname(hostname: string, allowedDomains: string[]): boolean {
  const h = hostname.toLowerCase();
  return allowedDomains.some(domain => {
    const d = domain.toLowerCase();
    return h === d || h.endsWith('.' + d);
  });
}

// ── Fix 3: Internal service auth uses INTERNAL_SERVICE_SECRET env var ─────────
// x-internal-service header is spoofable from any browser. Instead, server-to-server
// calls must send x-internal-secret matching the env var (never exposed to frontend).
// Allowed origins for the Places proxy - prevents external sites burning your API quota.
function isAllowedPlacesOrigin(req: any): boolean {
  const origin = req.headers['origin'] as string | undefined;
  const referer = req.headers['referer'] as string | undefined;
  const source = origin || referer || '';

  const envAllowed = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim()).filter(Boolean)
    : [];

  const defaultAllowed = [
    'petwash.co.il',
    'petwashglobal.com',
    'signinpetwash.web.app',
    'signinpetwash.firebaseapp.com',
    'replit.dev',
    'repl.co',
    'localhost',
    '127.0.0.1',
  ];

  // No Origin or Referer — this happens when Firebase Hosting proxies the
  // request to Cloud Run (the CDN layer strips both headers for same-origin
  // requests). Fall back to x-forwarded-host which Firebase always sets.
  if (!source) {
    // Check x-forwarded-host (Firebase Hosting sets this)
    const forwardedHost = (req.headers['x-forwarded-host'] as string | undefined)?.split(',')[0]?.trim();
    if (forwardedHost) {
      const fwHostname = forwardedHost.split(':')[0].toLowerCase();
      if (isAllowedHostname(fwHostname, [...defaultAllowed, ...envAllowed])) {
        return true;
      }
    }

    // Cloud Run internal: check x-forwarded-for for Cloud Run internal IPs,
    // or accept if running in Cloud Run (K_SERVICE env var is set by Cloud Run).
    // Firebase Hosting → Cloud Run rewrites always strip origin but set K_SERVICE.
    if (process.env.K_SERVICE) {
      // Running in Cloud Run — accept same-origin requests that have no origin header.
      // This is the standard behaviour for Firebase Hosting → Cloud Run rewrites.
      logger.info('[Places Proxy] Cloud Run origin-less request accepted (Firebase Hosting rewrite)', {
        service: process.env.K_SERVICE,
        fwHost: forwardedHost || 'none',
      });
      return true;
    }

    // True server-to-server call — require internal secret
    const secret = process.env.INTERNAL_SERVICE_SECRET;
    if (secret) {
      const provided = req.headers['x-internal-secret'] as string | undefined;
      if (provided && provided === secret) return true;
    }

    // Development without K_SERVICE — allow localhost
    if (process.env.NODE_ENV === 'development') {
      return true;
    }

    logger.warn('[Places Proxy] No-origin request blocked — set K_SERVICE or INTERNAL_SERVICE_SECRET');
    return false;
  }

  // Parse the URL — extract only the hostname to prevent path/query bypass attacks.
  // e.g. evil.com/?x=petwash.co.il or petwash.co.il.evil.com would NOT match.
  let hostname: string;
  try {
    hostname = new URL(source).hostname;
  } catch {
    logger.warn('[Places Proxy] Unparseable origin rejected', { source: source.substring(0, 80) });
    return false;
  }

  return isAllowedHostname(hostname, [...defaultAllowed, ...envAllowed]);
}

router.get('/places-health', async (req, res) => {
  const traceId = randomUUID().slice(0, 12);
  const checks: Record<string, any> = {
    traceId,
    timestamp: new Date().toISOString(),
    apiKeyConfigured: !!process.env.GOOGLE_MAPS_API_KEY,
    apiKeyLength: process.env.GOOGLE_MAPS_API_KEY?.length || 0,
  };

  if (!process.env.GOOGLE_MAPS_API_KEY) {
    checks.status = 'GOOGLE_KEY_MISSING';
    checks.reason = 'GOOGLE_MAPS_API_KEY env var not present in runtime';
    logger.error('[Places Health] API key missing', { traceId });
    // Always return HTTP 200 — callers must read the JSON status field, not the HTTP code.
    // Returning 4xx/5xx here causes curl -f to discard the body and hide the real cause.
    return res.status(200).json(checks);
  }

  try {
    const response = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': process.env.GOOGLE_MAPS_API_KEY!,
        'X-Goog-FieldMask': 'suggestions.placePrediction.placeId,suggestions.placePrediction.text',
      },
      body: JSON.stringify({ input: 'Tel Aviv', languageCode: 'en', includedRegionCodes: ['il'] }),
    });
    const data = await response.json();

    checks.googleHttpStatus = response.status;
    checks.apiVersion = 'v1';
    checks.predictionsCount = (data.suggestions || []).length;

    if (response.ok) {
      checks.status = 'OK';
      logger.info('[Places Health] Google Places API v1 is working', { traceId, httpStatus: response.status });
    } else if (response.status === 401 || response.status === 403) {
      checks.status = 'GOOGLE_KEY_INVALID';
      checks.reason = data.error?.message || `Google rejected key (HTTP ${response.status})`;
      logger.error('[Places Health] Google rejected API key', { traceId, httpStatus: response.status, googleError: data.error?.message });
    } else {
      checks.status = `HTTP_${response.status}`;
      checks.reason = data.error?.message || `Unexpected HTTP ${response.status} from Google`;
      logger.error('[Places Health] Google Places API unexpected error', { traceId, httpStatus: response.status, googleError: data.error?.message });
    }
  } catch (error: any) {
    checks.status = 'NETWORK_ERROR';
    checks.reason = `Could not reach Google Places API: ${error.message}`;
    logger.error('[Places Health] Network error contacting Google', { traceId, message: error.message });
  }

  // Always HTTP 200 — status is encoded in the JSON body, not the HTTP code.
  res.status(200).json(checks);
});

/**
 * GET /api/google/places-autocomplete - Server-side Google Places API v1 Autocomplete proxy
 * API key stays server-side. No browser key needed.
 * Session token forwarding: client sends x-places-session header; server forwards to Google
 * to group keystrokes into a single billing session (reduces cost, improves quality).
 * Uses Places API v1 (POST + X-Goog-FieldMask) for better billing and response quality.
 */
router.get('/places-autocomplete', placesAutocompleteLimiter, placesSessionLimiter, async (req, res) => {
  const traceId = randomUUID().slice(0, 12);
  try {
    if (!isAllowedPlacesOrigin(req)) {
      logger.warn('[Places Proxy] Rejected - origin not in allowlist', {
        traceId,
        origin: req.headers['origin'],
        referer: req.headers['referer'],
        ip: req.ip,
      });
      return res.status(403).json({ error: 'Forbidden', reasonCode: 'ORIGIN_NOT_ALLOWED', traceId });
    }

    // ── Spike detection: log WARN when a single IP approaches the rate limit ──
    const ipRateLimit = (req as any).rateLimit;
    if (ipRateLimit && ipRateLimit.current >= Math.floor(ipRateLimit.limit * 0.8)) {
      logger.warn('[Places Proxy] High usage spike - IP approaching limit', {
        traceId,
        ip: req.ip,
        current: ipRateLimit.current,
        limit: ipRateLimit.limit,
        remaining: ipRateLimit.remaining,
        origin: req.headers['origin'],
      });
    }

    const { input, language, components, types } = req.query;

    if (!input || typeof input !== 'string' || input.length < 2) {
      return res.status(400).json({ error: 'Input query required (min 2 chars)', traceId });
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      logger.error('[Places Proxy] GOOGLE_MAPS_API_KEY not configured', {
        traceId,
        reasonCode: 'MAPS_KEY_MISSING',
        path: req.path,
        userAgent: req.headers['user-agent']?.substring(0, 100),
      });
      return res.status(503).json({ error: 'Address search unavailable', reasonCode: 'MAPS_KEY_MISSING', traceId });
    }

    // Build Places API v1 request body
    // components arrives as "country:il|country:us" → strip prefix → ["il","us"]
    const regionCodes = components
      ? (components as string).split('|').map(c => c.replace(/^country:/i, '')).filter(Boolean)
      : [];

    // types arrives as "address|establishment" → ["address","establishment"]
    const primaryTypes = types
      ? (types as string).split('|').filter(Boolean)
      : [];

    const sessionToken = req.headers['x-places-session'] as string | undefined;
    const validSession = sessionToken && /^[0-9a-f-]{36}$/.test(sessionToken) ? sessionToken : undefined;

    const body: Record<string, unknown> = {
      input: input as string,
      languageCode: (language as string) || 'iw',
    };
    if (regionCodes.length > 0) body.includedRegionCodes = regionCodes;
    if (primaryTypes.length > 0) body.includedPrimaryTypes = primaryTypes;
    if (validSession) body.sessionToken = validSession;

    const response = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      const googleError = data.error;
      const reasonCode = response.status === 403 ? 'API_KEY_DENIED'
        : response.status === 429 ? 'QUOTA_EXCEEDED'
        : 'GOOGLE_API_ERROR';
      logger.warn('[Places Proxy] Google API v1 error', {
        traceId,
        reasonCode,
        httpStatus: response.status,
        googleCode: googleError?.code,
        googleMessage: googleError?.message,
        path: req.path,
      });
      return res.status(502).json({ error: 'Address search failed', reasonCode, traceId });
    }

    const suggestions: any[] = data.suggestions || [];

    logger.info('[Places Proxy] Autocomplete OK (v1)', {
      traceId,
      inputLength: input.length,
      resultCount: suggestions.length,
      hasSessionToken: !!validSession,
    });

    res.json({
      predictions: suggestions.map((s: any) => {
        const p = s.placePrediction;
        return {
          placeId: p.placeId,
          description: p.text?.text || '',
          mainText: p.structuredFormat?.mainText?.text || '',
          secondaryText: p.structuredFormat?.secondaryText?.text || '',
        };
      }),
    });
  } catch (error: any) {
    logger.error('[Places Proxy] Autocomplete error', {
      traceId,
      reasonCode: 'NETWORK_ERROR',
      message: error.message,
      path: req.path,
    });
    res.status(500).json({ error: 'Address search failed', reasonCode: 'NETWORK_ERROR', traceId });
  }
});

/**
 * GET /api/google/places-details - Server-side Google Places API v1 Details proxy
 * Returns structured address components for form auto-fill.
 * Uses Places API v1 (X-Goog-FieldMask + X-Goog-Places-Session-Token) to close billing session.
 */
router.get('/places-details', placesDetailsLimiter, async (req, res) => {
  const traceId = randomUUID().slice(0, 12);
  try {
    const { placeId, language } = req.query;

    if (!placeId || typeof placeId !== 'string') {
      return res.status(400).json({ error: 'placeId required', traceId });
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      logger.error('[Places Proxy] GOOGLE_MAPS_API_KEY not configured for details', {
        traceId,
        reasonCode: 'MAPS_KEY_MISSING',
      });
      return res.status(503).json({ error: 'Address details unavailable', reasonCode: 'MAPS_KEY_MISSING', traceId });
    }

    const sessionToken = req.headers['x-places-session'] as string | undefined;
    const validSession = sessionToken && /^[0-9a-f-]{36}$/.test(sessionToken) ? sessionToken : undefined;

    const detailsHeaders: Record<string, string> = {
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'formattedAddress,addressComponents,location,displayName',
    };
    if (language) detailsHeaders['X-Goog-LanguageCode'] = language as string;
    // Closing the session token on the details call is what makes autocomplete+details
    // count as ONE billing event instead of N keystrokes + 1 detail call.
    if (validSession) detailsHeaders['X-Goog-Places-Session-Token'] = validSession;

    const response = await fetch(
      `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
      { headers: detailsHeaders }
    );
    const data = await response.json();

    if (!response.ok) {
      const googleError = data.error;
      const reasonCode = response.status === 403 ? 'API_KEY_DENIED'
        : response.status === 404 ? 'PLACE_NOT_FOUND'
        : 'GOOGLE_API_ERROR';
      logger.warn('[Places Proxy] Details API v1 error', {
        traceId,
        reasonCode,
        httpStatus: response.status,
        googleCode: googleError?.code,
        googleMessage: googleError?.message,
      });
      return res.status(502).json({ error: 'Failed to get address details', reasonCode, traceId });
    }

    // Places API v1 response: addressComponents[].longText (not long_name)
    // and location.latitude / location.longitude (not geometry.location.lat/lng)
    const addressComponents: any[] = data.addressComponents || [];

    const getComponent = (type: string) =>
      addressComponents.find((c: any) => c.types?.includes(type))?.longText || '';

    const parsed = {
      formattedAddress: data.formattedAddress || '',
      streetNumber: getComponent('street_number'),
      street: getComponent('route'),
      city: getComponent('locality') || getComponent('administrative_area_level_2'),
      state: getComponent('administrative_area_level_1'),
      postalCode: getComponent('postal_code'),
      country: getComponent('country'),
      countryCode: addressComponents.find((c: any) => c.types?.includes('country'))?.shortText || '',
      lat: data.location?.latitude ?? null,
      lng: data.location?.longitude ?? null,
    };

    logger.info('[Places Proxy] Details parsed (v1)', {
      traceId,
      placeId,
      formattedAddress: parsed.formattedAddress,
      street: parsed.street,
      streetNumber: parsed.streetNumber,
      city: parsed.city,
      postalCode: parsed.postalCode,
      countryCode: parsed.countryCode,
      hasCoords: parsed.lat != null && parsed.lng != null,
      hasSessionToken: !!validSession,
      addressComponentCount: addressComponents.length,
      rawPostalCodeFound: !!addressComponents.find((c: any) => c.types?.includes('postal_code')),
    });

    res.json(parsed);
  } catch (error: any) {
    logger.error('[Places Proxy] Details error', {
      traceId,
      reasonCode: 'NETWORK_ERROR',
      message: error.message,
    });
    res.status(500).json({ error: 'Failed to get address details', reasonCode: 'NETWORK_ERROR', traceId });
  }
});

/**
 * GET /api/google/reverse-geocode - Convert GPS coordinates to a human-readable location name
 * Used by the "Use my location" button to show real address instead of hardcoded text
 */
router.get('/reverse-geocode', placesDetailsLimiter, async (req, res) => {
  const traceId = randomUUID().slice(0, 12);
  try {
    const { lat, lng, language } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({ error: 'lat and lng are required', traceId });
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ error: 'Maps unavailable', traceId });
    }

    const lang = (language as string) || 'iw';
    const params = new URLSearchParams({
      latlng: `${lat},${lng}`,
      key: apiKey,
      language: lang,
      result_type: 'sublocality|locality|administrative_area_level_2',
    });

    const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params}`);
    if (!response.ok) {
      return res.status(502).json({ error: 'Geocoding failed', traceId });
    }

    const data = await response.json() as any;
    if (data.status !== 'OK' || !data.results?.length) {
      return res.status(404).json({ error: 'No results', status: data.status, traceId });
    }

    // Extract the most useful name: sublocality > locality > admin_area_level_2
    const result = data.results[0];
    const components: any[] = result.address_components || [];
    const sublocality = components.find((c: any) => c.types.includes('sublocality') || c.types.includes('sublocality_level_1'));
    const locality = components.find((c: any) => c.types.includes('locality'));
    const area2 = components.find((c: any) => c.types.includes('administrative_area_level_2'));
    const bestName = sublocality?.long_name || locality?.long_name || area2?.long_name || result.formatted_address;

    return res.json({ name: bestName, formattedAddress: result.formatted_address, traceId });
  } catch (error: any) {
    logger.error('[ReverseGeocode] Error', { error: error.message, traceId });
    return res.status(500).json({ error: 'Internal error', traceId });
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
