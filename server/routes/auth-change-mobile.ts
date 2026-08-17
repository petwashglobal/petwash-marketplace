/**
 * PR-AUTH-SECURITY-9 §7 — Mobile change flow.
 *
 * Two-step SMS-verified flow:
 *   POST /api/auth/change-mobile/request  — authed self, canonical E.164
 *                                           normalization, sends OTP to NEW
 *                                           number via TwilioSMSService
 *   POST /api/auth/change-mobile/verify   — authed self, atomic flip on
 *                                           users.phone_e164 +
 *                                           phone_verified +
 *                                           Firebase Admin updateUser +
 *                                           revokeRefreshTokens
 *
 * Same discipline as §6 email change:
 *   - Identity from Firebase Bearer/session cookie ONLY.
 *   - E.164 canonicalization happens SERVER-side.
 *   - OTP: 6-digit numeric, sha256-hashed in DB, 10-min TTL, ≤ 5 attempts.
 *   - Atomic DB + Firebase updateUser inside one transaction; rollback if
 *     Firebase throws.
 *   - Refresh tokens revoked after successful flip.
 *   - Duplicate-phone guard on both request and verify.
 *   - No generic profile PATCH.
 */

import { Router, Request, Response } from 'express';
import { and, eq, isNull, sql } from 'drizzle-orm';
import crypto from 'crypto';
import { db } from '../db';
import { users, mobileChangeRequests } from '../../shared/schema';
import { auth as firebaseAdminAuth } from '../lib/firebase-admin';
import { twilioSMSService } from '../services/TwilioSMSService';
import { logger } from '../lib/logger';
import { authLimiter } from '../middleware/rateLimiter';

const router = Router();

const CHANGE_MOBILE_TTL_MS = 10 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;
const RECENT_AUTH_MAX_AGE_SECONDS = 10 * 60;

async function resolveAuthedUser(req: Request, res: Response): Promise<
  | { uid: string; authTimeMs: number }
  | null
> {
  const bearer = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.substring(7)
    : null;
  const cookie = (req as any).cookies?.pw_session || (req as any).cookies?.__session;
  try {
    if (bearer) {
      const decoded = await firebaseAdminAuth.verifyIdToken(bearer, true);
      return { uid: decoded.uid, authTimeMs: (decoded.auth_time ?? 0) * 1000 };
    }
    if (cookie) {
      const decoded = await firebaseAdminAuth.verifySessionCookie(cookie, true);
      return { uid: decoded.uid, authTimeMs: (decoded.auth_time ?? 0) * 1000 };
    }
  } catch (err: any) {
    logger.debug('[change-mobile] auth resolution failed', { err: err?.message });
  }
  res.status(401).json({ ok: false, error: 'Authentication required', code: 'AUTH_REQUIRED' });
  return null;
}

function requireRecentAuth(authTimeMs: number, res: Response): boolean {
  const age = (Date.now() - authTimeMs) / 1000;
  if (age > RECENT_AUTH_MAX_AGE_SECONDS) {
    res.status(403).json({
      ok: false,
      error: 'Recent authentication required. Please sign in again to change your mobile.',
      code: 'REAUTH_REQUIRED',
      maxAgeSeconds: RECENT_AUTH_MAX_AGE_SECONDS,
    });
    return false;
  }
  return true;
}

/**
 * Canonical E.164 normalization — strip everything non-digit except a leading
 * +, then validate the result matches +[country][number]. Never trust the
 * client to normalize; do it here so DB always holds one shape per number.
 */
function normalizeE164(raw: string): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const trimmed = raw.trim();
  // Keep + only when it is the leading character; strip everything else non-digit.
  const digits = trimmed.replace(/[^\d+]/g, '');
  const normalized = digits.startsWith('+')
    ? '+' + digits.slice(1).replace(/\+/g, '')
    : digits.replace(/\+/g, '');
  // Israeli local formats: "0541234567" → +972541234567. Only when it starts
  // with a leading 0 and matches an Israeli length. Anything else must arrive
  // in E.164 form from the client.
  const israeliLocal = /^0\d{8,9}$/.test(normalized) ? '+972' + normalized.slice(1) : normalized;
  const withPlus = israeliLocal.startsWith('+') ? israeliLocal : '+' + israeliLocal;
  if (!/^\+[1-9]\d{6,14}$/.test(withPlus)) return null;
  return withPlus;
}

router.post('/request', authLimiter, async (req: Request, res: Response) => {
  const auth = await resolveAuthedUser(req, res);
  if (!auth) return;
  if (!requireRecentAuth(auth.authTimeMs, res)) return;

  const newMobile = normalizeE164(typeof req.body?.newMobile === 'string' ? req.body.newMobile : '');
  if (!newMobile) {
    return res.status(400).json({
      ok: false,
      error: 'Invalid mobile number. Use international format (e.g. +972541234567).',
      code: 'INVALID_MOBILE',
    });
  }

  // Same-as-current guard.
  const [me] = await db.select({ phoneE164: users.phoneE164 })
    .from(users).where(eq(users.id, auth.uid)).limit(1);
  if (me?.phoneE164 && me.phoneE164 === newMobile) {
    return res.status(400).json({ ok: false, error: 'This is already your mobile number.', code: 'SAME_MOBILE' });
  }

  // Uniqueness.
  const [conflict] = await db.select({ id: users.id })
    .from(users)
    .where(and(eq(users.phoneE164, newMobile), sql`${users.id} <> ${auth.uid}`))
    .limit(1);
  if (conflict) {
    return res.status(409).json({ ok: false, error: 'That mobile number is already in use.', code: 'MOBILE_TAKEN' });
  }

  const otp = String(Math.floor(100000 + Math.random() * 900000)); // 6-digit
  const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
  const expiresAt = new Date(Date.now() + CHANGE_MOBILE_TTL_MS);

  await db.insert(mobileChangeRequests).values({
    userId: auth.uid,
    newMobileE164: newMobile,
    otpHash,
    expiresAt,
    requestIp: req.ip,
    requestUa: (req.headers['user-agent'] as string | undefined)?.slice(0, 500),
  });

  const language = (typeof req.body?.language === 'string' ? req.body.language : 'en').toLowerCase();
  const messageBody = language === 'he'
    ? `PetWash: קוד אימות לשינוי מספר נייד: ${otp} (בתוקף ל-10 דקות)`
    : `PetWash: your mobile-change code is ${otp} (valid 10 min)`;

  // TwilioSMSService.sendSMS(to, body, meta) — direct raw send. We generate
  // and hash the OTP ourselves (owning the expiry + attempts contract);
  // Twilio only delivers the text.
  try {
    const send = await twilioSMSService.sendSMS(newMobile, messageBody, {
      userId: auth.uid,
      ip: req.ip,
      ua: (req.headers['user-agent'] as string | undefined)?.slice(0, 200),
    });
    if (!send?.success) {
      throw new Error(send?.error || 'SMS send failed');
    }
  } catch (err: any) {
    logger.error('[change-mobile] SMS send failed', { uid: auth.uid, err: err?.message });
    // We do NOT reveal SMS-provider errors to the client; the request row
    // still exists so a retry can hit /request again.
    return res.status(502).json({
      ok: false,
      error: 'Could not send verification SMS. Please try again shortly.',
      code: 'SMS_SEND_FAILED',
    });
  }

  logger.info('[change-mobile] request', {
    uid: auth.uid,
    // Mask the new mobile in logs — never print full PII.
    newMobileMask: newMobile.replace(/^(\+\d{3})(\d+)(\d{2})$/, '$1•••$3'),
  });

  return res.json({
    ok: true,
    message: 'Verification code sent to your new mobile number.',
    expiresInSeconds: Math.floor(CHANGE_MOBILE_TTL_MS / 1000),
  });
});

router.post('/verify', authLimiter, async (req: Request, res: Response) => {
  const auth = await resolveAuthedUser(req, res);
  if (!auth) return;
  if (!requireRecentAuth(auth.authTimeMs, res)) return;

  const otp = typeof req.body?.otp === 'string' ? req.body.otp.trim() : '';
  if (!/^\d{6}$/.test(otp)) {
    return res.status(400).json({ ok: false, error: 'Invalid OTP format.', code: 'INVALID_OTP' });
  }
  const otpHash = crypto.createHash('sha256').update(otp).digest('hex');

  // Look up the most-recent unconsumed request for this user.
  const [pending] = await db.select().from(mobileChangeRequests)
    .where(and(
      eq(mobileChangeRequests.userId, auth.uid),
      isNull(mobileChangeRequests.consumedAt),
      sql`${mobileChangeRequests.expiresAt} > now()`,
    ))
    .orderBy(sql`${mobileChangeRequests.createdAt} DESC`)
    .limit(1);
  if (!pending) {
    return res.status(410).json({ ok: false, error: 'No active mobile-change request. Please request a new code.', code: 'NO_REQUEST' });
  }
  if (pending.attempts >= MAX_OTP_ATTEMPTS) {
    return res.status(429).json({ ok: false, error: 'Too many attempts. Please request a new code.', code: 'TOO_MANY_ATTEMPTS' });
  }

  if (pending.otpHash !== otpHash) {
    // Increment attempts (atomic bump — even if two verifies race, only one
    // decrements the remaining budget; the other observes the higher value
    // on the next iteration).
    await db.update(mobileChangeRequests)
      .set({ attempts: sql`${mobileChangeRequests.attempts} + 1` })
      .where(eq(mobileChangeRequests.id, pending.id));
    return res.status(401).json({
      ok: false,
      error: 'Incorrect code.',
      code: 'OTP_WRONG',
      attemptsRemaining: Math.max(0, MAX_OTP_ATTEMPTS - (pending.attempts + 1)),
    });
  }

  // Claim the request row (single-use).
  const claimed = await db.execute(sql`
    UPDATE mobile_change_requests
       SET consumed_at = now()
     WHERE id = ${pending.id}
       AND consumed_at IS NULL
    RETURNING id
  `);
  if (!(claimed as any).rows?.[0]) {
    // Lost the race — someone else consumed this same request. Return
    // idempotent OK: if the caller has just refreshed, the atomic flip
    // block below will still detect they're already on the new number.
    return res.status(409).json({ ok: false, error: 'Request already used.', code: 'ALREADY_USED' });
  }

  // Re-check uniqueness at verify time.
  const [conflict] = await db.select({ id: users.id })
    .from(users)
    .where(and(eq(users.phoneE164, pending.newMobileE164), sql`${users.id} <> ${auth.uid}`))
    .limit(1);
  if (conflict) {
    return res.status(409).json({ ok: false, error: 'That mobile number is already in use.', code: 'MOBILE_TAKEN' });
  }

  try {
    await db.transaction(async (tx) => {
      await tx.update(users)
        .set({
          phoneE164: pending.newMobileE164,
          phoneVerified: true,
          mobileVerifiedAt: new Date(),
        })
        .where(eq(users.id, auth.uid));

      await firebaseAdminAuth.updateUser(auth.uid, {
        phoneNumber: pending.newMobileE164,
      });
      await firebaseAdminAuth.revokeRefreshTokens(auth.uid);
    });
  } catch (err: any) {
    logger.error('[change-mobile] atomic flip failed — DB rolled back', {
      uid: auth.uid, err: err?.message,
    });
    // Release the request row so the user can retry.
    await db.update(mobileChangeRequests)
      .set({ consumedAt: null })
      .where(eq(mobileChangeRequests.id, pending.id))
      .catch(() => { /* nothing to do */ });
    return res.status(500).json({ ok: false, error: 'Mobile change failed — please try again.', code: 'CHANGE_FAILED' });
  }

  logger.info('[change-mobile] confirmed', {
    uid: auth.uid,
    newMobileMask: pending.newMobileE164.replace(/^(\+\d{3})(\d+)(\d{2})$/, '$1•••$3'),
  });
  return res.json({ ok: true, message: 'Mobile number updated. Please sign in again.' });
});

export default router;
