/**
 * Conversion / Booking-Rescue API (CEO spec 2026-06-27).
 *   POST /api/intent              — public ingestion ("no dead clicks"); logged-in
 *                                   OR guest. Records the intent + upserts a lead.
 *   GET  /api/conversion/admin/leads — admin stuck-lead dashboard feed (§12).
 * Money-safe: only writes additive conversion_* tables. Must be CSRF-exempt in
 * server/index.ts (public anonymous POST).
 */
import { Router, type Request, type Response } from "express";
import { db } from "../db";
import { recordIntent } from "../services/ConversionLeadService";
import { conversionLeads, createIntentSchema } from "../../shared/schema-conversion";
import { requireAdmin } from "../adminAuth";
import { and, desc, eq } from "drizzle-orm";
import { logger } from "../lib/logger";

const router = Router();

// POST /api/intent — capture a started-but-stopped (or any) user intent.
router.post("/intent", async (req: Request, res: Response) => {
  try {
    const data = createIntentSchema.parse(req.body);
    const uid = (req as any).firebaseUser?.uid || (req as any).user?.uid || null;
    const guestId = uid
      ? null
      : (typeof req.body.guestId === "string" && req.body.guestId)
        || `guest_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

    const { leadId } = await recordIntent({
      ...data,
      userId: uid,
      guestId,
      sourcePage: data.sourcePage || (req.headers["referer"] as string | undefined),
      device: data.device || (req.headers["user-agent"] as string | undefined)?.slice(0, 120),
    });

    return res.status(201).json({ ok: true, leadId, guestId });
  } catch (e: any) {
    if (e?.name === "ZodError") return res.status(400).json({ error: "INVALID", details: e.errors });
    logger.error("[Conversion] intent capture failed", { error: e?.message });
    return res.status(500).json({ error: "INTENT_CAPTURE_FAILED" });
  }
});

// GET /api/conversion/admin/leads — stuck leads for the rescue dashboard.
router.get("/conversion/admin/leads", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { status, platform } = req.query as { status?: string; platform?: string };
    const conds = [];
    if (status) conds.push(eq(conversionLeads.status, status));
    if (platform) conds.push(eq(conversionLeads.platformKey, platform));
    const rows = await db.select().from(conversionLeads)
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(conversionLeads.score), desc(conversionLeads.lastActionAt))
      .limit(500);
    return res.json({ leads: rows, count: rows.length });
  } catch (e: any) {
    logger.error("[Conversion] admin leads failed", { error: e?.message });
    return res.status(500).json({ error: "LEADS_FETCH_FAILED" });
  }
});

export default router;
