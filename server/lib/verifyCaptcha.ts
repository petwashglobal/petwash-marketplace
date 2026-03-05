import { logger } from './logger';
import { GoogleAuth } from 'google-auth-library';

function sanitizeKey(raw: string): string {
  if (!raw) return '';
  const match = raw.match(/6L[A-Za-z0-9_-]{38,}/);
  if (match) return match[0];
  return raw.trim();
}

const RECAPTCHA_SECRET_KEY = sanitizeKey(process.env.RECAPTCHA_SECRET_KEY || '');
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'signinpetwash';

async function getEnterpriseAuth(): Promise<{ Authorization?: string } | null> {
  const saJson = (process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '').trim();
  const credsJson = (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || '').trim();
  const jsonToTry = saJson.startsWith('{') ? saJson : credsJson.startsWith('{') ? credsJson : '';
  if (!jsonToTry) return null;
  try {
    const creds = JSON.parse(jsonToTry);
    const auth = new GoogleAuth({ credentials: creds, scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
    const client = await auth.getClient();
    const tokenResponse = await (client as any).getAccessToken();
    const accessToken = tokenResponse?.token || tokenResponse;
    if (accessToken) return { Authorization: `Bearer ${accessToken}` };
  } catch (_) {}
  return null;
}

export interface CaptchaResult {
  valid: boolean;
  score: number;
  source: string;
  reason?: string;
}

export async function verifyCaptchaToken(token: string, action: string): Promise<CaptchaResult> {
  if (!token) return { valid: false, score: 0, source: 'missing', reason: 'No token provided' };

  const siteKey = sanitizeKey(
    process.env.RECAPTCHA_SITE_KEY ||
    process.env.VITE_RECAPTCHA_SITE_KEY ||
    ''
  );
  if (!siteKey) {
    logger.error('[verifyCaptcha] CRITICAL: No reCAPTCHA site key configured - blocking request (fail-closed)');
    return { valid: false, score: 0, source: 'misconfigured', reason: 'reCAPTCHA not configured on server' };
  }

  const enterpriseAuth = await getEnterpriseAuth();
  if (enterpriseAuth) {
    try {
      const url = `https://recaptchaenterprise.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/assessments`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...enterpriseAuth },
        body: JSON.stringify({ event: { token, siteKey, expectedAction: action } }),
      });
      if (resp.ok) {
        const data: any = await resp.json();
        const score: number = data?.riskAnalysis?.score ?? data?.score ?? 0;
        const reasons: string[] = data?.riskAnalysis?.reasons || [];
        const tokenValid: boolean = data?.tokenProperties?.valid === true;
        if (!tokenValid) return { valid: false, score: 0, source: 'enterprise', reason: 'invalid_token' };
        if (score < 0.3) return { valid: false, score, source: 'enterprise', reason: 'low_score' };
        return { valid: true, score, source: 'enterprise' };
      }
    } catch (err: any) {
      logger.warn('[verifyCaptcha] Enterprise call failed', { error: err.message });
    }
  }

  if (RECAPTCHA_SECRET_KEY) {
    try {
      const resp = await fetch('https://www.google.com/recaptcha/api/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `secret=${RECAPTCHA_SECRET_KEY}&response=${token}`,
      });
      if (resp.ok) {
        const data: any = await resp.json();
        const score: number = data.score ?? 0.5;
        if (!data.success) return { valid: false, score: 0, source: 'standard', reason: 'invalid_token' };
        if (score < 0.3) return { valid: false, score, source: 'standard', reason: 'low_score' };
        return { valid: true, score, source: 'standard' };
      }
    } catch (err: any) {
      logger.warn('[verifyCaptcha] Standard call failed', { error: err.message });
    }
  }

  logger.warn('[verifyCaptcha] Both verification methods unavailable - fail-closed for SMS');
  return { valid: false, score: 0, source: 'unavailable', reason: 'Verification service unavailable' };
}
