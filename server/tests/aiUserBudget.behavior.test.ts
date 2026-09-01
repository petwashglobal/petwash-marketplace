/**
 * Behavioural test — aiUserBudget middleware.
 *
 * AUDIT-AI-8 (#203, CEO Lane A slice 1). Proves the per-identity daily
 * budget middleware:
 *
 *   1. Allows requests up to the limit.
 *   2. Rejects with 429 AI_DAILY_BUDGET_EXCEEDED past the limit.
 *   3. Keys authenticated callers by Firebase UID (independent buckets
 *      per user).
 *   4. Keys anonymous callers by IP with a STRICTER cap (proves the
 *      two knobs work).
 *   5. Charges token equivalents via req.aiBudget.chargeTokens so a
 *      handler that emits 1500 output tokens burns 3 request-equivalents.
 *   6. In production, a Redis outage fails CLOSED (503) — the CEO's
 *      "missing infra → 503, not silent bypass" invariant.
 *
 * Redis is mocked with an in-process store the test controls, so
 * budgets deterministically reset per test.
 */
import express, { Request, Response } from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, number>();
let connected = true;

vi.mock('../services/redis', () => ({
  redis: {
    isConnected: () => connected,
    incr: vi.fn(async (key: string) => {
      const n = (store.get(key) ?? 0) + 1;
      store.set(key, n);
      return n;
    }),
    expire: vi.fn(async () => true),
  },
}));

// Import AFTER the mock so the module resolution uses the mocked redis.
import { aiUserBudget, AI_BUDGET_DEFAULT_AUTH, AI_BUDGET_DEFAULT_ANON } from '../middleware/aiUserBudget';

beforeEach(() => {
  store.clear();
  connected = true;
});

afterEach(() => {
  process.env.NODE_ENV = 'test';
});

function makeApp(opts: {
  authUid?: string;
  dailyLimitAuthenticated?: number;
  dailyLimitAnonymous?: number;
  chargeTokens?: number;
}): express.Express {
  const app = express();
  app.use(express.json());
  // Optional identity injector — real deploys set this from the Firebase
  // ID token middleware; the test injects it directly.
  app.use((req, _res, next) => {
    if (opts.authUid) {
      (req as any).firebaseUser = { uid: opts.authUid };
    }
    next();
  });
  app.post(
    '/ai',
    aiUserBudget({
      endpointTag: 'test',
      dailyLimitAuthenticated: opts.dailyLimitAuthenticated ?? 3,
      dailyLimitAnonymous: opts.dailyLimitAnonymous ?? 2,
    }),
    async (req: Request, res: Response) => {
      if (opts.chargeTokens) {
        await (req as any).aiBudget?.chargeTokens(opts.chargeTokens);
      }
      res.json({ ok: true, budgetKey: (req as any).aiBudget?.budgetKey });
    },
  );
  return app;
}

describe('aiUserBudget middleware (AUDIT-AI-8)', () => {
  it('allows requests up to the authenticated limit, then 429s', async () => {
    const app = makeApp({ authUid: 'user-A', dailyLimitAuthenticated: 3 });
    const s1 = await request(app).post('/ai').send({});
    const s2 = await request(app).post('/ai').send({});
    const s3 = await request(app).post('/ai').send({});
    const s4 = await request(app).post('/ai').send({});
    expect([s1.status, s2.status, s3.status]).toEqual([200, 200, 200]);
    expect(s4.status).toBe(429);
    expect(s4.body.error).toBe('AI_DAILY_BUDGET_EXCEEDED');
  });

  it('keys authenticated callers by UID — independent buckets', async () => {
    const appA = makeApp({ authUid: 'user-A', dailyLimitAuthenticated: 2 });
    const appB = makeApp({ authUid: 'user-B', dailyLimitAuthenticated: 2 });
    // Exhaust A.
    await request(appA).post('/ai').send({});
    await request(appA).post('/ai').send({});
    const aExhausted = await request(appA).post('/ai').send({});
    expect(aExhausted.status).toBe(429);
    // B still has their whole bucket.
    const bFresh = await request(appB).post('/ai').send({});
    expect(bFresh.status).toBe(200);
  });

  it('anonymous callers get the STRICTER anonymous cap', async () => {
    const app = makeApp({ dailyLimitAnonymous: 2, dailyLimitAuthenticated: 100 });
    const s1 = await request(app).post('/ai').send({});
    const s2 = await request(app).post('/ai').send({});
    const s3 = await request(app).post('/ai').send({});
    expect([s1.status, s2.status]).toEqual([200, 200]);
    // The strict anonymous cap fires — even though authenticated cap is 100.
    expect(s3.status).toBe(429);
  });

  it('chargeTokens bills output-token equivalents against the same key', async () => {
    // 500 tokens per equivalent. 1500 tokens = 3 equivalents added on top
    // of the initial 1-unit charge. With a limit of 5, request 2 (500t)
    // should still pass (1 + 1 = 2 units), request 3 (1500t) fills 3-4-5,
    // request 4 should be 429.
    const app = makeApp({ authUid: 'user-heavy', dailyLimitAuthenticated: 5, chargeTokens: 1500 });
    // First request: base 1 + 3 (from 1500 tokens) = 4 spent.
    const s1 = await request(app).post('/ai').send({});
    expect(s1.status).toBe(200);
    // Second request: base 1 (now at 5) + 3 more (to 8) — but the middleware
    // fires the block on the BASE increment, so the second request lands at 5,
    // is under the limit, gets through, and THEN charges 3 more taking us to 8.
    // Third request base 1 → 9 → 429.
    const s2 = await request(app).post('/ai').send({});
    expect(s2.status).toBe(200);
    const s3 = await request(app).post('/ai').send({});
    expect(s3.status).toBe(429);
  });

  it('production + Redis outage → 503 AI_BUDGET_UNAVAILABLE (fails closed)', async () => {
    process.env.NODE_ENV = 'production';
    connected = false;
    const app = makeApp({ authUid: 'user-A' });
    const res = await request(app).post('/ai').send({});
    expect(res.status).toBe(503);
    expect(res.body.error).toBe('AI_BUDGET_UNAVAILABLE');
  });

  it('non-production + Redis outage → allows through (dev must not require Redis)', async () => {
    process.env.NODE_ENV = 'development';
    connected = false;
    const app = makeApp({ authUid: 'user-A' });
    const res = await request(app).post('/ai').send({});
    expect(res.status).toBe(200);
  });

  it('exposes the default budget presets', () => {
    expect(AI_BUDGET_DEFAULT_AUTH).toBeGreaterThan(AI_BUDGET_DEFAULT_ANON);
    expect(AI_BUDGET_DEFAULT_ANON).toBeGreaterThan(0);
  });
});
