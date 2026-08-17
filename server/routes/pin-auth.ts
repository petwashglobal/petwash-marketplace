/**
 * PIN Authentication Routes
 *
 * 2026-08-17 (PR-AUTH-SECURITY-9 §3): identity is DERIVED from the Firebase
 * session, NEVER from body.email or query.email. Any client-supplied email is
 * ignored on /setup /change /remove /status. /verify is the ONLY endpoint that
 * still accepts an email in the body, and that email MUST match the decoded
 * token (existing EMAIL_MISMATCH → 403 preserved).
 *
 * Features:
 * - 4-6 digit PIN setup / change / remove / status (self only)
 * - bcrypt hashing (never store plaintext PIN)
 * - Rate limiting (5 attempts, 15-minute lockout)
 * - Immutable audit logging
 */

import { Router, Request, Response } from 'express';
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

// Validation schemas — email is INTENTIONALLY absent from setup/change/remove
// (identity comes from the Firebase session, not the client).
const setupPinSchema = z.object({
  pin: z.string().min(4).max(6).regex(/^\d+$/, 'PIN must contain only digits'),
  confirmPin: z.string().min(4).max(6).regex(/^\d+$/, 'PIN must contain only digits').optional(),
  deviceId: z.string().optional(),
  deviceName: z.string().optional(),
  deviceType: z.enum(['ios', 'android', 'web', 'kiosk']).optional(),
});

// /verify is the ONE legacy endpoint that still keeps email in the body — it
// must match the decoded Bearer token exactly (EMAIL_MISMATCH → 403 preserved).
const verifyPinSchema = z.object({
  pin: z.string().min(4).max(6).regex(/^\d+$/, 'PIN must contain only digits'),
  email: z.string().email(),
  deviceId: z.string().optional(),
});

const changePinSchema = z.object({
  currentPin: z.string().min(4).max(6).regex(/^\d+$/, 'PIN must contain only digits'),
  newPin: z.string().min(4).max(6).regex(/^\d+$/, 'PIN must contain only digits'),
  confirmNewPin: z.string().min(4).max(6).regex(/^\d+$/, 'PIN must contain only digits').optional(),
});

const removePinSchema = z.object({
  currentPin: z.string().min(4).max(6).regex(/^\d+$/, 'PIN must contain only digits').optional(),
  pin: z.string().min(4).max(6).regex(/^\d+$/, 'PIN must contain only digits').optional(),
});

function getClientIP(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.ip || req.socket.remoteAddress || 'unknown';
}

/**
 * PR-AUTH-SECURITY-9 §3: authoritative identity resolver.
 * Decodes the Firebase Bearer ID token from the Authorization header. Returns
 * { uid, email } from the VERIFIED token — never from req.body or req.query.
 * On any failure the request is 401'd BEFORE any DB read. This is the single
 * choke-point that prevents user A from touching user B's PIN via a spoofed
 * body/query.email.
 */
async function resolveAuthedUser(
  req: Request,
  res: Response,
): Promise<{ uid: string; email: string | null } | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'Authentication required', code: 'AUTH_REQUIRED' });
    return null;
  }
  const idToken = authHeader.substring(7);
  try {
    const decoded = await firebaseAdminAuth.verifyIdToken(idToken, true);
    return { uid: decoded.uid, email: decoded.email?.toLowerCase() ?? null };
  } catch {
    res.status(401).json({ success: false, error: 'Invalid authentication token', code: 'INVALID_TOKEN' });
    return null;
  }
}

async function logPinEvent(params: {
  userId: string; userType: 'user' | 'customer'; action: string; req: Request;
  deviceId?: string; deviceType?: string; failedAttemptNumber?: number; lockoutDuration?: number;
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

/**
 * PR-AUTH-SECURITY-9 §3: resolve the authed-user's PIN-scope by (uid, email)
 * without trusting any client-supplied field. Prefers the users table (matched
 * by uid — the ID Firebase mints), falling back to customers table by email.
 */
async function findAuthedUserScope(
  authed: { uid: string; email: string | null },
): Promise<{ id: string; type: 'user' | 'customer' } | null> {
  const [user] = await db.select().from(users).where(eq(users.id, authed.uid)).limit(1);
  if (user) return { id: user.id, type: 'user' };
  if (authed.email) {
    const [customer] = await db.select().from(customers).where(eq(customers.email, authed.email)).limit(1);
    if (customer) return { id: customer.id.toString(), type: 'customer' };
  }
  return null;
}

/** POST /api/pin-auth/setup — CREATE-ONLY. 409 if a PIN already exists. */
router.post('/setup', async (req: Request, res: Response) => {
  const authed = await resolveAuthedUser(req, res);
  if (!authed) return;
  const validation = setupPinSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({ success: false, error: 'Invalid PIN format. PIN must be 4-6 digits.', details: validation.error.errors });
  }
  const { pin, confirmPin, deviceId, deviceName, deviceType } = validation.data;
  if (confirmPin !== undefined && confirmPin !== pin) {
    return res.status(400).json({ success: false, error: 'PINs do not match', code: 'PIN_MISMATCH' });
  }

  try {
    const userInfo = await findAuthedUserScope(authed);
    if (!userInfo) return res.status(404).json({ success: false, error: 'Account not found. Please register first.' });

    const [existingPin] = await db.select().from(userPins)
      .where(and(eq(userPins.userId, userInfo.id), eq(userPins.userType, userInfo.type), eq(userPins.isActive, true)))
      .limit(1);
    if (existingPin) {
      return res.status(409).json({ success: false, error: 'A PIN is already set for this account. Use /change instead.', code: 'PIN_ALREADY_EXISTS' });
    }

    const pinHash = await bcrypt.hash(pin, SALT_ROUNDS);
    await db.insert(userPins).values({
      userId: userInfo.id, userType: userInfo.type, pinHash, pinLength: pin.length,
      deviceId: deviceId || null, deviceName: deviceName || null, deviceType: deviceType || null,
      isActive: true, isPrimary: true,
    });
    await logPinEvent({ userId: userInfo.id, userType: userInfo.type, action: 'pin_created', req, deviceId, deviceType });
    logger.info('[PIN Auth] PIN created', { userId: userInfo.id });
    return res.json({ success: true, message: 'PIN created successfully', pinLength: pin.length });
  } catch (error) {
    logger.error('[PIN Auth] Setup error', error);
    return res.status(500).json({ success: false, error: 'Failed to setup PIN. Please try again.' });
  }
});

/** POST /api/pin-auth/verify — email in body MUST match decoded token. */
router.post('/verify', async (req: Request, res: Response) => {
  const authed = await resolveAuthedUser(req, res);
  if (!authed) return;
  const validation = verifyPinSchema.safeParse(req.body);
  if (!validation.success) return res.status(400).json({ success: false, error: 'Invalid PIN format' });
  const { pin, email, deviceId } = validation.data;
  if (email.toLowerCase() !== authed.email) {
    return res.status(403).json({ success: false, error: 'Email does not match authenticated user', code: 'EMAIL_MISMATCH' });
  }

  try {
    const userInfo = await findAuthedUserScope(authed);
    if (!userInfo) return res.status(401).json({ success: false, error: 'Invalid email or PIN' });

    const [pinRecord] = await db.select().from(userPins)
      .where(and(eq(userPins.userId, userInfo.id), eq(userPins.userType, userInfo.type), eq(userPins.isActive, true)))
      .limit(1);
    if (!pinRecord) return res.status(401).json({ success: false, error: 'PIN not set up. Please create a PIN first.', code: 'PIN_NOT_SETUP' });

    if (pinRecord.lockoutUntil && new Date() < new Date(pinRecord.lockoutUntil)) {
      const remainingMinutes = Math.ceil((new Date(pinRecord.lockoutUntil).getTime() - Date.now()) / 60000);
      return res.status(429).json({ success: false, error: `Account temporarily locked. Try again in ${remainingMinutes} minutes.`, code: 'ACCOUNT_LOCKED', lockoutMinutes: remainingMinutes });
    }

    const isValid = await bcrypt.compare(pin, pinRecord.pinHash);
    if (!isValid) {
      const newFailedAttempts = pinRecord.failedAttempts + 1;
      const shouldLockout = newFailedAttempts >= MAX_FAILED_ATTEMPTS;
      const lockoutUntil = shouldLockout ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000) : null;
      await db.update(userPins)
        .set({ failedAttempts: newFailedAttempts, lastFailedAt: new Date(), lockoutUntil })
        .where(eq(userPins.id, pinRecord.id));
      await logPinEvent({
        userId: userInfo.id, userType: userInfo.type,
        action: shouldLockout ? 'lockout_triggered' : 'login_failed',
        req, deviceId,
        failedAttemptNumber: newFailedAttempts,
        lockoutDuration: shouldLockout ? LOCKOUT_MINUTES : undefined,
      });
      if (shouldLockout) {
        return res.status(429).json({ success: false, error: `Too many failed attempts. Account locked for ${LOCKOUT_MINUTES} minutes.`, code: 'ACCOUNT_LOCKED', lockoutMinutes: LOCKOUT_MINUTES });
      }
      const attemptsRemaining = MAX_FAILED_ATTEMPTS - newFailedAttempts;
      return res.status(401).json({ success: false, error: `Invalid PIN. ${attemptsRemaining} attempts remaining.`, code: 'INVALID_PIN', attemptsRemaining });
    }

    await db.update(userPins)
      .set({ failedAttempts: 0, lockoutUntil: null, lastUsedAt: new Date() })
      .where(eq(userPins.id, pinRecord.id));
    await logPinEvent({ userId: userInfo.id, userType: userInfo.type, action: 'login_success', req, deviceId });

    let userData: any = null;
    if (userInfo.type === 'customer') {
      const [customer] = await db.select().from(customers).where(eq(customers.id, parseInt(userInfo.id)));
      if (customer) userData = { id: customer.id, email: customer.email, firstName: customer.firstName, lastName: customer.lastName, loyaltyTier: customer.loyaltyTier };
    } else {
      const [user] = await db.select().from(users).where(eq(users.id, userInfo.id));
      if (user) userData = { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, loyaltyTier: user.loyaltyTier };
    }
    logger.info('[PIN Auth] Login success', { userId: userInfo.id });
    return res.json({ success: true, message: 'PIN verified successfully', user: userData, userType: userInfo.type });
  } catch (error) {
    logger.error('[PIN Auth] Verify error', error);
    return res.status(500).json({ success: false, error: 'Verification failed. Please try again.' });
  }
});

/** POST /api/pin-auth/change — self only. currentPin + newPin. */
router.post('/change', async (req: Request, res: Response) => {
  const authed = await resolveAuthedUser(req, res);
  if (!authed) return;
  const validation = changePinSchema.safeParse(req.body);
  if (!validation.success) return res.status(400).json({ success: false, error: 'Invalid PIN format', details: validation.error.errors });
  const { currentPin, newPin, confirmNewPin } = validation.data;
  if (currentPin === newPin) return res.status(400).json({ success: false, error: 'New PIN must be different from current PIN' });
  if (confirmNewPin !== undefined && confirmNewPin !== newPin) {
    return res.status(400).json({ success: false, error: 'PINs do not match', code: 'PIN_MISMATCH' });
  }

  try {
    const userInfo = await findAuthedUserScope(authed);
    if (!userInfo) return res.status(404).json({ success: false, error: 'Account not found' });

    const [pinRecord] = await db.select().from(userPins)
      .where(and(eq(userPins.userId, userInfo.id), eq(userPins.userType, userInfo.type), eq(userPins.isActive, true)))
      .limit(1);
    if (!pinRecord) return res.status(400).json({ success: false, error: 'No PIN set up for this account' });

    const isValid = await bcrypt.compare(currentPin, pinRecord.pinHash);
    if (!isValid) return res.status(401).json({ success: false, error: 'Current PIN is incorrect', code: 'INVALID_PIN' });

    const newPinHash = await bcrypt.hash(newPin, SALT_ROUNDS);
    await db.update(userPins)
      .set({ pinHash: newPinHash, pinLength: newPin.length, failedAttempts: 0, lockoutUntil: null, updatedAt: new Date() })
      .where(eq(userPins.id, pinRecord.id));
    await logPinEvent({ userId: userInfo.id, userType: userInfo.type, action: 'pin_changed', req });
    logger.info('[PIN Auth] PIN changed', { userId: userInfo.id });
    return res.json({ success: true, message: 'PIN changed successfully' });
  } catch (error) {
    logger.error('[PIN Auth] Change error', error);
    return res.status(500).json({ success: false, error: 'Failed to change PIN. Please try again.' });
  }
});

/** DELETE /api/pin-auth/remove — self only. Requires currentPin in body. */
router.delete('/remove', async (req: Request, res: Response) => {
  const authed = await resolveAuthedUser(req, res);
  if (!authed) return;
  const validation = removePinSchema.safeParse(req.body || {});
  if (!validation.success) return res.status(400).json({ success: false, error: 'Invalid request', details: validation.error.errors });
  const currentPin = validation.data.currentPin ?? validation.data.pin;
  if (!currentPin) return res.status(400).json({ success: false, error: 'Current PIN is required to remove PIN authentication' });

  try {
    const userInfo = await findAuthedUserScope(authed);
    if (!userInfo) return res.status(404).json({ success: false, error: 'Account not found' });

    const [pinRecord] = await db.select().from(userPins)
      .where(and(eq(userPins.userId, userInfo.id), eq(userPins.userType, userInfo.type), eq(userPins.isActive, true)))
      .limit(1);
    if (!pinRecord) return res.status(400).json({ success: false, error: 'No PIN set up for this account' });

    const isValid = await bcrypt.compare(currentPin, pinRecord.pinHash);
    if (!isValid) return res.status(401).json({ success: false, error: 'Invalid PIN', code: 'INVALID_PIN' });

    await db.update(userPins).set({ isActive: false, updatedAt: new Date() }).where(eq(userPins.id, pinRecord.id));
    await logPinEvent({ userId: userInfo.id, userType: userInfo.type, action: 'pin_removed', req });
    logger.info('[PIN Auth] PIN removed', { userId: userInfo.id });
    return res.json({ success: true, message: 'PIN removed successfully' });
  } catch (error) {
    logger.error('[PIN Auth] Remove error', error);
    return res.status(500).json({ success: false, error: 'Failed to remove PIN. Please try again.' });
  }
});

/** GET /api/pin-auth/status — self only. NO query.email. */
router.get('/status', async (req: Request, res: Response) => {
  const authed = await resolveAuthedUser(req, res);
  if (!authed) return;
  try {
    const userInfo = await findAuthedUserScope(authed);
    if (!userInfo) return res.json({ success: true, hasPin: false, reason: 'Account not found' });
    const [pinRecord] = await db.select().from(userPins)
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
        : null,
    });
  } catch (error) {
    logger.error('[PIN Auth] Status check error', error);
    return res.status(500).json({ success: false, error: 'Failed to check PIN status' });
  }
});

// Trusted-device path (unchanged trust model — bound to HMAC-signed token).
const pinVerifyRateLimits = new Map<string, { count: number; resetAt: number }>();
const PIN_VERIFY_MAX_REQUESTS = 10;
const PIN_VERIFY_WINDOW_MS = 15 * 60 * 1000;
const DEVICE_TRUST_SECRET = process.env.JWT_SECRET;
if (!DEVICE_TRUST_SECRET) {
  logger.warn('[PIN Auth] JWT_SECRET not configured - device trust tokens will fail validation');
}
function generateDeviceTrustToken(userId: string, email: string, deviceId: string): string {
  if (!DEVICE_TRUST_SECRET) throw new Error('JWT_SECRET not configured - cannot generate device trust token');
  const payload = JSON.stringify({ userId, email, deviceId, issuedAt: Date.now(), expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000 });
  const signature = crypto.createHmac('sha256', DEVICE_TRUST_SECRET).update(payload).digest('hex');
  return Buffer.from(`${payload}.${signature}`).toString('base64');
}
function verifyDeviceTrustToken(token: string): { valid: boolean; userId?: string; email?: string; deviceId?: string } {
  try {
    if (!DEVICE_TRUST_SECRET) return { valid: false };
    const decoded = Buffer.from(token, 'base64').toString('utf8');
    const [payloadStr, signature] = decoded.split('.');
    if (!payloadStr || !signature) return { valid: false };
    const expectedSignature = crypto.createHmac('sha256', DEVICE_TRUST_SECRET).update(payloadStr).digest('hex');
    if (signature !== expectedSignature) return { valid: false };
    const payload = JSON.parse(payloadStr);
    if (payload.expiresAt < Date.now()) return { valid: false };
    return { valid: true, userId: payload.userId, email: payload.email, deviceId: payload.deviceId };
  } catch { return { valid: false }; }
}

router.post('/trusted-device-verify', async (req: Request, res: Response) => {
  try {
    const clientIP = getClientIP(req);
    const now = Date.now();
    const rateLimit = pinVerifyRateLimits.get(clientIP);
    if (rateLimit) {
      if (now < rateLimit.resetAt) {
        if (rateLimit.count >= PIN_VERIFY_MAX_REQUESTS) {
          return res.status(429).json({ success: false, error: 'Too many attempts. Please wait 15 minutes.', code: 'RATE_LIMITED' });
        }
        rateLimit.count++;
      } else {
        pinVerifyRateLimits.set(clientIP, { count: 1, resetAt: now + PIN_VERIFY_WINDOW_MS });
      }
    } else {
      pinVerifyRateLimits.set(clientIP, { count: 1, resetAt: now + PIN_VERIFY_WINDOW_MS });
    }
    const trustToken = req.headers['x-device-trust-token'] as string;
    if (!trustToken) return res.status(401).json({ success: false, error: 'Device not trusted. Please sign in with full credentials first.', code: 'NO_TRUST_TOKEN' });
    const tokenResult = verifyDeviceTrustToken(trustToken);
    if (!tokenResult.valid) return res.status(401).json({ success: false, error: 'Device trust expired. Please sign in again.', code: 'INVALID_TRUST_TOKEN' });

    const validation = verifyPinSchema.safeParse(req.body);
    if (!validation.success) return res.status(400).json({ success: false, error: 'Invalid PIN format' });
    const { pin, email, deviceId } = validation.data;
    if (email.toLowerCase() !== tokenResult.email?.toLowerCase()) {
      return res.status(401).json({ success: false, error: 'Email does not match trusted device.', code: 'EMAIL_MISMATCH' });
    }

    // Resolve scope by (uid, email) from the TRUSTED token, NOT client-supplied email.
    const authedFromToken = { uid: tokenResult.userId!, email: tokenResult.email!.toLowerCase() };
    const userInfo = await findAuthedUserScope(authedFromToken);
    if (!userInfo) return res.status(401).json({ success: false, error: 'Invalid email or PIN' });

    const [pinRecord] = await db.select().from(userPins)
      .where(and(eq(userPins.userId, userInfo.id), eq(userPins.userType, userInfo.type), eq(userPins.isActive, true)))
      .limit(1);
    if (!pinRecord) return res.status(401).json({ success: false, error: 'PIN not set up for this account.', code: 'PIN_NOT_SETUP' });
    if (pinRecord.lockoutUntil && new Date() < new Date(pinRecord.lockoutUntil)) {
      const remainingMinutes = Math.ceil((new Date(pinRecord.lockoutUntil).getTime() - Date.now()) / 60000);
      return res.status(429).json({ success: false, error: `Account temporarily locked. Try again in ${remainingMinutes} minutes.`, code: 'ACCOUNT_LOCKED', lockoutMinutes: remainingMinutes });
    }

    const isValid = await bcrypt.compare(pin, pinRecord.pinHash);
    if (!isValid) {
      const newFailedAttempts = pinRecord.failedAttempts + 1;
      const shouldLockout = newFailedAttempts >= MAX_FAILED_ATTEMPTS;
      const lockoutUntil = shouldLockout ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000) : null;
      await db.update(userPins).set({ failedAttempts: newFailedAttempts, lastFailedAt: new Date(), lockoutUntil }).where(eq(userPins.id, pinRecord.id));
      await logPinEvent({
        userId: userInfo.id, userType: userInfo.type,
        action: shouldLockout ? 'trusted_device_lockout' : 'trusted_device_login_failed',
        req, deviceId,
        failedAttemptNumber: newFailedAttempts,
        lockoutDuration: shouldLockout ? LOCKOUT_MINUTES : undefined,
      });
      if (shouldLockout) {
        return res.status(429).json({ success: false, error: `Too many failed attempts. Account locked for ${LOCKOUT_MINUTES} minutes.`, code: 'ACCOUNT_LOCKED', lockoutMinutes: LOCKOUT_MINUTES });
      }
      const attemptsRemaining = MAX_FAILED_ATTEMPTS - newFailedAttempts;
      return res.status(401).json({ success: false, error: `Invalid PIN. ${attemptsRemaining} attempts remaining.`, code: 'INVALID_PIN', attemptsRemaining });
    }

    await db.update(userPins).set({ failedAttempts: 0, lockoutUntil: null, lastUsedAt: new Date(), lastSuccessIP: clientIP }).where(eq(userPins.id, pinRecord.id));
    await logPinEvent({ userId: userInfo.id, userType: userInfo.type, action: 'trusted_device_login_success', req, deviceId });

    let customToken: string | null = null;
    try {
      customToken = await firebaseAdminAuth.createCustomToken(userInfo.id);
    } catch (tokenError) {
      logger.error('[PIN Auth] Failed to create Firebase custom token', tokenError);
      return res.status(500).json({ success: false, error: 'Authentication service error. Please try again.' });
    }
    logger.info('[PIN Auth] Trusted device PIN login success', { userId: userInfo.id });
    return res.json({ success: true, message: 'PIN verified successfully', token: customToken, userType: userInfo.type });
  } catch (error) {
    logger.error('[PIN Auth] Trusted device verify error', error);
    return res.status(500).json({ success: false, error: 'Verification failed. Please try again.' });
  }
});

router.post('/generate-device-trust', async (req: Request, res: Response) => {
  const authed = await resolveAuthedUser(req, res);
  if (!authed) return;
  try {
    const { deviceId } = req.body || {};
    if (!deviceId) return res.status(400).json({ success: false, error: 'Device ID is required' });
    if (!authed.email) return res.status(400).json({ success: false, error: 'Email not found in authentication token' });
    const trustToken = generateDeviceTrustToken(authed.uid, authed.email, deviceId);
    await logPinEvent({ userId: authed.uid, userType: 'user', action: 'device_trust_created', req, deviceId });
    logger.info('[PIN Auth] Device trust token generated', { userId: authed.uid, deviceId });
    return res.json({ success: true, deviceTrustToken: trustToken, expiresInDays: 30 });
  } catch (error) {
    logger.error('[PIN Auth] Generate device trust error', error);
    return res.status(500).json({ success: false, error: 'Failed to generate device trust' });
  }
});

export default router;
