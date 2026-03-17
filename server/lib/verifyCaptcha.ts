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

// The GCP project that OWNS the reCAPTCHA Enterprise key.
// This is NOT necessarily the same as FIREBASE_PROJECT_ID.
// Set RECAPTCHA_GCP_PROJECT_ID explicitly if they differ.
const RECAPTCHA_PROJECT_ID =
  (process.env.RECAPTCHA_GCP_PROJECT_ID || '').trim() ||
  (process.env.FIREBASE_PROJECT_ID || '').trim() ||
  'signinpetwash';

// Dedicated API key from the reCAPTCHA project (preferred for Enterprise).
// Create it in GCP Console → the project that owns 6LfPr3ks... → APIs & Services
// → Credentials → Create API key → restrict to reCAPTCHA Enterprise API.
const RECAPTCHA_GCP_API_KEY =
  extractGcpApiKey(process.env.RECAPTCHA_GCP_API_KEY || '') ||
  extractGcpApiKey(process.env.GOOGLE_API_KEY || '') ||
  extractGcpApiKey(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || '') ||
  '';

// Log startup config (non-secret)
logger.info('[verifyCaptcha] Config', {
  recaptchaProject: RECAPTCHA_PROJECT_ID,
  hasDedicatedApiKey: !!extractGcpApiKey(process.env.RECAPTCHA_GCP_API_KEY || ''),
  hasFallbackApiKey: !!RECAPTCHA_GCP_API_KEY,
  siteKey: sanitizeKey(process.env.RECAPTCHA_SITE_KEY || process.env.VITE_RECAPTCHA_SITE_KEY || '').slice(0, 12) + '...',
});

// ─── Auth resolution ──────────────────────────────────────────────────────────

type EnterpriseAuthMode =
  | { type: 'oauth'; headers: Record<string, string>; source: string }
  | { type: 'apikey'; key: string; source: string }
  | null;

async function getEnterpriseAuth(): Promise<EnterpriseAuthMode> {
  // 1. Service account JSON — try in priority order:
  //    RECAPTCHA_SERVICE_ACCOUNT_JSON  (dedicated)
  //    FIREBASE_SERVICE_ACCOUNT_KEY    (Firebase SA — works if it has recaptchaenterprise.agent role)
  //    GOOGLE_SERVICE_ACCOUNT_JSON     (legacy name)
  //    GOOGLE_APPLICATION_CREDENTIALS_JSON (only if it's actually JSON, not an API key)
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

  // 2. GCP API key (must be from the project that owns the reCAPTCHA key)
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

// ─── Public interface ─────────────────────────────────────────────────────────

export interface CaptchaResult {
  valid: boolean;
  score: number;
  source: string;
  reason?: string;
}

export async function verifyCaptchaToken(token: string, action: string): Promise<CaptchaResult> {
  if (!token) return { valid: false, score: 0, source: 'missing', reason: 'No token provided' };

  // Dev-only bypass token
  if (token === 'bypass') {
    if (process.env.NODE_ENV !== 'production') {
      logger.warn('[verifyCaptcha] Bypass token accepted (non-production only)', { action });
      return { valid: true, score: 0.9, source: 'bypass-dev' };
    }
    logger.warn('[verifyCaptcha] Bypass token rejected in production', { action });
    return { valid: false, score: 0, source: 'bypass', reason: 'Bypass not permitted in production' };
  }

  const siteKey = sanitizeKey(
    process.env.RECAPTCHA_SITE_KEY ||
    process.env.VITE_RECAPTCHA_SITE_KEY ||
    ''
  );
  if (!siteKey) {
    logger.error('[verifyCaptcha] CRITICAL: No reCAPTCHA site key configured');
    return { valid: false, score: 0, source: 'misconfigured', reason: 'reCAPTCHA not configured on server' };
  }

  // ── Enterprise path (only path for Enterprise keys) ──────────────────────────
  const enterpriseAuth = await getEnterpriseAuth();

  if (!enterpriseAuth) {
    logger.error('[verifyCaptcha] CRITICAL: No Enterprise credentials available', {
      hint: 'Set RECAPTCHA_GCP_API_KEY (from the GCP project that owns the reCAPTCHA key) ' +
            'OR grant firebase-adminsdk-fbsvc@signinpetwash.iam.gserviceaccount.com ' +
            'the roles/recaptchaenterprise.agent role in the correct GCP project',
    });
    return { valid: false, score: 0, source: 'unavailable', reason: 'Enterprise credentials not configured' };
  }

  try {
    const resp = await callEnterpriseApi(enterpriseAuth, token, siteKey, action);

    if (!resp) {
      logger.error('[verifyCaptcha] Enterprise API returned null response');
      return { valid: false, score: 0, source: 'unavailable', reason: 'Enterprise API unreachable' };
    }

    if (!resp.ok) {
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
        return { valid: false, score: 0, source: 'misconfigured', reason: 'siteKey_project_mismatch' };
      }

      if (resp.status === 403) {
        logger.error('[verifyCaptcha] FATAL: 403 — service account lacks recaptchaenterprise.agent role', {
          authSource: enterpriseAuth.source,
          fix: 'Grant roles/recaptchaenterprise.agent to the service account in GCP IAM',
        });
        return { valid: false, score: 0, source: 'misconfigured', reason: 'insufficient_permissions' };
      }

      logger.warn('[verifyCaptcha] Enterprise API error', {
        status: resp.status,
        error: errMsg,
        authSource: enterpriseAuth.source,
      });
      return { valid: false, score: 0, source: `enterprise-error-${resp.status}`, reason: errMsg };
    }

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
      // In dev/Replit: DNSNAME_MISMATCH is expected (Replit domain bypass)
      if (
        process.env.NODE_ENV !== 'production' &&
        (errorCode === 'DNSNAME_MISMATCH' || errorCode === '' || !errorCode)
      ) {
        logger.warn('[verifyCaptcha] Dev DNSNAME_MISMATCH bypass active — add *.replit.dev to reCAPTCHA domains to remove', { errorCode });
        return { valid: true, score: 0.7, source: `enterprise-${enterpriseAuth.type}-dev` };
      }
      return { valid: false, score: 0, source: `enterprise-${enterpriseAuth.type}`, reason: errorCode || 'invalid_token' };
    }

    if (score < 0.3) {
      return { valid: false, score, source: `enterprise-${enterpriseAuth.type}`, reason: 'low_score' };
    }

    return { valid: true, score, source: `enterprise-${enterpriseAuth.type}` };

  } catch (err: any) {
    logger.error('[verifyCaptcha] Enterprise call threw exception', {
      error: err.message,
      authSource: enterpriseAuth.source,
    });
    return { valid: false, score: 0, source: 'exception', reason: err.message };
  }
}
