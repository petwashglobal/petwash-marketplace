/**
 * ⁦PetWash™⁩ Referral System API Routes
 * חבר מביא חבר - Friend Brings Friend
 * 
 * Connected to Octopus Brain for:
 * - Code generation & tracking
 * - Click & signup registration
 * - Credit granting on first payment
 * - Level progression
 * - Anti-fraud protection
 */

import { Router } from "express";
import { db } from "../db";
import { users } from "@shared/schema";
import { eq, and, gte, sql } from "drizzle-orm";
import { requireAuth } from "../customAuth";
import { logger } from "../lib/logger";
import { eventBus } from "../services/EventBus";
import crypto from "crypto";

const router = Router();

// ============================================
// TYPES
// ============================================

interface ReferralStats {
  totalInvites: number;
  successfulInvites: number;
  pendingInvites: number;
  totalCreditsGrantedILS: number;
  levelId: "BRONZE" | "SILVER" | "GOLD" | "DIAMOND";
}

interface Referral {
  id: string;
  fromUserId: string;
  fromReferralCode: string;
  toUserId?: string;
  toEmail?: string;
  toPhone?: string;
  status: "PENDING_SIGNUP" | "SIGNED_UP" | "WAITING_FIRST_PAYMENT" | "COMPLETED" | "REJECTED";
  createdAt: Date;
  completedAt?: Date;
  referrerCreditILS: number;
  refereeCreditILS: number;
}

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

// ============================================
// IN-MEMORY STORAGE (Production: Use Firestore/PostgreSQL)
// ============================================

const referralCodes = new Map<string, { userId: string; createdAt: Date }>();
const referrals = new Map<string, Referral>();
const userCredits = new Map<string, { balanceILS: number; totalEarnedILS: number }>();
const userStats = new Map<string, ReferralStats>();

// ============================================
// HELPER FUNCTIONS
// ============================================

function generateReferralCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[crypto.randomInt(chars.length)];
  }
  return code;
}

function calculateLevel(successfulReferrals: number): "BRONZE" | "SILVER" | "GOLD" | "DIAMOND" {
  if (successfulReferrals >= 25) return "DIAMOND";
  if (successfulReferrals >= 10) return "GOLD";
  if (successfulReferrals >= 5) return "SILVER";
  return "BRONZE";
}

function getUserReferralCode(userId: string): string {
  for (const [code, data] of referralCodes.entries()) {
    if (data.userId === userId) return code;
  }
  const newCode = generateReferralCode();
  referralCodes.set(newCode, { userId, createdAt: new Date() });
  return newCode;
}

function getUserStats(userId: string): ReferralStats {
  const existing = userStats.get(userId);
  if (existing) return existing;
  
  const stats: ReferralStats = {
    totalInvites: 0,
    successfulInvites: 0,
    pendingInvites: 0,
    totalCreditsGrantedILS: 0,
    levelId: "BRONZE",
  };
  userStats.set(userId, stats);
  return stats;
}

function getUserCredits(userId: string) {
  const existing = userCredits.get(userId);
  if (existing) return existing;
  
  const credits = { balanceILS: 0, totalEarnedILS: 0 };
  userCredits.set(userId, credits);
  return credits;
}

function canReceiveCredit(userId: string, amountILS: number): { allowed: boolean; reason?: string } {
  const credits = getUserCredits(userId);
  
  if (credits.totalEarnedILS + amountILS > REFERRAL_CONFIG.lifetimeCapILS) {
    return { allowed: false, reason: "LIFETIME_CAP_REACHED" };
  }
  
  return { allowed: true };
}

// ============================================
// API ENDPOINTS
// ============================================

/**
 * GET /api/referral/link
 * Get user's referral code and link
 */
router.get("/link", requireAuth, async (req: any, res) => {
  try {
    const userId = req.user?.uid || req.userId;
    
    if (!userId) {
      return res.status(401).json({ error: "UNAUTHORIZED" });
    }
    
    const referralCode = getUserReferralCode(userId);
    const baseUrl = process.env.REFERRAL_BASE_URL || "https://petwash.co.il";
    const referralLink = `${baseUrl}/ref?code=${referralCode}`;
    const stats = getUserStats(userId);
    
    res.json({
      userId,
      referralCode,
      referralLink,
      stats,
    });
  } catch (error) {
    logger.error("[Referral] Failed to get referral link", { error });
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

/**
 * POST /api/referral/register-click
 * Register when someone clicks a referral link
 */
router.post("/register-click", async (req, res) => {
  try {
    const { referralCode, toEmail, toPhone, deviceId } = req.body;
    
    if (!referralCode) {
      return res.status(400).json({ error: "MISSING_REFERRAL_CODE" });
    }
    
    const codeData = referralCodes.get(referralCode.toUpperCase());
    if (!codeData) {
      return res.status(404).json({ error: "INVALID_REFERRAL_CODE" });
    }
    
    const referralId = crypto.randomUUID();
    const referral: Referral = {
      id: referralId,
      fromUserId: codeData.userId,
      fromReferralCode: referralCode.toUpperCase(),
      toEmail,
      toPhone,
      status: "PENDING_SIGNUP",
      createdAt: new Date(),
      referrerCreditILS: REFERRAL_CONFIG.creditPerReferralILS,
      refereeCreditILS: REFERRAL_CONFIG.creditPerReferralILS,
    };
    
    referrals.set(referralId, referral);
    
    const stats = getUserStats(codeData.userId);
    stats.totalInvites++;
    stats.pendingInvites++;
    
    await eventBus.emit({
      type: "REFERRAL_CLICK",
      aggregateId: referralId,
      payload: { referralCode, deviceId },
    });
    
    logger.info("[Referral] Click registered", { referralCode, referralId });
    
    res.json({ success: true, referralId });
  } catch (error) {
    logger.error("[Referral] Failed to register click", { error });
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

/**
 * POST /api/referral/link-signup
 * Link a new signup to a referral
 */
router.post("/link-signup", async (req, res) => {
  try {
    const { referralCode, newUserId, email, phone } = req.body;
    
    if (!referralCode || !newUserId) {
      return res.status(400).json({ error: "MISSING_REQUIRED_FIELDS" });
    }
    
    const codeData = referralCodes.get(referralCode.toUpperCase());
    if (!codeData) {
      return res.status(404).json({ error: "INVALID_REFERRAL_CODE" });
    }
    
    if (codeData.userId === newUserId) {
      return res.status(400).json({ error: "SELF_REFERRAL_NOT_ALLOWED" });
    }
    
    let referral: Referral | undefined;
    for (const r of referrals.values()) {
      if (r.fromReferralCode === referralCode.toUpperCase() && 
          r.status === "PENDING_SIGNUP" &&
          (r.toEmail === email || r.toPhone === phone)) {
        referral = r;
        break;
      }
    }
    
    if (!referral) {
      const referralId = crypto.randomUUID();
      referral = {
        id: referralId,
        fromUserId: codeData.userId,
        fromReferralCode: referralCode.toUpperCase(),
        toUserId: newUserId,
        toEmail: email,
        toPhone: phone,
        status: "WAITING_FIRST_PAYMENT",
        createdAt: new Date(),
        referrerCreditILS: REFERRAL_CONFIG.creditPerReferralILS,
        refereeCreditILS: REFERRAL_CONFIG.creditPerReferralILS,
      };
      referrals.set(referralId, referral);
    } else {
      referral.toUserId = newUserId;
      referral.status = "WAITING_FIRST_PAYMENT";
    }
    
    const stats = getUserStats(codeData.userId);
    stats.pendingInvites = Math.max(0, stats.pendingInvites - 1);
    
    await eventBus.emit({
      type: "REFERRAL_SIGNUP",
      aggregateId: referral.id,
      payload: { referrerId: codeData.userId, refereeId: newUserId },
    });
    
    logger.info("[Referral] Signup linked", { referralId: referral.id, newUserId });
    
    res.json({ success: true, referralId: referral.id, status: "WAITING_FIRST_PAYMENT" });
  } catch (error) {
    logger.error("[Referral] Failed to link signup", { error });
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

/**
 * POST /api/referral/complete
 * Complete a referral after first payment (called by Nayax webhook)
 */
router.post("/complete", async (req, res) => {
  try {
    const { userId, transactionId, amountILS } = req.body;
    
    if (!userId || !transactionId || !amountILS) {
      return res.status(400).json({ error: "MISSING_REQUIRED_FIELDS" });
    }
    
    if (amountILS < REFERRAL_CONFIG.minFirstPaymentILS) {
      return res.status(400).json({ 
        error: "PAYMENT_TOO_SMALL", 
        minRequired: REFERRAL_CONFIG.minFirstPaymentILS 
      });
    }
    
    let referral: Referral | undefined;
    for (const r of referrals.values()) {
      if (r.toUserId === userId && r.status === "WAITING_FIRST_PAYMENT") {
        referral = r;
        break;
      }
    }
    
    if (!referral) {
      return res.status(404).json({ error: "NO_PENDING_REFERRAL" });
    }
    
    const referrerCheck = canReceiveCredit(referral.fromUserId, REFERRAL_CONFIG.creditPerReferralILS);
    const refereeCheck = canReceiveCredit(userId, REFERRAL_CONFIG.creditPerReferralILS);
    
    if (!referrerCheck.allowed || !refereeCheck.allowed) {
      referral.status = "REJECTED";
      return res.status(400).json({ 
        error: "CREDIT_CAP_REACHED",
        referrerReason: referrerCheck.reason,
        refereeReason: refereeCheck.reason,
      });
    }
    
    referral.status = "COMPLETED";
    referral.completedAt = new Date();
    
    const referrerCredits = getUserCredits(referral.fromUserId);
    referrerCredits.balanceILS += REFERRAL_CONFIG.creditPerReferralILS;
    referrerCredits.totalEarnedILS += REFERRAL_CONFIG.creditPerReferralILS;
    
    const refereeCredits = getUserCredits(userId);
    refereeCredits.balanceILS += REFERRAL_CONFIG.creditPerReferralILS;
    refereeCredits.totalEarnedILS += REFERRAL_CONFIG.creditPerReferralILS;
    
    const referrerStats = getUserStats(referral.fromUserId);
    referrerStats.successfulInvites++;
    referrerStats.totalCreditsGrantedILS += REFERRAL_CONFIG.creditPerReferralILS;
    referrerStats.levelId = calculateLevel(referrerStats.successfulInvites);
    
    await eventBus.emit({
      type: "REFERRAL_COMPLETED",
      aggregateId: referral.id,
      payload: {
        referrerId: referral.fromUserId,
        refereeId: userId,
        creditAmountILS: REFERRAL_CONFIG.creditPerReferralILS,
        transactionId,
      },
    });
    
    logger.info("[Referral] Completed successfully", {
      referralId: referral.id,
      referrerId: referral.fromUserId,
      refereeId: userId,
    });
    
    res.json({
      success: true,
      referralId: referral.id,
      creditsGranted: {
        referrer: REFERRAL_CONFIG.creditPerReferralILS,
        referee: REFERRAL_CONFIG.creditPerReferralILS,
      },
      newLevel: referrerStats.levelId,
    });
  } catch (error) {
    logger.error("[Referral] Failed to complete referral", { error });
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

/**
 * GET /api/referral/history
 * Get user's referral history
 */
router.get("/history", requireAuth, async (req: any, res) => {
  try {
    const userId = req.user?.uid || req.userId;
    
    if (!userId) {
      return res.status(401).json({ error: "UNAUTHORIZED" });
    }
    
    const userReferrals: Referral[] = [];
    for (const r of referrals.values()) {
      if (r.fromUserId === userId) {
        userReferrals.push(r);
      }
    }
    
    userReferrals.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    
    res.json({
      referrals: userReferrals.slice(0, 50),
      total: userReferrals.length,
    });
  } catch (error) {
    logger.error("[Referral] Failed to get history", { error });
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

/**
 * GET /api/referral/credits
 * Get user's credit balance
 */
router.get("/credits", requireAuth, async (req: any, res) => {
  try {
    const userId = req.user?.uid || req.userId;
    
    if (!userId) {
      return res.status(401).json({ error: "UNAUTHORIZED" });
    }
    
    const credits = getUserCredits(userId);
    
    res.json({
      balanceILS: credits.balanceILS,
      totalEarnedILS: credits.totalEarnedILS,
      lifetimeCapILS: REFERRAL_CONFIG.lifetimeCapILS,
      remainingCapILS: REFERRAL_CONFIG.lifetimeCapILS - credits.totalEarnedILS,
    });
  } catch (error) {
    logger.error("[Referral] Failed to get credits", { error });
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

/**
 * GET /api/referral/admin/overview
 * Admin overview of referral program (requires admin auth)
 */
router.get("/admin/overview", async (req, res) => {
  try {
    const adminSecret = req.headers["x-admin-secret"];
    if (adminSecret !== process.env.PETWASH_ADMIN_SECRET) {
      return res.status(403).json({ error: "FORBIDDEN" });
    }
    
    let totalReferrals = 0;
    let completedReferrals = 0;
    let pendingReferrals = 0;
    let rejectedReferrals = 0;
    let totalCreditsILS = 0;
    
    for (const r of referrals.values()) {
      totalReferrals++;
      if (r.status === "COMPLETED") {
        completedReferrals++;
        totalCreditsILS += r.referrerCreditILS + r.refereeCreditILS;
      } else if (r.status === "REJECTED") {
        rejectedReferrals++;
      } else {
        pendingReferrals++;
      }
    }
    
    res.json({
      totalReferrals,
      completedReferrals,
      pendingReferrals,
      rejectedReferrals,
      totalCreditsILS,
      conversionRate: totalReferrals > 0 
        ? Math.round((completedReferrals / totalReferrals) * 100) 
        : 0,
    });
  } catch (error) {
    logger.error("[Referral] Failed to get admin overview", { error });
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

export default router;
