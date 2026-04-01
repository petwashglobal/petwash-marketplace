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

import { db, pool } from "../db";
import { eq, and, sql } from "drizzle-orm";
import {
  bookingPolicies,
  disputeResolutions,
  type BookingPolicy,
  type InsertDisputeResolution,
} from "@shared/schema-compliance";
import { nanoid } from "nanoid";
import { logger } from "../lib/logger";

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
    const transactionId = `REFUND-${new Date().getFullYear()}-${nanoid(12)}`;
    const refundCents = Math.round(refundAmount * 100);

    logger.info('[BookingPolicyEngine] processAutoRefund', { bookingId, refundAmount, refundMethod, transactionId });

    try {
      // Find the owner of this booking across service tables
      const ownerResult = await pool.query(`
        SELECT owner_id AS user_id FROM sitter_bookings WHERE id = $1
        UNION ALL
        SELECT owner_id AS user_id FROM walk_bookings    WHERE id = $1
        LIMIT 1
      `, [bookingId]);

      const ownerId: string | null = ownerResult.rows[0]?.user_id ?? null;

      if (ownerId && refundCents > 0) {
        // Credit the user's cash wallet (atomic upsert)
        await pool.query(`
          INSERT INTO wallet_accounts (wallet_id, user_id, cash_wallet_balance_cents)
          VALUES ($1, $2, $3)
          ON CONFLICT (wallet_id) DO NOTHING
        `, [`WALLET-${ownerId.slice(0, 20)}`, ownerId, 0]);

        await pool.query(`
          UPDATE wallet_accounts
          SET cash_wallet_balance_cents = cash_wallet_balance_cents + $1,
              updated_at = NOW()
          WHERE user_id = $2
        `, [refundCents, ownerId]);

        logger.info('[BookingPolicyEngine] Wallet credited', { ownerId, refundCents, transactionId });
      } else if (!ownerId) {
        logger.warn('[BookingPolicyEngine] Booking owner not found — refund logged only', { bookingId });
      }

      return { success: true, transactionId };
    } catch (err: any) {
      logger.error('[BookingPolicyEngine] Refund error', { bookingId, error: err.message });
      return { success: false, transactionId, error: err.message };
    }
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

    // Persist a governance alert so the legal team sees the escalation in the admin dashboard
    await pool.query(`
      INSERT INTO governance_alerts (type, severity, message, triggered_by)
      VALUES (
        'dispute_escalated',
        'high',
        $1,
        $2::jsonb
      )
    `, [
      `Dispute #${disputeId} escalated for legal review: ${escalationReason}`,
      JSON.stringify({ source: 'BookingPolicyEngine', disputeId, escalationReason }),
    ]).catch((err: any) => {
      logger.warn('[BookingPolicyEngine] Could not write governance alert for escalation', { error: err.message });
    });

    logger.warn('[BookingPolicyEngine] Dispute escalated to legal review', {
      disputeId,
      escalationReason,
    });

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
    bookingId: number | string,
    userId: number | string
  ): Promise<{ valid: boolean; reason?: string }> {
    const result = await pool.query(
      `SELECT id, user_id, status FROM bookings WHERE id = $1::text LIMIT 1`,
      [String(bookingId)]
    );

    if (result.rows.length === 0) {
      return { valid: false, reason: 'Booking not found' };
    }

    const booking = result.rows[0];

    if (booking.user_id !== String(userId)) {
      return { valid: false, reason: 'Booking does not belong to this user' };
    }

    if (booking.status === 'cancelled') {
      return { valid: false, reason: 'Booking is already cancelled' };
    }

    if (booking.status === 'completed') {
      return { valid: false, reason: 'Cannot cancel a completed booking' };
    }

    return { valid: true };
  }
}

// Export singleton instance
export const bookingPolicyEngine = new BookingPolicyEngineService();
