import { Router } from 'express';
import { google } from 'googleapis';
import { logger } from '../lib/logger';

const router = Router();

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

router.post('/send-welcome', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'email is required'
      });
    }

    const gmail = await getUncachableGmailClient();

    const welcomeEmailHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to ⁦Pet Wash™⁩</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);">
  <div style="max-width:600px;margin:40px auto;background:white;border-radius:20px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
    <div style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:40px;text-align:center;">
      <div style="font-size:48px;font-weight:bold;color:white;">⁦Pet Wash™⁩</div>
      <div style="color:rgba(255,255,255,0.9);font-size:16px;">The World's Leading Pet Care Ecosystem</div>
    </div>
    <div style="padding:40px;">
      <div style="font-size:32px;font-weight:bold;color:#1a202c;margin-bottom:20px;">Welcome to ⁦Pet Wash™⁩!</div>
      <p style="font-size:16px;color:#4a5568;line-height:1.6;">We're thrilled to have you join the ⁦Pet Wash™⁩ family! You now have access to our complete ecosystem of premium pet care platforms.</p>
      <div style="text-align:center;margin:30px 0;">
        <a href="https://petwash.co.il/dashboard" style="display:inline-block;padding:16px 40px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;text-decoration:none;border-radius:10px;font-weight:600;font-size:16px;">Explore Your Dashboard</a>
      </div>
    </div>
    <div style="background:#f7fafc;padding:30px;text-align:center;color:#718096;font-size:14px;">
      <p><strong>⁦Pet Wash™⁩ Ltd</strong></p>
      <p>Premium Organic Pet Care | Israel</p>
      <p style="margin-top:15px;font-size:12px;">
        This email was sent to ${email}<br>
        <a href="https://petwash.co.il/unsubscribe" style="color:#667eea;">Unsubscribe</a>
      </p>
    </div>
  </div>
</body>
</html>`;

    const rawMessage = [
      `To: ${email}`,
      `Subject: Welcome to ⁦Pet Wash™⁩!`,
      `Content-Type: text/html; charset=utf-8`,
      '',
      welcomeEmailHTML,
    ].join('\r\n');

    const encodedMessage = Buffer.from(rawMessage).toString('base64url');

    const result = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: encodedMessage },
    });

    logger.info('[Gmail Test] Welcome email sent', { email, messageId: result.data.id });

    res.json({
      success: true,
      message: 'Welcome email sent via Gmail',
      messageId: result.data.id,
    });

  } catch (error) {
    logger.error('[Gmail Test] Failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.get('/config', async (_req, res) => {
  try {
    await getGmailAccessToken();
    res.json({
      success: true,
      configuration: {
        connector: '✅ Connected via Replit',
        ready: true
      }
    });
  } catch {
    res.json({
      success: true,
      configuration: {
        connector: '❌ Not connected',
        ready: false
      }
    });
  }
});

export default router;
