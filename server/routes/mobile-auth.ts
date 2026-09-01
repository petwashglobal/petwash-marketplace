import { Router, type Request, type Response } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { auth, db as firestore } from '../lib/firebase-admin';
import { logger } from '../lib/logger';
import jwt from 'jsonwebtoken';
import { pool } from '../db';
import { authService } from '../services/AuthService';

const router = Router();

// SECURE: Load credentials from environment variables
const WEB_CLIENT_ID = process.env.GOOGLE_WEB_CLIENT_ID;
const WEB_CLIENT_SECRET = process.env.GOOGLE_WEB_CLIENT_SECRET;
const JWT_SECRET = process.env.MOBILE_LINK_SECRET;

if (!WEB_CLIENT_ID) {
  logger.warn('[Mobile Auth] GOOGLE_WEB_CLIENT_ID not configured');
}

// OAuth2 client configured for 'postmessage' flow (native apps)
const client = WEB_CLIENT_ID && WEB_CLIENT_SECRET 
  ? new OAuth2Client(WEB_CLIENT_ID, WEB_CLIENT_SECRET, 'postmessage')
  : null;

/**
 * POST /api/mobile-auth/google
 * Exchanges serverAuthCode for access tokens and creates Pet Wash session
 * This is the core endpoint for Biometric/OAuth mobile authentication
 */
router.post('/google', async (req: Request, res: Response) => {
  const { authCode, idToken } = req.body;

  if (!authCode || !idToken) {
    return res.status(400).json({ 
      success: false,
      message: 'Missing Authorization Code or ID Token' 
    });
  }

  if (!client) {
    logger.error('[Mobile Auth] OAuth2Client not configured - missing credentials');
    return res.status(500).json({ 
      success: false,
      message: 'OAuth not configured. Please contact support.' 
    });
  }

  try {
    // 1. VERIFY ID TOKEN (Critical security step)
    // This verifies the token came from Google and was intended for your app
    const ticket = await client.verifyIdToken({
      idToken: idToken,
      audience: [WEB_CLIENT_ID!],
    });
    const payload = ticket.getPayload();

    if (!payload) {
      throw new Error('Invalid ID token payload');
    }

    // 2. CODE EXCHANGE (Server-side step)
    // Exchange the one-time code for long-lived refresh token
    const { tokens } = await client.getToken(authCode);

    // 3. EXTRACT USER DATA
    const googleId = payload.sub; // User's immutable Google ID
    const email = payload.email;
    const name = payload.name;
    const picture = payload.picture;

    if (!email) {
      throw new Error('Email not provided by Google');
    }

    // 4. PET WASH USER MANAGEMENT (Firebase + Firestore)
    

    // Check if user exists in Firebase
    let firebaseUser;
    try {
      firebaseUser = await auth.getUserByEmail(email);
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        // New user - create Firebase account
        firebaseUser = await auth.createUser({
          email,
          displayName: name,
          photoURL: picture,
          emailVerified: payload.email_verified || false,
        });
        logger.info(`[Mobile Auth] New Firebase user created: ${email}`);

        try {
          const { logNewUserRegistration } = await import('../services/bookingEventLogger');
          logNewUserRegistration({
            userId: firebaseUser.uid,
            firstName: name?.split(' ')[0] || '',
            lastName: name?.split(' ').slice(1).join(' ') || '',
            email: email || '',
            phone: '',
            country: 'IL',
            registrationSource: 'mobile_google_auth',
            profilePhotoUrl: picture || '',
            language: 'he',
          }).catch(() => {});
        } catch (logErr) {
          logger.warn('[Mobile Auth] Registration logging failed (non-blocking)', logErr);
        }
      } else {
        throw error;
      }
    }

    const uid = firebaseUser.uid;

    // ── Phase 1 canonical identity wiring — flag-gated, default OFF.
    // Records the Google-provider link on identity_accounts and emits
    // IDENTITY_SHADOW_WOULD_MERGE if this email collides with another
    // users row. Observation only — never merges, never changes UID.
    try {
      const { getFeatureFlag } = await import('../services/SystemConfig');
      const identityUnifiedOn = await getFeatureFlag('ff.returning_user.identity_unified.enabled');
      if (identityUnifiedOn) {
        const { loginOrLink } = await import('../identity/loginOrLink');
        await loginOrLink({
          provider: 'google',
          providerAccountId: uid,
          email,
          emailVerified: payload.email_verified === true,
          displayName: name || null,
        });
      }
    } catch (identityErr) {
      logger.warn('[Mobile Auth] loginOrLink probe failed (non-blocking)', {
        uid,
        error: identityErr instanceof Error ? identityErr.message : String(identityErr),
      });
    }

    // Get or create Firestore profile
    const userRef = firestore.collection('users').doc(uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      // New user - create Firestore profile
      await userRef.set({
        email,
        name: name || email.split('@')[0],
        photoURL: picture,
        googleId,
        loyaltyTier: 'new',
        role: 'customer',
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
        authProvider: 'google-mobile',
      });
      logger.info(`[Mobile Auth] New Pet Wash user registered: ${email} (New tier)`);

      // Ensure PostgreSQL users row + loyalty profile + wallet account are all created
      // (authService.ensureUserInPostgres also calls ensureLoyaltyProfile + ensureWalletAccount)
      const pgResult = await authService.ensureUserInPostgres(uid, email, {
        firstName: name?.split(' ')[0] || undefined,
        lastName: name?.split(' ').slice(1).join(' ') || undefined,
        profileImageUrl: picture || undefined,
        country: 'IL',
        language: 'he',
      });
      // SEV-1 hard gate (2026-08-20): previously the failure branch only logged
      // "user may not be able to book" and still returned 200 + customToken —
      // the mobile client then landed with no Postgres row (every wallet/booking
      // query 500s). Return 502 { code: 'DB_UNAVAILABLE' } so the client retries
      // deterministically instead of silently succeeding into a broken account.
      if (!pgResult) {
        logger.error('[Mobile Auth] Failed to create PostgreSQL user row — HARD FAIL', { uid });
        return res.status(502).json({
          success: false,
          error: 'user_bootstrap_failed',
          code: 'DB_UNAVAILABLE',
        });
      }
      logger.info(`[Mobile Auth] PostgreSQL user + wallet ready for ${email} (isNew=${pgResult.isNewUser})`);
    } else {
      // Existing user — update last login in Firestore and ensure DB row exists
      await userRef.update({
        lastLogin: new Date().toISOString(),
        googleId, // Update if not set
      });
      // Idempotent: ensures wallet/loyalty exist even if they were missed previously.
      // Same SEV-1 hard-fail semantics — an existing Firebase user with a missing
      // Postgres row is the exact orphan class that causes the whoami 404 → 502.
      const pgHeal = await authService.ensureUserInPostgres(uid, email);
      if (!pgHeal) {
        logger.error('[Mobile Auth] Failed to heal PostgreSQL user row — HARD FAIL', { uid });
        return res.status(502).json({
          success: false,
          error: 'user_bootstrap_failed',
          code: 'DB_UNAVAILABLE',
        });
      }
    }

    // SEV-1 fix (2026-08-20): stamp the customer role claim so whoami sees
    // role='customer' instead of 'public' (which used to happen because
    // setCustomUserClaims was never called on the mobile-google path).
    // MERGE with existing claims — never overwrite an existing role (a provider
    // signing in with Google must keep the 'provider' claim from
    // AdminProviderReviewService.approveApplication).
    try {
      const existingClaims = (firebaseUser.customClaims || {}) as Record<string, any>;
      if (!existingClaims.role) {
        await auth.setCustomUserClaims(uid, {
          ...existingClaims,
          role: 'customer',
          accountType: 'pet_parent',
        });
        logger.info('[Mobile Auth] customer role claim stamped', { uid });
      }
    } catch (claimsErr: any) {
      logger.warn('[Mobile Auth] setCustomUserClaims failed (non-blocking)', { uid, error: claimsErr?.message });
    }

    // Store refresh token if provided (for offline Google API access)
    if (tokens.refresh_token) {
      await firestore
        .collection('users')
        .doc(uid)
        .collection('private')
        .doc('tokens')
        .set({
          googleRefreshToken: tokens.refresh_token,
          updatedAt: new Date().toISOString(),
        }, { merge: true });
      logger.info(`[Mobile Auth] Refresh token stored for ${email}`);
    }

    // 5. ISSUE PET WASH SECURE TOKEN (Firebase Custom Token)
    const customToken = await auth.createCustomToken(uid);

    // Optional: Generate JWT for additional API access if needed
    let petWashAuthToken;
    if (JWT_SECRET) {
      petWashAuthToken = jwt.sign(
        { sub: uid, email, type: 'MOBILE_AUTH' },
        JWT_SECRET,
        { expiresIn: '7d' }
      );
    }

    // Get user profile data
    const profileDoc = await userRef.collection('profile').doc('data').get();
    const profileData = profileDoc.data() || {};

    // 6. Respond to mobile client
    res.status(200).json({
      success: true,
      customToken, // Firebase custom token for mobile SDK
      token: petWashAuthToken, // Optional JWT token
      user: {
        uid,
        email,
        name: profileData.firstName || name || email.split('@')[0],
        photoURL: picture,
        loyaltyTier: profileData.loyaltyTier || 'new',
        role: profileData.role || 'customer',
      },
    });

    logger.info(`[Mobile Auth] Successful login: ${email}`);

  } catch (error: any) {
    logger.error('[Mobile Auth] Google OAuth Exchange Failed', {
      error: error.message,
      stack: error.stack,
    });
    res.status(500).json({
      success: false,
      message: 'Secure login failed. Please contact support.',
    });
  }
});

/**
 * POST /api/mobile-auth/verify
 * Verify a mobile JWT token (if using custom JWT tokens)
 */
router.post('/verify', async (req: Request, res: Response) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ success: false, message: 'Token required' });
  }

  if (!JWT_SECRET) {
    return res.status(500).json({ success: false, message: 'JWT not configured' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { sub: string; email: string };
    res.json({ success: true, uid: decoded.sub, email: decoded.email });
  } catch (error) {
    logger.error('[Mobile Auth] Token verification failed', error);
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
});

export default router;
