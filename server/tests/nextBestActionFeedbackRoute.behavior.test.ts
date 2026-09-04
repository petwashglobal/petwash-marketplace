/**
 * Behavioural test — POST /api/next-best-action/feedback
 * (Journey Brain Phase 6 · post-release 2026-09-04).
 *
 * Real supertest against the router mounted in a fresh express app.
 * The service is mocked so the test focuses on the ROUTE contract —
 * auth, body validation, error-code surfacing, and NEVER leaking
 * pg error text on a 500.
 */
import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let injectUid: string | null = null;
vi.mock('../middleware/firebase-auth', () => ({
  validateFirebaseToken: (req: any, _res: any, next: any) => {
    if (injectUid) req.firebaseUser = { uid: injectUid };
    return next();
  },
}));

let recordFeedbackImpl: (args: any) => Promise<{ id: string }> = async () => ({ id: 'fb_1' });

vi.mock('../services/nextBestActionFeedback', async () => {
  const actual = await vi.importActual<typeof import('../services/nextBestActionFeedback')>(
    '../services/nextBestActionFeedback',
  );
  return {
    ...actual,
    recordFeedback: vi.fn(async (_pool: any, args: any) => recordFeedbackImpl(args)),
  };
});

vi.mock('../db', () => ({
  pool: { query: vi.fn() },
}));

async function makeApp(uid: string | null) {
  injectUid = uid;
  const app = express();
  app.use(express.json());
  const router = (await import('../routes/next-best-action-feedback')).default;
  app.use('/api/next-best-action/feedback', router);
  return app;
}

beforeEach(() => {
  recordFeedbackImpl = async () => ({ id: 'fb_1' });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/next-best-action/feedback · behaviour', () => {
  it('401 AUTH_REQUIRED for an anonymous caller', async () => {
    const app = await makeApp(null);
    const res = await request(app)
      .post('/api/next-best-action/feedback')
      .send({ actionKey: 'attn:x', verdict: 'dismiss' });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'AUTH_REQUIRED' });
  });

  it('400 MISSING_ACTION_KEY on missing body key', async () => {
    const app = await makeApp('usr_1');
    const res = await request(app)
      .post('/api/next-best-action/feedback')
      .send({ verdict: 'dismiss' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'MISSING_ACTION_KEY' });
  });

  it('400 ACTION_KEY_TOO_LONG when key > 200 chars', async () => {
    const app = await makeApp('usr_1');
    const res = await request(app)
      .post('/api/next-best-action/feedback')
      .send({ actionKey: 'x'.repeat(201), verdict: 'dismiss' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'ACTION_KEY_TOO_LONG' });
  });

  it('400 INVALID_VERDICT on unknown verdict (or missing)', async () => {
    const app = await makeApp('usr_1');
    const bad = await request(app)
      .post('/api/next-best-action/feedback')
      .send({ actionKey: 'attn:x', verdict: 'hackerman' });
    expect(bad.status).toBe(400);
    expect(bad.body).toEqual({ error: 'INVALID_VERDICT' });

    const missing = await request(app)
      .post('/api/next-best-action/feedback')
      .send({ actionKey: 'attn:x' });
    expect(missing.status).toBe(400);
    expect(missing.body).toEqual({ error: 'INVALID_VERDICT' });
  });

  it('happy path — 200 { ok, id } for a signed-in caller with a valid body', async () => {
    const app = await makeApp('usr_route_1');
    const res = await request(app)
      .post('/api/next-best-action/feedback')
      .send({ actionKey: 'attn:atn_1', verdict: 'dismiss' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, id: 'fb_1' });
  });

  it('service typed error (e.g. INVALID_VERDICT via defence-in-depth) surfaces as 400 with same code', async () => {
    recordFeedbackImpl = async () => {
      throw new Error('INVALID_VERDICT');
    };
    const app = await makeApp('usr_1');
    const res = await request(app)
      .post('/api/next-best-action/feedback')
      .send({ actionKey: 'attn:x', verdict: 'act' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'INVALID_VERDICT' });
  });

  it('unexpected pool throw surfaces as 500 INTERNAL — NEVER leaks pg detail', async () => {
    recordFeedbackImpl = async () => {
      throw new Error('duplicate key value violates unique constraint "some_pg_detail"');
    };
    const app = await makeApp('usr_1');
    const res = await request(app)
      .post('/api/next-best-action/feedback')
      .send({ actionKey: 'attn:x', verdict: 'act' });
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'INTERNAL' });
    // Explicit: the pg text NEVER appears in the response.
    expect(JSON.stringify(res.body)).not.toMatch(/some_pg_detail/);
  });

  it('accepts all 4 canonical verdicts', async () => {
    const app = await makeApp('usr_1');
    for (const v of ['act', 'dismiss', 'not_interested', 'fewer_like_this'] as const) {
      const res = await request(app)
        .post('/api/next-best-action/feedback')
        .send({ actionKey: `attn:${v}`, verdict: v });
      expect(res.status).toBe(200);
    }
  });
});
