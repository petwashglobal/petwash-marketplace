/**
 * PIN auth — server-derived identity regression pins (auth/identity sweep 2026-08-17).
 *
 * BEFORE (all verified by reading server/routes/pin-auth.ts on main):
 *   - POST   /api/pin-auth/setup   had NO authentication and picked the account
 *     from a body `email`. Anyone could plant/overwrite a PIN on ANY account.
 *   - POST   /api/pin-auth/change  same: unauthenticated, body-chosen identity.
 *   - DELETE /api/pin-auth/remove  same: unauthenticated, body-chosen identity.
 *   - GET    /api/pin-auth/status  unauthenticated and keyed on `?email=` —
 *     free enumeration of whether an arbitrary account had a PIN, its length
 *     and its lockout state. It also 400'd the real Settings page (which sends
 *     no `?email=`), so every user saw "PIN: Not set".
 *
 * AFTER: every one of them requires a verified Firebase token and resolves the
 * account from the token UID. A body `email` may only agree with the token.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const { verifyIdToken, verifySessionCookie } = vi.hoisted(() => ({
  verifyIdToken: vi.fn(),
  verifySessionCookie: vi.fn(),
}));

vi.mock('../lib/firebase-admin', () => {
  const auth = { verifyIdToken, verifySessionCookie };
  return {
    default: { auth: () => auth, firestore: () => ({}) },
    auth,
    adminAuth: auth,
    db: {},
    storage: {},
    getFirestore: () => ({}),
  };
});

vi.mock('../lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// The identity resolver is exercised directly below; the route tests here only
// need the guard to run, so the db is a stub that returns "no row".
vi.mock('../db', () => ({
  db: {
    select: () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) }),
    insert: () => ({ values: async () => undefined }),
    update: () => ({ set: () => ({ where: async () => undefined }) }),
  },
}));

import pinAuthRouter from '../routes/pin-auth';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/pin-auth', pinAuthRouter);
  return app;
}

const MUTATIONS: Array<[string, string, Record<string, unknown>]> = [
  ['post', '/api/pin-auth/setup', { pin: '1234', email: 'victim@petwash.co.il' }],
  ['post', '/api/pin-auth/change', { currentPin: '1111', newPin: '2222', email: 'victim@petwash.co.il' }],
  ['delete', '/api/pin-auth/remove', { pin: '1111', email: 'victim@petwash.co.il' }],
];

describe('pin-auth — authentication is mandatory (P0 regression)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.DEV_TEST_SECRET;
    delete process.env.TEST_BYPASS_TOKEN;
  });

  it.each(MUTATIONS)('%s %s rejects an unauthenticated caller', async (method, path, body) => {
    const res = await (request(makeApp()) as any)[method](path).send(body);
    expect(res.status).toBe(401);
    // and it must NOT have written anything for the body-supplied email
    expect(res.body.success).not.toBe(true);
  });

  it('GET /api/pin-auth/status rejects an unauthenticated caller (no PIN enumeration)', async () => {
    const res = await request(makeApp()).get('/api/pin-auth/status?email=victim@petwash.co.il');
    expect(res.status).toBe(401);
    expect(res.body.hasPin).toBeUndefined();
  });

  it('GET /api/pin-auth/device-trust/status rejects an unauthenticated caller', async () => {
    const res = await request(makeApp()).get('/api/pin-auth/device-trust/status');
    expect(res.status).toBe(401);
  });

  it('POST /api/pin-auth/device-trust/revoke rejects an unauthenticated caller', async () => {
    const res = await request(makeApp()).post('/api/pin-auth/device-trust/revoke').send({});
    expect(res.status).toBe(401);
  });

  it('an expired/invalid bearer token is rejected, not silently trusted', async () => {
    verifyIdToken.mockRejectedValue(Object.assign(new Error('expired'), { code: 'auth/id-token-expired' }));
    const res = await request(makeApp())
      .post('/api/pin-auth/setup')
      .set('Authorization', 'Bearer nope')
      .send({ pin: '1234' });
    expect(res.status).toBe(401);
  });
});

describe('pin-auth — a body email may never select a different account', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    verifyIdToken.mockResolvedValue({
      uid: 'attacker-uid',
      email: 'attacker@petwash.co.il',
      auth_time: Math.floor(Date.now() / 1000),
    });
  });

  it.each(MUTATIONS)('%s %s refuses a mismatched body email with EMAIL_MISMATCH', async (method, path, body) => {
    const res = await (request(makeApp()) as any)[method](path)
      .set('Authorization', 'Bearer good')
      .send(body);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('EMAIL_MISMATCH');
  });

  it('an authenticated caller with no PetWash row cannot set a PIN on someone else', async () => {
    // No body email at all — identity is purely the token UID, and the stub db
    // has no row for it, so the only possible answer is 404 (never a write).
    const res = await request(makeApp())
      .post('/api/pin-auth/setup')
      .set('Authorization', 'Bearer good')
      .send({ pin: '1234' });
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('status reports the CALLER, ignoring a ?email= pointed at another account', async () => {
    const res = await request(makeApp())
      .get('/api/pin-auth/status?email=victim@petwash.co.il')
      .set('Authorization', 'Bearer good');
    expect(res.status).toBe(200);
    // attacker-uid has no row in the stub db → its own posture, not the victim's
    expect(res.body).toMatchObject({ success: true, hasPin: false });
  });
});
