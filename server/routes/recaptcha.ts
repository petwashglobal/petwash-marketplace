import { Router } from 'express';
import { z } from 'zod';
import { logger } from '../lib/logger';

const router = Router();

// reCAPTCHA verification schema
const verifySchema = z.object({
  token: z.string().min(1, { message: 'reCAPTCHA token is required' }),
  action: z.string().optional() // For reCAPTCHA v3
});

/**
 * POST /api/recaptcha/verify
 * Verify reCAPTCHA token on the server
 * This protects signin, payment, and other sensitive forms from bots
 */
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
    const secretKey = process.env.RECAPTCHA_SECRET_KEY;

    if (!secretKey) {
      logger.error('[ReCaptcha] RECAPTCHA_SECRET_KEY not configured');
      return res.status(500).json({
        success: false,
        error: 'reCAPTCHA not configured on server'
      });
    }

    // Verify token with Google reCAPTCHA API
    const verifyUrl = 'https://www.google.com/recaptcha/api/siteverify';
    const params = new URLSearchParams({
      secret: secretKey,
      response: token,
      remoteip: req.ip || req.socket.remoteAddress || ''
    });

    logger.info('[ReCaptcha] Verifying token from IP:', req.ip);

    const response = await fetch(verifyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    const data = await response.json() as {
      success: boolean;
      challenge_ts?: string;
      hostname?: string;
      score?: number;
      action?: string;
      'error-codes'?: string[];
    };

    if (!data.success) {
      logger.warn('[ReCaptcha] Verification failed:', {
        errors: data['error-codes'],
        ip: req.ip
      });

      return res.status(400).json({
        success: false,
        error: 'reCAPTCHA verification failed',
        errors: data['error-codes']
      });
    }

    // For reCAPTCHA v3, check the score (0.0 to 1.0, higher is more human-like)
    if (data.score !== undefined) {
      const minimumScore = 0.5; // Adjust based on your needs
      if (data.score < minimumScore) {
        logger.warn('[ReCaptcha] Low score detected:', {
          score: data.score,
          action: data.action,
          ip: req.ip
        });

        return res.status(400).json({
          success: false,
          error: 'Suspicious activity detected',
          score: data.score
        });
      }

      logger.info('[ReCaptcha] Verification successful:', {
        score: data.score,
        action: data.action,
        hostname: data.hostname
      });
    } else {
      logger.info('[ReCaptcha] Verification successful (v2):', {
        hostname: data.hostname,
        challenge_ts: data.challenge_ts
      });
    }

    res.json({
      success: true,
      score: data.score,
      action: data.action,
      hostname: data.hostname
    });

  } catch (error) {
    logger.error('[ReCaptcha] Verification error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during verification'
    });
  }
});

/**
 * GET /api/recaptcha/config
 * Get reCAPTCHA site key for frontend
 */
router.get('/config', (req, res) => {
  const siteKey = process.env.VITE_RECAPTCHA_SITE_KEY;
  
  if (!siteKey) {
    return res.status(500).json({
      success: false,
      error: 'reCAPTCHA not configured'
    });
  }

  res.json({
    success: true,
    siteKey
  });
});

export default router;
