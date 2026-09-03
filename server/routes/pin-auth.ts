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

import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { db } from '../db';
import { userPins, pinAuthLogs, customers, users } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { logger } from '../lib/logger';
import admin, { auth as firebaseAdminAuth } from '../lib/firebase-admin';
import { validateFirebaseToken } from '../middleware/firebase-auth';

const router = Router();

// Constants
const SALT_ROUNDS = 12;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;
const MIN_PIN_LENGTH = 4;
const MAX_PIN_LENGTH = 6;
// Same "recent authentication" bar the email-change flow uses (profile-settings.ts).
const RECENT_AUTH_WINDOW_SECONDS = 300;

// Validation schemas
//
// SECURITY (auth/identity sweep 2026-08-17): `email` is accepted for backward
// compatibility with older clients but is NEVER used to choose whose PIN is
// read or written. Identity is always the server-verified Firebase UID from
// `validateFirebaseToken`. A body-supplied email that disagrees with the token
// is rejected (403 EMAIL_MISMATCH) rather than honoured.
const setupPinSchema = z.object({
  pin: z.string().min(4).max(6).regex(/^\d+$/, 'PIN must contain only digits'),
  email: z.string().email().optional(),
  deviceId: z.string().optional(),
  deviceName: z.string().optional(),
  deviceType: z.enum(['ios', 'android', 'web', 'kiosk']).optional(),
});

const verifyPinSchema = z.object({
  pin: z.string().min(4).max(6).regex(/^\d+$/, 'PIN must contain only digits'),
  email: z.string().email().optional(),
  deviceId: z.string().optional(),
});

const changePinSchema = z.object({
  currentPin: z.string().min(4).max(6).regex(/^\d+$/, 'PIN must contain only digits'),
  newPin: z.string().min(4).max(6).regex(/^\d+$/, 'PIN must contain only digits'),
  email: z.string().email().optional(),
});

const removePinSchema = z.object({
  pin: z.string().min(4).max(6).regex(/^\d+$/, 'PIN must contain only digits').optional(),
  email: z.string().email().optional(),
});

// Helper: Get client IP
function getClientIP(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

// Helper: Log PIN auth event
async function logPinEvent(params: {
  userId: string;
  userType: 'user' | 'customer';
  action: string;
  req: Request;
  deviceId?: string;
  deviceType?: string;
  failedAttemptNumber?: number;
  lockoutDuration?: number;
}) {
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
  } catch (error) {
    logger.error('[PIN Auth] Failed to log event', error, { action: params.action });
  }
}

export type PinIdentity = { id: string; type: 'user' | 'customer'; email: string | null };

/**
 * SERVER-DERIVED IDENTITY (auth/identity sweep 2026-08-17).
 *
 * Resolves the PIN-owning row from the VERIFIED Firebase UID on the request —
 * never from a browser-supplied email. `users.id` IS the Firebase UID, so the
 * primary lookup is by UID. The `customers` table has no UID column, so it is
 * only reachable via the token's own verified email (still not client input).
 *
 * Returns null when the caller has no PetWash row yet.
 */
export async function resolvePinIdentityFromRequest(req: Request): Promise<PinIdentity | null> {
  const uid = req.firebaseUser?.uid;
  if (!uid) return null;

  const [user] = await db.select().from(users).where(eq(users.id, uid)).limit(1);
  if (user) return { id: user.id, type: 'user', email: user.email ?? null };

  const tokenEmail = (req.firebaseUser?.email || '').trim().toLowerCase();
  if (tokenEmail) {
    const [customer] = await db.select().from(customers).where(eq(customers.email, tokenEmail)).limit(1);
    if (customer) return { id: customer.id.toString(), type: 'customer', email: customer.email ?? null };
  }

  return null;
}

/**
 * A body-supplied email may NEVER select a different account. If a legacy client
 * still sends one, it must match the verified token; otherwise refuse.
 */
function bodyEmailConflictsWithToken(req: Request, bodyEmail?: string): boolean {
  if (!bodyEmail) return false;
  const tokenEmail = (req.firebaseUser?.email || '').trim().toLowerCase();
  if (!tokenEmail) return false;
  return bodyEmail.trim().toLowerCase() !== tokenEmail;
}

// Helper: Find user by email (check both tables)
async function findUserByEmail(email: string): Promise<{ id: string; type: 'user' | 'customer' } | null> {
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
router.post('/setup', validateFirebaseToken, async (req: Request, res: Response) => {
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

    if (bodyEmailConflictsWithToken(req, email)) {
      return res.status(403).json({ success: false, error: 'Email does not match authenticated user', code: 'EMAIL_MISMATCH' });
    }

    // Identity comes from the verified token — NEVER from the request body.
    const userInfo = await resolvePinIdentityFromRequest(req);
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
      .where(and(
        eq(userPins.userId, userInfo.id),
        eq(userPins.userType, userInfo.type)
      ))
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
          // BUGFIX 2026-08-17: /remove soft-deletes (isActive=false). Re-running
          // /setup afterwards updated the same row but left isActive=false, so the
          // "new" PIN silently never worked. Re-activate on setup.
          isActive: true,
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

      logger.info('[PIN Auth] PIN updated', { userId: userInfo.id, userType: userInfo.type });
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

    logger.info('[PIN Auth] PIN created', { userId: userInfo.id, userType: userInfo.type });
    return res.json({ 
      success: true, 
      message: 'PIN created successfully',
      pinLength: pin.length 
    });

  } catch (error) {
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
router.post('/verify', async (req: Request, res: Response) => {
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
      decodedToken = await firebaseAdminAuth.verifyIdToken(idToken, true);
    } catch (verifyError) {
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

    // A legacy client may still send an email, but it may never SELECT the account.
    if (email && decodedToken.email && email.toLowerCase() !== decodedToken.email.toLowerCase()) {
      return res.status(403).json({
        success: false,
        error: 'Email does not match authenticated user',
        code: 'EMAIL_MISMATCH'
      });
    }

    // Identity comes from the verified token — NEVER from the request body.
    // (Bug 2026-08-17: TransactionPinModal posts `{ pin }` with no email, so the
    // old email-keyed lookup 400'd and transaction-PIN verification was dead.)
    req.firebaseUser = req.firebaseUser || { uid: decodedToken.uid, email: decodedToken.email };
    const userInfo = await resolvePinIdentityFromRequest(req);
    if (!userInfo) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or PIN'
      });
    }

    // Get PIN record
    const [pinRecord] = await db.select()
      .from(userPins)
      .where(and(
        eq(userPins.userId, userInfo.id),
        eq(userPins.userType, userInfo.type),
        eq(userPins.isActive, true)
      ))
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
      const remainingMinutes = Math.ceil(
        (new Date(pinRecord.lockoutUntil).getTime() - Date.now()) / 60000
      );
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
    let userData: any = null;
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
    } else {
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

    logger.info('[PIN Auth] Login success', { userId: userInfo.id, userType: userInfo.type });
    return res.json({ 
      success: true, 
      message: 'PIN verified successfully',
      user: userData,
      userType: userInfo.type
    });

  } catch (error) {
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
router.post('/change', validateFirebaseToken, async (req: Request, res: Response) => {
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

    if (bodyEmailConflictsWithToken(req, email)) {
      return res.status(403).json({ success: false, error: 'Email does not match authenticated user', code: 'EMAIL_MISMATCH' });
    }

    // Identity comes from the verified token — NEVER from the request body.
    const userInfo = await resolvePinIdentityFromRequest(req);
    if (!userInfo) {
      return res.status(404).json({
        success: false,
        error: 'Account not found'
      });
    }

    // Get PIN record
    const [pinRecord] = await db.select()
      .from(userPins)
      .where(and(
        eq(userPins.userId, userInfo.id),
        eq(userPins.userType, userInfo.type),
        eq(userPins.isActive, true)
      ))
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

    logger.info('[PIN Auth] PIN changed', { userId: userInfo.id, userType: userInfo.type });
    return res.json({ 
      success: true, 
      message: 'PIN changed successfully' 
    });

  } catch (error) {
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
router.delete('/remove', validateFirebaseToken, async (req: Request, res: Response) => {
  try {
    const validation = removePinSchema.safeParse(req.body ?? {});
    if (!validation.success) {
      return res.status(400).json({ success: false, error: 'Invalid PIN format' });
    }
    const { email, pin } = validation.data;

    if (bodyEmailConflictsWithToken(req, email)) {
      return res.status(403).json({ success: false, error: 'Email does not match authenticated user', code: 'EMAIL_MISMATCH' });
    }

    // Identity comes from the verified token — NEVER from the request body.
    const userInfo = await resolvePinIdentityFromRequest(req);
    if (!userInfo) {
      return res.status(404).json({
        success: false,
        error: 'Account not found'
      });
    }

    // Get PIN record
    const [pinRecord] = await db.select()
      .from(userPins)
      .where(and(
        eq(userPins.userId, userInfo.id),
        eq(userPins.userType, userInfo.type),
        eq(userPins.isActive, true)
      ))
      .limit(1);

    if (!pinRecord) {
      return res.status(400).json({
        success: false,
        error: 'No PIN set up for this account'
      });
    }

    // Removing a sign-in factor is a security-reducing action: require proof of
    // presence — either the current PIN, or a Firebase sign-in from the last
    // 5 minutes (same recent-auth bar the email-change flow uses).
    const authTimeSec = Number((req.firebaseUser?.claims as any)?.auth_time ?? 0);
    const recentlyAuthenticated = authTimeSec > 0 && authTimeSec >= Math.floor(Date.now() / 1000) - RECENT_AUTH_WINDOW_SECONDS;

    if (!pin && !recentlyAuthenticated) {
      return res.status(401).json({
        success: false,
        error: 'Enter your current PIN, or sign in again, to remove your PIN.',
        code: 'PIN_OR_REAUTH_REQUIRED',
      });
    }

    if (pin) {
      const isValid = await bcrypt.compare(pin, pinRecord.pinHash);
      if (!isValid) {
        return res.status(401).json({
          success: false,
          error: 'Invalid PIN',
          code: 'INVALID_PIN',
        });
      }
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

    logger.info('[PIN Auth] PIN removed', { userId: userInfo.id, userType: userInfo.type });
    return res.json({ 
      success: true, 
      message: 'PIN removed successfully' 
    });

  } catch (error) {
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
router.get('/status', validateFirebaseToken, async (req: Request, res: Response) => {
  try {
    // SECURITY 2026-08-17: this used to be unauthenticated and keyed on
    // `?email=` — anyone could enumerate whether an arbitrary account had a PIN,
    // its length and its lockout state. It is now authenticated and reports the
    // CALLER's own PIN posture only.
    //
    // BUGFIX 2026-08-17: the Settings page calls this with no `?email=`, so the
    // old handler answered 400 and the UI fell back to "PIN: Not set" for every
    // user — including users who had one. Status is now server-authoritative.
    const userInfo = await resolvePinIdentityFromRequest(req);
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
      .where(and(
        eq(userPins.userId, userInfo.id),
        eq(userPins.userType, userInfo.type),
        eq(userPins.isActive, true)
      ))
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

  } catch (error) {
    logger.error('[PIN Auth] Status check error', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to check PIN status' 
    });
  }
});

// In-memory rate limiting for PIN verification (per IP)
const pinVerifyRateLimits = new Map<string, { count: number; resetAt: number }>();
const PIN_VERIFY_MAX_REQUESTS = 10;
const PIN_VERIFY_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

// Device trust token secrets - MUST be set via environment variable
const DEVICE_TRUST_SECRET = process.env.JWT_SECRET;
if (!DEVICE_TRUST_SECRET) {
  logger.warn('[PIN Auth] JWT_SECRET not configured - device trust tokens will fail validation');
}

// Helper: Generate device trust token
function generateDeviceTrustToken(userId: string, email: string, deviceId: string): string {
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

export type DeviceTrustCheck = {
  valid: boolean;
  reason?: 'no_secret' | 'malformed' | 'bad_signature' | 'expired' | 'revoked';
  userId?: string;
  email?: string;
  deviceId?: string;
  issuedAt?: number;
  expiresAt?: number;
};

/**
 * SERVER-SIDE REVOCATION (auth/identity sweep 2026-08-17).
 *
 * The device-trust token is a stateless HMAC, so before this change "revoke
 * trust" in Settings only deleted a localStorage key — the signed token stayed
 * valid for its full 30 days and any copy of it still bought a PIN sign-in.
 * We now keep a per-user revocation epoch in Firestore (`device_trust/{uid}`)
 * and refuse every token minted at or before it. Same store the email-change
 * flow already uses; no Postgres migration required.
 */
const DEVICE_TRUST_COLLECTION = 'device_trust';

export async function getDeviceTrustRevokedAt(userId: string): Promise<number> {
  try {
    const doc = await admin.firestore().collection(DEVICE_TRUST_COLLECTION).doc(userId).get();
    const value = doc.exists ? (doc.data() as any)?.revokedAtMs : undefined;
    return typeof value === 'number' ? value : 0;
  } catch (error) {
    // FAIL CLOSED for a security check: if we cannot confirm the token was NOT
    // revoked, treat it as revoked rather than granting trust on an outage.
    logger.error('[PIN Auth] device-trust revocation lookup failed — failing closed', error);
    return Number.MAX_SAFE_INTEGER;
  }
}

// Helper: Verify device trust token (signature + expiry + server-side revocation)
export async function verifyDeviceTrustToken(token: string): Promise<DeviceTrustCheck> {
  try {
    if (!DEVICE_TRUST_SECRET) {
      logger.error('[PIN Auth] Cannot verify token: JWT_SECRET not configured');
      return { valid: false, reason: 'no_secret' };
    }

    const decoded = Buffer.from(token, 'base64').toString('utf8');
    const [payloadStr, signature] = decoded.split('.');

    if (!payloadStr || !signature) {
      return { valid: false, reason: 'malformed' };
    }

    const expectedSignature = crypto.createHmac('sha256', DEVICE_TRUST_SECRET)
      .update(payloadStr)
      .digest('hex');

    // Constant-time compare — a plain `!==` leaks a byte-position oracle.
    const sigBuf = Buffer.from(signature, 'utf8');
    const expBuf = Buffer.from(expectedSignature, 'utf8');
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return { valid: false, reason: 'bad_signature' };
    }

    const payload = JSON.parse(payloadStr);

    if (payload.expiresAt < Date.now()) {
      return { valid: false, reason: 'expired' };
    }

    const revokedAt = await getDeviceTrustRevokedAt(String(payload.userId));
    if (revokedAt && Number(payload.issuedAt || 0) <= revokedAt) {
      return { valid: false, reason: 'revoked' };
    }

    return {
      valid: true,
      userId: payload.userId,
      email: payload.email,
      deviceId: payload.deviceId,
      issuedAt: payload.issuedAt,
      expiresAt: payload.expiresAt,
    };
  } catch (error) {
    return { valid: false, reason: 'malformed' };
  }
}

/**
 * GET /api/pin-auth/device-trust/status
 *
 * Server-authoritative "is this device remembered?" — replaces the Settings page
 * reading localStorage and calling that a security status. The client presents
 * whatever trust token it holds; the SERVER decides whether it is real, whose it
 * is, and when it dies.
 */
router.get('/device-trust/status', validateFirebaseToken, async (req: Request, res: Response) => {
  try {
    const uid = req.firebaseUser!.uid;
    const token = (req.headers['x-device-trust-token'] as string) || '';

    if (!token) {
      return res.json({ success: true, trusted: false, reason: 'no_token' });
    }

    const result = await verifyDeviceTrustToken(token);
    // A valid token belonging to somebody else must never render as "your device".
    if (!result.valid || result.userId !== uid) {
      return res.json({
        success: true,
        trusted: false,
        reason: result.valid ? 'other_account' : (result.reason || 'invalid'),
      });
    }

    const daysRemaining = Math.max(0, Math.ceil(((result.expiresAt || 0) - Date.now()) / (24 * 60 * 60 * 1000)));
    return res.json({
      success: true,
      trusted: true,
      deviceId: result.deviceId || null,
      issuedAt: result.issuedAt || null,
      expiresAt: result.expiresAt || null,
      daysRemaining,
    });
  } catch (error) {
    logger.error('[PIN Auth] device-trust status error', error);
    return res.status(500).json({ success: false, error: 'Failed to check device trust' });
  }
});

/**
 * POST /api/pin-auth/device-trust/revoke
 *
 * Revokes EVERY device-trust token this user holds, on the server, immediately.
 * Previously "Revoke trust" only cleared localStorage on the device you clicked
 * from — the stolen/other device stayed trusted.
 */
router.post('/device-trust/revoke', validateFirebaseToken, async (req: Request, res: Response) => {
  try {
    const uid = req.firebaseUser!.uid;
    const revokedAtMs = Date.now();

    await admin.firestore().collection(DEVICE_TRUST_COLLECTION).doc(uid).set({
      revokedAtMs,
      revokedAt: admin.firestore.FieldValue.serverTimestamp(),
      ipAddress: getClientIP(req),
      userAgent: req.headers['user-agent'] || 'unknown',
    }, { merge: true });

    const userInfo = await resolvePinIdentityFromRequest(req);
    if (userInfo) {
      await logPinEvent({
        userId: userInfo.id,
        userType: userInfo.type,
        action: 'device_trust_revoked',
        req,
      });
    }

    logger.info('[PIN Auth] Device trust revoked for all devices', { userId: uid });
    return res.json({ success: true, revokedAtMs });
  } catch (error) {
    logger.error('[PIN Auth] device-trust revoke error', error);
    return res.status(500).json({ success: false, error: 'Failed to revoke device trust' });
  }
});

/**
 * POST /api/pin-auth/trusted-device-verify
 * Verify PIN from a trusted device and return Firebase custom token
 * Requires X-Device-Trust-Token header
 */
router.post('/trusted-device-verify', async (req: Request, res: Response) => {
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
      } else {
        pinVerifyRateLimits.set(clientIP, { count: 1, resetAt: now + PIN_VERIFY_WINDOW_MS });
      }
    } else {
      pinVerifyRateLimits.set(clientIP, { count: 1, resetAt: now + PIN_VERIFY_WINDOW_MS });
    }

    // Verify device trust token
    const trustToken = req.headers['x-device-trust-token'] as string;
    if (!trustToken) {
      return res.status(401).json({
        success: false,
        error: 'Device not trusted. Please sign in with full credentials first.',
        code: 'NO_TRUST_TOKEN'
      });
    }

    const tokenResult = await verifyDeviceTrustToken(trustToken);
    if (!tokenResult.valid) {
      return res.status(401).json({
        success: false,
        error: tokenResult.reason === 'revoked'
          ? 'This device is no longer trusted. Please sign in again.'
          : 'Device trust expired. Please sign in again.',
        code: tokenResult.reason === 'revoked' ? 'TRUST_REVOKED' : 'INVALID_TRUST_TOKEN'
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

    // A body email may never select a different account than the signed trust token.
    if (email && email.toLowerCase() !== tokenResult.email?.toLowerCase()) {
      return res.status(401).json({
        success: false,
        error: 'Email does not match trusted device.',
        code: 'EMAIL_MISMATCH'
      });
    }

    // Identity comes from the SIGNED trust token, never from the request body.
    const trustedEmail = tokenResult.email;
    if (!trustedEmail) {
      return res.status(401).json({ success: false, error: 'Invalid trust token', code: 'INVALID_TRUST_TOKEN' });
    }
    const userInfo = await findUserByEmail(trustedEmail);
    if (!userInfo) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or PIN'
      });
    }

    // Get PIN record
    const [pinRecord] = await db.select()
      .from(userPins)
      .where(and(
        eq(userPins.userId, userInfo.id),
        eq(userPins.userType, userInfo.type),
        eq(userPins.isActive, true)
      ))
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
      const remainingMinutes = Math.ceil(
        (new Date(pinRecord.lockoutUntil).getTime() - Date.now()) / 60000
      );
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
    let customToken: string | null = null;
    try {
      customToken = await firebaseAdminAuth.createCustomToken(userInfo.id);
    } catch (tokenError) {
      logger.error('[PIN Auth] Failed to create Firebase custom token', tokenError);
      return res.status(500).json({
        success: false,
        error: 'Authentication service error. Please try again.'
      });
    }

    // ── Phase 1 canonical identity wiring — flag-gated, default OFF.
    // Records the PIN provider link on identity_accounts. Observation
    // only — never merges. PIN auth requires prior PIN setup by the
    // authenticated user, so identity is always known here.
    try {
      const { getFeatureFlag } = await import('../services/SystemConfig');
      const identityUnifiedOn = await getFeatureFlag('ff.returning_user.identity_unified.enabled');
      if (identityUnifiedOn) {
        const { loginOrLink } = await import('../identity/loginOrLink');
        await loginOrLink({
          provider: 'pin',
          providerAccountId: userInfo.id,
          email: null,
          emailVerified: false,
          displayName: null,
        });
      }
    } catch (identityErr) {
      logger.warn('[PIN Auth] loginOrLink probe failed (non-blocking)', {
        userId: userInfo.id,
        error: identityErr instanceof Error ? identityErr.message : String(identityErr),
      });
    }

    logger.info('[PIN Auth] Trusted device PIN login success', { userId: userInfo.id, userType: userInfo.type });
    return res.json({ 
      success: true, 
      message: 'PIN verified successfully',
      token: customToken,
      userType: userInfo.type
    });

  } catch (error) {
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
router.post('/generate-device-trust', async (req: Request, res: Response) => {
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
      decodedToken = await firebaseAdminAuth.verifyIdToken(idToken, true);
    } catch (verifyError) {
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

  } catch (error) {
    logger.error('[PIN Auth] Generate device trust error', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to generate device trust'
    });
  }
});

export default router;
