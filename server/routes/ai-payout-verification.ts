/**
 * AI Payout Verification Routes
 * 
 * Gemini 2.5 Flash-powered verification endpoints
 * for subcontractor work quality before payouts
 */

import { Router } from "express";
import { AIPayoutVerificationService } from "../services/AIPayoutVerificationService";
import { ProviderPayoutService } from "../services/ProviderPayoutService";
import { db } from "../db";
import { superAppPayouts } from "@shared/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import { logger } from "../lib/logger";

const router = Router();

/**
 * POST /api/ai-verification/verify/:payoutId
 * Trigger AI verification for a specific payout
 */
router.post("/verify/:payoutId", async (req, res) => {
  try {
    const { payoutId } = req.params;

    if (!payoutId) {
      return res.status(400).json({
        success: false,
        error: "Payout ID is required",
      });
    }

    logger.info("[AI Verification] Manual verification request", { payoutId });

    const result = await AIPayoutVerificationService.verifyWorkForPayout(payoutId);

    res.json({
      success: true,
      verification: {
        verificationId: result.verificationId,
        verified: result.verified,
        confidenceScore: result.confidenceScore,
        riskLevel: result.riskLevel,
        checks: result.checks,
        issues: result.issues,
        recommendations: result.recommendations,
        aiAnalysis: result.aiAnalysis,
        verifiedAt: result.verifiedAt,
      },
    });
  } catch (error) {
    logger.error("[AI Verification] Verification failed", { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Verification failed",
    });
  }
});

/**
 * GET /api/ai-verification/status/:payoutId
 * Get AI verification status for a payout
 */
router.get("/status/:payoutId", async (req, res) => {
  try {
    const { payoutId } = req.params;

    const [payout] = await db.select()
      .from(superAppPayouts)
      .where(eq(superAppPayouts.id, payoutId))
      .limit(1);

    if (!payout) {
      return res.status(404).json({
        success: false,
        error: "Payout not found",
      });
    }

    res.json({
      success: true,
      payoutId: payout.id,
      status: payout.status,
      aiVerification: {
        verified: payout.aiVerified,
        score: payout.aiVerificationScore,
        verificationId: payout.aiVerificationId,
        riskLevel: payout.aiRiskLevel,
        notes: payout.aiVerificationNotes,
        verifiedAt: payout.aiVerifiedAt,
      },
    });
  } catch (error) {
    logger.error("[AI Verification] Status check failed", { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Status check failed",
    });
  }
});

/**
 * POST /api/ai-verification/batch
 * Batch verify all pending payouts
 */
router.post("/batch", async (req, res) => {
  try {
    logger.info("[AI Verification] Starting batch verification");

    const result = await AIPayoutVerificationService.batchVerifyPendingPayouts();

    res.json({
      success: true,
      results: {
        verified: result.verified,
        failed: result.failed,
        flagged: result.flagged,
        total: result.verified + result.failed + result.flagged,
      },
    });
  } catch (error) {
    logger.error("[AI Verification] Batch verification failed", { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Batch verification failed",
    });
  }
});

/**
 * GET /api/ai-verification/pending
 * Get payouts pending AI verification
 */
router.get("/pending", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;

    const pendingPayouts = await db.select()
      .from(superAppPayouts)
      .where(
        and(
          eq(superAppPayouts.status, 'in_escrow'),
          sql`${superAppPayouts.aiVerified} IS NULL`
        )
      )
      .orderBy(desc(superAppPayouts.createdAt))
      .limit(limit);

    res.json({
      success: true,
      count: pendingPayouts.length,
      payouts: pendingPayouts.map(p => ({
        id: p.id,
        providerId: p.providerId,
        bookingId: p.bookingId,
        amount: p.amount,
        netAmount: p.netAmount,
        currency: p.currency,
        escrowReleaseDate: p.escrowReleaseDate,
        createdAt: p.createdAt,
      })),
    });
  } catch (error) {
    logger.error("[AI Verification] Failed to get pending payouts", { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to get pending payouts",
    });
  }
});

/**
 * GET /api/ai-verification/flagged
 * Get payouts flagged by AI verification (failed or high risk)
 */
router.get("/flagged", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;

    const flaggedPayouts = await db.select()
      .from(superAppPayouts)
      .where(
        sql`${superAppPayouts.aiVerified} = false OR ${superAppPayouts.aiRiskLevel} IN ('high', 'critical')`
      )
      .orderBy(desc(superAppPayouts.createdAt))
      .limit(limit);

    res.json({
      success: true,
      count: flaggedPayouts.length,
      payouts: flaggedPayouts.map(p => ({
        id: p.id,
        providerId: p.providerId,
        bookingId: p.bookingId,
        amount: p.amount,
        netAmount: p.netAmount,
        currency: p.currency,
        aiVerified: p.aiVerified,
        aiVerificationScore: p.aiVerificationScore,
        aiRiskLevel: p.aiRiskLevel,
        aiVerificationNotes: p.aiVerificationNotes,
        status: p.status,
        createdAt: p.createdAt,
      })),
    });
  } catch (error) {
    logger.error("[AI Verification] Failed to get flagged payouts", { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to get flagged payouts",
    });
  }
});

/**
 * POST /api/ai-verification/override/:payoutId
 * Admin override to approve a flagged payout (requires manual review)
 */
router.post("/override/:payoutId", async (req, res) => {
  try {
    const { payoutId } = req.params;
    const { reason, adminId } = req.body;

    if (!reason || !adminId) {
      return res.status(400).json({
        success: false,
        error: "Override reason and admin ID are required",
      });
    }

    logger.warn("[AI Verification] Admin override for payout", {
      payoutId,
      adminId,
      reason,
    });

    const [payout] = await db.select()
      .from(superAppPayouts)
      .where(eq(superAppPayouts.id, payoutId))
      .limit(1);

    if (!payout) {
      return res.status(404).json({
        success: false,
        error: "Payout not found",
      });
    }

    await db.update(superAppPayouts)
      .set({
        aiVerified: true,
        aiVerificationNotes: `ADMIN OVERRIDE by ${adminId}: ${reason}`,
        aiVerifiedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(superAppPayouts.id, payoutId));

    const payoutResult = await ProviderPayoutService.releaseEscrowAndPayout(payoutId, true);

    res.json({
      success: payoutResult.success,
      message: payoutResult.success 
        ? "Payout approved and processed"
        : `Override successful but payout failed: ${payoutResult.error}`,
      overrideDetails: {
        payoutId,
        adminId,
        reason,
        overrideAt: new Date(),
      },
    });
  } catch (error) {
    logger.error("[AI Verification] Override failed", { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Override failed",
    });
  }
});

/**
 * GET /api/ai-verification/stats
 * Get AI verification statistics
 */
router.get("/stats", async (req, res) => {
  try {
    const stats = await db.execute(sql`
      SELECT 
        COUNT(*) FILTER (WHERE ai_verified = true) as verified_count,
        COUNT(*) FILTER (WHERE ai_verified = false) as failed_count,
        COUNT(*) FILTER (WHERE ai_verified IS NULL AND status = 'in_escrow') as pending_count,
        COUNT(*) FILTER (WHERE ai_risk_level = 'low') as low_risk,
        COUNT(*) FILTER (WHERE ai_risk_level = 'medium') as medium_risk,
        COUNT(*) FILTER (WHERE ai_risk_level = 'high') as high_risk,
        COUNT(*) FILTER (WHERE ai_risk_level = 'critical') as critical_risk,
        AVG(ai_verification_score) FILTER (WHERE ai_verification_score IS NOT NULL) as avg_score,
        SUM(CAST(net_amount AS DECIMAL)) FILTER (WHERE ai_verified = true) as verified_amount,
        SUM(CAST(net_amount AS DECIMAL)) FILTER (WHERE ai_verified = false) as blocked_amount
      FROM super_app_payouts
      WHERE created_at > NOW() - INTERVAL '30 days'
    `);

    const row = stats.rows[0] as any;

    res.json({
      success: true,
      period: "30 days",
      stats: {
        verified: parseInt(row.verified_count) || 0,
        failed: parseInt(row.failed_count) || 0,
        pending: parseInt(row.pending_count) || 0,
        riskBreakdown: {
          low: parseInt(row.low_risk) || 0,
          medium: parseInt(row.medium_risk) || 0,
          high: parseInt(row.high_risk) || 0,
          critical: parseInt(row.critical_risk) || 0,
        },
        averageScore: row.avg_score ? parseFloat(row.avg_score).toFixed(1) : null,
        verifiedAmount: row.verified_amount ? parseFloat(row.verified_amount).toFixed(2) : "0.00",
        blockedAmount: row.blocked_amount ? parseFloat(row.blocked_amount).toFixed(2) : "0.00",
      },
    });
  } catch (error) {
    logger.error("[AI Verification] Stats query failed", { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Stats query failed",
    });
  }
});

export default router;
