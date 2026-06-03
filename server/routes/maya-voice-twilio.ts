/**
 * Maya voice — Twilio-specific webhook router (Stage 3B).
 *
 * Three endpoints matching Twilio's call lifecycle:
 *   POST /api/maya/voice/twilio/voice    — initial call (Voice URL)
 *   POST /api/maya/voice/twilio/gather   — speech turn (Gather action URL)
 *   POST /api/maya/voice/twilio/status   — call status update (Status callback)
 *
 * All three are public — Twilio calls them, NOT admins. Auth is HMAC
 * signature verification with TWILIO_AUTH_TOKEN. Stage 3A's /webhook stays
 * for testing/stub use.
 *
 * Flags:
 *   ff.maya.voice.enabled          (master)
 *   ff.maya.voice.inbound.enabled  (inbound calls)
 *
 * Body shape: Twilio POSTs URL-encoded form data — needs express.urlencoded()
 * mounted upstream (or in this router).
 */
import { Router, type Request, type Response, type NextFunction } from 'express';
import express from 'express';
import { logger } from '../lib/logger';
import { getFeatureFlag } from '../services/SystemConfig';
import { TwilioVoiceProvider } from '../services/voice/TwilioVoiceProvider';
import * as Maya from '../services/MayaService';

const router = Router();
// Lazy-init: capture env vars (TWILIO_AUTH_TOKEN, TWILIO_VOICE_PUBLIC_URL) on
// first request, not at module import. Avoids a Vitest ESM-hoisting trap where
// the test sets env AFTER the import — and is also safer in production if any
// runtime config (Secret Manager, etc.) populates env late.
let _provider: TwilioVoiceProvider | null = null;
function getProvider(): TwilioVoiceProvider {
  return _provider ?? (_provider = new TwilioVoiceProvider());
}

// Twilio POSTs application/x-www-form-urlencoded. Parse here so it doesn't
// matter what the rest of the app uses.
router.use(express.urlencoded({ extended: false }));

// ---------------------------------------------------------------------------
// gates
// ---------------------------------------------------------------------------
async function requireMaster(_req: Request, res: Response, next: NextFunction) {
  try {
    const enabled = await getFeatureFlag('ff.maya.voice.enabled');
    if (!enabled) return res.status(503).type('application/xml').send(busyTwiml());
    next();
  } catch (err) {
    logger.warn({ err }, 'ff.maya.voice.enabled read failed; treating as disabled');
    return res.status(503).type('application/xml').send(busyTwiml());
  }
}
async function requireInbound(_req: Request, res: Response, next: NextFunction) {
  try {
    const enabled = await getFeatureFlag('ff.maya.voice.inbound.enabled');
    if (!enabled) return res.status(503).type('application/xml').send(busyTwiml());
    next();
  } catch (err) {
    return res.status(503).type('application/xml').send(busyTwiml());
  }
}
router.use(requireMaster);

// HMAC verification middleware. Aborts with 403 (no TwiML, no audio leak).
async function requireValidSignature(req: Request, res: Response, next: NextFunction) {
  const ok = await getProvider().verifySignature(req, '');
  if (!ok) {
    logger.warn({}, 'maya twilio: signature verification failed');
    return res.status(403).json({ ok: false, error: 'invalid_signature' });
  }
  next();
}

// ---------------------------------------------------------------------------
// POST /api/maya/voice/twilio/voice — call started
// ---------------------------------------------------------------------------
router.post('/voice', requireInbound, requireValidSignature, async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as Record<string, string>;
  const callSid = body.CallSid;
  const from = body.From || 'anonymous';
  const to = body.To || '';
  if (!callSid) {
    return res.status(400).json({ ok: false, error: 'missing_call_sid' });
  }
  try {
    const response = await getProvider().handleInboundCall({
      callSid, from, to, provider: 'twilio',
      startedAt: new Date().toISOString(),
    });
    return res.type(response.contentType).status(200).send(response.body);
  } catch (err) {
    logger.error({ err, callSid }, 'maya twilio /voice failed');
    return res.status(500).type('application/xml').send(busyTwiml());
  }
});

// ---------------------------------------------------------------------------
// POST /api/maya/voice/twilio/gather — speech turn
// Twilio sends SpeechResult, Confidence, etc.
// ---------------------------------------------------------------------------
router.post('/gather', requireInbound, requireValidSignature, async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as Record<string, string>;
  const callSid = body.CallSid;
  const speech = body.SpeechResult || '';
  if (!callSid) {
    return res.status(400).json({ ok: false, error: 'missing_call_sid' });
  }
  // Language is anchored to the CONVERSATION locale — chosen from the dialed
  // number when the call started (+972 → he, else → en) and stored on the row.
  // We do NOT re-detect per utterance: scanning each transcript for Hebrew
  // characters flipped Maya into English whenever a turn happened to transcribe
  // without any Hebrew (digits, names, "PetWash"), and gave English callers a
  // Hebrew re-prompt on silence.
  const conv = await Maya.findConversationByCallSid(callSid);
  const locale: 'he' | 'en' = conv?.locale === 'en' ? 'en' : 'he';
  if (!speech) {
    // Empty result (silence) — re-prompt in the caller's language.
    const reprompt = getProvider().createVoiceResponse({
      text:
        locale === 'he'
          ? 'לא שמעתי. אפשר לחזור?'
          : "Sorry, I didn't catch that. Could you say that again?",
      locale,
    });
    return res.type(reprompt.contentType).status(200).send(reprompt.body);
  }
  try {
    const response = await getProvider().handleTranscriptTurn({
      callSid, role: 'user', content: speech, locale,
      occurredAt: new Date().toISOString(),
    });
    return res.type(response.contentType).status(200).send(response.body);
  } catch (err: any) {
    if (err?.statusCode === 404) {
      return res.status(404).type('application/xml').send(busyTwiml());
    }
    logger.error({ err, callSid }, 'maya twilio /gather failed');
    return res.status(500).type('application/xml').send(busyTwiml());
  }
});

// ---------------------------------------------------------------------------
// POST /api/maya/voice/twilio/status — call ended
// Twilio sends CallStatus=completed, failed, busy, no-answer, canceled.
// ---------------------------------------------------------------------------
router.post('/status', requireValidSignature, async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as Record<string, string>;
  const callSid = body.CallSid;
  const status = body.CallStatus;
  const duration = body.CallDuration ? Number(body.CallDuration) : undefined;
  if (!callSid) {
    return res.status(400).json({ ok: false, error: 'missing_call_sid' });
  }
  // Only close on terminal statuses.
  const terminal = new Set(['completed', 'failed', 'canceled', 'busy', 'no-answer']);
  if (!terminal.has(status)) {
    return res.status(204).end();
  }
  try {
    await getProvider().handleCallEnded({
      callSid,
      endedAt: new Date().toISOString(),
      durationSeconds: duration,
      reason: status,
    });
    return res.status(204).end();
  } catch (err) {
    logger.error({ err, callSid }, 'maya twilio /status failed');
    return res.status(500).json({ ok: false, error: 'internal_error' });
  }
});

// Polite fallback TwiML when service is disabled or failing.
// "We're not available right now. Please try again or leave a message."
function busyTwiml(): string {
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<Response>\n' +
    '  <Say language="he-IL">אנחנו לא זמינים כרגע. אנא נסו שוב מאוחר יותר.</Say>\n' +
    '  <Say language="en-US">We are not available right now. Please try again later.</Say>\n' +
    '  <Hangup/>\n' +
    '</Response>'
  );
}

export default router;
