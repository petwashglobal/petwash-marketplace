/**
 * Behavioural test — GET /api/next-best-action route
 * (Journey Brain Phase 4 · post-release 2026-09-04).
 *
 * Real supertest against the router mounted in a fresh express app.
 * The underlying composer is mocked so the test focuses on the
 * ROUTE contract:
 *
 *   1. Anonymous callers (no uid) → 401 AUTH_REQUIRED. The uid never
 *      comes from a body/query/header the caller controls.
 *   2. Signed-in caller with no home state → 200 with the empty
 *      projection { primaryAction: null, secondaryActions: [] }.
 *   3. `actor` query defaults to pet_parent and is passed through to
 *      the composer; provider is honoured; anything else falls back
 *      to pet_parent (never a 400).
 *   4. `lang=en` flips the composer's `he` flag to false; anything
 *      else (including missing) keeps `he=true`.
 *   5. When the composer throws, the route surfaces 200 + empty
 *      projection (NEVER a 500) — mirrors the composer's fail-CLOSED
 *      contract so a partial outage cannot break home.
 *   6. The response is JSON with the expected shape — `primaryAction`,
 *      `secondaryActions` array, `composedAt` ISO string.
 */
import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let injectUid: string | null = null;
vi.mock('../middleware/firebase-auth', () => ({
  validateFirebaseToken: (req: any, _res: any, next: any) => {
    if (injectUid) {
      req.firebaseUser = { uid: injectUid };
    }
    return next();
  },
}));

let lastComposerArgs: any = null;
let composerReturn: any = null;
let composerThrows = false;

vi.mock('../services/nextBestAction', () => ({
  composeNextBestAction: vi.fn(async (_pool: any, args: any) => {
    lastComposerArgs = args;
    if (composerThrows) {
      throw new Error('composer boom');
    }
    return composerReturn;
  }),
}));

// The route imports the pool from `../db`; give it a harmless stub.
vi.mock('../db', () => ({
  pool: { query: vi.fn() },
}));

async function makeApp(uid: string | null) {
  injectUid = uid;
  const app = express();
  app.use(express.json());
  const router = (await import('../routes/next-best-action')).default;
  app.use('/api/next-best-action', router);
  return app;
}

beforeEach(() => {
  lastComposerArgs = null;
  composerThrows = false;
  composerReturn = {
    primaryAction: null,
    secondaryActions: [],
    composedAt: new Date('2026-09-04T00:00:00Z').toISOString(),
  };
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/next-best-action · behaviour', () => {
  it('401 AUTH_REQUIRED for an anonymous caller', async () => {
    const app = await makeApp(null);
    const res = await request(app).get('/api/next-best-action');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'AUTH_REQUIRED' });
    // Composer never called on an unauthenticated request.
    expect(lastComposerArgs).toBeNull();
  });

  it('200 empty projection for a signed-in caller with a quiet home', async () => {
    const app = await makeApp('usr_route_1');
    const res = await request(app).get('/api/next-best-action');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      primaryAction: null,
      secondaryActions: [],
      composedAt: '2026-09-04T00:00:00.000Z',
    });
    // uid comes from firebaseUser, never a body/query/header.
    expect(lastComposerArgs).toMatchObject({
      userUid: 'usr_route_1',
      actor: 'pet_parent',
      he: true,
    });
  });

  it('defaults actor=pet_parent when the query is omitted', async () => {
    const app = await makeApp('usr_route_2');
    await request(app).get('/api/next-best-action');
    expect(lastComposerArgs.actor).toBe('pet_parent');
  });

  it('honours actor=provider', async () => {
    const app = await makeApp('usr_route_3');
    await request(app).get('/api/next-best-action?actor=provider');
    expect(lastComposerArgs.actor).toBe('provider');
  });

  it('unknown actor value silently falls back to pet_parent (never 400)', async () => {
    const app = await makeApp('usr_route_4');
    const res = await request(app).get('/api/next-best-action?actor=hackerman');
    expect(res.status).toBe(200);
    expect(lastComposerArgs.actor).toBe('pet_parent');
  });

  it('lang=en flips he=false; every other value keeps he=true', async () => {
    const app1 = await makeApp('usr_route_5a');
    await request(app1).get('/api/next-best-action?lang=en');
    expect(lastComposerArgs.he).toBe(false);

    const app2 = await makeApp('usr_route_5b');
    await request(app2).get('/api/next-best-action?lang=he');
    expect(lastComposerArgs.he).toBe(true);

    const app3 = await makeApp('usr_route_5c');
    await request(app3).get('/api/next-best-action');
    expect(lastComposerArgs.he).toBe(true);
  });

  it('composer throw → 200 + empty projection (fail-CLOSED)', async () => {
    composerThrows = true;
    const app = await makeApp('usr_route_6');
    const res = await request(app).get('/api/next-best-action');
    expect(res.status).toBe(200);
    expect(res.body.primaryAction).toBeNull();
    expect(res.body.secondaryActions).toEqual([]);
    expect(typeof res.body.composedAt).toBe('string');
  });

  it('response shape carries a real ISO composedAt even on the empty envelope', async () => {
    const app = await makeApp('usr_route_7');
    const res = await request(app).get('/api/next-best-action');
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(typeof res.body.composedAt).toBe('string');
    expect(() => new Date(res.body.composedAt).toISOString()).not.toThrow();
  });

  it('passes through a populated projection verbatim (renderer is the client)', async () => {
    composerReturn = {
      primaryAction: {
        id: 'atn_1',
        actor: 'pet_parent',
        domain: 'booking',
        entityId: 'bk_1',
        priority: 'urgent',
        title: 'Pay to confirm',
        reason: 'Payment required',
        nextAction: 'pay',
        destination: '/wallet/pay/bk_1',
      },
      secondaryActions: [
        {
          kind: 'resume',
          domain: 'sitter_book',
          destination: '/sitter-suite',
          title: 'Resume your sitter booking',
          reason: 'saved',
          updatedAt: '2026-09-04T00:00:00Z',
          checkpointId: 'chk_1',
        },
      ],
      composedAt: '2026-09-04T00:00:00.000Z',
    };
    const app = await makeApp('usr_route_8');
    const res = await request(app).get('/api/next-best-action');
    expect(res.status).toBe(200);
    expect(res.body.primaryAction).toEqual(composerReturn.primaryAction);
    expect(res.body.secondaryActions).toEqual(composerReturn.secondaryActions);
  });
});
