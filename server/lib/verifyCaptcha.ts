import { logger } from './logger';
import { GoogleAuth } from 'google-auth-library';

// ─── Key sanitisers ───────────────────────────────────────────────────────────

function sanitizeKey(raw: string): string {
  if (!raw) return '';
  const match = raw.match(/6L[A-Za-z0-9_-]{38,}/);
  if (match) return match[0];
  return raw.trim();
}

function extractGcpApiKey(raw: string): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  return trimmed.startsWith('AIza') ? trimmed : '';
}

// ─── Config (resolved once at startup) ───────────────────────────────────────

const RECAPTCHA_PROJECT_ID =
  (process.env.RECAPTCHA_GCP_PROJECT_ID || '').trim() ||
  (process.env.FIREBASE_PROJECT_ID || '').trim() ||
  'signinpetwash';

const RECAPTCHA_GCP_API_KEY =
  extractGcpApiKey(process.env.RECAPTCHA_GCP_API_KEY || '') ||
  extractGcpApiKey(process.env.GOOGLE_API_KEY || '') ||
  extractGcpApiKey(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || '') ||
  '';

// Standard reCAPTCHA v3 secret — used as fallback when Enterprise is unavailable
const RECAPTCHA_SECRET_KEY = sanitizeKey(process.env.RECAPTCHA_SECRET_KEY || '');

const RECAPTCHA_SITE_KEY = sanitizeKey(
  process.env.RECAPTCHA_SITE_KEY ||
  process.env.VITE_RECAPTCHA_SITE_KEY ||
  ''
);

logger.info('[verifyCaptcha] Config', {
  recaptchaProject: RECAPTCHA_PROJECT_ID,
  hasDedicatedApiKey: !!extractGcpApiKey(process.env.RECAPTCHA_GCP_API_KEY || ''),
  hasFallbackApiKey: !!RECAPTCHA_GCP_API_KEY,
  hasStandardSecret: !!RECAPTCHA_SECRET_KEY,
  siteKey: RECAPTCHA_SITE_KEY.slice(0, 12) + '...',
});

// ─── Auth resolution ──────────────────────────────────────────────────────────

type EnterpriseAuthMode =
  | { type: 'oauth'; headers: Record<string, string>; source: string }
  | { type: 'apikey'; key: string; source: string }
  | null;

async function getEnterpriseAuth(): Promise<EnterpriseAuthMode> {
  const saCandidates = [
    { raw: process.env.RECAPTCHA_SERVICE_ACCOUNT_JSON || '', label: 'RECAPTCHA_SERVICE_ACCOUNT_JSON' },
    { raw: process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '', label: 'FIREBASE_SERVICE_ACCOUNT_KEY' },
    { raw: process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '', label: 'GOOGLE_SERVICE_ACCOUNT_JSON' },
    { raw: process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || '', label: 'GOOGLE_APPLICATION_CREDENTIALS_JSON' },
  ];

  for (const { raw, label } of saCandidates) {
    const trimmed = raw.trim();
    if (!trimmed.startsWith('{')) continue;
    try {
      const creds = JSON.parse(trimmed);
      const auth = new GoogleAuth({
        credentials: creds,
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      });
      const client = await auth.getClient();
      const tokenResponse = await (client as any).getAccessToken();
      const accessToken = tokenResponse?.token || tokenResponse;
      if (accessToken) {
        logger.info('[verifyCaptcha] SA auth obtained', { source: label });
        return { type: 'oauth', headers: { Authorization: `Bearer ${accessToken}` }, source: label };
      }
    } catch (err: any) {
      logger.debug('[verifyCaptcha] SA candidate failed', { label, error: err.message });
    }
  }

  if (RECAPTCHA_GCP_API_KEY) {
    const isDedicated = !!extractGcpApiKey(process.env.RECAPTCHA_GCP_API_KEY || '');
    return {
      type: 'apikey',
      key: RECAPTCHA_GCP_API_KEY,
      source: isDedicated ? 'RECAPTCHA_GCP_API_KEY' : 'GOOGLE_API_KEY-fallback',
    };
  }

  return null;
}

// ─── Enterprise API call ──────────────────────────────────────────────────────

async function callEnterpriseApi(
  auth: EnterpriseAuthMode,
  token: string,
  siteKey: string,
  action: string
): Promise<Response | null> {
  if (!auth) return null;

  const baseUrl = `https://recaptchaenterprise.googleapis.com/v1/projects/${RECAPTCHA_PROJECT_ID}/assessments`;
  const body = JSON.stringify({ event: { token, siteKey, expectedAction: action } });

  if (auth.type === 'oauth') {
    return fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...auth.headers },
      body,
    });
  }

  return fetch(`${baseUrl}?key=${auth.key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
}

// ─── Standard v3 fallback ─────────────────────────────────────────────────────

async function verifyWithStandardV3(token: string): Promise<CaptchaResult | null> {
  if (!RECAPTCHA_SECRET_KEY) return null;
  try {
    const params = new URLSearchParams({ secret: RECAPTCHA_SECRET_KEY, response: token });
    const resp = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    if (!resp.ok) return null;
    const data: any = await resp.json();
    const score: number = data.score ?? 0.5;
    logger.info('[verifyCaptcha] Standard v3 fallback result', {
      success: data.success,
      score,
      action: data.action,
      errorCodes: data['error-codes'],
    });
    if (!data.success) {
      const codes: string[] = data['error-codes'] || [];
      // timeout-or-duplicate / invalid-input-response = definitely bad token
      if (codes.includes('timeout-or-duplicate') || codes.includes('invalid-input-response')) {
        return { valid: false, score: 0, source: 'standard-v3', reason: codes[0] };
      }
      // hostname-mismatch in standard means domain not registered — fail-open with warning
      if (codes.includes('invalid-input-secret')) {
        logger.error('[verifyCaptcha] Standard v3 secret key invalid — check RECAPTCHA_SECRET_KEY');
        return null;
      }
      // Other unknown errors — fall through to fail-open
      return null;
    }
    if (score < 0.3) {
      return { valid: false, score, source: 'standard-v3', reason: 'low_score' };
    }
    return { valid: true, score, source: 'standard-v3' };
  } catch (err: any) {
    logger.warn('[verifyCaptcha] Standard v3 fallback threw', { error: err.message });
    return null;
  }
}

// ─── Public interface ─────────────────────────────────────────────────────────

export interface CaptchaResult {
  valid: boolean;
  score: number;
  source: string;
  reason?: string;
}

export async function verifyCaptchaToken(token: string, action: string): Promise<CaptchaResult> {
  // 1. Missing token — hard block regardless of everything else
  if (!token) return { valid: false, score: 0, source: 'missing', reason: 'No token provided' };

  // 2. Dev-only bypass token
  if (token === 'bypass') {
    if (process.env.NODE_ENV !== 'production') {
      logger.warn('[verifyCaptcha] Bypass token accepted (non-production only)', { action });
      return { valid: true, score: 0.9, source: 'bypass-dev' };
    }
    logger.warn('[verifyCaptcha] Bypass token rejected in production', { action });
    return { valid: false, score: 0, source: 'bypass', reason: 'Bypass not permitted in production' };
  }

  const siteKey = RECAPTCHA_SITE_KEY;
  if (!siteKey) {
    logger.error('[verifyCaptcha] CRITICAL: No reCAPTCHA site key configured — failing open to prevent user lockout');
    return { valid: true, score: 0.5, source: 'misconfigured-failopen', reason: 'reCAPTCHA site key not configured' };
  }

  // 3. Try Enterprise path first
  const enterpriseAuth = await getEnterpriseAuth();

  if (enterpriseAuth) {
    try {
      const resp = await callEnterpriseApi(enterpriseAuth, token, siteKey, action);

      if (resp && resp.ok) {
        const data: any = await resp.json();
        const score: number = data?.riskAnalysis?.score ?? data?.score ?? 0;
        const tokenValid: boolean = data?.tokenProperties?.valid === true;
        const errorCode: string = data?.tokenProperties?.invalidReason || '';

        logger.info('[verifyCaptcha] Enterprise assessment', {
          authSource: enterpriseAuth.source,
          project: RECAPTCHA_PROJECT_ID,
          score,
          tokenValid,
          errorCode: errorCode || 'none',
          action,
          assessmentName: data?.name?.split('/').pop(),
        });

        if (!tokenValid) {
          // Dev: DNSNAME_MISMATCH is expected on Replit domain
          if (process.env.NODE_ENV !== 'production' &&
              (errorCode === 'DNSNAME_MISMATCH' || errorCode === '' || !errorCode)) {
            logger.warn('[verifyCaptcha] Dev DNSNAME_MISMATCH bypass active', { errorCode });
            return { valid: true, score: 0.7, source: `enterprise-${enterpriseAuth.type}-dev` };
          }
          // Production DNSNAME_MISMATCH = domain not registered in reCAPTCHA console
          // Fall through to standard v3 fallback rather than hard-blocking all users
          if (errorCode === 'DNSNAME_MISMATCH') {
            logger.error('[verifyCaptcha] DNSNAME_MISMATCH in production — petwash.co.il may not be registered in reCAPTCHA console. Falling back to standard v3.');
          } else {
            return { valid: false, score: 0, source: `enterprise-${enterpriseAuth.type}`, reason: errorCode || 'invalid_token' };
          }
        } else {
          // Token is valid — check score
          if (score < 0.3) {
            return { valid: false, score, source: `enterprise-${enterpriseAuth.type}`, reason: 'low_score' };
          }
          return { valid: true, score, source: `enterprise-${enterpriseAuth.type}` };
        }
      } else if (resp) {
        const errText = await resp.text().catch(() => '');
        const errData = (() => { try { return JSON.parse(errText); } catch { return {}; } })();
        const errMsg = errData?.error?.message || errText.slice(0, 150);

        if (resp.status === 400 && errMsg.includes('siteKey')) {
          logger.error('[verifyCaptcha] FATAL: siteKey not found in project — wrong GCP project', {
            recaptchaProject: RECAPTCHA_PROJECT_ID,
            siteKeyPrefix: siteKey.slice(0, 12),
            authSource: enterpriseAuth.source,
            fix: 'Set RECAPTCHA_GCP_PROJECT_ID to the GCP project ID that owns this reCAPTCHA key',
          });
          // Fall through to standard v3 rather than hard-blocking
        } else if (resp.status === 403) {
          logger.error('[verifyCaptcha] 403 — service account lacks recaptchaenterprise.agent role', {
            authSource: enterpriseAuth.source,
            fix: 'Grant roles/recaptchaenterprise.agent to the service account in GCP IAM',
          });
          // Fall through to standard v3 rather than hard-blocking
        } else {
          logger.warn('[verifyCaptcha] Enterprise API HTTP error', {
            status: resp.status,
            error: errMsg,
            authSource: enterpriseAuth.source,
          });
          // Fall through to standard v3
        }
      }
    } catch (err: any) {
      logger.error('[verifyCaptcha] Enterprise call threw exception', {
        error: err.message,
        authSource: enterpriseAuth.source,
      });
      // Fall through to standard v3
    }
  } else {
    logger.error('[verifyCaptcha] No Enterprise credentials available — trying standard v3 fallback', {
      hint: 'Set RECAPTCHA_GCP_API_KEY or grant roles/recaptchaenterprise.agent to the service account',
    });
  }

  // 4. Standard v3 fallback
  const standardResult = await verifyWithStandardV3(token);
  if (standardResult !== null) {
    logger.info('[verifyCaptcha] Standard v3 fallback used', { valid: standardResult.valid, score: standardResult.score, action });
    return standardResult;
  }

  // 5. Both Enterprise and standard v3 unavailable — fail-open with critical log
  // This prevents user lockout when Google's infrastructure is unreachable.
  // The token WAS present (checked in step 1), so the user passed the first gate.
  logger.error('[verifyCaptcha] CRITICAL: Both Enterprise and standard v3 unavailable — failing open to prevent user lockout', {
    action,
    enterpriseAuthAvailable: !!enterpriseAuth,
    standardKeyAvailable: !!RECAPTCHA_SECRET_KEY,
  });
  return { valid: true, score: 0.5, source: 'infra-failopen', reason: 'verification_infrastructure_unavailable' };
}
