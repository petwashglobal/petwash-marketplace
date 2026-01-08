import { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { platforms } from "@shared/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";

export type PlatformFeature =
  | "marketplace"
  | "bookings"
  | "payments"
  | "docs_verification"
  | "search"
  | "reviews"
  | "chat"
  | "logistics"
  | "escrow"
  | "meet_greet"
  | "gps_tracking"
  | "ai_verification";

export interface PlatformConfig {
  id: string;
  name: string;
  nameHe?: string | null;
  description?: string | null;
  descriptionHe?: string | null;
  isActive: boolean;
  platformFeePercent: number;
  bookingMode: string;
  features: PlatformFeature[];
  settings: Record<string, unknown>;
}

export interface PlatformContext {
  requestId: string;
  platform: PlatformConfig;
  timestamp: number;
}

declare global {
  namespace Express {
    interface Request {
      platformCtx?: PlatformContext;
    }
  }
}

const PLATFORM_HEADER = "x-platform-id";

const platformCache = new Map<string, { platform: PlatformConfig; cachedAt: number }>();
const CACHE_TTL_MS = 60_000;

function uid(prefix = ""): string {
  const rnd = crypto.randomBytes(8).toString("hex");
  return prefix ? `${prefix}_${rnd}` : rnd;
}

const DEFAULT_PLATFORM_FEATURES: Record<string, PlatformFeature[]> = {
  SITTER_SUITE: ["marketplace", "bookings", "payments", "docs_verification", "search", "reviews", "chat", "escrow", "meet_greet"],
  WALK_MY_PET: ["marketplace", "bookings", "payments", "search", "reviews", "gps_tracking"],
  PET_TREK: ["marketplace", "bookings", "payments", "search", "logistics", "gps_tracking"],
  K9000_WASH: ["bookings", "payments", "search"],
  PAW_FINDER: ["marketplace", "search", "chat"],
  PLUSH_LAB: ["marketplace", "payments", "search"],
  TRAINING: ["marketplace", "bookings", "payments", "search", "reviews"],
  GROOMING: ["marketplace", "bookings", "payments", "search", "reviews"],
  DAYCARE: ["marketplace", "bookings", "payments", "search", "reviews", "escrow"],
};

async function getPlatformById(id: string): Promise<PlatformConfig | null> {
  const cached = platformCache.get(id);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return cached.platform;
  }

  try {
    const [result] = await db
      .select()
      .from(platforms)
      .where(eq(platforms.id, id))
      .limit(1);

    if (!result || !result.isActive) {
      return null;
    }

    const settings = (result.settings as Record<string, unknown>) || {};
    const features = (settings.features as PlatformFeature[]) || DEFAULT_PLATFORM_FEATURES[id] || ["search", "bookings"];

    const platform: PlatformConfig = {
      id: result.id,
      name: result.name,
      nameHe: result.nameHe,
      description: result.description,
      descriptionHe: result.descriptionHe,
      isActive: result.isActive ?? true,
      platformFeePercent: parseFloat(result.platformFeePercent?.toString() || "15"),
      bookingMode: result.bookingMode || "SINGLE_SLOT",
      features,
      settings,
    };

    platformCache.set(id, { platform, cachedAt: Date.now() });
    return platform;
  } catch (error) {
    console.error(`[PlatformContext] Error fetching platform ${id}:`, error);
    return null;
  }
}

export function resolvePlatformMiddleware(req: Request, res: Response, next: NextFunction) {
  const requestId = uid("req");
  const platformId = (req.headers[PLATFORM_HEADER] as string) || req.query.platformId as string;

  if (!platformId) {
    req.platformCtx = { requestId, platform: null as any, timestamp: Date.now() };
    return next();
  }

  getPlatformById(platformId.toUpperCase())
    .then((platform) => {
      if (!platform || !platform.isActive) {
        req.platformCtx = { requestId, platform: null as any, timestamp: Date.now() };
      } else {
        req.platformCtx = { requestId, platform, timestamp: Date.now() };
      }
      next();
    })
    .catch((err) => {
      console.error(`[PlatformContext] Error:`, err);
      req.platformCtx = { requestId, platform: null as any, timestamp: Date.now() };
      next();
    });
}

export function requirePlatform(req: Request, res: Response, next: NextFunction) {
  if (!req.platformCtx?.platform || !req.platformCtx.platform.isActive) {
    return res.status(400).json({
      error: {
        code: "NO_PLATFORM",
        message: "Valid platform ID required. Provide x-platform-id header with an active platform.",
        requestId: req.platformCtx?.requestId || "unknown",
      },
    });
  }
  next();
}

export function requireBookingAuth(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user || (req as any).session;
  if (!user?.id && !user?.userId) {
    return res.status(401).json({
      error: {
        code: "UNAUTHENTICATED",
        message: "Authentication required for booking operations",
        requestId: req.platformCtx?.requestId || "unknown",
      },
    });
  }
  next();
}

export function requireFeature(feature: PlatformFeature) {
  return (req: Request, res: Response, next: NextFunction) => {
    const platform = req.platformCtx?.platform;
    if (!platform) {
      return res.status(400).json({
        error: {
          code: "NO_PLATFORM",
          message: "Platform context required",
          requestId: req.platformCtx?.requestId || "unknown",
        },
      });
    }

    if (!platform.features.includes(feature)) {
      return res.status(403).json({
        error: {
          code: "FEATURE_DISABLED",
          message: `Feature '${feature}' is not enabled for platform '${platform.id}'`,
          requestId: req.platformCtx?.requestId || "unknown",
        },
      });
    }

    next();
  };
}

export function clearPlatformCache(platformId?: string) {
  if (platformId) {
    platformCache.delete(platformId);
  } else {
    platformCache.clear();
  }
}
