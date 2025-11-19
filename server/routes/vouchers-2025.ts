/**
 * PetWash™ Vouchers 2025 API Routes
 * 7-Star Luxury Voucher Management
 */

import { Router } from "express";
import { db } from "../db";
import { petWashVouchers2025, voucherUsageHistory } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { 
  buildBaseVoucher, 
  generateVoucherId, 
  generatePublicCode,
  redeemOneWash,
  redeemAmount,
  type PetWashVoucher2025,
  type VoucherType,
  type ValueType,
  type CardTheme
} from "@shared/petwashVoucher2025";
import { requireAuth } from "../customAuth";

const router = Router();

/**
 * Create a new voucher
 * POST /api/vouchers-2025/create
 */
router.post("/create", requireAuth, async (req, res) => {
  try {
    const {
      type,
      value_type,
      value,
      washes,
      currency,
      expires_at,
      theme,
      recipient_name,
      recipient_email
    } = req.body;

    // Build voucher using shared library
    const voucher = buildBaseVoucher({
      type: type as VoucherType,
      value_type: value_type as ValueType,
      value: Number(value) || 0,
      washes: Number(washes) || 0,
      currency: currency || "ILS",
      expires_at: expires_at || null,
      owner_id: req.user.uid,
      owner_name: recipient_name || req.user.displayName || "PetWash Customer",
      owner_email: recipient_email || req.user.email || "",
      created_in_app: "PetWash Hub 1.0.0",
      theme: theme as CardTheme || "neo_black_platinum",
      animated_highlight: true
    });

    // Save to database
    await db.insert(petWashVouchers2025).values({
      id: voucher.voucher_id,
      publicCode: voucher.public_code,
      type: voucher.type,
      valueType: voucher.rules.value_type,
      tier: voucher.visual.tier,
      cardTheme: voucher.visual.card_theme,
      animatedHighlight: voucher.visual.animated_highlight,
      highresSvgUrl: voucher.visual.highres_svg_url,
      valueOriginal: voucher.rules.value_original?.toString() || null,
      valueRemaining: voucher.rules.value_remaining?.toString() || null,
      washesOriginal: voucher.rules.washes_original || null,
      washesRemaining: voucher.rules.washes_remaining || null,
      currency: voucher.rules.currency || null,
      expiresAt: voucher.rules.expires_at ? new Date(voucher.rules.expires_at) : null,
      transferable: voucher.rules.transferable,
      ownerId: voucher.owner.user_id,
      ownerName: voucher.owner.name,
      ownerEmail: voucher.owner.email,
      createdInApp: voucher.owner.created_in_app,
      qrUrl: voucher.security.qr_url,
      sha256Hash: voucher.security.sha256,
      signedJws: voucher.security.signed_jws || "",
      lastUsed: voucher.usage.last_used ? new Date(voucher.usage.last_used) : null,
      redeemMethod: voucher.usage.redeem_method
    });

    res.status(201).json({ 
      success: true, 
      voucher,
      message: "Voucher created successfully"
    });
  } catch (error) {
    console.error("Error creating voucher:", error);
    res.status(500).json({ 
      success: false, 
      error: "Failed to create voucher" 
    });
  }
});

/**
 * Get all vouchers for current user
 * GET /api/vouchers-2025/my-vouchers
 */
router.get("/my-vouchers", requireAuth, async (req, res) => {
  try {
    const vouchers = await db
      .select()
      .from(petWashVouchers2025)
      .where(eq(petWashVouchers2025.ownerId, req.user.uid))
      .orderBy(desc(petWashVouchers2025.createdAt));

    // Get usage history for each voucher
    const vouchersWithHistory = await Promise.all(
      vouchers.map(async (v) => {
        const history = await db
          .select()
          .from(voucherUsageHistory)
          .where(eq(voucherUsageHistory.voucherId, v.id))
          .orderBy(desc(voucherUsageHistory.usedAt));

        return {
          ...v,
          usage_history: history
        };
      })
    );

    res.json({ 
      success: true, 
      vouchers: vouchersWithHistory 
    });
  } catch (error) {
    console.error("Error fetching vouchers:", error);
    res.status(500).json({ 
      success: false, 
      error: "Failed to fetch vouchers" 
    });
  }
});

/**
 * Get a specific voucher by public code
 * GET /api/vouchers-2025/:publicCode
 */
router.get("/:publicCode", requireAuth, async (req, res) => {
  try {
    const { publicCode } = req.params;

    const [voucher] = await db
      .select()
      .from(petWashVouchers2025)
      .where(eq(petWashVouchers2025.publicCode, publicCode))
      .limit(1);

    if (!voucher) {
      return res.status(404).json({ 
        success: false, 
        error: "Voucher not found" 
      });
    }

    // Check ownership
    if (voucher.ownerId !== req.user.uid) {
      return res.status(403).json({ 
        success: false, 
        error: "Not authorized to view this voucher" 
      });
    }

    // Get usage history
    const history = await db
      .select()
      .from(voucherUsageHistory)
      .where(eq(voucherUsageHistory.voucherId, voucher.id))
      .orderBy(desc(voucherUsageHistory.usedAt));

    res.json({ 
      success: true, 
      voucher: {
        ...voucher,
        usage_history: history
      }
    });
  } catch (error) {
    console.error("Error fetching voucher:", error);
    res.status(500).json({ 
      success: false, 
      error: "Failed to fetch voucher" 
    });
  }
});

/**
 * Redeem a voucher (wash or amount)
 * POST /api/vouchers-2025/redeem
 */
router.post("/redeem", requireAuth, async (req, res) => {
  try {
    const {
      public_code,
      station_id,
      location_label,
      method,
      amount, // For currency vouchers
      washes // For wash vouchers (default 1)
    } = req.body;

    // Find voucher
    const [dbVoucher] = await db
      .select()
      .from(petWashVouchers2025)
      .where(eq(petWashVouchers2025.publicCode, public_code))
      .limit(1);

    if (!dbVoucher) {
      return res.status(404).json({ 
        success: false, 
        error: "Voucher not found" 
      });
    }

    // Check expiration
    if (dbVoucher.expiresAt && new Date(dbVoucher.expiresAt) < new Date()) {
      return res.status(400).json({ 
        success: false, 
        error: "Voucher has expired" 
      });
    }

    const nowIso = new Date().toISOString();

    // Redeem based on type
    if (dbVoucher.valueType === "washes") {
      const washesToRedeem = washes || 1;
      const remaining = dbVoucher.washesRemaining || 0;

      if (remaining < washesToRedeem) {
        return res.status(400).json({ 
          success: false, 
          error: "Insufficient washes remaining" 
        });
      }

      // Update voucher
      await db
        .update(petWashVouchers2025)
        .set({
          washesRemaining: remaining - washesToRedeem,
          lastUsed: new Date(),
          updatedAt: new Date()
        })
        .where(eq(petWashVouchers2025.id, dbVoucher.id));

      // Log usage
      await db.insert(voucherUsageHistory).values({
        voucherId: dbVoucher.id,
        usedAt: new Date(),
        stationId: station_id || "app",
        locationLabel: location_label || "PetWash App",
        method: method || "app",
        washesUsed: washesToRedeem,
        amountUsed: null
      });

      res.json({ 
        success: true, 
        message: `Redeemed ${washesToRedeem} wash(es)`,
        remaining_washes: remaining - washesToRedeem
      });

    } else if (dbVoucher.valueType === "currency") {
      const amountToRedeem = Number(amount);
      const remaining = Number(dbVoucher.valueRemaining || 0);

      if (!amountToRedeem || amountToRedeem <= 0) {
        return res.status(400).json({ 
          success: false, 
          error: "Invalid redemption amount" 
        });
      }

      if (remaining < amountToRedeem) {
        return res.status(400).json({ 
          success: false, 
          error: "Insufficient value remaining" 
        });
      }

      // Update voucher
      await db
        .update(petWashVouchers2025)
        .set({
          valueRemaining: (remaining - amountToRedeem).toString(),
          lastUsed: new Date(),
          updatedAt: new Date()
        })
        .where(eq(petWashVouchers2025.id, dbVoucher.id));

      // Log usage
      await db.insert(voucherUsageHistory).values({
        voucherId: dbVoucher.id,
        usedAt: new Date(),
        stationId: station_id || "app",
        locationLabel: location_label || "PetWash App",
        method: method || "app",
        amountUsed: amountToRedeem.toString(),
        washesUsed: null
      });

      res.json({ 
        success: true, 
        message: `Redeemed ${dbVoucher.currency}${amountToRedeem}`,
        remaining_value: remaining - amountToRedeem
      });
    }

  } catch (error) {
    console.error("Error redeeming voucher:", error);
    res.status(500).json({ 
      success: false, 
      error: "Failed to redeem voucher" 
    });
  }
});

/**
 * Get voucher statistics
 * GET /api/vouchers-2025/stats
 */
router.get("/stats/summary", requireAuth, async (req, res) => {
  try {
    const vouchers = await db
      .select()
      .from(petWashVouchers2025)
      .where(eq(petWashVouchers2025.ownerId, req.user.uid));

    const stats = {
      total_vouchers: vouchers.length,
      active_vouchers: vouchers.filter(v => {
        if (v.expiresAt && new Date(v.expiresAt) < new Date()) return false;
        if (v.valueType === "currency" && Number(v.valueRemaining || 0) <= 0) return false;
        if (v.valueType === "washes" && (v.washesRemaining || 0) <= 0) return false;
        return true;
      }).length,
      total_value_remaining: vouchers
        .filter(v => v.valueType === "currency")
        .reduce((sum, v) => sum + Number(v.valueRemaining || 0), 0),
      total_washes_remaining: vouchers
        .filter(v => v.valueType === "washes")
        .reduce((sum, v) => sum + (v.washesRemaining || 0), 0)
    };

    res.json({ success: true, stats });
  } catch (error) {
    console.error("Error fetching stats:", error);
    res.status(500).json({ 
      success: false, 
      error: "Failed to fetch statistics" 
    });
  }
});

export default router;
