import { Router } from 'express';
import { z } from 'zod';
import { logger } from '../lib/logger';

const router = Router();

function sanitizeKey(raw: string): string {
  if (!raw) return '';
  const match = raw.match(/6L[A-Za-z0-9_-]{38,}/);
  if (match) return match[0];
  return raw.trim();
}

const RECAPTCHA_SITE_KEY = sanitizeKey(process.env.VITE_RECAPTCHA_SITE_KEY || '');
const RECAPTCHA_API_KEY = (process.env.RECAPTCHA_SECRET_KEY || '').trim();
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'signinpetwash';

// ── Auth: prefer service account Bearer token, fall back to API key ───────────
// Uses the GOOGLE_APPLICATION_CREDENTIALS_JSON already configured in this project.
// This avoids needing a separate RECAPTCHA_SECRET_KEY / GCP API key.
async function getAssessmentAuthHeaders(): Promise<{ Authorization?: string; 'x-goog-api-key'?: string } | null> {
  const credsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;

  if (credsJson) {
    try {
      const { GoogleAuth } = await import('google-auth-library');
      const creds = JSON.parse(credsJson);
      const auth = new GoogleAuth({
        credentials: creds,
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      });
      const client = await auth.getClient();
      const tokenResponse = await (client as any).getAccessToken();
      const accessToken = tokenResponse?.token || tokenResponse;
      if (accessToken) {
        return { Authorization: `Bearer ${accessToken}` };
      }
    } catch (err: any) {
      logger.warn('[ReCaptcha] Service account auth failed, trying API key fallback', {
        error: err.message,
      });
    }
  }

  if (RECAPTCHA_API_KEY) {
    return { 'x-goog-api-key': RECAPTCHA_API_KEY };
  }

  return null;
}

const verifySchema = z.object({
  token: z.string().min(1, { message: 'reCAPTCHA token is required' }),
  action: z.string().min(1, { message: 'Action is required' }),
});

router.post('/verify', async (req, res) => {
  try {
    const validation = verifySchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        details: validation.error.errors,
      });
    }

    const { token, action } = validation.data;

    if (!RECAPTCHA_SITE_KEY) {
      logger.warn('[ReCaptcha] Site key not configured - passing through');
      return res.json({ success: true, score: 1.0, action });
    }

    const authHeaders = await getAssessmentAuthHeaders();
    if (!authHeaders) {
      logger.warn('[ReCaptcha] No auth available (no service account or API key) - passing through');
      return res.json({ success: true, score: 1.0, action });
    }

    // Build URL - use API key in query only for x-goog-api-key fallback path
    const assessmentUrl = `https://recaptchaenterprise.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/assessments`;

    const response = await fetch(assessmentUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify({
        event: {
          token,
          expectedAction: action,
          siteKey: RECAPTCHA_SITE_KEY,
        },
      }),
    });

    const result = await response.json();

    if (result.error) {
      logger.warn('[ReCaptcha Enterprise] API error:', {
        code: result.error.code,
        message: result.error.message,
        status: result.error.status,
      });
      logger.info('[ReCaptcha] Enterprise API error - allowing through to avoid blocking users');
      return res.json({ success: true, score: 0.5, action, fallback: true });
    }

    const tokenProperties = result.tokenProperties || {};
    const riskAnalysis = result.riskAnalysis || {};
    const score = riskAnalysis.score ?? 0.5;

    logger.info('[ReCaptcha Enterprise] Assessment result:', {
      valid: tokenProperties.valid,
      action: tokenProperties.action,
      score,
      reasons: riskAnalysis.reasons,
      ip: req.ip,
    });

    if (!tokenProperties.valid) {
      logger.warn('[ReCaptcha Enterprise] Invalid token:', {
        invalidReason: tokenProperties.invalidReason,
        ip: req.ip,
      });
      return res.status(400).json({
        success: false,
        error: 'reCAPTCHA token invalid',
        reason: tokenProperties.invalidReason,
      });
    }

    if (tokenProperties.action && tokenProperties.action !== action) {
      logger.warn('[ReCaptcha Enterprise] Action mismatch:', {
        expected: action,
        received: tokenProperties.action,
        ip: req.ip,
      });
    }

    const minimumScore = 0.3;
    if (score < minimumScore) {
      logger.warn('[ReCaptcha Enterprise] Low score - possible bot:', { score, ip: req.ip });
      return res.status(400).json({
        success: false,
        error: 'Suspicious activity detected',
        score,
      });
    }

    res.json({
      success: true,
      score,
      action: tokenProperties.action,
    });
  } catch (error) {
    logger.error('[ReCaptcha Enterprise] Verification error:', error);
    res.json({
      success: true,
      score: 0.5,
      error: 'Verification service unavailable - allowing through',
    });
  }
});

router.get('/config', (_req, res) => {
  res.json({
    success: true,
    siteKey: RECAPTCHA_SITE_KEY,
    type: 'enterprise',
    authMethod: process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON ? 'service_account' : 'api_key',
  });
});

export default router;
