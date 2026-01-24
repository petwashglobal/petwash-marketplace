import { Router } from 'express';
import { z } from 'zod';
import { logger } from '../lib/logger';
import { RecaptchaEnterpriseServiceClient } from '@google-cloud/recaptcha-enterprise';

const router = Router();

const RECAPTCHA_SITE_KEY = process.env.VITE_FIREBASE_APPCHECK_SITE_KEY || process.env.RECAPTCHA_ENTERPRISE_SITE_KEY || '';
const PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID || 'signinpetwash';

const verifySchema = z.object({
  token: z.string().min(1, { message: 'reCAPTCHA token is required' }),
  action: z.string().min(1, { message: 'Action is required' })
});

/**
 * POST /api/recaptcha/verify
 * Verify reCAPTCHA Enterprise token using Google Cloud Assessment API
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

    logger.info('[ReCaptcha Enterprise] Verifying token for action:', action);

    const client = new RecaptchaEnterpriseServiceClient();
    const projectPath = client.projectPath(PROJECT_ID);

    const request = {
      assessment: {
        event: {
          token: token,
          siteKey: RECAPTCHA_SITE_KEY,
        },
      },
      parent: projectPath,
    };

    const [response] = await client.createAssessment(request);

    if (!response.tokenProperties?.valid) {
      const reason = response.tokenProperties?.invalidReason || 'UNKNOWN';
      logger.warn('[ReCaptcha Enterprise] Invalid token:', { reason, ip: req.ip });
      
      await client.close();
      return res.status(400).json({
        success: false,
        error: 'reCAPTCHA verification failed',
        reason
      });
    }

    if (response.tokenProperties?.action !== action) {
      logger.warn('[ReCaptcha Enterprise] Action mismatch:', {
        expected: action,
        received: response.tokenProperties?.action,
        ip: req.ip
      });
      
      await client.close();
      return res.status(400).json({
        success: false,
        error: 'Action mismatch'
      });
    }

    const score = response.riskAnalysis?.score ?? 0;
    const reasons = response.riskAnalysis?.reasons || [];
    
    logger.info('[ReCaptcha Enterprise] Assessment result:', {
      score,
      reasons,
      action: response.tokenProperties?.action,
      ip: req.ip
    });

    const minimumScore = 0.5;
    if (score < minimumScore) {
      logger.warn('[ReCaptcha Enterprise] Low score:', { score, reasons, ip: req.ip });
      
      await client.close();
      return res.status(400).json({
        success: false,
        error: 'Suspicious activity detected',
        score
      });
    }

    await client.close();
    
    res.json({
      success: true,
      score,
      reasons,
      action: response.tokenProperties?.action
    });

  } catch (error) {
    logger.error('[ReCaptcha Enterprise] Verification error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during verification'
    });
  }
});

/**
 * GET /api/recaptcha/config
 * Get reCAPTCHA Enterprise site key for frontend
 */
router.get('/config', (req, res) => {
  res.json({
    success: true,
    siteKey: RECAPTCHA_SITE_KEY,
    type: 'enterprise'
  });
});

export default router;
