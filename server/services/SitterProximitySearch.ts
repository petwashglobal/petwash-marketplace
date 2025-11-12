/**
 * Proximity-Based Sitter Search Engine
 * Like Uber - finds nearest sitters based on user location
 * Loyalty members only
 */

import { logger } from '../lib/logger';

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

      // In production: Query database with PostGIS or similar
      // For now: Mock data showing the algorithm
      const mockSitters = [
        {
          id: 1,
          fullName: "Sarah Cohen",
          city: "Tel Aviv",
          bio: "Experienced dog walker with 5+ years caring for pets",
          rating: 4.8,
          totalReviews: 127,
          pricePerDayCents: 15000, // 150 ILS
          latitude: 32.0853,
          longitude: 34.7818,
          profilePhotoUrl: null,
          specializations: ["dogs", "cats"],
          verificationStatus: "active",
        },
        {
          id: 2,
          fullName: "David Levi",
          city: "Ramat Gan",
          bio: "Pet lover specializing in exotic animals",
          rating: 4.9,
          totalReviews: 89,
          pricePerDayCents: 18000, // 180 ILS
          latitude: 32.0668,
          longitude: 34.8244,
          profilePhotoUrl: null,
          specializations: ["exotic", "birds", "rabbits"],
          verificationStatus: "active",
        },
      ];

      // Calculate distances and filter by radius
      const sittersWithDistance = mockSitters
        .filter(sitter => sitter.verificationStatus === "active") // Only active sitters
        .map(sitter => {
          const distance = this.calculateDistance(
            userLocation.latitude,
            userLocation.longitude,
            sitter.latitude,
            sitter.longitude
          );

          return {
            id: sitter.id,
            fullName: sitter.fullName,
            city: sitter.city,
            bio: sitter.bio,
            rating: sitter.rating,
            totalReviews: sitter.totalReviews,
            pricePerDay: sitter.pricePerDayCents / 100,
            distanceKm: distance,
            profilePhotoUrl: sitter.profilePhotoUrl,
            services: sitter.specializations,
          };
        })
        .filter(sitter => sitter.distanceKm <= radiusKm) // Within radius
        .sort((a, b) => a.distanceKm - b.distanceKm); // Sort by nearest first

      logger.info('[Proximity Search] Found sitters', {
        count: sittersWithDistance.length,
      });

      return sittersWithDistance;
    } catch (error) {
      logger.error('[Proximity Search] Search failed', { error });
      return [];
    }
  }

  /**
   * Check if user is verified loyalty member (required for booking)
   */
  async isEligibleToBook(userId: string, loyaltyTier: string | null): Promise<boolean> {
    // Loyalty member verification
    if (!loyaltyTier) {
      logger.warn('[Eligibility] User not a loyalty member', { userId });
      return false;
    }

    // All loyalty tiers can book (bronze, silver, gold, platinum, diamond)
    const validTiers = ['bronze', 'silver', 'gold', 'platinum', 'diamond'];
    const isValid = validTiers.includes(loyaltyTier.toLowerCase());

    if (!isValid) {
      logger.warn('[Eligibility] Invalid loyalty tier', { userId, loyaltyTier });
    }

    return isValid;
  }
}

export const proximitySearch = new SitterProximitySearch();
