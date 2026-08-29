/**
 * POST /api/actions/:actionType/execute — route behavior pins
 * (Action Brain Doctrine §5, §8, §10, §39, §41, §93).
 */
import express from 'express';
import request from 'supertest';
import { describe, it, expect, vi } from 'vitest';
import {
  buildActionExecutionRouter,
  type ActionHandler,
} from '../routes/action-execution';
import { createInMemoryStore } from '../../shared/marketplace/actionExecution';

function makeApp(handlers: Map<string, ActionHandler>, authedUid: string | null = 'sarah') {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    if (authedUid) (req as any).firebaseUser = { uid: authedUid };
    next();
  });
  const router = buildActionExecutionRouter({
    store: createInMemoryStore(),
    handlers,
    correlationIdFor: () => 'corr_test',
  });
  app.use('/api/actions', router);
  return app;
}

const goodHandler: ActionHandler = async () => ({
  status: 'SUCCEEDED',
  newState: 'CANCELLED',
  userMessage: { code: 'OK' },
  nextActions: ['SUPPORT_CONTACT_OPEN'],
});

const validBody = {
  entityId: 'bkg_1',
  previewVersion: 'v1',
  idempotencyKey: { key: 'k_abc', scope: 'per-intent' as const },
  impact: { moneyCents: 5000, affectsOtherParty: true },
  reauthProven: false,
};

describe('auth gate', () => {
  it('no firebaseUser → 401 REAUTH_REQUIRED', async () => {
    const app = makeApp(new Map([['BOOKING_CANCEL_PAID', goodHandler]]), null);
    const res = await request(app)
      .post('/api/actions/BOOKING_CANCEL_PAID/execute')
      .send(validBody);
    expect(res.status).toBe(401);
    expect(res.body.reasonCode).toBe('REAUTH_REQUIRED');
  });
});

describe('unknown actionType', () => {
  it('actionType not in the catalog → 404 UNKNOWN', async () => {
    const app = makeApp(new Map());
    const res = await request(app)
      .post('/api/actions/DOES_NOT_EXIST/execute')
      .send(validBody);
    expect(res.status).toBe(404);
    expect(res.body.reasonCode).toBe('UNKNOWN');
  });

  it('catalog entry but no handler → 501 UNKNOWN', async () => {
    const app = makeApp(new Map()); // BOOKING_CANCEL_PAID exists in catalog but no handler
    const res = await request(app)
      .post('/api/actions/BOOKING_CANCEL_PAID/execute')
      .send(validBody);
    expect(res.status).toBe(501);
    expect(res.body.reasonCode).toBe('UNKNOWN');
  });
});

describe('input validation', () => {
  it('missing entityId → 400', async () => {
    const app = makeApp(new Map([['BOOKING_CANCEL_PAID', goodHandler]]));
    const res = await request(app)
      .post('/api/actions/BOOKING_CANCEL_PAID/execute')
      .send({ ...validBody, entityId: undefined });
    expect(res.status).toBe(400);
  });

  it('missing previewVersion → 400 STALE_PREVIEW', async () => {
    const app = makeApp(new Map([['BOOKING_CANCEL_PAID', goodHandler]]));
    const res = await request(app)
      .post('/api/actions/BOOKING_CANCEL_PAID/execute')
      .send({ ...validBody, previewVersion: undefined });
    expect(res.status).toBe(400);
    expect(res.body.reasonCode).toBe('STALE_PREVIEW');
  });

  it('missing idempotencyKey → 400 IDEMPOTENCY_REPLAY', async () => {
    const app = makeApp(new Map([['BOOKING_CANCEL_PAID', goodHandler]]));
    const res = await request(app)
      .post('/api/actions/BOOKING_CANCEL_PAID/execute')
      .send({ ...validBody, idempotencyKey: undefined });
    expect(res.status).toBe(400);
    expect(res.body.reasonCode).toBe('IDEMPOTENCY_REPLAY');
  });
});

describe('happy path', () => {
  it('valid execute returns 200 with { ok: true, result: ActionResult }', async () => {
    const app = makeApp(new Map([['BOOKING_CANCEL_PAID', goodHandler]]));
    const res = await request(app)
      .post('/api/actions/BOOKING_CANCEL_PAID/execute')
      .send(validBody);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.result.status).toBe('SUCCEEDED');
    expect(res.body.result.actionId).toMatch(/^act_/);
    expect(res.body.result.correlationId).toBe('corr_test');
    expect(res.body.result.userMessage.code).toBe('OK');
    expect(res.body.result.nextActions).toContain('SUPPORT_CONTACT_OPEN');
  });
});

describe('idempotency at the HTTP layer', () => {
  it('two POSTs with same idempotencyKey → handler runs once; second returns same actionId', async () => {
    const handler = vi.fn(goodHandler);
    const app = makeApp(new Map([['BOOKING_CANCEL_PAID', handler]]));
    const res1 = await request(app)
      .post('/api/actions/BOOKING_CANCEL_PAID/execute')
      .send(validBody);
    const res2 = await request(app)
      .post('/api/actions/BOOKING_CANCEL_PAID/execute')
      .send(validBody);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(res2.body.result.actionId).toBe(res1.body.result.actionId);
  });
});

describe('reauth gate at the HTTP layer', () => {
  it('L4 action (ACCOUNT_DELETE) without reauthProven → FAILED + REAUTH_REQUIRED at status 200', async () => {
    // Doctrine §39: response HTTP status stays 200; the ActionResult
    // carries the outcome. Client renders based on result.status.
    const handler: ActionHandler = async () => ({
      status: 'SUCCEEDED',
      userMessage: { code: 'OK' },
      nextActions: [],
    });
    const app = makeApp(new Map([['ACCOUNT_DELETE', handler]]));
    const res = await request(app)
      .post('/api/actions/ACCOUNT_DELETE/execute')
      .send({ ...validBody, reauthProven: false });
    expect(res.status).toBe(200);
    expect(res.body.result.status).toBe('FAILED');
    expect(res.body.result.userMessage.code).toBe('REAUTH_REQUIRED');
  });

  it('L4 action WITH reauthProven → proceeds', async () => {
    const app = makeApp(new Map([['ACCOUNT_DELETE', goodHandler]]));
    const res = await request(app)
      .post('/api/actions/ACCOUNT_DELETE/execute')
      .send({ ...validBody, reauthProven: true });
    expect(res.body.result.status).toBe('SUCCEEDED');
  });
});
