import express from "express";
import { getCurrentUser } from "../simpleAuth";
import { logger } from "../lib/logger";
import { twilioSMSService } from "../services/TwilioSMSService";

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

    // No session / user not logged in → normal → HTTP 200
    if (!user) {
      return sendSafeJSON(res, {
        ok: true,
        authenticated: false,
        user: null,
      });
    }

    // Valid session
    return sendSafeJSON(res, {
      ok: true,
      authenticated: true,
      user,
    });

  } catch (err) {
    logger.error('[PublicAuth] Error checking auth status:', err);
    
    // If this error indicates a bad token, return real 401
    if (String(err).includes("INVALID_TOKEN") || String(err).includes("Invalid session")) {
      return res.status(401).json({
        ok: false,
        error: "Invalid authentication token",
      });
    }

    // Other server error
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
    const { getFirestore } = await import('firebase-admin/firestore');
    const firestore = getFirestore();
    
    const snapshot = await firestore
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
      expiresIn: result.expiresIn
    });
  } catch (err) {
    logger.error('[PublicAuth] Error sending phone verification:', err);
    return res.status(500).json({
      ok: false,
      error: 'Server error'
    });
  }
});

/**
 * Verify phone code and create session
 * POST /api/auth/phone/verify-code
 */
publicAuthRouter.post("/api/auth/phone/verify-code", async (req, res) => {
  try {
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
        error: result.message
      });
    }

    return res.status(200).json({
      ok: true,
      message: result.message,
      verified: true,
      verificationToken: result.verificationToken
    });
  } catch (err) {
    logger.error('[PublicAuth] Error verifying phone code:', err);
    return res.status(500).json({
      ok: false,
      error: 'Server error'
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

    const { getAuth } = await import('firebase-admin/auth');
    const adminAuth = getAuth();

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

    const sessionToken = Buffer.from(JSON.stringify({
      uid: user.uid,
      phone: formattedPhone,
      authMethod: 'phone',
      createdAt: Date.now()
    })).toString('base64');

    res.cookie('session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    logger.info('[PhoneAuth] Session created for user:', user.uid);

    return res.status(200).json({
      ok: true,
      userId: user.uid,
      customToken,
      message: 'Session created successfully'
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
