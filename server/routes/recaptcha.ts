import { Router } from 'express';
import { z } from 'zod';
import { logger } from '../lib/logger';

const router = Router();

const RECAPTCHA_SECRET_KEY = process.env.RECAPTCHA_SECRET_KEY || '';

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

    if (!RECAPTCHA_SECRET_KEY) {
      logger.warn('[ReCaptcha] No secret key configured - passing through');
      return res.json({ success: true, score: 1.0, action });
    }

    const verifyUrl = 'https://www.google.com/recaptcha/api/siteverify';
    const params = new URLSearchParams({
      secret: RECAPTCHA_SECRET_KEY,
      response: token,
    });

    if (req.ip) {
      params.append('remoteip', req.ip);
    }

    const response = await fetch(verifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const result = await response.json();

    logger.info('[ReCaptcha] Verification result:', {
      success: result.success,
      score: result.score,
      action: result.action,
      ip: req.ip
    });

    if (!result.success) {
      const errorCodes = result['error-codes'] || [];
      logger.warn('[ReCaptcha] Verification failed:', { errorCodes, ip: req.ip });

      return res.status(400).json({
        success: false,
        error: 'reCAPTCHA verification failed',
        errorCodes
      });
    }

    if (result.action && result.action !== action) {
      logger.warn('[ReCaptcha] Action mismatch:', {
        expected: action,
        received: result.action,
        ip: req.ip
      });
    }

    const score = result.score ?? 1.0;
    const minimumScore = 0.3;

    if (score < minimumScore) {
      logger.warn('[ReCaptcha] Low score - possible bot:', { score, ip: req.ip });

      return res.status(400).json({
        success: false,
        error: 'Suspicious activity detected',
        score
      });
    }

    res.json({
      success: true,
      score,
      action: result.action
    });

  } catch (error) {
    logger.error('[ReCaptcha] Verification error:', error);
    res.json({
      success: true,
      score: 0.5,
      error: 'Verification service unavailable - allowing through'
    });
  }
});

router.get('/config', (_req, res) => {
  res.json({
    success: true,
    siteKey: process.env.VITE_RECAPTCHA_SITE_KEY || '',
    type: 'v3'
  });
});

export default router;
