import { Router, Request, Response, NextFunction } from 'express';
import express from 'express';
import twilio from 'twilio';
import { db } from '../db';
import { smsEvidence, otpEvents } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { logger } from '../lib/logger';

const router = Router();

// ── Twilio carrier error code table ─────────────────────────────────────────
// Reference: https://www.twilio.com/docs/api/errors
const TWILIO_ERROR_CODES: Record<string, string> = {
  '30001': 'Queue overflow — too many messages queued',
  '30002': 'Account suspended',
  '30003': 'Destination handset unreachable (off or no coverage)',
  '30004': 'Message blocked by carrier',
  '30005': 'Unknown destination handset',
  '30006': 'Landline or non-SMS-capable number',
  '30007': 'Message filtered by carrier — likely content or sender policy violation',
  '30008': 'Unknown error from carrier',
  '30009': 'Missing segment — partial delivery failure',
  '30010': 'Message price exceeds maximum configured price',
  '30034': 'AU carrier rejection — US/unregistered sender blocked; add AU (+61) number to Messaging Service sender pool',
  '30036': 'Carrier spam or content filter triggered',
  '21211': 'Invalid phone number (not E.164 format)',
  '21614': 'Not a mobile number — cannot receive SMS',
};

function interpretCarrierError(code: string | undefined): string | null {
  if (!code) return null;
  return TWILIO_ERROR_CODES[String(code)] || `Unrecognised Twilio error code: ${code}`;
}

// ── Twilio body parser ───────────────────────────────────────────────────────
// Twilio sends status callbacks as application/x-www-form-urlencoded.
// Must be parsed BEFORE signature validation (validation uses req.body).
router.use(express.urlencoded({ extended: false }));

// ── Twilio request signature validator ───────────────────────────────────────
// Validates the X-Twilio-Signature header to confirm the request came from
// Twilio, not a spoofed external party.
// Spec: https://www.twilio.com/docs/usage/webhooks/webhooks-security
function validateTwilioSignature(req: Request, res: Response, next: NextFunction) {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    logger.warn('[SMSStatus] TWILIO_AUTH_TOKEN not configured — skipping signature check (DEV ONLY)');
    return next();
  }

  const signature = req.headers['x-twilio-signature'] as string | undefined;
  if (!signature) {
    logger.warn('[SMSStatus] Request missing X-Twilio-Signature — rejected');
    return res.status(403).send('Forbidden');
  }

  // Build the full URL exactly as Twilio signed it.
  // Cloud Run sits behind a load balancer — use x-forwarded-* headers.
  const proto  = (req.headers['x-forwarded-proto']  as string | undefined) || req.protocol || 'https';
  const host   = (req.headers['x-forwarded-host']   as string | undefined) || req.headers.host || 'petwash.co.il';
  const fullUrl = `${proto}://${host}${req.originalUrl}`;

  const isValid = twilio.validateRequest(authToken, signature, fullUrl, req.body as Record<string, string>);
  if (!isValid) {
    logger.warn('[SMSStatus] Twilio signature validation FAILED', {
      fullUrl,
      sigPrefix: signature.slice(0, 8) + '...',
    });
    return res.status(403).send('Forbidden');
  }

  next();
}

// ── POST /api/webhooks/twilio/sms-status ─────────────────────────────────────
// Twilio calls this URL for every message status transition:
//   queued → sent → delivered (or undelivered / failed)
//
// Configure in Twilio console:
//   Messaging → Services → [your service] → Sender Pool
//   → "A MESSAGE IS SENT" → Status Callback URL:
//     https://petwash.co.il/api/webhooks/twilio/sms-status
//
// Twilio retries on non-2xx. Respond 200 immediately, process async.
router.post('/sms-status', validateTwilioSignature, async (req: Request, res: Response) => {
  // Acknowledge immediately — Twilio will retry if we respond slowly
  res.status(200).send('');

  const {
    MessageSid,
    MessageStatus,
    To,
    From,
    ErrorCode,
    ErrorMessage,
  } = req.body as Record<string, string>;

  if (!MessageSid || !MessageStatus) {
    logger.warn('[SMSStatus] Callback missing MessageSid or MessageStatus', { body: req.body });
    return;
  }

  const normalizedStatus = MessageStatus.toLowerCase();
  const isDelivered  = normalizedStatus === 'delivered';
  const isFailed     = normalizedStatus === 'failed' || normalizedStatus === 'undelivered';
  const carrierError = interpretCarrierError(ErrorCode);

  // ── 1. Structured delivery log (always) ─────────────────────────────────
  logger.info('[SMSStatus] Delivery callback', {
    messageSid: MessageSid,
    status: normalizedStatus,
    to:   To   ? To.slice(0, 6)   + '****' : 'unknown',
    from: From ? From.slice(0, 6) + '****' : 'unknown',
    errorCode:    ErrorCode    || null,
    errorMessage: ErrorMessage || null,
    carrierError: carrierError || null,
    actionRequired: normalizedStatus === 'failed' && ErrorCode === '30034'
      ? 'ADD AU (+61) NUMBER TO TWILIO MESSAGING SERVICE SENDER POOL'
      : null,
  });

  try {
    // ── 2. Update sms_evidence row ─────────────────────────────────────────
    const updateData: Partial<typeof smsEvidence.$inferInsert> = {
      status: normalizedStatus,
    };
    if (isDelivered) {
      updateData.deliveredAt = new Date();
    }
    if (isFailed) {
      updateData.failureReason = ErrorCode
        ? `[${ErrorCode}] ${carrierError || ErrorMessage || ''}`
        : (ErrorMessage || normalizedStatus);
    }

    await db
      .update(smsEvidence)
      .set(updateData)
      .where(eq(smsEvidence.providerMessageId, MessageSid));

    // ── 3. Log to otp_events for terminal states only ──────────────────────
    // Intermediate states (queued, sent) don't need an audit row.
    if (!isDelivered && !isFailed) return;

    const [evidenceRow] = await db
      .select({
        toPhone:  smsEvidence.toPhone,
        userId:   smsEvidence.userId,
        traceId:  smsEvidence.traceId,
      })
      .from(smsEvidence)
      .where(eq(smsEvidence.providerMessageId, MessageSid))
      .limit(1);

    if (!evidenceRow) {
      logger.warn('[SMSStatus] No sms_evidence row found for SID — otp_events skipped', { MessageSid });
      return;
    }

    await db.insert(otpEvents).values({
      otpId:             `delivery:${MessageSid}`,
      eventType:         isDelivered ? 'SMS_DELIVERED' : 'SMS_FAILED',
      phoneE164:         evidenceRow.toPhone,
      userId:            evidenceRow.userId || null,
      userTypeIntent:    'PUBLIC',
      result:            isDelivered ? 'delivered' : 'failed',
      provider:          'twilio',
      providerMessageId: MessageSid,
      traceId:           evidenceRow.traceId || null,
      // Encode carrier error code into otpHash field for queryability
      otpHash:           isFailed && ErrorCode ? `carrier_error:${ErrorCode}` : null,
    });

    logger.info('[SMSStatus] otp_events row written', {
      eventType: isDelivered ? 'SMS_DELIVERED' : 'SMS_FAILED',
      phone: evidenceRow.toPhone.slice(0, 6) + '****',
      carrierError: carrierError || null,
    });

  } catch (err: any) {
    logger.error('[SMSStatus] Processing error', {
      error:      err?.message,
      messageSid: MessageSid,
    });
  }
});

export default router;
