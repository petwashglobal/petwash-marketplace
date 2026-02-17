/**
 * Proximity-Based Sitter Search Engine
 * Like Uber - finds nearest sitters based on user location
 * Loyalty members only
 */

import { logger } from '../lib/logger';
import { db } from '../db';
import { sitterProfiles } from '@shared/schema';
import { eq } from 'drizzle-orm';

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

export class SitterProximitySearch {
  /**
   * Haversine formula - calculates distance between two GPS coordinates
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
    const distance = R * c;
    
    return Math.round(distance * 10) / 10; // Round to 1 decimal
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Find sitters within radius (like Uber driver search)
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

      // Query active/verified sitters from database
      const activeSitters = await db
        .select()
        .from(sitterProfiles)
        .where(eq(sitterProfiles.verificationStatus, 'active'));

      logger.info('[Proximity Search] Retrieved sitters from database', {
        totalCount: activeSitters.length,
      });

      // Calculate distances and filter by radius
      const sittersWithDistance = activeSitters
        .map(sitter => {
          // Skip sitters without lat/lng coordinates
          if (!sitter.latitude || !sitter.longitude) {
            return null;
          }

          const distance = this.calculateDistance(
            userLocation.latitude,
            userLocation.longitude,
            Number(sitter.latitude),
            Number(sitter.longitude)
          );

          return {
            id: sitter.id,
            fullName: `${sitter.firstName} ${sitter.lastName}`,
            city: sitter.city,
            bio: sitter.bio || '',
            rating: Number(sitter.rating) || 0,
            totalReviews: sitter.totalBookings, // Use totalBookings as totalReviews proxy
            pricePerDay: sitter.pricePerDayCents / 100,
            distanceKm: distance,
            profilePhotoUrl: sitter.profilePictureUrl,
            services: sitter.specializations || [],
          };
        })
        .filter((sitter): sitter is SitterSearchResult => sitter !== null) // Type guard to filter out nulls
        .filter(sitter => sitter.distanceKm <= radiusKm) // Within radius
        .filter(sitter => {
          // Optional: filter by service type if provided
          if (!serviceType) return true;
          return sitter.services.includes(serviceType);
        })
        .sort((a, b) => a.distanceKm - b.distanceKm); // Sort by nearest first

      logger.info('[Proximity Search] Found sitters', {
        count: sittersWithDistance.length,
        radiusKm,
        serviceType,
      });

      return sittersWithDistance;
    } catch (error) {
      logger.error('[Proximity Search] Search failed', { error });
      return [];
    }
  }

  /**
   * Check if user is verified loyalty member (required for booking)
   * 7-star loyalty system: bronze, silver, gold, platinum, diamond, emerald, royal
   */
  async isEligibleToBook(userId: string, loyaltyTier: string | null): Promise<boolean> {
    // Loyalty member verification
    if (!loyaltyTier) {
      logger.warn('[Eligibility] User not a loyalty member', { userId });
      return false;
    }

    // All loyalty tiers can book (7-star system: bronze, silver, gold, platinum, diamond, emerald, royal)
    const validTiers = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'emerald', 'royal'];
    const isValid = validTiers.includes(loyaltyTier.toLowerCase());

    if (!isValid) {
      logger.warn('[Eligibility] Invalid loyalty tier', { userId, loyaltyTier });
    }

    return isValid;
  }
}

export const proximitySearch = new SitterProximitySearch();
