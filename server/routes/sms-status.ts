import { Router, Request, Response } from 'express';
import { db } from '../db';
import { smsEvidence } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { logger } from '../lib/logger';

const router = Router();

router.post('/status', async (req: Request, res: Response) => {
  try {
    const {
      MessageSid,
      MessageStatus,
      To,
      ErrorCode,
      ErrorMessage,
    } = req.body;

    if (!MessageSid || !MessageStatus) {
      res.status(400).json({ error: 'Missing MessageSid or MessageStatus' });
      return;
    }

    const normalizedStatus = MessageStatus.toLowerCase();

    const updateData: Record<string, any> = {
      status: normalizedStatus,
    };

    if (normalizedStatus === 'delivered') {
      updateData.deliveredAt = new Date();
    }

    if (normalizedStatus === 'failed' || normalizedStatus === 'undelivered') {
      updateData.failureReason = ErrorMessage || ErrorCode || normalizedStatus;
    }

    await db
      .update(smsEvidence)
      .set(updateData)
      .where(eq(smsEvidence.providerMessageId, MessageSid));

    logger.info('[SMS Status] Delivery status updated', {
      messageSid: MessageSid,
      status: normalizedStatus,
      to: To ? To.slice(0, 6) + '****' : 'unknown',
      errorCode: ErrorCode || null,
    });

    res.status(200).send('OK');
  } catch (error: any) {
    logger.error('[SMS Status] Failed to process status callback', {
      error: error.message,
      body: req.body,
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
