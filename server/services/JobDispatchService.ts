/**
 * JOB DISPATCH SERVICE 2026 - Enterprise Uber/Airbnb-Style Job Marketplace
 * 
 * Handles job offers for The Sitter Suite, Walk My Pet (PetTrek coming soon)
 * 
 * Phase 1 Dispatch Features:
 * 1. Batched Offers: Send to top N providers at once, first-accept-wins
 * 2. Smart Ranking Score: 50% distance + 25% rating + 15% acceptance + 10% activity + premium boost
 * 3. Adaptive Radius Expansion: Wave 1 (3km) → Wave 2 (6km) → Wave 3 (10km)
 * 4. Offer Cooldown: Anti-spam logic for providers who reject/ignore jobs
 * 
 * Flow:
 * 1. Customer creates booking → Payment authorized (Nayax hold)
 * 2. Wave 1: Find top 5 providers within 3km, send batched offers with 20s TTL
 * 3. First accept wins (atomic SQL update) → Payment captured, job starts
 * 4. If no accept in 30s → Wave 2 at 6km radius with top 8
 * 5. If still no accept → Wave 3 at 10km with top 12
 * 6. All waves exhausted → Job expires, payment released
 * 
 * Real-time updates via Firestore listeners for instant UX
 */

import admin from "firebase-admin";
import { db } from "../db";
import { jobOffers, operatorPresence } from "@shared/schema";
import { eq, and, sql, ne, gt, isNull, or } from "drizzle-orm";
import NayaxJobDispatchPaymentService from "./NayaxJobDispatchPaymentService";
import { FCMService } from "./FCMService";
import { logger } from "../lib/logger";
import { toMinorUnit } from "../utils/currency";

// ==================== WAVE PLAN (Adaptive Radius) ====================

const WAVE_PLAN = [
  { wave: 1, radiusKm: 3,  ttlSec: 20, topN: 5,  nextAfterSec: 30 },
  { wave: 2, radiusKm: 6,  ttlSec: 20, topN: 8,  nextAfterSec: 30 },
  { wave: 3, radiusKm: 10, ttlSec: 20, topN: 12, nextAfterSec: 30 },
] as const;

// ==================== SMART RANKING WEIGHTS ====================

const SCORE_WEIGHTS = {
  distance:    0.50,
  rating:      0.25,
  acceptance:  0.15,
  activity:    0.10,
  premiumBoost: 0.10,
};

// ==================== COOLDOWN SETTINGS ====================

const COOLDOWN_SETTINGS = {
  rejectsBeforeCooldown: 2,
  ignoresBeforePriorityDrop: 3,
  cooldownDurationMs: 60 * 1000,
  stalePresenceMs: 3 * 60 * 1000,
};

// ==================== TYPE DEFINITIONS ====================

export interface CreateJobOfferParams {
  bookingId: string;
  platform: "sitter-suite" | "walk-my-pet" | "pettrek";
  customerId: string;
  customerName: string;
  customerPaymentToken: string;
  serviceType: string;
  serviceDate: Date;
  duration?: number;
  location: {
    latitude: number;
    longitude: number;
    address: string;
  };
  baseAmount: number;
  platformFee: number;
  vat: number;
  totalCharge: number;
  operatorPayout: number;
  currency?: string;
  petIds?: string[];
  specialInstructions?: string;
  metadata?: any;
}

export interface FindOperatorsParams {
  platform: "sitter-suite" | "walk-my-pet" | "pettrek";
  location: {
    latitude: number;
    longitude: number;
  };
  serviceType: string;
  radiusKm: number;
  maxOperators: number;
  excludeOperatorIds?: string[];
}

export interface RankedOperator {
  operatorId: string;
  operatorName: string | null;
  distanceKm: number;
  score: number;
  ratingAvg: number;
  acceptanceRate: number;
  completedJobs30d: number;
  premiumBadge: boolean;
}

export interface AcceptJobOfferResult {
  success: boolean;
  jobOffer?: any;
  paymentIntent?: any;
  error?: string;
}

// ==================== JOB DISPATCH SERVICE ====================

export class JobDispatchService {
  // ==================== CORE: CREATE JOB OFFER ====================

  static async createJobOffer(params: CreateJobOfferParams): Promise<{
    success: boolean;
    jobOfferId?: string;
    paymentIntentId?: string;
    error?: string;
  }> {
    try {
      if (params.platform === "pettrek") {
        return { success: false, error: "PetTrek dispatch coming soon" };
      }

      logger.info("[JobDispatch] Creating job offer", {
        bookingId: params.bookingId,
        platform: params.platform,
        serviceType: params.serviceType,
      });

      const currency = params.currency || "ILS";
      const amountCents = toMinorUnit(params.totalCharge, currency);
      
      const authResult = await NayaxJobDispatchPaymentService.authorizePayment({
        bookingId: params.bookingId,
        platform: params.platform as 'sitter_suite' | 'walk_my_pet' | 'pet_trek',
        amountCents,
        currency,
        customerPaymentToken: params.customerPaymentToken,
        metadata: {
          customerId: params.customerId,
          customerName: params.customerName,
          serviceType: params.serviceType,
        },
      });

      if (!authResult.success || !authResult.paymentIntentId) {
        logger.error("[JobDispatch] Payment authorization failed", {
          bookingId: params.bookingId,
          error: authResult.error,
        });
        return {
          success: false,
          error: `Payment authorization failed: ${authResult.error}`,
        };
      }

      logger.info("[JobDispatch] Payment authorized", {
        paymentIntentId: authResult.paymentIntentId,
        bookingId: params.bookingId,
      });

      const geohash = this.generateGeohash(params.location.latitude, params.location.longitude);

      const [jobOffer] = await db.insert(jobOffers).values({
        bookingId: params.bookingId,
        platform: params.platform,
        customerId: params.customerId,
        customerName: params.customerName,
        paymentIntentId: authResult.paymentIntentId,
        status: "pending",
        serviceType: params.serviceType,
        serviceDate: params.serviceDate,
        duration: params.duration,
        location: params.location,
        geohash,
        baseAmount: params.baseAmount.toString(),
        platformFee: params.platformFee.toString(),
        vat: params.vat.toString(),
        totalCharge: params.totalCharge.toString(),
        operatorPayout: params.operatorPayout.toString(),
        currency,
        petIds: params.petIds,
        specialInstructions: params.specialInstructions,
        metadata: params.metadata,
        offerHistory: [],
        dispatchWave: 0,
        offeredOperatorIds: [],
      }).returning();

      logger.info("[JobDispatch] Job offer created, starting wave 1", {
        jobOfferId: jobOffer.id,
      });

      await this.writeAudit("JOB_CREATED", jobOffer.id, undefined, {
        serviceType: params.serviceType,
        platform: params.platform,
        bookingId: params.bookingId,
      });

      await this.runDispatchWave(jobOffer.id, 1, params);

      return {
        success: true,
        jobOfferId: jobOffer.id,
        paymentIntentId: authResult.paymentIntentId,
      };
    } catch (error) {
      logger.error("[JobDispatch] Error creating job offer", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // ==================== CORE: BATCHED WAVE DISPATCH ====================

  static async runDispatchWave(
    jobOfferId: string,
    waveNumber: number,
    originalParams?: CreateJobOfferParams
  ): Promise<void> {
    const plan = WAVE_PLAN.find(w => w.wave === waveNumber);
    if (!plan) {
      logger.info("[JobDispatch] All waves exhausted", { jobOfferId });
      await db.update(jobOffers)
        .set({ status: "expired", expiredAt: new Date(), updatedAt: new Date() })
        .where(eq(jobOffers.id, jobOfferId));
      await this.writeAudit("JOB_EXPIRED", jobOfferId, undefined, { reason: "all_waves_exhausted" });
      return;
    }

    const [currentOffer] = await db.select().from(jobOffers).where(eq(jobOffers.id, jobOfferId)).limit(1);
    if (!currentOffer) return;

    if (["accepted", "cancelled", "completed", "expired"].includes(currentOffer.status)) {
      logger.info("[JobDispatch] Job already finalized, skipping wave", { jobOfferId, status: currentOffer.status });
      return;
    }

    const location = currentOffer.location as { latitude: number; longitude: number; address: string };
    if (!location?.latitude || !location?.longitude) return;

    const alreadyOffered = (currentOffer.offeredOperatorIds as string[]) || [];

    const expiresAt = new Date(Date.now() + plan.ttlSec * 1000);

    await db.update(jobOffers).set({
      status: "offered",
      dispatchWave: waveNumber,
      dispatchRadiusKm: plan.radiusKm,
      offerExpiresAt: expiresAt,
      offeredAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(jobOffers.id, jobOfferId));

    const rankedOperators = await this.findAndRankOperators({
      platform: currentOffer.platform as "sitter-suite" | "walk-my-pet" | "pettrek",
      location: { latitude: location.latitude, longitude: location.longitude },
      serviceType: currentOffer.serviceType,
      radiusKm: plan.radiusKm,
      maxOperators: plan.topN,
      excludeOperatorIds: alreadyOffered,
    });

    logger.info("[JobDispatch] Wave dispatched", {
      jobOfferId,
      wave: waveNumber,
      radiusKm: plan.radiusKm,
      candidatesFound: rankedOperators.length,
      topN: plan.topN,
    });

    if (rankedOperators.length === 0) {
      logger.warn("[JobDispatch] No candidates in wave, advancing after configured delay", { jobOfferId, wave: waveNumber, nextAfterSec: plan.nextAfterSec });
      await this.writeAudit("WAVE_EMPTY", jobOfferId, undefined, { wave: waveNumber, radiusKm: plan.radiusKm });
      setTimeout(() => this.runDispatchWave(jobOfferId, waveNumber + 1, originalParams), plan.nextAfterSec * 1000);
      return;
    }

    const newOfferedIds = [...alreadyOffered, ...rankedOperators.map(o => o.operatorId)];
    await db.update(jobOffers).set({
      offeredOperatorIds: newOfferedIds,
      offerHistory: sql`COALESCE(${jobOffers.offerHistory}, '[]'::jsonb) || ${JSON.stringify(
        rankedOperators.map(o => ({
          operatorId: o.operatorId,
          action: 'offered' as const,
          timestamp: new Date().toISOString(),
          wave: waveNumber,
          score: o.score,
          distanceKm: o.distanceKm,
        }))
      )}::jsonb`,
    }).where(eq(jobOffers.id, jobOfferId));

    await this.writeAudit("WAVE_SENT", jobOfferId, undefined, {
      wave: waveNumber,
      radiusKm: plan.radiusKm,
      operatorCount: rankedOperators.length,
      operators: rankedOperators.map(o => ({
        id: o.operatorId,
        score: o.score,
        distanceKm: o.distanceKm,
        rating: o.ratingAvg,
      })),
    });

    const serviceLabel = currentOffer.serviceType.replace(/_/g, ' ');
    const payoutStr = `₪${Number(currentOffer.operatorPayout).toFixed(0)}`;

    await Promise.allSettled(
      rankedOperators.map(async (operator) => {
        try {
          await FCMService.sendToUser({
            userId: operator.operatorId,
            title: `New ${serviceLabel} Job!`,
            body: `Earn ${payoutStr} - ${(operator.distanceKm).toFixed(1)}km away. Tap to accept (${plan.ttlSec}s)`,
            data: {
              type: "job_offer",
              jobOfferId,
              bookingId: currentOffer.bookingId,
              platform: currentOffer.platform,
              serviceType: currentOffer.serviceType,
              operatorPayout: String(currentOffer.operatorPayout),
              expiresAt: expiresAt.toISOString(),
              wave: String(waveNumber),
            },
          });
          logger.info("[JobDispatch] Offer sent", { operatorId: operator.operatorId, wave: waveNumber, score: operator.score });
        } catch (err) {
          logger.error("[JobDispatch] Failed to notify operator", err, { operatorId: operator.operatorId });
        }
      })
    );

    setTimeout(async () => {
      try {
        const [check] = await db.select().from(jobOffers).where(eq(jobOffers.id, jobOfferId)).limit(1);
        if (check && check.status === "offered" && check.dispatchWave === waveNumber) {
          logger.info("[JobDispatch] Wave expired, advancing", { jobOfferId, wave: waveNumber });
          await this.writeAudit("WAVE_EXPIRED", jobOfferId, undefined, { wave: waveNumber });
          await this.runDispatchWave(jobOfferId, waveNumber + 1, originalParams);
        }
      } catch (err) {
        logger.error("[JobDispatch] Wave timeout check failed", err, { jobOfferId });
      }
    }, plan.nextAfterSec * 1000);
  }

  // ==================== CORE: SMART RANKING ====================

  static async findAndRankOperators(params: FindOperatorsParams): Promise<RankedOperator[]> {
    try {
      const operators = await db.select()
        .from(operatorPresence)
        .where(
          and(
            eq(operatorPresence.platform, params.platform),
            eq(operatorPresence.status, "online"),
            or(
              isNull(operatorPresence.cooldownUntil),
              gt(sql`NOW()`, operatorPresence.cooldownUntil)
            )
          )
        )
        .limit(300);

      const now = Date.now();
      const candidates: RankedOperator[] = [];

      for (const op of operators) {
        if (!op.currentLocation) continue;

        if (params.excludeOperatorIds?.includes(op.operatorId)) continue;

        if (op.lastActiveAt) {
          const lastSeenMs = new Date(op.lastActiveAt).getTime();
          if (now - lastSeenMs > COOLDOWN_SETTINGS.stalePresenceMs) continue;
        }

        const serviceTypes = (op.serviceTypes as string[]) || [];
        if (serviceTypes.length > 0 && !serviceTypes.includes(params.serviceType)) continue;

        const loc = op.currentLocation as { latitude: number; longitude: number };
        const distanceKm = this.calculateDistance(
          params.location.latitude,
          params.location.longitude,
          loc.latitude,
          loc.longitude
        );

        if (distanceKm > params.radiusKm) continue;

        const ratingAvg = Number(op.ratingAvg) || 5.0;
        const acceptanceRate = Number(op.acceptanceRate) || 100.0;
        const completedJobs30d = op.completedJobs30d || 0;
        const premium = !!(op.premiumBadge && op.subscriptionActive);

        const score = this.computeSmartScore({
          distanceKm,
          ratingAvg,
          acceptanceRate: acceptanceRate / 100,
          completedJobs30d,
          premium,
          recentRejects: op.recentRejects || 0,
          recentIgnores: op.recentIgnores || 0,
        });

        candidates.push({
          operatorId: op.operatorId,
          operatorName: op.operatorName,
          distanceKm,
          score,
          ratingAvg,
          acceptanceRate,
          completedJobs30d,
          premiumBadge: premium,
        });
      }

      candidates.sort((a, b) => b.score - a.score);
      return candidates.slice(0, params.maxOperators);
    } catch (error) {
      logger.error("[JobDispatch] Error finding operators", error);
      return [];
    }
  }

  static computeSmartScore(params: {
    distanceKm: number;
    ratingAvg: number;
    acceptanceRate: number;
    completedJobs30d: number;
    premium: boolean;
    recentRejects: number;
    recentIgnores: number;
  }): number {
    const distanceScore = 1 - this.clamp(params.distanceKm / 10, 0, 1);
    const ratingScore = this.clamp(params.ratingAvg / 5, 0, 1);
    const acceptanceScore = this.clamp(params.acceptanceRate, 0, 1);
    const activityScore = this.clamp(params.completedJobs30d / 30, 0, 1);

    let s =
      distanceScore * SCORE_WEIGHTS.distance +
      ratingScore * SCORE_WEIGHTS.rating +
      acceptanceScore * SCORE_WEIGHTS.acceptance +
      activityScore * SCORE_WEIGHTS.activity;

    if (params.premium) {
      s = s * (1 + SCORE_WEIGHTS.premiumBoost);
    }

    if (params.recentIgnores >= COOLDOWN_SETTINGS.ignoresBeforePriorityDrop) {
      s = s * 0.7;
    }

    return Number(s.toFixed(6));
  }

  // ==================== CORE: ACCEPT (FIRST WINS) ====================

  static async acceptJobOffer(
    jobOfferId: string,
    operatorId: string
  ): Promise<AcceptJobOfferResult> {
    try {
      logger.info("[JobDispatch] Operator accepting job", { jobOfferId, operatorId });

      const [currentOffer] = await db.select().from(jobOffers).where(eq(jobOffers.id, jobOfferId)).limit(1);
      if (!currentOffer) {
        return { success: false, error: "Job offer not found" };
      }

      const offeredIds = (currentOffer.offeredOperatorIds as string[]) || [];
      if (!offeredIds.includes(operatorId)) {
        logger.warn("[JobDispatch] Operator not in offered list", { jobOfferId, operatorId });
        return { success: false, error: "You were not offered this job" };
      }

      if (currentOffer.offerExpiresAt && new Date(currentOffer.offerExpiresAt) < new Date()) {
        logger.warn("[JobDispatch] Offer expired", { jobOfferId, operatorId, expiresAt: currentOffer.offerExpiresAt });
        return { success: false, error: "This offer has expired" };
      }

      const [updatedOffer] = await db.update(jobOffers)
        .set({
          status: "accepted",
          operatorId,
          acceptedAt: new Date(),
          updatedAt: new Date(),
          offerHistory: sql`COALESCE(${jobOffers.offerHistory}, '[]'::jsonb) || ${JSON.stringify([{
            operatorId,
            action: "accepted",
            timestamp: new Date().toISOString(),
          }])}::jsonb`,
        })
        .where(
          and(
            eq(jobOffers.id, jobOfferId),
            sql`${jobOffers.status} IN ('pending', 'offered')`
          )
        )
        .returning();

      if (!updatedOffer) {
        logger.warn("[JobDispatch] Job already accepted by another operator", { jobOfferId, operatorId });
        return { success: false, error: "Job offer has already been accepted by another operator" };
      }

      await db.update(operatorPresence)
        .set({ status: "on_job", updatedAt: new Date() })
        .where(eq(operatorPresence.operatorId, operatorId));

      await this.updateOperatorStats(operatorId, "accept");

      await this.writeAudit("OFFER_ACCEPT", jobOfferId, operatorId, {
        bookingId: updatedOffer.bookingId,
        platform: updatedOffer.platform,
      });

      logger.info("[JobDispatch] Job accepted - first wins", { jobOfferId, operatorId });

      try {
        await FCMService.sendToUser({
          userId: updatedOffer.customerId,
          title: "Provider Assigned!",
          body: `Your ${updatedOffer.serviceType.replace(/_/g, ' ')} request has been accepted.`,
          data: {
            type: "booking_accepted",
            jobOfferId,
            bookingId: updatedOffer.bookingId,
            operatorId,
          },
        });
      } catch (notifErr) {
        logger.error("[JobDispatch] Failed to notify customer", notifErr);
      }

      return { success: true, jobOffer: updatedOffer };
    } catch (error) {
      logger.error("[JobDispatch] Error accepting job offer", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // ==================== CORE: REJECT WITH COOLDOWN ====================

  static async rejectJobOffer(
    jobOfferId: string,
    operatorId: string,
    reason?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      logger.info("[JobDispatch] Operator rejecting job", { jobOfferId, operatorId, reason });

      const [updatedOffer] = await db.update(jobOffers)
        .set({
          rejectedAt: new Date(),
          updatedAt: new Date(),
          offerHistory: sql`COALESCE(${jobOffers.offerHistory}, '[]'::jsonb) || ${JSON.stringify([{
            operatorId,
            action: "rejected",
            timestamp: new Date().toISOString(),
            reason,
          }])}::jsonb`,
        })
        .where(
          and(
            eq(jobOffers.id, jobOfferId),
            sql`${jobOffers.status} IN ('pending', 'offered')`
          )
        )
        .returning();

      if (!updatedOffer) {
        return { success: false, error: "Job offer has already been processed" };
      }

      await this.updateOperatorStats(operatorId, "reject");

      await this.writeAudit("OFFER_REJECT", jobOfferId, operatorId, { reason });

      return { success: true };
    } catch (error) {
      logger.error("[JobDispatch] Error rejecting job offer", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // ==================== COOLDOWN: UPDATE OPERATOR STATS ====================

  private static async updateOperatorStats(operatorId: string, action: "accept" | "reject" | "ignore"): Promise<void> {
    try {
      if (action === "accept") {
        await db.update(operatorPresence)
          .set({
            recentRejects: 0,
            recentIgnores: 0,
            cooldownUntil: null,
            completedJobs30d: sql`COALESCE(${operatorPresence.completedJobs30d}, 0) + 1`,
            updatedAt: new Date(),
          })
          .where(eq(operatorPresence.operatorId, operatorId));
      } else if (action === "reject") {
        const [op] = await db.select().from(operatorPresence).where(eq(operatorPresence.operatorId, operatorId)).limit(1);
        const newRejects = (op?.recentRejects || 0) + 1;

        const updates: any = {
          recentRejects: newRejects,
          updatedAt: new Date(),
        };

        if (newRejects >= COOLDOWN_SETTINGS.rejectsBeforeCooldown) {
          updates.cooldownUntil = new Date(Date.now() + COOLDOWN_SETTINGS.cooldownDurationMs);
          updates.recentRejects = 0;
          logger.info("[JobDispatch] Operator cooldown activated", { operatorId, cooldownMs: COOLDOWN_SETTINGS.cooldownDurationMs });
        }

        const currentRate = Number(op?.acceptanceRate) || 100;
        updates.acceptanceRate = Math.max(0, currentRate - 2).toFixed(2);

        await db.update(operatorPresence).set(updates).where(eq(operatorPresence.operatorId, operatorId));
      } else if (action === "ignore") {
        await db.update(operatorPresence)
          .set({
            recentIgnores: sql`COALESCE(${operatorPresence.recentIgnores}, 0) + 1`,
            updatedAt: new Date(),
          })
          .where(eq(operatorPresence.operatorId, operatorId));
      }
    } catch (error) {
      logger.error("[JobDispatch] Error updating operator stats", error, { operatorId, action });
    }
  }

  // ==================== OPERATOR MANAGEMENT ====================

  static async getOperatorJobOffers(operatorId: string, platform: string): Promise<any[]> {
    try {
      const offers = await db.select()
        .from(jobOffers)
        .where(
          and(
            eq(jobOffers.platform, platform),
            eq(jobOffers.status, "offered")
          )
        )
        .orderBy(sql`${jobOffers.createdAt} DESC`)
        .limit(20);

      return offers;
    } catch (error) {
      logger.error("[JobDispatch] Error getting operator job offers", error);
      return [];
    }
  }

  static async updateOperatorPresence(
    operatorId: string,
    platform: string,
    status: "online" | "offline" | "busy" | "on_job",
    location?: { latitude: number; longitude: number; accuracy: number }
  ): Promise<void> {
    try {
      const geohash = location ? this.generateGeohash(location.latitude, location.longitude) : null;

      await db.insert(operatorPresence)
        .values({
          operatorId,
          platform,
          status,
          currentLocation: location,
          geohash,
          lastActiveAt: new Date(),
          lastLocationUpdateAt: location ? new Date() : undefined,
        })
        .onConflictDoUpdate({
          target: operatorPresence.operatorId,
          set: {
            status,
            currentLocation: location,
            geohash,
            lastActiveAt: new Date(),
            lastLocationUpdateAt: location ? new Date() : undefined,
            updatedAt: new Date(),
          },
        });

      logger.info("[JobDispatch] Operator presence updated", { operatorId, status, platform });
    } catch (error) {
      logger.error("[JobDispatch] Error updating operator presence", error);
    }
  }

  static async getDispatchStatus(jobOfferId: string): Promise<any> {
    try {
      const [offer] = await db.select().from(jobOffers).where(eq(jobOffers.id, jobOfferId)).limit(1);
      if (!offer) return null;

      return {
        jobOfferId: offer.id,
        status: offer.status,
        platform: offer.platform,
        serviceType: offer.serviceType,
        dispatchWave: offer.dispatchWave,
        dispatchRadiusKm: offer.dispatchRadiusKm,
        offerExpiresAt: offer.offerExpiresAt,
        operatorId: offer.operatorId,
        offeredOperatorCount: ((offer.offeredOperatorIds as string[]) || []).length,
        offerHistory: offer.offerHistory,
        createdAt: offer.createdAt,
        acceptedAt: offer.acceptedAt,
      };
    } catch (error) {
      logger.error("[JobDispatch] Error getting dispatch status", error);
      return null;
    }
  }

  // ==================== AUDIT TRAIL ====================

  private static async writeAudit(type: string, jobOfferId: string, operatorId?: string, meta?: any): Promise<void> {
    try {
      const firestore = admin.firestore();
      const id = `${type}_${jobOfferId}_${Date.now()}_${Math.floor(Math.random() * 9999)}`;
      await firestore.collection("dispatch_audit").doc(id).set({
        type,
        jobOfferId,
        operatorId: operatorId || null,
        meta: meta || {},
        at: admin.firestore.Timestamp.now(),
      });
    } catch (error) {
      logger.warn("[JobDispatch] Audit write failed (non-critical)", { type, jobOfferId, error });
    }
  }

  // ==================== UTILITY FUNCTIONS ====================

  private static clamp(n: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, n));
  }

  private static generateGeohash(lat: number, lng: number, precision: number = 6): string {
    const latHash = Math.floor((lat + 90) * 1000000).toString(36);
    const lngHash = Math.floor((lng + 180) * 1000000).toString(36);
    return `${latHash}${lngHash}`.substring(0, precision);
  }

  private static calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371;
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) *
        Math.cos(this.deg2rad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private static deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}
