/**
 * BOOKING POLICY ENGINE
 * ====================
 * Automated cancellation and refund processing (like Airbnb/Booking.com)
 * 
 * Features:
 * - Multi-tier cancellation policies (flexible, moderate, strict)
 * - Automated refund calculations
 * - Dispute escalation workflows
 * - SLA tracking
 * - Multi-country compliance
 * 
 * Created: November 10, 2025
 */

import { db } from "../db";
import { eq, and } from "drizzle-orm";
import {
  bookingPolicies,
  disputeResolutions,
  type BookingPolicy,
  type InsertDisputeResolution,
} from "@shared/schema-compliance";
import { nanoid } from "nanoid";

/**
 * Cancellation result
 */
export interface CancellationResult {
  canCancel: boolean;
  refundPercent: number;
  refundAmount: number;
  cancellationFee: number;
  refundMethod: string;
  processingDays: number;
  policyTier: string;
  reason?: string;
}

/**
 * Refund calculation
 */
export interface RefundCalculation {
  originalAmount: number;
  refundPercent: number;
  refundAmount: number;
  cancellationFee: number;
  netRefund: number;
  currency: string;
}

/**
 * Dispute creation params
 */
export interface CreateDisputeParams {
  bookingId: number;
  customerId: number;
  providerId: number;
  providerType: string;
  serviceType: string;
  disputeType: string;
  disputeReason: string;
  disputeReasonHe?: string;
  originalAmount: number;
  disputedAmount: number;
  customerEvidence?: any;
}

/**
 * Booking Policy Engine Service
 */
export class BookingPolicyEngineService {
  /**
   * Get applicable policy for service type
   */
  async getApplicablePolicy(serviceType: string, country: string = "IL"): Promise<BookingPolicy | null> {
    const policies = await db
      .select()
      .from(bookingPolicies)
      .where(
        and(
          eq(bookingPolicies.serviceType, serviceType),
          eq(bookingPolicies.isActive, true)
        )
      )
      .limit(1);

    if (policies.length === 0) {
      // Try "all" service type
      const fallback = await db
        .select()
        .from(bookingPolicies)
        .where(
          and(
            eq(bookingPolicies.serviceType, "all"),
            eq(bookingPolicies.isActive, true)
          )
        )
        .limit(1);

      return fallback[0] || null;
    }

    return policies[0];
  }

  /**
   * Calculate cancellation refund
   */
  async calculateCancellation(
    serviceType: string,
    bookingAmount: number,
    bookingDate: Date,
    cancellationDate: Date = new Date(),
    country: string = "IL"
  ): Promise<CancellationResult> {
    // Get policy
    const policy = await this.getApplicablePolicy(serviceType, country);

    if (!policy) {
      return {
        canCancel: false,
        refundPercent: 0,
        refundAmount: 0,
        cancellationFee: 0,
        refundMethod: "original_payment",
        processingDays: 5,
        policyTier: "unknown",
        reason: "No cancellation policy found",
      };
    }

    // Calculate hours until booking
    const hoursUntilBooking = (bookingDate.getTime() - cancellationDate.getTime()) / (1000 * 60 * 60);

    // Parse cancellation rules
    const rules = policy.cancellationRules as any;

    let refundPercent = 0;
    let cancellationFee = 0;

    // Apply rules based on time until booking
    if (hoursUntilBooking >= 24 && rules["24_hours_before"]) {
      refundPercent = rules["24_hours_before"].refund_percent || 100;
      cancellationFee = rules["24_hours_before"].fee || 0;
    } else if (hoursUntilBooking >= 12 && rules["12_hours_before"]) {
      refundPercent = rules["12_hours_before"].refund_percent || 50;
      cancellationFee = rules["12_hours_before"].fee || 10;
    } else if (rules["less_than_12"]) {
      refundPercent = rules["less_than_12"].refund_percent || 0;
      cancellationFee = rules["less_than_12"].fee || 20;
    }

    const refundAmount = (bookingAmount * refundPercent) / 100;
    const netRefund = refundAmount - cancellationFee;

    return {
      canCancel: true,
      refundPercent,
      refundAmount: Math.max(0, netRefund),
      cancellationFee,
      refundMethod: policy.refundMethod || "original_payment",
      processingDays: policy.refundProcessingDays || 5,
      policyTier: policy.policyTier,
    };
  }

  /**
   * Process automatic refund
   */
  async processAutoRefund(
    bookingId: number,
    refundAmount: number,
    refundMethod: string = "original_payment"
  ): Promise<{ success: boolean; transactionId?: string; error?: string }> {
    // TODO: Integrate with Nayax payment gateway for actual refunds
    // For now, simulate successful refund
    
    const transactionId = `REFUND-${new Date().getFullYear()}-${nanoid(12)}`;

    console.log(`Auto-refund processed: Booking ${bookingId}, Amount ${refundAmount}, Method ${refundMethod}, Transaction ${transactionId}`);

    return {
      success: true,
      transactionId,
    };
  }

  /**
   * Create dispute
   */
  async createDispute(params: CreateDisputeParams): Promise<any> {
    // Calculate target resolution date (48 hours)
    const targetResolutionDate = new Date();
    targetResolutionDate.setHours(targetResolutionDate.getHours() + 48);

    const disputeId = `DISP-${new Date().getFullYear()}-${nanoid(8)}`;

    const [dispute] = await db
      .insert(disputeResolutions)
      .values({
        disputeId,
        bookingId: params.bookingId,
        serviceType: params.serviceType,
        customerId: params.customerId,
        providerId: params.providerId,
        providerType: params.providerType,
        disputeType: params.disputeType,
        disputeReason: params.disputeReason,
        disputeReasonHe: params.disputeReasonHe,
        originalAmount: params.originalAmount.toString(),
        disputedAmount: params.disputedAmount.toString(),
        customerEvidence: params.customerEvidence,
        status: "open",
        targetResolutionDate,
      } as InsertDisputeResolution)
      .returning();

    return dispute;
  }

  /**
   * Resolve dispute
   */
  async resolveDispute(
    disputeId: number,
    resolution: string,
    resolutionHe: string,
    refundAmount: number,
    status: string,
    resolvedBy: number
  ): Promise<any> {
    const [updated] = await db
      .update(disputeResolutions)
      .set({
        resolution,
        resolutionHe,
        refundAmount: refundAmount.toString(),
        status,
        resolvedBy,
        resolvedAt: new Date(),
        actualResolutionDate: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(disputeResolutions.id, disputeId))
      .returning();

    // If refund approved, process it
    if (refundAmount > 0 && updated) {
      await this.processAutoRefund(updated.bookingId, refundAmount);
    }

    return updated;
  }

  /**
   * Check if dispute SLA is breached
   */
  async checkDisputeSLA(disputeId: number): Promise<boolean> {
    const [dispute] = await db
      .select()
      .from(disputeResolutions)
      .where(eq(disputeResolutions.id, disputeId))
      .limit(1);

    if (!dispute) {
      return false;
    }

    const now = new Date();
    const target = new Date(dispute.targetResolutionDate);

    if (now > target && dispute.status !== "resolved_customer" && dispute.status !== "resolved_provider" && dispute.status !== "closed") {
      // Mark as SLA breached
      await db
        .update(disputeResolutions)
        .set({ slaBreached: true, updatedAt: new Date() })
        .where(eq(disputeResolutions.id, disputeId));

      return true;
    }

    return false;
  }

  /**
   * Escalate dispute to legal team
   */
  async escalateDispute(
    disputeId: number,
    escalationReason: string
  ): Promise<any> {
    const [updated] = await db
      .update(disputeResolutions)
      .set({
        isEscalated: true,
        escalatedAt: new Date(),
        escalationReason,
        legalReviewRequired: true,
        status: "escalated",
        updatedAt: new Date(),
      })
      .where(eq(disputeResolutions.id, disputeId))
      .returning();

    // TODO: Send notification to legal team

    return updated;
  }

  /**
   * Get refund calculation details
   */
  getRefundCalculation(
    originalAmount: number,
    refundPercent: number,
    cancellationFee: number,
    currency: string = "ILS"
  ): RefundCalculation {
    const refundAmount = (originalAmount * refundPercent) / 100;
    const netRefund = Math.max(0, refundAmount - cancellationFee);

    return {
      originalAmount,
      refundPercent,
      refundAmount,
      cancellationFee,
      netRefund,
      currency,
    };
  }

  /**
   * Validate cancellation eligibility
   */
  async validateCancellation(
    bookingId: number,
    userId: number
  ): Promise<{ valid: boolean; reason?: string }> {
    // TODO: Check if booking exists and belongs to user
    // TODO: Check if booking is not already cancelled
    // TODO: Check if service is not already completed

    return { valid: true };
  }
}

// Export singleton instance
export const bookingPolicyEngine = new BookingPolicyEngineService();
