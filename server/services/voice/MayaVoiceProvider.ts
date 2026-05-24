/**
 * Maya voice provider interface (Stage 3A).
 *
 * Provider-agnostic adapter. Stage 3A ships StubVoiceProvider only —
 * Stage 3B/3C swap in a real provider (Twilio first per the SDD) while
 * keeping this interface stable.
 */
import type { Request } from 'express';

/** Inbound call started — a caller dialed the PetWash number. */
export interface InboundCallEvent {
  /** Provider's unique call identifier (e.g. Twilio Call SID). */
  callSid: string;
  /** E.164 caller number, or 'anonymous' if blocked. */
  from: string;
  /** E.164 called number. */
  to: string;
  /** Voice provider sending the event: 'twilio' | 'vapi' | 'retell' | 'stub'. */
  provider: string;
  /** ISO timestamp the call actually started. Webhook may add this; otherwise we default to now(). */
  startedAt?: string;
}

/** One transcript turn — either the caller spoke or Maya did. */
export interface TranscriptEvent {
  callSid: string;
  role: 'user' | 'maya';
  content: string;
  /** Spoken language for this turn. Maya may code-switch mid-call. */
  locale: 'he' | 'en';
  /** ISO timestamp when this turn occurred. */
  occurredAt?: string;
}

/** Call ended — caller hung up, timeout, transfer, or error. */
export interface CallEndedEvent {
  callSid: string;
  endedAt?: string;
  durationSeconds?: number;
  reason?: 'caller_hangup' | 'timeout' | 'transfer' | 'error' | string;
}

/** Provider-formatted response (TwiML XML, Vapi JSON, etc.). */
export interface VoiceResponse {
  contentType: 'application/xml' | 'application/json' | 'text/plain';
  body: string;
}

/** Options for building Maya's spoken response. */
export interface VoiceResponseOpts {
  text: string;
  locale: 'he' | 'en';
  /** Optional explicit TTS voice id (provider-specific). */
  voiceId?: string;
  /** Allow the caller to interrupt the prompt. Default true in real providers. */
  bargeIn?: boolean;
}

export interface MayaVoiceProvider {
  /** Display name for logs/metrics. */
  readonly name: string;

  /**
   * Verify the provider's webhook signature. Return true if authentic,
   * false otherwise. Fail-closed: any error or missing header → false.
   *
   * Stage 3A stub: always returns true (no real provider attached yet).
   * Stage 3B: HMAC against the provider's shared secret.
   */
  verifySignature(req: Request, rawBody: string): Promise<boolean>;

  /**
   * Inbound call started. Persists the conversation row and returns the
   * provider-formatted greeting response.
   */
  handleInboundCall(event: InboundCallEvent): Promise<VoiceResponse>;

  /**
   * One transcript turn (caller utterance or Maya's spoken response).
   * Appends to maya_messages, returns Maya's next spoken turn.
   * Stage 3A: scripted safe acknowledgment. Stage 3C: LLM-generated.
   */
  handleTranscriptTurn(event: TranscriptEvent): Promise<VoiceResponse>;

  /**
   * Call ended. Closes the conversation, records end timestamp.
   * No spoken response — caller is already gone.
   */
  handleCallEnded(event: CallEndedEvent): Promise<void>;

  /**
   * Provider-agnostic response builder. Stage 3A returns TwiML XML which
   * Twilio accepts natively; other providers can override this method to
   * emit Vapi/Retell JSON shapes.
   */
  createVoiceResponse(opts: VoiceResponseOpts): VoiceResponse;
}
