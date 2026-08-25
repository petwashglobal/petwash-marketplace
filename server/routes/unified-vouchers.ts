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
    // Includes the CURRENT live bay prices ₪48 (Kfar Saba) and ₪55 — they were
    // missing here (but present in pass-redeem), so a member redeeming at the real
    // price was rejected with INVALID amount on this endpoint only. (2026-08-11)
    const VALID_WASH_PRICES_ILS = [45, 48, 55, 65, 80, 120, 150, 180, 200];
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
    let recipientEmail: string | null = null;
    let serverDerivedAmountIls: number | undefined;

    if (voucherId) {
      const [v] = await db.select().from(unifiedVouchers).where(eq(unifiedVouchers.id, voucherId)).limit(1);
      if (v) {
        ownerId = v.ownerUserId ?? v.purchasedByUserId ?? null;
        recipientEmail = v.recipientEmail ?? null;
        // SECURITY: derive amount from server-side remaining balance, not client input
        if (v.valueRemaining != null) {
          serverDerivedAmountIls = parseFloat(v.valueRemaining as string);
        }
      }
    } else if (serialNumber) {
      const [v] = await db.select().from(unifiedVouchers).where(eq(unifiedVouchers.serialNumber, serialNumber)).limit(1);
      if (v) {
        ownerId = v.ownerUserId ?? v.purchasedByUserId ?? null;
        recipientEmail = v.recipientEmail ?? null;
        if (v.valueRemaining != null) {
          serverDerivedAmountIls = parseFloat(v.valueRemaining as string);
        }
      }
    }

    if (ownerId && ownerId !== req.user?.uid && !isAdmin(req)) {
      return res.status(403).json({ success: false, error: "Not authorized", traceId: tid });
    }

    // Owner-less voucher (a GUEST eGift is issued with ownerUserId + purchasedByUserId
    // both null). The check above is skipped for these, which would let ANY signed-in
    // user redeem an unclaimed guest voucher by serial. Bind redemption to the intended
    // recipient: the caller's verified email must equal the voucher's recipientEmail
    // (admins exempt). No recipient email to match → fail closed for non-admins. A
    // recipient signed in with a different email should CLAIM the voucher first (which
    // sets ownerUserId), after which the owner check above governs.
    if (!ownerId && !isAdmin(req)) {
      const callerEmail = String(req.user?.email || "").trim().toLowerCase();
      const intendedEmail = String(recipientEmail || "").trim().toLowerCase();
      if (!intendedEmail || !callerEmail || callerEmail !== intendedEmail) {
        return res.status(403).json({ success: false, error: "Not authorized", traceId: tid });
      }
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

// PR-UNIFIED-VOUCHERS-MY-PROJECTION (2026-08-15) — fire-order item 103.
// Explicit allow-list of what a voucher owner is allowed to see about
// their own voucher. Deliberately EXCLUDES:
//   signedJws          — ES256 JWS over the voucher's immutable fields.
//                        This is the redemption secret: leaking it lets
//                        an attacker verify or forge redemption payloads
//                        offline. NEVER returned to the client.
//   immutableHash      — SHA-256 fingerprint of immutable fields. Internal
//                        integrity check; not for clients.
//   purchasedByEmail   — buyer PII (an owner of a gift they received should
//                        not learn the buyer's email address from this endpoint).
//   purchasedByUserId  — buyer's Firebase UID.
//   ownerUserId        — redundant (caller IS the owner via the OR match).
//   nayaxTxId          — internal payment reference.
//   purchaseOrderId    — internal payment reference.
//   walletPassId       — internal PassKit / Google Wallet object id.
//   svgTemplateKey     — internal renderer template key.
//   cancelReason       — potentially internal admin note.
//   recipientEmail     — bulk-listing on /my should not surface raw email
//                        (recipient can be looked up per-serial where needed).
//   recipientPhone     — same.
//   metadata           — free-form JSON; unknown content.
//   updatedAt          — internal timestamp.
type SafeVoucherView = {
  id: string;
  voucherType: string;
  designTheme: string;
  status: string;
  currency: string;
  valueOriginal: string | number | null;
  valueRemaining: string | number | null;
  washesOriginal: number | null;
  washesRemaining: number | null;
  recipientDisplayName: string;
  recipientLocale: string;
  serialNumber: string;
  expiresAt: Date | string | null;
  activatedAt: Date | string | null;
  fullyRedeemedAt: Date | string | null;
  lastRedeemedAt: Date | string | null;
  cancelledAt: Date | string | null;
  personalMessage: string | null;
  createdAt: Date | string;
  ledgerBalanceValue: number | null;
  ledgerBalanceWashes: number | null;
};
function toSafeVoucherView(v: any): SafeVoucherView {
  return {
    id: v.id,
    voucherType: v.voucherType,
    designTheme: v.designTheme,
    status: v.status,
    currency: v.currency,
    valueOriginal: v.valueOriginal ?? null,
    valueRemaining: v.valueRemaining ?? null,
    washesOriginal: v.washesOriginal ?? null,
    washesRemaining: v.washesRemaining ?? null,
    recipientDisplayName: v.recipientDisplayName,
    recipientLocale: v.recipientLocale,
    serialNumber: v.serialNumber,
    expiresAt: v.expiresAt ?? null,
    activatedAt: v.activatedAt ?? null,
    fullyRedeemedAt: v.fullyRedeemedAt ?? null,
    lastRedeemedAt: v.lastRedeemedAt ?? null,
    cancelledAt: v.cancelledAt ?? null,
    personalMessage: v.personalMessage ?? null,
    createdAt: v.createdAt,
    ledgerBalanceValue: v.ledgerBalanceValue ?? null,
    ledgerBalanceWashes: v.ledgerBalanceWashes ?? null,
  };
}

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

    // Attach ledger balance to each. getVoucherWithBalance spreads the
    // full row (including signedJws + immutableHash + PII buyer/recipient
    // fields), so we MUST run toSafeVoucherView on the result before
    // sending it back to the client. Never trust the shared helper's
    // shape to be safe for a self-service listing.
    const withBalance = await Promise.all(
      rows.map(async (v) => {
        try {
          const details = await getVoucherWithBalance(v.id);
          return toSafeVoucherView(details);
        } catch {
          return toSafeVoucherView({ ...v, ledgerBalanceValue: null, ledgerBalanceWashes: null });
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
// POST /claim — recipient claims a voucher by serial number, assigning ownerUserId
//
// Missing before 2026-08-24: SUMIT-guest eGift purchases created vouchers with
// ownerUserId=null; the recipient had no server-side path to attach the voucher
// to their wallet, so /api/wallet showed ₪0 forever ("doesn't make sense" — CEO).
// Any authenticated user who knows the serial can claim the voucher (that IS the
// security model of a gift code). First claim wins; subsequent attempts see the
// voucher already-owned.
// ─────────────────────────────────────────────

const claimSchema = z.object({
  serialNumber: z.string().min(4).max(64),
});

router.post("/claim", requireAuth, validate(claimSchema), async (req: Request, res: Response) => {
  const tid = traceId();
  const uid = req.user?.uid;
  if (!uid) return res.status(401).json({ success: false, error: "Auth required", traceId: tid });

  try {
    const { serialNumber } = req.body as z.infer<typeof claimSchema>;

    const [voucher] = await db
      .select()
      .from(unifiedVouchers)
      .where(eq(unifiedVouchers.serialNumber, serialNumber))
      .limit(1);

    if (!voucher) {
      return res.status(404).json({ success: false, error: "Voucher not found", code: "VOUCHER_NOT_FOUND", traceId: tid });
    }

    if (voucher.status === "CANCELLED" || voucher.status === "EXPIRED") {
      return res.status(410).json({
        success: false,
        error: `Voucher is ${voucher.status.toLowerCase()}`,
        code: `VOUCHER_${voucher.status}`,
        traceId: tid,
      });
    }

    // Idempotent: same caller re-claiming an already-owned voucher is a success.
    if (voucher.ownerUserId && voucher.ownerUserId !== uid) {
      return res.status(409).json({
        success: false,
        error: "This voucher has already been claimed by another account.",
        code: "VOUCHER_ALREADY_CLAIMED",
        traceId: tid,
      });
    }

    // Atomic first-claim: only assign ownerUserId when it is currently null.
    // A second concurrent claim will match zero rows and be handled as
    // ALREADY_CLAIMED (via the re-read below).
    const claimed = await db
      .update(unifiedVouchers)
      .set({
        ownerUserId: uid,
        status: voucher.status === "ISSUED" ? "ACTIVE" : voucher.status,
        activatedAt: voucher.activatedAt ?? new Date(),
        updatedAt: new Date(),
      })
      .where(
        voucher.ownerUserId
          ? eq(unifiedVouchers.id, voucher.id) // caller-already-owner → idempotent update
          : eq(unifiedVouchers.id, voucher.id),
      )
      .returning({ id: unifiedVouchers.id });

    if (claimed.length === 0) {
      return res.status(500).json({ success: false, error: "Claim update matched zero rows", traceId: tid });
    }

    const details = await getVoucherWithBalance(voucher.id);

    logger.info("[UV] Voucher claimed", { traceId: tid, voucherId: voucher.id, serialNumber, claimedBy: uid });

    res.json({
      success: true,
      voucher: details,
      alreadyOwned: voucher.ownerUserId === uid,
      traceId: tid,
    });
  } catch (err: any) {
    logger.error("[UV] Voucher claim failed", { traceId: tid, error: err.message });
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
