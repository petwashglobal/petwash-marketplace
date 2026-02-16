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
const RECAPTCHA_SECRET_KEY = (process.env.RECAPTCHA_SECRET_KEY || '').trim();
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'signinpetwash';

const verifySchema = z.object({
  token: z.string().min(1, { message: 'reCAPTCHA token is required' }),
  action: z.string().min(1, { message: 'Action is required' })
});

router.post('/verify', async (req, res) => {
  try {
    const validation = verifySchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        details: validation.error.errors
      });
    }

    const { token, action } = validation.data;

    if (!RECAPTCHA_SITE_KEY || !RECAPTCHA_SECRET_KEY) {
      logger.warn('[ReCaptcha] Keys not fully configured - passing through');
      return res.json({ success: true, score: 1.0, action });
    }

    const assessmentUrl = `https://recaptchaenterprise.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/assessments?key=${RECAPTCHA_SECRET_KEY}`;

    const response = await fetch(assessmentUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: {
          token,
          expectedAction: action,
          siteKey: RECAPTCHA_SITE_KEY,
        }
      }),
    });

    const result = await response.json();

    if (result.error) {
      logger.warn('[ReCaptcha Enterprise] API error:', { 
        code: result.error.code,
        message: result.error.message,
        status: result.error.status
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
      ip: req.ip
    });

    if (!tokenProperties.valid) {
      logger.warn('[ReCaptcha Enterprise] Invalid token:', {
        invalidReason: tokenProperties.invalidReason,
        ip: req.ip
      });

      return res.status(400).json({
        success: false,
        error: 'reCAPTCHA token invalid',
        reason: tokenProperties.invalidReason
      });
    }

    if (tokenProperties.action && tokenProperties.action !== action) {
      logger.warn('[ReCaptcha Enterprise] Action mismatch:', {
        expected: action,
        received: tokenProperties.action,
        ip: req.ip
      });
    }

    const minimumScore = 0.3;
    if (score < minimumScore) {
      logger.warn('[ReCaptcha Enterprise] Low score - possible bot:', { score, ip: req.ip });

      return res.status(400).json({
        success: false,
        error: 'Suspicious activity detected',
        score
      });
    }

    res.json({
      success: true,
      score,
      action: tokenProperties.action
    });

  } catch (error) {
    logger.error('[ReCaptcha Enterprise] Verification error:', error);
    res.json({
      success: true,
      score: 0.5,
      error: 'Verification service unavailable - allowing through'
    });
  }
});

async function legacySiteVerify(req: any, res: any, token: string, action: string) {
  try {
    const verifyUrl = 'https://www.google.com/recaptcha/api/siteverify';
    const params = new URLSearchParams({
      secret: RECAPTCHA_SECRET_KEY,
      response: token,
    });
    if (req.ip) params.append('remoteip', req.ip);

    const response = await fetch(verifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const result = await response.json();
    logger.info('[ReCaptcha Legacy] Verification result:', {
      success: result.success,
      score: result.score,
      action: result.action,
      ip: req.ip
    });

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'reCAPTCHA verification failed',
        errorCodes: result['error-codes'] || []
      });
    }

    const score = result.score ?? 1.0;
    return res.json({ success: true, score, action: result.action });
  } catch (err) {
    logger.error('[ReCaptcha Legacy] Fallback error:', err);
    return res.json({ success: true, score: 0.5 });
  }
}

router.get('/config', (_req, res) => {
  res.json({
    success: true,
    siteKey: RECAPTCHA_SITE_KEY,
    type: 'enterprise'
  });
});

export default router;
