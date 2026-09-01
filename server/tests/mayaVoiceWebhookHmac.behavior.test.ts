/**
 * Behavioural test — Maya voice webhook HMAC over RAW body.
 *
 * AUDIT-MONEY-8 (#232): the prior implementation ran after express.json()
 * and re-serialised the parsed body with JSON.stringify. HMAC computed
 * over the re-serialised string never matches the provider's signature
 * — key order, whitespace, and numeric formatting are all free to
 * differ from what the provider signed. Any real provider integration
 * would ship broken-by-design.
 *
 * The fix: express.raw({ type: 'any' }) BEFORE the JSON parse, save the
 * actual bytes as req.rawBody, then parse JSON ourselves. Provider
 * signature verification MUST verify over req.rawBody — NEVER re-derive
 * bytes from req.body.
 *
 * This test proves the invariant behaviourally:
 *
 *   1. A request whose HMAC-SHA256 signature was computed over the exact
 *      posted bytes → 200 OK. (raw bytes preserved end-to-end.)
 *   2. The same JSON body with an added whitespace byte and the SAME
 *      signature-of-original → 403. (bytes changed after signing.)
 *   3. A body whose signature was computed over JSON.stringify(parsed)
 *      but posted with different formatting → 403. (this is the exact
 *      failure mode the audit called out.)
 *   4. The rawBody the handler sees matches the bytes we posted, byte
 *      for byte, including whitespace and key order.
 *
 * We mock StubVoiceProvider so verifySignature does real HMAC-SHA256
 * of a fixed test key over req.rawBody. Everything else runs through
 * the actual router / middleware chain, so a future regression that
 * re-introduces the JSON.stringify(req.body) pattern breaks case (3).
 */
import express from 'express';
import request from 'supertest';
import crypto from 'node:crypto';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const TEST_HMAC_KEY = 'test-secret-do-not-use-in-production';
const capturedRawBodies: string[] = [];

vi.mock('../services/SystemConfig', () => ({
  getFeatureFlag: vi.fn(async (key: string) => {
    if (key === 'ff.maya.voice.enabled' || key === 'ff.maya.voice.inbound.enabled') {
      return true;
    }
    return false;
  }),
}));

vi.mock('../services/MayaService', () => ({
  writeMayaAudit: vi.fn(async () => undefined),
  createConversation: vi.fn(async () => ({ id: 'conv-1' })),
  findConversationByCallSid: vi.fn(async () => ({ id: 'conv-1' })),
  appendMessage: vi.fn(async () => undefined),
  updateConversationVoiceState: vi.fn(async () => undefined),
}));

vi.mock('../services/voice/StubVoiceProvider', () => {
  class TestHmacProvider {
    readonly name = 'test-hmac';

    async verifySignature(req: any, rawBody: string): Promise<boolean> {
      capturedRawBodies.push(rawBody);
      const sig = (req.headers['x-maya-signature'] || '').toString();
      if (!sig) return false;
      const expected = crypto.createHmac('sha256', TEST_HMAC_KEY).update(rawBody).digest('hex');
      return crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'));
    }

    async handleInboundCall() {
      return { contentType: 'application/xml', body: '<Response/>' };
    }
    async handleTranscriptTurn() {
      return { contentType: 'application/xml', body: '<Response/>' };
    }
    async handleCallEnded() {
      /* no-op */
    }
  }
  return { StubVoiceProvider: TestHmacProvider };
});

let app: express.Express;

beforeAll(async () => {
  const mod = await import('../routes/maya-voice-webhook');
  app = express();
  // NO global body parser — the router's own express.raw() prefix must
  // capture the request stream. If a future refactor removes the raw
  // prefix, req.rawBody becomes '' and every signature check fails,
  // which is exactly the loud failure we want.
  app.use('/api/maya/voice', mod.default);
});

beforeEach(() => {
  capturedRawBodies.length = 0;
});

function sign(rawBody: string): string {
  return crypto.createHmac('sha256', TEST_HMAC_KEY).update(rawBody).digest('hex');
}

describe('Maya webhook HMAC over raw body (AUDIT-MONEY-8)', () => {
  it('accepts a request signed over the exact posted bytes', async () => {
    const rawBody = JSON.stringify({
      type: 'call_started',
      callSid: 'CA_TEST_1',
      from: '+972501234567',
      to: '+972500000000',
      provider: 'test',
    });
    const res = await request(app)
      .post('/api/maya/voice/webhook')
      .set('Content-Type', 'application/json')
      .set('X-Maya-Signature', sign(rawBody))
      .send(rawBody);
    expect(res.status).toBe(200);
    // The handler observed the exact bytes we posted.
    expect(capturedRawBodies.at(-1)).toBe(rawBody);
  });

  it('rejects a request whose bytes changed after signing (whitespace mutation)', async () => {
    const rawBody = JSON.stringify({
      type: 'call_started',
      callSid: 'CA_TEST_2',
      from: '+972501234567',
      to: '+972500000000',
    });
    const signature = sign(rawBody);
    // Attacker (or a middleware bug) mutates the bytes but reuses the sig.
    const mutated = rawBody.replace('"type"', '"type" ');
    const res = await request(app)
      .post('/api/maya/voice/webhook')
      .set('Content-Type', 'application/json')
      .set('X-Maya-Signature', signature)
      .send(mutated);
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ ok: false, error: 'invalid_signature' });
    // Verifier saw the mutated bytes, not the pre-mutation bytes.
    expect(capturedRawBodies.at(-1)).toBe(mutated);
  });

  it('rejects when signature was computed over JSON.stringify(parsedBody) rather than raw bytes', async () => {
    // This is the exact failure mode the audit called out: someone
    // signs re-serialised JSON, but the wire bytes have different
    // whitespace / key order. Should always be rejected.
    const parsed = {
      callSid: 'CA_TEST_3',
      type: 'call_started',
      from: '+972500000001',
      to: '+972500000000',
    };
    // The provider signed the pretty-printed re-serialisation.
    const reserialised = JSON.stringify(parsed, null, 2);
    // But shipped the compact form on the wire.
    const wireBody = JSON.stringify(parsed);
    const res = await request(app)
      .post('/api/maya/voice/webhook')
      .set('Content-Type', 'application/json')
      .set('X-Maya-Signature', sign(reserialised))
      .send(wireBody);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('invalid_signature');
  });

  it('req.rawBody matches wire bytes for a body with unusual key order and whitespace', async () => {
    // Non-canonical key order + extra whitespace inside the JSON — the
    // kind of body a real provider might sign that JSON.stringify(parsed)
    // would silently rewrite. The handler must see EXACTLY these bytes.
    const rawBody = '{ "callSid" : "CA_TEST_4" ,  "type": "call_ended" }';
    const res = await request(app)
      .post('/api/maya/voice/webhook')
      .set('Content-Type', 'application/json')
      .set('X-Maya-Signature', sign(rawBody))
      .send(rawBody);
    expect(res.status).toBe(204);
    expect(capturedRawBodies.at(-1)).toBe(rawBody);
  });

  it('rejects missing signature header', async () => {
    const rawBody = JSON.stringify({ type: 'call_ended', callSid: 'CA_TEST_5' });
    const res = await request(app)
      .post('/api/maya/voice/webhook')
      .set('Content-Type', 'application/json')
      .send(rawBody);
    expect(res.status).toBe(403);
  });
});
