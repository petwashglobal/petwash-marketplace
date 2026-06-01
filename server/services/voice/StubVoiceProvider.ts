/**
 * StubVoiceProvider (Stage 3A).
 *
 * Persists call events to maya_* tables and returns scripted Hebrew/English
 * responses. No real ASR/TTS/LLM yet — that ships in Stage 3B/3C.
 *
 * Hard rules (carried forward from Stage 1b/2):
 *   - Never moves money, never starts K9000, never confirms bookings.
 *   - All drafts created on caller intake stay 'draft' — caller cannot push
 *     anything to 'approved' or 'confirmed' through this surface.
 *   - Every event written to maya_audit_log via MayaService.writeMayaAudit.
 *
 * Voice persona for Stage 3A scripted lines (per the SDD §3):
 *   - Hebrew greeting: "שלום, מדברת מאיה מפט-וואש, איך אפשר לעזור?"
 *   - English greeting: "Hi, this is Maya from PetWash, how can I help today?"
 *   - AI disclosure (only when asked) — handled by Stage 3C LLM prompt.
 */
import type { Request } from 'express';
import { logger } from '../../lib/logger';
import * as Maya from '../MayaService';
import type {
  MayaVoiceProvider,
  InboundCallEvent,
  TranscriptEvent,
  CallEndedEvent,
  VoiceResponse,
  VoiceResponseOpts,
} from './MayaVoiceProvider';

const SYSTEM_ACTOR: Maya.MayaActor = { type: 'system', id: 'voice-webhook' };

export class StubVoiceProvider implements MayaVoiceProvider {
  readonly name = 'stub';

  async verifySignature(_req: Request, _rawBody: string): Promise<boolean> {
    // Stub: accept all requests. Real verification ships in Stage 3B with the
    // chosen provider's signature scheme (e.g. Twilio X-Twilio-Signature HMAC).
    return true;
  }

  async handleInboundCall(event: InboundCallEvent): Promise<VoiceResponse> {
    const contactPhone = event.from && event.from !== 'anonymous' ? event.from : null;
    const conv = await Maya.createConversation(
      {
        channel: 'phone',
        locale: 'he',
        contactPhone,
        voiceProvider: event.provider,
        externalCallSid: event.callSid,
        callStartedAt: event.startedAt ?? new Date().toISOString(),
      },
      SYSTEM_ACTOR,
    );
    logger.info(
      { callSid: event.callSid, conversationId: conv.id, provider: event.provider },
      'maya voice: inbound call accepted',
    );
    return this.createVoiceResponse({
      text: 'שלום, מדברת מאיה מפט-וואש, איך אפשר לעזור?',
      locale: 'he',
    });
  }

  async handleTranscriptTurn(event: TranscriptEvent): Promise<VoiceResponse> {
    const conv = await Maya.findConversationByCallSid(event.callSid);
    if (!conv) {
      const err = new Error('conversation not found') as Error & { statusCode?: number };
      err.statusCode = 404;
      throw err;
    }
    await Maya.appendMessage(
      conv.id,
      { role: event.role, content: event.content, locale: event.locale },
      SYSTEM_ACTOR,
    );
    // Stage 3A: scripted safe acknowledgment. Stage 3C swaps to LLM-generated
    // responses grounded on the maya-knowledge.json reference answers.
    const text =
      event.locale === 'he'
        ? 'תודה. אעביר את זה לצוות שלנו לטיפול ויחזרו אליך.'
        : "Thanks. I'll pass this to our team and they'll be in touch.";
    return this.createVoiceResponse({ text, locale: event.locale });
  }

  async handleCallEnded(event: CallEndedEvent): Promise<void> {
    const conv = await Maya.findConversationByCallSid(event.callSid);
    if (!conv) {
      logger.warn(
        { callSid: event.callSid },
        'maya voice: call_ended received for unknown call',
      );
      return;
    }
    await Maya.updateConversationVoiceState(
      conv.id,
      {
        callEndedAt: event.endedAt ?? new Date().toISOString(),
        status: 'closed',
      },
      SYSTEM_ACTOR,
    );
    logger.info(
      {
        callSid: event.callSid,
        conversationId: conv.id,
        durationSeconds: event.durationSeconds,
        reason: event.reason,
      },
      'maya voice: call ended',
    );
  }

  createVoiceResponse(opts: VoiceResponseOpts): VoiceResponse {
    const xmlLang = opts.locale === 'he' ? 'he-IL' : 'en-US';
    const safeText = escapeXml(opts.text);
    const body =
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<Response>\n' +
      `  <Say language="${xmlLang}">${safeText}</Say>\n` +
      '</Response>';
    return { contentType: 'application/xml', body };
  }
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
