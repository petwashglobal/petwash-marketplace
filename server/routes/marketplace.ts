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
  trainers,
  drivers,
  providerProfiles,
  stationOperators,
  stations,
  marketplaceSearchFiltersSchema,
  type MarketplaceProvider,
  type WalkerProvider,
  type SitterProvider,
  type MarketplaceSearchResponse,
  type MarketplacePlatformId,
} from '@shared/schema';
import { eq, and, gte, lte, sql, desc, or, ilike, inArray } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { getProviderTier } from './marketplace-ranking';

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

    const sortBy = filters.sortBy ?? 'recommended';
    const tierFilter = filters.tierFilter;

    // Route to platform-specific search
    switch (filters.platform) {
      case 'walk_my_pet':
        ({ providers, total } = await searchWalkers(filters));
        break;
      
      case 'sitter_suite':
        ({ providers, total } = await searchSitters(filters));
        break;
      
      case 'pet_trek':
        // LEGAL BLOCK — PetTrek not licensed in Israel. Hard reject, no provider data returned.
        return res.status(403).json({
          error: 'service_legally_blocked',
          code: 'PETTREK_NOT_LICENSED',
          message: 'PetTrek™ is not available — service pending licensing in Israel.',
        });
      
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

    // ── Phase 9: Attach ranking data, sort, and tier-filter ──────────────────

    // Batch-fetch providerProfiles to get rankingScore for each provider
    const userIds = providers
      .map((p: any) => p.userId)
      .filter(Boolean) as string[];

    let rankingMap = new Map<string, { rankingScore: number | null; trustScore: number | null; ratingCount: number | null }>();

    if (userIds.length > 0) {
      const profileRows = await db
        .select({
          userId: providerProfiles.userId,
          rankingScore: providerProfiles.rankingScore,
          trustScore: providerProfiles.trustScore,
          ratingCount: providerProfiles.ratingCount,
        })
        .from(providerProfiles)
        .where(inArray(providerProfiles.userId, userIds));

      for (const row of profileRows) {
        rankingMap.set(row.userId, {
          rankingScore: row.rankingScore,
          trustScore: row.trustScore,
          ratingCount: row.ratingCount,
        });
      }
    }

    // ── Phase 10 T22: Enrich providers with station assignment ───────────────
    // Look up stationOperators for each provider userId to find their station.
    let stationMap = new Map<string, { stationId: number; stationName: string }>();
    if (userIds.length > 0) {
      const operatorRows = await db
        .select({
          userId: stationOperators.userId,
          stationId: stationOperators.stationId,
          stationName: stations.name,
        })
        .from(stationOperators)
        .innerJoin(stations, eq(stationOperators.stationId, stations.id))
        .where(
          and(
            inArray(stationOperators.userId, userIds),
            stationOperators.isActive
          )
        );
      for (const row of operatorRows) {
        // Use the first active station assignment per user
        if (!stationMap.has(row.userId)) {
          stationMap.set(row.userId, { stationId: row.stationId, stationName: row.stationName });
        }
      }
    }

    // Enrich providers with ranking data
    let enriched = providers.map((p: any) => {
      const rd = rankingMap.get(p.userId) ?? { rankingScore: null, trustScore: null, ratingCount: null };
      const tier = getProviderTier(rd.rankingScore, rd.trustScore, rd.ratingCount ?? p.totalBookings ?? null);
      const stationInfo = stationMap.get(p.userId) ?? null;
      return {
        ...p,
        rankingScore: rd.rankingScore,
        tier,
        stationId: stationInfo?.stationId ?? null,
        stationName: stationInfo?.stationName ?? null,
      };
    });

    // Tier filter
    if (tierFilter) {
      enriched = enriched.filter((p: any) => p.tier === tierFilter);
    }

    // Sort
    if (sortBy === 'recommended') {
      enriched.sort((a: any, b: any) => {
        const aScore = a.rankingScore ?? 50;
        const bScore = b.rankingScore ?? 50;
        return bScore - aScore;
      });
    } else if (sortBy === 'rating') {
      enriched.sort((a: any, b: any) => {
        const aR = parseFloat(a.rating ?? '0') || 0;
        const bR = parseFloat(b.rating ?? '0') || 0;
        return bR - aR;
      });
    } else if (sortBy === 'availability' && userIds.length > 0) {
      // Real availability sort: query upcoming bookings per provider in next 7 days
      // Providers with fewer upcoming bookings are more available → sort ascending
      const now = new Date();
      const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      const upcomingRows = await db.execute(sql`
        SELECT provider_id, count(*)::int AS upcoming_count
        FROM bookings
        WHERE provider_id = ANY(${userIds}::text[])
          AND start_time >= ${now}
          AND start_time < ${sevenDaysLater}
          AND status IN ('accepted','confirmed','started')
        GROUP BY provider_id
      `);

      const upcomingMap = new Map<string, number>(
        (upcomingRows.rows as any[]).map((r) => [r.provider_id, Number(r.upcoming_count)])
      );

      // Phase 10 T25: Fetch station capacity ratios for station-linked providers.
      // A provider at a station that is near/at capacity should rank lower for availability.
      const stationIds = [...new Set(
        enriched
          .map((p: any) => p.stationId)
          .filter((id: any): id is number => typeof id === 'number')
      )];

      const stationCapacityMap = new Map<number, { used: number; daily: number }>();
      if (stationIds.length > 0) {
        const capRows = await db.execute(sql`
          SELECT
            id,
            COALESCE(daily_capacity, 20)  AS daily_capacity,
            -- Live count for today (Israel timezone, authoritative vs cached current_day_bookings)
            (
              SELECT COUNT(*)::int
              FROM bookings b
              WHERE b.station_id = s.id
                AND (b.start_time AT TIME ZONE 'Asia/Jerusalem')::date
                    = (NOW() AT TIME ZONE 'Asia/Jerusalem')::date
                AND b.status NOT IN ('cancelled','rejected','expired')
            ) AS used_today
          FROM stations s
          WHERE id = ANY(${stationIds}::int[])
        `);
        for (const row of capRows.rows as any[]) {
          stationCapacityMap.set(Number(row.id), {
            used: Number(row.used_today ?? 0),
            daily: Number(row.daily_capacity ?? 20),
          });
        }
      }

      enriched.sort((a: any, b: any) => {
        const aCount = upcomingMap.get(a.userId) ?? 0;
        const bCount = upcomingMap.get(b.userId) ?? 0;

        // Blend provider-level upcoming count with station capacity ratio (T25).
        // Capacity ratio 0-1: 0 = empty station, 1 = full station.
        // Higher capacity ratio → penalise availability (add virtual bookings).
        const aCapInfo = a.stationId ? stationCapacityMap.get(a.stationId) : null;
        const bCapInfo = b.stationId ? stationCapacityMap.get(b.stationId) : null;

        const aCapPenalty = aCapInfo
          ? Math.round((aCapInfo.used / aCapInfo.daily) * 10)
          : 0;
        const bCapPenalty = bCapInfo
          ? Math.round((bCapInfo.used / bCapInfo.daily) * 10)
          : 0;

        const aEffective = aCount + aCapPenalty;
        const bEffective = bCount + bCapPenalty;

        return aEffective - bEffective; // ascending: fewer = more available
      });
    }

    const response: MarketplaceSearchResponse = {
      providers: enriched,
      total: tierFilter ? enriched.length : total,
      platform: filters.platform,
      filters,
    };

    logger.info('[Marketplace] Search completed', {
      platform: filters.platform,
      resultsCount: enriched.length,
      total,
      sortBy,
      tierFilter,
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
      conditions.push(ilike(walkerProfiles.city, `%${filters.city}%`));
    }

    if (filters.minRating && filters.minRating > 0) {
      conditions.push(gte(walkerProfiles.averageRating, filters.minRating.toString()));
    }

    if (filters.verifiedOnly) {
      conditions.push(eq(walkerProfiles.verificationStatus, 'verified'));
    }

    if (filters.bodyCamera !== undefined) {
      conditions.push(eq(walkerProfiles.hasBodyCamera, filters.bodyCamera));
    }

    if (filters.droneAccess !== undefined) {
      conditions.push(eq(walkerProfiles.hasDroneAccess, filters.droneAccess));
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
    logger.error('[Marketplace] Walker search error', error);
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
      conditions.push(ilike(sitterProfiles.city, `%${filters.city}%`));
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
    logger.error('[Marketplace] Sitter search error', error);
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
  try {
    const conditions = [eq(drivers.isActive, true)];

    if (filters.city) {
      conditions.push(ilike(drivers.areasOfService, `%${filters.city}%`));
    }

    const results = await db.select().from(drivers)
      .where(and(...conditions))
      .limit(filters.limit || 20)
      .offset(filters.offset || 0);

    const [countResult] = await db.select({ count: sql`count(*)` })
      .from(drivers)
      .where(and(...conditions));

    const total = Number(countResult?.count || 0);

    const providers = results.map(driver => ({
      kind: 'driver' as const,
      platform: 'pet_trek' as const,
      id: driver.id,
      odId: driver.id,
      firstName: 'Driver',
      lastName: driver.id.substring(0, 8),
      profilePictureUrl: null,
      rating: '4.5',
      totalBookings: 0,
      isActive: driver.isActive,
      isVerified: true,
      priceDisplay: 'Contact for quote',
      city: driver.areasOfService || '',
      bio: `Licensed ${driver.vehicleType} driver for pet transport`,
      vehicleType: driver.vehicleType,
      licenseNumber: driver.licenseNumber,
      createdAt: driver.createdAt,
    }));

    return { providers, total };
  } catch (error) {
    logger.error('[Marketplace] Driver search error', error);
    return { providers: [], total: 0 };
  }
}

/**
 * Search groomers (Groomers Marketplace platform) - uses trainers with grooming specialty
 */
async function searchGroomers(filters: MarketplaceSearchFilters): Promise<{
  providers: any[];
  total: number;
}> {
  try {
    const conditions = [
      eq(trainers.isActive, true),
      sql`'grooming' = ANY(${trainers.serviceTypes})`
    ];

    if (filters.city) {
      conditions.push(ilike(trainers.serviceArea, `%${filters.city}%`));
    }

    if (filters.minRating && filters.minRating > 0) {
      conditions.push(gte(trainers.averageRating, filters.minRating.toString()));
    }

    if (filters.verifiedOnly) {
      conditions.push(eq(trainers.verificationStatus, 'verified'));
    }

    const results = await db.select().from(trainers)
      .where(and(...conditions))
      .orderBy(desc(trainers.averageRating))
      .limit(filters.limit || 20)
      .offset(filters.offset || 0);

    const [countResult] = await db.select({ count: sql`count(*)` })
      .from(trainers)
      .where(and(...conditions));

    const total = Number(countResult?.count || 0);

    const providers = results.map(trainer => ({
      kind: 'groomer' as const,
      platform: 'groomers' as const,
      id: trainer.id,
      odId: trainer.trainerId,
      firstName: trainer.firstName,
      lastName: trainer.lastName,
      email: trainer.email,
      phone: trainer.phone,
      profilePictureUrl: trainer.profilePhotoUrl,
      rating: trainer.averageRating,
      totalBookings: trainer.totalSessions,
      isActive: trainer.isActive,
      isVerified: trainer.verificationStatus === 'verified',
      priceDisplay: trainer.hourlyRate ? `₪${trainer.hourlyRate}/hr` : 'Contact for price',
      city: trainer.serviceArea || '',
      bio: trainer.bio,
      specialties: trainer.specialties,
      yearsOfExperience: trainer.yearsOfExperience,
      createdAt: trainer.createdAt,
    }));

    return { providers, total };
  } catch (error) {
    logger.error('[Marketplace] Groomer search error', error);
    return { providers: [], total: 0 };
  }
}

/**
 * GET /api/marketplace/provider/:platform/:id - Get provider details
 */
router.get('/provider/:platform/:id', async (req, res) => {
  try {
    const { platform: rawPlatform, id } = req.params;
    // Normalize platform name (sitter-suite -> sitter_suite)
    const platform = rawPlatform.replace(/-/g, '_');
    
    logger.info('[Marketplace] Provider detail request', { platform, id, rawPlatform });

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
        // Support both numeric ID and userId string (e.g., "demo-sitter-1")
        const numericId = parseInt(id);
        const [sitter] = await db.select().from(sitterProfiles)
          .where(
            isNaN(numericId) 
              ? eq(sitterProfiles.userId, id)
              : eq(sitterProfiles.id, numericId)
          )
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
    logger.error('[Marketplace] Provider detail error', { 
      error: error?.message || String(error),
      code: error?.code
    });
    res.status(500).json({ error: 'Failed to fetch provider details' });
  }
});

export default router;
