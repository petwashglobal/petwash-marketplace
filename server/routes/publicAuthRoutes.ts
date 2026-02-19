import express from "express";
import crypto from 'crypto';
import { getCurrentUser } from "../simpleAuth";
import { logger } from "../lib/logger";
import { twilioSMSService } from "../services/TwilioSMSService";
import { db as firestoreDb, auth as fbAdminAuth } from '../lib/firebase-admin';

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

logger.info('[PublicAuth] ✅ Public auth routes initialized (clean console mode)');
