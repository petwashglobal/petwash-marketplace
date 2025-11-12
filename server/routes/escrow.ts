import express from "express";
import EscrowService from "../services/EscrowService";
import { requireAuth } from "../customAuth";
import { requireAdmin } from "../adminAuth";

const router = express.Router();

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
    console.error("[Escrow] Error creating:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/:escrowId/release", requireAuth, async (req, res) => {
  try {
    const { escrowId } = req.params;
    const releasedBy = req.user!.uid;

    await EscrowService.releaseEscrowPayment(escrowId, releasedBy);
    res.json({ success: true });
  } catch (error: any) {
    console.error("[Escrow] Error releasing:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/:escrowId/refund", requireAuth, async (req, res) => {
  try {
    const { escrowId } = req.params;
    const { reason } = req.body;
    const refundedBy = req.user!.uid;

    await EscrowService.refundEscrowPayment(escrowId, reason, refundedBy);
    res.json({ success: true });
  } catch (error: any) {
    console.error("[Escrow] Error refunding:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/:escrowId/dispute", requireAuth, async (req, res) => {
  try {
    const { escrowId } = req.params;
    const { reason } = req.body;
    const disputedBy = req.user!.uid;

    await EscrowService.disputeEscrowPayment(escrowId, reason, disputedBy);
    res.json({ success: true });
  } catch (error: any) {
    console.error("[Escrow] Error disputing:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/payments", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.uid;
    const payments = await EscrowService.getUserPayments(userId);
    res.json({ payments });
  } catch (error: any) {
    console.error("[Escrow] Error fetching payments:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/:escrowId", requireAuth, async (req, res) => {
  try {
    const { escrowId } = req.params;
    const escrow = await EscrowService.getEscrowPayment(escrowId);
    res.json({ escrow });
  } catch (error: any) {
    console.error("[Escrow] Error fetching:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/booking/:bookingId", requireAuth, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const escrows = await EscrowService.getEscrowsByBooking(bookingId);
    res.json({ escrows });
  } catch (error: any) {
    console.error("[Escrow] Error fetching by booking:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/admin/auto-release", requireAdmin, async (req, res) => {
  try {
    const releasedCount = await EscrowService.autoReleaseExpiredHolds();
    res.json({ releasedCount });
  } catch (error: any) {
    console.error("[Escrow] Error auto-releasing:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
