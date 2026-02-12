import { Router, Request, Response, NextFunction } from 'express';
import { google } from 'googleapis';
import { logger } from '../lib/logger';
import { auth as firebaseAdmin } from '../lib/firebase-admin';

const router = Router();

// Replit connector - Gmail OAuth token management
let connectionSettings: any;

async function getGmailAccessToken(): Promise<string> {
  if (connectionSettings && connectionSettings.settings?.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }

  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? 'repl ' + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
    ? 'depl ' + process.env.WEB_REPL_RENEWAL
    : null;

  if (!xReplitToken) {
    throw new Error('Replit connector token not available');
  }

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

  if (!connectionSettings || !accessToken) {
    throw new Error('Gmail not connected via Replit connector');
  }
  return accessToken;
}

async function getUncachableGmailClient() {
  const accessToken = await getGmailAccessToken();
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });
  return google.gmail({ version: 'v1', auth: oauth2Client });
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

export default router;
