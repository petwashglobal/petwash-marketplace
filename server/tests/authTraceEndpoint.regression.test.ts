/**
 * CEO MASTER §B41 §D4 (2026-08-29) — pins for POST /api/auth/trace-event.
 *
 * Endpoint is a WRITE-ONLY stage recorder. It must:
 *   * Accept a well-formed AuthJourney stage event.
 *   * Silently DROP any payload with a forbidden key (password / token /
 *     OTP / bank / email / phone / ID number / …). The response is
 *     ALWAYS 204 so a hostile probe cannot tell whether the payload was
 *     accepted or rejected.
 *   * Never surface a 5xx even under error — telemetry MUST NOT break
 *     the auth journey.
 */
import express, { type Express } from 'express';
import { describe, it, beforeAll, expect } from 'vitest';
import request from 'supertest';

let app: Express;

beforeAll(async () => {
  const router = (await import('../routes/auth-trace')).default;
  app = express();
  app.use(express.json());
  app.use('/api/auth', router);
});

describe('POST /api/auth/trace-event — CEO §B41 discipline', () => {
  it('accepts a well-formed stage event and returns 204', async () => {
    await request(app)
      .post('/api/auth/trace-event')
      .send({
        journeyId: 'abcdef0123456789',
        stage: 'FIREBASE_POPUP_SUCCEEDED',
        method: 'google',
        page: '/signin',
      })
      .expect(204);
  });

  it('returns 204 for every recognised stage', async () => {
    const stages = [
      'AUTH_PAGE_OPEN',
      'AUTH_METHOD_SELECTED',
      'FIREBASE_STARTED',
      'FIREBASE_SUCCESS',
      'SESSION_EXCHANGE_START',
      'SESSION_EXCHANGE_SUCCESS',
      'BOOTSTRAP_SUCCESS',
      'POST_LOGIN_SUCCESS',
      'NAVIGATION_SUCCESS',
    ];
    for (const stage of stages) {
      await request(app)
        .post('/api/auth/trace-event')
        .send({ journeyId: '1234567890abcdef', stage })
        .expect(204);
    }
  });

  it('silently drops (204) malformed payloads — bad journeyId', async () => {
    await request(app)
      .post('/api/auth/trace-event')
      .send({ journeyId: 'not-hex', stage: 'FIREBASE_SUCCESS' })
      .expect(204);
    await request(app)
      .post('/api/auth/trace-event')
      .send({ journeyId: 'abc', stage: 'FIREBASE_SUCCESS' })
      .expect(204);
  });

  it('silently drops (204) unknown stage names', async () => {
    await request(app)
      .post('/api/auth/trace-event')
      .send({ journeyId: 'abcdef0123456789', stage: 'DO_ANYTHING' })
      .expect(204);
  });

  it('§D4 — silently drops (204) payloads carrying forbidden keys', async () => {
    const badKeys = [
      'password', 'passcode', 'idToken', 'refreshToken', 'accessToken',
      'otp', 'email', 'phone', 'mobile', 'id_number', 'bank',
      'cvv', 'secret', 'credential', 'bearer',
    ];
    for (const k of badKeys) {
      const body: Record<string, unknown> = {
        journeyId: 'abcdef0123456789',
        stage: 'FIREBASE_SUCCESS',
      };
      body[k] = 'anything';
      await request(app)
        .post('/api/auth/trace-event')
        .send(body)
        .expect(204);
    }
  });

  it('never returns a 5xx — telemetry MUST NOT break the auth journey', async () => {
    // Send crap that would trip a naive JSON handler.
    await request(app)
      .post('/api/auth/trace-event')
      .send('not-json')
      .expect((res) => {
        expect(res.status, `unexpected ${res.status}`).toBeLessThan(500);
      });
    await request(app)
      .post('/api/auth/trace-event')
      .send({})
      .expect(204);
    await request(app)
      .post('/api/auth/trace-event')
      .send({ journeyId: null, stage: null })
      .expect(204);
  });
});
