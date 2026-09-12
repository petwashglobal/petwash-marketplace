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
import { MembershipCardService, cardTierFromMemberTier } from "../services/MembershipCardService";
import { resolveMemberTier } from "../lib/memberTier";
import { db } from "../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";
import { buildMembershipCardPdf, printBatchCsvRow, PRINT_BATCH_CSV_HEADER, type PrintableCard } from "../services/MembershipCardPrintService";
import { membershipCards } from "@shared/schema-membership-cards";
import { desc } from "drizzle-orm";

async function printableCardForUser(userId: string): Promise<PrintableCard | null> {
  const [card] = await db.select().from(membershipCards).where(eq(membershipCards.userId, userId)).limit(1);
  if (!card) return null;
  const [u] = await db.select({ firstName: users.firstName, lastName: users.lastName, email: users.email }).from(users).where(eq(users.id, userId)).limit(1);
  const ownerName = [u?.firstName, u?.lastName].filter(Boolean).join(" ") || u?.email || "PetWash Member";
  return {
    memberId: card.memberId,
    cardNumberDisplay: card.cardNumberDisplay,
    ownerName,
    tier: card.tier,
    validUntil: card.validUntil ?? null,
    qrUrl: `https://petwash.co.il/m/${card.qrToken}`,
    barcodeValue: card.barcodeValue,
  };
}

const router = Router();

/** The member's own card (creates it on first call) — feeds the dashboard + wallet pass. */
router.get("/card", requireAuth, async (req: Request, res: Response) => {
  try {
    const uid = (req as any).user?.uid;
    if (!uid) return res.status(401).json({ error: "Authentication required" });
    // requireAuth sets req.user = { uid, email } only — `loyaltyTier` was never
    // there, so every card was issued "standard" (audit 2026-09-12). Resolve the
    // canonical member tier from the user row + Prestige enrolment instead.
    const [u] = await db.select({ loyaltyTier: users.loyaltyTier, email: users.email }).from(users).where(eq(users.id, uid)).limit(1);
    const memberTier = await resolveMemberTier((u as any)?.loyaltyTier, (u as any)?.email ?? (req as any).user?.email);
    const tier = cardTierFromMemberTier(memberTier);
    const card = await MembershipCardService.getOrCreateCard(uid, tier);
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
/** The member's own card as the CR-80 print file (front + back). */
router.get("/card/print.pdf", requireAuth, async (req: Request, res: Response) => {
  try {
    const uid = (req as any).user?.uid;
    if (!uid) return res.status(401).json({ error: "Authentication required" });
    await MembershipCardService.getOrCreateCard(uid);
    const card = await printableCardForUser(uid);
    if (!card) return res.status(404).json({ error: "CARD_NOT_FOUND" });
    const pdf = await buildMembershipCardPdf(card);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="petwash-card-${card.memberId}.pdf"`);
    res.setHeader("Cache-Control", "no-store, private");
    return res.send(pdf);
  } catch (err: any) {
    logger.error("[Membership] print error", { error: err?.message });
    return res.status(500).json({ error: "PRINT_FAILED" });
  }
});

/** Lost card: the member voids their own printed codes (QR + barcode rotate, pass version bumps). */
router.post("/card/report-lost", requireAuth, async (req: Request, res: Response) => {
  try {
    const uid = (req as any).user?.uid;
    if (!uid) return res.status(401).json({ error: "Authentication required" });
    await MembershipCardService.getOrCreateCard(uid);
    const r = await MembershipCardService.reportLost(uid);
    return res.json({ ok: true, status: "lost", qrUrl: `https://petwash.co.il/m/${r.qrToken}`, barcodeValue: r.barcodeValue });
  } catch (err: any) {
    logger.error("[Membership] report-lost error", { error: err?.message });
    return res.status(500).json({ error: "REPORT_LOST_FAILED" });
  }
});

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

/** Print file for ONE member's physical card (CR-80 front + back). */
membershipAdminRouter.get("/:userId/print.pdf", requireAdmin, async (req: Request, res: Response) => {
  const card = await printableCardForUser(req.params.userId);
  if (!card) return res.status(404).json({ ok: false, error: "CARD_NOT_FOUND" });
  const pdf = await buildMembershipCardPdf(card);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="petwash-card-${card.memberId}.pdf"`);
  res.setHeader("Cache-Control", "no-store, private");
  return res.send(pdf);
});
/** Print-bureau batch: one CSV row per active card (newest first, max 5000). */
membershipAdminRouter.get("/print-batch.csv", requireAdmin, async (_req: Request, res: Response) => {
  const rows = await db.select({ userId: membershipCards.userId }).from(membershipCards).where(eq(membershipCards.cardStatus, "active")).orderBy(desc(membershipCards.id)).limit(5000);
  const lines = [PRINT_BATCH_CSV_HEADER];
  for (const r of rows) {
    const card = await printableCardForUser(r.userId);
    if (card) lines.push(printBatchCsvRow(card));
  }
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="petwash-cards-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.setHeader("Cache-Control", "no-store, private");
  return res.send("\ufeff" + lines.join("\n") + "\n");
});

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
