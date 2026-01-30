import { Router } from "express";
import { compare, hash } from "bcrypt";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { db } from "../db";
import { users, devices, refreshTokens } from "@shared/schema";
import { eq, and, gt, isNull } from "drizzle-orm";
const router = Router();
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
if (!JWT_SECRET || !JWT_REFRESH_SECRET) {
    throw new Error("CRITICAL: JWT_SECRET and JWT_REFRESH_SECRET must be configured - refusing to start with predictable tokens");
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
function generateAccessToken(user) {
    return jwt.sign({
        sub: user.id,
        email: user.email,
        roles: user.roles || [],
        permissions: user.permissions || [],
    }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
}
// Helper: Generate refresh token with unique jti (JWT ID)
function generateRefreshToken(user, deviceId) {
    const jti = `${user.id}-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
    return jwt.sign({
        sub: user.id,
        type: "refresh",
        deviceId,
        jti, // Unique identifier for this specific token instance
    }, JWT_REFRESH_SECRET, { expiresIn: `${REFRESH_TOKEN_EXPIRY_DAYS}d` });
}
// Helper: Save refresh token to database
async function saveRefreshToken(userId, token, deviceId) {
    const tokenHash = await hash(token, 10);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);
    // Decode token to extract jti
    const decoded = jwt.verify(token, JWT_REFRESH_SECRET);
    await db.insert(refreshTokens).values({
        userId,
        deviceId: deviceId || null,
        jti: decoded.jti, // Store JWT ID for fast lookup
        tokenHash,
        expiresAt,
    });
}
// POST /api/auth/login
// Mobile app initial login with email/password
router.post("/login", loginLimiter, async (req, res) => {
    try {
        const { email, password, deviceId, platform, osVersion, appVersion, pushToken } = req.body;
        if (!email || !password) {
            return res.status(400).json({
                error: "INVALID_REQUEST",
                message: "Email and password are required",
            });
        }
        // Find user by email
        const user = await db.query.users.findFirst({
            where: eq(users.email, email),
        });
        if (!user || !user.passwordHash) {
            return res.status(401).json({
                error: "INVALID_CREDENTIALS",
                message: "Invalid email or password",
            });
        }
        // Verify password
        const isValidPassword = await compare(password, user.passwordHash);
        if (!isValidPassword) {
            return res.status(401).json({
                error: "INVALID_CREDENTIALS",
                message: "Invalid email or password",
            });
        }
        // Update or create device record
        if (deviceId && platform) {
            await db
                .insert(devices)
                .values({
                id: deviceId,
                userId: user.id,
                platform,
                osVersion: osVersion || null,
                appVersion: appVersion || null,
                pushToken: pushToken || null,
                isBlocked: false,
                lastSeenAt: new Date(),
            })
                .onConflictDoUpdate({
                target: devices.id,
                set: {
                    userId: user.id,
                    platform,
                    osVersion: osVersion || null,
                    appVersion: appVersion || null,
                    pushToken: pushToken || null,
                    isBlocked: false,
                    lastSeenAt: new Date(),
                },
            });
        }
        // Generate tokens
        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user, deviceId);
        await saveRefreshToken(user.id, refreshToken, deviceId);
        res.json({
            accessToken,
            refreshToken,
            expiresIn: 1800, // 30 minutes in seconds
            user: {
                id: user.id,
                email: user.email,
                firstName: user.firstName || undefined,
                lastName: user.lastName || undefined,
                roles: user.roles || [],
                permissions: user.permissions || [],
            },
        });
    }
    catch (error) {
        console.error("[Mobile Auth] Login error:", error);
        res.status(500).json({
            error: "INTERNAL_ERROR",
            message: "An error occurred during login",
        });
    }
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
        let decoded;
        try {
            decoded = jwt.verify(token, JWT_REFRESH_SECRET);
        }
        catch (err) {
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
            where: and(eq(refreshTokens.jti, decoded.jti), eq(refreshTokens.userId, decoded.sub), isNull(refreshTokens.revokedAt), gt(refreshTokens.expiresAt, new Date())),
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
                roles: user.roles || [],
                permissions: user.permissions || [],
            },
        });
    }
    catch (error) {
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
            // Find and revoke refresh token
            const tokenRecords = await db.query.refreshTokens.findMany({
                where: and(eq(refreshTokens.revokedAt, null), gt(refreshTokens.expiresAt, new Date())),
                limit: 1000,
            });
            // Find matching token by comparing hash
            for (const record of tokenRecords) {
                const match = await compare(token, record.tokenHash);
                if (match) {
                    await db
                        .update(refreshTokens)
                        .set({ revokedAt: new Date() })
                        .where(eq(refreshTokens.id, record.id));
                    break;
                }
            }
        }
        res.json({
            success: true,
            message: "Logged out successfully",
        });
    }
    catch (error) {
        console.error("[Mobile Auth] Logout error:", error);
        // Even if error, return success
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
        let decoded;
        try {
            decoded = jwt.verify(token, JWT_SECRET);
        }
        catch (err) {
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
                roles: user.roles || [],
                permissions: user.permissions || [],
                loyaltyTier: user.loyaltyTier || undefined,
            },
        });
    }
    catch (error) {
        console.error("[Mobile Auth] Get me error:", error);
        res.status(500).json({
            error: "INTERNAL_ERROR",
            message: "An error occurred while fetching user profile",
        });
    }
});
export default router;
