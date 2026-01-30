/**
 * PIN Authentication Routes - December 2025 Edition
 * Modern passwordless PIN login following Apple/Google/Microsoft standards
 *
 * Features:
 * - 4-6 digit PIN setup and verification
 * - Device binding for enhanced security
 * - Rate limiting (5 attempts, 15-minute lockout)
 * - Immutable audit logging
 * - bcrypt hashing (never store plaintext)
 */
import { Router } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { db } from '../db';
import { userPins, pinAuthLogs, customers, users } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { logger } from '../lib/logger';
import { auth as firebaseAdminAuth } from '../lib/firebase-admin';
const router = Router();
// Constants
const SALT_ROUNDS = 12;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;
const MIN_PIN_LENGTH = 4;
const MAX_PIN_LENGTH = 6;
// Validation schemas
const setupPinSchema = z.object({
    pin: z.string().min(4).max(6).regex(/^\d+$/, 'PIN must contain only digits'),
    email: z.string().email(),
    deviceId: z.string().optional(),
    deviceName: z.string().optional(),
    deviceType: z.enum(['ios', 'android', 'web', 'kiosk']).optional(),
});
const verifyPinSchema = z.object({
    pin: z.string().min(4).max(6).regex(/^\d+$/, 'PIN must contain only digits'),
    email: z.string().email(),
    deviceId: z.string().optional(),
});
const changePinSchema = z.object({
    currentPin: z.string().min(4).max(6).regex(/^\d+$/, 'PIN must contain only digits'),
    newPin: z.string().min(4).max(6).regex(/^\d+$/, 'PIN must contain only digits'),
    email: z.string().email(),
});
// Helper: Get client IP
function getClientIP(req) {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
        return forwarded.split(',')[0].trim();
    }
    return req.ip || req.socket.remoteAddress || 'unknown';
}
// Helper: Log PIN auth event
async function logPinEvent(params) {
    try {
        await db.insert(pinAuthLogs).values({
            userId: params.userId,
            userType: params.userType,
            action: params.action,
            ipAddress: getClientIP(params.req),
            userAgent: params.req.headers['user-agent'] || null,
            deviceId: params.deviceId || null,
            deviceType: params.deviceType || null,
            failedAttemptNumber: params.failedAttemptNumber || null,
            lockoutDuration: params.lockoutDuration || null,
        });
    }
    catch (error) {
        logger.error('[PIN Auth] Failed to log event', { error, action: params.action });
    }
}
// Helper: Find user by email (check both tables)
async function findUserByEmail(email) {
    // Check customers table first
    const [customer] = await db.select().from(customers).where(eq(customers.email, email)).limit(1);
    if (customer) {
        return { id: customer.id.toString(), type: 'customer' };
    }
    // Check users table
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (user) {
        return { id: user.id, type: 'user' };
    }
    return null;
}
/**
 * POST /api/pin-auth/setup
 * Create or update PIN for a user
 */
router.post('/setup', async (req, res) => {
    try {
        const validation = setupPinSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({
                success: false,
                error: 'Invalid PIN format. PIN must be 4-6 digits.',
                details: validation.error.errors
            });
        }
        const { pin, email, deviceId, deviceName, deviceType } = validation.data;
        // Find user
        const userInfo = await findUserByEmail(email);
        if (!userInfo) {
            return res.status(404).json({
                success: false,
                error: 'Account not found. Please register first.'
            });
        }
        // Hash PIN
        const pinHash = await bcrypt.hash(pin, SALT_ROUNDS);
        // Check if PIN already exists for this user
        const [existingPin] = await db.select()
            .from(userPins)
            .where(and(eq(userPins.userId, userInfo.id), eq(userPins.userType, userInfo.type)))
            .limit(1);
        if (existingPin) {
            // Update existing PIN
            await db.update(userPins)
                .set({
                pinHash,
                pinLength: pin.length,
                deviceId: deviceId || existingPin.deviceId,
                deviceName: deviceName || existingPin.deviceName,
                deviceType: deviceType || existingPin.deviceType,
                failedAttempts: 0,
                lockoutUntil: null,
                updatedAt: new Date(),
            })
                .where(eq(userPins.id, existingPin.id));
            await logPinEvent({
                userId: userInfo.id,
                userType: userInfo.type,
                action: 'pin_changed',
                req,
                deviceId,
                deviceType,
            });
            logger.info('[PIN Auth] PIN updated', { userId: userInfo.id, email });
            return res.json({
                success: true,
                message: 'PIN updated successfully',
                pinLength: pin.length
            });
        }
        // Create new PIN
        await db.insert(userPins).values({
            userId: userInfo.id,
            userType: userInfo.type,
            pinHash,
            pinLength: pin.length,
            deviceId: deviceId || null,
            deviceName: deviceName || null,
            deviceType: deviceType || null,
            isActive: true,
            isPrimary: true,
        });
        await logPinEvent({
            userId: userInfo.id,
            userType: userInfo.type,
            action: 'pin_created',
            req,
            deviceId,
            deviceType,
        });
        logger.info('[PIN Auth] PIN created', { userId: userInfo.id, email });
        return res.json({
            success: true,
            message: 'PIN created successfully',
            pinLength: pin.length
        });
    }
    catch (error) {
        logger.error('[PIN Auth] Setup error', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to setup PIN. Please try again.'
        });
    }
});
/**
 * POST /api/pin-auth/verify
 * Verify PIN and return auth token/session
 * SECURITY: Requires Firebase authentication (Bearer token) to prevent brute-force attacks
 */
router.post('/verify', async (req, res) => {
    try {
        // SECURITY: Require Firebase authentication before PIN verification
        // This prevents unauthenticated brute-force attacks
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required. Use trusted-device-verify for trusted devices.',
                code: 'AUTH_REQUIRED'
            });
        }
        const idToken = authHeader.substring(7);
        let decodedToken;
        try {
            decodedToken = await firebaseAdminAuth.verifyIdToken(idToken);
        }
        catch (verifyError) {
            return res.status(401).json({
                success: false,
                error: 'Invalid authentication token',
                code: 'INVALID_TOKEN'
            });
        }
        const validation = verifyPinSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({
                success: false,
                error: 'Invalid PIN format'
            });
        }
        const { pin, email, deviceId } = validation.data;
        // Verify email matches authenticated user
        if (email.toLowerCase() !== decodedToken.email?.toLowerCase()) {
            return res.status(403).json({
                success: false,
                error: 'Email does not match authenticated user',
                code: 'EMAIL_MISMATCH'
            });
        }
        // Find user
        const userInfo = await findUserByEmail(email);
        if (!userInfo) {
            return res.status(401).json({
                success: false,
                error: 'Invalid email or PIN'
            });
        }
        // Get PIN record
        const [pinRecord] = await db.select()
            .from(userPins)
            .where(and(eq(userPins.userId, userInfo.id), eq(userPins.userType, userInfo.type), eq(userPins.isActive, true)))
            .limit(1);
        if (!pinRecord) {
            return res.status(401).json({
                success: false,
                error: 'PIN not set up. Please create a PIN first.',
                code: 'PIN_NOT_SETUP'
            });
        }
        // Check lockout
        if (pinRecord.lockoutUntil && new Date() < new Date(pinRecord.lockoutUntil)) {
            const remainingMinutes = Math.ceil((new Date(pinRecord.lockoutUntil).getTime() - Date.now()) / 60000);
            return res.status(429).json({
                success: false,
                error: `Account temporarily locked. Try again in ${remainingMinutes} minutes.`,
                code: 'ACCOUNT_LOCKED',
                lockoutMinutes: remainingMinutes
            });
        }
        // Verify PIN
        const isValid = await bcrypt.compare(pin, pinRecord.pinHash);
        if (!isValid) {
            const newFailedAttempts = pinRecord.failedAttempts + 1;
            const shouldLockout = newFailedAttempts >= MAX_FAILED_ATTEMPTS;
            const lockoutUntil = shouldLockout
                ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000)
                : null;
            // Update failed attempts
            await db.update(userPins)
                .set({
                failedAttempts: newFailedAttempts,
                lastFailedAt: new Date(),
                lockoutUntil,
            })
                .where(eq(userPins.id, pinRecord.id));
            await logPinEvent({
                userId: userInfo.id,
                userType: userInfo.type,
                action: shouldLockout ? 'lockout_triggered' : 'login_failed',
                req,
                deviceId,
                failedAttemptNumber: newFailedAttempts,
                lockoutDuration: shouldLockout ? LOCKOUT_MINUTES : undefined,
            });
            if (shouldLockout) {
                logger.warn('[PIN Auth] Account locked due to failed attempts', {
                    userId: userInfo.id,
                    email,
                    attempts: newFailedAttempts
                });
                return res.status(429).json({
                    success: false,
                    error: `Too many failed attempts. Account locked for ${LOCKOUT_MINUTES} minutes.`,
                    code: 'ACCOUNT_LOCKED',
                    lockoutMinutes: LOCKOUT_MINUTES
                });
            }
            const attemptsRemaining = MAX_FAILED_ATTEMPTS - newFailedAttempts;
            return res.status(401).json({
                success: false,
                error: `Invalid PIN. ${attemptsRemaining} attempts remaining.`,
                code: 'INVALID_PIN',
                attemptsRemaining
            });
        }
        // Success! Reset failed attempts and update last used
        await db.update(userPins)
            .set({
            failedAttempts: 0,
            lockoutUntil: null,
            lastUsedAt: new Date(),
        })
            .where(eq(userPins.id, pinRecord.id));
        await logPinEvent({
            userId: userInfo.id,
            userType: userInfo.type,
            action: 'login_success',
            req,
            deviceId,
        });
        // Get user data for response
        let userData = null;
        if (userInfo.type === 'customer') {
            const [customer] = await db.select().from(customers).where(eq(customers.id, parseInt(userInfo.id)));
            if (customer) {
                userData = {
                    id: customer.id,
                    email: customer.email,
                    firstName: customer.firstName,
                    lastName: customer.lastName,
                    loyaltyTier: customer.loyaltyTier,
                };
            }
        }
        else {
            const [user] = await db.select().from(users).where(eq(users.id, userInfo.id));
            if (user) {
                userData = {
                    id: user.id,
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    loyaltyTier: user.loyaltyTier,
                };
            }
        }
        logger.info('[PIN Auth] Login success', { userId: userInfo.id, email });
        return res.json({
            success: true,
            message: 'PIN verified successfully',
            user: userData,
            userType: userInfo.type
        });
    }
    catch (error) {
        logger.error('[PIN Auth] Verify error', error);
        return res.status(500).json({
            success: false,
            error: 'Verification failed. Please try again.'
        });
    }
});
/**
 * POST /api/pin-auth/change
 * Change PIN (requires current PIN)
 */
router.post('/change', async (req, res) => {
    try {
        const validation = changePinSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({
                success: false,
                error: 'Invalid PIN format'
            });
        }
        const { currentPin, newPin, email } = validation.data;
        if (currentPin === newPin) {
            return res.status(400).json({
                success: false,
                error: 'New PIN must be different from current PIN'
            });
        }
        // Find user
        const userInfo = await findUserByEmail(email);
        if (!userInfo) {
            return res.status(404).json({
                success: false,
                error: 'Account not found'
            });
        }
        // Get PIN record
        const [pinRecord] = await db.select()
            .from(userPins)
            .where(and(eq(userPins.userId, userInfo.id), eq(userPins.userType, userInfo.type), eq(userPins.isActive, true)))
            .limit(1);
        if (!pinRecord) {
            return res.status(400).json({
                success: false,
                error: 'No PIN set up for this account'
            });
        }
        // Verify current PIN
        const isValid = await bcrypt.compare(currentPin, pinRecord.pinHash);
        if (!isValid) {
            return res.status(401).json({
                success: false,
                error: 'Current PIN is incorrect'
            });
        }
        // Update to new PIN
        const newPinHash = await bcrypt.hash(newPin, SALT_ROUNDS);
        await db.update(userPins)
            .set({
            pinHash: newPinHash,
            pinLength: newPin.length,
            failedAttempts: 0,
            lockoutUntil: null,
            updatedAt: new Date(),
        })
            .where(eq(userPins.id, pinRecord.id));
        await logPinEvent({
            userId: userInfo.id,
            userType: userInfo.type,
            action: 'pin_changed',
            req,
        });
        logger.info('[PIN Auth] PIN changed', { userId: userInfo.id, email });
        return res.json({
            success: true,
            message: 'PIN changed successfully'
        });
    }
    catch (error) {
        logger.error('[PIN Auth] Change error', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to change PIN. Please try again.'
        });
    }
});
/**
 * DELETE /api/pin-auth/remove
 * Remove PIN authentication
 */
router.delete('/remove', async (req, res) => {
    try {
        const { email, pin } = req.body;
        if (!email || !pin) {
            return res.status(400).json({
                success: false,
                error: 'Email and PIN are required'
            });
        }
        // Find user
        const userInfo = await findUserByEmail(email);
        if (!userInfo) {
            return res.status(404).json({
                success: false,
                error: 'Account not found'
            });
        }
        // Get PIN record
        const [pinRecord] = await db.select()
            .from(userPins)
            .where(and(eq(userPins.userId, userInfo.id), eq(userPins.userType, userInfo.type), eq(userPins.isActive, true)))
            .limit(1);
        if (!pinRecord) {
            return res.status(400).json({
                success: false,
                error: 'No PIN set up for this account'
            });
        }
        // Verify PIN before removal
        const isValid = await bcrypt.compare(pin, pinRecord.pinHash);
        if (!isValid) {
            return res.status(401).json({
                success: false,
                error: 'Invalid PIN'
            });
        }
        // Deactivate PIN (soft delete)
        await db.update(userPins)
            .set({ isActive: false, updatedAt: new Date() })
            .where(eq(userPins.id, pinRecord.id));
        await logPinEvent({
            userId: userInfo.id,
            userType: userInfo.type,
            action: 'pin_removed',
            req,
        });
        logger.info('[PIN Auth] PIN removed', { userId: userInfo.id, email });
        return res.json({
            success: true,
            message: 'PIN removed successfully'
        });
    }
    catch (error) {
        logger.error('[PIN Auth] Remove error', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to remove PIN. Please try again.'
        });
    }
});
/**
 * GET /api/pin-auth/status
 * Check if user has PIN set up
 */
router.get('/status', async (req, res) => {
    try {
        const email = req.query.email;
        if (!email) {
            return res.status(400).json({
                success: false,
                error: 'Email is required'
            });
        }
        // Find user
        const userInfo = await findUserByEmail(email);
        if (!userInfo) {
            return res.json({
                success: true,
                hasPin: false,
                reason: 'Account not found'
            });
        }
        // Check for active PIN
        const [pinRecord] = await db.select()
            .from(userPins)
            .where(and(eq(userPins.userId, userInfo.id), eq(userPins.userType, userInfo.type), eq(userPins.isActive, true)))
            .limit(1);
        const isLocked = pinRecord?.lockoutUntil && new Date() < new Date(pinRecord.lockoutUntil);
        return res.json({
            success: true,
            hasPin: !!pinRecord,
            pinLength: pinRecord?.pinLength || null,
            isLocked: isLocked || false,
            lockoutMinutes: isLocked && pinRecord?.lockoutUntil
                ? Math.ceil((new Date(pinRecord.lockoutUntil).getTime() - Date.now()) / 60000)
                : null
        });
    }
    catch (error) {
        logger.error('[PIN Auth] Status check error', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to check PIN status'
        });
    }
});
// In-memory rate limiting for PIN verification (per IP)
const pinVerifyRateLimits = new Map();
const PIN_VERIFY_MAX_REQUESTS = 10;
const PIN_VERIFY_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
// Device trust token secrets - MUST be set via environment variable
const DEVICE_TRUST_SECRET = process.env.JWT_SECRET;
if (!DEVICE_TRUST_SECRET) {
    logger.warn('[PIN Auth] JWT_SECRET not configured - device trust tokens will fail validation');
}
// Helper: Generate device trust token
function generateDeviceTrustToken(userId, email, deviceId) {
    if (!DEVICE_TRUST_SECRET) {
        throw new Error('JWT_SECRET not configured - cannot generate device trust token');
    }
    const payload = JSON.stringify({
        userId,
        email,
        deviceId,
        issuedAt: Date.now(),
        expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
    });
    const signature = crypto.createHmac('sha256', DEVICE_TRUST_SECRET)
        .update(payload)
        .digest('hex');
    return Buffer.from(`${payload}.${signature}`).toString('base64');
}
// Helper: Verify device trust token
function verifyDeviceTrustToken(token) {
    try {
        if (!DEVICE_TRUST_SECRET) {
            logger.error('[PIN Auth] Cannot verify token: JWT_SECRET not configured');
            return { valid: false };
        }
        const decoded = Buffer.from(token, 'base64').toString('utf8');
        const [payloadStr, signature] = decoded.split('.');
        if (!payloadStr || !signature) {
            return { valid: false };
        }
        const expectedSignature = crypto.createHmac('sha256', DEVICE_TRUST_SECRET)
            .update(payloadStr)
            .digest('hex');
        if (signature !== expectedSignature) {
            return { valid: false };
        }
        const payload = JSON.parse(payloadStr);
        if (payload.expiresAt < Date.now()) {
            return { valid: false };
        }
        return {
            valid: true,
            userId: payload.userId,
            email: payload.email,
            deviceId: payload.deviceId
        };
    }
    catch (error) {
        return { valid: false };
    }
}
/**
 * POST /api/pin-auth/trusted-device-verify
 * Verify PIN from a trusted device and return Firebase custom token
 * Requires X-Device-Trust-Token header
 */
router.post('/trusted-device-verify', async (req, res) => {
    try {
        // Rate limiting by IP
        const clientIP = getClientIP(req);
        const now = Date.now();
        const rateLimit = pinVerifyRateLimits.get(clientIP);
        if (rateLimit) {
            if (now < rateLimit.resetAt) {
                if (rateLimit.count >= PIN_VERIFY_MAX_REQUESTS) {
                    logger.warn('[PIN Auth] Rate limit exceeded', { ip: clientIP });
                    return res.status(429).json({
                        success: false,
                        error: 'Too many attempts. Please wait 15 minutes.',
                        code: 'RATE_LIMITED'
                    });
                }
                rateLimit.count++;
            }
            else {
                pinVerifyRateLimits.set(clientIP, { count: 1, resetAt: now + PIN_VERIFY_WINDOW_MS });
            }
        }
        else {
            pinVerifyRateLimits.set(clientIP, { count: 1, resetAt: now + PIN_VERIFY_WINDOW_MS });
        }
        // Verify device trust token
        const trustToken = req.headers['x-device-trust-token'];
        if (!trustToken) {
            return res.status(401).json({
                success: false,
                error: 'Device not trusted. Please sign in with full credentials first.',
                code: 'NO_TRUST_TOKEN'
            });
        }
        const tokenResult = verifyDeviceTrustToken(trustToken);
        if (!tokenResult.valid) {
            return res.status(401).json({
                success: false,
                error: 'Device trust expired. Please sign in again.',
                code: 'INVALID_TRUST_TOKEN'
            });
        }
        // Validate request body
        const validation = verifyPinSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({
                success: false,
                error: 'Invalid PIN format'
            });
        }
        const { pin, email, deviceId } = validation.data;
        // Verify email matches trust token
        if (email.toLowerCase() !== tokenResult.email?.toLowerCase()) {
            return res.status(401).json({
                success: false,
                error: 'Email does not match trusted device.',
                code: 'EMAIL_MISMATCH'
            });
        }
        // Find user
        const userInfo = await findUserByEmail(email);
        if (!userInfo) {
            return res.status(401).json({
                success: false,
                error: 'Invalid email or PIN'
            });
        }
        // Get PIN record
        const [pinRecord] = await db.select()
            .from(userPins)
            .where(and(eq(userPins.userId, userInfo.id), eq(userPins.userType, userInfo.type), eq(userPins.isActive, true)))
            .limit(1);
        if (!pinRecord) {
            return res.status(401).json({
                success: false,
                error: 'PIN not set up for this account.',
                code: 'PIN_NOT_SETUP'
            });
        }
        // Check lockout
        if (pinRecord.lockoutUntil && new Date() < new Date(pinRecord.lockoutUntil)) {
            const remainingMinutes = Math.ceil((new Date(pinRecord.lockoutUntil).getTime() - Date.now()) / 60000);
            return res.status(429).json({
                success: false,
                error: `Account temporarily locked. Try again in ${remainingMinutes} minutes.`,
                code: 'ACCOUNT_LOCKED',
                lockoutMinutes: remainingMinutes
            });
        }
        // Verify PIN
        const isValid = await bcrypt.compare(pin, pinRecord.pinHash);
        if (!isValid) {
            const newFailedAttempts = pinRecord.failedAttempts + 1;
            const shouldLockout = newFailedAttempts >= MAX_FAILED_ATTEMPTS;
            const lockoutUntil = shouldLockout
                ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000)
                : null;
            await db.update(userPins)
                .set({
                failedAttempts: newFailedAttempts,
                lastFailedAt: new Date(),
                lockoutUntil,
            })
                .where(eq(userPins.id, pinRecord.id));
            await logPinEvent({
                userId: userInfo.id,
                userType: userInfo.type,
                action: shouldLockout ? 'trusted_device_lockout' : 'trusted_device_login_failed',
                req,
                deviceId,
                failedAttemptNumber: newFailedAttempts,
                lockoutDuration: shouldLockout ? LOCKOUT_MINUTES : undefined,
            });
            if (shouldLockout) {
                return res.status(429).json({
                    success: false,
                    error: `Too many failed attempts. Account locked for ${LOCKOUT_MINUTES} minutes.`,
                    code: 'ACCOUNT_LOCKED',
                    lockoutMinutes: LOCKOUT_MINUTES
                });
            }
            const attemptsRemaining = MAX_FAILED_ATTEMPTS - newFailedAttempts;
            return res.status(401).json({
                success: false,
                error: `Invalid PIN. ${attemptsRemaining} attempts remaining.`,
                code: 'INVALID_PIN',
                attemptsRemaining
            });
        }
        // Success! Reset failed attempts
        await db.update(userPins)
            .set({
            failedAttempts: 0,
            lockoutUntil: null,
            lastUsedAt: new Date(),
            lastSuccessIP: clientIP,
        })
            .where(eq(userPins.id, pinRecord.id));
        await logPinEvent({
            userId: userInfo.id,
            userType: userInfo.type,
            action: 'trusted_device_login_success',
            req,
            deviceId,
        });
        // Generate Firebase custom token
        let customToken = null;
        try {
            customToken = await firebaseAdminAuth.createCustomToken(userInfo.id);
        }
        catch (tokenError) {
            logger.error('[PIN Auth] Failed to create Firebase custom token', tokenError);
            return res.status(500).json({
                success: false,
                error: 'Authentication service error. Please try again.'
            });
        }
        logger.info('[PIN Auth] Trusted device PIN login success', { userId: userInfo.id, email });
        return res.json({
            success: true,
            message: 'PIN verified successfully',
            token: customToken,
            userType: userInfo.type
        });
    }
    catch (error) {
        logger.error('[PIN Auth] Trusted device verify error', error);
        return res.status(500).json({
            success: false,
            error: 'Verification failed. Please try again.'
        });
    }
});
/**
 * POST /api/pin-auth/generate-device-trust
 * Generate a device trust token after successful authentication
 * This should be called after user logs in with full credentials
 */
router.post('/generate-device-trust', async (req, res) => {
    try {
        // This endpoint requires Firebase auth (user must be logged in)
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required'
            });
        }
        const idToken = authHeader.substring(7);
        // Verify Firebase ID token
        let decodedToken;
        try {
            decodedToken = await firebaseAdminAuth.verifyIdToken(idToken);
        }
        catch (verifyError) {
            return res.status(401).json({
                success: false,
                error: 'Invalid authentication token'
            });
        }
        const { deviceId } = req.body;
        if (!deviceId) {
            return res.status(400).json({
                success: false,
                error: 'Device ID is required'
            });
        }
        const email = decodedToken.email;
        const userId = decodedToken.uid;
        if (!email) {
            return res.status(400).json({
                success: false,
                error: 'Email not found in authentication token'
            });
        }
        // Generate device trust token
        const trustToken = generateDeviceTrustToken(userId, email, deviceId);
        await logPinEvent({
            userId,
            userType: 'user',
            action: 'device_trust_created',
            req,
            deviceId,
        });
        logger.info('[PIN Auth] Device trust token generated', { userId, email, deviceId });
        return res.json({
            success: true,
            deviceTrustToken: trustToken,
            expiresInDays: 30
        });
    }
    catch (error) {
        logger.error('[PIN Auth] Generate device trust error', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to generate device trust'
        });
    }
});
export default router;
