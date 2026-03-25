import express from "express";
import crypto from 'crypto';
import { z } from 'zod';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { getCurrentUser } from "../simpleAuth";
import { logger } from "../lib/logger";
import { verifyCaptchaToken } from "../lib/verifyCaptcha";
import { twilioSMSService } from "../services/TwilioSMSService";
import { db as firestoreDb, auth as fbAdminAuth } from '../lib/firebase-admin';
import { sql, eq } from 'drizzle-orm';
import { pool, db } from '../db';
import { userConsents, authEvents, users, smsEvidence, otpEvents } from '@shared/schema';
import { storage } from '../storage';

// Rate limiter: max 10 SMS send attempts per IP per minute (matches platform auth rate limit policy).
// ipKeyGenerator normalises IPv6-mapped IPv4 addresses (e.g. "::ffff:1.2.3.4" → "1.2.3.4")
// so that IPv4 and IPv6 connections to the same IP share the same rate-limit bucket.
const phoneSendRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: ipKeyGenerator,
  validate: { xForwardedForHeader: false, ip: false, default: false },
  handler: (_req, res) => {
    logger.warn('[PublicAuth] SMS rate limit hit', { ip: _req.ip });
    return res.status(429).json({
      ok: false,
      error: 'יותר מדי בקשות. המתינו דקה.'
    });
  }
});

// Rate limiter: max 10 verify attempts per IP per 5 minutes
// ipKeyGenerator normalises IPv6-mapped IPv4 addresses so bypassing via IPv6 is blocked.
const phoneVerifyRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: ipKeyGenerator,
  validate: { xForwardedForHeader: false, ip: false, default: false },
  handler: (_req, res) => {
    return res.status(429).json({
      ok: false,
      error: 'יותר מדי ניסיונות. המתינו 5 דקות.'
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
publicAuthRouter.get("/api/simple-auth/me", async (req, res) => {
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
    const { phone, language = 'he', captchaToken } = req.body;
    
    if (!phone) {
      return res.status(400).json({
        ok: false,
        error: language === 'he' ? 'נדרש מספר טלפון' : 'Phone number is required'
      });
    }

    if (!captchaToken) {
      logger.warn('[PublicAuth] Phone send-code blocked — no captchaToken', { phone: phone.slice(-4) });
      return res.status(400).json({ ok: false, error: language === 'he' ? 'נדרש אימות אבטחה' : 'Security verification required' });
    }
    const captchaResult = await verifyCaptchaToken(captchaToken, 'phone_login');
    if (!captchaResult.valid) {
      logger.warn('[PublicAuth] Phone send-code blocked by reCAPTCHA', { phone: phone.slice(-4), reason: captchaResult.reason });
      db.insert(authEvents).values({
        eventType: 'CAPTCHA_PHONE_OTP_FAILED',
        success: false,
        reason: `${captchaResult.reason || 'low_score'} (score=${captchaResult.score}, source=${captchaResult.source})`,
        ip: req.ip || (req.headers['x-forwarded-for'] as string) || 'unknown',
        userAgent: req.headers['user-agent'] || null,
        traceId,
      }).catch((dbErr: any) => logger.warn('[PublicAuth] authEvents captcha insert failed', { error: dbErr?.message }));
      return res.status(403).json({ ok: false, error: language === 'he' ? 'אימות אבטחה נכשל' : 'Security check failed. Please refresh and try again.' });
    }

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

    const callerIp = req.ip || (req.headers['x-forwarded-for'] as string) || 'unknown';
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

    const formattedPhone = tokenValidation.phone;

    const adminAuth = fbAdminAuth;

    let user;
    try {
      user = await adminAuth.getUserByPhoneNumber(formattedPhone);
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        user = await adminAuth.createUser({
          phoneNumber: formattedPhone,
          displayName: `User ${formattedPhone.slice(-4)}`,
        });
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
      } else {
        throw error;
      }
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
 * Record user consent (Terms, Privacy, etc.) with full audit trail
 * POST /api/consents
 */
publicAuthRouter.post("/api/consents", async (req, res) => {
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
publicAuthRouter.get("/api/consents/status", async (req, res) => {
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

publicAuthRouter.post('/api/auth/phone/otp/send', async (req, res) => {
  try {
    const parsed = otpSendSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Invalid phone number or intent', details: parsed.error.flatten() });
    }

    const { phone, userTypeIntent, channel, captchaToken } = parsed.data;
    const language = (req.headers['accept-language']?.includes('he') ? 'he' : 'en') as 'he' | 'en';

    if (!captchaToken) {
      logger.warn('[PublicAuth] OTP send blocked — no captchaToken', { phone: phone.slice(-4) });
      return res.status(400).json({ error: 'CAPTCHA_REQUIRED', message: language === 'he' ? 'נדרש אימות אבטחה' : 'Security verification required' });
    }
    const captchaResult = await verifyCaptchaToken(captchaToken, 'phone_otp');
    if (!captchaResult.valid) {
      logger.warn('[PublicAuth] OTP send blocked by reCAPTCHA', { phone: phone.slice(-4), reason: captchaResult.reason });
      return res.status(403).json({ error: 'CAPTCHA_FAILED', message: language === 'he' ? 'אימות אבטחה נכשל' : 'Security check failed. Please refresh and try again.' });
    }

    const result = await registrationOTPService.sendOTP(phone, userTypeIntent, {
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
    logger.error('[PublicAuth] Phone send-code error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to send verification code' });
  }
});

publicAuthRouter.post('/api/auth/phone/otp/resend', async (req, res) => {
  try {
    const parsed = otpResendSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Invalid request' });
    }

    const { otpId, channel } = parsed.data;
    const language = (req.headers['accept-language']?.includes('he') ? 'he' : 'en') as 'he' | 'en';

    const result = await registrationOTPService.resendOTP(otpId, channel, {
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
    logger.error('[PublicAuth] Phone resend-code error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to resend verification code' });
  }
});

publicAuthRouter.post('/api/auth/phone/otp/verify', async (req, res) => {
  try {
    const parsed = otpVerifySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Invalid OTP ID or code' });
    }

    const { otpId, code } = parsed.data;
    const language = (req.headers['accept-language']?.includes('he') ? 'he' : 'en') as 'he' | 'en';

    const result = await registrationOTPService.verifyOTP(otpId, code, {
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
            // Existing user — stamp phone_verified and phone_e164 if not already set
            const updates: any = { phoneVerified: true };
            if (metadata.phoneE164 !== 'N/A') updates.phoneE164 = metadata.phoneE164;
            await db.update(users).set(updates).where(eq(users.id, firebaseUser.uid));
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
publicAuthRouter.get('/api/admin/auth-events', async (req, res) => {
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
