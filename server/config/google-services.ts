/**
 * Google Services Configuration
 * Initializes Google Maps Places API and Google Business Profile API
 */

import { initializeGoogleMapsPlaces } from '../services/googleMapsPlaces';
import { initializeGoogleBusinessProfile } from '../services/googleBusinessProfile';
import { logger } from '../lib/logger';

export function initializeGoogleServices() {
  // Initialize Google Maps Places API
  const mapsApiKey = process.env.GOOGLE_MAPS_API_KEY;
  
  if (mapsApiKey) {
    try {
      initializeGoogleMapsPlaces(mapsApiKey);
      logger.info('[Google Services] ✅ Google Maps Places API initialized');
    } catch (error) {
      logger.error('[Google Services] Failed to initialize Google Maps Places API:', error);
    }
  } else {
    logger.warn('[Google Services] GOOGLE_MAPS_API_KEY not set - Maps features disabled');
  }

  // Initialize Google Business Profile API (optional)
  const businessClientId = process.env.GOOGLE_BUSINESS_CLIENT_ID;
  const businessClientSecret = process.env.GOOGLE_BUSINESS_CLIENT_SECRET;
  const businessRefreshToken = process.env.GOOGLE_BUSINESS_REFRESH_TOKEN;
  const businessAccountId = process.env.GOOGLE_BUSINESS_ACCOUNT_ID;

  if (businessClientId && businessClientSecret && businessRefreshToken) {
    try {
      const gbpService = initializeGoogleBusinessProfile({
        clientId: businessClientId,
        clientSecret: businessClientSecret,
        redirectUri: 'https://developers.google.com/oauthplayground',
        refreshToken: businessRefreshToken
      });

      if (businessAccountId) {
        gbpService.setAccountId(businessAccountId);
        logger.info('[Google Services] ✅ Google Business Profile API initialized');
      } else {
        logger.warn('[Google Services] GOOGLE_BUSINESS_ACCOUNT_ID not set - Account ID required');
      }
    } catch (error) {
      logger.error('[Google Services] Failed to initialize Google Business Profile API:', error);
    }
  } else {
    logger.info('[Google Services] ℹ️ Google Business Profile API credentials not set (optional)');
  }
}

export function isGoogleMapsEnabled(): boolean {
  return !!process.env.GOOGLE_MAPS_API_KEY;
}

export function isGoogleBusinessEnabled(): boolean {
  return !!(
    process.env.GOOGLE_BUSINESS_CLIENT_ID &&
    process.env.GOOGLE_BUSINESS_CLIENT_SECRET &&
    process.env.GOOGLE_BUSINESS_REFRESH_TOKEN &&
    process.env.GOOGLE_BUSINESS_ACCOUNT_ID
  );
}
