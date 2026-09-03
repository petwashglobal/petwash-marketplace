/**
 * Behavioural test — /api/journey/checkpoint(s) route (Lane C.3).
 *
 * Real supertest against the router mounted in a fresh express app.
 * Services and the DB pool are mocked with an in-process store so
 * the test is deterministic and pins actual HTTP behaviour:
 *
 *   1. Anonymous callers (no uid) get 401 — server-side auth is the
 *      only source of truth for identity.
 *   2. POST /checkpoint validates the domain against a closed enum
 *      (400 on unknown) and rejects a payload with a forbidden
 *      payment-truth key (400 FORBIDDEN_PAYLOAD_KEY).
 *   3. POST rejects payloads > 8 KB (413 PAYLOAD_TOO_LARGE).
 *   4. Happy path: POST returns { ok, id, domain, expiresAt } and
 *      calls saveCheckpoint(pool, { userUid, domain, payload, ttlHours }).
 *   5. GET /checkpoint/:domain returns 404 when the service returns
 *      null (no active row) — never a 500, never leaks pool state.
 *   6. GET /checkpoints returns { items } WITHOUT payload (list
 *      surface stays lean — callers fetch the specific row for the
 *      payload).
 *   7. DELETE /checkpoint/:domain returns { ok, cleared: bool }.
 *   8. A service-layer throw is caught by the outer try/catch and
 *      surfaces a plain 500 (never Postgres error text).
 *   9. The uid used for every service call comes from firebaseUser,
 *      NEVER from the body — the router ignores a body-supplied uid.
 */
import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the firebase-auth middleware so the router runs without a real
// Firebase Admin. `authUid` set by makeApp() controls which uid gets
// injected (or none, for the 401 path).
let injectUid: string | null = null;
vi.mock('../middleware/firebase-auth', () => ({
  validateFirebaseToken: (req: any, res: any, next: any) => {
    if (injectUid) {
      req.firebaseUser = { uid: injectUid };
    }
    return next();
  },
}));

// In-process store for the service mock so every mocked call reads /
// writes deterministic rows. Rows are keyed by (userUid, domain).
type Row = { id: string; userUid: string; domain: string; payload: any; expiresAt: Date; createdAt: Date; updatedAt: Date };
const store = new Map<string, Row>();
let throwOnNextSave = false;

vi.mock('../services/journeyCheckpoints', () => ({
  saveCheckpoint: vi.fn(async (_pool: any, args: any) => {
    if (throwOnNextSave) {
      throwOnNextSave = false;
      throw new Error('simulated pg error');
    }
    const key = `${args.userUid}:${args.domain}`;
    const now = new Date();
    const existing = store.get(key);
    const row: Row = {
      id: existing?.id ?? `chk_${Math.random().toString(36).slice(2, 10)}`,
      userUid: args.userUid,
      domain: args.domain,
      payload: args.payload,
      expiresAt: new Date(now.getTime() + (args.ttlHours ?? 72) * 3600 * 1000),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    store.set(key, row);
    return row;
  }),
  getActiveCheckpoint: vi.fn(async (_pool: any, args: any) => {
    const key = `${args.userUid}:${args.domain}`;
    const row = store.get(key);
    if (!row) return null;
    if (row.expiresAt.getTime() <= Date.now()) return null;
    return row;
  }),
  listActiveCheckpoints: vi.fn(async (_pool: any, args: any) => {
    const items: Row[] = [];
    for (const row of store.values()) {
      if (row.userUid !== args.userUid) continue;
      if (row.expiresAt.getTime() <= Date.now()) continue;
      items.push(row);
    }
    return items;
  }),
  clearCheckpoint: vi.fn(async (_pool: any, args: any) => {
    const key = `${args.userUid}:${args.domain}`;
    const existed = store.delete(key);
    return existed;
  }),
}));

vi.mock('../db', () => ({ pool: { query: vi.fn() } }));

// Import router AFTER the mocks so its module graph binds to the
// mocked versions.
import router from '../routes/journey-checkpoints';
import * as service from '../services/journeyCheckpoints';

function makeApp(uid: string | null): express.Express {
  injectUid = uid;
  const app = express();
  app.use(express.json());
  app.use('/api/journey', router);
  return app;
}

beforeEach(() => {
  store.clear();
  throwOnNextSave = false;
  vi.clearAllMocks();
});

afterEach(() => {
  injectUid = null;
});

describe('POST /api/journey/checkpoint', () => {
  it('rejects an anonymous caller with 401', async () => {
    const app = makeApp(null);
    const res = await request(app)
      .post('/api/journey/checkpoint')
      .send({ domain: 'sitter_book', payload: { step: 'details' } });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'AUTH_REQUIRED' });
    expect(service.saveCheckpoint).not.toHaveBeenCalled();
  });

  it('rejects an unknown domain with 400 INVALID_INPUT', async () => {
    const app = makeApp('usr_a');
    const res = await request(app)
      .post('/api/journey/checkpoint')
      .send({ domain: 'not_a_real_domain', payload: {} });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('INVALID_INPUT');
    expect(service.saveCheckpoint).not.toHaveBeenCalled();
  });

  it('rejects a payload carrying a forbidden payment-truth key', async () => {
    const app = makeApp('usr_a');
    const res = await request(app)
      .post('/api/journey/checkpoint')
      .send({ domain: 'sitter_book', payload: { chargeId: 'ch_123' } });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'FORBIDDEN_PAYLOAD_KEY', key: 'chargeId' });
    expect(service.saveCheckpoint).not.toHaveBeenCalled();
  });

  it('rejects a payload larger than 8 KB with 413', async () => {
    const app = makeApp('usr_a');
    // Build ~10 KB of payload data.
    const big = 'x'.repeat(10 * 1024);
    const res = await request(app)
      .post('/api/journey/checkpoint')
      .send({ domain: 'sitter_book', payload: { blob: big } });
    expect(res.status).toBe(413);
    expect(res.body.error).toBe('PAYLOAD_TOO_LARGE');
    expect(service.saveCheckpoint).not.toHaveBeenCalled();
  });

  it('happy path — saves + returns { ok, id, domain, expiresAt, updatedAt }', async () => {
    const app = makeApp('usr_a');
    const res = await request(app)
      .post('/api/journey/checkpoint')
      .send({ domain: 'sitter_book', payload: { step: 'details', sitterId: 'sit_1' } });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.domain).toBe('sitter_book');
    expect(typeof res.body.id).toBe('string');
    expect(typeof res.body.expiresAt).toBe('string');
    expect(typeof res.body.updatedAt).toBe('string');
    expect(service.saveCheckpoint).toHaveBeenCalledTimes(1);
    // The router MUST pass the server-verified uid, never a body-supplied one.
    const args = (service.saveCheckpoint as any).mock.calls[0][1];
    expect(args.userUid).toBe('usr_a');
    expect(args.domain).toBe('sitter_book');
    expect(args.payload).toEqual({ step: 'details', sitterId: 'sit_1' });
  });

  it('ignores a body-supplied uid — server identity is the ONLY source of truth', async () => {
    const app = makeApp('usr_real');
    await request(app)
      .post('/api/journey/checkpoint')
      .send({
        domain: 'sitter_book',
        payload: { step: 'details' },
        userUid: 'usr_attacker', // ← must be ignored
        userId: 'usr_attacker',
      });
    const args = (service.saveCheckpoint as any).mock.calls[0][1];
    expect(args.userUid).toBe('usr_real');
  });

  it('returns 500 CHECKPOINT_WRITE_FAILED when the service throws (no leaked pg error)', async () => {
    throwOnNextSave = true;
    const app = makeApp('usr_a');
    const res = await request(app)
      .post('/api/journey/checkpoint')
      .send({ domain: 'sitter_book', payload: { step: 'x' } });
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'CHECKPOINT_WRITE_FAILED' });
    // Response body MUST NOT carry any hint of the underlying error text.
    expect(JSON.stringify(res.body)).not.toContain('simulated pg error');
  });
});

describe('GET /api/journey/checkpoint/:domain', () => {
  it('returns 404 when no active row', async () => {
    const app = makeApp('usr_a');
    const res = await request(app).get('/api/journey/checkpoint/sitter_book');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'NO_ACTIVE_CHECKPOINT' });
  });

  it('returns 400 on an unknown domain', async () => {
    const app = makeApp('usr_a');
    const res = await request(app).get('/api/journey/checkpoint/foo');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('UNKNOWN_DOMAIN');
  });

  it('returns the payload after a save', async () => {
    const app = makeApp('usr_a');
    await request(app)
      .post('/api/journey/checkpoint')
      .send({ domain: 'walk_book', payload: { step: 'pick_dog', dogId: 42 } });
    const res = await request(app).get('/api/journey/checkpoint/walk_book');
    expect(res.status).toBe(200);
    expect(res.body.payload).toEqual({ step: 'pick_dog', dogId: 42 });
    expect(res.body.domain).toBe('walk_book');
  });

  it('does NOT surface another user\'s row', async () => {
    // usr_a saves.
    const appA = makeApp('usr_a');
    await request(appA)
      .post('/api/journey/checkpoint')
      .send({ domain: 'egift', payload: { amount: 100 } });
    // usr_b asks — sees nothing.
    const appB = makeApp('usr_b');
    const res = await request(appB).get('/api/journey/checkpoint/egift');
    expect(res.status).toBe(404);
  });
});

describe('GET /api/journey/checkpoints (list)', () => {
  it('returns items WITHOUT payload — list surface stays lean', async () => {
    const app = makeApp('usr_a');
    await request(app).post('/api/journey/checkpoint').send({ domain: 'sitter_book', payload: { step: 'details' } });
    await request(app).post('/api/journey/checkpoint').send({ domain: 'walk_book',   payload: { step: 'pick' } });
    const res = await request(app).get('/api/journey/checkpoints');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBe(2);
    for (const item of res.body.items) {
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('domain');
      expect(item).toHaveProperty('expiresAt');
      expect(item).toHaveProperty('updatedAt');
      expect(item).not.toHaveProperty('payload');
    }
  });

  it('never surfaces another user\'s items', async () => {
    const appA = makeApp('usr_a');
    await request(appA).post('/api/journey/checkpoint').send({ domain: 'sitter_book', payload: { step: 'x' } });
    const appB = makeApp('usr_b');
    const res = await request(appB).get('/api/journey/checkpoints');
    expect(res.body.items).toEqual([]);
  });
});

describe('DELETE /api/journey/checkpoint/:domain', () => {
  it('returns { ok, cleared: true } when a row existed', async () => {
    const app = makeApp('usr_a');
    await request(app).post('/api/journey/checkpoint').send({ domain: 'sitter_book', payload: { step: 'x' } });
    const res = await request(app).delete('/api/journey/checkpoint/sitter_book');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, cleared: true });
    // A subsequent GET must return 404.
    const after = await request(app).get('/api/journey/checkpoint/sitter_book');
    expect(after.status).toBe(404);
  });

  it('returns { ok, cleared: false } when there was nothing to clear (idempotent)', async () => {
    const app = makeApp('usr_a');
    const res = await request(app).delete('/api/journey/checkpoint/sitter_book');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, cleared: false });
  });
});
