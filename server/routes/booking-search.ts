/**
 * MADPAWS-STYLE BOOKING SEARCH API
 * 
 * Unified search across all pet service providers with comprehensive filters:
 * - Pet count, types, sizes, names
 * - Location/area
 * - Date range
 * - Provider qualifications
 */

import { Router } from 'express';
import { db } from '../db';
import { 
  sitterProfiles, 
  walkerProfiles,
  pets,
  trainers,
  drivers,
  stations,
  bookingSearchFiltersSchema,
  type BookingSearchFilters,
  type BookingSearchResult 
} from '@shared/schema';
import { eq, and, gte, lte, sql, desc, asc, or, ilike } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { nanoid } from 'nanoid';

const router = Router();

/**
 * POST /api/booking-search - MadPaws-style unified search
 */
router.post('/', async (req, res) => {
  try {
    const filters = bookingSearchFiltersSchema.parse(req.body);
    const searchId = nanoid(12);
    
    logger.info('[BookingSearch] Search request', {
      searchId,
      serviceType: filters.serviceType,
      petCount: filters.petCount,
      petTypes: filters.petTypes,
      city: filters.city,
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
        result = await searchDrivers(filters, searchId);
        break;
      
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
    logger.error('[BookingSearch] Search error', { error: error.message });
    
    if (error.name === 'ZodError') {
      return res.status(400).json({ 
        error: 'Invalid search filters', 
        details: error.errors 
      });
    }
    
    res.status(500).json({ error: 'Booking search failed' });
  }
});

/**
 * GET /api/booking-search/my-pets - Get user's pets for search filter
 */
router.get('/my-pets', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userPets = await db.select({
      id: pets.id,
      name: pets.name,
      species: pets.species,
      breed: pets.breed,
      size: pets.size,
      photoUrl: pets.photoUrl,
    })
    .from(pets)
    .where(and(
      eq(pets.userId, userId),
      eq(pets.isActive, true)
    ));

    res.json({ pets: userPets });
  } catch (error: any) {
    logger.error('[BookingSearch] Error fetching user pets', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch pets' });
  }
});

/**
 * GET /api/booking-search/cities - Get available cities for search
 */
router.get('/cities', async (req, res) => {
  try {
    const cities = await db.selectDistinct({ city: sitterProfiles.city })
      .from(sitterProfiles)
      .where(eq(sitterProfiles.isActive, true));

    const walkerCities = await db.selectDistinct({ city: walkerProfiles.city })
      .from(walkerProfiles)
      .where(eq(walkerProfiles.isActive, true));

    const allCities = [...new Set([
      ...cities.map(c => c.city).filter(Boolean),
      ...walkerCities.map(c => c.city).filter(Boolean)
    ])].sort();

    res.json({ cities: allCities });
  } catch (error: any) {
    logger.error('[BookingSearch] Error fetching cities', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch cities' });
  }
});

/**
 * Search pet sitters
 */
async function searchSitters(filters: BookingSearchFilters, searchId: string): Promise<BookingSearchResult> {
  const conditions = [eq(sitterProfiles.isActive, true)];

  if (filters.city) {
    conditions.push(ilike(sitterProfiles.city, `%${filters.city}%`));
  }

  if (filters.area) {
    conditions.push(or(
      ilike(sitterProfiles.city, `%${filters.area}%`),
      ilike(sitterProfiles.address, `%${filters.area}%`)
    )!);
  }

  if (filters.minRating && filters.minRating > 0) {
    conditions.push(gte(sitterProfiles.rating, filters.minRating.toString()));
  }

  if (filters.verifiedOnly) {
    conditions.push(eq(sitterProfiles.isVerified, true));
  }

  if (filters.petCount) {
    conditions.push(gte(sitterProfiles.maxPets, filters.petCount));
  }

  const orderBy = filters.sortOrder === 'asc' 
    ? asc(sitterProfiles.rating)
    : desc(sitterProfiles.rating);

  const results = await db.select()
    .from(sitterProfiles)
    .where(and(...conditions))
    .orderBy(orderBy)
    .limit(filters.limit || 20)
    .offset(filters.offset || 0);

  const [countResult] = await db.select({ count: sql`count(*)` })
    .from(sitterProfiles)
    .where(and(...conditions));

  const total = Number(countResult?.count || 0);

  const providers = results.map(sitter => ({
    id: sitter.id,
    userId: sitter.userId,
    firstName: sitter.firstName,
    lastName: sitter.lastName || '',
    profilePictureUrl: sitter.profilePictureUrl,
    rating: parseFloat(sitter.rating || '0'),
    totalReviews: sitter.reviewCount || 0,
    totalBookings: sitter.totalBookings || 0,
    pricePerNight: sitter.dailyRate ? parseInt(sitter.dailyRate) : null,
    pricePerHour: sitter.hourlyRate ? parseInt(sitter.hourlyRate) : null,
    city: sitter.city || '',
    isVerified: sitter.isVerified || false,
    hasPoliceCheck: sitter.policeCheckVerified || false,
    yearsExperience: sitter.yearsOfExperience || 0,
    acceptedPetTypes: sitter.acceptedPetTypes || ['dog', 'cat'],
    maxPets: sitter.maxPets || 1,
    bio: sitter.bio,
    badges: buildBadges(sitter),
    responseTime: sitter.responseTime || 'within 24 hours',
    lastActive: sitter.lastActiveAt,
  }));

  return {
    providers,
    total,
    filters,
    searchId,
  };
}

/**
 * Search dog walkers
 */
async function searchWalkers(filters: BookingSearchFilters, searchId: string): Promise<BookingSearchResult> {
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

  const orderBy = filters.sortOrder === 'asc'
    ? asc(walkerProfiles.averageRating)
    : desc(walkerProfiles.averageRating);

  const results = await db.select()
    .from(walkerProfiles)
    .where(and(...conditions))
    .orderBy(orderBy)
    .limit(filters.limit || 20)
    .offset(filters.offset || 0);

  const [countResult] = await db.select({ count: sql`count(*)` })
    .from(walkerProfiles)
    .where(and(...conditions));

  const total = Number(countResult?.count || 0);

  const providers = results.map(walker => ({
    id: walker.id,
    userId: walker.userId,
    firstName: walker.firstName,
    lastName: walker.lastName || '',
    profilePictureUrl: walker.profilePictureUrl,
    rating: parseFloat(walker.averageRating || '0'),
    totalReviews: walker.totalReviews || 0,
    totalBookings: walker.totalWalks || 0,
    pricePerNight: null,
    pricePerHour: walker.hourlyRate ? parseInt(walker.hourlyRate) : null,
    city: walker.city || '',
    isVerified: walker.verificationStatus === 'verified',
    hasPoliceCheck: walker.policeCheckVerified || false,
    yearsExperience: walker.yearsOfExperience || 0,
    acceptedPetTypes: ['dog'],
    maxPets: walker.maxDogsPerWalk || 3,
    bio: walker.bio,
    badges: buildWalkerBadges(walker),
    responseTime: 'within 24 hours',
    lastActive: walker.lastActiveAt,
  }));

  return {
    providers,
    total,
    filters,
    searchId,
  };
}

/**
 * Search groomers - uses trainers table with grooming specialty
 */
async function searchGroomers(filters: BookingSearchFilters, searchId: string): Promise<BookingSearchResult> {
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
    }));

    return { providers, total, filters, searchId };
  } catch (error) {
    logger.error('[BookingSearch] Groomer search error', { error });
    return { providers: [], total: 0, filters, searchId };
  }
}

/**
 * Search pet taxi drivers
 */
async function searchDrivers(filters: BookingSearchFilters, searchId: string): Promise<BookingSearchResult> {
  try {
    const conditions = [eq(drivers.isActive, true)];

    if (filters.city || filters.area) {
      const searchTerm = filters.city || filters.area || '';
      conditions.push(ilike(drivers.areasOfService, `%${searchTerm}%`));
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
    }));

    return { providers, total, filters, searchId };
  } catch (error) {
    logger.error('[BookingSearch] Driver search error', { error });
    return { providers: [], total: 0, filters, searchId };
  }
}

/**
 * Search trainers
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
    }));

    return { providers, total, filters, searchId };
  } catch (error) {
    logger.error('[BookingSearch] Trainer search error', { error });
    return { providers: [], total: 0, filters, searchId };
  }
}

/**
 * Search K9000 stations
 */
async function searchK9000Stations(filters: BookingSearchFilters, searchId: string): Promise<BookingSearchResult> {
  try {
    const conditions = [eq(stations.isActive, true)];

    if (filters.city) {
      conditions.push(ilike(stations.city, `%${filters.city}%`));
    }

    if (filters.area) {
      conditions.push(or(
        ilike(stations.city, `%${filters.area}%`),
        ilike(stations.address, `%${filters.area}%`)
      )!);
    }

    const results = await db.select().from(stations)
      .where(and(...conditions))
      .limit(filters.limit || 20)
      .offset(filters.offset || 0);

    const [countResult] = await db.select({ count: sql`count(*)` })
      .from(stations)
      .where(and(...conditions));

    const total = Number(countResult?.count || 0);

    const providers = results.map(station => ({
      id: station.id,
      odId: station.stationId,
      firstName: station.name,
      lastName: '',
      profilePictureUrl: null,
      rating: parseFloat(station.rating || '4.5'),
      totalReviews: 0,
      totalBookings: 0,
      pricePerNight: null,
      pricePerHour: null,
      city: station.city || '',
      isVerified: true,
      hasPoliceCheck: false,
      yearsExperience: 0,
      acceptedPetTypes: station.supportedPetTypes || ['dog'],
      maxPets: 1,
      bio: `K9000 Self-Service Station at ${station.address}`,
      badges: station.status === 'online' ? ['available'] : [],
      responseTime: 'instant',
      lastActive: station.updatedAt,
    }));

    return { providers, total, filters, searchId };
  } catch (error) {
    logger.error('[BookingSearch] K9000 search error', { error });
    return { providers: [], total: 0, filters, searchId };
  }
}

/**
 * Build badges array for trainer
 */
function buildTrainerBadges(trainer: any): string[] {
  const badges: string[] = [];
  
  if (trainer.verificationStatus === 'verified') badges.push('verified');
  if (trainer.isCertified) badges.push('certified');
  if ((trainer.yearsOfExperience || 0) >= 5) badges.push('experienced');
  if (parseFloat(trainer.averageRating || '0') >= 4.8) badges.push('top_rated');
  
  return badges;
}

/**
 * Build badges array for sitter
 */
function buildBadges(sitter: any): string[] {
  const badges: string[] = [];
  
  if (sitter.isVerified) badges.push('verified');
  if (sitter.policeCheckVerified) badges.push('police_check');
  if (sitter.hasYard) badges.push('has_yard');
  if (sitter.hasFirstAid) badges.push('first_aid');
  if ((sitter.yearsOfExperience || 0) >= 5) badges.push('experienced');
  if ((sitter.rating || 0) >= 4.8) badges.push('top_rated');
  if ((sitter.totalBookings || 0) >= 50) badges.push('trusted');
  
  return badges;
}

/**
 * Build badges array for walker
 */
function buildWalkerBadges(walker: any): string[] {
  const badges: string[] = [];
  
  if (walker.verificationStatus === 'verified') badges.push('verified');
  if (walker.policeCheckVerified) badges.push('police_check');
  if (walker.bodyCamera) badges.push('body_camera');
  if (walker.gpsTracking) badges.push('gps_tracking');
  if ((walker.yearsOfExperience || 0) >= 5) badges.push('experienced');
  if ((walker.averageRating || 0) >= 4.8) badges.push('top_rated');
  
  return badges;
}

export default router;
