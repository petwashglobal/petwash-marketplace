/**
 * PetWash™ Referral System API Routes
 * חבר מביא חבר - Friend Brings Friend
 *
 * REWRITTEN 2026-07-20 — every piece of state is now in Postgres.
 *
 * What this replaced: the whole file kept its state in in-process JavaScript Maps
 * (referralCodes / referrals / userCredits / userStats), under a comment that
 * admitted it — "IN-MEMORY STORAGE (Production: Use Firestore/PostgreSQL)". That
 * placeholder shipped, mounted at /api/referral, with a customer-facing
 * ReferralPage reading it. Consequences:
 *
 *   • A member's referral CODE was regenerated whenever the Map was empty, so
 *     links they had already shared silently stopped matching them after a deploy.
 *   • Referral records vanished on restart — attribution lost.
 *   • userCredits held real ₪25 balances that evaporated on every deploy. We
 *     deploy several times a day.
 *   • Those credits were never spendable anyway: plain numbers on an object,
 *     never in walletAccounts, never in the hash-chained ledger.
 *   • users.referred_by_code — which the booking flow READS — was never written,
 *     so referral attribution never fired at booking time either.
 *
 * Storage now: users.referral_code (the member's code), the referrals table (the
 * graph), referral_credits (the money owed). All pre-existing and unused, bar
 * referral_credits which migration 0099 adds.
 *
 * DESIGN: earning a credit records an OBLIGATION (status 'earned'); it does not
 * silently push ₪ into a wallet. Issuance is a separate audited step — the same
 * discipline as the refund rail. Be truthful about what is owed first, pay second.
 */

import { Router } from "express";
import { requireAuth } from "../customAuth";
import { logger } from "../lib/logger";
import { eventBus } from "../services/EventBus";
import {
  getOrCreateReferralCode,
  linkSignup,
  findPendingReferralForInvitee,
  completeReferral,
  totalEarnedIls,
  outstandingCreditIls,
  listReferrals,
  getStats,
  recordClick,
} from "../services/ReferralStore";

const router = Router();

// ============================================
// CONFIGURATION
// ============================================

const REFERRAL_CONFIG = {
  creditPerReferralILS: 25,
  minFirstPaymentILS: 20,
  dailyCapILS: 200,
  lifetimeCapILS: 1000,
  levels: {
    BRONZE: { minReferrals: 0, label: "ברונזה" },
    SILVER: { minReferrals: 5, label: "כסף" },
    GOLD: { minReferrals: 10, label: "זהב" },
    DIAMOND: { minReferrals: 25, label: "יהלום" },
  },
};

function calculateLevel(successfulReferrals: number): "BRONZE" | "SILVER" | "GOLD" | "DIAMOND" {
  if (successfulReferrals >= REFERRAL_CONFIG.levels.DIAMOND.minReferrals) return "DIAMOND";
  if (successfulReferrals >= REFERRAL_CONFIG.levels.GOLD.minReferrals) return "GOLD";
  if (successfulReferrals >= REFERRAL_CONFIG.levels.SILVER.minReferrals) return "SILVER";
  return "BRONZE";
}

/** Stats block in the shape the existing ReferralPage expects. */
async function buildStats(userId: string) {
  const s = await getStats(userId);
  return {
    totalInvites: s.totalInvites,
    successfulInvites: s.successfulInvites,
    pendingInvites: s.pendingInvites,
    totalCreditsGrantedILS: s.totalCreditsGrantedILS,
    levelId: calculateLevel(s.successfulInvites),
  };
}

function uid(req: any): string | undefined {
  return req.firebaseUser?.uid || req.user?.uid || req.userId;
}

// ============================================
// ROUTES
// ============================================

/** GET /api/referral/link — the member's shareable code + link + stats. */
router.get("/link", requireAuth, async (req: any, res) => {
  try {
    const userId = uid(req);
    if (!userId) return res.status(401).json({ error: "UNAUTHORIZED" });

    const referralCode = await getOrCreateReferralCode(userId);
    if (!referralCode) return res.status(500).json({ error: "CODE_UNAVAILABLE" });

    const baseUrl = process.env.REFERRAL_BASE_URL || "https://petwash.co.il";
    res.json({
      userId,
      referralCode,
      referralLink: `${baseUrl}/ref?code=${referralCode}`,
      stats: await buildStats(userId),
    });
  } catch (error) {
    logger.error("[Referral] Failed to get referral link", error);
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

/** POST /api/referral/register-click — someone opened a referral link. */
router.post("/register-click", async (req, res) => {
  try {
    const { referralCode, toEmail } = req.body ?? {};
    if (!referralCode) return res.status(400).json({ error: "MISSING_CODE" });

    const result = await recordClick(String(referralCode), toEmail ?? null);
    if (!result.ok) return res.status(404).json({ error: "INVALID_CODE" });

    res.json({ ok: true, referralCode: String(referralCode).toUpperCase() });
  } catch (error) {
    logger.error("[Referral] Failed to register click", error);
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

/** POST /api/referral/link-signup — attach a new signup to the inviter's code. */
router.post("/link-signup", async (req, res) => {
  try {
    const { referralCode, userId, email } = req.body ?? {};
    if (!referralCode || !userId) return res.status(400).json({ error: "MISSING_REQUIRED_FIELDS" });

    const result = await linkSignup({
      code: String(referralCode),
      inviteeUserId: String(userId),
      inviteeEmail: email ?? null,
    });

    if (!result.ok) {
      const status = result.reason === "UNKNOWN_CODE" ? 404 : 400;
      return res.status(status).json({ error: result.reason });
    }

    // Telemetry must never block a signup.
    Promise.resolve(
      eventBus.publish({
        eventType: "referral.signed_up",
        timestamp: new Date().toISOString(),
        platform: "referral",
        userId: String(userId),
        data: { referralId: result.referralId, code: String(referralCode).toUpperCase() },
      } as any),
    ).catch(() => {});

    res.json({ ok: true, referralId: result.referralId });
  } catch (error) {
    logger.error("[Referral] Failed to link signup", error);
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

/**
 * POST /api/referral/complete — the invitee made a qualifying first payment.
 * Admin-secret gated (unchanged), and now idempotent at the database level:
 * referral_credits has UNIQUE(referral_id, role), so a retry cannot double-credit.
 */
router.post("/complete", async (req, res) => {
  try {
    const adminSecret = req.headers["x-admin-secret"];
    if (!process.env.PETWASH_ADMIN_SECRET || adminSecret !== process.env.PETWASH_ADMIN_SECRET) {
      logger.warn("[Referral] Unauthorized /complete attempt", { ip: req.ip });
      return res.status(403).json({ error: "FORBIDDEN" });
    }

    const { userId, transactionId, amountILS } = req.body ?? {};
    if (!userId || !transactionId || amountILS == null) {
      return res.status(400).json({ error: "MISSING_REQUIRED_FIELDS" });
    }
    if (Number(amountILS) < REFERRAL_CONFIG.minFirstPaymentILS) {
      return res.status(400).json({
        error: "PAYMENT_TOO_SMALL",
        minRequired: REFERRAL_CONFIG.minFirstPaymentILS,
      });
    }

    const pending = await findPendingReferralForInvitee(String(userId));
    if (!pending) return res.status(404).json({ error: "NO_PENDING_REFERRAL" });

    const result = await completeReferral({
      referralId: Number(pending.id),
      inviterUserId: String(pending.inviter_user_id),
      inviteeUserId: String(userId),
      creditIls: REFERRAL_CONFIG.creditPerReferralILS,
      lifetimeCapIls: REFERRAL_CONFIG.lifetimeCapILS,
    });

    if (!result.ok) {
      const status = result.reason?.includes("CAP") ? 400 : 500;
      return res.status(status).json({ error: result.reason });
    }

    logger.info("[Referral] completed", {
      referralId: pending.id, transactionId, credited: result.credited,
    });

    res.json({
      ok: true,
      referralId: pending.id,
      creditedRoles: result.credited,
      creditPerReferralILS: REFERRAL_CONFIG.creditPerReferralILS,
      // Honest: the credit is RECORDED as owed, not yet spendable wallet money.
      creditStatus: "earned",
    });
  } catch (error) {
    logger.error("[Referral] Failed to complete referral", error);
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

/** GET /api/referral/history — the member's referrals. */
router.get("/history", requireAuth, async (req: any, res) => {
  try {
    const userId = uid(req);
    if (!userId) return res.status(401).json({ error: "UNAUTHORIZED" });

    const rows = await listReferrals(userId, 50);
    res.json({ referrals: rows, total: rows.length });
  } catch (error) {
    logger.error("[Referral] Failed to get history", error);
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

/** GET /api/referral/credits — what the member has earned and what is owed. */
router.get("/credits", requireAuth, async (req: any, res) => {
  try {
    const userId = uid(req);
    if (!userId) return res.status(401).json({ error: "UNAUTHORIZED" });

    const [totalEarnedILS, outstandingILS] = await Promise.all([
      totalEarnedIls(userId),
      outstandingCreditIls(userId),
    ]);

    res.json({
      // balanceILS keeps its name for the existing page, but now means what is
      // genuinely recorded as owed — not an in-memory number that resets.
      balanceILS: outstandingILS,
      totalEarnedILS,
      lifetimeCapILS: REFERRAL_CONFIG.lifetimeCapILS,
      remainingCapILS: Math.max(0, REFERRAL_CONFIG.lifetimeCapILS - totalEarnedILS),
      // Explicit, so no surface can imply this is already spendable balance.
      creditStatus: outstandingILS > 0 ? "earned_pending_issue" : "none",
    });
  } catch (error) {
    logger.error("[Referral] Failed to get credits", error);
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

/** GET /api/referral/admin/overview — programme totals. */
router.get("/admin/overview", async (req, res) => {
  try {
    const adminSecret = req.headers["x-admin-secret"];
    if (!process.env.PETWASH_ADMIN_SECRET || adminSecret !== process.env.PETWASH_ADMIN_SECRET) {
      return res.status(403).json({ error: "FORBIDDEN" });
    }

    const { db } = await import("../db");
    const { sql } = await import("drizzle-orm");
    const r: any = await (db as any).execute(sql`
      SELECT
        (SELECT COUNT(*)::int FROM referrals)                                          AS total_referrals,
        (SELECT COUNT(*)::int FROM referrals WHERE status = 'completed')               AS completed_referrals,
        (SELECT COUNT(*)::int FROM referrals WHERE status IN ('pending','signed_up'))  AS pending_referrals,
        (SELECT COALESCE(SUM(amount_ils),0) FROM referral_credits WHERE status <> 'void')   AS total_credits_ils,
        (SELECT COALESCE(SUM(amount_ils),0) FROM referral_credits WHERE status = 'earned')  AS outstanding_credits_ils
    `);
    const row: any = r?.rows?.[0] ?? r?.[0] ?? {};

    res.json({
      totalReferrals: Number(row.total_referrals ?? 0),
      completedReferrals: Number(row.completed_referrals ?? 0),
      pendingReferrals: Number(row.pending_referrals ?? 0),
      totalCreditsILS: Number(row.total_credits_ils ?? 0),
      outstandingCreditsILS: Number(row.outstanding_credits_ils ?? 0),
      config: REFERRAL_CONFIG,
    });
  } catch (error) {
    logger.error("[Referral] Failed to get admin overview", error);
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

export default router;
export { REFERRAL_CONFIG, calculateLevel };
