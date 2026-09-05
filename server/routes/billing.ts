/**
 * PetWash™ Billing API Routes
 *
 * Exposes the BillingEngine over HTTP.
 * All routes require admin role (payment events are system-internal).
 *
 * POST /api/billing/payment-captured   — payment captured by processor
 * POST /api/billing/service-completed  — service delivered, release escrow
 * POST /api/billing/refund             — issue full or partial refund
 * POST /api/billing/dispute            — mark as disputed
 * GET  /api/billing/booking/:id        — all billing records for a booking
 * GET  /api/billing/record/:id         — single billing record
 * GET  /api/billing/record/:id/audit   — full audit trail for a record
 */

import { Router } from "express";
import { z } from "zod";
import { BillingEngine } from "../services/BillingEngine";
import {
  getBillingRecord,
  getBillingRecordsByBooking,
  getAuditTrail,
} from "../services/BillingLedger";
import { logger } from "../lib/logger";
import { strictIdempotencyWithDerivedKey } from "../middleware/derivedIdempotencyKey";
import { EscrowConcurrentTransitionError } from "../services/EscrowStateMachine";

const router = Router();

// ── Zod schemas ───────────────────────────────────────────────────────────────

const PaymentCapturedSchema = z.object({
  bookingId:        z.string().min(1),
  grossAgorot:      z.number().int().positive(),
  currency:         z.literal("ILS"),
  customerId:       z.string().min(1),
  providerId:       z.string().min(1),
  processor:        z.enum(["nayax", "manual"]),
  processorRef:     z.string().min(1),
  paymentMethod:    z.enum(["card", "bank_transfer", "cash", "wallet"]),
  customerTaxId:    z.string().optional(),
  commercialModel:  z.enum(["MARKETPLACE_COMMISSION", "PRINCIPAL"]).optional(),
  platformFeeRate:  z.number().min(0).max(1).optional(),
  idempotencyKey:   z.string().optional(),
  machineId:        z.string().optional(),
});

const ServiceCompletedSchema = z.object({
  recordId:             z.string().min(1),
  bookingId:            z.string().min(1),
  customerId:           z.string().optional(),
  providerId:           z.string().optional(),
  isB2B:                z.boolean().optional(),
  customerTaxId:        z.string().optional(),
  subtotalAgorot:       z.number().int().positive(),
  totalAgorot:          z.number().int().positive(),
  platformFeeAgorot:    z.number().int().optional(),
  providerPayoutAgorot: z.number().int().optional(),
  commercialModel:      z.enum(["MARKETPLACE_COMMISSION", "PRINCIPAL"]).optional(),
  releasedByAdminId:    z.string().optional(),
});

const RefundSchema = z.object({
  recordId:     z.string().min(1),
  bookingId:    z.string().min(1),
  refundAgorot: z.number().int().positive(),
  isPartial:    z.boolean(),
  adminId:      z.string().optional(),
});

const DisputeSchema = z.object({
  recordId: z.string().min(1),
  reason:   z.string().optional(),
});

// ── Routes ────────────────────────────────────────────────────────────────────

/**
 * POST /api/billing/payment-captured
 * Call when the payment processor confirms a charge was captured.
 * Creates the billing record, transitions to held_in_escrow, resolves documents.
 */
router.post("/payment-captured", async (req, res) => {
  try {
    const parsed = PaymentCapturedSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    }

    const result = await BillingEngine.handlePaymentCaptured(parsed.data);

    return res.status(201).json({
      recordId:                 result.billingRecord.recordId,
      paymentFlowStatus:        result.billingRecord.paymentFlowStatus,
      totalNIS:                 (result.billingRecord.totalAgorot / 100).toFixed(2),
      platformFeeNIS:           ((result.billingRecord.platformFeeAgorot ?? 0) / 100).toFixed(2),
      providerPayoutNIS:        ((result.billingRecord.providerPayoutAgorot ?? 0) / 100).toFixed(2),
      documents:                result.documents.map(d => ({
        purpose:                  d.purpose,
        system:                   d.system,
        requiresAllocationNumber: d.requiresAllocationNumber,
        notes:                    d.notes,
      })),
      documentSummary:          result.documentSummary,
      requiresAccountingAction: result.requiresAccountingAction,
      requiresITAAllocationNumber: result.requiresITAAllocationNumber,
    });
  } catch (err: any) {
    logger.error("[BillingRoutes] payment-captured error", { error: err.message });
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/billing/service-completed
 * Call when the pet care service has been confirmed delivered.
 * Releases escrow, optionally triggers tax invoice via accounting system.
 */
router.post("/service-completed", async (req, res) => {
  try {
    const parsed = ServiceCompletedSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    }

    const result = await BillingEngine.handleServiceCompleted(
      parsed.data.recordId,
      parsed.data
    );

    return res.json({
      status:                   result.status,
      bookingId:                result.bookingId,
      recordId:                 result.recordId,
      documentSummary:          result.documentSummary,
      requiresAccountingAction: result.requiresAccountingAction,
      requiresITAAllocationNumber: result.requiresITAAllocationNumber,
    });
  } catch (err: any) {
    logger.error("[BillingRoutes] service-completed error", { error: err.message });
    return res.status(500).json({ error: err.message });
  }
});

/**
 * Idempotency identity for a refund.
 *
 * A "logical refund" is uniquely identified by the billing record it reverses,
 * the amount, and whether it is partial. Two submits of that same triple are
 * the SAME refund — a double-click, a second tab, an admin replay, a client
 * retry after a dropped response, or a webhook redelivery.
 *
 * This is not a new rule: the escrow state machine already collapses a repeat
 * of the same transition to a no-op (`fromStatus === toStatus` → return). The
 * derived key just makes that collapse explicit, race-proof and observable
 * instead of relying on a read that two workers can win simultaneously.
 */
const refundIdentity = (req: any): string | null => {
  const b = req.body ?? {};
  if (!b.recordId || typeof b.refundAgorot !== "number") return null;
  return [
    "billing-refund",
    String(b.recordId),
    String(b.bookingId ?? ""),
    String(b.refundAgorot),
    b.isPartial ? "partial" : "full",
  ].join("|");
};

/**
 * POST /api/billing/refund
 * Issue a full or partial refund.
 *
 * CONCURRENCY (2026-08-17, M1) — no financial rule changed.
 * Two protections, both idempotency-only:
 *   1. `strictIdempotencyWithDerivedKey` claims the logical refund BEFORE the
 *      handler runs (fail-closed: a DB outage answers 503, never a duplicate).
 *   2. `transitionEscrowState` now compare-and-sets the record status under a
 *      row lock, so even a claim that slipped through cannot append a second
 *      refund delta or fork the audit hash chain.
 */
router.post("/refund", strictIdempotencyWithDerivedKey("billing-refund", refundIdentity), async (req, res) => {
  try {
    const parsed = RefundSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    }

    const { recordId, bookingId, refundAgorot, isPartial, adminId } = parsed.data;
    const result = await BillingEngine.handleRefund(
      recordId, bookingId, refundAgorot, isPartial, adminId
    );

    return res.json({
      status:          result.status,
      bookingId:       result.bookingId,
      recordId:        result.recordId,
      refundNIS:       (result.refundAgorot / 100).toFixed(2),
      documentSummary: result.documentSummary,
    });
  } catch (err: any) {
    // A concurrent worker already moved this record. Never a 500, never a
    // silent success — 409 tells the caller the refund was NOT applied twice.
    if (err instanceof EscrowConcurrentTransitionError || err?.code === "ESCROW_CONCURRENT_TRANSITION") {
      logger.warn("[BillingRoutes] refund lost concurrent claim — no duplicate applied", {
        recordId: err.recordId, expectedFrom: err.expectedFrom, toStatus: err.toStatus,
      });
      return res.status(409).json({
        error: "ESCROW_CONCURRENT_TRANSITION",
        message: "This refund is already being processed by another request. No duplicate refund was applied.",
      });
    }
    logger.error("[BillingRoutes] refund error", { error: err.message });
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/billing/dispute
 * Mark a billing record as disputed.
 */
router.post("/dispute", async (req, res) => {
  try {
    const parsed = DisputeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    }

    const result = await BillingEngine.handleDispute(parsed.data.recordId, parsed.data.reason);
    return res.json(result);
  } catch (err: any) {
    logger.error("[BillingRoutes] dispute error", { error: err.message });
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/billing/booking/:bookingId
 * Returns all billing records for a booking (most recent first).
 */
router.get("/booking/:bookingId", async (req, res) => {
  try {
    const records = await getBillingRecordsByBooking(req.params.bookingId);
    return res.json({
      bookingId: req.params.bookingId,
      count:     records.length,
      records:   records.map(r => ({
        recordId:          r.recordId,
        paymentFlowStatus: r.paymentFlowStatus,
        documentPurpose:   r.documentPurpose,
        totalNIS:          (r.totalAgorot / 100).toFixed(2),
        vatNIS:            (r.vatAgorot / 100).toFixed(2),
        providerPayoutNIS: ((r.providerPayoutAgorot ?? 0) / 100).toFixed(2),
        platformFeeNIS:    ((r.platformFeeAgorot ?? 0) / 100).toFixed(2),
        requiresAllocation: r.requiresAllocation,
        receiptNumber:     r.receiptNumber,
        invoiceNumber:     r.invoiceNumber,
        allocationNumber:  r.allocationNumber,
        archiveStatus:     r.archiveStatus,
        capturedAt:        r.capturedAt,
        releasedAt:        r.releasedAt,
        createdAt:         r.createdAt,
      })),
    });
  } catch (err: any) {
    logger.error("[BillingRoutes] get-booking error", { error: err.message });
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/billing/record/:recordId
 * Returns a single billing record by its recordId.
 */
router.get("/record/:recordId", async (req, res) => {
  try {
    const record = await getBillingRecord(req.params.recordId);
    if (!record) return res.status(404).json({ error: "Record not found" });
    return res.json(record);
  } catch (err: any) {
    logger.error("[BillingRoutes] get-record error", { error: err.message });
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/billing/record/:recordId/audit
 * Returns the full immutable audit trail for a billing record.
 */
router.get("/record/:recordId/audit", async (req, res) => {
  try {
    const trail = await getAuditTrail(req.params.recordId);
    return res.json({
      recordId: req.params.recordId,
      count:    trail.length,
      entries:  trail,
    });
  } catch (err: any) {
    logger.error("[BillingRoutes] get-audit error", { error: err.message });
    return res.status(500).json({ error: err.message });
  }
});

export default router;
