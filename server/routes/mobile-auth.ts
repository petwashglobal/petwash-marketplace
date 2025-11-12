import { Router, type Request, type Response } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { logger } from '../lib/logger';
import jwt from 'jsonwebtoken';

const router = Router();

// SECURE: Load credentials from environment variables
const WEB_CLIENT_ID = process.env.VITE_GOOGLE_CLIENT_ID || process.env.GOOGLE_WEB_CLIENT_ID;
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
    const auth = getAuth();
    const firestore = getFirestore();

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
      } else {
        throw error;
      }
    }

    const uid = firebaseUser.uid;

    // Get or create Firestore profile
    const userRef = firestore.collection('users').doc(uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      // New user - create profile with New tier
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
    } else {
      // Existing user - update last login
      await userRef.update({
        lastLogin: new Date().toISOString(),
        googleId, // Update if not set
      });
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
