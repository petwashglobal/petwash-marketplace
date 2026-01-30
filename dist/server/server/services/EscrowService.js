/**
 * Escrow Payment Service for The Sitter Suite™
 * 72-hour payment hold with automatic release upon service completion
 * Nayax-powered secure escrow with dispute resolution
 */
import admin from "firebase-admin";
import NotificationService from "./NotificationService";
class EscrowService {
    db = admin.firestore();
    HOLD_DURATION_HOURS = 72;
    async createEscrowPayment(bookingId, customerId, providerId, amount, nayaxTransactionId, metadata, creditBreakdown, platformCommissionPercent = 15) {
        const escrowRef = this.db.collection("escrow_payments").doc();
        const holdUntil = new Date();
        holdUntil.setHours(holdUntil.getHours() + this.HOLD_DURATION_HOURS);
        const amountCents = Math.round(amount * 100);
        const platformCommissionCents = Math.round(amountCents * (platformCommissionPercent / 100));
        const providerPayoutCents = amountCents - platformCommissionCents;
        const escrow = {
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
        await escrowRef.set(escrow);
        await NotificationService.sendNotification({
            userId: customerId,
            type: "payment",
            title: "Payment Secured 🔒",
            message: `₪${amount.toFixed(2)} held in escrow. Will be released upon service completion.`,
            priority: "normal",
            channel: "push",
            data: { escrowId: escrow.id, bookingId },
        });
        await NotificationService.sendNotification({
            userId: providerId,
            type: "payment",
            title: "Booking Confirmed 🎉",
            message: `Payment secured in escrow. Complete service to receive ₪${amount.toFixed(2)}.`,
            priority: "normal",
            channel: "push",
            data: { escrowId: escrow.id, bookingId },
        });
        console.log(`[Escrow] Payment held: ₪${amount.toFixed(2)} for booking ${bookingId}`);
        return escrow;
    }
    async releaseEscrowPayment(escrowId, releasedBy) {
        const escrowRef = this.db.collection("escrow_payments").doc(escrowId);
        const escrowDoc = await escrowRef.get();
        if (!escrowDoc.exists) {
            throw new Error("Escrow payment not found");
        }
        const escrow = escrowDoc.data();
        if (escrow.status !== "held") {
            throw new Error(`Cannot release escrow with status: ${escrow.status}`);
        }
        const providerPayout = escrow.providerPayoutCents
            ? (escrow.providerPayoutCents / 100).toFixed(2)
            : escrow.amount.toFixed(2);
        await escrowRef.update({
            status: "released",
            releasedAt: new Date(),
            releasedBy,
        });
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
    async refundEscrowPayment(escrowId, reason, refundedBy) {
        const escrowRef = this.db.collection("escrow_payments").doc(escrowId);
        const escrowDoc = await escrowRef.get();
        if (!escrowDoc.exists) {
            throw new Error("Escrow payment not found");
        }
        const escrow = escrowDoc.data();
        if (escrow.status !== "held") {
            throw new Error(`Cannot refund escrow with status: ${escrow.status}`);
        }
        await escrowRef.update({
            status: "refunded",
            refundedAt: new Date(),
            refundReason: reason,
            refundedBy,
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
    async disputeEscrowPayment(escrowId, disputeReason, disputedBy) {
        const escrowRef = this.db.collection("escrow_payments").doc(escrowId);
        const escrowDoc = await escrowRef.get();
        if (!escrowDoc.exists) {
            throw new Error("Escrow payment not found");
        }
        const escrow = escrowDoc.data();
        await escrowRef.update({
            status: "disputed",
            disputeReason,
            disputedBy,
            disputedAt: new Date(),
        });
        const adminNotification = {
            userId: "admin",
            type: "system",
            title: "🚨 Escrow Dispute",
            message: `Dispute filed for booking ${escrow.bookingId}. Amount: ₪${escrow.amount.toFixed(2)}`,
            priority: "high",
            channel: "all",
            data: { escrowId, bookingId: escrow.bookingId, reason: disputeReason },
        };
        console.log(`[Escrow] DISPUTE: ${escrowId} - Reason: ${disputeReason}`);
    }
    async getEscrowPayment(escrowId) {
        const doc = await this.db.collection("escrow_payments").doc(escrowId).get();
        return doc.exists ? doc.data() : null;
    }
    async getEscrowsByBooking(bookingId) {
        const snapshot = await this.db
            .collection("escrow_payments")
            .where("bookingId", "==", bookingId)
            .get();
        return snapshot.docs.map((doc) => doc.data());
    }
    async getExpiredHolds() {
        const now = new Date();
        const snapshot = await this.db
            .collection("escrow_payments")
            .where("status", "==", "held")
            .where("holdUntil", "<=", now)
            .get();
        return snapshot.docs.map((doc) => doc.data());
    }
    async autoReleaseExpiredHolds() {
        const expiredHolds = await this.getExpiredHolds();
        let releasedCount = 0;
        for (const escrow of expiredHolds) {
            try {
                await this.releaseEscrowPayment(escrow.id, "system_auto_release");
                releasedCount++;
            }
            catch (error) {
                console.error(`[Escrow] Failed to auto-release ${escrow.id}:`, error);
            }
        }
        if (releasedCount > 0) {
            console.log(`[Escrow] Auto-released ${releasedCount} expired holds`);
        }
        return releasedCount;
    }
    async getUserPayments(userId) {
        const snapshot = await this.db
            .collection("escrow_payments")
            .where("customerId", "==", userId)
            .orderBy("createdAt", "desc")
            .limit(50)
            .get();
        return snapshot.docs.map((doc) => doc.data());
    }
}
export default new EscrowService();
