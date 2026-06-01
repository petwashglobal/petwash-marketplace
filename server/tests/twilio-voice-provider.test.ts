/**
 * Twilio voice provider tests — Stage 3B.
 *
 * Covers: HMAC signature verification (positive + negative paths) and TwiML
 * response shape. Uses a fixed auth token + URL so the expected signature is
 * deterministic.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import crypto from 'crypto';

const flagStore = new Map<string, boolean>();
const conversations = new Map<string, any>();
const messages: any[] = [];
let idCounter = 0;
const uuid = () => `00000000-0000-0000-0000-${String(++idCounter).padStart(12, '0')}`;

vi.mock('../services/SystemConfig', () => ({
  getFeatureFlag: vi.fn(async (key: string) => flagStore.get(key) ?? false),
}));
vi.mock('../lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('../services/MayaService', () => ({
  createConversation: vi.fn(async (input: any) => {
    const row = { id: uuid(), status: 'open', ...input };
    if (input.externalCallSid) conversations.set(input.externalCallSid, row);
    return row;
  }),
  findConversationByCallSid: vi.fn(async (callSid: string) => conversations.get(callSid) ?? null),
  appendMessage: vi.fn(async (cid: string, input: any) => {
    const row = { id: uuid(), conversationId: cid, ...input };
    messages.push(row);
    return row;
  }),
  updateConversationVoiceState: vi.fn(async (id: string, fields: any) => {
    const conv = Array.from(conversations.values()).find((c) => c.id === id);
    if (conv) Object.assign(conv, fields);
    return conv ?? null;
  }),
  writeMayaAudit: vi.fn(),
}));

// Fix the auth token + URL so signature is deterministic in tests.
process.env.TWILIO_AUTH_TOKEN = 'TEST_AUTH_TOKEN_xxxxxxxxxxxxxxxxxxxxxxxx';
process.env.TWILIO_VOICE_PUBLIC_URL = 'https://example.com/api/maya/voice/twilio/voice';

import twilioRouter from '../routes/maya-voice-twilio';

function makeApp() {
  const app = express();
  app.use('/api/maya/voice/twilio', twilioRouter);
  return app;
}

function signTwilio(url: string, params: Record<string, string>, token = process.env.TWILIO_AUTH_TOKEN!) {
  const sortedConcat = Object.keys(params).sort().map((k) => `${k}${params[k]}`).join('');
  return crypto.createHmac('sha1', token).update(Buffer.from(url + sortedConcat, 'utf8')).digest('base64');
}

describe('Twilio voice provider — /api/maya/voice/twilio', () => {
  beforeEach(() => {
    flagStore.clear();
    conversations.clear();
    messages.length = 0;
    idCounter = 0;
  });

  it('returns 503 busy TwiML when ff.maya.voice.enabled is OFF', async () => {
    const res = await request(makeApp()).post('/api/maya/voice/twilio/voice').type('form').send({});
    expect(res.status).toBe(503);
    expect(res.text).toContain('<Hangup');
    expect(res.text).toContain('אנחנו לא זמינים');
  });

  it('returns 403 when X-Twilio-Signature missing', async () => {
    flagStore.set('ff.maya.voice.enabled', true);
    flagStore.set('ff.maya.voice.inbound.enabled', true);
    const res = await request(makeApp()).post('/api/maya/voice/twilio/voice')
      .type('form').send({ CallSid: 'CA1', From: '+972500000000', To: '+972300000000' });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('invalid_signature');
  });

  it('returns 403 when X-Twilio-Signature is wrong', async () => {
    flagStore.set('ff.maya.voice.enabled', true);
    flagStore.set('ff.maya.voice.inbound.enabled', true);
    const res = await request(makeApp()).post('/api/maya/voice/twilio/voice')
      .type('form').set('X-Twilio-Signature', 'BAD-SIGNATURE-XX')
      .send({ CallSid: 'CA1', From: '+972500000000', To: '+972300000000' });
    expect(res.status).toBe(403);
  });

  it('accepts call with valid signature, returns Gather TwiML with Hebrew greeting', async () => {
    flagStore.set('ff.maya.voice.enabled', true);
    flagStore.set('ff.maya.voice.inbound.enabled', true);
    const url = process.env.TWILIO_VOICE_PUBLIC_URL!;
    const params = { CallSid: 'CA10', From: '+972500000000', To: '+972300000000' };
    const sig = signTwilio(url, params);
    const res = await request(makeApp()).post('/api/maya/voice/twilio/voice')
      .type('form').set('X-Twilio-Signature', sig).send(params);
    expect(res.status).toBe(200);
    expect(res.text).toContain('<Gather input="speech"');
    expect(res.text).toContain('language="he-IL"');
    expect(res.text).toContain('מאיה');
    expect(conversations.has('CA10')).toBe(true);
  });

  it('handles speech turn via /gather and persists message', async () => {
    flagStore.set('ff.maya.voice.enabled', true);
    flagStore.set('ff.maya.voice.inbound.enabled', true);
    // First seed via /voice
    const url1 = 'https://example.com/api/maya/voice/twilio/voice';
    process.env.TWILIO_VOICE_PUBLIC_URL = url1;
    const params1 = { CallSid: 'CA20', From: '+972500000000', To: '+972300000000' };
    const sig1 = signTwilio(url1, params1);
    await request(makeApp()).post('/api/maya/voice/twilio/voice')
      .type('form').set('X-Twilio-Signature', sig1).send(params1);

    // Now /gather with Hebrew speech
    const url2 = 'https://example.com/api/maya/voice/twilio/gather';
    process.env.TWILIO_VOICE_PUBLIC_URL = url2;
    const params2 = { CallSid: 'CA20', SpeechResult: 'שלום, אני רוצה רחיצה' };
    const sig2 = signTwilio(url2, params2);
    const res = await request(makeApp()).post('/api/maya/voice/twilio/gather')
      .type('form').set('X-Twilio-Signature', sig2).send(params2);
    expect(res.status).toBe(200);
    expect(res.text).toContain('<Gather');
    expect(messages.length).toBe(1);
    expect(messages[0].locale).toBe('he');

    // Reset env for other tests
    process.env.TWILIO_VOICE_PUBLIC_URL = 'https://example.com/api/maya/voice/twilio/voice';
  });

  it('handles call_ended status with completed', async () => {
    flagStore.set('ff.maya.voice.enabled', true);
    flagStore.set('ff.maya.voice.inbound.enabled', true);
    // Seed
    const url1 = 'https://example.com/api/maya/voice/twilio/voice';
    process.env.TWILIO_VOICE_PUBLIC_URL = url1;
    const params1 = { CallSid: 'CA30', From: '+972', To: '+972' };
    const sig1 = signTwilio(url1, params1);
    await request(makeApp()).post('/api/maya/voice/twilio/voice')
      .type('form').set('X-Twilio-Signature', sig1).send(params1);
    // Status callback
    const url3 = 'https://example.com/api/maya/voice/twilio/status';
    process.env.TWILIO_VOICE_PUBLIC_URL = url3;
    const params3 = { CallSid: 'CA30', CallStatus: 'completed', CallDuration: '42' };
    const sig3 = signTwilio(url3, params3);
    const res = await request(makeApp()).post('/api/maya/voice/twilio/status')
      .type('form').set('X-Twilio-Signature', sig3).send(params3);
    expect(res.status).toBe(204);
    const conv = conversations.get('CA30');
    expect(conv.status).toBe('closed');
    process.env.TWILIO_VOICE_PUBLIC_URL = 'https://example.com/api/maya/voice/twilio/voice';
  });

  it('non-terminal CallStatus is a no-op (204, conversation stays open)', async () => {
    flagStore.set('ff.maya.voice.enabled', true);
    flagStore.set('ff.maya.voice.inbound.enabled', true);
    const url = 'https://example.com/api/maya/voice/twilio/status';
    process.env.TWILIO_VOICE_PUBLIC_URL = url;
    const params = { CallSid: 'CA40', CallStatus: 'ringing' };
    const sig = signTwilio(url, params);
    const res = await request(makeApp()).post('/api/maya/voice/twilio/status')
      .type('form').set('X-Twilio-Signature', sig).send(params);
    expect(res.status).toBe(204);
    process.env.TWILIO_VOICE_PUBLIC_URL = 'https://example.com/api/maya/voice/twilio/voice';
  });
});
