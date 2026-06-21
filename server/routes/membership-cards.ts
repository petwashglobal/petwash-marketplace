/**
 * Membership credential routes.
 *
 *   GET  /api/membership/card              — get-or-create the caller's card
 *   GET  /api/membership/verify/:token     — scan-to-verify (station / app reader)
 *   POST /api/admin/membership/:userId/... — freeze / regenerate / link Nayax
 *
 * The public QR encodes https://petwash.co.il/m/{token}; that path is wired in
 * server/routes.ts to call the same verify logic.
 */
import { Router } from "express";
import type { Request, Response } from "express";
import { requireAuth } from "../customAuth";
import { requireAdmin } from "../adminAuth";
import { MembershipCardService } from "../services/MembershipCardService";
import { logger } from "../lib/logger";

const router = Router();

/** The member's own card (creates it on first call) — feeds the dashboard + wallet pass. */
router.get("/card", requireAuth, async (req: Request, res: Response) => {
  try {
    const uid = (req as any).user?.uid;
    if (!uid) return res.status(401).json({ error: "Authentication required" });
    const tier = ((req as any).user?.loyaltyTier as string | undefined) || "standard";
    const card = await MembershipCardService.getOrCreateCard(uid, tier as any);
    res.json({
      ok: true,
      memberId: card.memberId,
      cardNumberDisplay: card.cardNumberDisplay,
      barcodeValue: card.barcodeValue,
      qrUrl: `https://petwash.co.il/m/${card.qrToken}`,
      tier: card.tier,
      status: card.cardStatus,
      validUntil: card.validUntil,
      washCredits: card.washCreditBalance,
      loyaltyPoints: card.loyaltyPoints,
    });
  } catch (err: any) {
    logger.error("[Membership] card error", { error: err?.message });
    res.status(500).json({ error: "Could not load membership card" });
  }
});

/** Scan-to-verify — used by a station/app reader. Public (token is the credential). */
router.get("/verify/:token", async (req: Request, res: Response) => {
  const scanType = (req.query.type as "qr" | "barcode" | "nfc") || "qr";
  const stationId = (req.query.stationId as string) || null;
  const providerId = (req.query.providerId as string) || null;
  const result = await MembershipCardService.verifyScan({
    token: req.params.token,
    scanType,
    stationId,
    providerId,
  });
  // 200 on approve, 410 on expired, 403 on rejected/suspicious — but always JSON.
  const code = result.ok ? 200 : result.status === "expired" ? 410 : 403;
  res.status(code).json(result);
});

export const membershipAdminRouter = Router();

membershipAdminRouter.post("/:userId/freeze", requireAdmin, async (req: Request, res: Response) => {
  await MembershipCardService.setStatus(req.params.userId, "frozen", req.body?.reason);
  res.json({ ok: true, status: "frozen" });
});
membershipAdminRouter.post("/:userId/unfreeze", requireAdmin, async (req: Request, res: Response) => {
  await MembershipCardService.setStatus(req.params.userId, "active");
  res.json({ ok: true, status: "active" });
});
membershipAdminRouter.post("/:userId/regenerate-qr", requireAdmin, async (req: Request, res: Response) => {
  const qrToken = await MembershipCardService.regenerateQr(req.params.userId);
  res.json({ ok: true, qrUrl: `https://petwash.co.il/m/${qrToken}` });
});
membershipAdminRouter.post("/:userId/regenerate-barcode", requireAdmin, async (req: Request, res: Response) => {
  const barcodeValue = await MembershipCardService.regenerateBarcode(req.params.userId);
  res.json({ ok: true, barcodeValue });
});
membershipAdminRouter.post("/:userId/link-nayax", requireAdmin, async (req: Request, res: Response) => {
  await MembershipCardService.linkNayax(req.params.userId, req.body?.nayaxCustomerId, req.body?.nayaxCardId);
  res.json({ ok: true });
});

export default router;
