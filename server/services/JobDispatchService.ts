/**
 * JOB DISPATCH SERVICE - Uber/Airbnb-Style Job Marketplace
 * 
 * Handles job offers for The Sitter Suite™, Walk My Pet™, and PetTrek™
 * 
 * Flow:
 * 1. Customer creates booking → JobOffer created with "pending" status
 * 2. System finds nearby operators using geohash proximity
 * 3. Push notifications sent to eligible operators
 * 4. Operator accepts → Payment captured, job starts
 * 5. Operator rejects → Offer sent to next operator
 * 6. Timeout → Offer expires, refund customer
 * 
 * Real-time updates via Firestore listeners for instant UX
 */

import admin from "firebase-admin";
import { db } from "../db";
import { jobOffers, operatorPresence, paymentIntents } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import NotificationService from "./NotificationService";
import NayaxJobDispatchPaymentService from "./NayaxJobDispatchPaymentService";
import { logger } from "../lib/logger";
import { nanoid } from "nanoid";
import { toMinorUnit } from "../utils/currency";

// ==================== TYPE DEFINITIONS ====================

export interface CreateJobOfferParams {
  bookingId: string;
  platform: "sitter-suite" | "walk-my-pet" | "pettrek";
  customerId: string;
  customerName: string;
  customerPaymentToken: string; // Nayax payment token for authorization
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
  maxDistance?: number; // km
  maxOperators?: number;
}

export interface AcceptJobOfferResult {
  success: boolean;
  jobOffer?: any;
  paymentIntent?: any;
  error?: string;
}

// ==================== JOB DISPATCH SERVICE ====================

export class JobDispatchService {
  private static firestore = admin.firestore();
  private static notificationService = NotificationService;

  /**
   * Create a new job offer and notify nearby operators
   */
  static async createJobOffer(params: CreateJobOfferParams): Promise<{
    success: boolean;
    jobOfferId?: string;
    paymentIntentId?: string;
    error?: string;
  }> {
    try {
      logger.info("[JobDispatch] Creating job offer", {
        bookingId: params.bookingId,
        platform: params.platform,
        serviceType: params.serviceType,
      });

      // STEP 1: AUTHORIZE PAYMENT (Hold customer's card)
      // If this fails, we don't create the job offer
      // Convert decimal amount to minor currency units (cents/agora/etc)
      const currency = params.currency || "ILS";
      const amountCents = toMinorUnit(params.totalCharge, currency);
      
      const authResult = await NayaxJobDispatchPaymentService.authorizePayment({
        bookingId: params.bookingId,
        platform: params.platform as 'sitter_suite' | 'walk_my_pet' | 'pet_trek',
        amountCents, // Minor units (e.g., agora for ILS)
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

      logger.info("[JobDispatch] Payment authorized successfully", {
        paymentIntentId: authResult.paymentIntentId,
        bookingId: params.bookingId,
      });

      // STEP 2: Create job offer in PostgreSQL (now that payment is authorized)
      const geohash = this.generateGeohash(params.location.latitude, params.location.longitude);

      const [jobOffer] = await db.insert(jobOffers).values({
        bookingId: params.bookingId,
        platform: params.platform,
        customerId: params.customerId,
        customerName: params.customerName,
        paymentIntentId: authResult.paymentIntentId, // Link to payment
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
        currency: params.currency || "ILS",
        petIds: params.petIds,
        specialInstructions: params.specialInstructions,
        metadata: params.metadata,
        offerHistory: [],
      }).returning();

      logger.info("[JobDispatch] Job offer created", {
        jobOfferId: jobOffer.id,
        geohash,
      });

      // Find nearby operators
      const operators = await this.findNearbyOperators({
        platform: params.platform,
        location: params.location,
        serviceType: params.serviceType,
        maxDistance: 10, // 10km radius
        maxOperators: 5,
      });

      logger.info("[JobDispatch] Found nearby operators", {
        count: operators.length,
        operatorIds: operators.map(o => o.operatorId),
      });

      // Send notifications to operators
      if (operators.length > 0) {
        await this.notifyOperators(jobOffer.id, operators, params);
        
        // Update offer status to "offered"
        await db.update(jobOffers)
          .set({ 
            status: "offered",
            offeredAt: new Date(),
          })
          .where(eq(jobOffers.id, jobOffer.id));
      } else {
        logger.warn("[JobDispatch] No operators available", {
          jobOfferId: jobOffer.id,
          platform: params.platform,
        });
      }

      return {
        success: true,
        jobOfferId: jobOffer.id,
      };
    } catch (error) {
      logger.error("[JobDispatch] Error creating job offer", { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Find nearby online operators using geohash proximity
   */
  static async findNearbyOperators(params: FindOperatorsParams): Promise<any[]> {
    try {
      // Generate geohash for search location
      const searchGeohash = this.generateGeohash(params.location.latitude, params.location.longitude);
      
      // Query PostgreSQL for nearby operators
      // In production, use proper geohash proximity search with prefix matching
      const operators = await db.select()
        .from(operatorPresence)
        .where(
          and(
            eq(operatorPresence.platform, params.platform),
            eq(operatorPresence.status, "online")
          )
        )
        .limit(params.maxOperators || 10);

      // Filter by distance (simplified - in production use PostGIS)
      const nearbyOperators = operators.filter(op => {
        if (!op.currentLocation) return false;
        const distance = this.calculateDistance(
          params.location.latitude,
          params.location.longitude,
          op.currentLocation.latitude,
          op.currentLocation.longitude
        );
        return distance <= (params.maxDistance || 10);
      });

      return nearbyOperators;
    } catch (error) {
      logger.error("[JobDispatch] Error finding operators", { error });
      return [];
    }
  }

  /**
   * Send push notifications to operators about new job offer
   */
  private static async notifyOperators(
    jobOfferId: string,
    operators: any[],
    jobDetails: CreateJobOfferParams
  ): Promise<void> {
    const notifications = operators.map(async (operator) => {
      try {
        await this.notificationService.sendNotification({
          userId: operator.operatorId,
          type: "system",
          title: `New ${jobDetails.serviceType} Job Available!`,
          message: `${jobDetails.customerName} needs service on ${jobDetails.serviceDate.toLocaleDateString()}. Pay: ₪${jobDetails.operatorPayout}`,
          data: {
            jobOfferId,
            bookingId: jobDetails.bookingId,
            platform: jobDetails.platform,
            serviceType: jobDetails.serviceType,
            operatorPayout: jobDetails.operatorPayout,
            location: jobDetails.location,
          },
          priority: "high",
          channel: "push",
        });

        logger.info("[JobDispatch] Notification sent to operator", {
          operatorId: operator.operatorId,
          jobOfferId,
        });
      } catch (error) {
        logger.error("[JobDispatch] Error sending notification", {
          operatorId: operator.operatorId,
          error,
        });
      }
    });

    await Promise.allSettled(notifications);
  }

  /**
   * Operator accepts job offer
   * - Capture payment authorization
   * - Update job status to "accepted"
   * - Start job timer
   */
  static async acceptJobOffer(
    jobOfferId: string,
    operatorId: string
  ): Promise<AcceptJobOfferResult> {
    try {
      logger.info("[JobDispatch] Operator accepting job", {
        jobOfferId,
        operatorId,
      });

      // ATOMIC UPDATE: Only accept if status is pending or offered
      // This prevents race conditions where multiple operators try to accept simultaneously
      const [updatedOffer] = await db.update(jobOffers)
        .set({
          status: "accepted",
          operatorId,
          acceptedAt: new Date(),
          offerHistory: sql`${jobOffers.offerHistory} || ${JSON.stringify([{
            operatorId,
            action: "accepted",
            timestamp: new Date().toISOString(),
          }])}::jsonb`,
        })
        .where(
          and(
            eq(jobOffers.id, jobOfferId),
            sql`${jobOffers.status} IN ('pending', 'offered')` // CRITICAL: Only update if still available
          )
        )
        .returning();

      // If no rows were updated, job was already accepted by someone else
      if (!updatedOffer) {
        logger.warn("[JobDispatch] Job offer already accepted by another operator", {
          jobOfferId,
          attemptedBy: operatorId,
        });
        return { 
          success: false, 
          error: "Job offer has already been accepted by another operator" 
        };
      }

      logger.info("[JobDispatch] Job offer accepted", {
        jobOfferId,
        operatorId,
        bookingId: updatedOffer.bookingId,
      });

      // TODO: Capture Nayax payment authorization
      // This will be implemented when Nayax integration is ready

      // Notify customer that operator accepted
      await this.notificationService.sendNotification({
        userId: updatedOffer.customerId,
        type: "booking",
        title: "Operator Assigned!",
        message: `Your ${updatedOffer.serviceType} request has been accepted. The operator will arrive at the scheduled time.`,
        data: {
          jobOfferId,
          bookingId: updatedOffer.bookingId,
          operatorId,
        },
        priority: "high",
        channel: "push",
      });

      return {
        success: true,
        jobOffer: updatedOffer,
      };
    } catch (error) {
      logger.error("[JobDispatch] Error accepting job offer", { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Operator rejects job offer
   * - Update offer history
   * - Offer to next operator in queue
   */
  static async rejectJobOffer(
    jobOfferId: string,
    operatorId: string,
    reason?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      logger.info("[JobDispatch] Operator rejecting job", {
        jobOfferId,
        operatorId,
        reason,
      });

      // ATOMIC UPDATE: Only reject if status is pending or offered
      const [updatedOffer] = await db.update(jobOffers)
        .set({
          rejectedAt: new Date(),
          offerHistory: sql`${jobOffers.offerHistory} || ${JSON.stringify([{
            operatorId,
            action: "rejected",
            timestamp: new Date().toISOString(),
            reason,
          }])}::jsonb`,
        })
        .where(
          and(
            eq(jobOffers.id, jobOfferId),
            sql`${jobOffers.status} IN ('pending', 'offered')` // Only reject if still available
          )
        )
        .returning();

      if (!updatedOffer) {
        logger.warn("[JobDispatch] Job offer already processed", {
          jobOfferId,
          attemptedBy: operatorId,
        });
        return { 
          success: false, 
          error: "Job offer has already been processed" 
        };
      }

      logger.info("[JobDispatch] Job offer rejected", {
        jobOfferId,
        operatorId,
      });

      // TODO: Offer to next operator in queue
      // This will find the next available operator and send notification

      return { success: true };
    } catch (error) {
      logger.error("[JobDispatch] Error rejecting job offer", { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Get pending job offers for an operator
   */
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
      logger.error("[JobDispatch] Error getting operator job offers", { error });
      return [];
    }
  }

  /**
   * Update operator presence/availability
   */
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

      logger.info("[JobDispatch] Operator presence updated", {
        operatorId,
        status,
        platform,
      });
    } catch (error) {
      logger.error("[JobDispatch] Error updating operator presence", { error });
    }
  }

  // ==================== UTILITY FUNCTIONS ====================

  /**
   * Generate geohash from lat/lng (simplified version)
   * In production, use geohash library like "ngeohash"
   */
  private static generateGeohash(lat: number, lng: number, precision: number = 6): string {
    // Simplified geohash implementation
    // In production, use: import geohash from 'ngeohash'; return geohash.encode(lat, lng, precision);
    const latHash = Math.floor((lat + 90) * 1000000).toString(36);
    const lngHash = Math.floor((lng + 180) * 1000000).toString(36);
    return `${latHash}${lngHash}`.substring(0, precision);
  }

  /**
   * Calculate distance between two coordinates (Haversine formula)
   */
  private static calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371; // Earth radius in km
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) *
        Math.cos(this.deg2rad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    return distance;
  }

  private static deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}
