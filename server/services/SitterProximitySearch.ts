/**
 * Proximity-Based Sitter Search Engine
 * on-demand model - finds nearest sitters based on user location
 * Loyalty members only
 *
 * Geocoding fallback: if a sitter's DB record has no lat/lng,
 * the city name is geocoded via Google Maps and the result is
 * cached back to the DB so the next search is instant.
 */

import { logger } from '../lib/logger';
import { db } from '../db';
import { sitterProfiles } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { geocodeAddress } from './location/MapsService';

interface Location {
  latitude: number;
  longitude: number;
}

interface SitterSearchResult {
  id: number;
  fullName: string;
  city: string;
  bio: string;
  rating: number;
  totalReviews: number;
  pricePerDay: number;
  distanceKm: number;
  profilePhotoUrl: string | null;
  services: string[];
}

/** In-process cache: city → coordinates (avoids re-geocoding same city repeatedly) */
const cityCoordCache = new Map<string, { lat: number; lng: number } | null>();

export class SitterProximitySearch {
  /**
   * Haversine formula — calculates distance between two GPS coordinates
   * Returns distance in kilometres
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
        Math.cos(this.toRadians(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 10) / 10;
  }

  private toRadians(d: number): number {
    return d * (Math.PI / 180);
  }

  /**
   * Resolve coordinates for a sitter:
   * 1. Use stored lat/lng if already present.
   * 2. Geocode city name via Google Maps and persist result to DB.
   * 3. Returns null if both fail.
   */
  private async resolveCoordinates(
    sitter: typeof sitterProfiles.$inferSelect
  ): Promise<{ lat: number; lng: number } | null> {
    if (sitter.latitude && sitter.longitude) {
      return { lat: Number(sitter.latitude), lng: Number(sitter.longitude) };
    }

    if (!sitter.city) return null;

    const cacheKey = sitter.city.trim().toLowerCase();
    if (cityCoordCache.has(cacheKey)) {
      return cityCoordCache.get(cacheKey) ?? null;
    }

    try {
      const searchAddress = `${sitter.city}, Israel`;
      logger.info('[Proximity Search] Geocoding city for sitter', {
        sitterId: sitter.id,
        city: sitter.city,
      });

      const result = await geocodeAddress(searchAddress);
      if (!result) {
        cityCoordCache.set(cacheKey, null);
        return null;
      }

      const coords = { lat: result.lat, lng: result.lng };
      cityCoordCache.set(cacheKey, coords);

      // Persist coordinates back to DB so next search is instant
      await db
        .update(sitterProfiles)
        .set({
          latitude: coords.lat.toString(),
          longitude: coords.lng.toString(),
        })
        .where(eq(sitterProfiles.id, sitter.id));

      logger.info('[Proximity Search] Geocoded and persisted coordinates', {
        sitterId: sitter.id,
        city: sitter.city,
        lat: coords.lat,
        lng: coords.lng,
      });

      return coords;
    } catch (err: any) {
      logger.warn('[Proximity Search] Geocoding failed for sitter city', {
        sitterId: sitter.id,
        city: sitter.city,
        error: err.message,
      });
      cityCoordCache.set(cacheKey, null);
      return null;
    }
  }

  /**
   * Find sitters within radius (on-demand model driver search)
   * Only available to verified loyalty members
   */
  async findSittersNearby(
    userLocation: Location,
    radiusKm: number = 25,
    serviceType?: string
  ): Promise<SitterSearchResult[]> {
    try {
      logger.info('[Proximity Search] Finding sitters nearby', {
        userLocation,
        radiusKm,
        serviceType,
      });

      const activeSitters = await db
        .select()
        .from(sitterProfiles)
        .where(eq(sitterProfiles.verificationStatus, 'active'));

      logger.info('[Proximity Search] Retrieved sitters from database', {
        totalCount: activeSitters.length,
      });

      // Resolve coordinates for every sitter in parallel
      const coordResults = await Promise.all(
        activeSitters.map(s => this.resolveCoordinates(s))
      );

      const sittersWithDistance: SitterSearchResult[] = [];

      for (let i = 0; i < activeSitters.length; i++) {
        const sitter = activeSitters[i];
        const coords = coordResults[i];
        if (!coords) continue;

        const distance = this.calculateDistance(
          userLocation.latitude,
          userLocation.longitude,
          coords.lat,
          coords.lng
        );

        if (distance > radiusKm) continue;

        if (serviceType && !(sitter.specializations || []).includes(serviceType)) continue;

        sittersWithDistance.push({
          id: sitter.id,
          fullName: `${sitter.firstName} ${sitter.lastName}`,
          city: sitter.city,
          bio: sitter.bio || '',
          rating: Number(sitter.rating) || 0,
          totalReviews: sitter.totalBookings,
          pricePerDay: sitter.pricePerDayCents / 100,
          distanceKm: distance,
          profilePhotoUrl: sitter.profilePictureUrl,
          services: sitter.specializations || [],
        });
      }

      sittersWithDistance.sort((a, b) => a.distanceKm - b.distanceKm);

      logger.info('[Proximity Search] Found sitters', {
        count: sittersWithDistance.length,
        radiusKm,
        serviceType,
        geocodedCount: coordResults.filter(Boolean).length,
        skippedCount: coordResults.filter(c => !c).length,
      });

      return sittersWithDistance;
    } catch (error) {
      logger.error('[Proximity Search] Search failed', error);
      return [];
    }
  }

  /**
   * Check if user is verified loyalty member (required for booking)
   * 7-star loyalty system: bronze → silver → gold → platinum → diamond → emerald → royal
   */
  async isEligibleToBook(userId: string, loyaltyTier: string | null): Promise<boolean> {
    if (!loyaltyTier) {
      logger.warn('[Eligibility] User not a loyalty member', { userId });
      return false;
    }
    const validTiers = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'emerald', 'royal'];
    const isValid = validTiers.includes(loyaltyTier.toLowerCase());
    if (!isValid) {
      logger.warn('[Eligibility] Invalid loyalty tier', { userId, loyaltyTier });
    }
    return isValid;
  }
}

export const proximitySearch = new SitterProximitySearch();
