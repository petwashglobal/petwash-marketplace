/**
 * POST /api/actions/:actionType/execute — route behavior pins
 * (Action Brain Doctrine §5, §8, §10, §39, §41, §93 +
 *  SECURITY CORRECTION 2026-08-30 §1–§7).
 */
import express from 'express';
import request from 'supertest';
import { describe, it, expect, vi } from 'vitest';
import {
  buildActionExecutionRouter,
  type ActionHandler,
} from '../routes/action-execution';
import {
  createInMemoryTestOnlyStore,
  type ImpactResolver,
  type ServerAuthContext,
} from '../../shared/marketplace/actionExecution';

interface MakeAppOpts {
  handlers: Map<string, ActionHandler>;
  impactResolvers?: Map<string, ImpactResolver>;
  auth?: ServerAuthContext | null;
  isMutationEnabled?: () => boolean;
}

function makeApp(o: MakeAppOpts) {
  const app = express();
  app.use(express.json());
  const router = buildActionExecutionRouter({
    store: createInMemoryTestOnlyStore(),
    handlers: o.handlers,
    impactResolvers: o.impactResolvers ?? new Map(),
    authContextFor: () => o.auth ?? null,
    isMutationEnabled: o.isMutationEnabled ?? (() => true),
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
};

const cancelPaidImpact: ImpactResolver = async () => ({
  moneyCents: 5000,
  affectsOtherParty: true,
});

describe('CEO §7 — feature flag: mutations off by default', () => {
  it('isMutationEnabled=false → 503 + UNKNOWN reasonCode', async () => {
    const app = makeApp({
      handlers: new Map([['CUSTOMER_CANCEL_BOOKING_PAID', goodHandler]]),
      impactResolvers: new Map([['CUSTOMER_CANCEL_BOOKING_PAID', cancelPaidImpact]]),
      auth: { actorUid: 'sarah' },
      isMutationEnabled: () => false,
    });
    const res = await request(app)
      .post('/api/actions/CUSTOMER_CANCEL_BOOKING_PAID/execute')
      .send(validBody);
    expect(res.status).toBe(503);
    expect(res.body.reasonCode).toBe('UNKNOWN');
  });
});

describe('CEO §1, §2 — client cannot supply security fields', () => {
  it('body-supplied impact / reauthProven / riskLevel are IGNORED — server derives everything', async () => {
    const app = makeApp({
      handlers: new Map([['CUSTOMER_CANCEL_BOOKING_PAID', goodHandler]]),
      // Server derives HIGH impact — the client tries to lie with low impact.
      impactResolvers: new Map([['CUSTOMER_CANCEL_BOOKING_PAID', async () => ({ moneyCents: 5000, affectsOtherParty: true })]]),
      auth: { actorUid: 'sarah' },
    });
    const res = await request(app)
      .post('/api/actions/CUSTOMER_CANCEL_BOOKING_PAID/execute')
      .send({
        ...validBody,
        // ⛔ these fields should NOT influence anything — server ignores them.
        impact: { moneyCents: 0 },
        reauthProven: true,
        riskLevel: 'L0',
        confirmationLevel: 'NONE',
      });
    // The action's catalog says EXPLICIT_CONFIRM (L3 + money impact);
    // server-derived impact + catalog agree → proceed. If the route
    // had trusted the body's impact:{moneyCents:0}, resolveConfirmation
    // would derive LIGHT_CONFIRM which disagrees with catalog
    // EXPLICIT_CONFIRM → the request would return STALE_PREVIEW.
    // Getting SUCCEEDED here proves body fields were IGNORED.
    expect(res.status).toBe(200);
    expect(res.body.result.status).toBe('SUCCEEDED');
  });
});

describe('auth gate', () => {
  it('no auth context → 401 REAUTH_REQUIRED', async () => {
    const app = makeApp({
      handlers: new Map([['CUSTOMER_CANCEL_BOOKING_PAID', goodHandler]]),
      auth: null,
    });
    const res = await request(app)
      .post('/api/actions/CUSTOMER_CANCEL_BOOKING_PAID/execute')
      .send(validBody);
    expect(res.status).toBe(401);
    expect(res.body.reasonCode).toBe('REAUTH_REQUIRED');
  });
});

describe('catalog / handler / impact registration gates', () => {
  it('unknown actionType → 404 UNKNOWN', async () => {
    const app = makeApp({ handlers: new Map(), auth: { actorUid: 'sarah' } });
    const res = await request(app)
      .post('/api/actions/DOES_NOT_EXIST/execute')
      .send(validBody);
    expect(res.status).toBe(404);
    expect(res.body.reasonCode).toBe('UNKNOWN');
  });

  it('catalog entry but no handler → 501', async () => {
    const app = makeApp({
      handlers: new Map(),
      impactResolvers: new Map([['CUSTOMER_CANCEL_BOOKING_PAID', cancelPaidImpact]]),
      auth: { actorUid: 'sarah' },
    });
    const res = await request(app)
      .post('/api/actions/CUSTOMER_CANCEL_BOOKING_PAID/execute')
      .send(validBody);
    expect(res.status).toBe(501);
  });

  it('handler registered but NO impact resolver → 501 (safer to refuse than guess)', async () => {
    const app = makeApp({
      handlers: new Map([['CUSTOMER_CANCEL_BOOKING_PAID', goodHandler]]),
      impactResolvers: new Map(),
      auth: { actorUid: 'sarah' },
    });
    const res = await request(app)
      .post('/api/actions/CUSTOMER_CANCEL_BOOKING_PAID/execute')
      .send(validBody);
    expect(res.status).toBe(501);
  });
});

describe('input validation', () => {
  it('missing entityId → 400', async () => {
    const app = makeApp({
      handlers: new Map([['CUSTOMER_CANCEL_BOOKING_PAID', goodHandler]]),
      impactResolvers: new Map([['CUSTOMER_CANCEL_BOOKING_PAID', cancelPaidImpact]]),
      auth: { actorUid: 'sarah' },
    });
    const res = await request(app)
      .post('/api/actions/CUSTOMER_CANCEL_BOOKING_PAID/execute')
      .send({ ...validBody, entityId: undefined });
    expect(res.status).toBe(400);
  });

  it('missing previewVersion → 400 STALE_PREVIEW', async () => {
    const app = makeApp({
      handlers: new Map([['CUSTOMER_CANCEL_BOOKING_PAID', goodHandler]]),
      impactResolvers: new Map([['CUSTOMER_CANCEL_BOOKING_PAID', cancelPaidImpact]]),
      auth: { actorUid: 'sarah' },
    });
    const res = await request(app)
      .post('/api/actions/CUSTOMER_CANCEL_BOOKING_PAID/execute')
      .send({ ...validBody, previewVersion: undefined });
    expect(res.status).toBe(400);
    expect(res.body.reasonCode).toBe('STALE_PREVIEW');
  });

  it('missing idempotencyKey → 400 IDEMPOTENCY_REPLAY', async () => {
    const app = makeApp({
      handlers: new Map([['CUSTOMER_CANCEL_BOOKING_PAID', goodHandler]]),
      impactResolvers: new Map([['CUSTOMER_CANCEL_BOOKING_PAID', cancelPaidImpact]]),
      auth: { actorUid: 'sarah' },
    });
    const res = await request(app)
      .post('/api/actions/CUSTOMER_CANCEL_BOOKING_PAID/execute')
      .send({ ...validBody, idempotencyKey: undefined });
    expect(res.status).toBe(400);
    expect(res.body.reasonCode).toBe('IDEMPOTENCY_REPLAY');
  });
});

describe('happy path', () => {
  it('valid execute with feature flag on → 200 ok:true result:ActionResult', async () => {
    const app = makeApp({
      handlers: new Map([['CUSTOMER_CANCEL_BOOKING_PAID', goodHandler]]),
      impactResolvers: new Map([['CUSTOMER_CANCEL_BOOKING_PAID', cancelPaidImpact]]),
      auth: { actorUid: 'sarah' },
    });
    const res = await request(app)
      .post('/api/actions/CUSTOMER_CANCEL_BOOKING_PAID/execute')
      .send(validBody);
    expect(res.status).toBe(200);
    expect(res.body.result.status).toBe('SUCCEEDED');
    expect(res.body.result.actionId).toMatch(/^act_/);
    expect(res.body.result.correlationId).toBe('corr_test');
  });
});

describe('HTTP-layer idempotency + reauth (server-derived)', () => {
  it('two POSTs same key → handler runs once; second returns same actionId', async () => {
    const handler = vi.fn(goodHandler);
    const app = makeApp({
      handlers: new Map([['CUSTOMER_CANCEL_BOOKING_PAID', handler]]),
      impactResolvers: new Map([['CUSTOMER_CANCEL_BOOKING_PAID', cancelPaidImpact]]),
      auth: { actorUid: 'sarah' },
    });
    const res1 = await request(app)
      .post('/api/actions/CUSTOMER_CANCEL_BOOKING_PAID/execute')
      .send(validBody);
    const res2 = await request(app)
      .post('/api/actions/CUSTOMER_CANCEL_BOOKING_PAID/execute')
      .send(validBody);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(res2.body.result.actionId).toBe(res1.body.result.actionId);
  });

  it('L4 ACCOUNT_DELETE with NO server-side recentReauthAt → FAILED + REAUTH_REQUIRED', async () => {
    const app = makeApp({
      handlers: new Map([['ACCOUNT_DELETE', goodHandler]]),
      impactResolvers: new Map([['ACCOUNT_DELETE', async () => ({ irreversible: true, destructive: true })]]),
      auth: { actorUid: 'sarah' }, // no recentReauthAt
    });
    const res = await request(app)
      .post('/api/actions/ACCOUNT_DELETE/execute')
      .send(validBody);
    expect(res.status).toBe(200);
    expect(res.body.result.status).toBe('FAILED');
    expect(res.body.result.userMessage.code).toBe('REAUTH_REQUIRED');
  });

  it('L4 with fresh server-side recentReauthAt → SUCCEEDED', async () => {
    // Reauth 30 seconds before now — inside default 5-minute window.
    const recentReauthAt = new Date(Date.now() - 30_000).toISOString();
    const app = makeApp({
      handlers: new Map([['ACCOUNT_DELETE', goodHandler]]),
      impactResolvers: new Map([['ACCOUNT_DELETE', async () => ({ irreversible: true, destructive: true })]]),
      auth: { actorUid: 'sarah', recentReauthAt },
    });
    const res = await request(app)
      .post('/api/actions/ACCOUNT_DELETE/execute')
      .send(validBody);
    expect(res.body.result.status).toBe('SUCCEEDED');
  });
});
