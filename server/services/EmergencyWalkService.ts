/**
 * EMERGENCY WALK SERVICE - ⁦Walk My Pet™⁩
 * 
 * ASAP booking system with PetWash™ "Book Now" and "On-Demand Walks"
 * 
 * Features:
 * - 90-minute arrival guarantee (or best effort)
 * - Auto-matching with nearby available walkers
 * - Surge pricing during high demand (on-demand surge)
 * - WhatsApp Business notifications (Hebrew-first)
 * - Same commission: 15% platform commission, walker gets 85%
 * 
 * Israeli Compliance:
 * - Currency: ILS (Israeli Shekel)
 * - VAT: 18% automatic calculation
 * - Payment: Nayax Israel ONLY
 */

import crypto from 'crypto';
import { db } from '../db';
import { walkBookings, walkerProfiles, users } from '@shared/schema';
import { eq, and, sql, gte, desc, isNotNull } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { calculateWalkFees, type WalkFeeCalculation } from '../utils/walkFeeCalculator';
import { acquireSlotLock, releaseSlotLock, BookingSlotConflictError } from '../lib/marketplaceSlotLock';

interface EmergencyWalkRequest {
  ownerId: string;
  ownerEmail: string;
  petName: string;
  petBreed: string;
  petWeight: number; // kg
  specialInstructions?: string;
  location: {
    latitude: number;
    longitude: number;
    address: string;
  };
  walkDuration: 30 | 60; // minutes (ASAP walks: 30 or 60 min only)
}

interface WalkerMatch {
  walkerId: string;
  walkerUserId: string;   // walker's Firebase UID — the canonical slot-lock key
  walkerName: string;
  walkerEmail: string;
  walkerPhone: string;
  distanceKm: number;
  rating: number;
  completedWalks: number;
  estimatedArrivalMinutes: number;
}

interface SurgePricing {
  basePriceCents: number;
  surgeMultiplier: number; // 1.0 = no surge, 1.5 = 50% increase, 2.0 = double
  surgePriceCents: number;
  reason: string;
}

export class EmergencyWalkService {
  
  /**
   * Request emergency ASAP walk with auto-matching
   * 
   * Flow:
   * 1. Calculate base price + surge pricing
   * 2. Find nearby available walkers
   * 3. Auto-match with closest/highest rated
   * 4. Send WhatsApp notifications (Hebrew-first)
   * 5. Create walk booking with "emergency" flag
   * 
   * Returns: Matched walker + pricing + ETA
   */
  static async requestEmergencyWalk(request: EmergencyWalkRequest): Promise<{
    success: boolean;
    bookingId?: string;
    matchedWalker?: WalkerMatch;
    pricing?: WalkFeeCalculation;
    surgePricing?: SurgePricing;
    eta?: Date;
    error?: string;
  }> {
    // Hoisted so the outer catch can free the slot lock if a matched booking
    // fails after the lock was grabbed (P1 fix).
    let lockedBookingRef: string | null = null;
    try {
      logger.info('[Emergency Walk] New ASAP request received', {
        ownerId: request.ownerId,
        petName: request.petName,
        duration: request.walkDuration,
        location: request.location,
      });

      // Step 1: Calculate surge pricing
      const surgePricing = await this.calculateSurgePricing(
        request.walkDuration,
        request.location
      );

      logger.info('[Emergency Walk] Surge pricing calculated', {
        basePriceCents: surgePricing.basePriceCents,
        surgeMultiplier: surgePricing.surgeMultiplier,
        surgePriceCents: surgePricing.surgePriceCents,
        reason: surgePricing.reason,
      });

      // Step 2: Calculate full fees with surge price
      const fees = calculateWalkFees(surgePricing.surgePriceCents);

      // Step 3: Find nearby available walkers
      const availableWalkers = await this.findAvailableWalkers(
        request.location,
        request.walkDuration
      );

      if (availableWalkers.length === 0) {
        logger.warn('[Emergency Walk] No walkers available', {
          location: request.location,
          requestedDuration: request.walkDuration,
        });

        return {
          success: false,
          error: 'No walkers available in your area. Please try scheduling a walk in advance.',
        };
      }

      // Step 4: Auto-match — try candidates best-first, grabbing an atomic slot
      // lock for each so two concurrent ASAP requests can NEVER both match the
      // same walker (P1 fix: emergency previously inserted a 'confirmed' walk with
      // no lock). If the top pick was just booked, FAIL OVER to the next walker
      // rather than erroring — the right behaviour for an emergency flow. The lock
      // is keyed on the walker's canonical Firebase userId (same key space as the
      // scheduled walk/sitter/marketplace arms), so it also blocks a cross-arm clash.
      const ranked = this.rankWalkers(availableWalkers);
      let matchedWalker: WalkerMatch | null = null;
      let bookingId = '';
      let estimatedStartTime = new Date();
      let estimatedEndTime = new Date();

      for (const candidate of ranked) {
        const candBookingId = `EMERG-${Date.now()}-${crypto.randomBytes(5).toString('hex')}`;
        const start = new Date();
        start.setMinutes(start.getMinutes() + candidate.estimatedArrivalMinutes);
        const end = new Date(start);
        end.setMinutes(end.getMinutes() + request.walkDuration);
        try {
          await acquireSlotLock(db, {
            providerId: candidate.walkerUserId || `walker:${candidate.walkerId}`,
            startAt: start,
            endAt: end,
            bookingRef: candBookingId,
            serviceType: 'dog_walking',
          });
        } catch (lockErr) {
          if (lockErr instanceof BookingSlotConflictError) {
            logger.info('[Emergency Walk] candidate just booked — failing over to next', {
              walkerId: candidate.walkerId,
            });
            continue;
          }
          throw lockErr;
        }
        matchedWalker = candidate;
        bookingId = candBookingId;
        lockedBookingRef = candBookingId;
        estimatedStartTime = start;
        estimatedEndTime = end;
        break;
      }

      if (!matchedWalker) {
        return {
          success: false,
          error: 'All nearby walkers were just booked. Please try again in a moment.',
        };
      }

      logger.info('[Emergency Walk] Walker matched + slot locked', {
        walkerId: matchedWalker.walkerId,
        walkerName: matchedWalker.walkerName,
        distanceKm: matchedWalker.distanceKm,
        eta: matchedWalker.estimatedArrivalMinutes,
      });

      // Step 5: Insert emergency walk booking under the held lock.
      await db.insert(walkBookings).values({
        bookingId,
        ownerId: request.ownerId,
        ownerEmail: request.ownerEmail,
        walkerId: matchedWalker.walkerId,
        petName: request.petName,
        petBreed: request.petBreed,
        petWeight: request.petWeight.toString(),
        specialInstructions: request.specialInstructions || null,
        scheduledDate: new Date(),
        scheduledTime: estimatedStartTime.toTimeString().slice(0, 5),
        estimatedDuration: request.walkDuration,
        totalCost: (fees.totalChargeWithVATCents / 100).toFixed(2),
        currency: 'ILS',
        status: 'confirmed',
        paymentStatus: 'pending',
        isEmergencyWalk: true, // Flag for emergency/ASAP
        emergencySurgeMultiplier: surgePricing.surgeMultiplier.toString(),
        estimatedStartTime,
        estimatedEndTime,
        pickupLocation: request.location as any,
        // Legal source tag (booking-hardening 2026-06-20) — prove platform of origin.
        serviceSource: 'walk_my_pet',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      logger.info('[Emergency Walk] Booking created', {
        bookingId,
        totalCostWithVAT: fees.totalChargeWithVAT,
        walkerPayout: fees.walkerPayout,
        platformCommission: fees.platformCommissionTotal,
      });

      // Step 6: Send WhatsApp notifications (Hebrew-first)
      // Owner phone comes from the profile — never a placeholder in a safety flow.
      const [ownerProfile] = await db
        .select({ phone: users.phone })
        .from(users)
        .where(eq(users.id, request.ownerId))
        .limit(1)
        .catch(() => []);

      await this.sendEmergencyNotifications({
        bookingId,
        owner: {
          email: request.ownerEmail,
          phone: ownerProfile?.phone || '',
        },
        walker: {
          name: matchedWalker.walkerName,
          email: matchedWalker.walkerEmail,
          phone: matchedWalker.walkerPhone,
        },
        petName: request.petName,
        eta: estimatedStartTime,
        pricing: fees,
      });

      return {
        success: true,
        bookingId,
        matchedWalker,
        pricing: fees,
        surgePricing,
        eta: estimatedStartTime,
      };

    } catch (error) {
      // Free the slot lock if we grabbed it but the emergency booking failed to
      // materialise, so a failed attempt never blocks the walker's calendar.
      if (lockedBookingRef) {
        await releaseSlotLock(db, lockedBookingRef).catch((relErr) =>
          logger.warn('[Emergency Walk] slot-lock release after failed booking skipped', { error: String(relErr) }),
        );
      }
      logger.error('[Emergency Walk] Request failed', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Calculate surge pricing based on demand and time
   * 
   * Surge Multipliers (on-demand surge):
   * - Low demand: 1.0x (no surge)
   * - Medium demand: 1.25x
   * - High demand: 1.5x
   * - Very high demand: 2.0x
   * - Peak hours (8-10 AM, 5-8 PM): +0.25x
   * - Weekends: +0.1x
   * - Holidays: +0.3x
   */
  private static async calculateSurgePricing(
    durationMinutes: number,
    location: { latitude: number; longitude: number }
  ): Promise<SurgePricing> {
    // Base price per duration (₪ cents)
    const basePrices: Record<number, number> = {
      30: 8000, // ₪80 for 30 minutes
      60: 15000, // ₪150 for 60 minutes
    };

    const basePriceCents = basePrices[durationMinutes] || 8000;
    
    // Calculate surge multiplier
    let surgeMultiplier = 1.0;
    const surgeReasons: string[] = [];

    // Check demand (query active walks in area)
    const activeBookings = await this.getActiveWalksInArea(location, 5); // 5km radius
    const availableWalkers = await this.getAvailableWalkersInArea(location, 5);
    
    const demandRatio = activeBookings / Math.max(availableWalkers, 1);

    if (demandRatio > 0.8) {
      surgeMultiplier = 2.0;
      surgeReasons.push('Very high demand in your area');
    } else if (demandRatio > 0.6) {
      surgeMultiplier = 1.5;
      surgeReasons.push('High demand in your area');
    } else if (demandRatio > 0.4) {
      surgeMultiplier = 1.25;
      surgeReasons.push('Increased demand in your area');
    }

    // Time-based surge (CAPPED at 2.0x total)
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay();

    // Peak hours (8-10 AM, 5-8 PM)
    if ((hour >= 8 && hour < 10) || (hour >= 17 && hour < 20)) {
      surgeMultiplier = Math.min(surgeMultiplier + 0.25, 2.0);
      surgeReasons.push('Peak hours');
    }

    // Weekends
    if (day === 0 || day === 6) {
      surgeMultiplier = Math.min(surgeMultiplier + 0.1, 2.0);
      surgeReasons.push('Weekend');
    }
    
    // FINAL CAP: Ensure surge never exceeds 2.0x
    surgeMultiplier = Math.min(surgeMultiplier, 2.0);

    // Calculate final surge price
    const surgePriceCents = Math.round(basePriceCents * surgeMultiplier);

    return {
      basePriceCents,
      surgeMultiplier,
      surgePriceCents,
      reason: surgeReasons.length > 0 
        ? surgeReasons.join(', ') 
        : 'Standard pricing',
    };
  }

  /**
   * Find available walkers within radius of owner's location
   * 
   * Criteria:
   * - Currently online/available
   * - Within 10km radius
   * - Has completed onboarding
   * - Has acceptable rating (>= 4.0)
   * - Not currently on a walk
   * 
   * NOTE: Production implementation will query from walkerProfiles table using:
   * - PostGIS geospatial queries (ST_Distance)
   * - isAvailable = true filter
   * - verificationStatus = 'verified' filter
   * - Real-time availability status
   */
  private static async findAvailableWalkers(
    location: { latitude: number; longitude: number },
    requiredDuration: number
  ): Promise<WalkerMatch[]> {
    logger.info('[Emergency Walk] Searching for available walkers', {
      location,
      radius: '10km',
    });

    // Query verified, available walkers who have GPS coordinates set.
    // Using Haversine formula via raw SQL for distance calculation since
    // PostGIS may not be available on all deployments.
    const results = await db
      .select({
        walkerId: walkerProfiles.walkerId,
        userId: walkerProfiles.userId,
        firstName: walkerProfiles.firstName,
        lastName: walkerProfiles.lastName,
        averageRating: walkerProfiles.averageRating,
        totalWalks: walkerProfiles.totalWalks,
        currentLatitude: walkerProfiles.currentLatitude,
        currentLongitude: walkerProfiles.currentLongitude,
      })
      .from(walkerProfiles)
      .where(
        and(
          eq(walkerProfiles.verificationStatus, 'verified'),
          eq(walkerProfiles.kycCompleted, true),
          isNotNull(walkerProfiles.currentLatitude),
          isNotNull(walkerProfiles.currentLongitude),
          gte(walkerProfiles.averageRating, '4.0')
        )
      )
      .orderBy(desc(walkerProfiles.averageRating))
      .limit(20);

    if (results.length === 0) {
      logger.warn('[Emergency Walk] No verified walkers found in DB with location data', { location });
      return [];
    }

    // Calculate distances in-process using Haversine formula
    const SEARCH_RADIUS_KM = 10;
    const R = 6371; // Earth radius in km

    const nearby: WalkerMatch[] = results
      .map(walker => {
        const lat1 = location.latitude * (Math.PI / 180);
        const lat2 = parseFloat(String(walker.currentLatitude ?? 0)) * (Math.PI / 180);
        const dLat = lat2 - lat1;
        const dLon =
          (parseFloat(String(walker.currentLongitude ?? 0)) - location.longitude) * (Math.PI / 180);
        const a =
          Math.sin(dLat / 2) ** 2 +
          Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
        const distanceKm = 2 * R * Math.asin(Math.sqrt(a));
        const estimatedArrivalMinutes = Math.round(distanceKm * 3 + 5); // ~20 km/h city speed + 5 min prep

        return {
          walkerId: walker.walkerId,
          walkerUserId: walker.userId,
          walkerName: `${walker.firstName} ${walker.lastName}`,
          walkerEmail: '',  // Not exposed in emergency match for privacy
          walkerPhone: '',  // Fetched only after booking confirmed
          distanceKm: parseFloat(distanceKm.toFixed(2)),
          rating: parseFloat(String(walker.averageRating ?? '0')),
          completedWalks: walker.totalWalks ?? 0,
          estimatedArrivalMinutes,
        };
      })
      .filter(w => w.distanceKm <= SEARCH_RADIUS_KM);

    logger.info('[Emergency Walk] Walkers found within radius', {
      total: results.length,
      withinRadius: nearby.length,
      radiusKm: SEARCH_RADIUS_KM,
    });

    return nearby;
  }

  /**
   * Select best walker using weighted scoring
   * 
   * Scoring Algorithm:
   * - Distance: 40% weight (closer is better)
   * - Rating: 30% weight (higher is better)
   * - Experience: 20% weight (more walks is better)
   * - ETA: 10% weight (faster is better)
   */
  private static selectBestWalker(walkers: WalkerMatch[]): WalkerMatch {
    return this.rankWalkers(walkers)[0];
  }

  /**
   * Rank candidate walkers best-first by the same weighted score. Returned as an
   * ordered list so the emergency flow can FAIL OVER to the next walker when the
   * top pick was just booked (a concurrent ASAP request grabbed the slot lock).
   */
  private static rankWalkers(walkers: WalkerMatch[]): WalkerMatch[] {
    if (walkers.length <= 1) return [...walkers];

    const maxDistance = Math.max(...walkers.map(w => w.distanceKm), 1);
    const maxWalks = Math.max(...walkers.map(w => w.completedWalks), 1);
    const maxEta = Math.max(...walkers.map(w => w.estimatedArrivalMinutes), 1);

    const scored = walkers.map(walker => {
      const distanceScore = 1 - (walker.distanceKm / maxDistance); // Closer = higher
      const ratingScore = walker.rating / 5.0; // 0-1 scale
      const experienceScore = walker.completedWalks / maxWalks; // 0-1 scale
      const etaScore = 1 - (walker.estimatedArrivalMinutes / maxEta); // Faster = higher
      const totalScore =
        distanceScore * 0.4 +
        ratingScore * 0.3 +
        experienceScore * 0.2 +
        etaScore * 0.1;
      return { walker, score: totalScore };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.map(s => s.walker);
  }

  /**
   * Send WhatsApp Business notifications (Hebrew-first)
   * 
   * Notifications:
   * 1. Owner: "Walker found! ETA X minutes"
   * 2. Walker: "New emergency walk request - Accept?"
   * 3. Platform: Alert for monitoring
   */
  private static async sendEmergencyNotifications(params: {
    bookingId: string;
    owner: { email: string; phone?: string };
    walker: { name: string; email: string; phone: string };
    petName: string;
    eta: Date;
    pricing: WalkFeeCalculation;
  }): Promise<void> {
    logger.info('[Emergency Walk] Sending WhatsApp notifications', {
      bookingId: params.bookingId,
      ownerEmail: params.owner.email,
      walkerName: params.walker.name,
    });

    // NOTE: WhatsApp integration uses Meta WhatsApp Business API (NOT Twilio)
    // For now, logging messages (production will use Meta API)
    
    const ownerMessageHE = `
🐾 יש לנו מטייל!

שלום! מצאנו מטייל זמין עבור ${params.petName} ✨

👤 מטייל: ${params.walker.name}
⏰ זמן הגעה משוער: ${this.formatETA(params.eta)}
💰 מחיר כולל: ₪${params.pricing.totalChargeWithVAT}

המטייל בדרך אליך! 🚀

- צוות ⁦Walk My Pet™⁩
    `.trim();

    const walkerMessageHE = `
🚨 בקשה דחופה להליכה!

טיול חירום חדש זמין:

🐾 שם החיות: ${params.petName}
📍 מיקום: [מוצג באפליקציה]
💰 הרווח שלך: ₪${params.pricing.walkerPayout}

האם אתה מקבל את ההזמנה? יש לך 60 שניות להגיב.

- צוות ⁦Walk My Pet™⁩
    `.trim();

    // Log WhatsApp notifications (production will send via Meta WhatsApp Business API)
    logger.info('[WhatsApp] Owner notification (HE)', {
      to: params.owner.phone || 'phone_from_profile',
      message: ownerMessageHE,
    });

    logger.info('[WhatsApp] Walker notification (HE)', {
      to: params.walker.phone,
      message: walkerMessageHE,
    });
    
    // Production: Use Meta WhatsApp Business API (NOT Twilio)
    // await whatsappService.sendMessage(params.owner.phone, ownerMessageHE);
    // await whatsappService.sendMessage(params.walker.phone, walkerMessageHE);
  }

  /**
   * Get active walks in area using Haversine distance on walk_bookings
   */
  private static async getActiveWalksInArea(
    location: { latitude: number; longitude: number },
    radiusKm: number
  ): Promise<number> {
    try {
      const result = await db.execute(sql`
        SELECT COUNT(*) AS cnt
        FROM walk_bookings wb
        WHERE wb.status IN ('confirmed', 'in_progress', 'walker_en_route')
          AND wb.walk_date >= CURRENT_DATE
          AND wb.owner_lat IS NOT NULL
          AND wb.owner_lng IS NOT NULL
          AND (
            6371 * acos(
              cos(radians(${location.latitude})) *
              cos(radians(wb.owner_lat::float)) *
              cos(radians(wb.owner_lng::float) - radians(${location.longitude})) +
              sin(radians(${location.latitude})) *
              sin(radians(wb.owner_lat::float))
            )
          ) <= ${radiusKm}
      `);
      return parseInt((result.rows[0] as any)?.cnt ?? '0');
    } catch {
      return 0;
    }
  }

  /**
   * Get available walkers in area using Haversine distance on users/providers
   */
  private static async getAvailableWalkersInArea(
    location: { latitude: number; longitude: number },
    radiusKm: number
  ): Promise<number> {
    try {
      const result = await db.execute(sql`
        SELECT COUNT(DISTINCT u.id) AS cnt
        FROM users u
        WHERE u.user_type IN ('walker', 'provider')
          AND u.is_active = true
          AND u.current_latitude  IS NOT NULL
          AND u.current_longitude IS NOT NULL
          AND u.is_available_for_emergency = true
          AND (
            6371 * acos(
              cos(radians(${location.latitude})) *
              cos(radians(u.current_latitude::float)) *
              cos(radians(u.current_longitude::float) - radians(${location.longitude})) +
              sin(radians(${location.latitude})) *
              sin(radians(u.current_latitude::float))
            )
          ) <= ${radiusKm}
      `);
      return parseInt((result.rows[0] as any)?.cnt ?? '0');
    } catch {
      return 0;
    }
  }

  /**
   * Format ETA for display (Hebrew)
   */
  private static formatETA(eta: Date): string {
    const now = new Date();
    const diffMinutes = Math.floor((eta.getTime() - now.getTime()) / 60000);

    if (diffMinutes < 60) {
      return `${diffMinutes} דקות`;
    } else {
      const hours = Math.floor(diffMinutes / 60);
      const minutes = diffMinutes % 60;
      return `${hours} שעות ו-${minutes} דקות`;
    }
  }
}
