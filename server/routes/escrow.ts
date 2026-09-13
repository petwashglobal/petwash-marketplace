import express from "express";
import EscrowService, { type EscrowPayment } from "../services/EscrowService";
import { requireAuth } from "../customAuth";
import { requireAdmin } from "../adminAuth";
import { logger } from "../lib/logger";
import { clientSafeErrorMessage } from "../lib/sanitizeErrorResponse";
import { sendSanitizedError } from "../lib/sanitizeErrorResponse";
import { logReceipt, appendFormSubmission, logOpsLiveFeed } from "../services/googleSheetsIntegration";
import { db } from "../db";
import { bookingDisputes, users } from "@shared/schema";
import { and, eq, inArray } from "drizzle-orm";

/**
 * Customer payment-history DTO — the shape client dashboards
 * (sitter-suite/OwnerDashboard, walk-my-pet/OwnerDashboard,
 * academy/OwnerDashboard) rely on.
 *
 * The raw EscrowPayment shape (see EscrowService.ts:39) uses a
 * Firestore-oriented status enum (held / released / refunded /
 * disputed) and does not carry a provider display name. If we returned
 * it raw, the client reads `payment.date` (undefined → "Invalid Date"),
 * `payment.sitterName` (undefined → blank), and the `totalSpent`
 * accumulator only counts status === 'completed' → always ₪0. Every
 * customer sees a broken Payments tab.
 *
 * Rules:
 *   held      → 'pending'   (money is out of the card, not yet released)
 *   released  → 'completed' (paid out to the provider)
 *   refunded  → 'refunded'
 *   disputed  → 'pending'   (money still held while resolution runs)
 *
 * providerName is looked up via a single batched IN query against
 * users.firstName / users.lastName. Missing rows fall back to '—'.
 */
interface CustomerPaymentDTO {
  id: string;
  bookingId: string;
  amount: number;
  currency: 'ILS' | 'USD' | 'EUR';
  /** ISO string — safe for `new Date(dto.date)` on the client. */
  date: string;
  status: 'pending' | 'completed' | 'refunded';
  providerName: string;
}

function mapEscrowStatus(raw: EscrowPayment['status']): CustomerPaymentDTO['status'] {
  if (raw === 'released') return 'completed';
  if (raw === 'refunded') return 'refunded';
  // 'held' + 'disputed' both = money-out-of-customer-card but not yet
  // finalised. Surfaces as pending on the customer's Payments tab.
  return 'pending';
}

async function projectCustomerPayments(userId: string): Promise<CustomerPaymentDTO[]> {
  const raw = await EscrowService.getUserPayments(userId);
  if (raw.length === 0) return [];

  const providerUids = Array.from(new Set(raw.map((p) => p.providerId).filter(Boolean)));
  const nameByUid = new Map<string, string>();
  if (providerUids.length > 0) {
    try {
      const rows = await db
        .select({
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
        })
        .from(users)
        .where(inArray(users.id, providerUids));
      for (const r of rows) {
        const name = `${r.firstName ?? ''} ${r.lastName ?? ''}`.trim();
        nameByUid.set(r.id, name);
      }
    } catch (err: any) {
      // Fresh env or missing users row — every payment falls back to '—'
      // so the tab still renders instead of 500'ing.
      logger.warn('[Escrow] Provider-name join failed; falling back', { error: err?.message });
    }
  }

  return raw.map((p) => {
    const iso =
      p.createdAt instanceof Date
        ? p.createdAt.toISOString()
        : typeof (p.createdAt as any)?.toDate === 'function'
        ? (p.createdAt as any).toDate().toISOString()
        : String(p.createdAt ?? '');
    return {
      id: p.id,
      bookingId: p.bookingId,
      amount: Number(p.amount ?? 0),
      currency: (p.currency ?? 'ILS') as CustomerPaymentDTO['currency'],
      date: iso,
      status: mapEscrowStatus(p.status),
      providerName: nameByUid.get(p.providerId) || '—',
    };
  });
}

const SHEETS_DISPUTE_CASES = 'Dispute Cases';

const router = express.Router();

async function assertEscrowParticipant(
  escrowId: string,
  callerId: string
): Promise<EscrowPayment> {
  const escrow = await EscrowService.getEscrowPayment(escrowId);
  if (!escrow) {
    const err: any = new Error("Escrow not found");
    err.status = 404;
    throw err;
  }
  if (escrow.customerId !== callerId && escrow.providerId !== callerId) {
    logger.warn("[Escrow] Unauthorized access attempt", {
      escrowId,
      callerId,
      customerId: escrow.customerId,
      providerId: escrow.providerId,
    });
    const err: any = new Error("Forbidden: you are not a party to this escrow");
    err.status = 403;
    throw err;
  }
  return escrow;
}

router.post("/create", requireAuth, async (req, res) => {
  try {
    const { bookingId, providerId, amount, nayaxTransactionId, metadata } = req.body;
    const customerId = req.user!.uid;

    const escrow = await EscrowService.createEscrowPayment(
      bookingId,
      customerId,
      providerId,
      amount,
      nayaxTransactionId,
      metadata
    );

    res.json({ escrow });
  } catch (error: any) {
    logger.error("[Escrow] Error creating", { error: error.message });
    res.status(error.status ?? 500).json({ error: clientSafeErrorMessage(error, "Could not create the escrow hold.") });
  }
});

router.post("/:escrowId/release", requireAuth, async (req, res) => {
  try {
    const { escrowId } = req.params;
    const callerId = req.user!.uid;

    const escrow = await assertEscrowParticipant(escrowId, callerId);

    if (escrow.customerId !== callerId) {
      return res.status(403).json({
        error: "Only the customer who created this escrow can release it",
      });
    }

    await EscrowService.releaseEscrowPayment(escrowId, callerId);
    res.json({ success: true });

    // ── Fire-and-forget: Sheets receipt + live feed ────────────────────────
    setImmediate(() => {
      const amountStr = String(escrow.amount || '');
      Promise.all([
        logReceipt({
          receiptId: `escrow-release-${escrowId}`,
          transactionId: escrow.nayaxTransactionId || escrowId,
          customerName: '',
          email: '',
          amount: amountStr,
          paymentMethod: 'Escrow Release',
          platform: 'PetWash',
          serviceType: 'Escrow',
          description: `Escrow released — booking ${escrow.bookingId}`,
          status: 'Released',
        }),
        logOpsLiveFeed({
          eventType: 'escrow.released',
          source: 'escrow_route',
          entityId: escrowId,
          bookingId: escrow.bookingId,
          amountILS: amountStr,
          platform: 'PetWash',
          status: 'released',
          actor: callerId,
          details: `customer released escrow to provider`,
        }),
      ]).catch(e => logger.warn('[Escrow] Sheets logging error (non-blocking)', e));
    });
  } catch (error: any) {
    logger.error("[Escrow] Error releasing", { error: error.message });
    res.status(error.status ?? 500).json({ error: clientSafeErrorMessage(error, "Could not release the escrow hold.") });
  }
});

router.post("/:escrowId/refund", requireAuth, async (req, res) => {
  try {
    const { escrowId } = req.params;
    const { reason } = req.body;
    const callerId = req.user!.uid;

    const escrow = await assertEscrowParticipant(escrowId, callerId);

    await EscrowService.refundEscrowPayment(escrowId, reason, callerId);
    res.json({ success: true });

    // ── Fire-and-forget: Sheets receipt + live feed ────────────────────────
    setImmediate(() => {
      const amountStr = String(escrow.amount || '');
      Promise.all([
        logReceipt({
          receiptId: `escrow-refund-${escrowId}`,
          transactionId: escrow.nayaxTransactionId || escrowId,
          customerName: '',
          email: '',
          amount: amountStr,
          paymentMethod: 'Escrow Refund',
          platform: 'PetWash',
          serviceType: 'Escrow',
          description: `Escrow refunded — booking ${escrow.bookingId}${reason ? ` — ${reason}` : ''}`,
          status: 'Refunded',
        }),
        logOpsLiveFeed({
          eventType: 'escrow.refunded',
          source: 'escrow_route',
          entityId: escrowId,
          bookingId: escrow.bookingId,
          amountILS: amountStr,
          platform: 'PetWash',
          status: 'refunded',
          actor: callerId,
          details: reason || 'escrow refunded to customer',
        }),
      ]).catch(e => logger.warn('[Escrow] Sheets logging error (non-blocking)', e));
    });
  } catch (error: any) {
    logger.error("[Escrow] Error refunding", { error: error.message });
    res.status(error.status ?? 500).json({ error: clientSafeErrorMessage(error, "Could not refund the escrow hold.") });
  }
});

router.post("/:escrowId/dispute", requireAuth, async (req, res) => {
  try {
    const { escrowId } = req.params;
    const { reason } = req.body;
    const callerId = req.user!.uid;

    const escrow = await assertEscrowParticipant(escrowId, callerId);

    await EscrowService.disputeEscrowPayment(escrowId, reason, callerId);

    // Cross-rail dispute visibility (2026-07-08): the Firestore freeze inside
    // disputeEscrowPayment (autoReleaseBlocked) only stops the ESCROW rail's
    // auto-release. The SQL payout gate (payoutGate.ts gate (d)) reads
    // booking_disputes ONLY — so the parallel contractor_earnings /
    // super_app_payouts for the SAME booking would still auto-release after the
    // refund window. Mirror the dispute into booking_disputes so EVERY payout
    // rail holds. Non-fatal (the Firestore freeze already protects escrow) and
    // de-duped so re-filing doesn't pile up rows.
    try {
      if (escrow.bookingId) {
        const [existing] = await db
          .select({ id: bookingDisputes.id })
          .from(bookingDisputes)
          .where(and(
            eq(bookingDisputes.bookingId, String(escrow.bookingId)),
            eq(bookingDisputes.status, 'open'),
          ))
          .limit(1);
        if (!existing) {
          await db.insert(bookingDisputes).values({
            bookingId: String(escrow.bookingId),
            customerId: String(escrow.customerId),
            reason: 'escrow_dispute',
            description: typeof reason === 'string' ? reason.slice(0, 1000) : null,
            status: 'open',
          });
        }
      }
    } catch (e: any) {
      logger.warn('[Escrow] Failed to mirror dispute into booking_disputes (non-fatal)', {
        escrowId, bookingId: escrow.bookingId, error: e?.message,
      });
    }

    res.json({ success: true });

    // ── Fire-and-forget: Dispute cases sheet + live feed ──────────────────
    setImmediate(() => {
      const amountStr = String(escrow.amount || '');
      Promise.all([
        appendFormSubmission(SHEETS_DISPUTE_CASES, {
          caseId: `escrow-dispute-${escrowId}`,
          bookingId: escrow.bookingId,
          customerId: escrow.customerId,
          providerId: escrow.providerId,
          serviceType: 'Escrow',
          amountInDispute: amountStr,
          customerClaim: reason || '',
          providerResponse: '',
          evidenceUrls: '',
          assignedTo: '',
          status: 'Open',
          resolution: '',
          resolutionDate: '',
          compensation: '',
          notes: `Dispute raised by ${callerId}`,
        }),
        logOpsLiveFeed({
          eventType: 'escrow.disputed',
          source: 'escrow_route',
          entityId: escrowId,
          bookingId: escrow.bookingId,
          amountILS: amountStr,
          platform: 'PetWash',
          status: 'disputed',
          actor: callerId,
          details: reason || 'escrow dispute opened',
        }),
      ]).catch(e => logger.warn('[Escrow] Sheets logging error (non-blocking)', e));
    });
  } catch (error: any) {
    logger.error("[Escrow] Error disputing", { error: error.message });
    res.status(error.status ?? 500).json({ error: clientSafeErrorMessage(error, "Could not open a dispute for this escrow hold.") });
  }
});

router.get("/payments", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.uid;
    // Returns the CustomerPaymentDTO shape the client dashboards read
    // (`{ id, bookingId, amount, currency, date, status, providerName }`),
    // NOT the raw Firestore EscrowPayment shape. The raw shape's status
    // enum (held/released/refunded/disputed) never matched the client's
    // completed/pending/refunded expectation — every row's stat card
    // showed ₪0 and every row rendered "Invalid Date" + blank name.
    const payments = await projectCustomerPayments(userId);
    res.json({ payments });
  } catch (error: any) {
    sendSanitizedError(res, error, 'ESCROW_FETCH_PAYMENTS_FAILED', { logContext: { op: 'fetch-payments' } });
  }
});

router.get("/:escrowId", requireAuth, async (req, res) => {
  try {
    const { escrowId } = req.params;
    const callerId = req.user!.uid;

    const escrow = await assertEscrowParticipant(escrowId, callerId);
    res.json({ escrow });
  } catch (error: any) {
    logger.error("[Escrow] Error fetching", { error: error.message });
    res.status(error.status ?? 500).json({ error: clientSafeErrorMessage(error, "Could not load the escrow hold.") });
  }
});

router.get("/booking/:bookingId", requireAuth, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const callerId = req.user!.uid;

    const escrows = await EscrowService.getEscrowsByBooking(bookingId);

    const permitted = escrows.filter(
      (e) => e.customerId === callerId || e.providerId === callerId
    );

    res.json({ escrows: permitted });
  } catch (error: any) {
    sendSanitizedError(res, error, 'ESCROW_FETCH_BY_BOOKING_FAILED', { logContext: { op: 'fetch-by-booking' } });
  }
});

/**
 * THE HUMAN "YES" (CEO rule, 2026-09-13). A Pet Wash admin approves ONE escrow
 * after checking the job evidence. The payout gates still run (disputes,
 * refund window, provider verification, declarations).
 */
router.post("/admin/:escrowId/approve-release", requireAdmin, async (req, res) => {
  try {
    const adminUid = (req as any).firebaseUser?.uid || (req as any).user?.uid || (req as any).adminUser?.uid;
    if (!adminUid) return res.status(401).json({ error: "ADMIN_IDENTITY_REQUIRED" });
    const reason = typeof req.body?.reason === "string" ? req.body.reason.trim().slice(0, 500) : "";
    if (!reason) return res.status(400).json({ error: "REASON_REQUIRED", message: "Say what evidence you checked." });
    await EscrowService.releaseEscrowPayment(req.params.escrowId, adminUid);
    logger.info("[Escrow] admin approved provider payout release", { escrowId: req.params.escrowId, adminUid, reason });
    try {
      const { resolveClearedByPrefix } = await import("../services/AlertEngine");
      await resolveClearedByPrefix(`payout_review:escrow:${req.params.escrowId}`, []);
    } catch { /* alert housekeeping only */ }
    res.json({ success: true });
  } catch (error: any) {
    if (error?.code === "PAYOUT_HELD_GATE") {
      // Never echo error.message here: the gate error is thrown from more than
      // one place and the other shapes embed internal detail (payoutLedger
      // appends the gate text and the earning id). `gateReason` is the stable
      // machine code the admin UI switches on, so the response stays structured
      // while the full error stays server-side. Pinned by
      // server/tests/customerErrorLeakSweep.regression.test.ts.
      logger.warn("[Escrow] admin release blocked by payout gate", {
        escrowId: req.params.escrowId,
        gateReason: error.gateReason,
        error: error?.message,
      });
      return res.status(409).json({ error: "PAYOUT_HELD_GATE", reason: error.gateReason });
    }
    sendSanitizedError(res, error, "ESCROW_ADMIN_APPROVE_FAILED", { logContext: { op: "admin-approve-release" } });
  }
});

router.post("/admin/auto-release", requireAdmin, async (req, res) => {
  try {
    const releasedCount = await EscrowService.autoReleaseExpiredHolds();
    res.json({ releasedCount });
  } catch (error: any) {
    sendSanitizedError(res, error, 'ESCROW_AUTO_RELEASE_FAILED', { logContext: { op: 'auto-release' } });
  }
});

export default router;
