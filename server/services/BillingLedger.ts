/**
 * PetWash™ Billing Ledger
 *
 * Creates and manages BillingRecord rows. Every financial event must pass
 * through this service — never write to billing_records directly from routes.
 *
 * RULES:
 * - One record per financial event
 * - Records are immutable once created (use state machine for transitions)
 * - All amounts in AGOROT (ILS × 100, integer only)
 * - idempotencyKey prevents duplicate records on retry
 * - Retention timestamp is set to capturedAt + 7 years at creation
 */

import { nanoid } from "nanoid";
import { createHash } from "crypto";
import { db } from "../db";
import {
  billingRecords,
  billingAuditLog,
  insertBillingRecordSchema,
  type BillingRecord,
  type InsertBillingRecord,
  type DocumentPurpose,
  type PaymentFlowStatus,
  type IssuingEntity,
} from "@shared/schema-billing";
import { eq, and, desc } from "drizzle-orm";
import { logger } from "../lib/logger";
import {
  requiresAllocationNumberFromAgorot,
  calcVatFromGrossAgorot,
} from "./LegalThresholdConfig";

const SEVEN_YEARS_MS = 7 * 365.25 * 24 * 60 * 60 * 1000;

function genRecordId(): string {
  return `BLR-${new Date().getFullYear()}-${nanoid(8).toUpperCase()}`;
}

function genAuditId(): string {
  return `AUD-${nanoid(12).toUpperCase()}`;
}

function computeAuditHash(
  prevHash: string | null,
  auditId: string,
  recordId: string,
  eventType: string,
  toStatus: string,
  createdAt: string
): string {
  const canonical = [
    prevHash ?? "GENESIS",
    auditId,
    recordId,
    eventType,
    toStatus,
    createdAt,
  ].join("|");
  return createHash("sha256").update(canonical).digest("hex");
}

// ── Create ────────────────────────────────────────────────────────────────────

export interface CreateBillingRecordParams {
  idempotencyKey?: string;
  bookingId?: string;
  customerId?: string;
  providerId?: string;
  machineId?: string;

  documentPurpose: DocumentPurpose;
  issuingEntity: IssuingEntity;
  paymentFlowStatus: PaymentFlowStatus;

  currency?: "ILS";
  subtotalAgorot: number;
  vatAgorot: number;
  totalAgorot: number;
  discountAgorot?: number;
  platformFeeAgorot?: number;
  platformFeeVatAgorot?: number;
  providerPayoutAgorot?: number;

  paymentMethod?: string;
  processorName?: string;
  processorReference?: string;

  capturedAt?: Date;
  escrowHeldUntil?: Date;

  isB2B?: boolean;
  customerTaxId?: string;

  payload?: Record<string, unknown>;
  notes?: string;
}

export async function createBillingRecord(
  params: CreateBillingRecordParams
): Promise<BillingRecord> {
  // Idempotency check
  if (params.idempotencyKey) {
    const existing = await db
      .select()
      .from(billingRecords)
      .where(eq(billingRecords.idempotencyKey, params.idempotencyKey))
      .limit(1);

    if (existing.length > 0) {
      logger.info("[BillingLedger] Idempotent: returning existing record", {
        idempotencyKey: params.idempotencyKey,
        recordId: existing[0].recordId,
      });
      return existing[0];
    }
  }

  const recordId = genRecordId();
  const now = new Date();
  const retentionUntil = params.capturedAt
    ? new Date(params.capturedAt.getTime() + SEVEN_YEARS_MS)
    : new Date(now.getTime() + SEVEN_YEARS_MS);

  const isB2B = params.isB2B ?? false;
  const requiresAllocation = requiresAllocationNumberFromAgorot(
    params.subtotalAgorot,
    isB2B,
    params.capturedAt ?? now
  );

  const insertData: InsertBillingRecord = {
    recordId,
    idempotencyKey:     params.idempotencyKey ?? null,
    bookingId:          params.bookingId ?? null,
    customerId:         params.customerId ?? null,
    providerId:         params.providerId ?? null,
    machineId:          params.machineId ?? null,

    documentPurpose:    params.documentPurpose,
    issuingEntity:      params.issuingEntity,
    paymentFlowStatus:  params.paymentFlowStatus,

    currency:           params.currency ?? "ILS",
    subtotalAgorot:     params.subtotalAgorot,
    vatAgorot:          params.vatAgorot,
    totalAgorot:        params.totalAgorot,
    discountAgorot:     params.discountAgorot ?? 0,
    platformFeeAgorot:  params.platformFeeAgorot ?? null,
    platformFeeVatAgorot: params.platformFeeVatAgorot ?? null,
    providerPayoutAgorot: params.providerPayoutAgorot ?? null,

    paymentMethod:      params.paymentMethod ?? null,
    processorName:      params.processorName ?? null,
    processorReference: params.processorReference ?? null,

    capturedAt:         params.capturedAt ?? null,
    escrowHeldUntil:    params.escrowHeldUntil ?? null,
    releasedAt:         null,
    refundedAt:         null,

    receiptNumber:      null,
    invoiceNumber:      null,
    allocationNumber:   null,
    creditNoteNumber:   null,

    isB2B,
    customerTaxId:      params.customerTaxId ?? null,
    requiresAllocation,
    allocationRequested: false,
    allocationConfirmed: false,

    archiveStatus:      "PENDING",
    driveFileId:        null,
    pdfSha256:          null,
    archivedAt:         null,
    retentionUntil,

    payload:            params.payload ?? {},
    notes:              params.notes ?? null,
  };

  const [record] = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(billingRecords)
      .values(insertData)
      .returning();

    // Initial audit log entry
    const auditId = genAuditId();
    const createdAt = created.createdAt.toISOString();
    const entryHash = computeAuditHash(
      null,
      auditId,
      recordId,
      "record_created",
      params.paymentFlowStatus,
      createdAt
    );

    await tx.insert(billingAuditLog).values({
      auditId,
      recordId,
      eventType:   "record_created",
      fromStatus:  null,
      toStatus:    params.paymentFlowStatus,
      actorType:   "system",
      actorId:     null,
      deltaAgorot: params.totalAgorot,
      entryHash,
      prevHash:    null,
      payload:     { purpose: params.documentPurpose, requiresAllocation },
    });

    return [created];
  });

  logger.info("[BillingLedger] Record created", {
    recordId,
    bookingId: params.bookingId,
    purpose:   params.documentPurpose,
    status:    params.paymentFlowStatus,
    totalILS:  (params.totalAgorot / 100).toFixed(2),
    requiresAllocation,
  });

  return record;
}

// ── Read helpers ──────────────────────────────────────────────────────────────

export async function getBillingRecord(recordId: string): Promise<BillingRecord | null> {
  const [record] = await db
    .select()
    .from(billingRecords)
    .where(eq(billingRecords.recordId, recordId))
    .limit(1);
  return record ?? null;
}

export async function getBillingRecordsByBooking(bookingId: string): Promise<BillingRecord[]> {
  return db
    .select()
    .from(billingRecords)
    .where(eq(billingRecords.bookingId, bookingId))
    .orderBy(desc(billingRecords.createdAt));
}

export async function getAuditTrail(recordId: string) {
  return db
    .select()
    .from(billingAuditLog)
    .where(eq(billingAuditLog.recordId, recordId))
    .orderBy(billingAuditLog.id);
}

// ── Update legal document references (from accounting system callback) ────────

export async function setReceiptNumber(recordId: string, receiptNumber: string): Promise<void> {
  await db
    .update(billingRecords)
    .set({ receiptNumber, updatedAt: new Date() })
    .where(eq(billingRecords.recordId, recordId));
  logger.info("[BillingLedger] Receipt number recorded", { recordId, receiptNumber });
}

export async function setInvoiceNumber(recordId: string, invoiceNumber: string): Promise<void> {
  await db
    .update(billingRecords)
    .set({ invoiceNumber, updatedAt: new Date() })
    .where(eq(billingRecords.recordId, recordId));
  logger.info("[BillingLedger] Invoice number recorded", { recordId, invoiceNumber });
}

export async function setAllocationNumber(
  recordId: string,
  allocationNumber: string
): Promise<void> {
  await db
    .update(billingRecords)
    .set({
      allocationNumber,
      allocationConfirmed: true,
      updatedAt: new Date(),
    })
    .where(eq(billingRecords.recordId, recordId));
  logger.info("[BillingLedger] Allocation number recorded", { recordId, allocationNumber });
}

// ── Factory: create from gross amount (auto-calc VAT) ─────────────────────────

export async function createFromGrossAgorot(params: Omit<
  CreateBillingRecordParams,
  "subtotalAgorot" | "vatAgorot" | "totalAgorot"
> & { grossAgorot: number }): Promise<BillingRecord> {
  const { subtotalAgorot, vatAgorot, totalAgorot } = calcVatFromGrossAgorot(params.grossAgorot);
  return createBillingRecord({ ...params, subtotalAgorot, vatAgorot, totalAgorot });
}
