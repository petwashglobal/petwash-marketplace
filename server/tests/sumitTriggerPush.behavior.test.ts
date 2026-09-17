/**
 * SUMIT trigger push — the URL is the credential, the body is trusted for
 * nothing (2026-09-18).
 *
 * SUMIT's trigger mechanism (/triggers/triggers/subscribe/) posts unsigned
 * JSON, so /api/sumit/webhook (HMAC) can never accept it. The push endpoint
 * takes an unguessable path token derived from SUMIT_WEBHOOK_SECRET and uses
 * the call only as a wake-up for the reconciliation, which re-reads payments
 * and documents from SUMIT with our own credentials.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const h = vi.hoisted(() => ({ runs: 0 }));
vi.mock('../cron/sumit-unclaimed-payments', () => ({
  runSumitUnclaimedPaymentWatch: async () => { h.runs += 1; return { listed: 0, unclaimed: 0, resolved: 0, ok: true }; },
}));
vi.mock('../middleware/rateLimiterRedisStore', () => ({ redisRateLimitStore: () => undefined }));
vi.mock('../services/redis', () => ({ redis: null }));

process.env.SUMIT_WEBHOOK_SECRET = 'test-secret-value-1234';
const { sumitTriggerToken } = await import('../lib/sumitTriggerToken');
const router = (await import('../routes/sumit-webhook')).default;

const app = express();
app.use('/api/sumit', router);
const TOKEN = sumitTriggerToken()!;

const settle = () => new Promise((r) => setTimeout(r, 30));

describe('POST /api/sumit/trigger/:token', () => {
  beforeEach(() => { h.runs = 0; });

  it('a correct token answers 200 and runs the reconciliation', async () => {
    const res = await request(app).post(`/api/sumit/trigger/${TOKEN}`).send({ anything: 'from sumit' });
    expect(res.status).toBe(200);
    await settle();
    expect(h.runs).toBe(1);
  });

  it('a wrong token is a 404 and runs nothing', async () => {
    const res = await request(app).post(`/api/sumit/trigger/${'0'.repeat(TOKEN.length)}`).send({});
    expect(res.status).toBe(404);
    await settle();
    expect(h.runs).toBe(0);
  });

  it('the body cannot name a payment, an order or an amount — it is only a wake-up', async () => {
    await request(app).post(`/api/sumit/trigger/${TOKEN}`).send({ PaymentID: 999, Amount: 100000, ExternalIdentifier: 'bkg_evil' });
    await settle();
    expect(h.runs).toBe(1);
    const src = readFileSync(resolve(__dirname, '..', 'routes', 'sumit-webhook.ts'), 'utf8');
    const handler = src.slice(src.indexOf("router.post(\n  '/trigger/:token'"), src.indexOf("router.post(\n  '/webhook'"));
    expect(handler).not.toMatch(/req\.body\.(PaymentID|Amount|ExternalIdentifier)/);
    expect(handler).toMatch(/runSumitUnclaimedPaymentWatch\(\)/);
  });

  it('the token is unguessable and derived, not a new production secret', () => {
    const lib = readFileSync(resolve(__dirname, '..', 'lib', 'sumitTriggerToken.ts'), 'utf8');
    expect(lib).toMatch(/createHmac\('sha256', secret\)/);
    expect(lib).toMatch(/timingSafeEqual/);
    expect(TOKEN).toMatch(/^[a-f0-9]{32}$/);
  });

  it('the CSRF gate lets exactly this path through', () => {
    const idx = readFileSync(resolve(__dirname, '..', 'index.ts'), 'utf8');
    expect(idx).toMatch(/\/\^\\\/api\\\/sumit\\\/trigger\\\/\[A-Za-z0-9\]\+\$\/\.test\(req\.path\)/);
  });
});
