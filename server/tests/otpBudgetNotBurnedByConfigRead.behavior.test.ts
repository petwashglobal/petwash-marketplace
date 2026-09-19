import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

/**
 * 2026-09-19, from production logs for the previous 24h:
 *   /api/auth/sms/status  429  x245
 *
 * otpLimiter is 5 requests per 5 minutes per IP. It was applied to the whole
 * /api/auth/sms mount, so GET /status — a read-only config check that sends
 * no SMS — spent the same budget as actually sending one. SignUpLuxury calls
 * it on every page load, so opening the signup page burned one of the five.
 * A few loads, or several people behind one carrier NAT (normal on Israeli
 * mobile), exhausted the window before anyone typed a phone number, and
 * POST /start then answered 429 too.
 */

const spent: string[] = [];
vi.mock('../middleware/rateLimiter', () => ({
  otpLimiter: (req: any, _res: any, next: any) => {
    spent.push(`${req.method} ${req.path}`);
    next();
  },
}));

const { otpLimiterExceptReadOnly } = await import('../middleware/otpLimiterExceptReadOnly');

function app() {
  const a = express();
  const r = express.Router();
  r.get('/status', (_q, s) => s.json({ ok: true }));
  r.post('/start', (_q, s) => s.json({ ok: true }));
  r.post('/verify', (_q, s) => s.json({ ok: true }));
  a.use('/api/auth/sms', otpLimiterExceptReadOnly, r);
  return a;
}

describe('the OTP budget is only spent by things that send an OTP', () => {
  beforeEach(() => { spent.length = 0; });

  it('GET /status does not touch the OTP limiter', async () => {
    await request(app()).get('/api/auth/sms/status').expect(200);
    expect(spent).toEqual([]);
  });

  it('opening the signup page ten times still costs nothing', async () => {
    for (let i = 0; i < 10; i++) await request(app()).get('/api/auth/sms/status').expect(200);
    expect(spent).toEqual([]);
  });

  it('POST /start — which really sends an SMS — is still limited', async () => {
    await request(app()).post('/api/auth/sms/start').send({}).expect(200);
    expect(spent).toEqual(['POST /start']);
  });

  it('POST /verify is still limited', async () => {
    await request(app()).post('/api/auth/sms/verify').send({}).expect(200);
    expect(spent).toEqual(['POST /verify']);
  });

  it('a POST to /status would still be limited — only the safe GET is exempt', async () => {
    await request(app()).post('/api/auth/sms/status').send({});
    expect(spent).toEqual(['POST /status']);
  });
});
