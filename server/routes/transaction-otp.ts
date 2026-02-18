import { Router, type Request, type Response } from 'express';
import { transactionOTPService, type TransactionType } from '../services/TransactionOTPService';
import { logger } from '../lib/logger';
import { z } from 'zod';

const router = Router();

const sendOTPSchema = z.object({
  transactionType: z.enum([
    'egift_purchase', 'wallet_topup', 'payment_method_change',
    'large_booking', 'loyalty_redemption', 'password_change',
    'email_change', 'provider_payout', 'bank_details_change',
    'profile_phone_change',
  ]),
  amount: z.string().optional(),
  currency: z.string().optional(),
  language: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const verifyOTPSchema = z.object({
  sessionId: z.string().uuid(),
  code: z.string().length(6),
  language: z.string().optional(),
});

const validateTokenSchema = z.object({
  transactionToken: z.string().min(1),
});

router.post('/send', async (req: Request, res: Response) => {
  try {
    const parsed = sendOTPSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'Invalid request data',
        details: parsed.error.flatten(),
      });
    }

    const userId = (req as any).userId || (req as any).user?.uid;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'unauthorized', message: 'Authentication required' });
    }

    const ip = req.ip || req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() || '';

    const result = await transactionOTPService.sendTransactionOTP({
      userId,
      transactionType: parsed.data.transactionType as TransactionType,
      amount: parsed.data.amount,
      currency: parsed.data.currency,
      language: parsed.data.language,
      ip,
      metadata: parsed.data.metadata,
    });

    const status = result.success ? 200 : (result.error === 'rate_limited_ip' || result.error === 'rate_limited_user' || result.error === 'rate_limited_phone' || result.error === 'cooldown_active' ? 429 : 400);

    res.status(status).json(result);
  } catch (error: any) {
    logger.error('[TransactionOTP Route] Send error', error);
    res.status(500).json({ success: false, error: 'internal_error', message: 'An unexpected error occurred' });
  }
});

router.post('/verify', async (req: Request, res: Response) => {
  try {
    const parsed = verifyOTPSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'Invalid request data',
        details: parsed.error.flatten(),
      });
    }

    const userId = (req as any).userId || (req as any).user?.uid;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'unauthorized', message: 'Authentication required' });
    }

    const result = await transactionOTPService.verifyTransactionOTP({
      userId,
      sessionId: parsed.data.sessionId,
      code: parsed.data.code,
      language: parsed.data.language,
    });

    const status = result.success ? 200 : (result.error === 'too_many_attempts' ? 429 : 400);

    res.status(status).json(result);
  } catch (error: any) {
    logger.error('[TransactionOTP Route] Verify error', error);
    res.status(500).json({ success: false, error: 'internal_error', message: 'An unexpected error occurred' });
  }
});

router.post('/validate-token', async (req: Request, res: Response) => {
  try {
    const parsed = validateTokenSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'validation_error', message: 'Invalid token' });
    }

    const result = await transactionOTPService.validateTransactionToken(parsed.data.transactionToken);

    res.json({ success: result.valid, ...result });
  } catch (error: any) {
    logger.error('[TransactionOTP Route] Token validation error', error);
    res.status(500).json({ success: false, error: 'internal_error' });
  }
});

router.get('/session/:sessionId', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || (req as any).user?.uid;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'unauthorized' });
    }

    const result = await transactionOTPService.getSessionStatus(userId, req.params.sessionId);
    res.json({ success: true, ...result });
  } catch (error: any) {
    logger.error('[TransactionOTP Route] Session status error', error);
    res.status(500).json({ success: false, error: 'internal_error' });
  }
});

router.get('/transaction-types', async (_req: Request, res: Response) => {
  try {
    const types = transactionOTPService.getTransactionTypes();
    res.json({ success: true, types });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'internal_error' });
  }
});

export default router;
