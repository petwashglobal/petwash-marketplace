/**
 * PetWash™ Unified Voucher API Routes
 *
 * POST   /api/v2/vouchers/issue             → Issue new voucher (admin/internal)
 * POST   /api/v2/vouchers/:id/qr-token      → Generate short-lived QR token (customer)
 * POST   /api/v2/vouchers/redeem/station    → Station redemption (with QR token)
 * POST   /api/v2/vouchers/redeem/web        → Web/app platform credit redemption
 * GET    /api/v2/vouchers/:id               → Get voucher + ledger + integrity check
 * GET    /api/v2/vouchers/serial/:sn        → Get voucher by serial number
 * GET    /api/v2/vouchers/my               → List caller's vouchers
 * POST   /api/v2/vouchers/:id/cancel        → Cancel voucher (admin)
 * POST   /api/v2/vouchers/:id/adjust        → Adjust balance (admin)
 * GET    /api/v2/vouchers/:id/ledger        → Full audit ledger for a voucher (admin)
 */

import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { db } from "../db";
import { unifiedVouchers, unifiedVoucherLedger } from "../../shared/schema";
import { eq, desc, or } from "drizzle-orm";
import {
  issueVoucher,
  generateQrToken,
  redeemVoucher,
  cancelVoucher,
  adjustVoucherBalance,
  getVoucherWithBalance,
  verifyVoucherIntegrity,
  type VoucherType,
  type DesignTheme,
  type SupportedLocale,
  type Channel,
} from "../services/unifiedVoucherService";
import { requireAuth } from "../customAuth";
import { logger } from "../lib/logger";
import crypto from "crypto";

const router = Router();

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function traceId() {
  return crypto.randomBytes(6).toString("hex");
}

function validate<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: Function) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        issues: result.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      });
    }
    req.body = result.data;
    next();
  };
}

function isAdmin(req: Request) {
  return req.user?.role === "admin" || req.user?.role === "super_admin";
}

// ─────────────────────────────────────────────
// Zod schemas
// ─────────────────────────────────────────────

const issueSchema = z.object({
  voucherType: z.enum(["WASH_PACKAGE", "PLATFORM_CREDIT"]),
  designTheme: z.enum(["pink", "green", "black", "gold"]).optional(),
  valueIls: z.number().positive().optional(),
  washCount: z.number().int().positive().optional(),
  currency: z.string().max(8).optional(),
  expiresAt: z.string().datetime().optional(),
  recipientDisplayName: z.string().min(1).max(200),
  recipientLocale: z.enum(["he", "en", "ar", "fr", "ru", "es"]).optional(),
  recipientEmail: z.string().email().optional(),
  recipientPhone: z.string().max(30).optional(),
  personalMessage: z.string().max(500).optional(),
  purchasedByUserId: z.string().optional(),
  purchasedByEmail: z.string().email().optional(),
  ownerUserId: z.string().optional(),
  purchaseOrderId: z.string().optional(),
  nayaxTxId: z.string().optional(),
  svgTemplateKey: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const stationRedeemSchema = z.object({
  voucherId: z.string().optional(),
  serialNumber: z.string().optional(),
  qrToken: z.string().min(10),
  washes: z.number().int().positive().optional(),
  amountIls: z.number().positive().optional(),
  stationId: z.string().min(1),
  locationLabel: z.string().optional(),
  externalRef: z.string().optional(),
  notes: z.string().optional(),
});

// NOTE: amountIls is intentionally EXCLUDED from webRedeemSchema.
// For web/app redemptions, the server derives the amount from the voucher's
// stored remaining balance — the client never controls the redemption value.

const webRedeemSchema = z.object({
  voucherId: z.string().optional(),
  serialNumber: z.string().optional(),
  washes: z.number().int().positive().optional(),
  externalRef: z.string().optional(), // booking id / order id
  notes: z.string().optional(),
  qrToken: z.string().optional(), // optional for app-initiated redemptions
});

const cancelSchema = z.object({
  reason: z.string().min(1).max(500),
});

const adjustSchema = z.object({
  deltaValue: z.number().optional(),
  deltaWashes: z.number().int().optional(),
  reason: z.string().min(1).max(500),
});

const qrTokenSchema = z.object({
  channels: z.array(z.enum(["STATION", "WEB", "APP", "ADMIN"])).optional(),
});

// ─────────────────────────────────────────────
// POST /issue — admin/internal only
// ─────────────────────────────────────────────

router.post("/issue", requireAuth, validate(issueSchema), async (req: Request, res: Response) => {
  const tid = traceId();
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({ success: false, error: "Admin access required", traceId: tid });
    }

    const voucher = await issueVoucher({
      ...req.body,
      expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt) : undefined,
    });

    res.status(201).json({ success: true, voucher, traceId: tid });
  } catch (err: any) {
    logger.error("[UV] Issue failed", { traceId: tid, error: err.message });
    res.status(400).json({ success: false, error: err.message, traceId: tid });
  }
});

// ─────────────────────────────────────────────
// POST /:id/qr-token — customer generates short-lived token for station/app
// ─────────────────────────────────────────────

router.post("/:id/qr-token", requireAuth, validate(qrTokenSchema), async (req: Request, res: Response) => {
  const tid = traceId();
  try {
    const { id } = req.params;
    const { channels } = req.body;

    // Verify ownership
    const [voucher] = await db
      .select()
      .from(unifiedVouchers)
      .where(eq(unifiedVouchers.id, id))
      .limit(1);

    if (!voucher) return res.status(404).json({ success: false, error: "Voucher not found", traceId: tid });

    const ownerId = voucher.ownerUserId ?? voucher.purchasedByUserId;
    if (ownerId !== req.user?.uid && !isAdmin(req)) {
      return res.status(403).json({ success: false, error: "Not authorized", traceId: tid });
    }

    if (["CANCELLED", "REDEEMED", "EXPIRED"].includes(voucher.status)) {
      return res.status(400).json({ success: false, error: `Voucher is ${voucher.status}`, traceId: tid });
    }

    const token = await generateQrToken(id, (channels as Channel[]) ?? ["STATION", "APP"]);

    res.json({
      success: true,
      qrToken: token,
      expiresInSeconds: 180,
      voucherId: id,
      serialNumber: voucher.serialNumber,
      voucherType: voucher.voucherType,
      traceId: tid,
    });
  } catch (err: any) {
    logger.error("[UV] QR token generation failed", { traceId: tid, error: err.message });
    res.status(400).json({ success: false, error: err.message, traceId: tid });
  }
});

// ─────────────────────────────────────────────
// POST /redeem/station — K9000 station redemption (requires QR token)
// ─────────────────────────────────────────────

router.post("/redeem/station", requireAuth, validate(stationRedeemSchema), async (req: Request, res: Response) => {
  const tid = traceId();
  try {
    // SECURITY (T02): Validate client-supplied amountIls against server-side whitelist.
    // Without this, any authenticated caller could send amountIls=0.01 to redeem a 45 ILS
    // wash for a fraction of its value. Whitelist matches valid PetWash wash prices.
    const VALID_WASH_PRICES_ILS = [45, 65, 80, 120, 150, 180, 200];
    const clientAmountIls = req.body.amountIls;
    if (clientAmountIls !== undefined && !VALID_WASH_PRICES_ILS.includes(Number(clientAmountIls))) {
      logger.warn("[UV] Station redeem rejected — invalid amountIls", {
        traceId: tid,
        amountIls: clientAmountIls,
        uid: req.user?.uid,
        valid: VALID_WASH_PRICES_ILS,
      });
      return res.status(400).json({
        success: false,
        error: "INVALID_WASH_AMOUNT",
        valid: VALID_WASH_PRICES_ILS,
        traceId: tid,
      });
    }

    const result = await redeemVoucher({
      voucherId: req.body.voucherId,
      serialNumber: req.body.serialNumber,
      qrToken: req.body.qrToken,
      channel: "STATION",
      amountIls: clientAmountIls,
      washes: req.body.washes,
      actorUserId: req.user?.uid,
      actorRole: "station",
      stationId: req.body.stationId,
      locationLabel: req.body.locationLabel,
      externalRef: req.body.externalRef,
      notes: req.body.notes,
    });

    res.json({ success: true, ...result });
  } catch (err: any) {
    logger.warn("[UV] Station redeem failed", { traceId: tid, error: err.message });
    res.status(400).json({ success: false, error: err.message, traceId: tid });
  }
});

// ─────────────────────────────────────────────
// POST /redeem/web — web/app PLATFORM_CREDIT redemption
// ─────────────────────────────────────────────

router.post("/redeem/web", requireAuth, validate(webRedeemSchema), async (req: Request, res: Response) => {
  const tid = traceId();
  try {
    // Resolve channel: APP or WEB based on User-Agent / header
    const channel: Channel = req.headers["x-client-platform"] === "app" ? "APP" : "WEB";

    // Ensure caller owns the voucher (or is admin) and derive server-side redemption amount
    const voucherId = req.body.voucherId;
    const serialNumber = req.body.serialNumber;
    let ownerId: string | null = null;
    let serverDerivedAmountIls: number | undefined;

    if (voucherId) {
      const [v] = await db.select().from(unifiedVouchers).where(eq(unifiedVouchers.id, voucherId)).limit(1);
      if (v) {
        ownerId = v.ownerUserId ?? v.purchasedByUserId ?? null;
        // SECURITY: derive amount from server-side remaining balance, not client input
        if (v.valueRemaining != null) {
          serverDerivedAmountIls = parseFloat(v.valueRemaining as string);
        }
      }
    } else if (serialNumber) {
      const [v] = await db.select().from(unifiedVouchers).where(eq(unifiedVouchers.serialNumber, serialNumber)).limit(1);
      if (v) {
        ownerId = v.ownerUserId ?? v.purchasedByUserId ?? null;
        if (v.valueRemaining != null) {
          serverDerivedAmountIls = parseFloat(v.valueRemaining as string);
        }
      }
    }

    if (ownerId && ownerId !== req.user?.uid && !isAdmin(req)) {
      return res.status(403).json({ success: false, error: "Not authorized", traceId: tid });
    }

    if (serverDerivedAmountIls !== undefined && serverDerivedAmountIls <= 0) {
      return res.status(400).json({ success: false, error: "No remaining balance on this voucher", traceId: tid });
    }

    const result = await redeemVoucher({
      voucherId: req.body.voucherId,
      serialNumber: req.body.serialNumber,
      qrToken: req.body.qrToken,
      channel,
      // SECURITY: amount derived from server-side voucher balance — client value ignored
      amountIls: serverDerivedAmountIls,
      washes: req.body.washes,
      actorUserId: req.user?.uid,
      actorRole: "customer",
      externalRef: req.body.externalRef,
      notes: req.body.notes,
    });

    res.json({ success: true, ...result });
  } catch (err: any) {
    logger.warn("[UV] Web redeem failed", { traceId: tid, error: err.message });
    res.status(400).json({ success: false, error: err.message, traceId: tid });
  }
});

// ─────────────────────────────────────────────
// GET /my — caller's vouchers
// ─────────────────────────────────────────────

router.get("/my", requireAuth, async (req: Request, res: Response) => {
  const tid = traceId();
  try {
    const uid = req.user?.uid;
    const rows = await db
      .select()
      .from(unifiedVouchers)
      .where(
        or(
          eq(unifiedVouchers.ownerUserId, uid),
          eq(unifiedVouchers.purchasedByUserId, uid)
        )
      )
      .orderBy(desc(unifiedVouchers.createdAt));

    // Attach ledger balance to each
    const withBalance = await Promise.all(
      rows.map(async (v) => {
        try {
          const details = await getVoucherWithBalance(v.id);
          return details;
        } catch {
          return { ...v, ledgerBalanceValue: null, ledgerBalanceWashes: null, ledgerEntries: [] };
        }
      })
    );

    res.json({ success: true, vouchers: withBalance, traceId: tid });
  } catch (err: any) {
    logger.error("[UV] My vouchers failed", { traceId: tid, error: err.message });
    res.status(500).json({ success: false, error: err.message, traceId: tid });
  }
});

// ─────────────────────────────────────────────
// GET /serial/:sn — by serial number (public-safe lookup for claim flows)
// ─────────────────────────────────────────────

router.get("/serial/:sn", requireAuth, async (req: Request, res: Response) => {
  const tid = traceId();
  try {
    const [voucher] = await db
      .select()
      .from(unifiedVouchers)
      .where(eq(unifiedVouchers.serialNumber, req.params.sn))
      .limit(1);

    if (!voucher) return res.status(404).json({ success: false, error: "Voucher not found", traceId: tid });

    const integrity = await verifyVoucherIntegrity(voucher);
    const details = await getVoucherWithBalance(voucher.id);

    // Strip sensitive fields for non-admin/non-owner
    const isOwner =
      voucher.ownerUserId === req.user?.uid || voucher.purchasedByUserId === req.user?.uid;
    if (!isOwner && !isAdmin(req)) {
      return res.status(403).json({ success: false, error: "Not authorized", traceId: tid });
    }

    res.json({
      success: true,
      voucher: details,
      integrityVerified: integrity.valid,
      integrityReason: integrity.reason ?? null,
      traceId: tid,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message, traceId: tid });
  }
});

// ─────────────────────────────────────────────
// GET /:id — full voucher + balance + integrity
// ─────────────────────────────────────────────

router.get("/:id", requireAuth, async (req: Request, res: Response) => {
  const tid = traceId();
  try {
    const details = await getVoucherWithBalance(req.params.id);

    const isOwner =
      details.ownerUserId === req.user?.uid || details.purchasedByUserId === req.user?.uid;
    if (!isOwner && !isAdmin(req)) {
      return res.status(403).json({ success: false, error: "Not authorized", traceId: tid });
    }

    const integrity = await verifyVoucherIntegrity(details);

    res.json({
      success: true,
      voucher: details,
      integrityVerified: integrity.valid,
      integrityReason: integrity.reason ?? null,
      traceId: tid,
    });
  } catch (err: any) {
    const status = err.message === "Voucher not found" ? 404 : 500;
    res.status(status).json({ success: false, error: err.message, traceId: tid });
  }
});

// ─────────────────────────────────────────────
// GET /:id/ledger — full audit trail (admin only)
// ─────────────────────────────────────────────

router.get("/:id/ledger", requireAuth, async (req: Request, res: Response) => {
  const tid = traceId();
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({ success: false, error: "Admin access required", traceId: tid });
    }

    const entries = await db
      .select()
      .from(unifiedVoucherLedger)
      .where(eq(unifiedVoucherLedger.voucherId, req.params.id))
      .orderBy(unifiedVoucherLedger.seqNo);

    res.json({ success: true, entries, count: entries.length, traceId: tid });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message, traceId: tid });
  }
});

// ─────────────────────────────────────────────
// POST /:id/cancel — admin
// ─────────────────────────────────────────────

router.post("/:id/cancel", requireAuth, validate(cancelSchema), async (req: Request, res: Response) => {
  const tid = traceId();
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({ success: false, error: "Admin access required", traceId: tid });
    }
    await cancelVoucher(req.params.id, req.body.reason, req.user!.uid);
    res.json({ success: true, message: "Voucher cancelled", traceId: tid });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message, traceId: tid });
  }
});

// ─────────────────────────────────────────────
// POST /:id/adjust — admin balance adjustment
// ─────────────────────────────────────────────

router.post("/:id/adjust", requireAuth, validate(adjustSchema), async (req: Request, res: Response) => {
  const tid = traceId();
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({ success: false, error: "Admin access required", traceId: tid });
    }
    await adjustVoucherBalance(req.params.id, {
      deltaValue: req.body.deltaValue,
      deltaWashes: req.body.deltaWashes,
      reason: req.body.reason,
      actorUserId: req.user!.uid,
    });
    const updated = await getVoucherWithBalance(req.params.id);
    res.json({ success: true, voucher: updated, traceId: tid });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message, traceId: tid });
  }
});

export default router;
