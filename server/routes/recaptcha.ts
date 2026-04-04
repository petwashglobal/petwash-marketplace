import { Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { logger } from '../lib/logger';
import { verifyCaptchaToken } from '../lib/verifyCaptcha';
import { db } from '../db';
import { authEvents } from '@shared/schema';

const router = Router();

function sanitizeKey(raw: string): string {
  if (!raw) return '';
  const match = raw.match(/6L[A-Za-z0-9_-]{38,}/);
  if (match) return match[0];
  return raw.trim();
}

const RECAPTCHA_SITE_KEY = sanitizeKey(
  process.env.RECAPTCHA_SITE_KEY ||
  ''
);
const RECAPTCHA_SECRET_KEY = sanitizeKey(process.env.RECAPTCHA_SECRET_KEY || '');
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'signinpetwash';

const verifySchema = z.object({
  token: z.string().min(1, { message: 'reCAPTCHA token is required' }),
  action: z.string().min(1, { message: 'Action is required' }),
});

/**
 * POST /api/recaptcha/verify
 * Unified reCAPTCHA verification — delegates to server/lib/verifyCaptcha.ts.
 * Used by SecurityCheckpoint (provider signup) and any other frontend component
 * that calls verifyReCaptchaOnServer().
 *
 * In production: fail-closed — any verification infrastructure failure blocks the action.
 * In non-production: fail-open — allows testing without reCAPTCHA infra.
 */
router.post('/verify', async (req, res) => {
  const traceId = crypto.randomUUID();
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
    const callerIp = req.ip || (req.headers['x-forwarded-for'] as string) || 'unknown';

    const result = await verifyCaptchaToken(token, action);

    if (!result.valid) {
      logger.warn('[ReCaptcha] Rejected', {
        score: result.score,
        reason: result.reason,
        source: result.source,
        action,
        traceId,
      });

      db.insert(authEvents).values({
        eventType: 'CAPTCHA_PROVIDER_SIGNUP_FAILED',
        success: false,
        reason: `${result.reason || 'low_score'} (score=${result.score}, source=${result.source}, action=${action})`,
        ip: callerIp,
        userAgent: req.headers['user-agent'] || null,
        traceId,
      }).catch((dbErr: any) => logger.warn('[ReCaptcha] authEvents insert failed', { error: dbErr?.message }));

      return res.status(400).json({
        success: false,
        error: result.reason === 'low_score'
          ? 'Suspicious activity detected'
          : 'reCAPTCHA verification failed',
        score: result.score,
        source: result.source,
        traceId,
      });
    }

    return res.json({ success: true, score: result.score, action, source: result.source, traceId });
  } catch (error: any) {
    logger.error('[ReCaptcha] Verification error:', error);
    return res.status(500).json({ success: false, error: 'Verification service error', traceId });
  }
});

/**
 * GET /api/recaptcha/site-key
 * Returns the public reCAPTCHA site key for the frontend to use.
 */
router.get('/site-key', (_req, res) => {
  if (!RECAPTCHA_SITE_KEY) {
    return res.status(503).json({ error: 'reCAPTCHA site key not configured on server' });
  }
  res.json({ siteKey: RECAPTCHA_SITE_KEY });
});

/**
 * GET /api/recaptcha/config
 * Configuration status — for admin diagnostics.
 */
router.get('/config', (_req, res) => {
  res.json({
    success: true,
    siteKey: RECAPTCHA_SITE_KEY ? '✅ set' : '❌ missing',
    secretKey: RECAPTCHA_SECRET_KEY ? '✅ set' : '❌ missing',
    enterpriseProject: FIREBASE_PROJECT_ID,
    hasServiceAccount: !!(
      (process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '').trim().startsWith('{') ||
      (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || '').trim().startsWith('{')
    ),
    verificationService: 'unified (server/lib/verifyCaptcha.ts)',
    failOpenInProduction: 'disabled — all paths fail-closed',
    environment: process.env.NODE_ENV || 'development',
  });
});

/**
 * POST /api/recaptcha/check-score
 * Lightweight endpoint: evaluates a reCAPTCHA token and returns whether step-up is needed.
 * Used by the signup flow to detect suspicious scores BEFORE creating the Firebase account,
 * so the Turnstile widget can be shown early (avoids creating and then deleting Firebase users).
 */
const checkScoreSchema = z.object({
  captchaToken: z.string().min(1),
  action: z.string().default('check'),
});

router.post('/check-score', async (req, res) => {
  const parsed = checkScoreSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ valid: false, suspicious: false, score: 0, stepUpRequired: false, reason: 'invalid_request' });
  }
  const { captchaToken, action } = parsed.data;
  try {
    const result = await verifyCaptchaToken(captchaToken, action);
    return res.json({
      valid: result.valid,
      suspicious: result.suspicious ?? false,
      score: result.score,
      stepUpRequired: result.suspicious ?? false,
      source: result.source,
      reason: result.reason,
    });
  } catch (err: any) {
    logger.error('[ReCaptcha/check-score] Error', { error: err.message });
    return res.status(500).json({ valid: false, suspicious: false, score: 0, stepUpRequired: false, reason: 'service_error' });
  }
});

/**
 * GET /api/recaptcha/health
 * Health check — for admin diagnostics.
 */
router.get('/health', async (_req, res) => {
  const rawSuperAdminEmails = process.env.SUPER_ADMIN_EMAILS || '';
  const superAdminList = rawSuperAdminEmails.split(',').map(e => e.trim()).filter(Boolean);

  const status: Record<string, any> = {
    siteKey: RECAPTCHA_SITE_KEY ? '✅ set' : '❌ missing',
    secretKey: RECAPTCHA_SECRET_KEY ? '✅ set' : '❌ missing',
    enterpriseProject: FIREBASE_PROJECT_ID,
    verificationService: 'unified (server/lib/verifyCaptcha.ts)',
    environment: process.env.NODE_ENV || 'development',
    failOpenInProduction: 'disabled — production is fail-closed',
    hasServiceAccount: !!(
      (process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '').trim().startsWith('{') ||
      (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || '').trim().startsWith('{')
    ),
    superAdminEmailsConfigured: superAdminList.length > 0 ? '✅ set' : '❌ missing',
    superAdminEmailsCount: superAdminList.length,
  };
  res.json(status);
});

export default router;
