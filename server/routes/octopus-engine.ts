/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  DEPRECATED — Octopus Engine V1 API                             ║
 * ║                                                                  ║
 * ║  The V1 booking routes (/v1/bookings*) and V1 provider routes   ║
 * ║  (/v1/providers*) in this file are superseded by the canonical  ║
 * ║  booking flow:                                                   ║
 * ║    POST/GET  /api/booking-requests  (booking-requests.ts)       ║
 * ║    PATCH     /api/provider-dashboard/v2/bookings/:id/:action    ║
 * ║                                                                  ║
 * ║  No frontend surface calls these routes as of 2026-03.          ║
 * ║  Wallet (/v1/wallet*), ledger (/v1/ledger*) and egift routes    ║
 * ║  remain active and are NOT deprecated.                          ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */
import { Router, Request, Response } from "express";
import { createHash, randomBytes } from 'crypto';
import { db } from "../db";
import { z } from "zod";
import {
  octopusProviders,
  octopusWallets,
  octopusBookings,
  octopusLedger,
  octopusInvoices,
  egiftEvents,
  users,
} from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import { egiftFinancialService } from "../services/EgiftFinancialService";
import escrowService from "../services/EscrowService";
import { backupFinancialDocument } from "../services/gcsBackupService";
import { FinancialDocumentService } from "../services/FinancialDocumentService";
import {
  dispatchNotifications,
  buildEgiftPurchasedSms,
  buildEgiftRedeemedSms,
} from "../services/PetWashNotificationEngine";
const router = Router();

const PLATFORM_FEE_RATE = 0.15;

const VALID_PLATFORMS = ["PETSITTER", "PETTREK", "ACADEMY", "PETWASH_HUB"] as const;

function calculateSplit(price: number) {
  const platformFee = Math.round(price * PLATFORM_FEE_RATE);
  const providerShare = price - platformFee;
  return { platformFee, providerShare };
}

function generateId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${randomBytes(4).toString('hex')}`;
}

// =================== CREATE BOOKING ===================
const createBookingSchema = z.object({
  userId: z.string().min(1),
  platform: z.enum(VALID_PLATFORMS),
  price: z.number().int().positive(),
  providerId: z.string().optional(),
  idempotencyKey: z.string().optional(),
});

// [DEPRECATED V1] Use POST /api/booking-requests instead
router.post("/v1/bookings", async (req: Request, res: Response) => {
  logger.warn('[DEPRECATED V1] POST /api/octopus/v1/bookings called — migrate to POST /api/booking-requests');
  try {
    const body = createBookingSchema.parse(req.body);

    // BOLA guard: if Firebase auth token is present, userId in body must match
    const authUid = (req as any).firebaseUser?.uid;
    const isAdminToken = (req as any).firebaseUser?.token?.role === 'admin' ||
                         (req as any).firebaseUser?.token?.admin === true;
    if (authUid && !isAdminToken && body.userId !== authUid) {
      logger.warn('[Octopus] BOLA attempt blocked', { authUid, bodyUserId: body.userId });
      return res.status(403).json({ error: "Cannot create bookings on behalf of other users" });
    }

    if (body.idempotencyKey) {
      const [existing] = await db
        .select()
        .from(octopusBookings)
        .where(eq(octopusBookings.idempotencyKey, body.idempotencyKey))
        .limit(1);

      if (existing) {
        logger.info("[Idempotency] Returning cached booking", { idempotencyKey: body.idempotencyKey, bookingId: existing.id });
        return res.json(existing);
      }
    }

    const [user] = await db.select().from(users).where(eq(users.id, body.userId)).limit(1);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const kycStatus = (user as any).biometricMatchStatus || (user as any).kycStatus || "pending";
    if (kycStatus === "failed" || kycStatus === "rejected") {
      return res.status(403).json({ error: "KYC verification required before booking", kycStatus });
    }

    const split = calculateSplit(body.price);
    const bookingId = generateId("OB");

    const [booking] = await db.insert(octopusBookings).values({
      id: bookingId,
      userId: body.userId,
      platform: body.platform,
      price: body.price,
      platformFee: split.platformFee,
      providerShare: split.providerShare,
      status: "CONFIRMED",
      providerId: body.providerId || null,
      idempotencyKey: body.idempotencyKey || null,
    }).returning();

    await db.insert(octopusLedger).values({
      id: generateId("OL"),
      type: "BOOKING_CREATED",
      bookingId: booking.id,
      amount: body.price,
      platform: body.platform,
    });

    logger.info("[Booking] Created", {
      bookingId: booking.id,
      platform: body.platform,
      price: body.price,
      platformFee: split.platformFee,
      providerShare: split.providerShare,
    });

    return res.status(201).json(booking);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: err.errors });
    }
    logger.error("[Booking] Creation failed", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// =================== WALLET REDEEM (Atomic with row-level safety) ===================
const walletRedeemSchema = z.object({
  userId: z.string().min(1),
  platform: z.enum(VALID_PLATFORMS),
  amount: z.number().int().positive(),
  idempotencyKey: z.string().optional(),
});

router.post("/v1/wallet/redeem", async (req: Request, res: Response) => {
  try {
    const body = walletRedeemSchema.parse(req.body);

    if (body.idempotencyKey) {
      const [existingLedger] = await db
        .select()
        .from(octopusLedger)
        .where(and(
          eq(octopusLedger.type, "WALLET_DEBIT"),
          sql`${octopusLedger.metadata}->>'idempotencyKey' = ${body.idempotencyKey}`
        ))
        .limit(1);

      if (existingLedger) {
        return res.json({ success: true, deducted: existingLedger.amount, idempotent: true });
      }
    }

    const result = await db.transaction(async (tx) => {
      const updated = await tx
        .update(octopusWallets)
        .set({
          balance: sql`${octopusWallets.balance} - ${body.amount}`,
          updatedAt: new Date(),
        })
        .where(and(
          eq(octopusWallets.userId, body.userId),
          sql`${octopusWallets.balance} >= ${body.amount}`
        ))
        .returning();

      if (updated.length === 0) {
        const [wallet] = await tx
          .select()
          .from(octopusWallets)
          .where(eq(octopusWallets.userId, body.userId))
          .limit(1);

        if (!wallet) {
          throw { status: 404, message: "Wallet not found" };
        }
        throw { status: 400, message: "Insufficient balance", available: wallet.balance, requested: body.amount };
      }

      const walletAfter = updated[0];

      await tx.insert(octopusLedger).values({
        id: generateId("OL"),
        type: "WALLET_DEBIT",
        walletId: walletAfter.id,
        amount: body.amount,
        platform: body.platform,
        metadata: body.idempotencyKey ? { idempotencyKey: body.idempotencyKey } : {},
      });

      return { success: true, deducted: body.amount, remainingBalance: walletAfter.balance };
    });

    logger.info("[Wallet] Redeemed", { userId: body.userId, amount: body.amount, platform: body.platform });
    return res.json(result);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: err.errors });
    }
    if (err.status) {
      return res.status(err.status).json({ error: err.message, ...err });
    }
    logger.error("[Wallet] Redeem failed", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// =================== WALLET CREDIT ===================
const walletCreditSchema = z.object({
  userId: z.string().min(1),
  platform: z.enum(VALID_PLATFORMS),
  amount: z.number().int().positive(),
});

router.post("/v1/wallet/credit", async (req: Request, res: Response) => {
  try {
    const body = walletCreditSchema.parse(req.body);

    const result = await db.transaction(async (tx) => {
      let [wallet] = await tx
        .select()
        .from(octopusWallets)
        .where(eq(octopusWallets.userId, body.userId))
        .limit(1);

      if (!wallet) {
        [wallet] = await tx.insert(octopusWallets).values({
          id: generateId("OW"),
          userId: body.userId,
          balance: 0,
        }).returning();
      }

      await tx
        .update(octopusWallets)
        .set({
          balance: sql`${octopusWallets.balance} + ${body.amount}`,
          updatedAt: new Date(),
        })
        .where(eq(octopusWallets.userId, body.userId));

      await tx.insert(octopusLedger).values({
        id: generateId("OL"),
        type: "WALLET_CREDIT",
        walletId: wallet.id,
        amount: body.amount,
        platform: body.platform,
      });

      return { success: true, credited: body.amount, newBalance: wallet.balance + body.amount };
    });

    logger.info("[Wallet] Credited", { userId: body.userId, amount: body.amount, platform: body.platform });
    return res.json(result);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: err.errors });
    }
    logger.error("[Wallet] Credit failed", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// =================== WALLET BALANCE ===================
router.get("/v1/wallet/:userId", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const [wallet] = await db
      .select()
      .from(octopusWallets)
      .where(eq(octopusWallets.userId, userId))
      .limit(1);

    if (!wallet) {
      return res.json({
        userId,
        balance: 0,
        petwashCredits: 0,
        petsitterCredits: 0,
        pettrekCredits: 0,
        academyCredits: 0,
      });
    }

    return res.json(wallet);
  } catch (err: any) {
    logger.error("[Wallet] Balance fetch failed", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// =================== COMPLETE BOOKING (Race-safe) ===================
// [DEPRECATED V1] Use PATCH /api/booking-requests/:id/complete instead
router.post("/v1/bookings/:id/complete", async (req: Request, res: Response) => {
  logger.warn('[DEPRECATED V1] POST /api/octopus/v1/bookings/:id/complete called — migrate to PATCH /api/booking-requests/:id/complete');
  try {
    const { id } = req.params;

    await db.transaction(async (tx) => {
      const updated = await tx
        .update(octopusBookings)
        .set({ status: "COMPLETED", updatedAt: new Date() })
        .where(and(
          eq(octopusBookings.id, id),
          sql`${octopusBookings.status} NOT IN ('COMPLETED', 'CANCELLED')`
        ))
        .returning();

      if (updated.length === 0) {
        const [existing] = await tx
          .select()
          .from(octopusBookings)
          .where(eq(octopusBookings.id, id))
          .limit(1);

        if (!existing) {
          throw { status: 404, message: "Booking not found" };
        }
        if (existing.status === "COMPLETED") {
          throw { status: 200, message: "Booking already completed", alreadyDone: true };
        }
        throw { status: 400, message: `Cannot complete a ${existing.status.toLowerCase()} booking` };
      }

      const booking = updated[0];

      const ledgerEntries = [
        { id: generateId("OL"), type: "PAYMENT_CAPTURED", bookingId: id, amount: booking.price, platform: booking.platform },
        { id: generateId("OL"), type: "PROVIDER_EARNING", bookingId: id, amount: booking.providerShare, platform: booking.platform },
        { id: generateId("OL"), type: "PLATFORM_FEE", bookingId: id, amount: booking.platformFee, platform: booking.platform },
      ];

      for (const entry of ledgerEntries) {
        await tx.insert(octopusLedger).values(entry);
      }

      const docNumber = `INV-${Date.now()}`;
      await tx.insert(octopusInvoices).values({
        id: generateId("OI"),
        bookingId: id,
        docNumber,
      });

      await tx.insert(octopusLedger).values({
        id: generateId("OL"),
        type: "INVOICE_ISSUED",
        bookingId: id,
        amount: booking.price,
        platform: booking.platform,
      });

      logger.info("[Booking] Completed", {
        bookingId: id,
        price: booking.price,
        platformFee: booking.platformFee,
        providerShare: booking.providerShare,
        docNumber,
      });
    });

    // Release escrow funds (non-blocking, outside transaction)
    (async () => {
      try {
        await escrowService.releaseEscrowPayment(id, 'octopus_engine_completion');
        logger.info("[Escrow] Released after booking completion", { bookingId: id });
      } catch (escrowErr: any) {
        logger.warn("[Escrow] Release failed (may not have escrow record)", { bookingId: id, error: escrowErr?.message });
      }
    })();

    // Backup financial records to Google Cloud Storage (non-blocking)
    (async () => {
      try {
        const [completedBooking] = await db.select().from(octopusBookings).where(eq(octopusBookings.id, id)).limit(1);
        if (completedBooking) {
          const ledgerEntries = await db.select().from(octopusLedger).where(eq(octopusLedger.bookingId, id));
          const financialRecord = JSON.stringify({
            booking: completedBooking,
            ledgerEntries,
            completedAt: new Date().toISOString(),
            integrityHash: createHash('sha256').update(JSON.stringify(completedBooking)).digest('hex'),
          }, null, 2);
          await backupFinancialDocument({
            documentType: 'ledger_export',
            bookingId: id,
            platform: completedBooking.platform,
            content: financialRecord,
            metadata: {
              totalPrice: completedBooking.price.toString(),
              platformFee: completedBooking.platformFee.toString(),
              providerShare: completedBooking.providerShare.toString(),
            },
          });
        }
      } catch (gcsErr: any) {
        logger.warn("[GCS] Financial backup failed (non-blocking)", { bookingId: id, error: gcsErr?.message });
      }
    })();

    return res.json({ success: true });
  } catch (err: any) {
    if (err.alreadyDone) {
      return res.json({ success: true, message: err.message });
    }
    if (err.status && err.status !== 200) {
      return res.status(err.status).json({ error: err.message });
    }
    logger.error("[Booking] Completion failed", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// =================== CANCEL BOOKING (Race-safe) ===================
// [DEPRECATED V1] Use POST /api/booking-requests/:id/cancel instead
router.post("/v1/bookings/:id/cancel", async (req: Request, res: Response) => {
  logger.warn('[DEPRECATED V1] POST /api/octopus/v1/bookings/:id/cancel called — migrate to POST /api/booking-requests/:id/cancel');
  try {
    const { id } = req.params;

    const updated = await db
      .update(octopusBookings)
      .set({ status: "CANCELLED", updatedAt: new Date() })
      .where(and(
        eq(octopusBookings.id, id),
        sql`${octopusBookings.status} NOT IN ('COMPLETED', 'CANCELLED')`
      ))
      .returning();

    if (updated.length === 0) {
      const [existing] = await db
        .select()
        .from(octopusBookings)
        .where(eq(octopusBookings.id, id))
        .limit(1);

      if (!existing) {
        return res.status(404).json({ error: "Booking not found" });
      }
      return res.status(400).json({ error: `Cannot cancel a ${existing.status.toLowerCase()} booking` });
    }

    logger.info("[Booking] Cancelled", { bookingId: id });
    return res.json({ success: true });
  } catch (err: any) {
    logger.error("[Booking] Cancellation failed", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// =================== GET BOOKING (with ledger + invoice) ===================
// [DEPRECATED V1] Use GET /api/booking-requests/:id instead
router.get("/v1/bookings/:id", async (req: Request, res: Response) => {
  logger.warn('[DEPRECATED V1] GET /api/octopus/v1/bookings/:id called — migrate to GET /api/booking-requests/:id');
  try {
    const { id } = req.params;

    const [booking] = await db
      .select()
      .from(octopusBookings)
      .where(eq(octopusBookings.id, id))
      .limit(1);

    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    const ledgerEntries = await db
      .select()
      .from(octopusLedger)
      .where(eq(octopusLedger.bookingId, id));

    const [invoice] = await db
      .select()
      .from(octopusInvoices)
      .where(eq(octopusInvoices.bookingId, id))
      .limit(1);

    return res.json({ booking, ledger: ledgerEntries, invoice: invoice || null });
  } catch (err: any) {
    logger.error("[Booking] Fetch failed", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// =================== LIST BOOKINGS ===================
// [DEPRECATED V1] Use GET /api/booking-requests instead
router.get("/v1/bookings", async (req: Request, res: Response) => {
  logger.warn('[DEPRECATED V1] GET /api/octopus/v1/bookings called — migrate to GET /api/booking-requests');
  try {
    const { userId, platform } = req.query;

    const conditions = [];
    if (userId) conditions.push(eq(octopusBookings.userId, userId as string));
    if (platform && VALID_PLATFORMS.includes(platform as any)) {
      conditions.push(eq(octopusBookings.platform, platform as string));
    }

    const bookings = await db
      .select()
      .from(octopusBookings)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(sql`${octopusBookings.createdAt} DESC`)
      .limit(100);

    return res.json({ bookings, total: bookings.length });
  } catch (err: any) {
    logger.error("[Bookings] List failed", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// =================== PROVIDER SEARCH ===================
router.get("/v1/providers/search", async (req: Request, res: Response) => {
  try {
    const { city, service } = req.query;

    const conditions = [
      eq(octopusProviders.approved, true),
      eq(octopusProviders.visible, true),
    ];

    if (city) {
      conditions.push(eq(octopusProviders.cityNormalized, (city as string).toLowerCase()));
    }

    let providers = await db
      .select()
      .from(octopusProviders)
      .where(and(...conditions));

    if (service && VALID_PLATFORMS.includes(service as any)) {
      providers = providers.filter((p: any) => {
        const services = Array.isArray(p.services) ? p.services : [];
        return services.includes(service);
      });
    }

    return res.json({ providers, total: providers.length });
  } catch (err: any) {
    logger.error("[Provider Search] Failed", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// =================== REGISTER PROVIDER ===================
const registerProviderSchema = z.object({
  userId: z.string().min(1),
  city: z.string().min(1),
  services: z.array(z.enum(VALID_PLATFORMS)).min(1),
});

// [DEPRECATED V1] Provider registration now handled by the provider application flow
router.post("/v1/providers", async (req: Request, res: Response) => {
  logger.warn('[DEPRECATED V1] POST /api/octopus/v1/providers called — use canonical provider application flow');
  try {
    const body = registerProviderSchema.parse(req.body);

    const [user] = await db.select().from(users).where(eq(users.id, body.userId)).limit(1);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const [existing] = await db
      .select()
      .from(octopusProviders)
      .where(eq(octopusProviders.userId, body.userId))
      .limit(1);

    if (existing) {
      return res.status(409).json({ error: "Provider already registered", provider: existing });
    }

    const [provider] = await db.insert(octopusProviders).values({
      id: generateId("OP"),
      userId: body.userId,
      city: body.city,
      cityNormalized: body.city.toLowerCase(),
      services: body.services,
      approved: false,
      visible: false,
    }).returning();

    logger.info("[Provider] Registered", { providerId: provider.id, userId: body.userId, city: body.city });
    return res.status(201).json(provider);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: err.errors });
    }
    logger.error("[Provider] Registration failed", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// =================== APPROVE PROVIDER (KYC enforced) ===================
// [DEPRECATED V1] Provider approval now handled by the admin panel / provider application flow
router.post("/v1/providers/:id/approve", async (req: Request, res: Response) => {
  logger.warn('[DEPRECATED V1] POST /api/octopus/v1/providers/:id/approve called — use admin panel approval flow');
  try {
    const { id } = req.params;

    const [provider] = await db
      .select()
      .from(octopusProviders)
      .where(eq(octopusProviders.id, id))
      .limit(1);

    if (!provider) {
      return res.status(404).json({ error: "Provider not found" });
    }

    const [user] = await db.select().from(users).where(eq(users.id, provider.userId)).limit(1);
    if (user) {
      const kycStatus = (user as any).biometricMatchStatus || (user as any).kycStatus || "pending";
      if (kycStatus === "pending" || kycStatus === "failed") {
        return res.status(403).json({
          error: "Provider KYC not verified",
          kycStatus,
          message: "Provider must complete KYC verification before approval",
        });
      }
    }

    await db
      .update(octopusProviders)
      .set({ approved: true, visible: true })
      .where(eq(octopusProviders.id, id));

    logger.info("[Provider] Approved", { providerId: id });
    return res.json({ success: true });
  } catch (err: any) {
    logger.error("[Provider] Approval failed", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// =================== LEDGER QUERY ===================
router.get("/v1/ledger", async (req: Request, res: Response) => {
  try {
    const { bookingId, platform, type, walletId } = req.query;

    const conditions = [];
    if (bookingId) conditions.push(eq(octopusLedger.bookingId, bookingId as string));
    if (walletId) conditions.push(eq(octopusLedger.walletId, walletId as string));
    if (platform) conditions.push(eq(octopusLedger.platform, platform as string));
    if (type) conditions.push(eq(octopusLedger.type, type as string));

    const entries = await db
      .select()
      .from(octopusLedger)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(sql`${octopusLedger.createdAt} DESC`)
      .limit(500);

    return res.json({ entries, total: entries.length });
  } catch (err: any) {
    logger.error("[Ledger] Query failed", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// =================== BRAIN REDEEM (Single atomic e-gift redeem) ===================
const brainRedeemSchema = z.object({
  platform: z.string().min(1),
  product: z.string().min(1),
  stationId: z.string().optional(),
  baySide: z.string().optional(),
  egiftId: z.string().min(1),
  userId: z.string().min(1),
  amountCents: z.number().int().positive(),
  idempotencyKey: z.string().min(1),
});

router.post("/v1/brain/redeem", async (req: Request, res: Response) => {
  try {
    const body = brainRedeemSchema.parse(req.body);
    const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || '';

    const result = await egiftFinancialService.brainRedeem({
      ...body,
      ipAddress,
    });

    logger.info("[Brain] E-gift redeemed", {
      egiftId: body.egiftId,
      bookingId: result.bookingId,
      platform: body.platform,
      product: body.product,
      stationId: body.stationId,
      amountCents: body.amountCents,
      idempotent: result.idempotent,
    });

    // ── eGift redemption document + notifications (fire-and-forget) ──
    if (!result.idempotent) {
      (async () => {
        try {
          const [redeemer] = await db.select({ email: users.email, phone: users.phone })
            .from(users).where(eq(users.id, body.userId)).limit(1);

          const redemptionRef = result.bookingId || `RDM-${Date.now()}`;
          const amountILS = (body.amountCents / 100).toFixed(2);
          const issuedAt = new Date().toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem' });

          const redemptionHtml = `<!DOCTYPE html><html><body style="font-family:Arial;direction:rtl;text-align:right;padding:24px;">
<h2>PetWash™ — אישור מימוש כרטיס מתנה</h2>
<table style="border-collapse:collapse;width:100%;max-width:480px;">
  <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#555;">מס׳ מימוש</td><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">${redemptionRef}</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#555;">מס׳ כרטיס מתנה</td><td style="padding:8px;border-bottom:1px solid #eee;">${body.egiftId}</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#555;">סכום מומש</td><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;color:#1a7a1a;">₪${amountILS}</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#555;">פלטפורמה</td><td style="padding:8px;border-bottom:1px solid #eee;">${body.platform}</td></tr>
  ${body.stationId ? `<tr><td style="padding:8px;border-bottom:1px solid #eee;color:#555;">עמדה</td><td style="padding:8px;border-bottom:1px solid #eee;">${body.stationId}</td></tr>` : ''}
  <tr><td style="padding:8px;color:#555;">תאריך</td><td style="padding:8px;">${issuedAt}</td></tr>
</table>
<p style="margin-top:16px;font-size:12px;color:#888;">PetWash Ltd. | support@petwash.co.il</p>
</body></html>`;

          const docRef = await FinancialDocumentService.create({
            userId: body.userId,
            bookingId: result.bookingId,
            transactionId: body.idempotencyKey,
            documentType: 'egift_redemption_receipt',
            issuedByEntity: 'PetWash',
            documentPayloadJson: {
              egiftId: body.egiftId,
              redemptionRef,
              amountCents: body.amountCents,
              amountILS,
              currency: 'ILS',
              platform: body.platform,
              product: body.product,
              stationId: body.stationId,
              baySide: body.baySide,
            },
            renderedHtml: redemptionHtml,
            idempotencyKey: `egift_redemption_receipt:${body.egiftId}:${body.userId}`,
          });

          await dispatchNotifications({
            userId: body.userId,
            eventType: 'egift_redeemed',
            templateKey: 'customer_egift_redeemed',
            transactionId: body.idempotencyKey,
            channels: ['sms', 'push'],
            sms: redeemer?.phone ? {
              to: redeemer.phone,
              text: buildEgiftRedeemedSms({
                redemptionRef,
                amountILS,
                stationId: body.stationId,
              }),
            } : undefined,
            push: {
              userId: body.userId,
              title: `כרטיס מתנה מומש – Pet Wash™ ✅`,
              body: `₪${amountILS} מומשו בהצלחה! מס׳ ${redemptionRef}`,
              data: { egiftId: body.egiftId, documentRef: docRef, type: 'egift_redeemed' },
            },
            debugPayload: {
              egiftId: body.egiftId,
              redemptionRef,
              amountILS,
              smsText: buildEgiftRedeemedSms({ redemptionRef, amountILS, stationId: body.stationId }),
              pushTitle: `כרטיס מתנה מומש – Pet Wash™ ✅`,
              pushBody: `₪${amountILS} מומשו בהצלחה`,
              documentRef: docRef,
            },
          });
        } catch (notifErr: any) {
          logger.error('[Brain] Post-redeem notification failed silently', { error: notifErr?.message });
        }
      })();
    }

    return res.json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: err.errors });
    }
    if (err.message?.includes('Rate limit')) {
      return res.status(429).json({ error: err.message });
    }
    if (err.message?.includes('Insufficient')) {
      return res.status(400).json({ error: err.message });
    }
    if (err.message?.includes('not found')) {
      return res.status(404).json({ error: err.message });
    }
    logger.error("[Brain] Redeem failed", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// =================== EGIFT PURCHASE (Idempotent) ===================
const egiftPurchaseSchema = z.object({
  userId: z.string().min(1),
  egiftId: z.string().min(1),
  amountCents: z.number().int().positive(),
  currency: z.string().optional(),
  paymentMethodRef: z.string().optional(),
  recipientEmail: z.string().email().optional(),
  recipientName: z.string().optional(),
  senderName: z.string().optional(),
  message: z.string().optional(),
  idempotencyKey: z.string().min(1),
});

router.post("/v1/egift/purchase", async (req: Request, res: Response) => {
  try {
    const body = egiftPurchaseSchema.parse(req.body);
    const result = await egiftFinancialService.purchaseEgift(body);

    logger.info("[Egift] Purchase completed", {
      egiftId: body.egiftId,
      amountCents: body.amountCents,
      userId: body.userId,
      idempotent: result.idempotent,
    });

    // ── Financial document + multi-channel notification (fire-and-forget) ──
    if (!result.idempotent) {
      (async () => {
        try {
          const [buyer] = await db.select({ email: users.email, phone: users.phone })
            .from(users).where(eq(users.id, body.userId)).limit(1);

          const giftValueILS = (body.amountCents / 100).toFixed(2);
          const giftRef = result.invoiceId || body.egiftId;

          const receiptHtml = `<!DOCTYPE html><html><body style="font-family:Arial;direction:rtl;text-align:right;padding:24px;">
<h2>PetWash™ — אישור רכישת כרטיס מתנה</h2>
<table style="border-collapse:collapse;width:100%;max-width:480px;">
  <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#555;">מס׳ מתנה</td><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">${giftRef}</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#555;">שווי</td><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">₪${giftValueILS}</td></tr>
  ${body.recipientName ? `<tr><td style="padding:8px;border-bottom:1px solid #eee;color:#555;">מקבל המתנה</td><td style="padding:8px;border-bottom:1px solid #eee;">${body.recipientName}</td></tr>` : ''}
  <tr><td style="padding:8px;color:#555;">תאריך</td><td style="padding:8px;">${new Date().toLocaleDateString('he-IL')}</td></tr>
</table>
<p style="margin-top:16px;font-size:12px;color:#888;">PetWash Ltd. | support@petwash.co.il | petwash.co.il</p>
</body></html>`;

          const docRef = await FinancialDocumentService.create({
            userId: body.userId,
            transactionId: result.invoiceId,
            documentType: 'egift_receipt',
            issuedByEntity: 'PetWash',
            documentPayloadJson: {
              egiftId: body.egiftId,
              giftRef,
              amountCents: body.amountCents,
              currency: body.currency || 'ILS',
              recipientEmail: body.recipientEmail,
              recipientName: body.recipientName,
              invoiceId: result.invoiceId,
            },
            renderedHtml: receiptHtml,
          });

          await dispatchNotifications({
            userId: body.userId,
            eventType: 'egift_purchased',
            templateKey: 'customer_egift_purchased',
            transactionId: result.invoiceId,
            channels: ['sms', 'push'],
            sms: buyer?.phone ? {
              to: buyer.phone,
              text: buildEgiftPurchasedSms({
                giftRef,
                giftValue: giftValueILS,
                recipientName: body.recipientName,
              }),
            } : undefined,
            push: {
              userId: body.userId,
              title: `כרטיס מתנה נרכש – Pet Wash™ 🎁`,
              body: `כרטיס מתנה בשווי ₪${giftValueILS} נרכש בהצלחה! מס׳ ${giftRef}`,
              data: { egiftId: body.egiftId, documentRef: docRef, type: 'egift_purchased' },
            },
            debugPayload: { egiftId: body.egiftId, invoiceId: result.invoiceId, documentRef: docRef },
          });
        } catch (notifErr: any) {
          logger.error('[Egift] Post-purchase notification failed silently', { error: notifErr?.message });
        }
      })();
    }

    return res.status(result.idempotent ? 200 : 201).json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: err.errors });
    }
    logger.error("[Egift] Purchase failed", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// =================== EGIFT AUDIT TRAIL ===================
router.get("/v1/egift/:egiftId/events", async (req: Request, res: Response) => {
  try {
    const { egiftId } = req.params;
    const events = await egiftFinancialService.getEgiftAuditTrail(egiftId);
    return res.json({ success: true, egiftId, events, total: events.length });
  } catch (err: any) {
    logger.error("[Egift] Audit trail fetch failed", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/v1/egift/user/:userId/events", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    const events = await egiftFinancialService.getUserEgiftEvents(userId, limit);
    return res.json({ success: true, userId, events, total: events.length });
  } catch (err: any) {
    logger.error("[Egift] User events fetch failed", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// =================== HEALTH CHECK ===================
router.get("/health", async (_req: Request, res: Response) => {
  return res.json({
    status: "ok",
    service: "octopus-global-brain-engine",
    version: "1.1.0",
    timestamp: new Date().toISOString(),
    platforms: VALID_PLATFORMS,
    feeRate: `${PLATFORM_FEE_RATE * 100}%`,
    features: ["brain-redeem", "idempotent-purchase", "egift-audit-trail", "rate-limiting"],
  });
});

export default router;
