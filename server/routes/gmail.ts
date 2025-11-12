import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { logger } from '../lib/logger';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth as firebaseAdmin } from '../lib/firebase-admin';
import crypto from 'crypto';

const router = Router();

// SECURITY: Encryption key for Gmail tokens - REQUIRED from environment
// In production, use AWS KMS, Google Cloud KMS, or Azure Key Vault
if (!process.env.GMAIL_TOKEN_ENCRYPTION_KEY) {
  logger.error('[Gmail] CRITICAL: GMAIL_TOKEN_ENCRYPTION_KEY environment variable is not set!');
  logger.error('[Gmail] Gmail OAuth features will be disabled for security.');
} else if (process.env.GMAIL_TOKEN_ENCRYPTION_KEY.length !== 64) {
  logger.error('[Gmail] CRITICAL: GMAIL_TOKEN_ENCRYPTION_KEY must be 64 hex characters (32 bytes for AES-256)!');
  logger.error(`[Gmail] Current length: ${process.env.GMAIL_TOKEN_ENCRYPTION_KEY.length} characters`);
  logger.error('[Gmail] Gmail OAuth features will be disabled for security.');
}

const ENCRYPTION_KEY = process.env.GMAIL_TOKEN_ENCRYPTION_KEY && process.env.GMAIL_TOKEN_ENCRYPTION_KEY.length === 64
  ? Buffer.from(process.env.GMAIL_TOKEN_ENCRYPTION_KEY, 'hex')
  : null;

const ENCRYPTION_ALGORITHM = 'aes-256-gcm';

// Helper function to encrypt Gmail tokens
function encryptToken(token: string): { encrypted: string; iv: string; authTag: string } {
  if (!ENCRYPTION_KEY) {
    throw new Error('Encryption key not available - GMAIL_TOKEN_ENCRYPTION_KEY must be set');
  }
  
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, ENCRYPTION_KEY, iv);
  
  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return {
    encrypted,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex')
  };
}

// Helper function to decrypt Gmail tokens
function decryptToken(encrypted: string, iv: string, authTag: string): string {
  if (!ENCRYPTION_KEY) {
    throw new Error('Encryption key not available - GMAIL_TOKEN_ENCRYPTION_KEY must be set');
  }
  
  const decipher = crypto.createDecipheriv(
    ENCRYPTION_ALGORITHM,
    ENCRYPTION_KEY,
    Buffer.from(iv, 'hex')
  );
  
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

// SECURITY MIDDLEWARE: Require Firebase authentication
async function requireFirebaseAuth(req: Request, res: Response, next: NextFunction) {
  try {
    // Check session cookie first (preferred)
    const sessionCookie = req.cookies?.pw_session;
    
    if (sessionCookie) {
      try {
        const decodedClaims = await firebaseAdmin.verifySessionCookie(sessionCookie, true);
        (req as any).user = {
          uid: decodedClaims.uid,
          email: decodedClaims.email,
          email_verified: decodedClaims.email_verified
        };
        return next();
      } catch (cookieError) {
        logger.debug('[Gmail Auth] Session cookie invalid, trying Authorization header');
      }
    }
    
    // Fallback to Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.warn('[Gmail Auth] No valid authentication found');
      return res.status(401).json({
        success: false,
        error: 'Authentication required. Please sign in.',
      });
    }
    
    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await firebaseAdmin.verifyIdToken(token, true);
    
    (req as any).user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      email_verified: decodedToken.email_verified
    };
    
    next();
  } catch (error) {
    logger.error('[Gmail Auth] Authentication failed:', error);
    res.status(401).json({
      success: false,
      error: 'Invalid or expired authentication token',
    });
  }
}

// Schema for Gmail connection data (removed userId - comes from auth)
const gmailConnectSchema = z.object({
  accessToken: z.string().min(1, { message: "Access token is required" }),
  email: z.string().email({ message: "Please enter a valid email address" }),
});

/**
 * LUXURY 2025: Gmail OAuth Connection Endpoint
 * Saves Gmail access token after user grants permissions
 * 
 * POST /api/gmail/connect
 * SECURITY: Requires Firebase authentication
 * Stores encrypted OAuth access token in Firestore
 */
router.post('/connect', requireFirebaseAuth, async (req, res) => {
  try {
    // SECURITY: Check encryption key is available
    if (!ENCRYPTION_KEY) {
      logger.error('[Gmail] Encryption key not configured - refusing to store tokens');
      return res.status(503).json({
        success: false,
        error: 'Gmail OAuth temporarily unavailable - encryption not configured',
      });
    }
    
    // Get authenticated user from middleware
    const userId = (req as any).user?.uid;
    const authenticatedEmail = (req as any).user?.email;
    const emailVerified = (req as any).user?.email_verified;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }
    
    // SECURITY: Require email verification before allowing Gmail connection
    if (!emailVerified) {
      logger.warn('[Gmail] Email not verified - blocking Gmail connection', { userId, email: authenticatedEmail });
      return res.status(403).json({
        success: false,
        error: 'Email verification required. Please verify your email address before connecting Gmail.',
      });
    }
    
    // Validate request body
    const validation = gmailConnectSchema.safeParse(req.body);
    
    if (!validation.success) {
      logger.warn('[Gmail] Invalid request body', { errors: validation.error.errors });
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: validation.error.errors,
      });
    }

    const { accessToken, email } = validation.data;
    
    // SECURITY: Verify the email matches the authenticated user
    if (email !== authenticatedEmail) {
      logger.warn('[Gmail] Email mismatch attempt', { 
        authenticatedEmail, 
        requestedEmail: email,
        userId 
      });
      return res.status(403).json({
        success: false,
        error: 'Email does not match authenticated user',
      });
    }

    logger.info('[Gmail] Saving Gmail connection', { userId, email });

    // SECURITY: Encrypt the access token before storing
    const { encrypted, iv, authTag } = encryptToken(accessToken);

    // Save to Firestore with encrypted token
    const gmailConnectionRef = doc(db, 'gmailConnections', userId);
    
    await setDoc(gmailConnectionRef, {
      userId,
      email,
      encryptedToken: encrypted,
      tokenIv: iv,
      tokenAuthTag: authTag,
      connectedAt: serverTimestamp(),
      scopes: [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/gmail.compose',
        'https://www.googleapis.com/auth/gmail.modify',
      ],
      status: 'active',
    }, { merge: true });

    logger.info('[Gmail] Gmail connection saved successfully (encrypted)', { userId });

    return res.status(200).json({
      success: true,
      message: 'Gmail connected successfully',
      email,
    });

  } catch (error) {
    logger.error('[Gmail] Failed to save Gmail connection:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Failed to save Gmail connection',
    });
  }
});

/**
 * GET /api/gmail/status
 * Check if user has Gmail connected
 * SECURITY: Requires Firebase authentication
 */
router.get('/status', requireFirebaseAuth, async (req, res) => {
  try {
    const userId = (req as any).user?.uid;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }

    // Check Firestore for Gmail connection
    const gmailConnectionRef = doc(db, 'gmailConnections', userId);
    const gmailDoc = await getDoc(gmailConnectionRef);

    if (!gmailDoc.exists()) {
      return res.status(200).json({
        success: true,
        connected: false,
      });
    }

    const data = gmailDoc.data();

    return res.status(200).json({
      success: true,
      connected: true,
      email: data.email,
      connectedAt: data.connectedAt,
      scopes: data.scopes,
    });

  } catch (error) {
    logger.error('[Gmail] Failed to check Gmail status:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Failed to check Gmail status',
    });
  }
});

/**
 * DELETE /api/gmail/disconnect
 * Disconnect Gmail integration
 * SECURITY: Requires Firebase authentication
 */
router.delete('/disconnect', requireFirebaseAuth, async (req, res) => {
  try {
    const userId = (req as any).user?.uid;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }

    logger.info('[Gmail] Disconnecting Gmail', { userId });

    // SECURITY: Delete all encrypted token artifacts (GDPR compliance)
    const gmailConnectionRef = doc(db, 'gmailConnections', userId);
    
    await setDoc(gmailConnectionRef, {
      status: 'disconnected',
      disconnectedAt: serverTimestamp(),
      encryptedToken: null,  // Delete encrypted token
      tokenIv: null,         // Delete initialization vector
      tokenAuthTag: null,    // Delete authentication tag
    }, { merge: true });

    logger.info('[Gmail] Gmail disconnected successfully', { userId });

    return res.status(200).json({
      success: true,
      message: 'Gmail disconnected successfully',
    });

  } catch (error) {
    logger.error('[Gmail] Failed to disconnect Gmail:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Failed to disconnect Gmail',
    });
  }
});

export default router;
