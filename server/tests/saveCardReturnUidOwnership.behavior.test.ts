/**
 * Behavioural test — GET /api/payments/save-card/return (cross-tenant sweep, 2026-09-05).
 *
 * PRE-FIX PROBLEM: the /return handler trusted `uid` straight from the
 * querystring to decide whose account SumitCardVault.saveCard() should tie
 * the newly-tokenized card to. The redirect URL (including that `uid`
 * param) is fully visible/editable in the customer's own browser on the
 * way back from SUMIT, so a caller could swap in a victim's uid and have
 * their OWN card saved as the victim's payment method — a classic
 * "identity from a client-supplied field" IDOR.
 *
 * FIX: /start now remembers the real (server-derived, authenticated) uid
 * for the opaque externalId it generates, in Redis (one-shot, GETDEL). /return
 * looks the uid up by `ext` and ignores the querystring `uid` entirely.
 * (The store started life as a process-local Map; that was not durable across
 * Cloud Run instances — see saveCardRedisHandoffDurability.behavior.test.ts.)
 *
 * Real supertest against the router mounted in a fresh express app; SUMIT
 * and the vault are mocked so the test focuses on the ROUTE'S ownership
 * contract, not third-party wire shapes.
 */
import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Minimal in-test Redis stand-in — the handoff store the route now uses.
const redisStore = new Map<string, string>();
vi.mock('../services/redis', () => ({
  redis: {
    isConnected: () => true,
    async set(key: string, value: unknown) { redisStore.set(key, JSON.stringify(value)); return true; },
    async get(key: string) { const v = redisStore.get(key); return v ? JSON.parse(v) : null; },
    async getDel(key: string) { const v = redisStore.get(key) ?? null; redisStore.delete(key); return v; },
    async del(key: string) { redisStore.delete(key); return true; },
  },
}));

let injectUid: string | null = null;
vi.mock('../middleware/firebase-auth', () => ({
  validateFirebaseToken: (req: any, res: any, next: any) => {
    if (!injectUid) return res.status(401).json({ error: 'Unauthorized' });
    req.firebaseUser = { uid: injectUid, email: `${injectUid}@example.com` };
    return next();
  },
}));

let capturedExternalId: string | null = null;
vi.mock('../services/SumitClient', () => ({
  sumitClient: {
    beginRedirect: vi.fn(async (input: any) => {
      capturedExternalId = input.externalId;
      return { wired: true, redirectUrl: `https://sumit.example/pay?ext=${encodeURIComponent(input.externalId)}` };
    }),
    getTransaction: vi.fn(async (_txnId: string) => ({
      wired: true,
      valid: true,
      raw: { CustomerID: 'sumit_cust_1', PaymentMethodID: 'pm_1', CardBrand: 'visa', CardLast4: '4242' },
    })),
  },
}));

const saveCardMock = vi.fn(async (_input: any) => ({ saved: true }));
vi.mock('../services/SumitCardVault', () => ({
  isCardVaultEnabled: () => true,
  SumitCardVault: { saveCard: (input: any) => saveCardMock(input) },
}));

async function makeApp(uid: string | null) {
  injectUid = uid;
  const app = express();
  app.use(express.json());
  const router = (await import('../routes/save-card')).default;
  app.use('/api/payments', router);
  return app;
}

beforeEach(() => {
  redisStore.clear();
  capturedExternalId = null;
  saveCardMock.mockClear();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/payments/save-card/return · ownership is server-derived, not from the querystring', () => {
  it('ties the saved card to the uid that STARTED the flow, even when the return querystring claims a different uid', async () => {
    const app = await makeApp('victim_uid');

    // Victim authenticates and starts a save-card flow.
    const startRes = await request(app).post('/api/payments/save-card/start').send({});
    expect(startRes.status).toBe(200);
    // The external id is opaque: it must NOT leak the internal uid to SUMIT
    // or into the browser-visible redirect URL.
    expect(capturedExternalId).toMatch(/^savecard_[0-9a-f]{48}$/);
    expect(capturedExternalId).not.toContain('victim_uid');

    // Attacker (or the victim's own tampered browser) hits /return with the
    // SAME ext (the only thing that ties back to a real pending session) but
    // a DIFFERENT uid in the querystring, attempting to have the card saved
    // under the attacker's account instead.
    const returnRes = await request(app)
      .get('/api/payments/save-card/return')
      .query({ ID: 'txn_123', ext: capturedExternalId, uid: 'attacker_uid' });

    expect(returnRes.status).toBe(302);
    expect(returnRes.headers.location).toContain('card=saved');

    // The vault must have been called with the ORIGINAL (server-derived)
    // uid — never the querystring value.
    expect(saveCardMock).toHaveBeenCalledTimes(1);
    expect(saveCardMock.mock.calls[0][0]).toMatchObject({ userId: 'victim_uid' });
    expect(saveCardMock.mock.calls[0][0].userId).not.toBe('attacker_uid');
  });

  it('fails closed (no save, redirect card=failed) when ext does not match any pending /start session', async () => {
    const app = await makeApp('someone');

    const returnRes = await request(app)
      .get('/api/payments/save-card/return')
      .query({ ID: 'txn_999', ext: 'savecard_never-started_1', uid: 'anyone' });

    expect(returnRes.status).toBe(302);
    expect(returnRes.headers.location).toContain('card=failed');
    expect(saveCardMock).not.toHaveBeenCalled();
  });

  it('a return URL can only be consumed once — replaying it after a successful save fails closed', async () => {
    const app = await makeApp('replay_uid');

    const startRes = await request(app).post('/api/payments/save-card/start').send({});
    expect(startRes.status).toBe(200);
    const ext = capturedExternalId!;

    const first = await request(app)
      .get('/api/payments/save-card/return')
      .query({ ID: 'txn_1', ext, uid: 'replay_uid' });
    expect(first.headers.location).toContain('card=saved');
    expect(saveCardMock).toHaveBeenCalledTimes(1);

    const replay = await request(app)
      .get('/api/payments/save-card/return')
      .query({ ID: 'txn_1', ext, uid: 'replay_uid' });
    expect(replay.status).toBe(302);
    expect(replay.headers.location).toContain('card=failed');
    // Still only the one call from the first, legitimate return.
    expect(saveCardMock).toHaveBeenCalledTimes(1);
  });

  it('missing ext on /return fails closed without ever calling the vault', async () => {
    const app = await makeApp('someone');
    const res = await request(app)
      .get('/api/payments/save-card/return')
      .query({ ID: 'txn_1', uid: 'someone' });
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('card=failed');
    expect(saveCardMock).not.toHaveBeenCalled();
  });
});
