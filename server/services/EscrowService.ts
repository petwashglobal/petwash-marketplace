/**
 * Escrow Payment Service for ⁦The Sitter Suite™⁩
 * 72-hour payment hold with automatic release upon service completion
 * Nayax-powered secure escrow with dispute resolution
 */

import admin from "../lib/firebase-admin";
import crypto from "crypto";
import NotificationService from "./NotificationService";

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

    console.log(
      `[Escrow] Payment held: ₪${amount.toFixed(2)} for booking ${bookingId}`
    );
    return result.escrow;
  }

  async releaseEscrowPayment(escrowId: string, releasedBy: string): Promise<void> {
    const escrowRef = this.db.collection("escrow_payments").doc(escrowId);

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

    const providerPayout = escrow.providerPayoutCents
      ? (escrow.providerPayoutCents / 100).toFixed(2)
      : escrow.amount.toFixed(2);

    let paymentSourceDetails = '';
    if (escrow.creditBreakdown && escrow.creditBreakdown.totalCreditsAppliedCents > 0) {
      const creditAmt = (escrow.creditBreakdown.totalCreditsAppliedCents / 100).toFixed(2);
      const cashAmt = (escrow.creditBreakdown.cashPaidCents / 100).toFixed(2);
      paymentSourceDetails = ` (₪${creditAmt} credits + ₪${cashAmt} cash)`;
    }

    await NotificationService.sendNotification({
      userId: escrow.providerId,
      type: "payment",
      title: "Payment Released 💰",
      message: `₪${providerPayout} has been released from escrow and transferred to your account.`,
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

    await NotificationService.sendNotification({
      userId: escrow.customerId,
      type: "payment",
      title: "Refund Processed 💳",
      message: `₪${escrow.amount.toFixed(2)} has been refunded to your account.`,
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

        await this.releaseEscrowPayment(escrow.id, "system_auto_release");
        releasedCount++;
      } catch (error) {
        console.error(`[Escrow] Failed to auto-release ${escrow.id}:`, error);
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
