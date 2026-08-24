/**
 * REFUND SERVICE — Phase 1 orchestrator for the automated customer refund rail.
 *
 * Every refund obligation is recorded exactly once in `refund_transactions`,
 * keyed by an idempotency key. Wallet-instrument refunds EXECUTE now against the
 * canonical, hash-chained wallet ledger (WalletLedger.refundToWallet). Card /
 * Phase-2 obligations are recorded `pending` and raise a payment alert — they are
 * tracked liabilities, never silently dropped (the hole this closes).
 *
 * Fail-closed: a row is only marked `succeeded` after the underlying rail
 * confirms; a rail error leaves it `failed` + a critical alert.
 *
 * See docs/finance/refund-rail-design-2026-06-23.md. Phase 2 (card via Nayax
 * void + SUMIT CreditInvoice) and eGift/loyalty/promo/wash-pack bucket restores
 * layer on top of this same ledger.
 */
import crypto from "crypto";
import { db } from "../db";
import { refundTransactions } from "@shared/schema";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";
import { createOrUpdateAlert } from "./AlertEngine";
import { logAuditEvent } from "../middleware/auditLog";

export type RefundInstrument = "wallet" | "egift" | "loyalty" | "promo" | "wash_pack" | "card";

/** Instruments the rail can settle end-to-end today (Phase 1). Everything else
 *  is recorded as a tracked pending obligation for Phase 1b/2. */
const EXECUTABLE_NOW = new Set<RefundInstrument>(["wallet"]);

export interface RequestRefundInput {
  sourceType: string;                 // booking | escrow | marketplace | academy | k9000 | egift
  sourceId: string;
  userId: string;                     // customer being refunded
  instrument: RefundInstrument;
  refundCents: number;                // amount to return (> 0)
  chargedCents?: number;              // original charge (context)
  feeCents?: number;                  // retained cancellation fee
  divisionCode?: string;              // wallet division for the ledger entry
  currency?: string;                  // default ILS
  reason?: string;
  idempotencyKey: string;             // REQUIRED — one refund per obligation
  initiatedBy?: string;               // 'escrow_cancel' | admin uid | 'system'
}

export interface RefundResult {
  refundId: string;
  status: "pending" | "executing" | "succeeded" | "failed";
  executed: boolean;
  railRef?: string;
  idempotent: boolean;
  skipped?: "zero" | "no_key";
}

/** Deterministic public id from the idempotency key (no clock/random). */
function makeRefundId(idempotencyKey: string): string {
  const h = crypto.createHash("sha256").update(idempotencyKey).digest("hex").slice(0, 20);
  return `rfnd_${h}`;
}

/**
 * Record and (for wallet instruments) execute a refund. Idempotent per
 * idempotencyKey: a repeat call returns the existing row without moving money
 * twice.
 */
export async function requestRefund(input: RequestRefundInput): Promise<RefundResult> {
  const { sourceType, sourceId, userId, instrument, idempotencyKey } = input;

  if (!idempotencyKey) {
    throw new Error("REFUND_REQUIRES_IDEMPOTENCY_KEY");
  }
  const refundCents = Math.floor(input.refundCents);
  if (!(refundCents > 0)) {
    return { refundId: "", status: "failed", executed: false, idempotent: false, skipped: "zero" };
  }

  // Money-audit F3 (2026-08-24): treasury-drain guard. Previously the service
  // trusted the caller to pass a sane refundCents. Any bug/coercion at a call
  // site with an inflated refundCents ran refundToWallet blind. Now: when the
  // caller supplied chargedCents, enforce refundCents ≤ chargedCents. If the
  // caller omitted chargedCents (some legacy paths still do), we cannot
  // enforce here — log at warn so the missing context is visible in Cloud Run
  // and the ops "no cap" surface stays discoverable.
  if (typeof input.chargedCents === "number" && input.chargedCents > 0) {
    if (refundCents > input.chargedCents) {
      logger.error("[RefundService] REJECTED over-refund attempt: refundCents > chargedCents", {
        sourceType, sourceId, userId, refundCents, chargedCents: input.chargedCents, initiatedBy: input.initiatedBy,
      });
      throw new Error(
        `REFUND_EXCEEDS_CHARGE: refundCents (${refundCents}) > chargedCents (${input.chargedCents})`,
      );
    }
  } else {
    logger.warn("[RefundService] refund proceeding without chargedCents context — over-refund guard cannot enforce a cap on this call", {
      sourceType, sourceId, userId, refundCents, initiatedBy: input.initiatedBy,
    });
  }

  // Idempotency — already recorded?
  const [existing] = await db
    .select()
    .from(refundTransactions)
    .where(eq(refundTransactions.idempotencyKey, idempotencyKey))
    .limit(1);
  if (existing) {
    return {
      refundId: existing.refundId,
      status: existing.status as RefundResult["status"],
      executed: existing.status === "succeeded",
      railRef: existing.railRef ?? undefined,
      idempotent: true,
    };
  }

  const refundId = makeRefundId(idempotencyKey);

  // Insert the pending obligation. The UNIQUE(idempotency_key) makes this the
  // race guard: a concurrent caller that lost the insert re-reads and returns.
  try {
    await db.insert(refundTransactions).values({
      refundId,
      idempotencyKey,
      sourceType,
      sourceId,
      userId,
      instrument,
      chargedCents: input.chargedCents ?? null,
      feeCents: input.feeCents ?? 0,
      refundCents,
      currency: input.currency ?? "ILS",
      status: "pending",
      reason: input.reason ?? null,
      initiatedBy: input.initiatedBy ?? null,
    });
  } catch (err: any) {
    const [row] = await db
      .select()
      .from(refundTransactions)
      .where(eq(refundTransactions.idempotencyKey, idempotencyKey))
      .limit(1);
    if (row) {
      return {
        refundId: row.refundId,
        status: row.status as RefundResult["status"],
        executed: row.status === "succeeded",
        railRef: row.railRef ?? undefined,
        idempotent: true,
      };
    }
    logger.error("[RefundService] insert failed", { error: err?.message, idempotencyKey });
    throw err;
  }

  // Card / non-executable instrument → tracked pending obligation + alert.
  if (!EXECUTABLE_NOW.has(instrument)) {
    await createOrUpdateAlert({
      dedupeKey: `refund_pending:${refundId}`,
      category: "payment",
      severity: "warning",
      title: "Refund owed — awaiting vendor/manual rail",
      message: `${instrument} refund of ${refundCents} agorot for ${sourceType}:${sourceId} is recorded and awaits Phase-2 execution.`,
      linkedEntityType: "refund",
      linkedEntityId: refundId,
      source: "refund_rail",
      metadata: { userId, instrument, refundCents, sourceType, sourceId },
    });
    logger.info("[RefundService] Refund recorded pending (non-wallet instrument)", {
      refundId, instrument, refundCents, sourceType, sourceId,
    });
    // Central audit trail (invariants §4): a money-out obligation must be
    // audited, not only recorded in refund_transactions + an alert.
    logAuditEvent({
      actorUserId: input.initiatedBy ?? userId,
      actorRole: "system",
      actionType: "REFUND_RECORDED_PENDING",
      targetType: "refund",
      targetId: refundId,
      metadata: { userId, instrument, refundCents, sourceType, sourceId, currency: input.currency ?? "ILS" },
    }).catch(() => { /* audit is fail-soft; never blocks a refund */ });
    return { refundId, status: "pending", executed: false, idempotent: false };
  }

  // Wallet instrument → execute against the canonical wallet ledger.
  try {
    await db.update(refundTransactions)
      .set({ status: "executing", updatedAt: new Date() })
      .where(eq(refundTransactions.refundId, refundId));

    const { refundToWallet } = await import("./WalletLedger");
    const result = await refundToWallet({
      userId,
      amountCents: refundCents,
      divisionCode: input.divisionCode ?? "general",
      sourceType,
      sourceId,
      idempotencyKey: `refund_rail:${idempotencyKey}`,
      reason: input.reason ?? "refund",
      metadata: { refundId },
    });

    await db.update(refundTransactions)
      .set({ status: "succeeded", railRef: result.txnId, updatedAt: new Date() })
      .where(eq(refundTransactions.refundId, refundId));

    logger.info("[RefundService] Wallet refund succeeded", {
      refundId, userId, refundCents, txnId: result.txnId,
    });
    // Central audit trail (invariants §4): money actually moved back to the user.
    logAuditEvent({
      actorUserId: input.initiatedBy ?? userId,
      actorRole: "system",
      actionType: "REFUND_EXECUTED",
      targetType: "refund",
      targetId: refundId,
      metadata: { userId, instrument, refundCents, sourceType, sourceId, railRef: result.txnId },
    }).catch(() => { /* audit is fail-soft; never blocks a refund */ });
    return { refundId, status: "succeeded", executed: true, railRef: result.txnId, idempotent: false };
  } catch (err: any) {
    await db.update(refundTransactions)
      .set({
        status: "failed",
        reason: `${input.reason ?? ""} | rail_error: ${err?.message ?? String(err)}`.slice(0, 500),
        updatedAt: new Date(),
      })
      .where(eq(refundTransactions.refundId, refundId));

    await createOrUpdateAlert({
      dedupeKey: `refund_failed:${refundId}`,
      category: "payment",
      severity: "critical",
      title: "Refund rail FAILED — money not returned",
      message: `Wallet refund of ${refundCents} agorot for ${sourceType}:${sourceId} failed: ${err?.message ?? String(err)}`,
      linkedEntityType: "refund",
      linkedEntityId: refundId,
      source: "refund_rail",
      metadata: { userId, refundCents, sourceType, sourceId },
    });

    logger.error("[RefundService] Wallet refund FAILED", {
      refundId, userId, refundCents, error: err?.message,
    });
    // Central audit trail (invariants §4): a failed money-out is exactly the
    // event an auditor most needs to see — record it, not just the alert.
    logAuditEvent({
      actorUserId: input.initiatedBy ?? userId,
      actorRole: "system",
      actionType: "REFUND_FAILED",
      targetType: "refund",
      targetId: refundId,
      metadata: { userId, instrument, refundCents, sourceType, sourceId, error: err?.message ?? String(err) },
    }).catch(() => { /* audit is fail-soft; never blocks a refund */ });
    return { refundId, status: "failed", executed: false, idempotent: false };
  }
}

export const RefundService = { requestRefund };
export default RefundService;
