/**
 * GeolocationService - Country Detection & Same-Country Enforcement
 * 
 * Pet Wash Stay™ is a GLOBAL service but bookings must be WITHIN same country only.
 * 
 * Features:
 * - IP-based country detection (multiple fallback APIs)
 * - Browser geolocation for precise location
 * - Same-country booking enforcement
 * - Smart routing based on location
 * - Compliance management by country
 */

import { COUNTRY_TO_LANGUAGE, type LanguageCode } from '../../shared/languages';

export interface GeolocationData {
  // Country Information
  countryCode: string;        // ISO 2-letter code (IL, US, GB, etc.)
  countryName: string;        // Full country name
  countryCode3: string;       // ISO 3-letter code (ISR, USA, GBR, etc.)
  
  // Location Details
  city: string;
  region: string;             // State/Province
  latitude: number;
  longitude: number;
  timezone: string;
  
  // Network Info
  ip: string;
  
  // Detected Settings
  currency: string;           // ISO currency code (ILS, USD, EUR, etc.)
  language: LanguageCode;     // Detected language preference
  
  // Verification
  timestamp: number;
  source: 'ip-api' | 'ipapi' | 'ipinfo' | 'browser' | 'manual';
  confidence: 'high' | 'medium' | 'low';
}

export interface SameCountryValidation {
  isValid: boolean;
  ownerCountry: string;
  sitterCountry: string;
  error?: string;
  distance?: number; // km between locations (if available)
}

export class GeolocationService {
  private cache: Map<string, GeolocationData> = new Map();
  private readonly CACHE_DURATION = 86400000; // 24 hours

  /**
   * Detect user country from IP address
   * Uses multiple fallback APIs for reliability
   */
  async detectCountryFromIP(ip: string): Promise<GeolocationData> {
    // Check cache first
    const cached = this.cache.get(ip);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached;
    }

    // Try multiple APIs in order of preference
    const apis = [
      () => this.useIPAPI(ip),
      () => this.useIPAPIco(ip),
      () => this.useIPInfo(ip),
    ];

    for (const api of apis) {
      try {
        const data = await api();
        this.cache.set(ip, data);
        console.log(`[Geolocation] ✅ Detected country: ${data.countryName} (${data.countryCode}) from ${data.source}`);
        return data;
      } catch (error) {
        console.warn(`[Geolocation] API failed:`, error);
        continue;
      }
    }

    throw new Error('All geolocation APIs failed');
  }

  /**
   * Primary API: ip-api.com (free, 45 req/min)
   */
  private async useIPAPI(ip: string): Promise<GeolocationData> {
    const response = await fetch(`http://ip-api.com/json/${ip}`);
    
    if (!response.ok) {
      throw new Error(`ip-api.com returned ${response.status}`);
    }

    const data = await response.json();
    
    if (data.status !== 'success') {
      throw new Error(data.message || 'ip-api.com failed');
    }

    return {
      countryCode: data.countryCode,
      countryName: data.country,
      countryCode3: this.convertISO2toISO3(data.countryCode),
      city: data.city,
      region: data.regionName,
      latitude: data.lat,
      longitude: data.lon,
      timezone: data.timezone,
      ip: data.query,
      currency: data.currency || 'USD',
      language: COUNTRY_TO_LANGUAGE[data.countryCode] || 'en',
      timestamp: Date.now(),
      source: 'ip-api',
      confidence: 'high',
    };
  }

  /**
   * Fallback API: ipapi.co (free, 1000 req/day)
   */
  private async useIPAPIco(ip: string): Promise<GeolocationData> {
    const response = await fetch(`https://ipapi.co/${ip}/json/`);
    
    if (!response.ok) {
      throw new Error(`ipapi.co returned ${response.status}`);
    }

    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.reason || 'ipapi.co failed');
    }

    return {
      countryCode: data.country_code,
      countryName: data.country_name,
      countryCode3: data.country_code_iso3,
      city: data.city,
      region: data.region,
      latitude: data.latitude,
      longitude: data.longitude,
      timezone: data.timezone,
      ip: data.ip,
      currency: data.currency,
      language: COUNTRY_TO_LANGUAGE[data.country_code] || 'en',
      timestamp: Date.now(),
      source: 'ipapi',
      confidence: 'high',
    };
  }

  /**
   * Fallback API: ipinfo.io (free, 50k req/month)
   */
  private async useIPInfo(ip: string): Promise<GeolocationData> {
    const response = await fetch(`https://ipinfo.io/${ip}/json`);
    
    if (!response.ok) {
      throw new Error(`ipinfo.io returned ${response.status}`);
    }

    const data = await response.json();
    
    const [lat, lon] = (data.loc || '0,0').split(',').map(Number);

    return {
      countryCode: data.country,
      countryName: data.country, // ipinfo doesn't provide full name
      countryCode3: this.convertISO2toISO3(data.country),
      city: data.city,
      region: data.region,
      latitude: lat,
      longitude: lon,
      timezone: data.timezone || 'UTC',
      ip: data.ip,
      currency: 'USD', // ipinfo doesn't provide currency
      language: COUNTRY_TO_LANGUAGE[data.country] || 'en',
      timestamp: Date.now(),
      source: 'ipinfo',
      confidence: 'medium',
    };
  }

  /**
   * Convert ISO 2-letter country code to ISO 3-letter
   */
  private convertISO2toISO3(iso2: string): string {
    const mapping: Record<string, string> = {
      IL: 'ISR',
      US: 'USA',
      GB: 'GBR',
      AU: 'AUS',
      CA: 'CAN',
      FR: 'FRA',
      DE: 'DEU',
      ES: 'ESP',
      IT: 'ITA',
      RU: 'RUS',
      CN: 'CHN',
      JP: 'JPN',
      SA: 'SAU',
      AE: 'ARE',
      // Add more as needed
    };
    
    return mapping[iso2] || iso2;
  }

  /**
   * CRITICAL: Validate same-country booking
   * Pet Wash Stay™ only allows bookings within the same country
   */
  async validateSameCountry(
    ownerLocation: GeolocationData,
    sitterLocation: GeolocationData
  ): Promise<SameCountryValidation> {
    // Normalize country codes (use 2-letter)
    const ownerCountry = ownerLocation.countryCode.toUpperCase();
    const sitterCountry = sitterLocation.countryCode.toUpperCase();

    if (ownerCountry === sitterCountry) {
      return {
        isValid: true,
        ownerCountry,
        sitterCountry,
        distance: this.calculateDistance(
          ownerLocation.latitude,
          ownerLocation.longitude,
          sitterLocation.latitude,
          sitterLocation.longitude
        ),
      };
    }

    return {
      isValid: false,
      ownerCountry,
      sitterCountry,
      error: `Cross-border bookings not allowed. Owner is in ${ownerLocation.countryName}, sitter is in ${sitterLocation.countryName}. Pet Wash Stay™ only operates within the same country.`,
    };
  }

  /**
   * Calculate distance between two points (Haversine formula)
   * Returns distance in kilometers
   */
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
      Math.cos(this.toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    return Math.round(R * c);
  }

  private toRadians(degrees: number): number {
    return (degrees * Math.PI) / 180;
  }

  /**
   * Get country restrictions for a specific country
   */
  getCountryRestrictions(countryCode: string): {
    allowsBookings: boolean;
    requiresVerification: boolean;
    maxDistance?: number; // Maximum km between owner and sitter
    message?: string;
  } {
    const code = countryCode.toUpperCase();

    // Israel - strict verification
    if (code === 'IL' || code === 'ISR') {
      return {
        allowsBookings: true,
        requiresVerification: true,
        maxDistance: 300, // Max 300km (Israel is small)
        message: 'Israel: Biometric KYC required for all parties',
      };
    }

    // USA - regional restrictions
    if (code === 'US' || code === 'USA') {
      return {
        allowsBookings: true,
        requiresVerification: true,
        message: 'USA: Background check required in most states',
      };
    }

    // Default for all countries
    return {
      allowsBookings: true,
      requiresVerification: true,
      message: 'Same-country bookings only',
    };
  }

  /**
   * Get smart route/redirect based on user location
   */
  getSmartRoute(location: GeolocationData): string {
    const countryCode = location.countryCode.toUpperCase();

    // Special country-specific landing pages
    if (countryCode === 'IL' || countryCode === 'ISR') {
      return '/he/home'; // Hebrew homepage for Israel
    }

    if (countryCode === 'US' || countryCode === 'USA') {
      return '/en/home'; // English homepage for USA
    }

    // Default based on detected language
    return `/${location.language}/home`;
  }
}

// Export singleton instance
export const geolocationService = new GeolocationService();
