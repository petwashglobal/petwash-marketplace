/**
 * UNIFIED MARKETPLACE API
 * 
 * Aggregates provider data from all 6 platforms (Walk My Pet, Sitter Suite, PetTrek, Groomers, K9000, Hub)
 * Returns normalized discriminated-union types for frontend consumption
 * 
 * Architecture: Façade pattern - fans out to platform-specific routes and normalizes responses
 */

import { Router } from 'express';
import { db } from '../db';
import {
  walkerProfiles,
  sitterProfiles,
  marketplaceSearchFiltersSchema,
  type MarketplaceProvider,
  type WalkerProvider,
  type SitterProvider,
  type MarketplaceSearchResponse,
  type MarketplacePlatformId,
} from '@shared/schema';
import { eq, and, gte, lte, sql, desc, or } from 'drizzle-orm';
import { logger } from '../lib/logger';

const router = Router();

/**
 * POST /api/marketplace/search - Unified marketplace search
 * 
 * @description Search providers across all platforms with unified filters
 * @returns Normalized provider list with discriminated union types
 */
router.post('/search', async (req, res) => {
  try {
    // Validate and parse filters
    const filters = marketplaceSearchFiltersSchema.parse(req.body);
    
    logger.info('[Marketplace] Search request', {
      platform: filters.platform,
      city: filters.city,
      minRating: filters.minRating,
    });

    let providers: MarketplaceProvider[] = [];
    let total = 0;

    // Route to platform-specific search
    switch (filters.platform) {
      case 'walk_my_pet':
        ({ providers, total } = await searchWalkers(filters));
        break;
      
      case 'sitter_suite':
        ({ providers, total } = await searchSitters(filters));
        break;
      
      case 'pet_trek':
        ({ providers, total } = await searchDrivers(filters));
        break;
      
      case 'groomers':
        ({ providers, total } = await searchGroomers(filters));
        break;
      
      case 'k9000':
        // K9000 doesn't have providers - return empty
        providers = [];
        total = 0;
        break;
      
      default:
        return res.status(400).json({ error: 'Invalid platform' });
    }

    const response: MarketplaceSearchResponse = {
      providers,
      total,
      platform: filters.platform,
      filters,
    };

    logger.info('[Marketplace] Search completed', {
      platform: filters.platform,
      resultsCount: providers.length,
      total,
    });

    res.json(response);
  } catch (error: any) {
    logger.error('[Marketplace] Search error', { error: error.message });
    
    if (error.name === 'ZodError') {
      return res.status(400).json({ 
        error: 'Invalid search filters', 
        details: error.errors 
      });
    }
    
    res.status(500).json({ error: 'Marketplace search failed' });
  }
});

/**
 * Search walkers (Walk My Pet platform)
 */
async function searchWalkers(filters: MarketplaceSearchFilters): Promise<{
  providers: WalkerProvider[];
  total: number;
}> {
  try {
    let query = db.select().from(walkerProfiles)
      .where(eq(walkerProfiles.isActive, true));

    // Build WHERE conditions
    const conditions = [eq(walkerProfiles.isActive, true)];

    if (filters.city) {
      conditions.push(eq(walkerProfiles.city, filters.city));
    }

    if (filters.minRating && filters.minRating > 0) {
      conditions.push(gte(walkerProfiles.averageRating, filters.minRating.toString()));
    }

    if (filters.verifiedOnly) {
      conditions.push(eq(walkerProfiles.verificationStatus, 'verified'));
    }

    if (filters.bodyCamera !== undefined) {
      conditions.push(eq(walkerProfiles.bodyCamera, filters.bodyCamera));
    }

    if (filters.droneAccess !== undefined) {
      conditions.push(eq(walkerProfiles.droneAccess, filters.droneAccess));
    }

    // Execute query
    const results = await db.select().from(walkerProfiles)
      .where(and(...conditions))
      .orderBy(desc(walkerProfiles.averageRating))
      .limit(filters.limit || 20)
      .offset(filters.offset || 0);

    // Get total count
    const [countResult] = await db.select({ count: sql`count(*)` })
      .from(walkerProfiles)
      .where(and(...conditions));

    const total = Number(countResult?.count || 0);

    // Map to WalkerProvider type
    const providers: WalkerProvider[] = results.map(walker => ({
      kind: 'walker' as const,
      platform: 'walk_my_pet' as const,
      id: walker.id,
      userId: walker.userId,
      walkerId: walker.walkerId,
      firstName: walker.firstName,
      lastName: walker.lastName,
      email: walker.email,
      phone: walker.phone,
      city: walker.city,
      bio: walker.bio,
      profilePictureUrl: walker.profilePictureUrl,
      rating: walker.averageRating,
      totalBookings: walker.totalWalks,
      isActive: walker.isActive,
      isVerified: walker.verificationStatus === 'verified',
      priceDisplay: walker.hourlyRate ? `₪${walker.hourlyRate}/hr` : 'Contact for price',
      hourlyRate: walker.hourlyRate,
      bodyCamera: walker.bodyCamera,
      droneAccess: walker.droneAccess,
      certifications: walker.certifications,
      serviceArea: walker.serviceAreaRadius,
      yearsOfExperience: walker.yearsOfExperience,
      createdAt: walker.createdAt,
    }));

    return { providers, total };
  } catch (error) {
    logger.error('[Marketplace] Walker search error', { error });
    throw error;
  }
}

/**
 * Search sitters (Sitter Suite platform)
 */
async function searchSitters(filters: MarketplaceSearchFilters): Promise<{
  providers: SitterProvider[];
  total: number;
}> {
  try {
    const conditions = [eq(sitterProfiles.isActive, true)];

    if (filters.city) {
      conditions.push(eq(sitterProfiles.city, filters.city));
    }

    if (filters.minRating && filters.minRating > 0) {
      conditions.push(gte(sitterProfiles.rating, filters.minRating.toString()));
    }

    if (filters.verifiedOnly) {
      conditions.push(eq(sitterProfiles.isVerified, true));
    }

    // Execute query
    const results = await db.select().from(sitterProfiles)
      .where(and(...conditions))
      .orderBy(desc(sitterProfiles.rating))
      .limit(filters.limit || 20)
      .offset(filters.offset || 0);

    // Get total count
    const [countResult] = await db.select({ count: sql`count(*)` })
      .from(sitterProfiles)
      .where(and(...conditions));

    const total = Number(countResult?.count || 0);

    // Map to SitterProvider type
    const providers: SitterProvider[] = results.map(sitter => ({
      kind: 'sitter' as const,
      platform: 'sitter_suite' as const,
      id: sitter.id,
      userId: sitter.userId,
      sitterId: sitter.id,
      firstName: sitter.firstName,
      lastName: sitter.lastName,
      email: sitter.email,
      phone: sitter.phone,
      city: sitter.city,
      bio: sitter.bio,
      profilePictureUrl: sitter.profilePictureUrl,
      rating: sitter.rating,
      totalBookings: sitter.totalBookings,
      isActive: sitter.isActive,
      isVerified: sitter.isVerified,
      priceDisplay: sitter.pricePerDayCents 
        ? `₪${(sitter.pricePerDayCents / 100).toFixed(0)}/day` 
        : 'Contact for price',
      pricePerDayCents: sitter.pricePerDayCents,
      yearsOfExperience: sitter.yearsOfExperience,
      hasOwnPets: null, // Not in current schema
      petTypes: null, // Not in current schema
      createdAt: sitter.createdAt,
    }));

    return { providers, total };
  } catch (error) {
    logger.error('[Marketplace] Sitter search error', { error });
    throw error;
  }
}

/**
 * Search drivers (PetTrek platform)
 */
async function searchDrivers(filters: MarketplaceSearchFilters): Promise<{
  providers: any[];
  total: number;
}> {
  // TODO: Implement when driverProfiles table is ready
  logger.warn('[Marketplace] PetTrek driver search not yet implemented');
  return { providers: [], total: 0 };
}

/**
 * Search groomers (Groomers Marketplace platform)
 */
async function searchGroomers(filters: MarketplaceSearchFilters): Promise<{
  providers: any[];
  total: number;
}> {
  // TODO: Implement when groomerProfiles table is ready
  logger.warn('[Marketplace] Groomers search not yet implemented');
  return { providers: [], total: 0 };
}

/**
 * GET /api/marketplace/provider/:platform/:id - Get provider details
 */
router.get('/provider/:platform/:id', async (req, res) => {
  try {
    const { platform, id } = req.params;
    
    logger.info('[Marketplace] Provider detail request', { platform, id });

    let provider: MarketplaceProvider | null = null;

    switch (platform as MarketplacePlatformId) {
      case 'walk_my_pet': {
        const [walker] = await db.select().from(walkerProfiles)
          .where(eq(walkerProfiles.walkerId, id))
          .limit(1);

        if (walker) {
          provider = {
            kind: 'walker' as const,
            platform: 'walk_my_pet' as const,
            id: walker.id,
            userId: walker.userId,
            walkerId: walker.walkerId,
            firstName: walker.firstName,
            lastName: walker.lastName,
            email: walker.email,
            phone: walker.phone,
            city: walker.city,
            bio: walker.bio,
            profilePictureUrl: walker.profilePictureUrl,
            rating: walker.averageRating,
            totalBookings: walker.totalWalks,
            isActive: walker.isActive,
            isVerified: walker.verificationStatus === 'verified',
            priceDisplay: walker.hourlyRate ? `₪${walker.hourlyRate}/hr` : 'Contact for price',
            hourlyRate: walker.hourlyRate,
            bodyCamera: walker.bodyCamera,
            droneAccess: walker.droneAccess,
            certifications: walker.certifications,
            serviceArea: walker.serviceAreaRadius,
            yearsOfExperience: walker.yearsOfExperience,
            createdAt: walker.createdAt,
          };
        }
        break;
      }

      case 'sitter_suite': {
        const [sitter] = await db.select().from(sitterProfiles)
          .where(eq(sitterProfiles.id, parseInt(id)))
          .limit(1);

        if (sitter) {
          provider = {
            kind: 'sitter' as const,
            platform: 'sitter_suite' as const,
            id: sitter.id,
            userId: sitter.userId,
            sitterId: sitter.id,
            firstName: sitter.firstName,
            lastName: sitter.lastName,
            email: sitter.email,
            phone: sitter.phone,
            city: sitter.city,
            bio: sitter.bio,
            profilePictureUrl: sitter.profilePictureUrl,
            rating: sitter.rating,
            totalBookings: sitter.totalBookings,
            isActive: sitter.isActive,
            isVerified: sitter.isVerified,
            priceDisplay: sitter.pricePerDayCents 
              ? `₪${(sitter.pricePerDayCents / 100).toFixed(0)}/day` 
              : 'Contact for price',
            pricePerDayCents: sitter.pricePerDayCents,
            yearsOfExperience: sitter.yearsOfExperience,
            hasOwnPets: null,
            petTypes: null,
            createdAt: sitter.createdAt,
          };
        }
        break;
      }

      default:
        return res.status(400).json({ error: 'Invalid platform' });
    }

    if (!provider) {
      return res.status(404).json({ error: 'Provider not found' });
    }

    res.json({ provider });
  } catch (error: any) {
    logger.error('[Marketplace] Provider detail error', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch provider details' });
  }
});

export default router;
