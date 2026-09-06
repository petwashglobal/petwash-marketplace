/**
 * Wire-contract pins for /api/verification.
 *
 * Two things are proven here:
 *
 *  1. THE RAW DESTINATION NEVER LEAVES THE SERVER. publicChallenge() used to
 *     echo `destination` verbatim, so every /start and /verify response body
 *     carried a full email address or phone number — the same class #2253
 *     closed for Sentry. The client only ever needs "which inbox", which
 *     `maskedDestination` answers.
 *
 *  2. /resend EXISTS AND IS THE CANONICAL ONE. resendChallenge() has been in
 *     the service all along with no HTTP route, which is exactly why surfaces
 *     grew their own resend endpoints — or worse, called /start again and
 *     silently invalidated the code already in the customer's inbox.
 */
import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const startMock = vi.fn();
const verifyMock = vi.fn();
const resendMock = vi.fn();

class FakeUnifiedVerificationError extends Error {
  constructor(
    public readonly reasonCode: string,
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
    this.name = 'UnifiedVerificationError';
  }
}

vi.mock('../lib/feature-flags/unifiedVerification', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    isUnifiedVerificationEnabled: () => true,
    requireUnifiedVerificationEnabled: (_req: any, _res: any, next: any) => next(),
  };
});

vi.mock('../services/UnifiedVerificationService', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    UnifiedVerificationError: FakeUnifiedVerificationError,
    unifiedVerificationService: {
      startChallenge: (...a: any[]) => startMock(...a),
      verifyChallenge: (...a: any[]) => verifyMock(...a),
      resendChallenge: (...a: any[]) => resendMock(...a),
    },
  };
});

async function makeApp() {
  const router = (await import('../routes/verification')).default;
  const app = express();
  app.use(express.json());
  app.use('/api/verification', router);
  return app;
}

const MASKED_CHALLENGE = {
  challengeId: 'ch_00000000000000000000',
  purpose: 'login',
  channel: 'email',
  maskedDestination: 'n•••••••1@gmail.com',
  status: 'pending',
  expiresAt: new Date(Date.now() + 300_000).toISOString(),
  resendAvailableAt: new Date(Date.now() + 60_000).toISOString(),
  attempts: 0,
  maxAttempts: 5,
};

beforeEach(() => {
  startMock.mockReset();
  verifyMock.mockReset();
  resendMock.mockReset();
});

describe('the raw destination never reaches the client', () => {
  it('publicChallenge does not build a `destination` field at all', () => {
    const src = readFileSync(
      join(__dirname, '..', 'services', 'UnifiedVerificationService.ts'),
      'utf8',
    );
    const fn = src.slice(
      src.indexOf('function publicChallenge'),
      src.indexOf('async function recordOtpEvent'),
    );
    expect(fn).toContain('maskedDestination');
    // The only mention of `destination` inside the builder may be as an
    // ARGUMENT to the masker — never as a returned property.
    expect(fn).not.toMatch(/^\s*destination:/m);
  });

  it('/start returns the masked destination and no raw address', async () => {
    startMock.mockResolvedValue({ ok: true, challenge: MASKED_CHALLENGE, delivery: { queued: true } });
    const app = await makeApp();
    const res = await request(app)
      .post('/api/verification/start')
      .send({ purpose: 'login', channel: 'email', destination: 'nirhadad1@gmail.com' })
      .expect(201);

    expect(res.body.challenge.maskedDestination).toBe('n•••••••1@gmail.com');
    expect(res.body.challenge.destination).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain('nirhadad1@gmail.com');
  });
});

describe('POST /api/verification/resend', () => {
  it('exists and calls the canonical service method', async () => {
    resendMock.mockResolvedValue({ ok: true, challenge: MASKED_CHALLENGE, delivery: { queued: true } });
    const app = await makeApp();
    await request(app)
      .post('/api/verification/resend')
      .send({ challengeId: MASKED_CHALLENGE.challengeId })
      .expect(200);

    expect(resendMock).toHaveBeenCalledTimes(1);
    expect(resendMock.mock.calls[0][0].challengeId).toBe(MASKED_CHALLENGE.challengeId);
  });

  it('rejects a malformed challengeId before touching the service', async () => {
    const app = await makeApp();
    await request(app).post('/api/verification/resend').send({ challengeId: 'x' }).expect(400);
    expect(resendMock).not.toHaveBeenCalled();
  });

  it('surfaces the cooldown as 429 so a customer cannot send twenty emails', async () => {
    resendMock.mockRejectedValue(
      new FakeUnifiedVerificationError('CHALLENGE_COOLDOWN', 'Please wait.', 429),
    );
    const app = await makeApp();
    const res = await request(app)
      .post('/api/verification/resend')
      .send({ challengeId: MASKED_CHALLENGE.challengeId })
      .expect(429);
    expect(res.body.reasonCode).toBe('CHALLENGE_COOLDOWN');
  });

  it('surfaces an expired challenge as 410, not a generic 500', async () => {
    resendMock.mockRejectedValue(
      new FakeUnifiedVerificationError('CHALLENGE_EXPIRED', 'Expired.', 410),
    );
    const app = await makeApp();
    const res = await request(app)
      .post('/api/verification/resend')
      .send({ challengeId: MASKED_CHALLENGE.challengeId })
      .expect(410);
    expect(res.body.reasonCode).toBe('CHALLENGE_EXPIRED');
  });

  it('a resend response also carries no raw destination', async () => {
    resendMock.mockResolvedValue({ ok: true, challenge: MASKED_CHALLENGE, delivery: { queued: true } });
    const app = await makeApp();
    const res = await request(app)
      .post('/api/verification/resend')
      .send({ challengeId: MASKED_CHALLENGE.challengeId })
      .expect(200);
    expect(res.body.challenge.destination).toBeUndefined();
  });
});

describe('/status publishes the channel policy for the UI', () => {
  it('every purpose ships allowedChannels + recommendedChannel', async () => {
    const app = await makeApp();
    const res = await request(app).get('/api/verification/status').expect(200);
    expect(res.body.purposes.length).toBeGreaterThan(0);
    for (const p of res.body.purposes) {
      expect(Array.isArray(p.allowedChannels), p.purpose).toBe(true);
      expect(p.allowedChannels).toContain(p.recommendedChannel);
    }
  });

  it('change_email is published as email-only', async () => {
    const app = await makeApp();
    const res = await request(app).get('/api/verification/status').expect(200);
    const changeEmail = res.body.purposes.find((p: any) => p.purpose === 'change_email');
    expect(changeEmail.allowedChannels).toEqual(['email']);
  });
});
