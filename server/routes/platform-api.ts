import { Router, Request, Response } from "express";
import { platformService } from "../services/PlatformService";
import { enhancedBookingService, BOOKING_STATUS, type BookingStatus } from "../services/EnhancedBookingService";
import { requirePlatform, requireFeature, requireBookingAuth, type PlatformFeature } from "../middleware/platformContext";
import { logAuditEvent } from "../middleware/auditLogger";
import { z } from "zod";

function getUserId(req: Request): string | null {
  return (req as any).user?.id || (req as any).session?.userId || null;
}

function getUserRoles(req: Request): string[] {
  return ((req as any).user?.roles || (req as any).session?.roles || []) as string[];
}

function isAdmin(req: Request): boolean {
  const roles = getUserRoles(req);
  return roles.includes("admin") || roles.includes("super_admin");
}

const router = Router();

const BookingCreateSchema = z.object({
  providerId: z.number().optional(),
  stationId: z.number().optional(),
  pickupLocationId: z.number().optional(),
  dropoffLocationId: z.number().optional(),
  startTime: z.string().transform((s) => new Date(s)),
  endTime: z.string().transform((s) => new Date(s)),
  timezone: z.string().default("Asia/Jerusalem"),
  serviceType: z.string().optional(),
  serviceDescription: z.string().optional(),
  specialRequests: z.string().optional(),
  petIds: z.array(z.number()).optional(),
  items: z
    .array(
      z.object({
        itemType: z.string(),
        name: z.string(),
        nameHe: z.string().optional(),
        description: z.string().optional(),
        quantity: z.number().min(1),
        unitPrice: z.number().min(0),
      })
    )
    .optional(),
});

const StatusTransitionSchema = z.object({
  status: z.enum([
    "draft",
    "quoted",
    "meet_greet_requested",
    "meet_greet_scheduled",
    "meet_greet_completed",
    "pending_payment",
    "confirmed",
    "in_progress",
    "completed",
    "cancelled",
    "disputed",
    "refunded",
  ]),
  reason: z.string().optional(),
});

const PaymentSchema = z.object({
  paymentMethod: z.string(),
  gateway: z.string().default("nayax"),
});

router.get("/platforms", async (req: Request, res: Response) => {
  try {
    const includeInactive = req.query.includeInactive === "true";
    const platforms = await platformService.listPlatforms(includeInactive);

    res.json({
      platforms: platforms.map((p) => ({
        id: p.id,
        name: p.name,
        nameHe: p.nameHe,
        description: p.description,
        descriptionHe: p.descriptionHe,
        isActive: p.isActive,
        features: p.features,
        bookingMode: p.bookingMode,
        platformFeePercent: p.platformFeePercent,
      })),
      requestId: req.platformCtx?.requestId,
    });
  } catch (error) {
    console.error("[PlatformAPI] List platforms error:", error);
    res.status(500).json({
      error: { code: "INTERNAL", message: "Failed to list platforms", requestId: req.platformCtx?.requestId },
    });
  }
});

router.get("/platforms/:id", async (req: Request, res: Response) => {
  try {
    const platform = await platformService.getPlatformById(req.params.id);

    if (!platform) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Platform not found", requestId: req.platformCtx?.requestId },
      });
    }

    res.json({ platform, requestId: req.platformCtx?.requestId });
  } catch (error) {
    console.error("[PlatformAPI] Get platform error:", error);
    res.status(500).json({
      error: { code: "INTERNAL", message: "Failed to get platform", requestId: req.platformCtx?.requestId },
    });
  }
});

router.post("/platforms/seed", async (req: Request, res: Response) => {
  try {
    const result = await platformService.seedDefaultPlatforms();

    await logAuditEvent(req, "platforms.seeded", undefined, result);

    res.json({
      message: "Platforms seeded successfully",
      ...result,
      requestId: req.platformCtx?.requestId,
    });
  } catch (error) {
    console.error("[PlatformAPI] Seed platforms error:", error);
    res.status(500).json({
      error: { code: "INTERNAL", message: "Failed to seed platforms", requestId: req.platformCtx?.requestId },
    });
  }
});

router.post(
  "/bookings",
  requirePlatform,
  requireFeature("bookings"),
  async (req: Request, res: Response) => {
    try {
      const parsed = BookingCreateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: { code: "VALIDATION", message: parsed.error.message, requestId: req.platformCtx?.requestId },
        });
      }

      const userId = (req as any).user?.id || (req as any).session?.userId;
      if (!userId) {
        return res.status(401).json({
          error: { code: "UNAUTHENTICATED", message: "Login required", requestId: req.platformCtx?.requestId },
        });
      }

      const platform = req.platformCtx!.platform;
      const booking = await enhancedBookingService.createBooking(
        {
          ...parsed.data,
          platformId: platform.id,
          userId,
        },
        platform
      );

      await logAuditEvent(req, "booking.created", { type: "booking", id: booking.id });

      res.status(201).json({ booking, requestId: req.platformCtx?.requestId });
    } catch (error) {
      console.error("[PlatformAPI] Create booking error:", error);
      res.status(500).json({
        error: { code: "INTERNAL", message: "Failed to create booking", requestId: req.platformCtx?.requestId },
      });
    }
  }
);

router.get("/bookings/:id", requirePlatform, requireBookingAuth, async (req: Request, res: Response) => {
  try {
    const platform = req.platformCtx!.platform;
    const booking = await enhancedBookingService.getBookingWithDetails(req.params.id, platform.id);
    const userId = getUserId(req);

    if (!booking) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Booking not found", requestId: req.platformCtx?.requestId },
      });
    }

    const isOwner = booking.userId === userId;
    const isProviderOfBooking = booking.provider && String(booking.provider.userId) === userId;
    const canAccess = isOwner || isProviderOfBooking || isAdmin(req);

    if (!canAccess) {
      return res.status(403).json({
        error: { code: "FORBIDDEN", message: "You do not have access to this booking", requestId: req.platformCtx?.requestId },
      });
    }

    res.json({ booking, requestId: req.platformCtx?.requestId });
  } catch (error) {
    console.error("[PlatformAPI] Get booking error:", error);
    res.status(500).json({
      error: { code: "INTERNAL", message: "Failed to get booking", requestId: req.platformCtx?.requestId },
    });
  }
});

router.get("/bookings/:id/quote", requirePlatform, requireBookingAuth, async (req: Request, res: Response) => {
  try {
    const platform = req.platformCtx!.platform;
    const booking = await enhancedBookingService.getBookingWithDetails(req.params.id, platform.id);
    const userId = getUserId(req);

    if (!booking) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Booking not found", requestId: req.platformCtx?.requestId },
      });
    }

    const isOwner = booking.userId === userId;
    const isProviderOfBooking = booking.provider && String(booking.provider.userId) === userId;
    if (!isOwner && !isProviderOfBooking && !isAdmin(req)) {
      return res.status(403).json({
        error: { code: "FORBIDDEN", message: "You do not have access to this booking", requestId: req.platformCtx?.requestId },
      });
    }

    const quote = await enhancedBookingService.getQuote(req.params.id, platform);
    res.json({ quote, requestId: req.platformCtx?.requestId });
  } catch (error) {
    console.error("[PlatformAPI] Get quote error:", error);
    res.status(500).json({
      error: { code: "INTERNAL", message: "Failed to get quote", requestId: req.platformCtx?.requestId },
    });
  }
});

router.post("/bookings/:id/status", requirePlatform, requireBookingAuth, async (req: Request, res: Response) => {
  try {
    const parsed = StatusTransitionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: { code: "VALIDATION", message: parsed.error.message, requestId: req.platformCtx?.requestId },
      });
    }

    const platform = req.platformCtx!.platform;
    const booking = await enhancedBookingService.getBookingWithDetails(req.params.id, platform.id);
    const userId = getUserId(req);

    if (!booking) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Booking not found", requestId: req.platformCtx?.requestId },
      });
    }

    const isOwner = booking.userId === userId;
    const isProviderOfBooking = booking.provider && String(booking.provider.userId) === userId;
    if (!isOwner && !isProviderOfBooking && !isAdmin(req)) {
      return res.status(403).json({
        error: { code: "FORBIDDEN", message: "You cannot modify this booking", requestId: req.platformCtx?.requestId },
      });
    }

    const userRoles = getUserRoles(req);
    let actorRole: "user" | "provider" | "admin" | "system" = "user";
    if (isAdmin(req)) {
      actorRole = "admin";
    } else if (isProviderOfBooking) {
      actorRole = "provider";
    }

    const result = await enhancedBookingService.transitionStatus(
      req.params.id,
      parsed.data.status as BookingStatus,
      actorRole,
      userId || undefined,
      { reason: parsed.data.reason },
      req.platformCtx!.platform.id
    );

    if (!result.success) {
      return res.status(400).json({
        error: { code: "INVALID_TRANSITION", message: result.error, requestId: req.platformCtx?.requestId },
      });
    }

    await logAuditEvent(req, "booking.status_changed", { type: "booking", id: req.params.id }, {
      newStatus: parsed.data.status,
    });

    res.json({ booking: result.booking, requestId: req.platformCtx?.requestId });
  } catch (error) {
    console.error("[PlatformAPI] Status transition error:", error);
    res.status(500).json({
      error: { code: "INTERNAL", message: "Failed to transition status", requestId: req.platformCtx?.requestId },
    });
  }
});

router.post(
  "/bookings/:id/pay",
  requirePlatform,
  requireBookingAuth,
  requireFeature("payments"),
  async (req: Request, res: Response) => {
    try {
      const parsed = PaymentSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: { code: "VALIDATION", message: parsed.error.message, requestId: req.platformCtx?.requestId },
        });
      }

      const platform = req.platformCtx!.platform;
      const booking = await enhancedBookingService.getBookingWithDetails(req.params.id, platform.id);
      const userId = getUserId(req);

      if (!booking) {
        return res.status(404).json({
          error: { code: "NOT_FOUND", message: "Booking not found", requestId: req.platformCtx?.requestId },
        });
      }

      if (booking.userId !== userId && !isAdmin(req)) {
        return res.status(403).json({
          error: { code: "FORBIDDEN", message: "Only the booking owner can make payment", requestId: req.platformCtx?.requestId },
        });
      }

      const result = await enhancedBookingService.processPayment(
        req.params.id,
        parsed.data.paymentMethod,
        parsed.data.gateway,
        req.platformCtx!.platform.id
      );

      if (!result.success) {
        return res.status(400).json({
          error: { code: "PAYMENT_FAILED", message: result.error, requestId: req.platformCtx?.requestId },
        });
      }

      await enhancedBookingService.transitionStatus(req.params.id, BOOKING_STATUS.CONFIRMED, "system", undefined, undefined, req.platformCtx!.platform.id);

      await logAuditEvent(req, "booking.payment_processed", { type: "booking", id: req.params.id }, {
        paymentId: result.paymentId,
      });

      res.json({ paymentId: result.paymentId, requestId: req.platformCtx?.requestId });
    } catch (error) {
      console.error("[PlatformAPI] Payment error:", error);
      res.status(500).json({
        error: { code: "INTERNAL", message: "Failed to process payment", requestId: req.platformCtx?.requestId },
      });
    }
  }
);

router.get("/bookings/user/:userId", requirePlatform, requireBookingAuth, async (req: Request, res: Response) => {
  try {
    const currentUserId = getUserId(req);
    const requestedUserId = req.params.userId;

    if (currentUserId !== requestedUserId && !isAdmin(req)) {
      return res.status(403).json({
        error: { code: "FORBIDDEN", message: "Cannot view other user's bookings", requestId: req.platformCtx?.requestId },
      });
    }

    const platform = req.platformCtx!.platform;
    const status = req.query.status as BookingStatus | undefined;

    const bookings = await enhancedBookingService.getUserBookings(requestedUserId, platform.id, status);

    res.json({ bookings, requestId: req.platformCtx?.requestId });
  } catch (error) {
    console.error("[PlatformAPI] Get user bookings error:", error);
    res.status(500).json({
      error: { code: "INTERNAL", message: "Failed to get user bookings", requestId: req.platformCtx?.requestId },
    });
  }
});

router.get("/bookings/provider/:providerId", requirePlatform, requireBookingAuth, async (req: Request, res: Response) => {
  try {
    const providerId = parseInt(req.params.providerId);
    const status = req.query.status as BookingStatus | undefined;

    if (!isAdmin(req)) {
      return res.status(403).json({
        error: { code: "FORBIDDEN", message: "Admin access required", requestId: req.platformCtx?.requestId },
      });
    }

    const platform = req.platformCtx!.platform;
    const bookings = await enhancedBookingService.getProviderBookings(providerId, status, platform.id);

    res.json({ bookings, requestId: req.platformCtx?.requestId });
  } catch (error) {
    console.error("[PlatformAPI] Get provider bookings error:", error);
    res.status(500).json({
      error: { code: "INTERNAL", message: "Failed to get provider bookings", requestId: req.platformCtx?.requestId },
    });
  }
});

router.get("/features", requirePlatform, (req: Request, res: Response) => {
  const platform = req.platformCtx!.platform;

  res.json({
    platformId: platform.id,
    features: platform.features.reduce((acc, feature) => {
      acc[feature] = true;
      return acc;
    }, {} as Record<string, boolean>),
    requestId: req.platformCtx?.requestId,
  });
});

router.get("/health", (req: Request, res: Response) => {
  res.json({
    ok: true,
    platform: req.platformCtx?.platform?.id,
    requestId: req.platformCtx?.requestId,
    timestamp: new Date().toISOString(),
  });
});

export default router;
