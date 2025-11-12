/**
 * EMERGENCY WALK SERVICE - Walk My Pet™
 * 
 * ASAP booking system inspired by Rover's "Book Now" and Wag's "On-Demand Walks"
 * 
 * Features:
 * - 90-minute arrival guarantee (or best effort)
 * - Auto-matching with nearby available walkers
 * - Surge pricing during high demand (like Uber/Lyft)
 * - WhatsApp Business notifications (Hebrew-first)
 * - Same commission: 24% total (6% owner + 18% walker, walker gets 82%)
 * 
 * Israeli Compliance:
 * - Currency: ILS (Israeli Shekel)
 * - VAT: 18% automatic calculation
 * - Payment: Nayax Israel ONLY
 */

import { db } from '../db';
import { walkBookings, users } from '@db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { calculateWalkFees, type WalkFeeCalculation } from '../utils/walkFeeCalculator';

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

      // Step 4: Auto-match with best walker (closest + highest rated)
      const matchedWalker = this.selectBestWalker(availableWalkers);

      logger.info('[Emergency Walk] Walker matched', {
        walkerId: matchedWalker.walkerId,
        walkerName: matchedWalker.walkerName,
        distanceKm: matchedWalker.distanceKm,
        eta: matchedWalker.estimatedArrivalMinutes,
      });

      // Step 5: Create walk booking with "emergency" flag
      const bookingId = `EMERG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const estimatedStartTime = new Date();
      estimatedStartTime.setMinutes(
        estimatedStartTime.getMinutes() + matchedWalker.estimatedArrivalMinutes
      );

      const estimatedEndTime = new Date(estimatedStartTime);
      estimatedEndTime.setMinutes(
        estimatedEndTime.getMinutes() + request.walkDuration
      );

      // Insert emergency walk booking
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
      await this.sendEmergencyNotifications({
        bookingId,
        owner: {
          email: request.ownerEmail,
          phone: 'TODO', // Get from user profile
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
      logger.error('[Emergency Walk] Request failed', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Calculate surge pricing based on demand and time
   * 
   * Surge Multipliers (like Uber/Lyft):
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

    // MOCK DATA for development/testing
    // Production: Query from walkerProfiles table with geospatial index
    // Example query:
    // SELECT * FROM walker_profiles
    // WHERE is_available = true
    // AND verification_status = 'verified'
    // AND ST_Distance(location, ST_MakePoint(lng, lat)) < 10000 (meters)
    // ORDER BY rating DESC, total_walks DESC
    
    const mockWalkers: WalkerMatch[] = [
      {
        walkerId: 'walker-001',
        walkerName: 'David Cohen',
        walkerEmail: 'david@example.com',
        walkerPhone: '+972501234567',
        distanceKm: 1.2,
        rating: 4.8,
        completedWalks: 156,
        estimatedArrivalMinutes: 15,
      },
      {
        walkerId: 'walker-002',
        walkerName: 'Sarah Levi',
        walkerEmail: 'sarah@example.com',
        walkerPhone: '+972507654321',
        distanceKm: 2.5,
        rating: 4.9,
        completedWalks: 203,
        estimatedArrivalMinutes: 25,
      },
      {
        walkerId: 'walker-003',
        walkerName: 'Yossi Mizrahi',
        walkerEmail: 'yossi@example.com',
        walkerPhone: '+972509876543',
        distanceKm: 0.8,
        rating: 4.6,
        completedWalks: 89,
        estimatedArrivalMinutes: 10,
      },
    ];

    return mockWalkers.filter(walker => walker.rating >= 4.0);
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
    // Handle single walker case
    if (walkers.length === 1) {
      return walkers[0];
    }
    
    const scored = walkers.map(walker => {
      // Normalize scores (0-1 scale) with safe divide-by-zero checks
      const maxDistance = Math.max(...walkers.map(w => w.distanceKm), 1);
      const maxWalks = Math.max(...walkers.map(w => w.completedWalks), 1);
      const maxEta = Math.max(...walkers.map(w => w.estimatedArrivalMinutes), 1);

      const distanceScore = 1 - (walker.distanceKm / maxDistance); // Closer = higher
      const ratingScore = walker.rating / 5.0; // 0-1 scale
      const experienceScore = walker.completedWalks / maxWalks; // 0-1 scale
      const etaScore = 1 - (walker.estimatedArrivalMinutes / maxEta); // Faster = higher

      // Weighted total
      const totalScore =
        distanceScore * 0.4 +
        ratingScore * 0.3 +
        experienceScore * 0.2 +
        etaScore * 0.1;

      return { walker, score: totalScore };
    });

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    return scored[0].walker;
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

    // NOTE: WhatsApp integration requires TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN
    // For now, logging messages (production will use Twilio API)
    
    const ownerMessageHE = `
🐾 יש לנו מטייל!

שלום! מצאנו מטייל זמין עבור ${params.petName} ✨

👤 מטייל: ${params.walker.name}
⏰ זמן הגעה משוער: ${this.formatETA(params.eta)}
💰 מחיר כולל: ₪${params.pricing.totalChargeWithVAT}

המטייל בדרך אליך! 🚀

- צוות Walk My Pet™
    `.trim();

    const walkerMessageHE = `
🚨 בקשה דחופה להליכה!

טיול חירום חדש זמין:

🐾 שם החיות: ${params.petName}
📍 מיקום: [מוצג באפליקציה]
💰 הרווח שלך: ₪${params.pricing.walkerPayout}

האם אתה מקבל את ההזמנה? יש לך 60 שניות להגיב.

- צוות Walk My Pet™
    `.trim();

    // Log WhatsApp notifications (production will send via Twilio)
    logger.info('[WhatsApp] Owner notification (HE)', {
      to: params.owner.phone || 'phone_from_profile',
      message: ownerMessageHE,
    });

    logger.info('[WhatsApp] Walker notification (HE)', {
      to: params.walker.phone,
      message: walkerMessageHE,
    });
    
    // Production: Use Twilio WhatsApp Business API
    // await smsService.sendWhatsApp(params.owner.phone, ownerMessageHE);
    // await smsService.sendWhatsApp(params.walker.phone, walkerMessageHE);
  }

  /**
   * Get active walks in area (for demand calculation)
   */
  private static async getActiveWalksInArea(
    location: { latitude: number; longitude: number },
    radiusKm: number
  ): Promise<number> {
    // TODO: Query database with geospatial index
    // For now, return mock data
    return Math.floor(Math.random() * 10);
  }

  /**
   * Get available walkers in area (for demand calculation)
   */
  private static async getAvailableWalkersInArea(
    location: { latitude: number; longitude: number },
    radiusKm: number
  ): Promise<number> {
    // TODO: Query database with geospatial index
    // For now, return mock data
    return Math.floor(Math.random() * 15) + 5; // 5-20 walkers
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
