/**
 * NAVIGATION UTILITIES
 * Generate Google Maps and Waze deep links
 * 
 * Features:
 * - Google Maps directions URLs
 * - Waze navigation URLs
 * - Consistent link formatting
 * - Support for labels and waypoints
 */

export interface NavigationLinks {
  googleMaps: string;
  waze: string;
  appleMaps: string;
}

/**
 * Build Google Maps navigation URL
 * 
 * @param lat - Latitude
 * @param lng - Longitude
 * @param label - Optional place label/name (used as destination_place_id or query, not replacing coordinates)
 * @returns Google Maps URL
 */
export function buildGoogleMapsUrl(params: {
  lat: number;
  lng: number;
  label?: string;
}): string {
  const { lat, lng, label } = params;
  
  // Google Maps URL format for directions
  // ALWAYS use coordinates as destination for accuracy
  const baseUrl = 'https://www.google.com/maps/dir/?api=1';
  const url = new URL(baseUrl);
  
  // Primary destination is ALWAYS coordinates for accuracy
  url.searchParams.set('destination', `${lat},${lng}`);
  url.searchParams.set('travelmode', 'driving');
  
  // Label is metadata only (URLSearchParams handles encoding)
  if (label) {
    url.searchParams.set('destination_name', label);
  }
  
  return url.toString();
}

/**
 * Build Waze navigation URL (popular in Israel)
 * 
 * @param lat - Latitude
 * @param lng - Longitude
 * @param navigate - Whether to start navigation immediately
 * @returns Waze deep link URL
 */
export function buildWazeUrl(params: {
  lat: number;
  lng: number;
  navigate?: boolean;
}): string {
  const { lat, lng, navigate = true } = params;
  
  // Waze URL format: https://waze.com/ul?ll=lat,lng&navigate=yes
  const baseUrl = 'https://waze.com/ul';
  const url = new URL(baseUrl);
  
  url.searchParams.set('ll', `${lat},${lng}`);
  if (navigate) {
    url.searchParams.set('navigate', 'yes');
  }
  
  return url.toString();
}

/**
 * Build Apple Maps URL (for iOS devices)
 * 
 * @param lat - Latitude
 * @param lng - Longitude
 * @param label - Optional place label/name
 * @returns Apple Maps URL
 */
export function buildAppleMapsUrl(params: {
  lat: number;
  lng: number;
  label?: string;
}): string {
  const { lat, lng, label } = params;
  
  // Apple Maps URL format
  const baseUrl = 'http://maps.apple.com/';
  const url = new URL(baseUrl);
  
  url.searchParams.set('ll', `${lat},${lng}`);
  url.searchParams.set('dirflg', 'd'); // Driving directions
  
  if (label) {
    url.searchParams.set('q', label);
  }
  
  return url.toString();
}

/**
 * Build all navigation links at once
 * 
 * @param lat - Latitude
 * @param lng - Longitude
 * @param label - Optional place label/name
 * @returns Object with Google Maps, Waze, and Apple Maps URLs
 */
export function buildAllNavigationLinks(params: {
  lat: number;
  lng: number;
  label?: string;
}): NavigationLinks {
  return {
    googleMaps: buildGoogleMapsUrl(params),
    waze: buildWazeUrl(params),
    appleMaps: buildAppleMapsUrl(params),
  };
}

/**
 * Build multi-waypoint route URL (Google Maps only)
 * 
 * @param waypoints - Array of coordinates with optional labels
 * @returns Google Maps URL with multiple waypoints
 */
export function buildMultiWaypointUrl(waypoints: Array<{
  lat: number;
  lng: number;
  label?: string;
}>): string {
  if (waypoints.length < 2) {
    throw new Error('At least 2 waypoints required for routing');
  }
  
  const baseUrl = 'https://www.google.com/maps/dir/?api=1';
  const url = new URL(baseUrl);
  
  // ALWAYS use coordinates for origin (labels don't work reliably for origin)
  const origin = waypoints[0];
  url.searchParams.set('origin', `${origin.lat},${origin.lng}`);
  
  // ALWAYS use coordinates for destination
  const destination = waypoints[waypoints.length - 1];
  url.searchParams.set('destination', `${destination.lat},${destination.lng}`);
  
  // Middle waypoints ALWAYS use coordinates
  if (waypoints.length > 2) {
    const middleWaypoints = waypoints.slice(1, -1).map(wp =>
      `${wp.lat},${wp.lng}`
    );
    url.searchParams.set('waypoints', middleWaypoints.join('|'));
  }
  
  url.searchParams.set('travelmode', 'driving');
  
  return url.toString();
}
