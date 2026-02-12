import { Router, Request, Response } from "express";
import { db } from "../db";
import { z } from "zod";
import {
  octopusProviders,
  octopusWallets,
  octopusBookings,
  octopusLedger,
  octopusInvoices,
  users,
} from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { logger } from "../lib/logger";
const router = Router();

const PLATFORM_FEE_RATE = 0.15;

const VALID_PLATFORMS = ["PETSITTER", "PETTREK", "ACADEMY", "PETWASH_HUB"] as const;

function calculateSplit(price: number) {
  const platformFee = Math.round(price * PLATFORM_FEE_RATE);
  const providerShare = price - platformFee;
  return { platformFee, providerShare };
}

function generateId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// =================== CREATE BOOKING ===================
const createBookingSchema = z.object({
  userId: z.string().min(1),
  platform: z.enum(VALID_PLATFORMS),
  price: z.number().int().positive(),
  providerId: z.string().optional(),
  idempotencyKey: z.string().optional(),
});

router.post("/v1/bookings", async (req: Request, res: Response) => {
  try {
    const body = createBookingSchema.parse(req.body);

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
router.post("/v1/bookings/:id/complete", async (req: Request, res: Response) => {
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
      });
    });

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
router.post("/v1/bookings/:id/cancel", async (req: Request, res: Response) => {
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
router.get("/v1/bookings/:id", async (req: Request, res: Response) => {
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
router.get("/v1/bookings", async (req: Request, res: Response) => {
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

router.post("/v1/providers", async (req: Request, res: Response) => {
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
router.post("/v1/providers/:id/approve", async (req: Request, res: Response) => {
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

// =================== HEALTH CHECK ===================
router.get("/health", async (_req: Request, res: Response) => {
  return res.json({
    status: "ok",
    service: "octopus-global-brain-engine",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    platforms: VALID_PLATFORMS,
    feeRate: `${PLATFORM_FEE_RATE * 100}%`,
  });
});

export default router;
