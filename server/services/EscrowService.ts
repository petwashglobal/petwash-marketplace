/**
 * Escrow Payment Service for ⁦The Sitter Suite™⁩
 * 72-hour payment hold with automatic release upon service completion
 * Nayax-powered secure escrow with dispute resolution
 */

import admin from "../lib/firebase-admin";
import crypto from "crypto";
import NotificationService from "./NotificationService";
// Issue #153 PR-TAX-3 — forensic audit. logAuditEvent is fail-soft (catches
// internal errors and logs without throwing) so a write to audit_events
// never blocks an escrow transition. No new dependency: this module already
// ships in server/middleware/auditLog.ts.
import { logAuditEvent } from "../middleware/auditLog";
// §7 payout gate (fail-CLOSED, never throws): completion + refund-window +
// dispute + provider-verified + per-service approval. The SQL payout rails
// (payoutLedger, ProviderPayoutService) already enforce it; this Firestore
// escrow rail was the one UNGATED money-release path. We run the same gate
// here. Enforcement is behind ESCROW_PAYOUT_GATE_ENFORCE so it ships in shadow
// mode (logs what it WOULD hold) and can be flipped on once verified — no
// finance behavior change by default.
import { checkPayoutGates } from "./payoutGate";
// LEDGER v2 dual-write SHADOW (flag OFF): mirror escrow hold/release into the unified
// ledger for parity proving. Both helpers self-guard on LEDGER_V2_DUAL_WRITE and swallow
// all errors — they can never affect the real escrow.
import { shadowMirrorEscrowHold, shadowMirrorEscrowRelease } from "./LedgerService";

export interface CreditPaymentBreakdown {
  egiftCents: number;
  washPackages: number;
  loyaltyPointsCents: number;
  promoCents: number;
  referralCents: number;
  totalCreditsAppliedCents: number;
  cashPaidCents: number;
  redemptionSessionId?: string;
}

export interface EscrowPayment {
  id: string;
  bookingId: string;
  customerId: string;
  providerId: string;
  amount: number;
  currency: "ILS" | "USD" | "EUR";
  status: "held" | "released" | "refunded" | "disputed";
  holdUntil: Date;
  createdAt: Date;
  releasedAt?: Date;
  refundedAt?: Date;
  nayaxTransactionId?: string;
  metadata?: any;
  creditBreakdown?: CreditPaymentBreakdown;
  platformCommissionCents?: number;
  providerPayoutCents?: number;
}

class EscrowService {
  private db = admin.firestore();
  private readonly HOLD_DURATION_HOURS = 72;

  /**
   * Issue #153 PR-C — Money Brain Audit bridge.
   * Derive a stable Firestore doc ID from an idempotency key so retries of
   * the same booking/payment converge to ONE escrow doc rather than
   * spawning N parallel held-funds rows. The sha256 slice keeps the ID
   * Firestore-safe (alphanumeric, fixed length).
   */
  private makeDeterministicId(key: string): string {
    return crypto.createHash("sha256").update(key).digest("hex").slice(0, 24);
  }

  async createEscrowPayment(
    bookingId: string,
    customerId: string,
    providerId: string,
    amount: number,
    nayaxTransactionId?: string,
    metadata?: any,
    creditBreakdown?: CreditPaymentBreakdown,
    platformCommissionPercent: number = 15
  ): Promise<EscrowPayment> {
    // Issue #153 PR-C — idempotency. Prefer an explicit key in metadata,
    // then fall back to bookingId+nayaxTransactionId, then bookingId alone.
    // Invariant: one (bookingId, optional nayaxTxId) tuple maps to exactly
    // one escrow doc, even across network retries / processor webhook
    // replays / double-tap UI events.
    const explicitKey = (metadata?.idempotencyKey ?? metadata?.idempotency_key) as
      | string
      | undefined;
    const dedupKey =
      explicitKey ??
      (nayaxTransactionId ? `${bookingId}:${nayaxTransactionId}` : bookingId);

    const escrowRef = this.db
      .collection("escrow_payments")
      .doc(this.makeDeterministicId(`escrow:${dedupKey}`));

    const amountCents = Math.round(amount * 100);
    const platformCommissionCents = Math.round(
      amountCents * (platformCommissionPercent / 100)
    );
    const providerPayoutCents = amountCents - platformCommissionCents;

    // Issue #153 PR-C — atomic get-then-set-if-absent inside a Firestore
    // transaction. Concurrent create calls with the same dedup key both
    // read the same (absent or existing) doc; only the first commits the
    // new row. The runtime guarantees 'serializable' isolation per
    // Firestore docs, so this closes the duplicate-create race regardless
    // of caller retry topology.
    const result = await this.db.runTransaction(async (tx) => {
      const existing = await tx.get(escrowRef);
      if (existing.exists) {
        return { escrow: existing.data() as EscrowPayment, isNew: false };
      }

      const holdUntil = new Date();
      holdUntil.setHours(holdUntil.getHours() + this.HOLD_DURATION_HOURS);

      const escrow: EscrowPayment = {
        id: escrowRef.id,
        bookingId,
        customerId,
        providerId,
        amount,
        currency: "ILS",
        status: "held",
        holdUntil,
        createdAt: new Date(),
        nayaxTransactionId,
        metadata,
        creditBreakdown,
        platformCommissionCents,
        providerPayoutCents,
      };

      tx.set(escrowRef, escrow);
      return { escrow, isNew: true };
    });

    if (!result.isNew) {
      console.log(
        `[Escrow] Idempotent retry — returning existing escrow ${result.escrow.id} for booking ${bookingId}`
      );
      return result.escrow;
    }

    // First-create-only: fire notifications. Notifications are external
    // side effects and must NOT live inside the transaction (they would
    // re-fire on every tx retry under contention).
    //
    // HONESTY GUARD (CEO 2026-08-04): only tell the customer/provider that money is
    // "Secured 🔒 / held in escrow" when money was ACTUALLY captured. Callers that
    // create the escrow record BEFORE (or without) a real charge — e.g. booking-requests
    // /pay (hold created before the Nayax redirect) — pass metadata.moneyCaptured=false
    // so we don't lie about held funds. The real confirmation then fires from the
    // payment webhook when money truly moves. Default (undefined) preserves the
    // capture-first flows that were honest already.
    const moneyCaptured = (metadata?.moneyCaptured !== false);
    if (moneyCaptured) {
      await NotificationService.sendNotification({
        userId: customerId,
        type: "payment",
        title: "Payment Secured 🔒",
        message: `₪${amount.toFixed(2)} held in escrow. Will be released upon service completion.`,
        priority: "normal",
        channel: "push",
        data: { escrowId: result.escrow.id, bookingId },
      });

      await NotificationService.sendNotification({
        userId: providerId,
        type: "payment",
        title: "Booking Confirmed 🎉",
        message: `Payment secured in escrow. Complete service to receive ₪${amount.toFixed(2)}.`,
        priority: "normal",
        channel: "push",
        data: { escrowId: result.escrow.id, bookingId },
      });
    } else {
      console.log(
        `[Escrow] moneyCaptured=false for booking ${bookingId} — suppressing premature "Payment Secured" notifications (webhook will confirm on real capture).`
      );
    }

    console.log(
      `[Escrow] Payment held: ₪${amount.toFixed(2)} for booking ${bookingId}`
    );

    // LEDGER v2 dual-write SHADOW (flag OFF, 2026-08-10): mirror this hold into the
    // unified ledger as a resolve-once pending transfer. Only when money was ACTUALLY
    // captured — never record held funds that don't exist. Self-guarded + self-wrapped:
    // observe-only, can never affect the real escrow above.
    if (moneyCaptured) {
      await shadowMirrorEscrowHold({
        bookingId,
        amountCents,
        provider: nayaxTransactionId ? 'nayax' : 'sumit',
        paymentRef: nayaxTransactionId ?? null,
      });
    }
    return result.escrow;
  }

  async releaseEscrowPayment(
    escrowId: string,
    releasedBy: string,
    opts?: { bypassGate?: boolean; enforceGate?: boolean },
  ): Promise<void> {
    const escrowRef = this.db.collection("escrow_payments").doc(escrowId);

    // ── §7 payout gate (fail-CLOSED) — applied to this Firestore rail so it
    // matches the SQL rails. Runs BEFORE the release transaction. An explicit
    // audited admin override (opts.bypassGate) can skip it. Enforcement is
    // gated by ESCROW_PAYOUT_GATE_ENFORCE: default OFF = shadow mode (log only,
    // behavior unchanged); ON = HOLD (throw) on any failed gate. ──────────────
    if (!opts?.bypassGate) {
      // Peek the escrow to resolve provider/booking for the gate (no mutation).
      const peek = await escrowRef.get();
      if (peek.exists) {
        const e = peek.data() as EscrowPayment;
        if (e.status === "held") {
          const gate = await checkPayoutGates({
            providerUid: e.providerId,
            bookingId: e.bookingId,
            serviceType: (e.metadata as any)?.serviceType ?? null,
          });
          if (!gate.ok) {
            // enforceGate:true forces the fail-closed HOLD for a specific caller
            // regardless of the global env flag. Used by the TIME-BASED orphan
            // auto-release (autoReleaseExpiredHolds) so it can NEVER release an
            // escrow whose booking isn't actually completed — WITHOUT changing
            // behavior for explicit, already-authorized releases (owner-confirm,
            // manual party release, octopus completion), which release now and
            // must not be blocked by the 48h refund-window gate.
            const enforce = opts?.enforceGate === true || process.env.ESCROW_PAYOUT_GATE_ENFORCE === "true";
            console.warn(
              `[Escrow] payout gate ${enforce ? "HELD" : "WOULD HOLD (shadow)"} ` +
                `escrow ${escrowId} — ${gate.reason}: ${gate.message}`,
            );
            await logAuditEvent({
              actorUserId: releasedBy,
              actionType: enforce ? "ESCROW_GATE_HELD" : "ESCROW_GATE_WOULD_HOLD",
              targetType: "escrow_payment",
              targetId: escrowId,
              metadata: {
                bookingId: e.bookingId,
                providerId: e.providerId,
                reason: gate.reason,
                message: gate.message,
                enforced: enforce,
              },
            });
            if (enforce) {
              const err: any = new Error(`PAYOUT_HELD_GATE: ${gate.reason}`);
              err.code = "PAYOUT_HELD_GATE";
              err.gateReason = gate.reason;
              throw err;
            }
          }
        }
      }
    }

    // Issue #153 PR-C — read+check+update inside a Firestore transaction so
    // concurrent release calls cannot both pass the status === "held" check
    // and double-fire payouts. The transaction lifts release into a
    // single atomic operation; second caller sees status="released" and
    // throws — exactly the same exception the route layer already handles.
    const escrow = await this.db.runTransaction(async (tx) => {
      const escrowDoc = await tx.get(escrowRef);
      if (!escrowDoc.exists) {
        throw new Error("Escrow payment not found");
      }
      const e = escrowDoc.data() as EscrowPayment;
      if (e.status !== "held") {
        throw new Error(`Cannot release escrow with status: ${e.status}`);
      }
      tx.update(escrowRef, {
        status: "released",
        releasedAt: new Date(),
        releasedBy,
      });
      return e;
    });

    // LEDGER v2 dual-write SHADOW (flag OFF, 2026-08-10): mirror this release into the
    // unified ledger (escrow → provider payable + commission + VAT). The resolve-once
    // guard means a double-release maps to a no-op here. Self-wrapped; only fires when
    // the split cents are on the escrow record. Can never affect the real release above.
    if (typeof escrow.providerPayoutCents === "number" && typeof escrow.platformCommissionCents === "number") {
      await shadowMirrorEscrowRelease({
        bookingId: escrow.bookingId,
        providerUid: escrow.providerId,
        providerPayoutCents: escrow.providerPayoutCents,
        commissionCents: escrow.platformCommissionCents,
      });
    }

    // Issue #153 PR-TAX-3 — forensic audit row, AFTER the tx commits and
    // BEFORE notifications. logAuditEvent is fail-soft so this never
    // blocks the release. No money math change, no schema change.
    await logAuditEvent({
      actorUserId: releasedBy,
      actionType: "ESCROW_RELEASED",
      targetType: "escrow_payment",
      targetId: escrowId,
      metadata: {
        bookingId: escrow.bookingId,
        customerId: escrow.customerId,
        providerId: escrow.providerId,
        amount: escrow.amount,
        currency: escrow.currency,
        platformCommissionCents: escrow.platformCommissionCents,
        providerPayoutCents: escrow.providerPayoutCents,
        nayaxTransactionId: escrow.nayaxTransactionId,
        prevStatus: "held",
      },
    });

    const providerPayout = escrow.providerPayoutCents
      ? (escrow.providerPayoutCents / 100).toFixed(2)
      : escrow.amount.toFixed(2);

    let paymentSourceDetails = '';
    if (escrow.creditBreakdown && escrow.creditBreakdown.totalCreditsAppliedCents > 0) {
      const creditAmt = (escrow.creditBreakdown.totalCreditsAppliedCents / 100).toFixed(2);
      const cashAmt = (escrow.creditBreakdown.cashPaidCents / 100).toFixed(2);
      paymentSourceDetails = ` (₪${creditAmt} credits + ₪${cashAmt} cash)`;
    }

    // HONESTY (2026-08-01): releasing escrow flips the hold to "released" and APPROVES
    // the amount for payout — it does NOT itself move money to the provider's bank
    // (the bank-disbursement rail is separate/queued). Saying "transferred to your
    // account" was a lie: the funds have not reached the provider yet. Word it as
    // approved-and-queued so we never claim a payment that hasn't been sent.
    await NotificationService.sendNotification({
      userId: escrow.providerId,
      type: "payment",
      title: "Earnings Approved ✅",
      message: `₪${providerPayout} from this booking${paymentSourceDetails} has been approved and is queued for payout to your account. You'll be notified once the transfer is sent.`,
      priority: "high",
      channel: "all",
      data: { 
        escrowId, 
        bookingId: escrow.bookingId,
        payoutAmount: escrow.providerPayoutCents,
        commissionAmount: escrow.platformCommissionCents,
        creditBreakdown: escrow.creditBreakdown,
      },
    });

    await NotificationService.sendNotification({
      userId: escrow.customerId,
      type: "payment",
      title: "Payment Completed ✅",
      message: `Service confirmed. Payment of ₪${escrow.amount.toFixed(2)}${paymentSourceDetails} released to provider.`,
      priority: "normal",
      channel: "push",
      data: { escrowId, bookingId: escrow.bookingId },
    });

    console.log(`[Escrow] Payment released: ${escrowId} - Provider payout: ₪${providerPayout}, Commission: ₪${((escrow.platformCommissionCents || 0) / 100).toFixed(2)}`);
  }

  async refundEscrowPayment(escrowId: string, reason: string, refundedBy: string): Promise<void> {
    const escrowRef = this.db.collection("escrow_payments").doc(escrowId);

    // Issue #153 PR-C — same atomicity guarantee as releaseEscrowPayment.
    // Two concurrent refund calls (e.g. customer cancels twice through a
    // network retry) cannot both transition status="held" → "refunded"; the
    // second one sees status="refunded" inside the tx and throws.
    const escrow = await this.db.runTransaction(async (tx) => {
      const escrowDoc = await tx.get(escrowRef);
      if (!escrowDoc.exists) {
        throw new Error("Escrow payment not found");
      }
      const e = escrowDoc.data() as EscrowPayment;
      if (e.status !== "held") {
        throw new Error(`Cannot refund escrow with status: ${e.status}`);
      }
      tx.update(escrowRef, {
        status: "refunded",
        refundedAt: new Date(),
        refundReason: reason,
        refundedBy,
      });
      return e;
    });

    // Issue #153 PR-TAX-3 — forensic audit row, AFTER the tx commits and
    // BEFORE notifications. Money math NOT changed; this is observability
    // only. The legal credit-note (חשבונית זיכוי) wiring remains in the
    // CEO + CPA approval queue.
    await logAuditEvent({
      actorUserId: refundedBy,
      actionType: "ESCROW_REFUNDED",
      targetType: "escrow_payment",
      targetId: escrowId,
      metadata: {
        bookingId: escrow.bookingId,
        customerId: escrow.customerId,
        providerId: escrow.providerId,
        amount: escrow.amount,
        currency: escrow.currency,
        nayaxTransactionId: escrow.nayaxTransactionId,
        reason,
        prevStatus: "held",
      },
    });

    await NotificationService.sendNotification({
      userId: escrow.customerId,
      type: "payment",
      // Honest wording (2026-07-30 audit): this method flips the escrow record
      // to 'refunded' — it does NOT move card money (no automated card-refund
      // rail exists yet). Telling the customer the money "has been refunded"
      // was a false statement; say it is being processed instead.
      title: "Refund In Process 💳",
      message: `Your refund of ₪${escrow.amount.toFixed(2)} is being processed. Card refunds can take a few business days to appear.`,
      priority: "high",
      channel: "all",
      data: { escrowId, bookingId: escrow.bookingId, reason },
    });

    await NotificationService.sendNotification({
      userId: escrow.providerId,
      type: "payment",
      title: "Booking Cancelled",
      message: `Booking cancelled. Payment refunded to customer.`,
      priority: "normal",
      channel: "push",
      data: { escrowId, bookingId: escrow.bookingId, reason },
    });

    console.log(`[Escrow] Payment refunded: ${escrowId} - Reason: ${reason}`);
  }

  async disputeEscrowPayment(escrowId: string, disputeReason: string, disputedBy: string): Promise<void> {
    const escrowRef = this.db.collection("escrow_payments").doc(escrowId);

    // Issue #153 PR-C — same atomicity guarantee. Without the tx, a race
    // between dispute and auto-release could let the cron release funds
    // while the dispute is being filed. Inside the tx the status check and
    // the autoReleaseBlocked flip happen as one operation, closing that
    // window. Section-10 invariant preserved.
    const escrow = await this.db.runTransaction(async (tx) => {
      const escrowDoc = await tx.get(escrowRef);
      if (!escrowDoc.exists) {
        throw new Error("Escrow payment not found");
      }
      const e = escrowDoc.data() as EscrowPayment;
      if (e.status === "released" || e.status === "refunded") {
        throw new Error(`Cannot dispute an escrow that is already ${e.status}`);
      }
      tx.update(escrowRef, {
        status: "disputed",
        disputeReason,
        disputedBy,
        disputedAt: new Date(),
        autoReleaseBlocked: true, // FREEZE: cron must NOT auto-release disputed funds (Section 10)
      });
      return e;
    });

    // Issue #153 PR-TAX-3 — forensic audit row, AFTER the tx commits and
    // BEFORE notifications. Section-10 autoReleaseBlocked freeze remains
    // canonical inside the tx; the audit row records the dispute event
    // for the same booking so a forensic timeline can be reconstructed.
    await logAuditEvent({
      actorUserId: disputedBy,
      actionType: "ESCROW_DISPUTED",
      targetType: "escrow_payment",
      targetId: escrowId,
      metadata: {
        bookingId: escrow.bookingId,
        customerId: escrow.customerId,
        providerId: escrow.providerId,
        amount: escrow.amount,
        currency: escrow.currency,
        nayaxTransactionId: escrow.nayaxTransactionId,
        disputeReason,
        prevStatus: escrow.status,
      },
    });

    await NotificationService.sendNotification({
      userId: "admin",
      type: "system",
      title: "🚨 Escrow Dispute — Auto-Release Frozen",
      message: `Dispute filed for booking ${escrow.bookingId}. Amount: ₪${escrow.amount.toFixed(2)}. Auto-release is FROZEN pending admin review.`,
      priority: "high",
      channel: "all",
      data: { escrowId, bookingId: escrow.bookingId, reason: disputeReason, autoReleaseBlocked: true },
    });

    await NotificationService.sendNotification({
      userId: escrow.customerId,
      type: "system",
      title: "Dispute Received",
      message: `Your dispute for booking has been received and is under review. Payment is frozen.`,
      priority: "high",
      channel: "all",
      data: { escrowId, bookingId: escrow.bookingId },
    });

    console.log(`[Escrow] DISPUTE FROZEN: ${escrowId} - Reason: ${disputeReason} - Auto-release blocked`);
  }

  async getEscrowPayment(escrowId: string): Promise<EscrowPayment | null> {
    const doc = await this.db.collection("escrow_payments").doc(escrowId).get();
    return doc.exists ? (doc.data() as EscrowPayment) : null;
  }

  async getEscrowsByBooking(bookingId: string): Promise<EscrowPayment[]> {
    const snapshot = await this.db
      .collection("escrow_payments")
      .where("bookingId", "==", bookingId)
      .get();

    return snapshot.docs.map((doc) => doc.data() as EscrowPayment);
  }

  async getExpiredHolds(): Promise<EscrowPayment[]> {
    const now = new Date();
    // Section 10: Only fetch 'held' status — 'disputed' escrows are frozen and excluded.
    // autoReleaseBlocked check is done in autoReleaseExpiredHolds as an extra safety layer.
    const snapshot = await this.db
      .collection("escrow_payments")
      .where("status", "==", "held")
      .where("holdUntil", "<=", now)
      .get();

    return snapshot.docs.map((doc) => doc.data() as EscrowPayment);
  }

  async autoReleaseExpiredHolds(): Promise<number> {
    const expiredHolds = await this.getExpiredHolds();
    let releasedCount = 0;
    let skippedDisputed = 0;

    for (const escrow of expiredHolds) {
      try {
        // Section 10: Double-check autoReleaseBlocked flag — disputed escrows
        // may have been set to 'held' accidentally before dispute was filed.
        const doc = await this.db.collection("escrow_payments").doc(escrow.id).get();
        const fresh = doc.data() as any;

        if (fresh?.autoReleaseBlocked === true || fresh?.status === "disputed") {
          skippedDisputed++;
          console.warn(`[Escrow] SKIPPED auto-release for disputed escrow: ${escrow.id}`);
          continue;
        }

        // Time-based orphan release: FORCE the payout gate (fail-closed). An
        // escrow reaches holdUntil still 'held' only if no explicit release
        // happened — i.e. no owner confirmation and not caught by the 24h
        // auto-approve. If the booking never actually completed (provider
        // no-show / abandoned), the gate HOLDS and we do NOT release. Legit
        // completed-but-stuck escrows still pass the gate and release here.
        await this.releaseEscrowPayment(escrow.id, "system_auto_release", { enforceGate: true });
        releasedCount++;
      } catch (error: any) {
        // BOOKING_NOT_FOUND (2026-08-24): escrow references a Firestore
        // booking doc that no longer exists (booking wiped by GDPR, admin
        // hard-delete, or migration cleanup). Every 5-min cron run re-tries
        // the same orphan — flooding logs + Sentry alerts, and this noise
        // has been drowning real deploy diagnostics. Mark the escrow row
        // 'booking_orphaned' so the cron skips it next pass; a human still
        // sees it in the admin reconcile dashboard.
        const isOrphan = error?.code === 'PAYOUT_HELD_GATE' && error?.gateReason === 'BOOKING_NOT_FOUND';
        if (isOrphan) {
          try {
            await this.db.collection('escrow_payments').doc(escrow.id).update({
              status: 'booking_orphaned',
              orphanedAt: new Date(),
              orphanedReason: 'booking_not_found_at_auto_release',
              updatedAt: new Date(),
            });
            console.warn(`[Escrow] Escrow ${escrow.id} marked booking_orphaned — booking ${(error as any)?.bookingId || 'unknown'} vanished; auto-release cron will skip on future runs`);
          } catch (markErr: any) {
            console.error(`[Escrow] Failed to mark escrow ${escrow.id} as booking_orphaned; will keep looping until manual reconcile`, markErr?.message);
          }
        } else {
          console.error(`[Escrow] Failed to auto-release ${escrow.id}:`, error);
        }
      }
    }

    if (releasedCount > 0 || skippedDisputed > 0) {
      console.log(`[Escrow] Auto-release run: ${releasedCount} released, ${skippedDisputed} skipped (disputed/frozen)`);
    }

    return releasedCount;
  }

  async getUserPayments(userId: string): Promise<EscrowPayment[]> {
    const snapshot = await this.db
      .collection("escrow_payments")
      .where("customerId", "==", userId)
      .orderBy("createdAt", "desc")
      .limit(50)
      .get();

    return snapshot.docs.map((doc) => doc.data() as EscrowPayment);
  }
}

export default new EscrowService();
