/**
 * GOOGLE MAPS SERVICE
 * Centralized Google Maps API integration
 * 
 * Features:
 * - Geocoding (address → coordinates)
 * - Reverse geocoding (coordinates → address)
 * - Place search
 * - Memoized responses for performance
 * - Multi-language support
 */

import { Client, GeocodeResult, PlaceAutocompleteResult } from '@googlemaps/google-maps-services-js';
import { logger } from '../../lib/logger';
import memoizee from 'memoizee';

const googleMapsClient = new Client({});
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || '';

export interface GeocodedLocation {
  lat: number;
  lng: number;
  formattedAddress: string;
  city?: string;
  country?: string;
  placeId?: string;
}

/**
 * Geocode address to coordinates (uncached)
 */
async function _geocodeAddressUncached(
  address: string,
  language: string = 'he'
): Promise<GeocodedLocation | null> {
  try {
    if (!GOOGLE_MAPS_API_KEY) {
      logger.warn('[MapsService] Google Maps API key not configured');
      return null;
    }
    
    const response = await googleMapsClient.geocode({
      params: {
        address,
        key: GOOGLE_MAPS_API_KEY,
        language, // he, en, ar, ru, fr, es
        region: 'IL', // Prefer Israeli results
      },
    });
    
    if (response.data.results.length === 0) {
      logger.warn('[MapsService] No geocoding results', { address });
      return null;
    }
    
    const result = response.data.results[0];
    const location = result.geometry.location;
    
    // Extract city from address components
    const cityComponent = result.address_components?.find(
      c => c.types.includes('locality') || c.types.includes('administrative_area_level_1')
    );
    
    const countryComponent = result.address_components?.find(
      c => c.types.includes('country')
    );
    
    logger.info('[MapsService] Address geocoded', {
      address,
      lat: location.lat,
      lng: location.lng,
      language,
    });
    
    return {
      lat: location.lat,
      lng: location.lng,
      formattedAddress: result.formatted_address,
      city: cityComponent?.long_name,
      country: countryComponent?.long_name,
      placeId: result.place_id,
    };
  } catch (error: any) {
    logger.error('[MapsService] Geocoding failed', {
      address,
      error: error.message,
    });
    return null;
  }
}

/**
 * Geocode address with 1-hour cache
 */
export const geocodeAddress = memoizee(_geocodeAddressUncached, {
  promise: true,
  maxAge: 60 * 60 * 1000, // 1 hour
  preFetch: true,
  length: 2, // Cache by address and language
});

/**
 * Reverse geocode coordinates to address (uncached)
 */
async function _reverseGeocodeUncached(
  lat: number,
  lng: number,
  language: string = 'he'
): Promise<GeocodedLocation | null> {
  try {
    if (!GOOGLE_MAPS_API_KEY) {
      logger.warn('[MapsService] Google Maps API key not configured');
      return null;
    }
    
    const response = await googleMapsClient.reverseGeocode({
      params: {
        latlng: { lat, lng },
        key: GOOGLE_MAPS_API_KEY,
        language,
      },
    });
    
    if (response.data.results.length === 0) {
      logger.warn('[MapsService] No reverse geocoding results', { lat, lng });
      return null;
    }
    
    const result = response.data.results[0];
    
    const cityComponent = result.address_components?.find(
      c => c.types.includes('locality') || c.types.includes('administrative_area_level_1')
    );
    
    logger.info('[MapsService] Coordinates reverse geocoded', {
      lat,
      lng,
      address: result.formatted_address,
    });
    
    return {
      lat,
      lng,
      formattedAddress: result.formatted_address,
      city: cityComponent?.long_name,
      placeId: result.place_id,
    };
  } catch (error: any) {
    logger.error('[MapsService] Reverse geocoding failed', {
      lat,
      lng,
      error: error.message,
    });
    return null;
  }
}

/**
 * Reverse geocode with 1-hour cache
 */
export const reverseGeocode = memoizee(_reverseGeocodeUncached, {
  promise: true,
  maxAge: 60 * 60 * 1000,
  preFetch: true,
  length: 3, // Cache by lat, lng, and language
});

/**
 * Search for places (autocomplete)
 */
export async function searchPlaces(
  query: string,
  language: string = 'he',
  location?: { lat: number; lng: number },
  radius?: number
): Promise<PlaceAutocompleteResult[] | null> {
  try {
    if (!GOOGLE_MAPS_API_KEY) {
      logger.warn('[MapsService] Google Maps API key not configured');
      return null;
    }
    
    const response = await googleMapsClient.placeAutocomplete({
      params: {
        input: query,
        key: GOOGLE_MAPS_API_KEY,
        language,
        components: ['country:il'], // Restrict to Israel
        location: location ? `${location.lat},${location.lng}` : undefined,
        radius,
      },
    });
    
    logger.info('[MapsService] Places searched', {
      query,
      resultCount: response.data.predictions.length,
    });
    
    return response.data.predictions;
  } catch (error: any) {
    logger.error('[MapsService] Place search failed', {
      query,
      error: error.message,
    });
    return null;
  }
}

/**
 * Validate address exists
 */
export async function validateAddress(address: string, language: string = 'he'): Promise<boolean> {
  const result = await geocodeAddress(address, language);
  return result !== null;
}

/**
 * Calculate distance between two coordinates (Haversine formula)
 * Returns distance in kilometers
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLng = (lng2 - lng1) * (Math.PI / 180);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
    Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLng / 2) *
    Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return Math.round(distance * 100) / 100; // Round to 2 decimal places
}
