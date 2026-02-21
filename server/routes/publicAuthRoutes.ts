import express from "express";
import crypto from 'crypto';
import { z } from 'zod';
import { getCurrentUser } from "../simpleAuth";
import { logger } from "../lib/logger";
import { twilioSMSService } from "../services/TwilioSMSService";
import { db as firestoreDb, auth as fbAdminAuth } from '../lib/firebase-admin';
import { pool, db } from '../db';
import { userConsents, authEvents } from '@shared/schema';

async function getFirebaseUserFromRequest(req: express.Request): Promise<{uid: string; email?: string; displayName?: string} | null> {
  try {
    const authHeader = req.headers.authorization;
    const sessionCookie = req.cookies?.pw_session;
    if (!authHeader?.startsWith('Bearer ') && !sessionCookie) return null;

    const { auth: fbAdmin } = await import('../lib/firebase-admin');
    let decoded: any;
    if (authHeader?.startsWith('Bearer ')) {
      decoded = await fbAdmin.verifyIdToken(authHeader.split('Bearer ')[1], true);
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

    const firebaseUser = await getFirebaseUserFromRequest(req);
    if (firebaseUser) {
      return sendSafeJSON(res, {
        ok: true,
        authenticated: true,
        user: {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          firstName: firebaseUser.displayName?.split(' ')[0] || '',
          lastName: firebaseUser.displayName?.split(' ').slice(1).join(' ') || '',
          authProvider: 'firebase',
        },
      });
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
 */
publicAuthRouter.post("/api/auth/phone/send-code", async (req, res) => {
  try {
    const traceId = (req as any).traceId || crypto.randomUUID();
    logger.info('[Auth] Phone code send started', { traceId, phone: req.body.phone?.slice(-4) });
    const { phone, language = 'he' } = req.body;
    
    if (!phone) {
      return res.status(400).json({
        ok: false,
        error: language === 'he' ? 'נדרש מספר טלפון' : 'Phone number is required'
      });
    }

    const result = await twilioSMSService.sendVerificationCode(phone, language);
    
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
publicAuthRouter.post("/api/auth/phone/verify-code", async (req, res) => {
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

    const result = twilioSMSService.verifyCode(phone, code, language);
    
    if (!result.success) {
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
    const decodedToken = await getAuth().verifyIdToken(token);
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

      const result = await pool.query(
        `INSERT INTO user_consents (user_id, consent_type, consent_version, consent_text_hash, accepted, ip, user_agent, locale, source, trace_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
        [userId, consentType, consentVersion, consentTextHash, accepted !== false, ip, userAgent, locale, source, traceId]
      );
      insertedIds.push(result.rows[0].id);
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
    const decodedToken = await getAuth().verifyIdToken(token);
    const userId = decodedToken.uid;

    const result = await pool.query(
      `SELECT consent_type, consent_version, accepted, accepted_at
       FROM user_consents
       WHERE user_id = $1
       ORDER BY accepted_at DESC`,
      [userId]
    );

    const latestByType: Record<string, any> = {};
    for (const row of result.rows) {
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
    await pool.query(
      `INSERT INTO accessibility_feedback(email, message, page_url, user_agent, ip_address)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        (email || '').trim() || null,
        message.trim(),
        (pageUrl || '').trim() || null,
        userAgent,
        ip
      ]
    );
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
    await pool.query(
      `INSERT INTO accessibility_audit_log(action, component, details, user_agent, ip_address)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        action,
        component || null,
        details ? JSON.stringify(details) : null,
        userAgent,
        ip
      ]
    );
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
import { smsEvidence } from '@shared/schema';

const otpSendSchema = z.object({
  phone: z.string().min(8).max(20),
  userTypeIntent: z.enum(['PUBLIC', 'PROVIDER', 'STAFF_REQUEST']).default('PUBLIC'),
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

    const { phone, userTypeIntent } = parsed.data;
    const language = (req.headers['accept-language']?.includes('he') ? 'he' : 'en') as 'he' | 'en';

    const result = await registrationOTPService.sendOTP(phone, userTypeIntent, {
      ip: req.ip || req.headers['x-forwarded-for']?.toString(),
      userAgent: req.headers['user-agent'],
      traceId: (req as any).traceId,
      language,
    });

    if (!result.success) {
      return res.status(429).json({
        error: result.error,
        cooldownRemaining: result.cooldownRemaining,
        message: result.error === 'COOLDOWN_ACTIVE'
          ? (language === 'he' ? 'אנא המתינו לפני שליחת קוד חדש' : 'Please wait before requesting a new code')
          : (language === 'he' ? 'יותר מדי ניסיונות, נסו שוב מאוחר יותר' : 'Too many attempts, please try again later'),
      });
    }

    res.json({
      success: true,
      otpId: result.otpId,
      expiresIn: result.expiresIn,
      message: language === 'he' ? 'קוד אימות נשלח' : 'Verification code sent',
    });
  } catch (err) {
    logger.error('[PublicAuth] Phone send-code error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to send verification code' });
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

    if (metadata) {
      const firebaseUser = await getFirebaseUserFromRequest(req);
      if (firebaseUser) {
        if (metadata.userTypeIntent === 'PUBLIC') {
          membershipId = await assignCustomerMembership(firebaseUser.uid);
        }
      }

      try {
        const firstName = firebaseUser?.displayName?.split(' ')[0] || '';
        const smsType = metadata.userTypeIntent === 'PROVIDER' ? 'PROVIDER' as const
          : metadata.userTypeIntent === 'STAFF_REQUEST' ? 'STAFF' as const
          : 'CUSTOMER' as const;
        const displayId = membershipId || 'pending';
        if (firstName && metadata.phoneE164 && metadata.phoneE164 !== 'N/A') {
          const smsBody = renderWelcomeSMS(smsType, { firstName, membershipId: displayId, language });
          const templateId = getTemplateId(smsType);
          const smsResult = await twilioSMSService.sendSMS(metadata.phoneE164, smsBody);

          await db.insert(smsEvidence).values({
            userId: firebaseUser?.uid || null,
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
      message: language === 'he' ? 'הטלפון אומת בהצלחה' : 'Phone verified successfully',
    });
  } catch (err) {
    logger.error('[PublicAuth] Phone verify-code error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Verification failed' });
  }
});

logger.info('[PublicAuth] ✅ Public auth routes initialized (clean console mode)');
