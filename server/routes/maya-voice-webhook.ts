/**
 * Maya voice webhook — public endpoint.
 *
 * Mounted at /api/maya/voice (NOT under /api/admin) — Twilio/Vapi/Retell
 * call this directly. Auth is provider-signature verification, NOT admin
 * session/MFA. Same pattern as server/routes/nayax-webhooks.ts.
 *
 * Master gate:   ff.maya.voice.enabled          (default OFF)
 * Inbound gate:  ff.maya.voice.inbound.enabled  (default OFF)
 *
 * Body shape (provider-agnostic):
 *   { type: 'call_started' | 'transcript_turn' | 'call_ended', callSid: string, ... }
 *
 * Stage 3A: signature stubbed to always pass. Stage 3B replaces with real
 * provider-specific HMAC check.
 */
import { Router, type Request, type Response, type NextFunction, raw as expressRaw } from 'express';
import { logger } from '../lib/logger';
import { getFeatureFlag } from '../services/SystemConfig';
import { StubVoiceProvider } from '../services/voice/StubVoiceProvider';
import { writeMayaAudit } from '../services/MayaService';
import type { MayaVoiceProvider } from '../services/voice/MayaVoiceProvider';

const router = Router();

// Stage 3A: single stub provider. Stage 3B introduces a registry / chooser
// based on a header or path segment so we can run Twilio + Vapi + Retell
// side-by-side during evaluation.
const provider: MayaVoiceProvider = new StubVoiceProvider();

// ---------------------------------------------------------------------------
// gates
// ---------------------------------------------------------------------------
async function requireVoiceMaster(_req: Request, res: Response, next: NextFunction) {
  try {
    const enabled = await getFeatureFlag('ff.maya.voice.enabled');
    if (!enabled) return res.status(503).json({ ok: false, error: 'voice_disabled' });
    next();
  } catch (err) {
    logger.warn({ err }, 'ff.maya.voice.enabled read failed; treating as disabled');
    return res.status(503).json({ ok: false, error: 'voice_disabled' });
  }
}

async function requireInbound(_req: Request, res: Response, next: NextFunction) {
  try {
    const enabled = await getFeatureFlag('ff.maya.voice.inbound.enabled');
    if (!enabled) return res.status(503).json({ ok: false, error: 'inbound_disabled' });
    next();
  } catch (err) {
    logger.warn({ err }, 'ff.maya.voice.inbound.enabled read failed; treating as disabled');
    return res.status(503).json({ ok: false, error: 'inbound_disabled' });
  }
}

router.use(requireVoiceMaster);

// AUDIT-MONEY-8 (2026-09-01) — Raw body capture for HMAC verification.
//
// The prior implementation ran AFTER express.json() and re-serialised
// the already-parsed body with JSON.stringify — which produces
// DIFFERENT bytes than the provider signed (JSON.stringify has no
// guarantee of key order, whitespace, or numeric formatting). Any
// HMAC computed over that re-serialised string would verify against
// itself but NEVER against the provider's signature — so Stage 3B
// would ship a broken-by-design integration.
//
// The fix: mount express.raw({ type: '*/*' }) BEFORE any body parser
// on this router. That captures the actual bytes into req.body as a
// Buffer, we save them as req.rawBody (utf8) for the HMAC check, and
// then parse the JSON ourselves into req.body for the handlers. This
// makes provider signature verification correct for any provider that
// signs the raw request body.
router.use(
  '/webhook',
  expressRaw({ type: '*/*', limit: '256kb' }),
  (req: Request & { rawBody?: string }, _res, next) => {
    try {
      // express.raw put the raw bytes on req.body as a Buffer.
      const buf = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body ?? '');
      req.rawBody = buf.length > 0 ? buf.toString('utf8') : '';
      // Re-parse the JSON envelope for handler convenience. Provider
      // signature verification MUST use req.rawBody — NEVER re-derive
      // bytes from req.body.
      if (req.rawBody.length > 0) {
        try {
          req.body = JSON.parse(req.rawBody);
        } catch {
          // Malformed JSON body — leave req.body as the raw buffer;
          // handler will validate and 400.
          req.body = {};
        }
      } else {
        req.body = {};
      }
      next();
    } catch (err) {
      logger.warn({ err }, 'maya voice webhook: raw-body capture failed');
      next();
    }
  },
);

/**
 * POST /api/maya/voice/webhook
 *
 * Returns provider-formatted response (TwiML XML for Twilio). Stage 3A stub
 * always returns Hebrew greeting on call_started, scripted ack on transcript,
 * 204 on call_ended.
 */
router.post('/webhook', requireInbound, async (
  req: Request & { rawBody?: string },
  res: Response,
) => {
  // 1. Provider signature verification (stub in 3A, real in 3B).
  const verified = await provider.verifySignature(req, req.rawBody ?? '');
  if (!verified) {
    logger.warn({}, 'maya voice webhook: signature verification failed');
    return res.status(403).json({ ok: false, error: 'invalid_signature' });
  }

  // 2. Validate envelope.
  const body = (req.body ?? {}) as Record<string, unknown>;
  if (typeof body.type !== 'string') {
    return res.status(400).json({ ok: false, error: 'missing_event_type' });
  }
  if (typeof body.callSid !== 'string' || body.callSid.length === 0) {
    return res.status(400).json({ ok: false, error: 'missing_call_sid' });
  }

  // 3. Dispatch.
  try {
    switch (body.type) {
      case 'call_started': {
        if (typeof body.from !== 'string' || typeof body.to !== 'string') {
          return res.status(400).json({ ok: false, error: 'missing_from_or_to' });
        }
        const response = await provider.handleInboundCall({
          callSid: body.callSid,
          from: body.from,
          to: body.to,
          provider: typeof body.provider === 'string' ? body.provider : 'unknown',
          startedAt: typeof body.startedAt === 'string' ? body.startedAt : undefined,
        });
        // Webhook-level audit (in addition to the conversation-create audit
        // the service writes). entity_id uses the external_call_sid here so
        // a single grep on callSid surfaces all webhook activity per call.
        await writeMayaAudit({
          actor: { type: 'system', id: 'voice-webhook' },
          entityType: 'conversation',
          entityId: body.callSid,
          action: 'create',
          payload: { event: 'call_started', provider: body.provider ?? 'unknown' },
        }).catch((err) => logger.error({ err }, 'voice webhook audit write failed'));
        return res.type(response.contentType).status(200).send(response.body);
      }

      case 'transcript_turn': {
        if (typeof body.role !== 'string' || typeof body.content !== 'string') {
          return res.status(400).json({ ok: false, error: 'missing_role_or_content' });
        }
        const role = body.role === 'maya' ? 'maya' : 'user';
        const locale = body.locale === 'en' ? 'en' : 'he';
        const response = await provider.handleTranscriptTurn({
          callSid: body.callSid,
          role,
          content: body.content,
          locale,
          occurredAt: typeof body.occurredAt === 'string' ? body.occurredAt : undefined,
        });
        return res.type(response.contentType).status(200).send(response.body);
      }

      case 'call_ended': {
        await provider.handleCallEnded({
          callSid: body.callSid,
          endedAt: typeof body.endedAt === 'string' ? body.endedAt : undefined,
          durationSeconds: typeof body.durationSeconds === 'number' ? body.durationSeconds : undefined,
          reason: typeof body.reason === 'string' ? body.reason : undefined,
        });
        return res.status(204).end();
      }

      default:
        return res.status(400).json({ ok: false, error: 'unknown_event_type', type: body.type });
    }
  } catch (err: any) {
    if (err?.statusCode === 404) {
      return res.status(404).json({ ok: false, error: 'not_found' });
    }
    logger.error({ err }, 'maya voice webhook dispatch failed');
    return res.status(500).json({ ok: false, error: 'internal_error' });
  }
});

export default router;
