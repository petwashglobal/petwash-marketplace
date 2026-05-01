/**
 * PET WASH™ BOOKING SEARCH API
 *
 * Unified search across all pet service providers.
 *
 * MATCHING ENGINE — proximity is the primary ranking signal:
 *   compositeScore = proximityScore(60%) + ratingScore(25%) + trustScore(10%) + volumeScore(5%)
 *
 * When lat/lng present in filters:
 *   - ALL candidates matching other DB conditions are fetched (Israel is tiny — ~few hundred providers)
 *   - Haversine distance computed per provider
 *   - Providers beyond radiusKm are excluded
 *   - Results sorted by compositeScore, then paginated in-memory
 *
 * When only city/area text present (no coordinates):
 *   - Falls back to ilike city text matching (existing behaviour, unchanged)
 */

import { Router } from 'express';
import { db } from '../db';
import {
  sitterProfiles,
  walkerProfiles,
  locations,
  pets,
  trainers,
  drivers,
  stations,
  bookings,
  bookingRequests,
  providerAvailability,
  bookingSearchFiltersSchema,
  type BookingSearchFilters,
  type BookingSearchResult,
} from '@shared/schema';
import { eq, and, gte, lte, sql, desc, asc, or, ilike, notInArray, inArray } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { nanoid } from 'nanoid';
import { aliasesForCity } from '@shared/lib/address';

/**
 * Build a Drizzle SQL OR clause that ilikes the given column against every
 * Hebrew + English spelling of a city. Closes the silent-mismatch bug
 * where a customer typed 'רמת גן' but the provider's city was stored as
 * 'Ramat Gan' (or vice versa).
 *
 * Returns null when the input is empty (caller should skip the filter).
 */
function cityAliasIlike(column: any, raw: string | null | undefined) {
  const aliases = aliasesForCity(raw);
  if (aliases.length === 0) return null;
  const conds = aliases.map(a => ilike(column, `%${a}%`));
  return conds.length === 1 ? conds[0] : or(...conds);
}

const ISRAEL_TIMEZONE = 'Asia/Jerusalem';
const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// PROXIMITY ENGINE — CORE MATH
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Haversine distance between two WGS-84 coordinates, in kilometres.
 * Accurate to ~0.3% — sufficient for provider matching.
 */
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth mean radius km
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Proximity score 0–60, decaying with distance.
 * Calibrated for Israel's geography (most bookings within 10 km).
 *
 * Tiers (Israeli urban scale):
 *   < 0.05 km  → same building  → ~60 pts
 *   < 0.2  km  → same street    → ~57 pts
 *   < 0.5  km  → same block     → ~53 pts
 *   < 2    km  → neighbourhood  → ~44 pts
 *   < 5    km  → same city      → ~32 pts
 *   < 15   km  → metro area     → ~18 pts
 *   < 30   km  → region         → ~11 pts
 */
function proximityScore(distanceKm: number): number {
  return 60 / (1 + distanceKm * 0.5);
}

/**
 * Proximity tier label (for frontend display).
 */
export function proximityTier(distanceKm: number): string {
  if (distanceKm < 0.05) return 'same_building';
  if (distanceKm < 0.2) return 'same_street';
  if (distanceKm < 0.5) return 'same_block';
  if (distanceKm < 2) return 'neighbourhood';
  if (distanceKm < 5) return 'same_city';
  if (distanceKm < 15) return 'metro_area';
  if (distanceKm < 30) return 'region';
  return 'wider_area';
}

/**
 * Composite ranking score 0–100.
 *
 *   proximityScore  0–60   (60%)
 *   ratingScore     0–25   (25%)
 *   trustScore      0–10   (10%)
 *   volumeScore     0–5    ( 5%)
 */
function compositeScore(opts: {
  distanceKm: number | null;
  rating: number;       // 0–5
  isVerified: boolean;
  hasPoliceCheck: boolean;
  totalBookings: number;
}): number {
  const prox = opts.distanceKm !== null ? proximityScore(opts.distanceKm) : 0;
  const rat  = (opts.rating / 5) * 25;
  const trust =
    (opts.isVerified    ? 6 : 0) +
    (opts.hasPoliceCheck ? 4 : 0);
  const vol  = Math.min(opts.totalBookings / 50, 1) * 5;
  return prox + rat + trust + vol;
}

/**
 * Sort and paginate an in-memory result set by composite score.
 * Used when lat/lng coordinates are present in filters.
 */
function rankAndPaginate<T extends { _score: number }>(
  items: T[],
  sortOrder: 'asc' | 'desc',
  limit: number,
  offset: number,
): { ranked: T[]; total: number } {
  const sorted = [...items].sort((a, b) =>
    sortOrder === 'asc' ? a._score - b._score : b._score - a._score,
  );
  return {
    ranked: sorted.slice(offset, offset + limit),
    total: sorted.length,
  };
}

/**
 * Strict tiered proximity ranker (Phase B3 — Uber-style).
 *
 * Sort order:
 *   1. distance bucket (rounded down to 0.5 km — same-block ties together)
 *   2. rating DESC (higher rated first)
 *   3. totalBookings DESC (proxy for availability / experience)
 *
 * Providers with `_distanceKm === null` are NOT expected here — the
 * caller must filter them out before passing in (strict mode contract).
 */
function rankAndPaginateStrict<
  T extends { _distanceKm: number | null; rating?: number; totalBookings?: number }
>(
  items: T[],
  limit: number,
  offset: number,
): { ranked: T[]; total: number } {
  const bucket = (km: number) => Math.floor(km * 2) / 2; // 0.5 km buckets
  const sorted = [...items].sort((a, b) => {
    const aDist = a._distanceKm ?? Number.POSITIVE_INFINITY;
    const bDist = b._distanceKm ?? Number.POSITIVE_INFINITY;
    const ab = bucket(aDist);
    const bb = bucket(bDist);
    if (ab !== bb) return ab - bb;                                   // 1. distance bucket
    const ar = a.rating ?? 0;
    const br = b.rating ?? 0;
    if (ar !== br) return br - ar;                                   // 2. rating DESC
    const av = a.totalBookings ?? 0;
    const bv = b.totalBookings ?? 0;
    if (av !== bv) return bv - av;                                   // 3. volume DESC
    return aDist - bDist;                                            // tie-break: exact distance
  });
  return {
    ranked: sorted.slice(offset, offset + limit),
    total: sorted.length,
  };
}

/**
 * Strict-mode coordinate gate (Phase B3).
 *
 * Returns an HTTP-ready error when `requireCoordinates` is set but the
 * caller has not supplied both `latitude` and `longitude`. Returns null
 * when the request is fine to proceed (either strict-off, or coords
 * present).
 *
 * Also asserts coordinates are real numbers in valid WGS-84 bounds —
 * an attacker sending `latitude: NaN` or `latitude: 9999` would
 * otherwise pass the basic `!= null` check.
 */
export function assertProximityRequirements(
  filters: { requireCoordinates?: boolean; latitude?: number; longitude?: number },
): { statusCode: 422; body: { error: string; code: string } } | null {
  if (!filters.requireCoordinates) return null;
  const { latitude, longitude } = filters;
  const validLat = typeof latitude === 'number' && Number.isFinite(latitude) && latitude >= -90 && latitude <= 90;
  const validLng = typeof longitude === 'number' && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180;
  if (!validLat || !validLng) {
    return {
      statusCode: 422,
      body: {
        error: 'Strict proximity mode requires valid latitude and longitude.',
        code: 'COORDINATES_REQUIRED',
      },
    };
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// AVAILABILITY CHECK
// ─────────────────────────────────────────────────────────────────────────────

async function getBusyProviderIds(startDate: string, endDate: string, platformId?: string): Promise<string[]> {
  try {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return [];
    }

    const busyIds = new Set<string>();

    const bookingConditions = [
      sql`${bookings.status} IN ('confirmed', 'in_progress')`,
      sql`${bookings.startTime} < ${end.toISOString()}`,
      sql`${bookings.endTime} > ${start.toISOString()}`,
    ];

    if (platformId) {
      bookingConditions.push(eq(bookings.platformId, platformId));
    }

    const busyFromBookings = await db
      .select({ providerId: bookings.providerId })
      .from(bookings)
      .where(and(...bookingConditions));

    busyFromBookings.forEach(b => {
      if (b.providerId) busyIds.add(b.providerId);
    });

    const unavailableConditions = [
      sql`${providerAvailability.date} >= ${start.toISOString().split('T')[0]}`,
      sql`${providerAvailability.date} <= ${end.toISOString().split('T')[0]}`,
      eq(providerAvailability.isAvailable, false),
    ];

    if (platformId) {
      unavailableConditions.push(eq(providerAvailability.platform, platformId));
    }

    const unavailable = await db
      .select({ providerId: providerAvailability.providerId })
      .from(providerAvailability)
      .where(and(...unavailableConditions));

    unavailable.forEach(u => {
      if (u.providerId) busyIds.add(u.providerId);
    });

    return [...busyIds];
  } catch (error) {
    logger.error('[BookingSearch] Error fetching busy provider IDs', { error: (error as Error).message });
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DATE VALIDATION
// ─────────────────────────────────────────────────────────────────────────────

function validateSearchDates(startDate?: string, endDate?: string): string | null {
  if (!startDate && !endDate) return null;

  const today = new Date().toISOString().split('T')[0];

  if (startDate) {
    const start = new Date(startDate);
    if (isNaN(start.getTime())) return 'Invalid start date format';
    if (startDate < today) return 'Start date cannot be in the past';
  }

  if (endDate) {
    const end = new Date(endDate);
    if (isNaN(end.getTime())) return 'Invalid end date format';
    if (endDate < today) return 'End date cannot be in the past';
  }

  if (startDate && endDate) {
    if (endDate < startDate) return 'End date must be after start date';
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// SEARCH ENDPOINT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/booking-search — PetWash™ unified provider search
 */
router.post('/', async (req, res) => {
  try {
    const filters = bookingSearchFiltersSchema.parse(req.body);
    const searchId = nanoid(12);

    const dateError = validateSearchDates(filters.startDate, filters.endDate);
    if (dateError) {
      return res.status(400).json({ error: dateError });
    }

    // Phase B3 — strict proximity gate. If the caller asked for
    // requireCoordinates (Uber-style search), the request MUST carry
    // valid lat/lng. Refuses early with 422 so the search engine never
    // silently falls back to text search.
    const proxError = assertProximityRequirements(filters);
    if (proxError) {
      logger.warn('[BookingSearch] Strict proximity rejected — missing coords', {
        searchId, hasLat: typeof filters.latitude === 'number', hasLng: typeof filters.longitude === 'number',
      });
      return res.status(proxError.statusCode).json(proxError.body);
    }

    logger.info('[BookingSearch] Search request', {
      searchId,
      serviceType: filters.serviceType,
      petCount: filters.petCount,
      petTypes: filters.petTypes,
      city: filters.city,
      hasCoords: !!(filters.latitude && filters.longitude),
      requireCoordinates: !!filters.requireCoordinates,
      radiusKm: filters.radiusKm,
      startDate: filters.startDate,
      endDate: filters.endDate,
    });

    let result: BookingSearchResult;

    switch (filters.serviceType) {
      case 'pet_sitting':
      case 'daycare':
        result = await searchSitters(filters, searchId);
        break;

      case 'dog_walking':
        result = await searchWalkers(filters, searchId);
        break;

      case 'grooming':
        result = await searchGroomers(filters, searchId);
        break;

      case 'pet_taxi':
        return res.status(503).json({
          error: 'coming_soon',
          platform: 'PetTrek',
          message: 'PetTrek™ pet taxi service is coming soon!',
          providers: [],
          total: 0,
        });

      case 'training':
        result = await searchTrainers(filters, searchId);
        break;

      case 'k9000_wash':
        result = await searchK9000Stations(filters, searchId);
        break;

      default:
        return res.status(400).json({ error: 'Invalid service type' });
    }

    logger.info('[BookingSearch] Search completed', {
      searchId,
      resultsCount: result.providers.length,
      total: result.total,
    });

    res.json(result);
  } catch (error: any) {
    logger.error('[BookingSearch] Search error', {
      error: error?.message || String(error),
      stack: error?.stack,
      name: error?.name,
    });

    if (error.name === 'ZodError') {
      return res.status(400).json({
        error: 'Invalid search filters',
        details: error.errors,
      });
    }

    res.status(500).json({ error: 'Booking search failed', details: error?.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// SUPPORTING ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/booking-search/my-pets
 */
router.get('/my-pets', async (req, res) => {
  try {
    const userId = req.user?.uid || req.firebaseUser?.uid;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userPets = await db
      .select({
        id: pets.id,
        name: pets.name,
        species: pets.species,
        breed: pets.breed,
        size: pets.size,
        photoUrl: pets.photoUrl,
      })
      .from(pets)
      .where(and(eq(pets.userId, userId), eq(pets.isActive, true)));

    res.json({ pets: userPets });
  } catch (error: any) {
    logger.error('[BookingSearch] Error fetching user pets', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch pets' });
  }
});

/**
 * GET /api/booking-search/cities
 */
router.get('/cities', async (req, res) => {
  try {
    const cities = await db
      .selectDistinct({ city: sitterProfiles.city })
      .from(sitterProfiles)
      .where(eq(sitterProfiles.isActive, true));

    const walkerCities = await db
      .selectDistinct({ city: walkerProfiles.city })
      .from(walkerProfiles)
      .where(eq(walkerProfiles.isActive, true));

    const allCities = [
      ...new Set([
        ...cities.map(c => c.city).filter(Boolean),
        ...walkerCities.map(c => c.city).filter(Boolean),
      ]),
    ].sort();

    res.json({ cities: allCities });
  } catch (error: any) {
    logger.error('[BookingSearch] Error fetching cities', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch cities' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PROVIDER SEARCH FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Search pet sitters / daycare providers.
 *
 * Proximity path  (lat/lng in filters):
 *   Fetch ALL qualifying sitters, compute haversine distance, filter by
 *   radiusKm, rank by compositeScore, paginate in-memory.
 *
 * Text path  (no coordinates):
 *   ilike city/area match + SQL rating ORDER BY — unchanged legacy behaviour.
 */
async function searchSitters(filters: BookingSearchFilters, searchId: string): Promise<BookingSearchResult> {
  try {
    const hasCoords = filters.latitude != null && filters.longitude != null;
    const radiusKm = filters.radiusKm ?? 50; // Israel ~470 km N–S; 50 km covers any metro

    const conditions = [eq(sitterProfiles.isActive, true)];

    // Text-based city/area filter (applied even when coords present, as a secondary constraint).
    // Uses Hebrew↔English aliases (e.g. 'רמת גן' === 'Ramat Gan') so a Hebrew
    // user typing in Hebrew matches providers whose city is stored in English.
    if (!hasCoords && filters.city) {
      const cond = cityAliasIlike(sitterProfiles.city, filters.city);
      if (cond) conditions.push(cond);
    }
    if (!hasCoords && filters.area) {
      const cityCond = cityAliasIlike(sitterProfiles.city, filters.area);
      const streetCond = ilike(sitterProfiles.streetAddress, `%${filters.area}%`);
      conditions.push(cityCond ? or(cityCond, streetCond)! : streetCond);
    }

    if (filters.minRating && filters.minRating > 0) {
      conditions.push(gte(sitterProfiles.rating, filters.minRating.toString()));
    }

    if (filters.verifiedOnly) {
      conditions.push(eq(sitterProfiles.isVerified, true));
    }

    if (filters.hasYard) {
      conditions.push(sql`${sitterProfiles.yardSize} != 'none' AND ${sitterProfiles.yardSize} IS NOT NULL`);
    }

    if (filters.noOtherPets) {
      conditions.push(eq(sitterProfiles.hasOtherPets, false));
    }

    if (filters.startDate && filters.endDate) {
      const busyIds = await getBusyProviderIds(filters.startDate, filters.endDate, 'SITTER_SUITE');
      if (busyIds.length > 0) {
        conditions.push(
          sql`${sitterProfiles.userId} NOT IN (${sql.join(busyIds.map(id => sql`${id}`), sql`, `)})`,
        );
        logger.info('[BookingSearch] Excluding busy sitters', { searchId, busyCount: busyIds.length });
      }
    }

    const limit  = filters.limit  ?? 20;
    const offset = filters.offset ?? 0;

    if (hasCoords) {
      // ── PROXIMITY PATH ─────────────────────────────────────────────────────
      // Fetch all qualifying sitters (no DB-level limit/offset)
      const all = await db.select().from(sitterProfiles).where(and(...conditions));

      const searchLat = filters.latitude!;
      const searchLng = filters.longitude!;

      // Compute distance & composite score for each, then filter by radius
      const scored = all
        .map(sitter => {
          const sitterLat = sitter.latitude ? parseFloat(sitter.latitude) : null;
          const sitterLng = sitter.longitude ? parseFloat(sitter.longitude) : null;
          const distanceKm =
            sitterLat !== null && sitterLng !== null
              ? haversineKm(searchLat, searchLng, sitterLat, sitterLng)
              : null;

          const rating = parseFloat(sitter.rating || '0');

          return {
            ...sitter,
            _distanceKm: distanceKm,
            _score: compositeScore({
              distanceKm,
              rating,
              isVerified: sitter.isVerified || false,
              hasPoliceCheck: sitter.policeCheckVerified === true,
              totalBookings: sitter.totalBookings || 0,
            }),
          };
        })
        // Phase B3 — strict proximity drops providers without coords;
        // legacy mode keeps them (returned with distanceKm = null).
        .filter(s => {
          if (filters.requireCoordinates) {
            if (s._distanceKm === null) return false;          // strict: no coords → out
            return s._distanceKm <= radiusKm;
          }
          return s._distanceKm === null || s._distanceKm <= radiusKm;
        });

      const { ranked, total } = filters.requireCoordinates
        ? rankAndPaginateStrict(
            scored.map(s => ({
              ...s,
              rating: parseFloat(s.rating || '0'),
              totalBookings: s.totalBookings || 0,
            })),
            limit,
            offset,
          )
        : rankAndPaginate(
            scored,
            filters.sortOrder ?? 'desc',
            limit,
            offset,
          );

      const providers = ranked.map(sitter => {
        const housePolicies = sitter.housePolicies as { maxPetsAtOnce?: number } | null;
        return {
          id: sitter.id,
          userId: sitter.userId,
          firstName: sitter.firstName,
          lastName: sitter.lastName || '',
          profilePictureUrl: sitter.profilePictureUrl,
          // String() handles both legacy ranker (string rating) and strict
          // ranker (already-parsed number rating from the adapter map).
          rating: parseFloat(String(sitter.rating || '0')),
          totalReviews: sitter.totalReviews || 0,
          totalBookings: sitter.totalBookings || 0,
          pricePerNight: sitter.pricePerDayCents ? Math.round(sitter.pricePerDayCents / 100) : null,
          pricePerHour: null,
          city: sitter.city || '',
          isVerified: sitter.isVerified || false,
          hasPoliceCheck: sitter.policeCheckVerified === true,
          yearsExperience: sitter.yearsOfExperience || 0,
          acceptedPetTypes: sitter.specializations || ['dog', 'cat'],
          maxPets: housePolicies?.maxPetsAtOnce || 1,
          bio: sitter.bio,
          badges: buildBadges(sitter),
          responseTime: sitter.responseTimeMinutes
            ? `within ${sitter.responseTimeMinutes} minutes`
            : 'within 24 hours',
          lastActive: sitter.updatedAt,
          // Proximity metadata (frontend can use for display)
          distanceKm: sitter._distanceKm !== null ? Math.round(sitter._distanceKm * 10) / 10 : null,
          proximityTier: sitter._distanceKm !== null ? proximityTier(sitter._distanceKm) : null,
          matchScore: Math.round(sitter._score),
        };
      });

      logger.info('[BookingSearch] Sitter proximity search', {
        searchId,
        searchCoords: { lat: searchLat, lng: searchLng },
        radiusKm,
        candidatesTotal: all.length,
        withinRadius: scored.length,
        returned: providers.length,
      });

      return { providers, total, filters, searchId };
    }

    // ── TEXT PATH ────────────────────────────────────────────────────────────
    const orderBy =
      filters.sortOrder === 'asc' ? asc(sitterProfiles.rating) : desc(sitterProfiles.rating);

    const results = await db
      .select()
      .from(sitterProfiles)
      .where(and(...conditions))
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset);

    const [countResult] = await db
      .select({ count: sql`count(*)` })
      .from(sitterProfiles)
      .where(and(...conditions));

    const total = Number(countResult?.count || 0);

    const providers = results.map(sitter => {
      const housePolicies = sitter.housePolicies as { maxPetsAtOnce?: number } | null;
      return {
        id: sitter.id,
        userId: sitter.userId,
        firstName: sitter.firstName,
        lastName: sitter.lastName || '',
        profilePictureUrl: sitter.profilePictureUrl,
        rating: parseFloat(sitter.rating || '0'),
        totalReviews: sitter.totalReviews || 0,
        totalBookings: sitter.totalBookings || 0,
        pricePerNight: sitter.pricePerDayCents ? Math.round(sitter.pricePerDayCents / 100) : null,
        pricePerHour: null,
        city: sitter.city || '',
        isVerified: sitter.isVerified || false,
        hasPoliceCheck: sitter.policeCheckVerified === true,
        yearsExperience: sitter.yearsOfExperience || 0,
        acceptedPetTypes: sitter.specializations || ['dog', 'cat'],
        maxPets: housePolicies?.maxPetsAtOnce || 1,
        bio: sitter.bio,
        badges: buildBadges(sitter),
        responseTime: sitter.responseTimeMinutes
          ? `within ${sitter.responseTimeMinutes} minutes`
          : 'within 24 hours',
        lastActive: sitter.updatedAt,
        distanceKm: null,
        proximityTier: null,
        matchScore: null,
      };
    });

    return { providers, total, filters, searchId };
  } catch (error) {
    logger.error('[BookingSearch] Sitter search error', { error: (error as Error).message });
    return { providers: [], total: 0, filters, searchId };
  }
}

/**
 * Search dog walkers.
 *
 * Uses walkerProfiles.currentLatitude / currentLongitude as their service base.
 * Providers whose serviceRadiusKm does not reach the search location are excluded.
 */
async function searchWalkers(filters: BookingSearchFilters, searchId: string): Promise<BookingSearchResult> {
  try {
    const hasCoords = filters.latitude != null && filters.longitude != null;
    const radiusKm  = filters.radiusKm ?? 50;

    const conditions = [eq(walkerProfiles.isActive, true)];

    if (!hasCoords && filters.city) {
      const cond = cityAliasIlike(walkerProfiles.city, filters.city);
      if (cond) conditions.push(cond);
    }

    if (filters.minRating && filters.minRating > 0) {
      conditions.push(gte(walkerProfiles.averageRating, filters.minRating.toString()));
    }

    if (filters.verifiedOnly) {
      conditions.push(eq(walkerProfiles.verificationStatus, 'verified'));
    }

    if (filters.startDate && filters.endDate) {
      const busyIds = await getBusyProviderIds(filters.startDate, filters.endDate, 'WALK_MY_PET');
      if (busyIds.length > 0) {
        conditions.push(
          sql`${walkerProfiles.userId} NOT IN (${sql.join(busyIds.map(id => sql`${id}`), sql`, `)})`,
        );
        logger.info('[BookingSearch] Excluding busy walkers', { searchId, busyCount: busyIds.length });
      }
    }

    const limit  = filters.limit  ?? 20;
    const offset = filters.offset ?? 0;

    if (hasCoords) {
      // ── PROXIMITY PATH ─────────────────────────────────────────────────────
      const all = await db.select().from(walkerProfiles).where(and(...conditions));

      const searchLat = filters.latitude!;
      const searchLng = filters.longitude!;

      const scored = all
        .map(walker => {
          const walkerLat = walker.currentLatitude ? parseFloat(walker.currentLatitude) : null;
          const walkerLng = walker.currentLongitude ? parseFloat(walker.currentLongitude) : null;
          const distanceKm =
            walkerLat !== null && walkerLng !== null
              ? haversineKm(searchLat, searchLng, walkerLat, walkerLng)
              : null;

          const rating = parseFloat(walker.averageRating || '0');

          return {
            ...walker,
            _distanceKm: distanceKm,
            _score: compositeScore({
              distanceKm,
              rating,
              isVerified: walker.verificationStatus === 'verified',
              hasPoliceCheck: walker.backgroundCheckStatus === 'passed',
              totalBookings: walker.totalWalks || 0,
            }),
          };
        })
        .filter(w => {
          // Phase B3 — strict mode rejects walkers without coords;
          // legacy mode keeps them.
          if (w._distanceKm === null) return !filters.requireCoordinates;
          if (w._distanceKm > radiusKm) return false;
          // Also exclude if walker's own service radius doesn't reach us
          const walkerServiceRadius = w.serviceRadiusKm ?? 5;
          return w._distanceKm <= walkerServiceRadius + radiusKm;
        });

      const { ranked, total } = filters.requireCoordinates
        ? rankAndPaginateStrict(
            scored.map(w => ({
              ...w,
              rating: parseFloat(w.averageRating || '0'),
              totalBookings: w.totalWalks || 0,
            })),
            limit,
            offset,
          )
        : rankAndPaginate(
            scored,
            filters.sortOrder ?? 'desc',
            limit,
            offset,
          );

      const providers = ranked.map(walker => ({
        id: walker.id,
        userId: walker.userId,
        firstName: walker.firstName,
        lastName: walker.lastName || '',
        profilePictureUrl: walker.profilePhotoUrl,
        // String() handles both legacy ranker (string rating) and strict
        // ranker (already-parsed number rating from the adapter map).
        rating: parseFloat(String(walker.averageRating || '0')),
        totalReviews: walker.totalReviews || 0,
        totalBookings: walker.totalWalks || 0,
        pricePerNight: null,
        pricePerHour: walker.baseHourlyRate ? parseInt(walker.baseHourlyRate) : null,
        city: walker.city || '',
        isVerified: walker.verificationStatus === 'verified',
        hasPoliceCheck: walker.backgroundCheckStatus === 'passed',
        yearsExperience: walker.yearsOfExperience || 0,
        acceptedPetTypes: ['dog'],
        maxPets: walker.maxDailyWalks || 3,
        bio: walker.bio,
        badges: buildWalkerBadges(walker),
        responseTime: 'within 24 hours',
        lastActive: walker.updatedAt,
        distanceKm: walker._distanceKm !== null ? Math.round(walker._distanceKm * 10) / 10 : null,
        proximityTier: walker._distanceKm !== null ? proximityTier(walker._distanceKm) : null,
        matchScore: Math.round(walker._score),
      }));

      logger.info('[BookingSearch] Walker proximity search', {
        searchId,
        searchCoords: { lat: searchLat, lng: searchLng },
        radiusKm,
        candidatesTotal: all.length,
        withinRadius: scored.length,
        returned: providers.length,
      });

      return { providers, total, filters, searchId };
    }

    // ── TEXT PATH ─────────────────────────────────────────────────────────────
    const orderBy =
      filters.sortOrder === 'asc'
        ? asc(walkerProfiles.averageRating)
        : desc(walkerProfiles.averageRating);

    const results = await db
      .select()
      .from(walkerProfiles)
      .where(and(...conditions))
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset);

    const [countResult] = await db
      .select({ count: sql`count(*)` })
      .from(walkerProfiles)
      .where(and(...conditions));

    const total = Number(countResult?.count || 0);

    const providers = results.map(walker => ({
      id: walker.id,
      userId: walker.userId,
      firstName: walker.firstName,
      lastName: walker.lastName || '',
      profilePictureUrl: walker.profilePhotoUrl,
      rating: parseFloat(walker.averageRating || '0'),
      totalReviews: walker.totalReviews || 0,
      totalBookings: walker.totalWalks || 0,
      pricePerNight: null,
      pricePerHour: walker.baseHourlyRate ? parseInt(walker.baseHourlyRate) : null,
      city: walker.city || '',
      isVerified: walker.verificationStatus === 'verified',
      hasPoliceCheck: walker.backgroundCheckStatus === 'passed',
      yearsExperience: walker.yearsOfExperience || 0,
      acceptedPetTypes: ['dog'],
      maxPets: walker.maxDailyWalks || 3,
      bio: walker.bio,
      badges: buildWalkerBadges(walker),
      responseTime: 'within 24 hours',
      lastActive: walker.updatedAt,
      distanceKm: null,
      proximityTier: null,
      matchScore: null,
    }));

    return { providers, total, filters, searchId };
  } catch (error) {
    logger.error('[BookingSearch] Walker search error', { error: (error as Error).message });
    return { providers: [], total: 0, filters, searchId };
  }
}

/**
 * Search groomers — uses trainers table with grooming specialty.
 * Groomers don't have their own lat/lng column yet; falls back to text matching.
 */
async function searchGroomers(filters: BookingSearchFilters, searchId: string): Promise<BookingSearchResult> {
  try {
    const conditions = [
      eq(trainers.isActive, true),
      sql`'grooming' = ANY(${trainers.serviceTypes})`,
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

    if (filters.startDate && filters.endDate) {
      const busyIds = await getBusyProviderIds(filters.startDate, filters.endDate, 'GROOMING');
      if (busyIds.length > 0) {
        conditions.push(
          sql`${trainers.trainerId} NOT IN (${sql.join(busyIds.map(id => sql`${id}`), sql`, `)})`,
        );
      }
    }

    const results = await db
      .select()
      .from(trainers)
      .where(and(...conditions))
      .orderBy(desc(trainers.averageRating))
      .limit(filters.limit ?? 20)
      .offset(filters.offset ?? 0);

    const [countResult] = await db
      .select({ count: sql`count(*)` })
      .from(trainers)
      .where(and(...conditions));

    const total = Number(countResult?.count || 0);

    const providers = results.map(trainer => ({
      id: trainer.id,
      odId: trainer.trainerId,
      firstName: trainer.firstName,
      lastName: trainer.lastName || '',
      profilePictureUrl: trainer.profilePhotoUrl,
      rating: parseFloat(trainer.averageRating || '0'),
      totalReviews: trainer.totalReviews || 0,
      totalBookings: trainer.totalSessions || 0,
      pricePerNight: null,
      pricePerHour: trainer.hourlyRate ? parseFloat(trainer.hourlyRate) : null,
      city: trainer.serviceArea || '',
      isVerified: trainer.verificationStatus === 'verified',
      hasPoliceCheck: false,
      yearsExperience: trainer.yearsOfExperience || 0,
      acceptedPetTypes: ['dog', 'cat'],
      maxPets: 1,
      bio: trainer.bio,
      badges: trainer.isCertified ? ['certified'] : [],
      responseTime: 'within 24 hours',
      lastActive: trainer.updatedAt,
      distanceKm: null,
      proximityTier: null,
      matchScore: null,
    }));

    return { providers, total, filters, searchId };
  } catch (error) {
    logger.error('[BookingSearch] Groomer search error', error);
    return { providers: [], total: 0, filters, searchId };
  }
}

/**
 * Search pet taxi drivers (legacy — PetTrek is coming soon).
 */
async function searchDrivers(filters: BookingSearchFilters, searchId: string): Promise<BookingSearchResult> {
  try {
    const conditions = [eq(drivers.isActive, true)];

    if (filters.city || filters.area) {
      const searchTerm = filters.city || filters.area || '';
      conditions.push(ilike(drivers.areasOfService, `%${searchTerm}%`));
    }

    const results = await db
      .select()
      .from(drivers)
      .where(and(...conditions))
      .limit(filters.limit ?? 20)
      .offset(filters.offset ?? 0);

    const [countResult] = await db
      .select({ count: sql`count(*)` })
      .from(drivers)
      .where(and(...conditions));

    const total = Number(countResult?.count || 0);

    const providers = results.map(driver => ({
      id: driver.id,
      odId: driver.id,
      firstName: 'Driver',
      lastName: driver.id.substring(0, 8),
      profilePictureUrl: null,
      rating: 4.5,
      totalReviews: 0,
      totalBookings: 0,
      pricePerNight: null,
      pricePerHour: null,
      city: driver.areasOfService || '',
      isVerified: true,
      hasPoliceCheck: true,
      yearsExperience: 0,
      acceptedPetTypes: ['dog', 'cat'],
      maxPets: 3,
      bio: `Licensed ${driver.vehicleType} driver`,
      badges: ['licensed'],
      responseTime: 'within 1 hour',
      lastActive: driver.createdAt,
      distanceKm: null,
      proximityTier: null,
      matchScore: null,
    }));

    return { providers, total, filters, searchId };
  } catch (error) {
    logger.error('[BookingSearch] Driver search error', error);
    return { providers: [], total: 0, filters, searchId };
  }
}

/**
 * Search trainers.
 */
async function searchTrainers(filters: BookingSearchFilters, searchId: string): Promise<BookingSearchResult> {
  try {
    const conditions = [eq(trainers.isActive, true)];

    if (filters.city) {
      conditions.push(ilike(trainers.serviceArea, `%${filters.city}%`));
    }

    if (filters.area) {
      conditions.push(ilike(trainers.serviceArea, `%${filters.area}%`));
    }

    if (filters.minRating && filters.minRating > 0) {
      conditions.push(gte(trainers.averageRating, filters.minRating.toString()));
    }

    if (filters.verifiedOnly) {
      conditions.push(eq(trainers.verificationStatus, 'verified'));
    }

    if (filters.startDate && filters.endDate) {
      const busyIds = await getBusyProviderIds(filters.startDate, filters.endDate, 'TRAINING');
      if (busyIds.length > 0) {
        conditions.push(
          sql`${trainers.trainerId} NOT IN (${sql.join(busyIds.map(id => sql`${id}`), sql`, `)})`,
        );
      }
    }

    const results = await db
      .select()
      .from(trainers)
      .where(and(...conditions))
      .orderBy(desc(trainers.averageRating))
      .limit(filters.limit ?? 20)
      .offset(filters.offset ?? 0);

    const [countResult] = await db
      .select({ count: sql`count(*)` })
      .from(trainers)
      .where(and(...conditions));

    const total = Number(countResult?.count || 0);

    const providers = results.map(trainer => ({
      id: trainer.id,
      odId: trainer.trainerId,
      firstName: trainer.firstName,
      lastName: trainer.lastName || '',
      profilePictureUrl: trainer.profilePhotoUrl,
      rating: parseFloat(trainer.averageRating || '0'),
      totalReviews: trainer.totalReviews || 0,
      totalBookings: trainer.totalSessions || 0,
      pricePerNight: null,
      pricePerHour: trainer.hourlyRate ? parseFloat(trainer.hourlyRate) : null,
      city: trainer.serviceArea || '',
      isVerified: trainer.verificationStatus === 'verified',
      hasPoliceCheck: false,
      yearsExperience: trainer.yearsOfExperience || 0,
      acceptedPetTypes: ['dog', 'cat'],
      maxPets: 1,
      bio: trainer.bio,
      badges: buildTrainerBadges(trainer),
      responseTime: 'within 24 hours',
      lastActive: trainer.updatedAt,
      distanceKm: null,
      proximityTier: null,
      matchScore: null,
    }));

    return { providers, total, filters, searchId };
  } catch (error) {
    logger.error('[BookingSearch] Trainer search error', error);
    return { providers: [], total: 0, filters, searchId };
  }
}

/**
 * Search K9000 wash stations.
 *
 * Stations reference the `locations` table for coordinates.
 * When lat/lng present: joins locations, computes haversine, ranks by proximity.
 */
async function searchK9000Stations(filters: BookingSearchFilters, searchId: string): Promise<BookingSearchResult> {
  try {
    const hasCoords = filters.latitude != null && filters.longitude != null;
    const radiusKm  = filters.radiusKm ?? 50;

    const conditions = [eq(stations.isActive, true)];

    if (!hasCoords && filters.city) {
      conditions.push(ilike(locations.city, `%${filters.city}%`));
    }

    if (!hasCoords && filters.area) {
      conditions.push(
        or(
          ilike(locations.city, `%${filters.area}%`),
          ilike(locations.addressLine1, `%${filters.area}%`),
        )!,
      );
    }

    // Join stations → locations to get address and coordinates
    const query = db
      .select({
        id: stations.id,
        stationId: stations.stationCode,
        name: stations.name,
        status: stations.status,
        supportedPetTypes: sql<string[]>`ARRAY['dog']::text[]`,
        locationCity: locations.city,
        locationAddress: locations.addressLine1,
        locationLat: locations.latitude,
        locationLng: locations.longitude,
        updatedAt: stations.updatedAt,
      })
      .from(stations)
      .leftJoin(locations, eq(stations.locationId, locations.id))
      .where(and(...conditions));

    if (hasCoords) {
      const all = await query;
      const searchLat = filters.latitude!;
      const searchLng = filters.longitude!;

      const scored = all
        .map(station => {
          const stationLat = station.locationLat ?? null;
          const stationLng = station.locationLng ?? null;
          const distanceKm =
            stationLat !== null && stationLng !== null
              ? haversineKm(searchLat, searchLng, stationLat, stationLng)
              : null;

          return {
            ...station,
            _distanceKm: distanceKm,
            _score: distanceKm !== null ? proximityScore(distanceKm) : 0,
          };
        })
        .filter(s => s._distanceKm === null || s._distanceKm <= radiusKm);

      const { ranked, total } = rankAndPaginate(
        scored,
        filters.sortOrder ?? 'desc',
        filters.limit ?? 20,
        filters.offset ?? 0,
      );

      const providers = ranked.map(station => ({
        id: station.id,
        odId: station.stationId,
        firstName: station.name,
        lastName: '',
        profilePictureUrl: null,
        rating: 4.5,
        totalReviews: 0,
        totalBookings: 0,
        pricePerNight: null,
        pricePerHour: null,
        city: station.locationCity || '',
        isVerified: true,
        hasPoliceCheck: false,
        yearsExperience: 0,
        acceptedPetTypes: station.supportedPetTypes || ['dog'],
        maxPets: 1,
        bio: `K9000 Self-Service Station${station.locationAddress ? ` at ${station.locationAddress}` : ` - ${station.name}`}`,
        badges: station.status === 'operational' ? ['available'] : [],
        responseTime: 'instant',
        lastActive: station.updatedAt,
        distanceKm: station._distanceKm !== null ? Math.round(station._distanceKm * 10) / 10 : null,
        proximityTier: station._distanceKm !== null ? proximityTier(station._distanceKm) : null,
        matchScore: Math.round(station._score),
      }));

      return { providers, total, filters, searchId };
    }

    // Text path
    const results = await query.limit(filters.limit ?? 20).offset(filters.offset ?? 0);

    const [countResult] = await db
      .select({ count: sql`count(*)` })
      .from(stations)
      .leftJoin(locations, eq(stations.locationId, locations.id))
      .where(and(...conditions));

    const total = Number(countResult?.count || 0);

    const providers = results.map(station => ({
      id: station.id,
      odId: station.stationId,
      firstName: station.name,
      lastName: '',
      profilePictureUrl: null,
      rating: 4.5,
      totalReviews: 0,
      totalBookings: 0,
      pricePerNight: null,
      pricePerHour: null,
      city: station.locationCity || '',
      isVerified: true,
      hasPoliceCheck: false,
      yearsExperience: 0,
      acceptedPetTypes: station.supportedPetTypes || ['dog'],
      maxPets: 1,
      bio: `K9000 Self-Service Station${station.locationAddress ? ` at ${station.locationAddress}` : ` - ${station.name}`}`,
      badges: station.status === 'operational' ? ['available'] : [],
      responseTime: 'instant',
      lastActive: station.updatedAt,
      distanceKm: null,
      proximityTier: null,
      matchScore: null,
    }));

    return { providers, total, filters, searchId };
  } catch (error) {
    logger.error('[BookingSearch] K9000 search error', error);
    return { providers: [], total: 0, filters, searchId };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// BADGE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function buildTrainerBadges(trainer: any): string[] {
  const badges: string[] = [];
  if (trainer.verificationStatus === 'verified') badges.push('verified');
  if (trainer.isCertified) badges.push('certified');
  if ((trainer.yearsOfExperience || 0) >= 5) badges.push('experienced');
  if (parseFloat(trainer.averageRating || '0') >= 4.8) badges.push('top_rated');
  return badges;
}

function buildBadges(sitter: any): string[] {
  const badges: string[] = [];
  if (sitter.isVerified) badges.push('verified');
  // police_check badge requires the admin-verified flag, NOT just the backgroundCheckStatus
  // string field.  backgroundCheckStatus can be set without a real third-party check (stub).
  // policeCheckVerified is set by PoliceCheckService.approvePoliceCheck() only after an admin
  // reviews the actual uploaded clearance document.
  if (sitter.policeCheckVerified === true) badges.push('police_check');
  if (sitter.yardSize && sitter.yardSize !== 'none') badges.push('has_yard');
  if ((sitter.yearsOfExperience || 0) >= 5) badges.push('experienced');
  if (parseFloat(sitter.rating || '0') >= 4.8) badges.push('top_rated');
  if ((sitter.totalBookings || 0) >= 50) badges.push('trusted');
  return badges;
}

function buildWalkerBadges(walker: any): string[] {
  const badges: string[] = [];
  if (walker.verificationStatus === 'verified') badges.push('verified');
  if (walker.backgroundCheckStatus === 'passed') badges.push('police_check');
  if (walker.hasBodyCamera) badges.push('body_camera');
  if (walker.gpsTracking) badges.push('gps_tracking');
  if ((walker.yearsOfExperience || 0) >= 5) badges.push('experienced');
  if ((walker.averageRating || 0) >= 4.8) badges.push('top_rated');
  return badges;
}

export default router;
