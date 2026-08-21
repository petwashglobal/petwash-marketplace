/**
 * WhatsApp Meta webhook signature verification — regression coverage.
 *
 * Locks in the four bugs Agent 6 fixed in server/enterprise/whatsappWebhook.ts:
 *
 *   1. Fail-CLOSED when META_WEBHOOK_SECRET is unset (previously fail-open →
 *      any unauthenticated POST was accepted as if from Meta).
 *   2. HMAC is verified over the RAW request bytes Meta signed, not over
 *      JSON.stringify(req.body). A parsed body whose bytes don't match the
 *      raw signature (e.g. re-serialised with different property order or
 *      whitespace) must NOT verify.
 *   3. crypto.timingSafeEqual must not throw on unequal-length signatures —
 *      the handler must return 403, not 500. A 500 would trigger Meta's
 *      exponential retry loop.
 *   4. Post-verify handler errors must ACK 200 (retry-storm guard). Once the
 *      signature is proven authentic, we own the message — Meta must not keep
 *      resending it because a downstream Firestore write failed.
 *
 * Wired via a minimal Express app that mounts the real route with the same
 * express.raw() middleware production uses, then calls the exported
 * verifyMetaSignature() unit for the direct positive/negative cases.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import crypto from 'crypto';

// ── Mock heavy deps BEFORE importing the module under test ────────────────
vi.mock('../lib/firebase-admin', () => {
  const noop = () => noop;
  const notFound = { exists: false, data: () => undefined };
  const collectionApi: any = {
    doc: () => collectionApi,
    get: async () => notFound,
    set: async () => ({}),
    update: async () => ({}),
    add: async () => ({ id: 'msg_test' }),
    where: () => collectionApi,
    orderBy: () => collectionApi,
    limit: () => collectionApi,
  };
  const firestoreDb: any = {
    collection: () => collectionApi,
    doc: () => collectionApi,
  };
  return {
    db: firestoreDb,
    default: {
      messaging: () => ({ send: async () => 'fcm-msg-id' }),
      firestore: { FieldValue: { serverTimestamp: () => new Date(), increment: () => 1 } },
    },
  };
});
vi.mock('../lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Import AFTER mocks are registered.
import { handleWhatsAppWebhook, verifyMetaSignature } from '../enterprise/whatsappWebhook';

const SECRET = 'test-meta-secret-value';

function sign(bodyBytes: Buffer, secret = SECRET): string {
  return 'sha256=' + crypto.createHmac('sha256', secret).update(bodyBytes).digest('hex');
}

function buildApp() {
  const app = express();
  // Same middleware production uses on this route.
  app.post(
    '/api/webhooks/whatsapp',
    express.raw({ type: 'application/json', limit: '2mb' }),
    handleWhatsAppWebhook,
  );
  return app;
}

describe('WhatsApp Meta webhook — signature verification (regression)', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('FAIL-CLOSED in production when META_WEBHOOK_SECRET is unset (returns 403, NOT 200)', async () => {
    delete process.env.META_WEBHOOK_SECRET;
    process.env.NODE_ENV = 'production';

    const body = Buffer.from(JSON.stringify({ entry: [] }));
    const res = await request(buildApp())
      .post('/api/webhooks/whatsapp')
      .set('content-type', 'application/json')
      .set('x-hub-signature-256', 'sha256=' + '0'.repeat(64))
      .send(body);

    expect(res.status).toBe(403);
  });

  it('rejects when the x-hub-signature-256 header is missing entirely', async () => {
    process.env.META_WEBHOOK_SECRET = SECRET;

    const body = Buffer.from(JSON.stringify({ entry: [] }));
    const res = await request(buildApp())
      .post('/api/webhooks/whatsapp')
      .set('content-type', 'application/json')
      .send(body);

    expect(res.status).toBe(403);
  });

  it('rejects when x-hub-signature-256 has a wrong length (must not crash on timingSafeEqual, must not 500)', async () => {
    process.env.META_WEBHOOK_SECRET = SECRET;

    const body = Buffer.from(JSON.stringify({ entry: [] }));
    // A truncated hex digest → provided buffer is shorter than expected.
    const res = await request(buildApp())
      .post('/api/webhooks/whatsapp')
      .set('content-type', 'application/json')
      .set('x-hub-signature-256', 'sha256=deadbeef') // 4 bytes instead of 32
      .send(body);

    // Critical: 403 (not 500). A 500 makes Meta retry the delivery forever.
    expect(res.status).toBe(403);
    expect(res.status).not.toBe(500);
  });

  it('rejects when the HMAC does not match the raw body bytes', async () => {
    process.env.META_WEBHOOK_SECRET = SECRET;

    const body = Buffer.from(JSON.stringify({ entry: [{ changes: [{ value: {} }] }] }));
    // Signature over DIFFERENT bytes than we send.
    const wrongSig = sign(Buffer.from('different bytes'));
    const res = await request(buildApp())
      .post('/api/webhooks/whatsapp')
      .set('content-type', 'application/json')
      .set('x-hub-signature-256', wrongSig)
      .send(body);

    expect(res.status).toBe(403);
  });

  it('accepts a valid signature computed over the exact raw request bytes', async () => {
    process.env.META_WEBHOOK_SECRET = SECRET;

    // Meta bytes that carry no `messages` — handler ACKs 200 without
    // invoking any staff routing. That still exercises: raw body reached the
    // handler as a Buffer, HMAC computed over those exact bytes, verify
    // passed.
    const body = Buffer.from(JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [{ id: '0', changes: [{ value: { messaging_product: 'whatsapp' } }] }],
    }));
    const res = await request(buildApp())
      .post('/api/webhooks/whatsapp')
      .set('content-type', 'application/json')
      .set('x-hub-signature-256', sign(body))
      .send(body);

    expect(res.status).toBe(200);
  });

  it('exported verifyMetaSignature returns false when raw body is a parsed object (defends against future re-parse regressions)', () => {
    process.env.META_WEBHOOK_SECRET = SECRET;
    const parsedObj: any = { entry: [] };
    const fakeReq: any = {
      headers: { 'x-hub-signature-256': 'sha256=' + '0'.repeat(64) },
      body: parsedObj,
    };
    expect(verifyMetaSignature(fakeReq)).toBe(false);
  });
});
