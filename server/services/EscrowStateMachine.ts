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
import { eq, and, desc } from "drizzle-orm";
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

/**
 * Raised when a concurrent worker changed the record's status between our
 * read and our compare-and-set write. The caller MUST NOT retry blindly —
 * the other worker already applied a transition, and re-running would risk a
 * second financial effect (e.g. a second refund delta on the same record).
 */
export class EscrowConcurrentTransitionError extends Error {
  readonly code = "ESCROW_CONCURRENT_TRANSITION";
  constructor(
    readonly recordId: string,
    readonly expectedFrom: PaymentFlowStatus,
    readonly toStatus: PaymentFlowStatus,
  ) {
    super(
      `Concurrent escrow transition on record ${recordId}: expected status ` +
      `'${expectedFrom}' when writing '${toStatus}', but another worker changed it first.`
    );
    this.name = "EscrowConcurrentTransitionError";
  }
}

/**
 * CONCURRENCY (2026-08-17, sprint/money-concurrency M1) — NO financial rule changed.
 *
 * Previously this function did: SELECT status (outside any transaction) →
 * validate the transition in JS → open a transaction → UNCONDITIONAL
 * `UPDATE billing_records SET payment_flow_status = toStatus WHERE record_id = ?`.
 *
 * Two concurrent refunds of the SAME record therefore both:
 *   1. read `held_in_escrow`
 *   2. pass `isTransitionAllowed(held_in_escrow → refunded)`
 *   3. write `refunded` — and BOTH appended a `held_in_escrow_to_refunded`
 *      audit row carrying `deltaAgorot = refundAgorot`.
 * Net effect: one payment recorded TWO refund deltas, and because both rows
 * were built from the same `lastAudit`, the SHA-256 audit hash chain FORKED
 * (two entries with the same prevHash) — destroying the tamper-evidence the
 * chain exists to provide.
 *
 * The fix is entirely a concurrency control:
 *   a. the read, the validation and the write now live in ONE transaction;
 *   b. the record row is pinned with `SELECT … FOR UPDATE` so a second worker
 *      blocks until the first commits and then re-reads the NEW status;
 *   c. the UPDATE is a compare-and-set — `WHERE record_id = ? AND
 *      payment_flow_status = <the status we validated against>` … RETURNING —
 *      and 0 returned rows raises EscrowConcurrentTransitionError instead of
 *      silently applying a duplicate transition;
 *   d. the audit-chain tail is read INSIDE the same locked transaction, so
 *      prevHash cannot fork.
 *
 * The allowed-transition table, the amounts, the delta and the audit payload
 * are byte-for-byte unchanged. The same rule now simply fires exactly once.
 */
export async function transitionEscrowState(params: TransitionParams): Promise<void> {
  const { recordId, toStatus, actorType, actorId, deltaAgorot, notes, payload } = params;

  const applied = await db.transaction(async (tx) => {
    // (b) Pin the record for the whole transition. A concurrent transition on
    // the same record queues here and observes our committed status after.
    const [record] = await tx
      .select()
      .from(billingRecords)
      .where(eq(billingRecords.recordId, recordId))
      .limit(1)
      .for("update");

    if (!record) {
      throw new Error(`BillingRecord ${recordId} not found`);
    }

    const fromStatus = record.paymentFlowStatus as PaymentFlowStatus;

    if (fromStatus === toStatus) {
      logger.info("[EscrowStateMachine] No-op: record already in target status", { recordId, toStatus });
      return null;
    }

    if (!isTransitionAllowed(fromStatus, toStatus)) {
      throw new Error(
        `Invalid escrow transition: ${fromStatus} → ${toStatus} for record ${recordId}. ` +
        `Allowed from ${fromStatus}: [${ALLOWED_TRANSITIONS[fromStatus].join(", ")}]`
      );
    }

    // (d) Chain tail read under the same lock — prevHash cannot fork.
    const [lastAudit] = await tx
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

    // (c) 1. Compare-and-set the billing record status.
    const claimed = await tx
      .update(billingRecords)
      .set({
        paymentFlowStatus: toStatus,
        notes: notes ?? record.notes,
        updatedAt: new Date(),
        ...timestampUpdates,
      })
      .where(and(
        eq(billingRecords.recordId, recordId),
        eq(billingRecords.paymentFlowStatus, fromStatus),
      ))
      .returning({ recordId: billingRecords.recordId });

    if (claimed.length === 0) {
      // Lost the race. Abort the WHOLE transaction so no audit row is written
      // and no duplicate financial delta is recorded.
      throw new EscrowConcurrentTransitionError(recordId, fromStatus, toStatus);
    }

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

    return { fromStatus, auditId };
  });

  if (!applied) return; // no-op path (already in target status)

  logger.info("[EscrowStateMachine] Transition applied", {
    recordId,
    from: applied.fromStatus,
    to:   toStatus,
    actorType,
    auditId: applied.auditId,
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
