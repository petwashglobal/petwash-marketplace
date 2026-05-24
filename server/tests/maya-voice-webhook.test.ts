/**
 * Maya voice webhook tests — Stage 3A.
 *
 * Verifies: master + inbound flag gating, body validation, dispatch by
 * event type, conversation/message persistence via mocked MayaService.
 * No real provider, no real ASR/TTS/LLM.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// ---------------------------------------------------------------------------
// Mocks (hoisted by vi.mock).
// ---------------------------------------------------------------------------
const flagStore = new Map<string, boolean>();
const auditWrites: any[] = [];

vi.mock('../services/SystemConfig', () => ({
  getFeatureFlag: vi.fn(async (key: string) => flagStore.get(key) ?? false),
}));

vi.mock('../lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const conversations = new Map<string, any>(); // keyed by callSid for lookup
const messages: any[] = [];
let idCounter = 0;
const uuid = () => `00000000-0000-0000-0000-${String(++idCounter).padStart(12, '0')}`;

vi.mock('../services/MayaService', () => ({
  writeMayaAudit: vi.fn(async (opts: any) => { auditWrites.push(opts); }),

  createConversation: vi.fn(async (input: any) => {
    const row = { id: uuid(), status: 'open', ...input };
    if (input.externalCallSid) conversations.set(input.externalCallSid, row);
    return row;
  }),

  findConversationByCallSid: vi.fn(async (callSid: string) => {
    return conversations.get(callSid) ?? null;
  }),

  appendMessage: vi.fn(async (conversationId: string, input: any) => {
    const row = { id: uuid(), conversationId, ...input };
    messages.push(row);
    return row;
  }),

  updateConversationVoiceState: vi.fn(async (id: string, fields: any) => {
    const conv = Array.from(conversations.values()).find((c) => c.id === id);
    if (conv) Object.assign(conv, fields);
    return conv ?? null;
  }),
}));

import mayaVoiceWebhookRouter from '../routes/maya-voice-webhook';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/maya/voice', mayaVoiceWebhookRouter);
  return app;
}

describe('Maya voice webhook (/api/maya/voice/webhook)', () => {
  beforeEach(() => {
    flagStore.clear();
    auditWrites.length = 0;
    conversations.clear();
    messages.length = 0;
    idCounter = 0;
  });

  // -------------------------------------------------------------------------
  // flag gates
  // -------------------------------------------------------------------------
  it('returns 503 when ff.maya.voice.enabled is OFF (master)', async () => {
    const res = await request(makeApp())
      .post('/api/maya/voice/webhook')
      .send({ type: 'call_started', callSid: 'CA1', from: '+972500000000', to: '+972300000000', provider: 'stub' });
    expect(res.status).toBe(503);
    expect(res.body.error).toBe('voice_disabled');
  });

  it('returns 503 when ff.maya.voice.inbound.enabled is OFF (master on)', async () => {
    flagStore.set('ff.maya.voice.enabled', true);
    const res = await request(makeApp())
      .post('/api/maya/voice/webhook')
      .send({ type: 'call_started', callSid: 'CA1', from: '+972500000000', to: '+972300000000', provider: 'stub' });
    expect(res.status).toBe(503);
    expect(res.body.error).toBe('inbound_disabled');
  });

  // -------------------------------------------------------------------------
  // envelope validation
  // -------------------------------------------------------------------------
  it('rejects body with no event type', async () => {
    flagStore.set('ff.maya.voice.enabled', true);
    flagStore.set('ff.maya.voice.inbound.enabled', true);
    const res = await request(makeApp()).post('/api/maya/voice/webhook').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('missing_event_type');
  });

  it('rejects body with no call_sid', async () => {
    flagStore.set('ff.maya.voice.enabled', true);
    flagStore.set('ff.maya.voice.inbound.enabled', true);
    const res = await request(makeApp())
      .post('/api/maya/voice/webhook')
      .send({ type: 'call_started' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('missing_call_sid');
  });

  it('rejects unknown event type', async () => {
    flagStore.set('ff.maya.voice.enabled', true);
    flagStore.set('ff.maya.voice.inbound.enabled', true);
    const res = await request(makeApp())
      .post('/api/maya/voice/webhook')
      .send({ type: 'pizza', callSid: 'CA1' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('unknown_event_type');
  });

  // -------------------------------------------------------------------------
  // call_started — creates conversation, returns Hebrew greeting TwiML
  // -------------------------------------------------------------------------
  it('call_started creates conversation with channel=phone + voice fields', async () => {
    flagStore.set('ff.maya.voice.enabled', true);
    flagStore.set('ff.maya.voice.inbound.enabled', true);
    const res = await request(makeApp())
      .post('/api/maya/voice/webhook')
      .send({ type: 'call_started', callSid: 'CA1', from: '+972500000000', to: '+972300000000', provider: 'stub' });
    expect(res.status).toBe(200);
    expect(res.text).toContain('<Say language="he-IL"');
    expect(res.text).toContain('מאיה');
    expect(conversations.has('CA1')).toBe(true);
    const conv = conversations.get('CA1');
    expect(conv.channel).toBe('phone');
    expect(conv.voiceProvider).toBe('stub');
    expect(conv.externalCallSid).toBe('CA1');
  });

  it('call_started rejects missing from/to', async () => {
    flagStore.set('ff.maya.voice.enabled', true);
    flagStore.set('ff.maya.voice.inbound.enabled', true);
    const res = await request(makeApp())
      .post('/api/maya/voice/webhook')
      .send({ type: 'call_started', callSid: 'CA1' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('missing_from_or_to');
  });

  it('call_started writes a webhook-level audit entry', async () => {
    flagStore.set('ff.maya.voice.enabled', true);
    flagStore.set('ff.maya.voice.inbound.enabled', true);
    await request(makeApp())
      .post('/api/maya/voice/webhook')
      .send({ type: 'call_started', callSid: 'CA1', from: '+972', to: '+972', provider: 'stub' });
    const webhookAudits = auditWrites.filter((a) => a.payload?.event === 'call_started');
    expect(webhookAudits).toHaveLength(1);
    expect(webhookAudits[0].entityId).toBe('CA1');
  });

  // -------------------------------------------------------------------------
  // transcript_turn — appends message, returns acknowledgment
  // -------------------------------------------------------------------------
  it('transcript_turn appends a Hebrew message and acks in Hebrew', async () => {
    flagStore.set('ff.maya.voice.enabled', true);
    flagStore.set('ff.maya.voice.inbound.enabled', true);
    const app = makeApp();
    await request(app).post('/api/maya/voice/webhook').send({
      type: 'call_started', callSid: 'CA2', from: '+972', to: '+972', provider: 'stub',
    });
    const res = await request(app).post('/api/maya/voice/webhook').send({
      type: 'transcript_turn', callSid: 'CA2', role: 'user', content: 'אני רוצה רחיצה', locale: 'he',
    });
    expect(res.status).toBe(200);
    expect(res.text).toContain('language="he-IL"');
    expect(messages.length).toBe(1);
    expect(messages[0].content).toBe('אני רוצה רחיצה');
    expect(messages[0].role).toBe('user');
    expect(messages[0].locale).toBe('he');
  });

  it('transcript_turn appends an English message and acks in English', async () => {
    flagStore.set('ff.maya.voice.enabled', true);
    flagStore.set('ff.maya.voice.inbound.enabled', true);
    const app = makeApp();
    await request(app).post('/api/maya/voice/webhook').send({
      type: 'call_started', callSid: 'CA3', from: '+972', to: '+972', provider: 'stub',
    });
    const res = await request(app).post('/api/maya/voice/webhook').send({
      type: 'transcript_turn', callSid: 'CA3', role: 'user', content: 'I need a wash', locale: 'en',
    });
    expect(res.status).toBe(200);
    expect(res.text).toContain('language="en-US"');
  });

  it('transcript_turn returns 404 when callSid is unknown', async () => {
    flagStore.set('ff.maya.voice.enabled', true);
    flagStore.set('ff.maya.voice.inbound.enabled', true);
    const res = await request(makeApp())
      .post('/api/maya/voice/webhook')
      .send({ type: 'transcript_turn', callSid: 'NOPE', role: 'user', content: 'hi', locale: 'he' });
    expect(res.status).toBe(404);
  });

  it('transcript_turn rejects missing role/content', async () => {
    flagStore.set('ff.maya.voice.enabled', true);
    flagStore.set('ff.maya.voice.inbound.enabled', true);
    const res = await request(makeApp())
      .post('/api/maya/voice/webhook')
      .send({ type: 'transcript_turn', callSid: 'CA1' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('missing_role_or_content');
  });

  // -------------------------------------------------------------------------
  // call_ended — closes conversation, returns 204
  // -------------------------------------------------------------------------
  it('call_ended closes the conversation and returns 204', async () => {
    flagStore.set('ff.maya.voice.enabled', true);
    flagStore.set('ff.maya.voice.inbound.enabled', true);
    const app = makeApp();
    await request(app).post('/api/maya/voice/webhook').send({
      type: 'call_started', callSid: 'CA4', from: '+972', to: '+972', provider: 'stub',
    });
    const res = await request(app).post('/api/maya/voice/webhook').send({
      type: 'call_ended', callSid: 'CA4', durationSeconds: 42, reason: 'caller_hangup',
    });
    expect(res.status).toBe(204);
    const conv = conversations.get('CA4');
    expect(conv.status).toBe('closed');
  });

  it('call_ended is a no-op when callSid is unknown (returns 204)', async () => {
    flagStore.set('ff.maya.voice.enabled', true);
    flagStore.set('ff.maya.voice.inbound.enabled', true);
    const res = await request(makeApp()).post('/api/maya/voice/webhook').send({
      type: 'call_ended', callSid: 'NOPE',
    });
    expect(res.status).toBe(204);
  });
});
