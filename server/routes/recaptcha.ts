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
const RECAPTCHA_SECRET_KEY = sanitizeKey(process.env.RECAPTCHA_SECRET_KEY || '');
const GCP_API_KEY = (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || '').trim().startsWith('AIza')
  ? (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || '').trim()
  : '';
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'signinpetwash';

function detectAuthMethod(): string {
  const raw = (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || '').trim();
  if (raw.startsWith('AIza')) return 'gcp_api_key';
  if (raw.startsWith('{')) return 'service_account';
  if (RECAPTCHA_SECRET_KEY) return 'recaptcha_secret_key';
  return 'none';
}

async function getEnterpriseAuthHeaders(): Promise<{ Authorization?: string; 'x-goog-api-key'?: string } | null> {
  const raw = (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || '').trim();

  if (raw.startsWith('{')) {
    try {
      const { GoogleAuth } = await import('google-auth-library');
      const creds = JSON.parse(raw);
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
      logger.warn('[ReCaptcha] Service account auth failed', { error: err.message });
    }
  }

  if (GCP_API_KEY) {
    return { 'x-goog-api-key': GCP_API_KEY };
  }

  return null;
}

async function verifyWithEnterprise(
  token: string,
  action: string,
  authHeaders: Record<string, string>
): Promise<{ success: boolean; score?: number; reason?: string; source: 'enterprise' } | null> {
  try {
    const assessmentUrl = `https://recaptchaenterprise.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/assessments`;
    const response = await fetch(assessmentUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({
        event: { token, expectedAction: action, siteKey: RECAPTCHA_SITE_KEY },
      }),
    });

    const result = await response.json();

    if (result.error) {
      logger.warn('[ReCaptcha Enterprise] API error', {
        code: result.error.code,
        status: result.error.status,
        message: result.error.message,
      });
      return null;
    }

    const tokenProperties = result.tokenProperties || {};
    const riskAnalysis = result.riskAnalysis || {};
    const score: number = riskAnalysis.score ?? 0.5;

    logger.info('[ReCaptcha Enterprise] Assessment result', {
      valid: tokenProperties.valid,
      action: tokenProperties.action,
      score,
      reasons: riskAnalysis.reasons,
    });

    if (!tokenProperties.valid) {
      return { success: false, score, reason: tokenProperties.invalidReason, source: 'enterprise' };
    }

    if (score < 0.3) {
      return { success: false, score, reason: 'low_score', source: 'enterprise' };
    }

    return { success: true, score, source: 'enterprise' };
  } catch (err: any) {
    logger.warn('[ReCaptcha Enterprise] Request failed', { error: err.message });
    return null;
  }
}

async function verifyWithStandard(
  token: string
): Promise<{ success: boolean; score?: number; source: 'standard' } | null> {
  if (!RECAPTCHA_SECRET_KEY) return null;

  try {
    const params = new URLSearchParams({ secret: RECAPTCHA_SECRET_KEY, response: token });
    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const result = await response.json();

    logger.info('[ReCaptcha Standard] Verification result', {
      success: result.success,
      score: result.score,
      action: result.action,
      errorCodes: result['error-codes'],
    });

    if (!result.success) {
      const codes: string[] = result['error-codes'] || [];
      if (codes.includes('timeout-or-duplicate') || codes.includes('invalid-input-response')) {
        return { success: false, score: 0, source: 'standard' };
      }
      return null;
    }

    const score: number = result.score ?? 0.5;
    if (score < 0.3) {
      return { success: false, score, source: 'standard' };
    }

    return { success: true, score, source: 'standard' };
  } catch (err: any) {
    logger.warn('[ReCaptcha Standard] Request failed', { error: err.message });
    return null;
  }
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
      return res.json({ success: true, score: 1.0, action, source: 'bypass' });
    }

    const enterpriseAuth = await getEnterpriseAuthHeaders();

    if (enterpriseAuth) {
      const enterpriseResult = await verifyWithEnterprise(token, action, enterpriseAuth as Record<string, string>);
      if (enterpriseResult) {
        if (!enterpriseResult.success) {
          logger.warn('[ReCaptcha] Rejected by Enterprise', {
            score: enterpriseResult.score,
            reason: enterpriseResult.reason,
          });
          return res.status(400).json({
            success: false,
            error: enterpriseResult.reason === 'low_score'
              ? 'Suspicious activity detected'
              : 'reCAPTCHA token invalid',
            score: enterpriseResult.score,
            source: 'enterprise',
          });
        }
        return res.json({ success: true, score: enterpriseResult.score, action, source: 'enterprise' });
      }
      logger.info('[ReCaptcha] Enterprise auth configured but API unavailable, trying standard fallback');
    }

    const standardResult = await verifyWithStandard(token);
    if (standardResult) {
      if (!standardResult.success) {
        logger.warn('[ReCaptcha] Rejected by standard API', { score: standardResult.score });
        return res.status(400).json({
          success: false,
          error: 'reCAPTCHA verification failed',
          score: standardResult.score,
          source: 'standard',
        });
      }
      return res.json({ success: true, score: standardResult.score, action, source: 'standard' });
    }

    logger.warn('[ReCaptcha] Both Enterprise and standard verification unavailable - allowing through');
    return res.json({ success: true, score: 0.5, action, source: 'fallback' });
  } catch (error) {
    logger.error('[ReCaptcha] Verification error:', error);
    return res.json({ success: true, score: 0.5, source: 'error-fallback' });
  }
});

router.get('/config', (_req, res) => {
  const authMethod = detectAuthMethod();
  res.json({
    success: true,
    siteKey: RECAPTCHA_SITE_KEY,
    type: 'enterprise+standard',
    authMethod,
    hasGcpApiKey: !!GCP_API_KEY,
    hasRecaptchaSecret: !!RECAPTCHA_SECRET_KEY,
  });
});

export default router;
