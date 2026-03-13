import express from "express";
import EscrowService, { type EscrowPayment } from "../services/EscrowService";
import { requireAuth } from "../customAuth";
import { requireAdmin } from "../adminAuth";
import { logger } from "../lib/logger";

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
    res.status(error.status ?? 500).json({ error: error.message });
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
  } catch (error: any) {
    logger.error("[Escrow] Error releasing", { error: error.message });
    res.status(error.status ?? 500).json({ error: error.message });
  }
});

router.post("/:escrowId/refund", requireAuth, async (req, res) => {
  try {
    const { escrowId } = req.params;
    const { reason } = req.body;
    const callerId = req.user!.uid;

    await assertEscrowParticipant(escrowId, callerId);

    await EscrowService.refundEscrowPayment(escrowId, reason, callerId);
    res.json({ success: true });
  } catch (error: any) {
    logger.error("[Escrow] Error refunding", { error: error.message });
    res.status(error.status ?? 500).json({ error: error.message });
  }
});

router.post("/:escrowId/dispute", requireAuth, async (req, res) => {
  try {
    const { escrowId } = req.params;
    const { reason } = req.body;
    const callerId = req.user!.uid;

    await assertEscrowParticipant(escrowId, callerId);

    await EscrowService.disputeEscrowPayment(escrowId, reason, callerId);
    res.json({ success: true });
  } catch (error: any) {
    logger.error("[Escrow] Error disputing", { error: error.message });
    res.status(error.status ?? 500).json({ error: error.message });
  }
});

router.get("/payments", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.uid;
    const payments = await EscrowService.getUserPayments(userId);
    res.json({ payments });
  } catch (error: any) {
    logger.error("[Escrow] Error fetching payments", { error: error.message });
    res.status(500).json({ error: error.message });
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
    res.status(error.status ?? 500).json({ error: error.message });
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
    logger.error("[Escrow] Error fetching by booking", { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

router.post("/admin/auto-release", requireAdmin, async (req, res) => {
  try {
    const releasedCount = await EscrowService.autoReleaseExpiredHolds();
    res.json({ releasedCount });
  } catch (error: any) {
    logger.error("[Escrow] Error auto-releasing", { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

export default router;
