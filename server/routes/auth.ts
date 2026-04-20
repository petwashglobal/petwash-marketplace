import { Router } from "express";
import { randomBytes } from "crypto";
import { hash } from "bcrypt";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { db } from "../db";
import { users, devices, refreshTokens } from "@shared/schema";
import { eq, and, gt, isNull } from "drizzle-orm";

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

if (!JWT_SECRET || !JWT_REFRESH_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    // Do NOT throw — a module-level throw here causes the entire routes.ts import
    // to reject, setting serverReady=false permanently and blocking ALL routes
    // (including /api/auth/session and /api/users/create-profile) not just this module.
    // Install a poison-pill so only /api/auth/* routes degrade; everything else serves normally.
    // Set JWT_SECRET and JWT_REFRESH_SECRET in Cloud Run env vars immediately.
    console.error('[auth] CRITICAL: JWT_SECRET and JWT_REFRESH_SECRET must be configured in production. ' +
      '/api/auth/* routes are disabled until these env vars are set.');
    router.use((_req: any, res: any) => res.status(503).json({
      error: 'SERVICE_MISCONFIGURED',
      message: 'JWT_SECRET and JWT_REFRESH_SECRET not configured. Contact system administrator.',
    }));
  } else {
    throw new Error("CRITICAL: JWT_SECRET and JWT_REFRESH_SECRET must be configured - refusing to start with predictable tokens");
  }
}

const ACCESS_TOKEN_EXPIRY = "30m"; // 30 minutes
const REFRESH_TOKEN_EXPIRY_DAYS = 30; // 30 days

const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20, // 20 requests per 5 minutes
  standardHeaders: true,
  legacyHeaders: false,
});

// Helper: Generate access token
function generateAccessToken(user: any): string {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      roles: user.roles || [],
      permissions: user.permissions || [],
    },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );
}

// Helper: Generate refresh token with unique jti (JWT ID)
function generateRefreshToken(user: any, deviceId?: string): string {
  const jti = `${user.id}-${Date.now()}-${randomBytes(8).toString('hex')}`;
  return jwt.sign(
    {
      sub: user.id,
      type: "refresh",
      deviceId,
      jti, // Unique identifier for this specific token instance
    },
    JWT_REFRESH_SECRET,
    { expiresIn: `${REFRESH_TOKEN_EXPIRY_DAYS}d` }
  );
}

// Helper: Save refresh token to database
async function saveRefreshToken(userId: string, token: string, deviceId?: string) {
  const tokenHash = await hash(token, 10);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);
  
  // Decode token to extract jti
  const decoded = jwt.verify(token, JWT_REFRESH_SECRET) as any;

  await db.insert(refreshTokens).values({
    userId,
    deviceId: deviceId || null,
    jti: decoded.jti, // Store JWT ID for fast lookup
    tokenHash,
    expiresAt,
  });
}

// POST /api/auth/register - DEPRECATED (2026)
// All registration goes through Firebase Auth + /api/users/create-profile
router.post("/register", (_req, res) => {
  console.warn('[DEPRECATED] /api/auth/register called - endpoint removed. Use Firebase Auth + /api/users/create-profile');
  return res.status(410).json({
    error: "ENDPOINT_DEPRECATED",
    message: "This endpoint is deprecated. Use Firebase Auth for registration, then POST /api/users/create-profile.",
    redirect: "/signup",
  });
});

// POST /api/auth/login - DEPRECATED (2026)
// All sign-in goes through Firebase Auth + /api/auth/session
router.post("/login", (_req, res) => {
  console.warn('[DEPRECATED] /api/auth/login called - endpoint removed. Use Firebase Auth + /api/auth/session');
  return res.status(410).json({
    error: "ENDPOINT_DEPRECATED",
    message: "This endpoint is deprecated. Use Firebase Auth for sign-in.",
    redirect: "/signin",
  });
});

// POST /api/auth/refresh
// Refresh access token using refresh token (biometric unlock or silent refresh)
router.post("/refresh", async (req, res) => {
  try {
    const { refreshToken: token, deviceId } = req.body;

    if (!token) {
      return res.status(400).json({
        error: "INVALID_REQUEST",
        message: "Refresh token is required",
      });
    }

    // Verify refresh token
    let decoded: any;
    try {
      decoded = jwt.verify(token, JWT_REFRESH_SECRET);
    } catch (err) {
      return res.status(401).json({
        error: "INVALID_REFRESH_TOKEN",
        message: "Refresh token expired or invalid",
      });
    }

    // Optional: Validate device ID matches token
    if (deviceId && decoded.deviceId && decoded.deviceId !== deviceId) {
      return res.status(401).json({
        error: "DEVICE_MISMATCH",
        message: "Device ID does not match refresh token",
      });
    }

    // Check if refresh token exists in database using jti (fast lookup, no bcrypt loop)
    const foundToken = await db.query.refreshTokens.findFirst({
      where: and(
        eq(refreshTokens.jti, decoded.jti),
        eq(refreshTokens.userId, decoded.sub),
        isNull(refreshTokens.revokedAt),
        gt(refreshTokens.expiresAt, new Date())
      ),
    });

    if (!foundToken) {
      return res.status(401).json({
        error: "INVALID_REFRESH_TOKEN",
        message: "Refresh token not found or expired",
      });
    }

    // Get user
    const user = await db.query.users.findFirst({
      where: eq(users.id, decoded.sub),
    });

    if (!user) {
      return res.status(401).json({
        error: "USER_NOT_FOUND",
        message: "User not found",
      });
    }

    // Generate new access token
    const newAccessToken = generateAccessToken(user);

    // Generate new refresh token (rotation)
    const newRefreshToken = generateRefreshToken(user, deviceId || decoded.deviceId);

    // Revoke old refresh token
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.id, foundToken.id));

    // Save new refresh token
    await saveRefreshToken(user.id, newRefreshToken, deviceId || decoded.deviceId);

    res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName || undefined,
        lastName: user.lastName || undefined,
        roles: (user.roles as string[]) || [],
        permissions: (user.permissions as string[]) || [],
      },
    });
  } catch (error: any) {
    console.error("[Mobile Auth] Refresh error:", error);
    res.status(500).json({
      error: "INTERNAL_ERROR",
      message: "An error occurred during token refresh",
    });
  }
});

// POST /api/auth/logout
// Invalidate refresh token
router.post("/logout", async (req, res) => {
  try {
    const { refreshToken: token } = req.body;

    if (token) {
      // Decode the refresh token to get its jti (JWT ID) for O(1) lookup.
      // Previously this did eq(revokedAt, null) — which in SQL becomes
      // "WHERE revokedAt = NULL" (always false; null requires IS NULL) — so
      // tokens were NEVER actually revoked. It then looped up to 1,000 rows
      // running bcrypt.compare() on each, which is O(n×bcrypt) and a DoS
      // vector. Fixed: decode first → revoke by jti directly (same pattern
      // as /refresh uses).
      try {
        const decoded = jwt.verify(token, JWT_REFRESH_SECRET) as any;
        if (decoded?.jti) {
          await db
            .update(refreshTokens)
            .set({ revokedAt: new Date() })
            .where(
              and(
                eq(refreshTokens.jti, decoded.jti),
                isNull(refreshTokens.revokedAt)
              )
            );
        }
      } catch (_verifyErr) {
        // Token is already invalid/expired — nothing to revoke, not an error.
      }
    }

    res.json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error: any) {
    console.error("[Mobile Auth] Logout error:", error);
    // Even if error, return success (logout is best-effort)
    res.json({
      success: true,
      message: "Logged out successfully",
    });
  }
});

// GET /api/auth/me
// Get current user profile (requires valid access token in Authorization header)
router.get("/me", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "UNAUTHORIZED",
        message: "Missing or invalid authorization header",
      });
    }

    const token = authHeader.substring(7);
    let decoded: any;

    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({
        error: "INVALID_TOKEN",
        message: "Invalid or expired access token",
      });
    }

    // Get user
    const user = await db.query.users.findFirst({
      where: eq(users.id, decoded.sub),
    });

    if (!user) {
      return res.status(404).json({
        error: "USER_NOT_FOUND",
        message: "User not found",
      });
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName || undefined,
        lastName: user.lastName || undefined,
        profileImageUrl: user.profileImageUrl || undefined,
        phone: user.phone || undefined,
        country: user.country || undefined,
        language: user.language || undefined,
        roles: (user.roles as string[]) || [],
        permissions: (user.permissions as string[]) || [],
        loyaltyTier: user.loyaltyTier || undefined,
      },
    });
  } catch (error: any) {
    console.error("[Mobile Auth] Get me error:", error);
    res.status(500).json({
      error: "INTERNAL_ERROR",
      message: "An error occurred while fetching user profile",
    });
  }
});

export default router;
