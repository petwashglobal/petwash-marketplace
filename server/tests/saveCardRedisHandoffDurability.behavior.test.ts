/**
 * Behavioural test — save-card ownership handoff must survive across instances.
 *
 * PRE-FIX PROBLEM (#2263 as merged): the IDOR fix was correct about NOT trusting
 * the querystring uid, but it parked the trusted uid in a process-local
 * `Map`. Cloud Run runs min-instances=0 and scales, so /start and /return
 * routinely land on different instances. The map missed, the handler failed
 * closed — AFTER SUMIT had already taken the ₪1, which nothing refunds.
 *
 * FIX: the handoff lives in Redis, keyed by an opaque crypto-random external
 * id, written BEFORE SUMIT is called and consumed with an atomic GETDEL.
 *
 * The shared `redisStore` below is the whole point: both simulated instances
 * get a FRESH module registry (vi.resetModules) — so any process-local state
 * is genuinely separate — while pointing at one shared store, exactly like two
 * Cloud Run containers pointing at one Redis.
 */
import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── shared "Redis", outlives module resets ───────────────────────────────────
interface Entry { value: string; expiresAt: number }
const redisStore = new Map<string, Entry>();
let redisAvailable = true;

const redisMock = {
  isConnected: () => redisAvailable,
  async set(key: string, value: unknown, ttlSeconds?: number) {
    if (!redisAvailable) return false;
    redisStore.set(key, {
      value: JSON.stringify(value),
      expiresAt: Date.now() + (ttlSeconds ?? 60) * 1000,
    });
    return true;
  },
  async get<T>(key: string): Promise<T | null> {
    if (!redisAvailable) return null;
    const e = redisStore.get(key);
    if (!e) return null;
    if (e.expiresAt < Date.now()) { redisStore.delete(key); return null; }
    return JSON.parse(e.value) as T;
  },
  async getDel(key: string): Promise<string | null> {
    if (!redisAvailable) return null;
    const e = redisStore.get(key);
    redisStore.delete(key);              // atomic claim
    if (!e || e.expiresAt < Date.now()) return null;
    return e.value;
  },
  async del(key: string) {
    if (!redisAvailable) return false;
    redisStore.delete(key);
    return true;
  },
};

let injectUid: string | null = 'owner_uid';
let capturedExternalId: string | null = null;
let capturedRedirectUrl: string | null = null;
let beginRedirectOk = true;
let txnValid = true;
let txnRaw: any = { CustomerID: 'sumit_cust_1', PaymentMethodID: 'pm_1' };
const saveCardMock = vi.fn(async (_i: any) => ({ saved: true }));
const beginRedirectMock = vi.fn();

function installMocks() {
  vi.doMock('../services/redis', () => ({ redis: redisMock }));
  vi.doMock('../middleware/firebase-auth', () => ({
    validateFirebaseToken: (req: any, res: any, next: any) => {
      if (!injectUid) return res.status(401).json({ error: 'Unauthorized' });
      req.firebaseUser = { uid: injectUid, email: `${injectUid}@example.com` };
      return next();
    },
  }));
  vi.doMock('../services/SumitClient', () => ({
    sumitClient: {
      beginRedirect: vi.fn(async (input: any) => {
        beginRedirectMock(input);
        capturedExternalId = input.externalId;
        capturedRedirectUrl = input.redirectUrl;
        return beginRedirectOk
          ? { wired: true, redirectUrl: 'https://sumit.example/pay' }
          : { wired: true, redirectUrl: undefined, reason: 'sumit down' };
      }),
      getTransaction: vi.fn(async () => ({ wired: true, valid: txnValid, raw: txnRaw })),
    },
  }));
  vi.doMock('../services/SumitCardVault', () => ({
    isCardVaultEnabled: () => true,
    SumitCardVault: { saveCard: (i: any) => saveCardMock(i) },
  }));
}

/** A fresh module registry === a separate Cloud Run instance. */
async function bootInstance() {
  vi.resetModules();
  installMocks();
  const mod = await import('../routes/save-card');
  const app = express();
  app.use('/api/payments', (mod as any).default);
  return app;
}

beforeEach(() => {
  redisStore.clear();
  redisAvailable = true;
  injectUid = 'owner_uid';
  capturedExternalId = null;
  capturedRedirectUrl = null;
  beginRedirectOk = true;
  txnValid = true;
  txnRaw = { CustomerID: 'sumit_cust_1', PaymentMethodID: 'pm_1' };
  saveCardMock.mockClear();
  beginRedirectMock.mockClear();
});

describe('save-card ownership handoff — durable across instances', () => {
  it('THE PIN: /start on instance A, /return on instance B still saves to the right owner', async () => {
    const instanceA = await bootInstance();
    await request(instanceA).post('/api/payments/save-card/start').expect(200);
    const ext = capturedExternalId!;
    expect(ext).toBeTruthy();

    // Brand-new registry: instance A's process memory is gone.
    const instanceB = await bootInstance();
    await request(instanceB).get(`/api/payments/save-card/return?ID=txn_1&ext=${ext}`).expect(302);

    expect(saveCardMock).toHaveBeenCalledTimes(1);
    expect(saveCardMock.mock.calls[0][0].userId).toBe('owner_uid');
  });

  it('the external id is opaque — it leaks no uid, and the redirect URL carries no uid param', async () => {
    const app = await bootInstance();
    await request(app).post('/api/payments/save-card/start').expect(200);
    expect(capturedExternalId).not.toContain('owner_uid');
    expect(capturedExternalId).toMatch(/^savecard_[0-9a-f]{48}$/);
    expect(capturedRedirectUrl).not.toContain('uid=');
    expect(capturedRedirectUrl).not.toContain('owner_uid');
  });

  it('a forged querystring uid is irrelevant — ownership comes from Redis', async () => {
    const app = await bootInstance();
    await request(app).post('/api/payments/save-card/start').expect(200);
    const ext = capturedExternalId!;
    await request(app)
      .get(`/api/payments/save-card/return?ID=txn_1&ext=${ext}&uid=victim_uid`)
      .expect(302);
    expect(saveCardMock.mock.calls[0][0].userId).toBe('owner_uid');
  });

  it('Redis unavailable at /start → 503 and SUMIT is NEVER called (no ₪1 taken)', async () => {
    const app = await bootInstance();
    redisAvailable = false;
    await request(app).post('/api/payments/save-card/start').expect(503);
    expect(beginRedirectMock).not.toHaveBeenCalled();
  });

  it('SUMIT failing to start releases the pending key', async () => {
    const app = await bootInstance();
    beginRedirectOk = false;
    await request(app).post('/api/payments/save-card/start').expect(502);
    expect(redisStore.size).toBe(0);
  });

  it('missing pending record fails closed', async () => {
    const app = await bootInstance();
    await request(app)
      .get('/api/payments/save-card/return?ID=txn_1&ext=savecard_deadbeef')
      .expect(302)
      .expect('Location', /card=failed/);
    expect(saveCardMock).not.toHaveBeenCalled();
  });

  it('an expired pending record fails closed', async () => {
    const app = await bootInstance();
    await request(app).post('/api/payments/save-card/start').expect(200);
    const ext = capturedExternalId!;
    const key = `savecard:pending:${ext}`;
    redisStore.set(key, { value: redisStore.get(key)!.value, expiresAt: Date.now() - 1 });
    await request(app)
      .get(`/api/payments/save-card/return?ID=txn_1&ext=${ext}`)
      .expect(302)
      .expect('Location', /card=failed/);
    expect(saveCardMock).not.toHaveBeenCalled();
  });

  it('a duplicate callback cannot save twice (atomic one-shot claim)', async () => {
    const app = await bootInstance();
    await request(app).post('/api/payments/save-card/start').expect(200);
    const ext = capturedExternalId!;
    await request(app).get(`/api/payments/save-card/return?ID=txn_1&ext=${ext}`).expect(302);
    await request(app)
      .get(`/api/payments/save-card/return?ID=txn_1&ext=${ext}`)
      .expect(302)
      .expect('Location', /card=failed/);
    expect(saveCardMock).toHaveBeenCalledTimes(1);
  });

  it('a transaction for a DIFFERENT external reference cannot consume this handoff', async () => {
    const app = await bootInstance();
    await request(app).post('/api/payments/save-card/start').expect(200);
    const ext = capturedExternalId!;
    txnRaw = { CustomerID: 'sumit_cust_1', PaymentMethodID: 'pm_1', ExternalIdentifier: 'savecard_someone_else' };
    await request(app)
      .get(`/api/payments/save-card/return?ID=txn_1&ext=${ext}`)
      .expect(302)
      .expect('Location', /card=failed/);
    expect(saveCardMock).not.toHaveBeenCalled();
    // and the handoff is NOT burned — the rightful owner can still complete
    expect(redisStore.has(`savecard:pending:${ext}`)).toBe(true);
  });

  it('an unverified SUMIT transaction does not burn the pending record', async () => {
    const app = await bootInstance();
    await request(app).post('/api/payments/save-card/start').expect(200);
    const ext = capturedExternalId!;
    txnValid = false;
    await request(app).get(`/api/payments/save-card/return?ID=txn_1&ext=${ext}`).expect(302);
    expect(saveCardMock).not.toHaveBeenCalled();
    expect(redisStore.has(`savecard:pending:${ext}`)).toBe(true);
  });

  it('source pin: no process-local Map may hold ownership again', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const src = readFileSync(join(__dirname, '..', 'routes', 'save-card.ts'), 'utf8');
    expect(src).not.toMatch(/new Map\s*</);
    expect(src).toMatch(/redis\.getDel\(/);
    expect(src).toMatch(/redis\.set\(/);
  });
});
