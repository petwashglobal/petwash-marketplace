/**
 * ⁦PetWash™⁩ Vouchers 2025 API Routes - SECURE
 * 7-Star Luxury Voucher Management with Zod Validation & JWS Signing
 */

import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { db } from "../db";
import { petWashVouchers2025, voucherUsageHistory } from "@shared/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { 
  buildBaseVoucher, 
  generateVoucherId, 
  generatePublicCode,
  redeemOneWash,
  redeemAmount,
  verifyVoucherJws,
  voucherSha256,
  type PetWashVoucher2025,
  type VoucherType,
  type ValueType,
  type CardTheme
} from "@shared/petwashVoucher2025";
import { requireAuth } from "../customAuth";
import { verifyAndRepairBalance } from "../services/voucherSecurityService";

const router = Router();

/* ---------------------------------------------------------
   ZOD VALIDATION SCHEMAS
--------------------------------------------------------- */

const createVoucherSchema = z.object({
  type: z.enum(["egift", "package_single", "package_multi"]),
  value_type: z.enum(["currency", "washes"]),
  value: z.number().nonnegative().default(0),
  washes: z.number().int().nonnegative().default(0),
  currency: z.string().optional(),
  expires_at: z.string().datetime().optional(),
  theme: z.enum(["neo_black_platinum", "neo_emerald", "neo_silver"]).optional(),
  recipient_name: z.string().min(1),
  recipient_email: z.string().email()
});

const redeemVoucherSchema = z.object({
  public_code: z.string().min(1),
  station_id: z.string().min(1),
  location_label: z.string().min(1),
  method: z.enum(["app", "station", "qr"]),
  amount: z.number().nonnegative().optional(),
  washes: z.number().int().positive().optional()
});

function validateBody(schema: z.ZodSchema<any>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const issues = result.error.issues.map(i => ({
        path: i.path.join("."),
        message: i.message
      }));
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        issues
      });
    }
    req.body = result.data;
    next();
  };
}

/* ---------------------------------------------------------
   SECURITY: HASH VERIFICATION
   Prevents tampering with stored voucher values
--------------------------------------------------------- */

/**
 * Reconstructs voucher object from DB record and verifies hash integrity
 * CRITICAL: This prevents attackers from modifying voucher values in DB
 */
function reconstructVoucherFromDb(dbVoucher: any): PetWashVoucher2025 {
  return {
    voucher_id: dbVoucher.id,
    public_code: dbVoucher.publicCode,
    type: dbVoucher.type,
    visual: {
      tier: dbVoucher.tier,
      card_theme: dbVoucher.cardTheme,
      animated_highlight: dbVoucher.animatedHighlight,
      highres_svg_url: dbVoucher.highresSvgUrl
    },
    rules: {
      value_type: dbVoucher.valueType,
      value_original: dbVoucher.valueOriginal ? Number(dbVoucher.valueOriginal) : null,
      value_remaining: dbVoucher.valueRemaining ? Number(dbVoucher.valueRemaining) : null,
      washes_original: dbVoucher.washesOriginal,
      washes_remaining: dbVoucher.washesRemaining,
      currency: dbVoucher.currency,
      expires_at: dbVoucher.expiresAt ? dbVoucher.expiresAt.toISOString() : null,
      transferable: dbVoucher.transferable
    },
    owner: {
      user_id: dbVoucher.ownerId,
      name: dbVoucher.ownerName,
      email: dbVoucher.ownerEmail,
      created_in_app: dbVoucher.createdInApp
    },
    security: {
      qr_url: dbVoucher.qrUrl,
      sha256: dbVoucher.sha256Hash,
      signed_jws: dbVoucher.signedJws
    },
    usage: {
      last_used: dbVoucher.lastUsed ? dbVoucher.lastUsed.toISOString() : null,
      history: [], // Loaded separately
      redeem_method: dbVoucher.redeemMethod
    }
  };
}

/**
 * 7-STAR LUXURY SECURITY: ALL vouchers MUST have ES256 signatures
 * NO LEGACY EXCEPTIONS - This is a premium system requiring cryptographic integrity
 * 
 * For production deployment:
 * 1. All existing vouchers must be migrated/re-signed before this code goes live
 * 2. Set ALLOW_LEGACY_UNSIGNED environment variable to "true" ONLY during migration period
 * 3. Remove ALLOW_LEGACY_UNSIGNED after migration is complete
 */
const ALLOW_LEGACY_UNSIGNED = process.env.ALLOW_LEGACY_UNSIGNED === "true";

/**
 * Verifies voucher integrity by comparing stored hash with recomputed hash
 * CRITICAL: Hash only covers IMMUTABLE fields, so redemptions don't break verification
 * CRITICAL SECURITY: ALL vouchers MUST have signatures (7-star luxury standard)
 * Returns true if voucher has NOT been tampered with
 */
async function verifyVoucherIntegrity(dbVoucher: any): Promise<{ valid: boolean; reason?: string }> {
  try {
    // SECURITY: Check if signature is missing
    if (!dbVoucher.signedJws || dbVoucher.signedJws === "") {
      // 7-STAR LUXURY STANDARD: No unsigned vouchers allowed
      if (!ALLOW_LEGACY_UNSIGNED) {
        console.error("[Voucher Security] CRITICAL - Unsigned voucher detected in production:", {
          voucherId: dbVoucher.id,
          publicCode: dbVoucher.publicCode,
          createdAt: dbVoucher.createdAt
        });
        return { 
          valid: false, 
          reason: "SECURITY: All 7-star luxury vouchers must have ES256 signatures" 
        };
      }
      
      // Migration period only - log and allow with warning
      console.warn("[Voucher Security] MIGRATION MODE - Unsigned voucher allowed:", {
        publicCode: dbVoucher.publicCode,
        voucherId: dbVoucher.id
      });
      return { 
        valid: true,
        reason: "Migration mode - unsigned voucher temporarily allowed" 
      };
    }

    const jwtPayload = await verifyVoucherJws(dbVoucher.signedJws);
    
    // Verify basic JWS claims
    if (jwtPayload.vid !== dbVoucher.id || jwtPayload.pcode !== dbVoucher.publicCode) {
      return { valid: false, reason: "JWS payload mismatch" };
    }

    // CRITICAL: Recompute hash from IMMUTABLE fields only
    // This hash never changes even after redemptions because it only covers:
    // - value_original (NOT value_remaining)
    // - washes_original (NOT washes_remaining)
    // - other immutable fields
    const reconstructed = reconstructVoucherFromDb(dbVoucher);
    const currentHash = voucherSha256(reconstructed);
    
    if (currentHash !== jwtPayload.hash) {
      return { 
        valid: false, 
        reason: "Voucher immutable fields have been tampered with - hash mismatch" 
      };
    }

    return { valid: true };
  } catch (error: any) {
    return { valid: false, reason: error.message || "Verification failed" };
  }
}

/* ---------------------------------------------------------
   API ROUTES
--------------------------------------------------------- */

/**
 * Create a new voucher
 * POST /api/vouchers-2025/create
 */
router.post("/create", requireAuth, validateBody(createVoucherSchema), async (req, res) => {
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

    // Build voucher with ES256 JWS signing
    const voucher = await buildBaseVoucher({
      type: type as VoucherType,
      value_type: value_type as ValueType,
      value: Number(value) || 0,
      washes: Number(washes) || 0,
      currency: currency || "ILS",
      expires_at: expires_at ?? undefined,
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
      message: "Voucher created successfully with ES256 signature"
    });
  } catch (error: any) {
    console.error("Error creating voucher:", error);
    res.status(500).json({ 
      success: false, 
      error: "Failed to create voucher",
      message: error.message
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
  } catch (error: any) {
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

    // CRITICAL: Verify voucher integrity
    const integrityCheck = await verifyVoucherIntegrity(voucher);

    res.json({ 
      success: true, 
      voucher: {
        ...voucher,
        usage_history: history,
        integrity_verified: integrityCheck.valid,
        integrity_reason: integrityCheck.reason || null
      }
    });
  } catch (error: any) {
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
router.post("/redeem", requireAuth, validateBody(redeemVoucherSchema), async (req, res) => {
  try {
    const {
      public_code,
      station_id,
      location_label,
      method,
      amount,
      washes
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

    // CRITICAL: Verify voucher integrity (prevents tampering with DB immutable fields)
    const integrityCheck = await verifyVoucherIntegrity(dbVoucher);
    if (!integrityCheck.valid) {
      console.warn("[Voucher Security] Integrity check failed:", integrityCheck.reason);
      return res.status(403).json({
        success: false,
        error: "Voucher integrity verification failed",
        details: integrityCheck.reason
      });
    }

    // CRITICAL: Ledger-Based Balance Reconciliation (prevents replay attacks)
    // Computes true remaining from append-only usage history ledger
    const usageHistory = await db
      .select()
      .from(voucherUsageHistory)
      .where(eq(voucherUsageHistory.voucherId, dbVoucher.id))
      .orderBy(voucherUsageHistory.createdAt);

    if (dbVoucher.valueType === "currency") {
      // Compute cumulative usage from tamper-evident ledger
      const cumulativeUsed = usageHistory.reduce((sum, entry) => {
        return sum + Number(entry.amountUsed || 0);
      }, 0);
      
      const original = Number(dbVoucher.valueOriginal || 0);
      const trustedRemaining = original - cumulativeUsed;
      const dbRemaining = Number(dbVoucher.valueRemaining || 0);
      
      // SECURITY: Check for balance tampering
      if (Math.abs(trustedRemaining - dbRemaining) > 0.01) {
        console.error("[Voucher Security] BALANCE REPLAY ATTACK DETECTED - Currency:", {
          voucherId: dbVoucher.id,
          publicCode: dbVoucher.publicCode,
          valueOriginal: original,
          cumulativeUsed,
          trustedRemaining,
          dbRemaining,
          delta: trustedRemaining - dbRemaining
        });
        
        // AUTO-REPAIR: Overwrite DB value with ledger-computed truth
        await db
          .update(petWashVouchers2025)
          .set({ 
            valueRemaining: trustedRemaining.toString(),
            updatedAt: new Date()
          })
          .where(eq(petWashVouchers2025.id, dbVoucher.id));
        
        // Update in-memory value for this request
        dbVoucher.valueRemaining = trustedRemaining.toString();
        
        console.warn("[Voucher Security] AUTO-REPAIRED balance from ledger");
      }
      
    } else if (dbVoucher.valueType === "washes") {
      // Compute cumulative usage from tamper-evident ledger
      const cumulativeUsed = usageHistory.reduce((sum, entry) => {
        return sum + (entry.washesUsed || 0);
      }, 0);
      
      const original = dbVoucher.washesOriginal || 0;
      const trustedRemaining = original - cumulativeUsed;
      const dbRemaining = dbVoucher.washesRemaining || 0;
      
      // SECURITY: Check for balance tampering
      if (trustedRemaining !== dbRemaining) {
        console.error("[Voucher Security] BALANCE REPLAY ATTACK DETECTED - Washes:", {
          voucherId: dbVoucher.id,
          publicCode: dbVoucher.publicCode,
          washesOriginal: original,
          cumulativeUsed,
          trustedRemaining,
          dbRemaining,
          delta: trustedRemaining - dbRemaining
        });
        
        // AUTO-REPAIR: Overwrite DB value with ledger-computed truth
        await db
          .update(petWashVouchers2025)
          .set({ 
            washesRemaining: trustedRemaining,
            updatedAt: new Date()
          })
          .where(eq(petWashVouchers2025.id, dbVoucher.id));
        
        // Update in-memory value for this request
        dbVoucher.washesRemaining = trustedRemaining;
        
        console.warn("[Voucher Security] AUTO-REPAIRED balance from ledger");
      }
    }

    // Check expiration
    if (dbVoucher.expiresAt && new Date(dbVoucher.expiresAt) < new Date()) {
      return res.status(400).json({ 
        success: false, 
        error: "Voucher has expired" 
      });
    }

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

      // SECURITY (T03): Atomic conditional UPDATE prevents double-spend race condition.
      // Old code: read remaining → check in JS → write new value (gap allows two concurrent
      //           requests both to pass the check and both decrement).
      // Fix: WHERE washes_remaining >= ${washesToRedeem} — if two requests race, the second
      //      UPDATE returns 0 rows and we throw an error instead of double-spending.
      const [updatedWash] = await db
        .update(petWashVouchers2025)
        .set({
          washesRemaining: sql`washes_remaining - ${washesToRedeem}`,
          lastUsed: new Date(),
          updatedAt: new Date()
        })
        .where(and(
          eq(petWashVouchers2025.id, dbVoucher.id),
          sql`washes_remaining >= ${washesToRedeem}`
        ))
        .returning({ washesRemaining: petWashVouchers2025.washesRemaining });

      if (!updatedWash) {
        return res.status(409).json({
          success: false,
          error: "Insufficient washes remaining or concurrent redemption conflict — please retry"
        });
      }

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
        remaining_washes: updatedWash.washesRemaining ?? 0
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

      // SECURITY (T03): Atomic conditional UPDATE — prevents double-spend on currency vouchers.
      const [updatedCurr] = await db
        .update(petWashVouchers2025)
        .set({
          valueRemaining: sql`(value_remaining::numeric - ${amountToRedeem})::text`,
          lastUsed: new Date(),
          updatedAt: new Date()
        })
        .where(and(
          eq(petWashVouchers2025.id, dbVoucher.id),
          sql`value_remaining::numeric >= ${amountToRedeem}`
        ))
        .returning({ valueRemaining: petWashVouchers2025.valueRemaining });

      if (!updatedCurr) {
        return res.status(409).json({
          success: false,
          error: "Insufficient value remaining or concurrent redemption conflict — please retry"
        });
      }

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
        remaining_value: Number(updatedCurr.valueRemaining ?? 0)
      });
    }

  } catch (error: any) {
    console.error("Error redeeming voucher:", error);
    res.status(500).json({ 
      success: false, 
      error: "Failed to redeem voucher",
      message: error.message
    });
  }
});

/**
 * Get voucher statistics
 * GET /api/vouchers-2025/stats/summary
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
  } catch (error: any) {
    console.error("Error fetching stats:", error);
    res.status(500).json({ 
      success: false, 
      error: "Failed to fetch statistics" 
    });
  }
});

export default router;
