import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { google } from 'googleapis';
import { logger } from '../lib/logger';
import { auth as firebaseAdmin, db } from '../lib/firebase-admin';

const router = Router();

// ── Token encryption helpers (AES-256-GCM, same pattern as bank.ts) ────────────
function encryptGmailToken(plaintext: string): string {
  const keyEnv = process.env.GMAIL_TOKEN_ENCRYPTION_KEY;
  if (!keyEnv) {
    logger.warn('[Gmail] GMAIL_TOKEN_ENCRYPTION_KEY not set — token stored unencrypted');
    return plaintext;
  }
  // Derive a fixed 32-byte key via SHA-256 (same approach as bank.ts)
  const key = crypto.createHash('sha256').update(keyEnv).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `enc:v1:${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
}

function decryptGmailToken(ciphertext: string): string {
  if (!ciphertext.startsWith('enc:v1:')) return ciphertext; // stored unencrypted
  const keyEnv = process.env.GMAIL_TOKEN_ENCRYPTION_KEY;
  if (!keyEnv) return ciphertext;
  const key = crypto.createHash('sha256').update(keyEnv).digest();
  const parts = ciphertext.split(':');
  if (parts.length !== 5) throw new Error('Invalid encrypted token format');
  const iv = Buffer.from(parts[2], 'base64');
  const authTag = Buffer.from(parts[3], 'base64');
  const encrypted = Buffer.from(parts[4], 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

// ── Replit connector - Gmail OAuth token management ──────────────────────────
let connectionSettings: any;

async function getGmailAccessToken(): Promise<string | null> {
  // 1. Replit connector (cached, preferred on Replit hosting)
  if (connectionSettings && connectionSettings.settings?.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }

  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? 'repl ' + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
    ? 'depl ' + process.env.WEB_REPL_RENEWAL
    : null;

  if (xReplitToken && hostname) {
    connectionSettings = await fetch(
      'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=google-mail',
      {
        headers: {
          'Accept': 'application/json',
          'X_REPLIT_TOKEN': xReplitToken
        }
      }
    ).then(res => res.json()).then(data => data.items?.[0]);

    const accessToken = connectionSettings?.settings?.access_token || connectionSettings?.settings?.oauth?.credentials?.access_token;
    if (connectionSettings && accessToken) {
      return accessToken;
    }
  }

  // 2. Production fallback: use server-side OAuth2 refresh token (Cloud Run / any environment)
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;

  if (clientId && clientSecret && refreshToken) {
    try {
      const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
      oauth2Client.setCredentials({ refresh_token: refreshToken });
      const { credentials } = await oauth2Client.refreshAccessToken();
      if (credentials.access_token) {
        return credentials.access_token;
      }
    } catch (err) {
      logger.warn('[Gmail] Production OAuth2 refresh token failed:', err);
    }
  }

  logger.warn('[Gmail] No Gmail credentials available — configure GMAIL_CLIENT_ID + GMAIL_CLIENT_SECRET + GMAIL_REFRESH_TOKEN for Cloud Run, or use the Replit connector.');
  return null;
}

async function getUncachableGmailClient() {
  const accessToken = await getGmailAccessToken();
  if (!accessToken) return null;
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });
  return google.gmail({ version: 'v1', auth: oauth2Client });
}

export async function sendViaGmail(opts: { to: string; subject: string; html: string }): Promise<boolean> {
  try {
    const gmail = await getUncachableGmailClient();
    if (!gmail) {
      logger.warn('[Gmail] sendViaGmail skipped — connector not available in this environment');
      return false;
    }
    const rawMessage = [
      `To: ${opts.to}`,
      `Subject: ${opts.subject}`,
      `Content-Type: text/html; charset=utf-8`,
      `MIME-Version: 1.0`,
      '',
      opts.html,
    ].join('\r\n');
    const encodedMessage = Buffer.from(rawMessage).toString('base64url');
    await gmail.users.messages.send({ userId: 'me', requestBody: { raw: encodedMessage } });
    return true;
  } catch (err) {
    logger.error('[Gmail] sendViaGmail failed:', err);
    return false;
  }
}

async function requireFirebaseAuth(req: Request, res: Response, next: NextFunction) {
  try {
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

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
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

/**
 * GET /api/gmail/status
 * Check if Gmail is connected via Replit connector
 */
router.get('/status', async (_req, res) => {
  try {
    const accessToken = await getGmailAccessToken();
    const connectedEmail = connectionSettings?.settings?.oauth?.credentials?.email
      || connectionSettings?.settings?.email
      || null;

    return res.status(200).json({
      success: true,
      connected: !!accessToken,
      email: connectedEmail,
      scopes: connectionSettings?.settings?.oauth?.credentials?.scope?.split(' ') || [
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/gmail.labels',
      ],
    });
  } catch (error) {
    return res.status(200).json({
      success: true,
      connected: false,
      message: 'Gmail not connected. Connect via Replit integrations panel.',
    });
  }
});

/**
 * POST /api/gmail/send
 * Send an email via Gmail using Replit connector
 * SECURITY: Requires Firebase authentication
 */
router.post('/send', requireFirebaseAuth, async (req, res) => {
  try {
    const userId = (req as any).user?.uid;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }

    const { to, subject, body, html } = req.body;
    if (!to || !subject) {
      return res.status(400).json({ success: false, error: 'to and subject are required' });
    }

    const gmail = await getUncachableGmailClient();
    if (!gmail) throw new Error('Gmail client not initialized');

    const emailContent = html || body || '';
    const mimeType = html ? 'text/html' : 'text/plain';

    const rawMessage = [
      `To: ${to}`,
      `Subject: ${subject}`,
      `Content-Type: ${mimeType}; charset=utf-8`,
      '',
      emailContent,
    ].join('\r\n');

    const encodedMessage = Buffer.from(rawMessage).toString('base64url');

    const result = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage,
      },
    });

    logger.info('[Gmail] Email sent via Replit connector', { to, subject, messageId: result.data.id });

    return res.status(200).json({
      success: true,
      messageId: result.data.id,
    });
  } catch (error: any) {
    logger.error('[Gmail] Failed to send email:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to send email via Gmail',
    });
  }
});

/**
 * GET /api/gmail/labels
 * List Gmail labels
 * SECURITY: Requires Firebase authentication
 */
router.get('/labels', requireFirebaseAuth, async (_req, res) => {
  try {
    const gmail = await getUncachableGmailClient();
    if (!gmail) throw new Error('Gmail client not initialized');

    const result = await gmail.users.labels.list({
      userId: 'me',
    });

    return res.status(200).json({
      success: true,
      labels: result.data.labels || [],
    });
  } catch (error: any) {
    logger.error('[Gmail] Failed to list labels:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to list Gmail labels',
    });
  }
});

/**
 * GET /api/gmail/messages
 * List recent Gmail messages
 * SECURITY: Requires Firebase authentication
 */
router.get('/messages', requireFirebaseAuth, async (req, res) => {
  try {
    const gmail = await getUncachableGmailClient();
    if (!gmail) throw new Error('Gmail client not initialized');
    const maxResults = parseInt(req.query.maxResults as string) || 10;
    const labelIds = req.query.labelIds ? (req.query.labelIds as string).split(',') : undefined;

    const result = await gmail.users.messages.list({
      userId: 'me',
      maxResults,
      labelIds,
    });

    return res.status(200).json({
      success: true,
      messages: result.data.messages || [],
      resultSizeEstimate: result.data.resultSizeEstimate,
    });
  } catch (error: any) {
    logger.error('[Gmail] Failed to list messages:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to list Gmail messages',
    });
  }
});

/**
 * POST /api/gmail/connect
 * Store a user's Gmail OAuth access token (from client-side sign-in) in Firestore.
 * The token is AES-256-GCM encrypted with GMAIL_TOKEN_ENCRYPTION_KEY.
 * SECURITY: Requires Firebase authentication
 */
router.post('/connect', requireFirebaseAuth, async (req, res) => {
  try {
    const uid = (req as any).user?.uid;
    if (!uid) {
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }

    const { accessToken, email } = req.body;
    if (!accessToken || typeof accessToken !== 'string') {
      return res.status(400).json({ success: false, error: 'accessToken is required' });
    }

    const encryptedToken = encryptGmailToken(accessToken);

    await db.collection('gmail_tokens').doc(uid).set({
      encryptedAccessToken: encryptedToken,
      email: email || (req as any).user?.email || null,
      connectedAt: new Date().toISOString(),
      // Access tokens are valid for ~1 hour
      expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
      uid,
    }, { merge: true });

    logger.info('[Gmail] User Gmail token stored', { uid, email });

    return res.status(200).json({ success: true });
  } catch (error: any) {
    logger.error('[Gmail] Failed to store user Gmail token:', error);
    return res.status(500).json({ success: false, error: 'Failed to save Gmail connection' });
  }
});

export default router;
