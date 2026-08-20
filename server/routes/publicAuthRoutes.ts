import express from "express";
import crypto from 'crypto';
import { z } from 'zod';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { getCurrentUser } from "../simpleAuth";
import { apiLimiter } from '../middleware/rateLimiter';
import { logger } from "../lib/logger";
import { verifyCaptchaToken } from "../lib/verifyCaptcha";
import { verifyTurnstileToken } from "../lib/verifyTurnstile";
import { twilioSMSService } from "../services/TwilioSMSService";
import { isUnifiedVerificationSignupEnabled } from "../lib/feature-flags/unifiedVerification";
import { UnifiedVerificationError, unifiedVerificationService } from "../services/UnifiedVerificationService";
import { db as firestoreDb, auth as fbAdminAuth } from '../lib/firebase-admin';
import { sql, eq } from 'drizzle-orm';
import { pool, db } from '../db';
import { userConsents, authEvents, users, smsEvidence, otpEvents } from '@shared/schema';
import { storage } from '../storage';
import { ensureUserProvisioned, AuthBootstrapUsersRowFailed } from '../services/authBootstrap';
import { validateEmailVerifiedToken } from '../lib/emailVerifiedToken';
import { mintMfaLoginToken } from '../lib/mfaLoginToken';

// Rate limiter: max 3 SMS send attempts per IP per 10 minutes.
// Tight window prevents bulk enumeration or accidental spam from a single device.
// ipKeyGenerator normalises IPv6-mapped IPv4 addresses (e.g. "::ffff:1.2.3.4" → "1.2.3.4")
// so that IPv4 and IPv6 connections to the same IP share the same rate-limit bucket.
// LAUNCH-SAFETY 2026-06-18: was max 3 per IP / 10 min. Households, offices, and
// mobile-carrier CGNAT share one egress IP, so 3-4 real users would lock each other
// out. Raised to 12; the per-phone caps + 60s cooldown are the correct granularity.
// env-tunable via SMS_IP_SEND_LIMIT.
const phoneSendRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: parseInt(process.env.SMS_IP_SEND_LIMIT || '12', 10),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: ipKeyGenerator,
  validate: { xForwardedForHeader: false, ip: false, default: false },
  handler: (_req, res) => {
    logger.warn('[PublicAuth] SMS rate limit hit', { ip: _req.ip });
    return res.status(429).json({
      ok: false,
      error: 'Too many requests. Please wait 10 minutes before trying again.'
    });
  }
});

// Rate limiter: max 5 verify attempts per IP per 5 minutes.
// Matches the per-phone lockout threshold so brute-force via multiple phones is also blocked.
const phoneVerifyRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: ipKeyGenerator,
  validate: { xForwardedForHeader: false, ip: false, default: false },
  handler: (_req, res) => {
    return res.status(429).json({
      ok: false,
      error: 'Too many attempts. Please wait 5 minutes.'
    });
  }
});

async function getFirebaseUserFromRequest(req: express.Request): Promise<{uid: string; email?: string; displayName?: string} | null> {
  try {
    const authHeader = req.headers.authorization;
    const sessionCookie = req.cookies?.pw_session;
    if (!authHeader?.startsWith('Bearer ') && !sessionCookie) return null;

    const { auth: fbAdmin } = await import('../lib/firebase-admin');
    let decoded: any;
    if (authHeader?.startsWith('Bearer ')) {
      decoded = await fbAdmin.verifyIdToken(authHeader.substring(7), true);
    } else if (sessionCookie) {
      decoded = await fbAdmin.verifySessionCookie(sessionCookie, true);
    }
    if (!decoded) return null;
    const userRecord = await fbAdmin.getUser(decoded.uid);
    return {
      uid: decoded.uid,
      email: decoded.email || userRecord.email,
      displayName: userRecord.displayName || undefined,
    };
  } catch (err) {
    logger.debug('[PublicAuth] Firebase token check failed:', err);
    return null;
  }
}

export const publicAuthRouter = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// @deprecated — LEGACY phone-OTP routes.
// The /api/auth/phone/* and /api/auth/phone-session endpoints below are the older
// phone-OTP stacks. They are SUPERSEDED by the canonical SMS auth wrapper at
// /api/auth/sms (server/routes/auth-sms.ts), which delegates to the same
// TwilioSMSService engine + session-cookie chain. They are retained for backward
// compatibility and MUST NOT be removed yet — a follow-up PR will consolidate all
// callers onto /api/auth/sms and then delete these. Do not add new callers here.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sends guaranteed JSON response with a safe status code.
 * use200 = return HTTP 200 always (for unauthenticated cases)
 */
function sendSafeJSON(res: express.Response, data: any, use200 = true) {
  if (use200) {
    return res.status(200).json(data);
  } else {
    return res.status(data.status || 400).json(data);
  }
}

/**
 * Authentication status endpoint
 * NEVER returns 401 for normal visitors
 * ONLY returns 401 if a token is present but INVALID
 * 
 * Returns HTTP 200 for:
 * - Logged out users: {ok:true, authenticated:false, user:null}
 * - Logged in users: {ok:true, authenticated:true, user:{...}}
 */
publicAuthRouter.get("/api/simple-auth/me", apiLimiter, async (req, res) => {
  try {
    const user = await getCurrentUser(req);

    if (user) {
      return sendSafeJSON(res, {
        ok: true,
        authenticated: true,
        user,
      });
    }

    // Attempt to decode Firebase token/session to check iat and role for stale-token enforcement.
    const authHeader = req.headers.authorization;
    const sessionCookie = req.cookies?.pw_session;
    if (authHeader?.startsWith('Bearer ') || sessionCookie) {
      try {
        const { auth: fbAdmin } = await import('../lib/firebase-admin');
        let decoded: any;
        if (authHeader?.startsWith('Bearer ')) {
          decoded = await fbAdmin.verifyIdToken(authHeader.substring(7), true);
        } else if (sessionCookie) {
          decoded = await fbAdmin.verifySessionCookie(sessionCookie, true);
        }
        if (decoded) {
          // Reject stale tokens (>24h iat) for privileged roles.
          const PRIVILEGED_ROLES = ['admin', 'management', 'super_admin', 'ceo', 'finance', 'employee', 'staff'];
          const decodedRole = decoded.role || decoded['custom:role'] || '';
          if (PRIVILEGED_ROLES.includes(decodedRole) && decoded.iat) {
            const tokenAgeSeconds = Math.floor(Date.now() / 1000) - decoded.iat;
            if (tokenAgeSeconds > 86400) {
              logger.warn('[PublicAuth] /simple-auth/me: stale privileged token rejected', {
                uid: decoded.uid, role: decodedRole, tokenAgeSeconds,
              });
              return res.status(401).json({ ok: false, error: 'stale-token' });
            }
          }
          const userRecord = await fbAdmin.getUser(decoded.uid);
          // Enrich with membershipNumber from DB so the frontend can always show the member badge
          let membershipNumber: string | null = null;
          try {
            const { db: pgDb } = await import('../db');
            const { users: usersTable } = await import('@shared/schema');
            const { eq: pgEq } = await import('drizzle-orm');
            const [dbUser] = await pgDb
              .select({ membershipNumber: usersTable.membershipNumber })
              .from(usersTable)
              .where(pgEq(usersTable.id, decoded.uid))
              .limit(1);
            membershipNumber = dbUser?.membershipNumber || null;
          } catch {
            // Non-blocking — membership number is cosmetic
          }
          return sendSafeJSON(res, {
            ok: true,
            authenticated: true,
            user: {
              uid: decoded.uid,
              email: decoded.email || userRecord.email,
              displayName: userRecord.displayName || undefined,
              firstName: userRecord.displayName?.split(' ')[0] || '',
              lastName: userRecord.displayName?.split(' ').slice(1).join(' ') || '',
              authProvider: 'firebase',
              membershipNumber,
            },
          });
        }
      } catch (fbErr) {
        logger.debug('[PublicAuth] Firebase token check failed in /simple-auth/me:', fbErr);
        if (String(fbErr).includes("INVALID_TOKEN") || String(fbErr).includes("Invalid session")) {
          return res.status(401).json({ ok: false, error: "Invalid authentication token" });
        }
      }
    }

    return sendSafeJSON(res, {
      ok: true,
      authenticated: false,
      user: null,
    });

  } catch (err) {
    logger.error('[PublicAuth] Error checking auth status:', err);
    
    if (String(err).includes("INVALID_TOKEN") || String(err).includes("Invalid session")) {
      return res.status(401).json({
        ok: false,
        error: "Invalid authentication token",
      });
    }

    return res.status(500).json({
      ok: false,
      error: "Server error",
    });
  }
});

/**
 * Consent status endpoint
 * NEVER throws console errors for unauthenticated visitors
 * 
 * Returns HTTP 200 for:
 * - Logged out users: {ok:true, authenticated:false, consent:null}
 * - Logged in users: {ok:true, authenticated:true, consent:{...}}
 */
publicAuthRouter.get("/api/consent", async (req, res) => {
  try {
    // Get Firebase user ID if authenticated
    const firebaseUser = (req as any).firebaseUser;
    const userId = firebaseUser?.uid;
    
    // Not authenticated → normal → HTTP 200
    if (!userId) {
      return sendSafeJSON(res, {
        ok: true,
        authenticated: false,
        consent: null,
      });
    }

    // Authenticated → fetch consent from Firestore
    const snapshot = await firestoreDb
      .collection('consent_records')
      .where('userId', '==', userId)
      .orderBy('timestamp', 'desc')
      .limit(1)
      .get();

    if (snapshot.empty) {
      return sendSafeJSON(res, {
        ok: true,
        authenticated: true,
        consent: null,
      });
    }

    const latestConsent = snapshot.docs[0].data();

    return sendSafeJSON(res, {
      ok: true,
      authenticated: true,
      consent: {
        necessary: latestConsent.necessary,
        functional: latestConsent.functional,
        analytics: latestConsent.analytics,
        marketing: latestConsent.marketing,
        location: latestConsent.location ?? false,
        camera: latestConsent.camera ?? false,
        washReminders: latestConsent.washReminders ?? false,
        vaccinationReminders: latestConsent.vaccinationReminders ?? false,
        promotionalNotifications: latestConsent.promotionalNotifications ?? false,
        timestamp: latestConsent.timestamp,
      },
    });

  } catch (err) {
    logger.error('[PublicAuth] Error fetching consent:', err);
    
    if (String(err).includes("INVALID_TOKEN") || String(err).includes("Invalid session")) {
      return res.status(401).json({
        ok: false,
        error: "Invalid authentication token",
      });
    }

    return res.status(500).json({
      ok: false,
      error: "Server error",
    });
  }
});

/**
 * Send phone verification code via Twilio SMS
 * POST /api/auth/phone/send-code
 * SECURITY: Rate limited (3/10min per IP) + per-phone lockout + per-phone daily cap
 */
publicAuthRouter.post("/api/auth/phone/send-code", phoneSendRateLimiter, async (req, res) => {
  try {
    const traceId = (req as any).traceId || crypto.randomUUID();
    logger.info('[Auth] Phone code send started', { traceId, phone: req.body.phone?.slice(-4) });
    const { phone, language = 'he', captchaToken, turnstileToken } = req.body;
    
    if (!phone) {
      return res.status(400).json({
        ok: false,
        error: language === 'he' ? 'נדרש מספר טלפון' : 'Phone number is required'
      });
    }

    const callerIpEarly = req.ip || (req.headers['x-forwarded-for'] as string) || 'unknown';
    let securitySource = 'rate-limit-only';

    // ── Best-effort captcha (never blocks — phone OTP IS the authentication factor) ──
    // Security is enforced by: rate limiter (10/min/IP) + per-phone lockout +
    // daily SMS cap (5/phone/day) + global cap (150/day) + the OTP itself.
    // Captcha is bonus signal only. reCAPTCHA backend credentials are not
    // configured in Cloud Run, so blocking on captcha failure = permanent lockout.
    if (turnstileToken) {
      const turnstileResult = await verifyTurnstileToken(turnstileToken, callerIpEarly);
      if (turnstileResult.valid) {
        securitySource = 'turnstile';
        logger.info('[PublicAuth] Phone send-code: Turnstile passed (bonus)', { phone: phone.slice(-4) });
      } else {
        logger.warn('[PublicAuth] Phone send-code: Turnstile failed (non-blocking)', { phone: phone.slice(-4), reason: turnstileResult.reason });
      }
    } else if (captchaToken) {
      const captchaResult = await verifyCaptchaToken(captchaToken, 'phone_login');
      if (captchaResult.valid) {
        securitySource = 'recaptcha';
        logger.info('[PublicAuth] Phone send-code: reCAPTCHA passed (bonus)', { phone: phone.slice(-4), score: captchaResult.score });
      } else {
        // SECURITY (hostile audit): block when reCAPTCHA explicitly returns a real
        // score below 0.3 — indicative of automated abuse (scripted bot, emulator).
        // We guard on `typeof score === 'number'` to preserve the fail-open path when
        // credentials are not configured in Cloud Run (score would be undefined/null
        // there, not a real number), preventing a permanent lockout in that environment.
        // Turnstile (configured via TURNSTILE_SECRET_KEY) is a stronger CAPTCHA layer
        // and already handles the primary anti-bot signal on the frontend.
        if (typeof captchaResult.score === 'number' && captchaResult.score < 0.3 && captchaResult.source !== 'error') {
          logger.warn('[PublicAuth] Phone send-code: reCAPTCHA score critically low — blocking request', {
            phone: phone.slice(-4),
            score: captchaResult.score,
            reason: captchaResult.reason,
            source: captchaResult.source,
            traceId,
          });
          db.insert(authEvents).values({
            eventType: 'CAPTCHA_PHONE_OTP_BLOCKED',
            success: false,
            reason: `reCAPTCHA score ${captchaResult.score} < 0.3 — request blocked`,
            ip: callerIpEarly,
            userAgent: req.headers['user-agent'] || null,
            traceId,
          }).catch((dbErr: any) => logger.warn('[PublicAuth] authEvents insert failed', { error: dbErr?.message }));
          return res.status(429).json({
            ok: false,
            error: language === 'he' ? 'נדרש אימות אנושי — נסה שוב' : 'Human verification required — please try again',
            code: 'CAPTCHA_BLOCKED',
          });
        }
        securitySource = 'captcha-failed-proceed';
        logger.warn('[PublicAuth] Phone send-code: reCAPTCHA failed (non-blocking — proceeding with rate-limit protection)', {
          phone: phone.slice(-4),
          reason: captchaResult.reason,
          score: captchaResult.score,
          source: captchaResult.source,
        });
        db.insert(authEvents).values({
          eventType: 'CAPTCHA_PHONE_OTP_FAILED',
          success: false,
          reason: `${captchaResult.reason || 'low_score'} (score=${captchaResult.score}, source=${captchaResult.source}) — non-blocking`,
          ip: callerIpEarly,
          userAgent: req.headers['user-agent'] || null,
          traceId,
        }).catch((dbErr: any) => logger.warn('[PublicAuth] authEvents captcha insert failed', { error: dbErr?.message }));
      }
    } else {
      logger.info('[PublicAuth] Phone send-code: no captcha token — proceeding with rate-limit protection only', { phone: phone.slice(-4) });
    }

    logger.info('[PublicAuth] Phone send-code proceeding', { phone: phone.slice(-4), securitySource });

    // Check per-phone lockout (too many failed verify attempts) — checks Redis + memory
    const lockout = await twilioSMSService.checkPhoneLockout(phone, language);
    if (lockout) {
      logger.warn('[PublicAuth] Phone locked out, rejecting send', { phone: phone.slice(-4), ip: req.ip });
      return res.status(429).json({ ok: false, error: lockout.message, lockedUntil: lockout.lockedUntil });
    }

    // Check per-phone daily send cap (blocks SMS bombing to one number from multiple IPs)
    const dailyCheck = twilioSMSService.checkDailyPhoneCap(phone, language);
    if (dailyCheck) {
      logger.warn('[PublicAuth] Phone daily SMS cap reached', { phone: phone.slice(-4), ip: req.ip });
      // Track cap hit for bot rotation detection (many phones hitting cap = rotating bot)
      const { smsAbuseDetector } = await import('../services/SmsAbuseDetector');
      smsAbuseDetector.trackCapHit(phone).catch(() => {});
      return res.status(429).json({ ok: false, error: dailyCheck.message });
    }

    const callerIp = callerIpEarly;
    const result = await twilioSMSService.sendVerificationCode(phone, language, callerIp);

    // ── Persist every SMS send attempt to DB ───────────────────────────────
    const normalizedPhone = phone.trim().startsWith('+') ? phone.trim() : '+' + phone.trim().replace(/[^\d]/g, '');
    const smsText = result.success
      ? `[code hidden for security — send OK]`
      : `[send failed: ${result.message}]`;
    db.insert(smsEvidence).values({
      messageType: 'OTP',
      templateId: 'phone_login_v1',
      templateVersion: '1.0',
      toPhone: normalizedPhone,
      renderedText: smsText,
      contentHash: crypto.createHash('sha256').update(normalizedPhone + traceId).digest('hex'),
      provider: 'twilio',
      providerMessageId: result.messageId || null,
      status: result.success ? 'sent' : 'failed',
      failureReason: result.success ? null : result.message,
      ip: callerIp,
      userAgent: req.headers['user-agent'] || null,
      traceId,
    }).catch((dbErr: any) => logger.warn('[PublicAuth] sms_evidence insert failed (non-blocking)', { error: dbErr?.message }));

    db.insert(otpEvents).values({
      otpId: traceId,
      eventType: 'OTP_SENT',
      phoneE164: normalizedPhone,
      userTypeIntent: 'PUBLIC',
      provider: 'twilio',
      providerMessageId: result.messageId || null,
      ip: callerIp,
      userAgent: req.headers['user-agent'] || null,
      traceId,
    }).catch((dbErr: any) => logger.warn('[PublicAuth] otp_events insert failed (non-blocking)', { error: dbErr?.message }));
    // ──────────────────────────────────────────────────────────────────────

    if (!result.success) {
      db.insert(authEvents).values({
        eventType: 'OTP_SEND_FAILED',
        success: false,
        reason: result.message || 'twilio_error',
        ip: callerIp,
        userAgent: req.headers['user-agent'] || null,
        traceId,
      }).catch((dbErr: any) => logger.warn('[PublicAuth] authEvents otp_send insert failed', { error: dbErr?.message }));
    }

    return res.status(result.success ? 200 : 400).json({
      ok: result.success,
      message: result.message,
      expiresIn: result.expiresIn,
      traceId
    });
  } catch (err) {
    const traceId = (req as any).traceId || crypto.randomUUID();
    logger.error('[PublicAuth] Error sending phone verification:', err);
    return res.status(500).json({
      ok: false,
      error: 'Server error',
      traceId
    });
  }
});

/**
 * Verify phone code and create session
 * POST /api/auth/phone/verify-code
 */
publicAuthRouter.post("/api/auth/phone/verify-code", phoneVerifyRateLimiter, async (req, res) => {
  try {
    const traceId = (req as any).traceId || crypto.randomUUID();
    logger.info('[Auth] Phone verify started', { traceId });
    const { phone, code, language = 'he' } = req.body;
    
    if (!phone || !code) {
      return res.status(400).json({
        ok: false,
        error: language === 'he' ? 'נדרשים מספר טלפון וקוד אימות' : 'Phone number and verification code are required'
      });
    }

    const result = await twilioSMSService.verifyCode(phone, code, language);
    const normalizedPhone2 = phone.trim().startsWith('+') ? phone.trim() : '+' + phone.trim().replace(/[^\d]/g, '');
    const callerIp2 = req.ip || (req.headers['x-forwarded-for'] as string) || 'unknown';

    // ── Persist verification attempt to DB ────────────────────────────────
    db.insert(otpEvents).values({
      otpId: `verify_${traceId}`,
      eventType: result.success ? 'OTP_VERIFIED' : 'OTP_FAILED',
      phoneE164: normalizedPhone2,
      userTypeIntent: 'PUBLIC',
      result: result.success ? 'success' : 'invalid_code',
      ip: callerIp2,
      userAgent: req.headers['user-agent'] || null,
      traceId,
      verifiedAt: result.success ? new Date() : null,
    }).catch((dbErr: any) => logger.warn('[PublicAuth] otp_events verify insert failed (non-blocking)', { error: dbErr?.message }));
    // ──────────────────────────────────────────────────────────────────────

    if (!result.success) {
      db.insert(authEvents).values({
        eventType: 'OTP_VERIFY_FAILED',
        success: false,
        reason: result.message || 'invalid_code',
        ip: callerIp2,
        userAgent: req.headers['user-agent'] || null,
        traceId,
      }).catch((dbErr: any) => logger.warn('[PublicAuth] authEvents otp_verify insert failed', { error: dbErr?.message }));
      return res.status(400).json({
        ok: false,
        error: result.message,
        traceId
      });
    }

    return res.status(200).json({
      ok: true,
      message: result.message,
      verified: true,
      verificationToken: result.verificationToken,
      traceId
    });
  } catch (err) {
    const traceId = (req as any).traceId || crypto.randomUUID();
    logger.error('[PublicAuth] Error verifying phone code:', err);
    return res.status(500).json({
      ok: false,
      error: 'Server error',
      traceId
    });
  }
});

/**
 * Check if Twilio SMS is configured
 * GET /api/auth/phone/status
 */
publicAuthRouter.get("/api/auth/phone/status", (req, res) => {
  return res.status(200).json({
    ok: true,
    configured: twilioSMSService.isReady()
  });
});

/**
 * Create phone session after verification
 * POST /api/auth/phone-session
/**
 * 18+ gate for NEW account creation. A signup must supply a valid date of birth
 * (YYYY-MM-DD) and be at least 18. Applied only when creating a brand-new user —
 * returning users signing in are unaffected. Israel: pet-care platform is adults-only.
 */
function checkSignupAge(dob: unknown): { ok: boolean; error?: string; iso?: string } {
  if (typeof dob !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
    return { ok: false, error: 'Date of birth is required to create an account.' };
  }
  const d = new Date(dob + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return { ok: false, error: 'Invalid date of birth.' };
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  if (age > 120 || age < 0) return { ok: false, error: 'Invalid date of birth.' };
  if (age < 18) return { ok: false, error: 'You must be at least 18 years old to create an account.' };
  return { ok: true, iso: dob };
}

/** Best-effort persist DOB to the Postgres users row (never blocks signup). */
async function persistDob(uid: string, isoDob: string): Promise<void> {
  try {
    await pool.query(`UPDATE users SET date_of_birth = $1 WHERE id = $2`, [isoDob, uid]);
  } catch (e: any) {
    logger.warn('[Signup] DOB persist skipped (non-blocking)', { error: e?.message });
  }
}

/**
 * Best-effort store the signup email as contact-on-file (NOT a verified credential
 * — a later step verifies it by code). Validated shape only; never blocks signup.
 */
async function persistSignupEmail(uid: string, email: unknown): Promise<void> {
  // Linear, non-backtracking email shape ([^\s@] can't match '@', removing the
  // ambiguity that made \S+@\S+\.\S+ polynomial-ReDoS-prone). Length-capped too.
  if (typeof email !== 'string' || email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
  try {
    await pool.query(`UPDATE users SET email = $1 WHERE id = $2 AND (email IS NULL OR email = '')`, [email.toLowerCase(), uid]);
  } catch (e: any) {
    logger.warn('[Signup] signup-email persist skipped (non-blocking)', { error: e?.message });
  }
}

/**
 * POST /api/auth/verify-signup-email — step 2 of dual-verify.
 * The user already signed in via phone OTP; this proves they also own the email
 * (via the 6-digit email code) and marks it verified on THEIR account. Auth is the
 * just-issued Firebase idToken; the email is proven by the email-verified token.
 */
publicAuthRouter.post("/api/auth/verify-signup-email", apiLimiter, async (req, res) => {
  try {
    const { idToken, sessionToken, password, twoFactorEnabled } = req.body || {};
    if (!idToken || !sessionToken) {
      return res.status(400).json({ ok: false, error: 'idToken and sessionToken are required' });
    }
    let uid: string;
    try {
      const decoded = await fbAdminAuth.verifyIdToken(idToken, true);
      uid = decoded.uid;
    } catch {
      return res.status(401).json({ ok: false, error: 'Invalid session — please sign in again.' });
    }
    const check = validateEmailVerifiedToken(sessionToken);
    if (!check.valid || !check.email) {
      return res.status(401).json({ ok: false, error: 'Email verification expired — request a new code.' });
    }
    const email = check.email.toLowerCase();
    try {
      await fbAdminAuth.updateUser(uid, { email, emailVerified: true });
    } catch (e: any) {
      if (e?.code === 'auth/email-already-exists') {
        return res.status(409).json({ ok: false, error: 'This email is already linked to another account.', code: 'EMAIL_IN_USE' });
      }
      logger.warn('[Signup] verify-signup-email updateUser failed', { error: e?.message });
      return res.status(500).json({ ok: false, error: 'Could not verify email — please try again.' });
    }
    // Set the password the member chose at join (CEO 2026-07-31) so they can log in
    // with email + password. Kept SEPARATE from the email-link update so a weak/bad
    // password never blocks email verification (the critical step). Firebase's floor
    // is 6 chars; we require the same 8 the client enforces. Plaintext is handed
    // straight to Firebase Admin and never stored in our DB.
    if (typeof password === 'string' && password.length >= 8) {
      try {
        await fbAdminAuth.updateUser(uid, { password });
      } catch (e: any) {
        logger.warn('[Signup] verify-signup-email set-password failed (non-blocking)', { error: e?.message });
      }
    }
    // Persist the member's 2-step-login CHOICE (CEO 2026-07-31 "one-way or two-way
    // verification"). Only when explicitly provided; the column defaults false, so
    // opting out — or an older client that doesn't send it — is a safe no-op.
    if (typeof twoFactorEnabled === 'boolean') {
      try {
        await pool.query(`UPDATE users SET two_factor_enabled = $1 WHERE id = $2`, [twoFactorEnabled, uid]);
      } catch (e: any) {
        logger.warn('[Signup] verify-signup-email set-2fa-pref failed (non-blocking)', { error: e?.message });
      }
    }
    // Best-effort DB flag (email_verified column may not exist → harmless skip).
    try {
      await pool.query(`UPDATE users SET email = $1, email_verified = true WHERE id = $2`, [email, uid]);
    } catch (e: any) {
      try { await pool.query(`UPDATE users SET email = $1 WHERE id = $2`, [email, uid]); } catch { /* ignore */ }
    }
    // Also advance ACTIVATION (2026-07-24 audit fix): the raw UPDATE above set
    // only the boolean, not emailVerifiedAt, so a phone-then-email dual-verified
    // user never reached activationStatus='active' and stayed blocked from
    // wallet/booking by requireActive. markEmailVerified sets the timestamp and,
    // with the mobile timestamp from phone-session, flips the account to active.
    try {
      const { markEmailVerified } = await import('../services/ActivationService');
      await markEmailVerified(uid, { acceptTerms: true });
    } catch (vErr: any) {
      logger.warn('[Signup] verify-signup-email activation advance failed (non-blocking)', { error: vErr?.message });
    }
    return res.json({ ok: true });
  } catch (e: any) {
    logger.error('[Signup] verify-signup-email error', { error: e?.message });
    return res.status(500).json({ ok: false, error: 'Email verification failed.' });
  }
});

/**
 * POST /api/auth/verify-signup-mobile — step 2 of dual-verify for signups that START
 * with email / Google / Apple (which give us the email but NOT a phone). The user is
 * already signed in; this proves they also own the phone (6-digit SMS code) and
 * ATTACHES it to THEIR account — it never creates a second account. Mirror of
 * verify-signup-email. (CEO 2026-08-08: a new account confirms BOTH contacts.)
 */
publicAuthRouter.post("/api/auth/verify-signup-mobile", apiLimiter, async (req, res) => {
  try {
    const { idToken, verificationToken } = req.body || {};
    if (!idToken || !verificationToken) {
      return res.status(400).json({ ok: false, error: 'idToken and verificationToken are required' });
    }
    let uid: string;
    try {
      const decoded = await fbAdminAuth.verifyIdToken(idToken, true);
      uid = decoded.uid;
    } catch {
      return res.status(401).json({ ok: false, error: 'Invalid session — please sign in again.' });
    }
    // Prove phone ownership from the SMS-verified token, then consume it single-use
    // (same guards as phone-session) so it cannot be replayed.
    const tokenValidation = twilioSMSService.validateVerificationToken(verificationToken);
    if (!tokenValidation.valid || !tokenValidation.phone) {
      return res.status(401).json({ ok: false, error: 'Mobile verification expired — request a new code.' });
    }
    if (!twilioSMSService.consumeVerificationNonce(tokenValidation.nonce || '')) {
      return res.status(401).json({ ok: false, error: 'This verification was already used — request a new code.' });
    }
    const verifiedPhone = tokenValidation.phone;
    // Attach the phone to THIS Firebase account (no second account is created).
    try {
      await fbAdminAuth.updateUser(uid, { phoneNumber: verifiedPhone });
    } catch (e: any) {
      if (e?.code === 'auth/phone-number-already-exists') {
        return res.status(409).json({ ok: false, error: 'This mobile number is already linked to another account.', code: 'PHONE_IN_USE' });
      }
      logger.warn('[Signup] verify-signup-mobile updateUser failed', { error: e?.message });
      return res.status(500).json({ ok: false, error: 'Could not verify mobile — please try again.' });
    }
    // Best-effort DB flag (phone is UNIQUE → a collision falls back harmlessly).
    try {
      await pool.query(`UPDATE users SET phone = $1, phone_verified = true WHERE id = $2`, [verifiedPhone, uid]);
    } catch {
      try { await pool.query(`UPDATE users SET phone_verified = true WHERE id = $1`, [uid]); } catch { /* ignore */ }
    }
    // Advance ACTIVATION: markMobileVerified sets mobileVerifiedAt + phoneVerified +
    // activationStatus together (verification-drift fix) so a social-then-mobile
    // dual-verified user reaches 'active'.
    try {
      const { markMobileVerified } = await import('../services/ActivationService');
      await markMobileVerified(uid);
    } catch (vErr: any) {
      logger.warn('[Signup] verify-signup-mobile activation advance failed (non-blocking)', { error: vErr?.message });
    }
    return res.json({ ok: true });
  } catch (e: any) {
    logger.error('[Signup] verify-signup-mobile error', { error: e?.message });
    return res.status(500).json({ ok: false, error: 'Mobile verification failed.' });
  }
});

// ── 2-STEP LOGIN (CEO 2026-07-31 "one-way or two-way verification") ───────────
// A member who opted into 2-step login (users.two_factor_enabled = true) must,
// after a correct email+password, also enter a one-time SMS code before a session
// is granted. Default is OFF, so these endpoints and the session gate are a NO-OP
// for everyone who didn't opt in — zero effect on existing logins.
function maskPhoneForHint(p: string): string {
  const d = String(p || '').replace(/\D/g, '');
  if (d.length < 4) return '•••';
  return '••• ••• ' + d.slice(-4);
}

/**
 * POST /api/auth/login/2fa/start — send a login OTP to the authed user's phone.
 * Called AFTER a password sign-in. Auth = the just-issued password idToken; the
 * phone is read from the account (the client never sees or sends it). Returns
 * { needed:false } when the account did NOT opt in (client proceeds straight to
 * /api/auth/session) — fail-open so a non-2FA user is never blocked.
 */
publicAuthRouter.post("/api/auth/login/2fa/start", apiLimiter, async (req, res) => {
  try {
    const { idToken, language } = req.body || {};
    if (!idToken) return res.status(400).json({ ok: false, error: 'idToken is required' });
    let uid: string;
    try { uid = (await fbAdminAuth.verifyIdToken(idToken, true)).uid; }
    catch { return res.status(401).json({ ok: false, error: 'Invalid session — please sign in again.' }); }
    const { rows } = await pool.query('SELECT phone, two_factor_enabled FROM users WHERE id = $1', [uid]);
    const row = rows[0];
    if (!row || row.two_factor_enabled !== true) return res.json({ ok: true, needed: false });
    const phone: string | null = row.phone;
    // Opted in but no phone on file → cannot challenge; fail open to password-only
    // rather than lock them out (they can add/verify a phone later).
    if (!phone) return res.json({ ok: true, needed: false, reason: 'no_phone' });
    const send = await twilioSMSService.sendVerificationCode(phone, language || 'he', req.ip);
    if (!send?.success) return res.status(502).json({ ok: false, error: send?.message || 'Could not send the code — try again.' });
    return res.json({ ok: true, needed: true, phoneHint: maskPhoneForHint(phone) });
  } catch (e: any) {
    logger.error('[Login2FA] start error', { error: e?.message });
    return res.status(500).json({ ok: false, error: 'Could not start verification.' });
  }
});

/**
 * POST /api/auth/login/2fa/verify — verify the login OTP, mint a short-lived MFA
 * proof token bound to the uid. /api/auth/session then accepts that proof to mint
 * the session for a 2-step-login account. Auth = the password idToken.
 */
publicAuthRouter.post("/api/auth/login/2fa/verify", apiLimiter, async (req, res) => {
  try {
    const { idToken, code, language } = req.body || {};
    if (!idToken || !code) return res.status(400).json({ ok: false, error: 'idToken and code are required' });
    let uid: string;
    try { uid = (await fbAdminAuth.verifyIdToken(idToken, true)).uid; }
    catch { return res.status(401).json({ ok: false, error: 'Invalid session — please sign in again.' }); }
    const { rows } = await pool.query('SELECT phone FROM users WHERE id = $1', [uid]);
    const phone: string | null = rows[0]?.phone;
    if (!phone) return res.status(400).json({ ok: false, error: 'No phone on file for verification.' });
    const chk = await twilioSMSService.verifyCode(phone, String(code), language || 'he');
    if (!chk?.success) return res.status(401).json({ ok: false, error: chk?.message || 'Invalid code' });
    return res.json({ ok: true, mfaToken: mintMfaLoginToken(uid) });
  } catch (e: any) {
    logger.error('[Login2FA] verify error', { error: e?.message });
    return res.status(500).json({ ok: false, error: 'Verification failed.' });
  }
});

/**
 * POST /api/auth/phone-session
 * REQUIRES: verificationToken from successful /verify-code response
 */
publicAuthRouter.post("/api/auth/phone-session", async (req, res) => {
  try {
    const { verificationToken } = req.body;
    
    if (!verificationToken) {
      return res.status(400).json({
        ok: false,
        error: 'Verification token is required'
      });
    }

    const tokenValidation = twilioSMSService.validateVerificationToken(verificationToken);

    if (!tokenValidation.valid || !tokenValidation.phone) {
      logger.warn('[PhoneAuth] Invalid or expired verification token attempted');
      return res.status(401).json({
        ok: false,
        error: 'Invalid or expired verification token. Please verify your phone again.'
      });
    }

    // SECURITY (single-use, sweep 2026-07-13): consume the proof token so it can't be
    // replayed within its 5-min TTL to mint additional sessions. First use wins; a
    // replay of the same token is rejected here at the session-minting step.
    if (!twilioSMSService.consumeVerificationNonce(tokenValidation.nonce || '')) {
      logger.warn('[PhoneAuth] verification token REPLAY rejected at phone-session');
      return res.status(401).json({
        ok: false,
        error: 'This verification was already used. Please verify your phone again.'
      });
    }

    const formattedPhone = tokenValidation.phone;

    const adminAuth = fbAdminAuth;

    let user;
    let isNewUser = false;
    try {
      user = await adminAuth.getUserByPhoneNumber(formattedPhone);
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        isNewUser = true;
        // DUPLICATE GUARD (CEO 2026-08-08): mobile signup now collects an email. If that
        // email ALREADY belongs to an account (email/Google/Apple), creating a new phone
        // account here would SPLIT the person in two — their wallet/history live on the
        // other account. Refuse and route them to sign in, then attach the phone via
        // /api/auth/verify-signup-mobile. (Was Finding 2 of the mobile-auth audit.)
        const providedEmail = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
        if (providedEmail) {
          try {
            const existing = await adminAuth.getUserByEmail(providedEmail);
            if (existing) {
              return res.status(409).json({
                ok: false,
                code: 'EMAIL_HAS_ACCOUNT',
                error: 'This email already has a PetWash account. Please sign in, then add your mobile number.',
              });
            }
          } catch {
            // auth/user-not-found → the email is free; fall through and create the account.
          }
        }
        // 18+ gate — new accounts only.
        const ageCheck = checkSignupAge(req.body?.dateOfBirth);
        if (!ageCheck.ok) {
          return res.status(403).json({ ok: false, error: ageCheck.error, code: 'AGE_REQUIREMENT' });
        }
        user = await adminAuth.createUser({
          phoneNumber: formattedPhone,
          displayName: `User ${formattedPhone.slice(-4)}`,
        });
        // NOTE: DOB is persisted AFTER the users row is created below — the old
        // persistDob() here ran an UPDATE before any users row existed (0 rows
        // touched) and upsertUser didn't carry dateOfBirth, so the birthday the
        // member typed was silently dropped and they were re-asked at
        // /complete-profile. (2026-07-31 audit fix)
        // Collect the email provided at signup (step 1). It is NOT yet verified —
        // a follow-up step verifies it by code; we store it as contact-on-file.
        await persistSignupEmail(user.uid, req.body?.email);
        logger.info('[PhoneAuth] Created new user for phone:', formattedPhone.slice(0, 6) + '****');

        try {
          const { logNewUserRegistration } = await import('../services/bookingEventLogger');
          logNewUserRegistration({
            userId: user.uid,
            firstName: `User`,
            lastName: formattedPhone.slice(-4),
            email: user.email || '',
            phone: formattedPhone,
            country: 'IL',
            registrationSource: 'phone_auth',
            language: 'he',
          }).catch(() => {});
        } catch (logErr) {
          logger.warn('[PhoneAuth] Registration logging failed (non-blocking)', logErr);
        }

        // ── Wallet auto-create (new phone users) ──────────────────────────
        // Phone-auth flow did not previously create a PostgreSQL wallet.
        // Without this the user has no wallet row and any wallet query crashes.
        try {
          const walletId = `WALLET-${user.uid.slice(0, 20)}`;
          await pool.query(
            `INSERT INTO wallet_accounts
               (wallet_id, user_id, cash_wallet_balance_cents, updated_at)
             VALUES ($1, $2, 0, NOW())
             ON CONFLICT (wallet_id) DO NOTHING`,
            [walletId, user.uid],
          );
          logger.info(`[PhoneAuth] Wallet auto-created uid=${user.uid}`);
        } catch (walletErr: any) {
          logger.warn('[PhoneAuth] Wallet auto-creation failed (non-blocking)', { error: walletErr.message });
        }

        // ── Loyalty profile auto-enroll (new phone users) ─────────────────
        // Same welcome-points grant as the Google signup path.
        try {
          await pool.query(
            `INSERT INTO loyalty_profiles
               (user_id, tier, tier_since, tier_progress, tier_threshold,
                points, lifetime_points, xp, level,
                total_washes, current_streak, longest_streak,
                average_wash_interval, is_vip, concierge_access, priority_support,
                preferred_stations, preferred_times, personalized_offers,
                created_at, updated_at)
             VALUES ($1, 'bronze', NOW(), 0, 1000,
                     100, 100, 0, 1,
                     0, 0, 0,
                     21, false, false, false,
                     '[]', '[]', '[]',
                     NOW(), NOW())
             ON CONFLICT (user_id) DO NOTHING`,
            [user.uid],
          );
          logger.info(`[PhoneAuth] Loyalty profile auto-enrolled uid=${user.uid}`);
        } catch (loyaltyErr: any) {
          logger.warn('[PhoneAuth] Loyalty auto-enroll failed (non-blocking)', { error: loyaltyErr.message });
        }

        // ── Users table record (new phone users) ─────────────────────────
        // Without this row the dashboard, profile page, and any query that
        // joins on users.id will fail or return null for phone-only signups.
        try {
          await storage.upsertUser({
            id: user.uid,
            email: null,
            phone: formattedPhone,
            role: 'customer',
            authProvider: 'phone',
            language: 'he',
            country: 'IL',
            userStatus: 'new',
            signupIntent: 'customer',
          } as any);
          logger.info(`[PhoneAuth] users table row created uid=${user.uid}`);
          // Persist DOB NOW that the row exists (see note at createUser above).
          await persistDob(user.uid, ageCheck.iso!);
          // PERSIST VERIFIED (2026-07-24 audit fix): the SMS OTP was just proven,
          // but nothing recorded the phone as verified — phoneVerified stayed
          // false and mobileVerifiedAt null, so the account never advanced past
          // 'draft' (blocking wallet/booking) and identity-merge distrusted it.
          try {
            const { markMobileVerified } = await import('../services/ActivationService');
            await markMobileVerified(user.uid);
          } catch (vErr: any) {
            logger.warn('[PhoneAuth] mark-mobile-verified failed (non-blocking)', { error: vErr?.message });
          }
        } catch (usersErr: any) {
          logger.warn('[PhoneAuth] users table upsert failed (non-blocking)', { error: usersErr.message });
        }
      } else {
        throw error;
      }
    }

    // Heal/provision for ALL phone sessions (new AND existing) — orphan-safe.
    // SEV-1 hard gate (2026-08-20): the users-row branch of authBootstrap
    // now throws AuthBootstrapUsersRowFailed when the row cannot be proven
    // present; we translate that to HTTP 502 { code: 'DB_UNAVAILABLE' } so
    // the client retries deterministically instead of continuing into a
    // silent-broken state (whoami 404, wallet crash, booking blocked).
    try {
      await ensureUserProvisioned(user.uid, { channel: 'phone', phone: formattedPhone, email: null });
    } catch (bootErr: any) {
      if (bootErr instanceof AuthBootstrapUsersRowFailed) {
        logger.error('[PhoneAuth] users row bootstrap HARD-FAILED — returning 502', { uid: user.uid });
        return res.status(502).json({
          ok: false,
          error: 'user_bootstrap_failed',
          code: 'DB_UNAVAILABLE',
        });
      }
      throw bootErr;
    }

    const customToken = await adminAuth.createCustomToken(user.uid, {
      phone: formattedPhone,
      authMethod: 'phone'
    });

    logger.info('[PhoneAuth] Custom token created for user:', user.uid);

    return res.status(200).json({
      ok: true,
      userId: user.uid,
      customToken,
      isNewUser,
      message: 'Phone verified. Use customToken with signInWithCustomToken, then POST /api/auth/session to set session cookie.'
    });
  } catch (err) {
    logger.error('[PublicAuth] Error creating phone session:', err);
    return res.status(500).json({
      ok: false,
      error: 'Server error'
    });
  }
});

/**
 * POST /api/auth/email-session
 * Passwordless EMAIL login — the mirror of /api/auth/phone-session.
 * REQUIRES: sessionToken from a successful /api/auth/email/verify (HMAC-signed
 * proof the 6-digit email code was matched). Never mints a session from a bare
 * { email } — the token is the only trust anchor.
 */
publicAuthRouter.post("/api/auth/email-session", apiLimiter, async (req, res) => {
  try {
    const { sessionToken } = req.body;
    const check = validateEmailVerifiedToken(sessionToken);
    if (!check.valid || !check.email) {
      logger.warn('[EmailAuth] Invalid or expired email session token', { reason: check.reason });
      return res.status(401).json({ ok: false, error: 'Invalid or expired verification. Please verify your email again.' });
    }

    const email = check.email;
    const adminAuth = fbAdminAuth;

    let user;
    try {
      user = await adminAuth.getUserByEmail(email);
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        // 18+ gate — new accounts only.
        const ageCheck = checkSignupAge(req.body?.dateOfBirth);
        if (!ageCheck.ok) {
          return res.status(403).json({ ok: false, error: ageCheck.error, code: 'AGE_REQUIREMENT' });
        }
        // Email is proven (matched code) → safe to create as a verified account.
        user = await adminAuth.createUser({ email, emailVerified: true });
        // DOB persisted AFTER the users row is created below (the UPDATE-before-INSERT
        // ordering silently dropped it — same fix as phone-session). (2026-07-31)
        logger.info('[EmailAuth] Created new user for email', { email: email.replace(/(.{2}).*(@.*)/, '$1•••$2') });

        try {
          const { logNewUserRegistration } = await import('../services/bookingEventLogger');
          logNewUserRegistration({
            userId: user.uid, firstName: 'User', lastName: '', email,
            phone: '', country: 'IL', registrationSource: 'email_code', language: 'he',
          }).catch(() => {});
        } catch (logErr) {
          logger.warn('[EmailAuth] Registration logging failed (non-blocking)', logErr);
        }

        // Wallet + loyalty + users row — same bootstrap as phone-session so the
        // dashboard/wallet queries never crash on a brand-new email account.
        try {
          const walletId = `WALLET-${user.uid.slice(0, 20)}`;
          await pool.query(
            `INSERT INTO wallet_accounts (wallet_id, user_id, cash_wallet_balance_cents, updated_at)
             VALUES ($1, $2, 0, NOW()) ON CONFLICT (wallet_id) DO NOTHING`,
            [walletId, user.uid],
          );
        } catch (walletErr: any) {
          logger.warn('[EmailAuth] Wallet auto-creation failed (non-blocking)', { error: walletErr.message });
        }
        try {
          await pool.query(
            `INSERT INTO loyalty_profiles
               (user_id, tier, tier_since, tier_progress, tier_threshold, points, lifetime_points, xp, level,
                total_washes, current_streak, longest_streak, average_wash_interval, is_vip, concierge_access,
                priority_support, preferred_stations, preferred_times, personalized_offers, created_at, updated_at)
             VALUES ($1, 'bronze', NOW(), 0, 1000, 100, 100, 0, 1, 0, 0, 0, 21, false, false, false,
                     '[]', '[]', '[]', NOW(), NOW())
             ON CONFLICT (user_id) DO NOTHING`,
            [user.uid],
          );
        } catch (loyaltyErr: any) {
          logger.warn('[EmailAuth] Loyalty auto-enroll failed (non-blocking)', { error: loyaltyErr.message });
        }
        try {
          await storage.upsertUser({
            id: user.uid, email, phone: null, role: 'customer', authProvider: 'email',
            language: 'he', country: 'IL', userStatus: 'new', signupIntent: 'customer',
          } as any);
          // Persist DOB NOW that the row exists (see note at createUser above).
          await persistDob(user.uid, ageCheck.iso!);
          // PERSIST VERIFIED (2026-07-24 audit fix): the email OTP proved this
          // address, but Postgres users.email_verified stayed false while
          // authProvider='email' — so the post-login decider bounced the user to
          // /verify-email on EVERY load, and /verify-email (Firebase magic-link)
          // couldn't clear the Postgres flag → infinite 'sent back to signup'.
          try {
            const { markEmailVerified } = await import('../services/ActivationService');
            await markEmailVerified(user.uid, { acceptTerms: true });
          } catch (vErr: any) {
            logger.warn('[EmailAuth] mark-email-verified failed (non-blocking)', { error: vErr?.message });
          }
        } catch (usersErr: any) {
          logger.warn('[EmailAuth] users table upsert failed (non-blocking)', { error: usersErr.message });
        }
      } else {
        throw error;
      }
    }

    // Heal/provision for ALL email sessions (new AND existing) — orphan-safe.
    await ensureUserProvisioned(user.uid, { channel: 'email', email, phone: null });

    const customToken = await adminAuth.createCustomToken(user.uid, { email, authMethod: 'email' });
    logger.info('[EmailAuth] Custom token created', { uid: user.uid });
    return res.status(200).json({
      ok: true,
      userId: user.uid,
      customToken,
      message: 'Email verified. Use customToken with signInWithCustomToken, then POST /api/auth/session to set session cookie.',
    });
  } catch (err) {
    logger.error('[PublicAuth] Error creating email session:', err);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
});

/**
 * POST /api/auth/email/mark-verified
 * Persist Firebase email-verification into Postgres so the post-login gate stops
 * bouncing the user. The /verify-email page (Firebase magic-link path) used to
 * only reload the Firebase user and navigate to '/', never writing Postgres
 * users.emailVerified — so authProvider='email' rows with emailVerified=false
 * re-bounced to /verify-email on EVERY load (the infinite loop). This closes it.
 * (2026-07-31)
 */
publicAuthRouter.post('/api/auth/email/mark-verified', apiLimiter, async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const sessionCookie = (req as any).cookies?.pw_session;
    if (!authHeader?.startsWith('Bearer ') && !sessionCookie) {
      return res.status(401).json({ ok: false, error: 'Not authenticated' });
    }
    const { auth: fbAdmin } = await import('../lib/firebase-admin');
    let decoded: any;
    if (authHeader?.startsWith('Bearer ')) {
      decoded = await fbAdmin.verifyIdToken(authHeader.substring(7), true);
    } else {
      decoded = await fbAdmin.verifySessionCookie(sessionCookie, true);
    }
    if (!decoded?.uid) return res.status(401).json({ ok: false, error: 'Not authenticated' });

    // Only persist if Firebase actually considers the email verified (link clicked).
    const userRecord = await fbAdmin.getUser(decoded.uid);
    if (!userRecord.emailVerified) {
      return res.status(409).json({ ok: false, error: 'Email not verified yet' });
    }
    const { markEmailVerified } = await import('../services/ActivationService');
    await markEmailVerified(decoded.uid, { acceptTerms: true });
    logger.info('[EmailAuth] Postgres email-verified persisted via /verify-email', { uid: decoded.uid });
    return res.json({ ok: true });
  } catch (e: any) {
    logger.error('[EmailAuth] mark-verified failed', { error: e?.message });
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
});

/**
 * Record user consent (Terms, Privacy, etc.) with full audit trail
 * POST /api/consents
 */
publicAuthRouter.post("/api/consents", apiLimiter, async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ ok: false, error: 'Authentication required' });
    }
    const token = authHeader.split('Bearer ')[1];
    const { getAuth } = await import('firebase-admin/auth');
    const decodedToken = await getAuth().verifyIdToken(token, true);
    const userId = decodedToken.uid;

    const traceId = req.headers['x-trace-id'] as string || crypto.randomUUID();
    const { consents } = req.body;

    if (!consents || !Array.isArray(consents) || consents.length === 0) {
      return res.status(400).json({ ok: false, error: 'consents[] array is required' });
    }

    const ip = req.ip || req.headers['x-forwarded-for'] as string || 'unknown';
    const userAgent = req.headers['user-agent'] || null;
    const locale = req.headers['accept-language'] || null;
    const source = (req.body.source || 'web') as string;

    const insertedIds: number[] = [];

    for (const consent of consents) {
      const { consentType, consentVersion, consentTextHash, accepted } = consent;
      if (!consentType || !consentVersion || !consentTextHash) {
        return res.status(400).json({
          ok: false,
          error: `Each consent needs consentType, consentVersion, consentTextHash`,
          traceId
        });
      }

      const result = await db.execute(sql`
        INSERT INTO user_consents (user_id, consent_type, consent_version, consent_text_hash, accepted, ip, user_agent, locale, source, trace_id)
        VALUES (${userId}, ${consentType}, ${consentVersion}, ${consentTextHash}, ${accepted !== false}, ${ip}, ${userAgent}, ${locale}, ${source}, ${traceId})
        RETURNING id
      `);
      insertedIds.push((result.rows[0] as any).id);
    }

    logger.info('[Consent] Recorded', { traceId, userId, count: consents.length, ids: insertedIds });

    return res.json({ ok: true, traceId, consentIds: insertedIds });
  } catch (err: any) {
    if (err.code === 'auth/id-token-expired' || err.code === 'auth/argument-error') {
      return res.status(401).json({ ok: false, error: 'Invalid or expired token' });
    }
    logger.error('[Consent] Error recording consent:', err);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
});

/**
 * Get consent status for a user
 * GET /api/consents/status?userId=xxx
 */
publicAuthRouter.get("/api/consents/status", apiLimiter, async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ ok: false, error: 'Authentication required' });
    }
    const token = authHeader.split('Bearer ')[1];
    const { getAuth } = await import('firebase-admin/auth');
    const decodedToken = await getAuth().verifyIdToken(token, true);
    const userId = decodedToken.uid;

    const result = await db.execute(sql`
      SELECT consent_type, consent_version, accepted, accepted_at
      FROM user_consents
      WHERE user_id = ${userId}
      ORDER BY accepted_at DESC
    `);

    const latestByType: Record<string, any> = {};
    for (const row of result.rows as any[]) {
      if (!latestByType[row.consent_type]) {
        latestByType[row.consent_type] = row;
      }
    }

    return res.json({
      ok: true,
      consents: latestByType,
      hasTerms: !!latestByType['terms']?.accepted,
      hasPrivacy: !!latestByType['privacy']?.accepted,
    });
  } catch (err) {
    logger.error('[Consent] Error fetching status:', err);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// ===== ACCESSIBILITY ROUTES (WCAG 2.1 AA - Israeli Standard 5568) =====

const accessibilityFeedbackSchema = z.object({
  email: z.string().email().optional().or(z.literal("")),
  message: z.string().min(5).max(4000),
  pageUrl: z.string().max(2048).optional().or(z.literal("")),
});

const accessibilityAuditSchema = z.object({
  action: z.string().min(2).max(128),
  component: z.string().max(256).optional(),
  details: z.any().optional(),
});

publicAuthRouter.get("/api/accessibility-statement", async (_req, res) => {
  res.json({
    complianceLevel: "WCAG 2.1 AA",
    standardIsrael: "Israeli Standard 5568 (based on WCAG)",
    lastAuditDate: "2026-02-19",
    knownLimitations: [
      "Some third-party embedded content may have partial accessibility support.",
      "We are continuously improving form flows for keyboard and screen readers."
    ],
    contact: {
      title: "Accessibility Coordinator",
      email: "accessibility@petwash.co.il",
      phone: "+972-3-000-0000",
      responseTime: "Up to 3 business days"
    }
  });
});

publicAuthRouter.post("/api/accessibility-feedback", async (req, res) => {
  const parsed = accessibilityFeedbackSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "INVALID_INPUT", details: parsed.error.flatten() });
  }

  const { email, message, pageUrl } = parsed.data;
  const ip = req.ip || (req.headers['x-forwarded-for'] as string) || 'unknown';
  const userAgent = String(req.headers['user-agent'] || '').slice(0, 512) || null;

  try {
    await db.execute(sql`
      INSERT INTO accessibility_feedback(email, message, page_url, user_agent, ip_address)
      VALUES (${(email || '').trim() || null}, ${message.trim()}, ${(pageUrl || '').trim() || null}, ${userAgent}, ${ip})
    `);
    res.json({ success: true });
  } catch (err) {
    logger.error('[Accessibility] Feedback save error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

publicAuthRouter.post("/api/accessibility-audit", async (req, res) => {
  const parsed = accessibilityAuditSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "INVALID_INPUT", details: parsed.error.flatten() });
  }

  const { action, component, details } = parsed.data;
  const ip = req.ip || (req.headers['x-forwarded-for'] as string) || 'unknown';
  const userAgent = String(req.headers['user-agent'] || '').slice(0, 512) || null;

  try {
    await db.execute(sql`
      INSERT INTO accessibility_audit_log(action, component, details, user_agent, ip_address)
      VALUES (${action}, ${component || null}, ${details ? JSON.stringify(details) : null}, ${userAgent}, ${ip})
    `);
    res.json({ success: true });
  } catch (err) {
    logger.error('[Accessibility] Audit log error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── Phone OTP Verification (3-Class Membership System) ────────────────
import { registrationOTPService } from '../services/RegistrationOTPService';
import { assignCustomerMembership } from '../services/MembershipService';
import { renderWelcomeSMS, getTemplateId } from '../sms/templates/welcome-sms-templates';

const otpSendSchema = z.object({
  phone: z.string().min(8).max(20),
  userTypeIntent: z.enum(['PUBLIC', 'PROVIDER', 'STAFF_REQUEST']).default('PUBLIC'),
  channel: z.enum(['sms', 'whatsapp']).default('sms'),
  captchaToken: z.string().optional(),
});

const otpResendSchema = z.object({
  otpId: z.string().uuid(),
  channel: z.enum(['sms', 'whatsapp']).default('whatsapp'),
});

const otpVerifySchema = z.object({
  otpId: z.string().uuid(),
  code: z.string().length(6),
});

function verificationActorForPublicAuth(req: express.Request) {
  return {
    userId: (req as any).user?.uid || (req as any).firebaseUser?.uid,
    ip: req.ip || req.headers['x-forwarded-for']?.toString(),
    userAgent: req.headers['user-agent'],
    traceId: (req as any).traceId,
  };
}

function unifiedSignupErrorStatus(error: UnifiedVerificationError): number {
  if (error.reasonCode === 'INVALID_CODE') return 400;
  if (error.reasonCode === 'CHALLENGE_LOCKED') return 429;
  if (error.reasonCode === 'CHALLENGE_EXPIRED') return 410;
  if (error.reasonCode === 'CHALLENGE_COOLDOWN') return 429;
  if (error.reasonCode === 'SMS_PROVIDER_ERROR') return 503;
  return error.statusCode;
}

// Attach the same per-IP send limiter the legacy /send-code path uses
// (3 SMS sends per IP per 10 min, IPv6-mapped IPv4 normalised). Without
// this, the newer /otp/send endpoint was reachable directly with no
// HTTP-layer rate limit — only the in-service per-phone hourly cap
// gated abuse, which an attacker rotates around with fresh numbers.
// Retired: RegistrationOTPService phone stack. PR-AUTH-OTP-8 mapped this to
// have ZERO client callers in client/src — SignUpLuxury moved to
// /api/auth/sms/{start,verify} months ago and no other page hits these paths.
// The handler is short-circuited to 410 Gone so any stray caller (mobile app
// build behind, staging test) sees a loud failure and switches to the
// canonical surface. Full handler body preserved below the return for a
// safe rollback if a hidden production caller surfaces.
publicAuthRouter.post('/api/auth/phone/otp/send', phoneSendRateLimiter, async (req, res) => {
  return res.status(410).json({
    error: 'ENDPOINT_RETIRED',
    message: 'Use /api/auth/sms/start (canonical customer SMS surface).',
  });
  // eslint-disable-next-line no-unreachable
  try {
    const parsed = otpSendSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Invalid phone number or intent', details: parsed.error.flatten() });
    }

    const { phone, userTypeIntent, channel, captchaToken } = parsed.data;
    const language = (req.headers['accept-language']?.includes('he') ? 'he' : 'en') as 'he' | 'en';

    if (!captchaToken) {
      // Non-blocking: phone OTP itself is the authentication factor.
      // Security is enforced by rate limiting + phone lockout + daily SMS cap.
      // Hard-blocking on missing captcha permanently locks out users when
      // reCAPTCHA credentials are not configured in production.
      logger.warn('[PublicAuth] OTP send — no captchaToken (reCAPTCHA unavailable), proceeding with rate-limit protection', { phone: phone.slice(-4) });
    } else {
      const captchaResult = await verifyCaptchaToken(captchaToken, 'phone_otp');
      if (!captchaResult.valid) {
        logger.warn('[PublicAuth] OTP send blocked by reCAPTCHA', { phone: phone.slice(-4), reason: captchaResult.reason });
        return res.status(403).json({ error: 'CAPTCHA_FAILED', message: language === 'he' ? 'אימות אבטחה נכשל' : 'Security check failed. Please refresh and try again.' });
      }
    }

    const result = isUnifiedVerificationSignupEnabled()
      ? await unifiedVerificationService.startChallenge({
          purpose: 'signup',
          channel,
          destination: phone,
          payload: { userTypeIntent, language },
          actor: verificationActorForPublicAuth(req),
        }).then((unifiedResult) => ({
          success: true,
          otpId: unifiedResult.challenge.challengeId,
          expiresIn: 300,
          channel: unifiedResult.challenge.channel as 'sms' | 'whatsapp',
        }))
      : await registrationOTPService.sendOTP(phone, userTypeIntent, {
          ip: req.ip || req.headers['x-forwarded-for']?.toString(),
          userAgent: req.headers['user-agent'],
          traceId: (req as any).traceId,
          language,
          channel,
        });

    if (!result.success) {
      const errorMessages: Record<string, { en: string; he: string; status: number }> = {
        'COOLDOWN_ACTIVE': { en: 'Please wait before requesting a new code', he: 'אנא המתינו לפני שליחת קוד חדש', status: 429 },
        'PHONE_RATE_LIMIT': { en: 'Too many attempts for this phone, try again later', he: 'יותר מדי ניסיונות לטלפון זה, נסו שוב מאוחר יותר', status: 429 },
        'IP_RATE_LIMIT': { en: 'Too many attempts, try again later', he: 'יותר מדי ניסיונות, נסו שוב מאוחר יותר', status: 429 },
        'INTERNAL_ERROR': { en: 'Failed to send verification code', he: 'שליחת קוד האימות נכשלה', status: 500 },
      };
      const errInfo = errorMessages[result.error || ''] || errorMessages['INTERNAL_ERROR'];
      return res.status(errInfo.status).json({
        error: result.error,
        cooldownRemaining: result.cooldownRemaining,
        message: language === 'he' ? errInfo.he : errInfo.en,
      });
    }

    res.json({
      success: true,
      otpId: result.otpId,
      expiresIn: result.expiresIn,
      channel: result.channel,
      message: language === 'he'
        ? (channel === 'whatsapp' ? 'קוד אימות נשלח בוואטסאפ' : 'קוד אימות נשלח ב-SMS')
        : (channel === 'whatsapp' ? 'Verification code sent via WhatsApp' : 'Verification code sent via SMS'),
    });
  } catch (err) {
    if (err instanceof UnifiedVerificationError) {
      const language = (req.headers['accept-language']?.includes('he') ? 'he' : 'en') as 'he' | 'en';
      return res.status(unifiedSignupErrorStatus(err)).json({
        error: err.reasonCode,
        message: language === 'he' ? 'שליחת קוד האימות נכשלה' : err.message,
      });
    }
    logger.error('[PublicAuth] Phone send-code error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to send verification code' });
  }
});

// Same per-IP send limiter as /otp/send. Resend was previously gated only
// by a 60-second in-service cooldown — combined with no per-IP HTTP cap,
// a single client could sustain ~1 SMS/min/otpId indefinitely. The
// service layer now also enforces the per-phone hourly cap on resend
// (see RegistrationOTPService.resendOTP below).
publicAuthRouter.post('/api/auth/phone/otp/resend', phoneSendRateLimiter, async (req, res) => {
  return res.status(410).json({
    error: 'ENDPOINT_RETIRED',
    message: 'Use /api/auth/sms/start (canonical customer SMS surface).',
  });
  // eslint-disable-next-line no-unreachable
  try {
    const parsed = otpResendSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Invalid request' });
    }

    const { otpId, channel } = parsed.data;
    const language = (req.headers['accept-language']?.includes('he') ? 'he' : 'en') as 'he' | 'en';

    const result = isUnifiedVerificationSignupEnabled()
      ? await unifiedVerificationService.resendChallenge({
          challengeId: otpId,
          channel,
          actor: verificationActorForPublicAuth(req),
        }).then((unifiedResult) => ({
          success: true,
          otpId: unifiedResult.challenge.challengeId,
          expiresIn: Math.max(0, Math.ceil((new Date(unifiedResult.challenge.expiresAt).getTime() - Date.now()) / 1000)),
          channel: unifiedResult.challenge.channel as 'sms' | 'whatsapp',
        }))
      : await registrationOTPService.resendOTP(otpId, channel, {
          ip: req.ip || req.headers['x-forwarded-for']?.toString(),
          userAgent: req.headers['user-agent'],
          traceId: (req as any).traceId,
          language,
        });

    if (!result.success) {
      const statusCode = result.error === 'OTP_EXPIRED' ? 410 : 429;
      return res.status(statusCode).json({
        error: result.error,
        cooldownRemaining: result.cooldownRemaining,
        message: result.error === 'OTP_EXPIRED'
          ? (language === 'he' ? 'הקוד פג תוקף, בקשו קוד חדש' : 'Code expired, please request a new one')
          : (language === 'he' ? 'אנא המתינו לפני שליחת קוד חדש' : 'Please wait before requesting a new code'),
      });
    }

    res.json({
      success: true,
      otpId: result.otpId,
      expiresIn: result.expiresIn,
      channel: result.channel,
      message: language === 'he'
        ? (channel === 'whatsapp' ? 'קוד חדש נשלח בוואטסאפ' : 'קוד חדש נשלח ב-SMS')
        : (channel === 'whatsapp' ? 'New code sent via WhatsApp' : 'New code sent via SMS'),
    });
  } catch (err) {
    if (err instanceof UnifiedVerificationError) {
      const language = (req.headers['accept-language']?.includes('he') ? 'he' : 'en') as 'he' | 'en';
      return res.status(unifiedSignupErrorStatus(err)).json({
        error: err.reasonCode,
        message: err.reasonCode === 'CHALLENGE_EXPIRED'
          ? (language === 'he' ? 'הקוד פג תוקף, בקשו קוד חדש' : 'Code expired, please request a new one')
          : (language === 'he' ? 'אנא המתינו לפני שליחת קוד חדש' : err.message),
      });
    }
    logger.error('[PublicAuth] Phone resend-code error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to resend verification code' });
  }
});

// Same per-IP verify limiter the legacy /verify-code path uses (5 verifies
// per IP per 5 min). The per-otpId attempt counter (max 5 + 15-min lockout)
// remains the primary brute-force defence; this adds defence-in-depth.
publicAuthRouter.post('/api/auth/phone/otp/verify', phoneVerifyRateLimiter, async (req, res) => {
  return res.status(410).json({
    error: 'ENDPOINT_RETIRED',
    message: 'Use /api/auth/sms/verify (canonical customer SMS surface).',
  });
  // eslint-disable-next-line no-unreachable
  try {
    const parsed = otpVerifySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Invalid OTP ID or code' });
    }

    const { otpId, code } = parsed.data;
    const language = (req.headers['accept-language']?.includes('he') ? 'he' : 'en') as 'he' | 'en';

    const result = isUnifiedVerificationSignupEnabled()
      ? await unifiedVerificationService.verifyChallenge({
          challengeId: otpId,
          code,
          actor: verificationActorForPublicAuth(req),
        }).then((unifiedResult) => ({
          success: true,
          otpId,
          metadata: (unifiedResult.action.metadata as any) || undefined,
        }))
      : await registrationOTPService.verifyOTP(otpId, code, {
          ip: req.ip || req.headers['x-forwarded-for']?.toString(),
          userAgent: req.headers['user-agent'],
          traceId: (req as any).traceId,
        });

    if (!result.success) {
      const statusCode = result.error === 'MAX_ATTEMPTS_EXCEEDED' ? 429 : 400;
      return res.status(statusCode).json({
        error: result.error,
        remainingAttempts: result.remainingAttempts,
        message: result.error === 'INVALID_CODE'
          ? (language === 'he' ? 'קוד שגוי, נסו שוב' : 'Invalid code, please try again')
          : result.error === 'OTP_EXPIRED'
          ? (language === 'he' ? 'הקוד פג תוקף, בקשו קוד חדש' : 'Code expired, please request a new one')
          : (language === 'he' ? 'חריגה ממספר הניסיונות' : 'Too many failed attempts'),
      });
    }

    const metadata = result.metadata;
    let membershipId: string | null = null;
    let isNewUser = false;

    if (metadata) {
      const firebaseUser = await getFirebaseUserFromRequest(req);
      if (firebaseUser) {
        // ── Step 1: Ensure the users row exists before any membership logic ──
        // New mobile users (phone-only signup) have no users row yet — upsert it
        // so that the membership UPDATE below actually finds a row.
        try {
          const [existing] = await db
            .select({ id: users.id, membershipNumber: users.membershipNumber })
            .from(users)
            .where(eq(users.id, firebaseUser.uid))
            .limit(1);

          if (!existing) {
            isNewUser = true;
            await storage.upsertUser({
              id: firebaseUser.uid,
              email: firebaseUser.email || null,
              phoneE164: metadata.phoneE164 !== 'N/A' ? metadata.phoneE164 : null,
              phoneVerified: true,
              authProvider: 'phone',
              role: 'customer',
              signupIntent: metadata.userTypeIntent === 'PROVIDER' ? 'provider' : metadata.userTypeIntent === 'STAFF_REQUEST' ? 'staff_request' : 'customer',
            } as any);
            logger.info('[PublicAuth] New mobile user row created', { uid: firebaseUser.uid, phone: metadata.phoneE164?.slice(0, 6) + '****' });
          } else {
            // Existing user — stamp phone_e164 if changed (phone_verified is set by
            // markMobileVerified below, which also sets the timestamp + status).
            if (metadata.phoneE164 !== 'N/A') {
              await db.update(users).set({ phoneE164: metadata.phoneE164 }).where(eq(users.id, firebaseUser.uid));
            }
          }
          // CRITICAL FIX (verification-drift): record the verification in the columns
          // the ACTIVATION gate reads — mobile_verified_at + activation_status — not
          // just the phone_verified boolean. Writing the boolean alone left
          // mobile_verified_at null → getActivationState().isFullyActive=false → 403
          // ACCOUNT_NOT_ACTIVATED on wallet/K9000/bookings, even though the user just
          // verified their phone. markMobileVerified sets boolean+timestamp+status
          // together (idempotent) and triggers full activation (wallet + loyalty).
          try {
            const { markMobileVerified } = await import('../services/ActivationService');
            await markMobileVerified(firebaseUser.uid);
          } catch (actErr) {
            logger.error('[PublicAuth] markMobileVerified failed on OTP verify (non-blocking)', actErr);
          }
        } catch (upsertErr) {
          logger.error('[PublicAuth] User upsert on OTP verify failed (non-blocking)', upsertErr);
        }

        // ── Step 2: Assign membership (now the row is guaranteed to exist) ──
        if (metadata.userTypeIntent === 'PUBLIC') {
          membershipId = await assignCustomerMembership(firebaseUser.uid);
        }
      }

      // ── Step 3: Welcome SMS (only for new users) ──
      try {
        const firebaseUser2 = firebaseUser ?? await getFirebaseUserFromRequest(req);
        const firstName = firebaseUser2?.displayName?.split(' ')[0] || '';
        const smsType = metadata.userTypeIntent === 'PROVIDER' ? 'PROVIDER' as const
          : metadata.userTypeIntent === 'STAFF_REQUEST' ? 'STAFF' as const
          : 'CUSTOMER' as const;
        const displayId = membershipId || 'pending';
        if (isNewUser && firstName && metadata.phoneE164 && metadata.phoneE164 !== 'N/A') {
          const smsBody = renderWelcomeSMS(smsType, { firstName, membershipId: displayId, language });
          const templateId = getTemplateId(smsType);
          const smsResult = await twilioSMSService.sendSMS(metadata.phoneE164, smsBody);

          await db.insert(smsEvidence).values({
            userId: firebaseUser2?.uid || null,
            membershipId: membershipId || null,
            messageType: 'WELCOME',
            templateId,
            templateVersion: '1.0',
            toPhone: metadata.phoneE164,
            renderedText: smsBody,
            contentHash: crypto.createHash('sha256').update(smsBody).digest('hex'),
            provider: 'twilio',
            providerMessageId: smsResult.messageId || null,
            status: smsResult.success ? 'sent' : 'failed',
            failureReason: smsResult.success ? null : (smsResult.error || 'Unknown'),
            ip: req.ip || null,
            userAgent: req.headers['user-agent'] || null,
            traceId: (req as any).traceId,
          });
        }
      } catch (welcomeErr) {
        logger.error('[PublicAuth] Welcome SMS failed (non-blocking)', welcomeErr);
      }
    }

    res.json({
      success: true,
      verified: true,
      membershipId,
      isNewUser,
      message: language === 'he' ? 'הטלפון אומת בהצלחה' : 'Phone verified successfully',
    });
  } catch (err) {
    if (err instanceof UnifiedVerificationError) {
      const language = (req.headers['accept-language']?.includes('he') ? 'he' : 'en') as 'he' | 'en';
      return res.status(unifiedSignupErrorStatus(err)).json({
        error: err.reasonCode,
        message: err.reasonCode === 'INVALID_CODE'
          ? (language === 'he' ? 'קוד שגוי, נסו שוב' : 'Invalid code, please try again')
          : err.reasonCode === 'CHALLENGE_EXPIRED'
          ? (language === 'he' ? 'הקוד פג תוקף, בקשו קוד חדש' : 'Code expired, please request a new one')
          : (language === 'he' ? 'חריגה ממספר הניסיונות' : err.message),
      });
    }
    logger.error('[PublicAuth] Phone verify-code error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Verification failed' });
  }
});

// ── Rate limiter for client-side event reports (20 per IP per 5 min) ─────────
const clientEventRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  // Use ipKeyGenerator from express-rate-limit so the library's IPv6
  // normalisation is applied (maps each /56 subnet to one key, preventing
  // IPv6 address-rotation bypass). Trust-proxy is set to 1 in index.ts so
  // req.ip is the real client IP from the GCP/Firebase load-balancer header.
  keyGenerator: ipKeyGenerator,
  handler: (_req, res) => res.status(429).json({ ok: false, error: 'TOO_MANY_EVENTS' }),
});

// ── POST /api/auth/client-event ───────────────────────────────────────────────
// Receives structured auth failure reports from the frontend (OAuth callback
// errors, redirect result null on Safari, popup failures, session failures).
// Written to auth_events for admin visibility. Rate-limited per IP.
const clientEventSchema = z.object({
  eventType: z.enum([
    'OAUTH_CALLBACK_FAILED',
    'OAUTH_POPUP_FAILED',
    'REDIRECT_RESULT_NULL',
    'SESSION_CREATION_FAILED',
  ]),
  success: z.boolean().default(false),
  provider: z.string().max(32).optional(),
  reason: z.string().max(512).optional(),
  traceId: z.string().max(128).optional(),
});

publicAuthRouter.post('/api/auth/client-event', clientEventRateLimiter, async (req, res) => {
  const parse = clientEventSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ ok: false, error: 'INVALID_PAYLOAD' });
  }
  const { eventType, success, provider, reason, traceId } = parse.data;
  const ip = req.ip || null;
  const userAgent = req.headers['user-agent'] || null;

  try {
    await db.insert(authEvents).values({
      eventType,
      success: success ?? false,
      reason: [provider ? `provider=${provider}` : null, reason].filter(Boolean).join(' | ') || null,
      ip,
      userAgent,
      traceId: traceId || null,
    });
    logger.info(`[ClientEvent] ${eventType}`, { provider, reason, ip, traceId });
  } catch (err) {
    logger.warn('[ClientEvent] Failed to write auth_events (non-blocking)', err);
  }

  return res.json({ ok: true });
});

// ── GET /api/admin/auth-events ────────────────────────────────────────────────
// Returns recent auth_events rows for admin visibility. Requires a valid
// Firebase ID token belonging to SUPER_ADMIN_EMAILS.
publicAuthRouter.get('/api/admin/auth-events', apiLimiter, async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'AUTH_REQUIRED' });
    }

    const token = authHeader.split('Bearer ')[1];
    let decodedToken: any;
    try {
      decodedToken = await fbAdminAuth.verifyIdToken(token, true);
    } catch {
      return res.status(401).json({ error: 'INVALID_TOKEN' });
    }

    const adminEmails = (process.env.SUPER_ADMIN_EMAILS || '')
      .split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
    const callerEmail = (decodedToken.email || '').toLowerCase();
    const isEmailVerified = decodedToken.email_verified !== false;
    if (!adminEmails.includes(callerEmail) || !isEmailVerified) {
      return res.status(403).json({ error: 'FORBIDDEN' });
    }

    // Query params
    const limit = Math.min(parseInt(String(req.query.limit || '100')), 500);
    const typeFilter = String(req.query.type || '').trim();
    const since = req.query.since ? new Date(String(req.query.since)) : null;

    const rows = await db
      .select()
      .from(authEvents)
      .where(
        sql`TRUE
          ${typeFilter ? sql`AND event_type = ${typeFilter}` : sql``}
          ${since && !isNaN(since.getTime()) ? sql`AND created_at >= ${since.toISOString()}` : sql``}`
      )
      .orderBy(sql`created_at DESC`)
      .limit(limit);

    // Totals by event type for quick admin dashboard
    const totals = rows.reduce<Record<string, number>>((acc, row) => {
      acc[row.eventType] = (acc[row.eventType] || 0) + 1;
      return acc;
    }, {});

    return res.json({ ok: true, count: rows.length, totals, events: rows });
  } catch (err: any) {
    logger.error('[AdminAuthEvents] Query failed', { err: err.message });
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

logger.info('[PublicAuth] ✅ Public auth routes initialized (clean console mode)');
