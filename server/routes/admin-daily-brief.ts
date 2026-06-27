/**
 * Admin AI Daily Brief (CEO Trend Bible §20) — GET /api/admin/daily-brief.
 * Read-only "what's stuck / valuable / recoverable today" for the admin home.
 * requireAdmin (defence-in-depth on top of the global /api/admin gate).
 */
import { Router, type Request, type Response } from "express";
import { buildDailyBrief } from "../services/AdminDailyBriefService";
import { requireAdmin } from "../adminAuth";
import { logger } from "../lib/logger";

const router = Router();

router.get("/", requireAdmin, async (_req: Request, res: Response) => {
  try {
    const brief = await buildDailyBrief();
    return res.json(brief);
  } catch (e: any) {
    logger.error("[DailyBrief] build failed", { error: e?.message });
    return res.status(500).json({ wired: false, error: "DAILY_BRIEF_FAILED", reason: e?.message });
  }
});

export default router;
