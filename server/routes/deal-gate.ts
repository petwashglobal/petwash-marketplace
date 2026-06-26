/**
 * Deal Gate API (CEO master spec 2026-06-27) — read-only surface for the validator
 * and the money-flag snapshot. The live confirm/cancel/pay routes call the
 * DealGateService directly; this router exposes the decision to the frontend and
 * admin so the UI never confirms a booking the backend says is not confirmable.
 */
import { Router, type Request, type Response } from "express";
import { canConfirmBooking } from "../services/DealGateService";
import { dealGateFlagSnapshot } from "../config/dealGateFlags";
import { requireAdmin } from "../adminAuth";
import { logger } from "../lib/logger";

const router = Router();

// GET /api/deal-gate/:bookingId/can-confirm — read-only Deal Gate decision (§G).
router.get("/:bookingId/can-confirm", async (req: Request, res: Response) => {
  const uid = (req as any).firebaseUser?.uid || (req as any).user?.uid;
  if (!uid) return res.status(401).json({ error: "AUTH_REQUIRED" });
  try {
    const result = await canConfirmBooking(req.params.bookingId);
    return res.json(result);
  } catch (e: any) {
    logger.error("[DealGate] can-confirm failed", { bookingId: req.params.bookingId, error: e?.message });
    return res.status(500).json({ error: "DEAL_GATE_CHECK_FAILED" });
  }
});

// GET /api/deal-gate/admin/flags — which money actions are live vs shadow (admin).
router.get("/admin/flags", requireAdmin, async (_req: Request, res: Response) => {
  return res.json({ flags: dealGateFlagSnapshot(), note: "false = recorded in shadow mode, no live money moved" });
});

export default router;
