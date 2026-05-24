/**
 * TwilioVoiceProvider (Stage 3B) — real adapter.
 *
 * Implements MayaVoiceProvider against Twilio Voice webhooks.
 *
 * Twilio's call lifecycle hits THREE separate URLs (all configured in the
 * Twilio console for the PetWash phone number):
 *   1. Voice URL              — POST when a call comes in. Returns TwiML
 *                                with <Gather input="speech" action="…/gather">.
 *   2. Gather action URL      — POST after each speech turn. We append the
 *                                caller's SpeechResult, then return TwiML
 *                                with the next <Gather><Say>…</Say></Gather>.
 *   3. Status callback URL    — POST when the call ends (CallStatus=completed
 *                                or failed). We close the conversation row.
 *
 * Env vars (set in production):
 *   TWILIO_AUTH_TOKEN          — for HMAC verification
 *   TWILIO_VOICE_PUBLIC_URL    — full https URL the webhook is reachable at
 *                                (optional; otherwise built from request headers)
 *
 * Hard scope (carried forward):
 *   - No money, no K9000, no provider approval, no booking confirmation.
 *   - Stage 3B returns SCRIPTED Hebrew + English responses — same as 3A stub.
 *     Stage 3C swaps in the LLM.
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
import { verifyTwilioSignature, buildPublicUrl } from './twilioHmac';

const SYSTEM_ACTOR: Maya.MayaActor = { type: 'system', id: 'voice-twilio' };

// Twilio uses BCP-47 codes in <Say language="…">.
const TWILIO_LANG = { he: 'he-IL', en: 'en-US' } as const;

export class TwilioVoiceProvider implements MayaVoiceProvider {
  readonly name = 'twilio';

  private readonly explicitAuthToken?: string;
  private readonly explicitPublicUrlOverride?: string;
  /** Path Twilio should hit for each next Gather turn. */
  private readonly gatherActionPath: string;

  constructor(opts?: {
    authToken?: string;
    publicUrlOverride?: string;
    gatherActionPath?: string;
  }) {
    // Store opts only. Resolve env LATE (per request) so tests can mutate
    // process.env between cases and production tolerates late env injection
    // (Secret Manager, etc.) without restart-only behavior.
    this.explicitAuthToken = opts?.authToken;
    this.explicitPublicUrlOverride = opts?.publicUrlOverride;
    this.gatherActionPath = opts?.gatherActionPath ?? '/api/maya/voice/twilio/gather';
  }

  private getAuthToken(): string {
    return this.explicitAuthToken ?? process.env.TWILIO_AUTH_TOKEN ?? '';
  }

  private getPublicUrlOverride(): string | undefined {
    return this.explicitPublicUrlOverride ?? process.env.TWILIO_VOICE_PUBLIC_URL;
  }

  async verifySignature(req: Request, _rawBody: string): Promise<boolean> {
    const authToken = this.getAuthToken();
    if (!authToken) {
      // No token configured — fail-closed. Production must set TWILIO_AUTH_TOKEN.
      logger.warn({}, 'TwilioVoiceProvider: TWILIO_AUTH_TOKEN not set; rejecting');
      return false;
    }
    const publicUrl = buildPublicUrl(req, this.getPublicUrlOverride());
    return verifyTwilioSignature(req, { authToken, publicUrl });
  }

  // ---------------------------------------------------------------------------
  // Lifecycle handlers
  // ---------------------------------------------------------------------------

  /**
   * Initial call. Create the conversation row, return TwiML with a <Gather>
   * that points back at our gather action URL.
   */
  async handleInboundCall(event: InboundCallEvent): Promise<VoiceResponse> {
    const contactPhone = event.from && event.from !== 'anonymous' ? event.from : null;
    const conv = await Maya.createConversation(
      {
        channel: 'phone',
        locale: 'he',
        contactPhone,
        voiceProvider: 'twilio',
        externalCallSid: event.callSid,
        callStartedAt: event.startedAt ?? new Date().toISOString(),
      },
      SYSTEM_ACTOR,
    );
    logger.info({ callSid: event.callSid, conversationId: conv.id }, 'twilio voice: inbound call');
    return this.buildGatherTwiml({
      text: 'שלום, מדברת מאיה מפט-וואש, איך אפשר לעזור?',
      locale: 'he',
    });
  }

  /**
   * Speech-turn from caller. Persist to maya_messages, return next prompt.
   * Stage 3B: scripted ack (same as 3A). Stage 3C swaps in LLM-generated reply.
   */
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
    const text =
      event.locale === 'he'
        ? 'תודה, רשמתי. הצוות שלנו יחזור אליך בקרוב. עוד משהו שאפשר לעזור?'
        : "Got it, thanks. Our team will follow up. Anything else I can help with?";
    return this.buildGatherTwiml({ text, locale: event.locale });
  }

  /**
   * Call ended (Twilio sends CallStatus=completed or failed to the status URL).
   * Mark conversation closed. No spoken response — caller is gone.
   */
  async handleCallEnded(event: CallEndedEvent): Promise<void> {
    const conv = await Maya.findConversationByCallSid(event.callSid);
    if (!conv) {
      logger.warn({ callSid: event.callSid }, 'twilio voice: call_ended for unknown call');
      return;
    }
    await Maya.updateConversationVoiceState(
      conv.id,
      { callEndedAt: event.endedAt ?? new Date().toISOString(), status: 'closed' },
      SYSTEM_ACTOR,
    );
    logger.info({ callSid: event.callSid, conversationId: conv.id }, 'twilio voice: call ended');
  }

  /**
   * TwiML response without <Gather> — used for simple Say-then-Hangup paths.
   */
  createVoiceResponse(opts: VoiceResponseOpts): VoiceResponse {
    const safeText = escapeXml(opts.text);
    const lang = TWILIO_LANG[opts.locale];
    const body =
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<Response>\n' +
      `  <Say language="${lang}">${safeText}</Say>\n` +
      '</Response>';
    return { contentType: 'application/xml', body };
  }

  /**
   * TwiML response with a <Gather input="speech"> wrapping a <Say>. Each speech
   * result POSTs back to gatherActionPath so we can continue the conversation.
   *
   * speechTimeout="auto" — Twilio decides when the caller is done speaking.
   * actionOnEmptyResult="true" — even silence triggers an action (so we can prompt again).
   */
  private buildGatherTwiml(opts: VoiceResponseOpts): VoiceResponse {
    const safeText = escapeXml(opts.text);
    const lang = TWILIO_LANG[opts.locale];
    // Hebrew speech recognition: he-IL. English: en-US.
    const recognitionLang = lang;
    const body =
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<Response>\n' +
      `  <Gather input="speech" language="${recognitionLang}" speechTimeout="auto" ` +
      `action="${escapeXmlAttr(this.gatherActionPath)}" method="POST" actionOnEmptyResult="true">\n` +
      `    <Say language="${lang}">${safeText}</Say>\n` +
      `  </Gather>\n` +
      // If the caller hangs up while we're waiting, Twilio falls past the Gather and hangs up.
      `  <Hangup/>\n` +
      '</Response>';
    return { contentType: 'application/xml', body };
  }
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
function escapeXmlAttr(s: string): string {
  return escapeXml(s);
}
