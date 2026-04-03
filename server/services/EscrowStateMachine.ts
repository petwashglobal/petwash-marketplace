/**
 * PetWash™ Escrow State Machine
 *
 * Defines the legal and financial state transitions for every payment event.
 * Escrow is an ACCOUNTING / PAYMENT STATE — not a label on a PDF.
 *
 * Valid state transitions:
 *
 *   authorized        → captured | cancelled
 *   captured          → held_in_escrow | refunded | disputed
 *   held_in_escrow    → released | refunded | partially_refunded | disputed
 *   released          → (terminal — only credit_note can adjust)
 *   refunded          → (terminal)
 *   partially_refunded → refunded | released
 *   disputed          → released | refunded | chargeback
 *   chargeback        → (terminal)
 *   cancelled         → (terminal)
 */

import { createHash } from "crypto";
import { nanoid } from "nanoid";
import { db } from "../db";
import { billingRecords, billingAuditLog } from "@shared/schema-billing";
import { eq, desc } from "drizzle-orm";
import { logger } from "../lib/logger";
import type { PaymentFlowStatus } from "@shared/schema-billing";

// ── Allowed transitions ───────────────────────────────────────────────────────

const ALLOWED_TRANSITIONS: Record<PaymentFlowStatus, PaymentFlowStatus[]> = {
  authorized:         ["captured", "cancelled"],
  captured:           ["held_in_escrow", "refunded", "disputed"],
  held_in_escrow:     ["released", "refunded", "partially_refunded", "disputed"],
  released:           [],
  refunded:           [],
  partially_refunded: ["refunded", "released"],
  disputed:           ["released", "refunded", "chargeback"],
  chargeback:         [],
  cancelled:          [],
};

export function isTransitionAllowed(
  from: PaymentFlowStatus,
  to: PaymentFlowStatus
): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export function isTerminalStatus(status: PaymentFlowStatus): boolean {
  return ALLOWED_TRANSITIONS[status]?.length === 0;
}

// ── Hash chain ────────────────────────────────────────────────────────────────

function computeAuditHash(
  prevHash: string | null,
  auditId: string,
  recordId: string,
  eventType: string,
  toStatus: string,
  deltaAgorot: number | null,
  createdAt: string
): string {
  const canonical = [
    prevHash ?? "GENESIS",
    auditId,
    recordId,
    eventType,
    toStatus,
    String(deltaAgorot ?? 0),
    createdAt,
  ].join("|");
  return createHash("sha256").update(canonical).digest("hex");
}

// ── Transition function ───────────────────────────────────────────────────────

export interface TransitionParams {
  recordId: string;
  toStatus: PaymentFlowStatus;
  actorType: "system" | "admin" | "webhook" | "provider" | "customer";
  actorId?: string;
  deltaAgorot?: number;
  notes?: string;
  payload?: Record<string, unknown>;
}

export async function transitionEscrowState(params: TransitionParams): Promise<void> {
  const { recordId, toStatus, actorType, actorId, deltaAgorot, notes, payload } = params;

  const [record] = await db
    .select()
    .from(billingRecords)
    .where(eq(billingRecords.recordId, recordId))
    .limit(1);

  if (!record) {
    throw new Error(`BillingRecord ${recordId} not found`);
  }

  const fromStatus = record.paymentFlowStatus as PaymentFlowStatus;

  if (fromStatus === toStatus) {
    logger.info("[EscrowStateMachine] No-op: record already in target status", { recordId, toStatus });
    return;
  }

  if (!isTransitionAllowed(fromStatus, toStatus)) {
    throw new Error(
      `Invalid escrow transition: ${fromStatus} → ${toStatus} for record ${recordId}. ` +
      `Allowed from ${fromStatus}: [${ALLOWED_TRANSITIONS[fromStatus].join(", ")}]`
    );
  }

  // Get the last audit entry for this record to build hash chain
  const [lastAudit] = await db
    .select()
    .from(billingAuditLog)
    .where(eq(billingAuditLog.recordId, recordId))
    .orderBy(desc(billingAuditLog.id))
    .limit(1);

  const auditId = `AUD-${nanoid(12).toUpperCase()}`;
  const createdAt = new Date().toISOString();
  const entryHash = computeAuditHash(
    lastAudit?.entryHash ?? null,
    auditId,
    recordId,
    `${fromStatus}_to_${toStatus}`,
    toStatus,
    deltaAgorot ?? null,
    createdAt
  );

  // Apply timestamp updates based on new status
  const timestampUpdates: Partial<typeof record> = {};
  if (toStatus === "captured")          timestampUpdates.capturedAt = new Date();
  if (toStatus === "released")          timestampUpdates.releasedAt = new Date();
  if (toStatus === "refunded" || toStatus === "partially_refunded")
                                        timestampUpdates.refundedAt = new Date();

  await db.transaction(async (tx) => {
    // 1. Update billing record status
    await tx
      .update(billingRecords)
      .set({
        paymentFlowStatus: toStatus,
        notes: notes ?? record.notes,
        updatedAt: new Date(),
        ...timestampUpdates,
      })
      .where(eq(billingRecords.recordId, recordId));

    // 2. Append immutable audit log entry
    await tx.insert(billingAuditLog).values({
      auditId,
      recordId,
      eventType:   `${fromStatus}_to_${toStatus}`,
      fromStatus,
      toStatus,
      actorType,
      actorId:     actorId ?? null,
      deltaAgorot: deltaAgorot ?? null,
      entryHash,
      prevHash:    lastAudit?.entryHash ?? null,
      payload:     payload ?? {},
    });
  });

  logger.info("[EscrowStateMachine] Transition applied", {
    recordId,
    from: fromStatus,
    to:   toStatus,
    actorType,
    auditId,
  });
}

// ── Convenience helpers ───────────────────────────────────────────────────────

export const EscrowStateMachine = {
  capture: (recordId: string, processorReference?: string) =>
    transitionEscrowState({
      recordId,
      toStatus:  "captured",
      actorType: "webhook",
      payload:   { processorReference },
    }),

  holdInEscrow: (recordId: string, holdUntil: Date) =>
    transitionEscrowState({
      recordId,
      toStatus:  "held_in_escrow",
      actorType: "system",
      payload:   { holdUntil: holdUntil.toISOString() },
    }),

  release: (recordId: string, releasedByActorId?: string) =>
    transitionEscrowState({
      recordId,
      toStatus:  "released",
      actorType: "system",
      actorId:   releasedByActorId,
    }),

  refund: (recordId: string, deltaAgorot: number, adminId?: string) =>
    transitionEscrowState({
      recordId,
      toStatus:     "refunded",
      actorType:    "admin",
      actorId:      adminId,
      deltaAgorot,
    }),

  partialRefund: (recordId: string, refundedAgorot: number, adminId?: string) =>
    transitionEscrowState({
      recordId,
      toStatus:     "partially_refunded",
      actorType:    "admin",
      actorId:      adminId,
      deltaAgorot:  refundedAgorot,
    }),

  dispute: (recordId: string, reason?: string) =>
    transitionEscrowState({
      recordId,
      toStatus:  "disputed",
      actorType: "webhook",
      payload:   { reason },
    }),
};
