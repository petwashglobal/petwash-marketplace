/**
 * GET /api/actions/:entity/:id/actions — routing behavior pins
 * (doctrine §41).
 *
 * The router is DB-free by design; state loaders are injected. This
 * test exercises the routing shape + response contract without needing
 * a database.
 */
import express from 'express';
import request from 'supertest';
import { describe, it, expect } from 'vitest';
import {
  buildAvailableActionsRouter,
  type AvailableActionsStateLoaders,
} from '../routes/available-actions';

function makeApp(
  loaders: AvailableActionsStateLoaders,
  authedUid: string | null = 'nir',
): express.Express {
  const app = express();
  // Simulate the auth middleware — every request carries a firebaseUser
  // stub with the given uid (or none for the unauth test).
  app.use((req, _res, next) => {
    if (authedUid) (req as any).firebaseUser = { uid: authedUid };
    next();
  });
  app.use('/api/actions', buildAvailableActionsRouter(loaders));
  return app;
}

const stubLoaders: AvailableActionsStateLoaders = {
  async loadBookingContext(id, uid) {
    if (id === 'unknown') return null;
    return {
      participant: uid === 'maya' ? 'PROVIDER' : 'BOOKER',
      bookingPhase: 'CONFIRMED',
      paymentPhase: 'PAID',
    };
  },
  async loadMeetGreetContext(id) {
    if (id === 'unknown') return null;
    return {
      participant: 'PROVIDER',
      phase: 'PROPOSED',
      bothPartiesAcknowledged: true,
    };
  },
  async loadPrestigeContext() {
    return {
      status: 'NONE',
      hasVerifiedEmail: true,
      hasVerifiedMobile: true,
    };
  },
  async loadProviderApplicationContext(id) {
    if (id === 'unknown') return null;
    return {
      participant: 'APPLICANT',
      phase: 'READY_TO_SUBMIT',
      hasAcceptedActiveAgreement: true,
      missingChecklistItems: 0,
    };
  },
};

describe('GET /api/actions — auth gate', () => {
  it('returns 401 with reasonCode when no firebaseUser is present', async () => {
    const app = makeApp(stubLoaders, null);
    const res = await request(app).get('/api/actions/booking/b1/actions');
    expect(res.status).toBe(401);
    expect(res.body.reasonCode).toBe('REAUTH_REQUIRED');
  });
});

describe('GET /api/actions/booking/:id/actions', () => {
  it('returns 200 with an actions array; every entry has risk + confirmation', async () => {
    const app = makeApp(stubLoaders);
    const res = await request(app).get('/api/actions/booking/b1/actions');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.actions)).toBe(true);
    for (const a of res.body.actions) {
      expect(a.type).toBeTruthy();
      expect(a.riskLevel).toMatch(/^L[0-4]$/);
      expect(a.confirmationLevel).toBeTruthy();
    }
  });

  it('unknown booking id → 404 with INSUFFICIENT_PERMISSIONS reasonCode', async () => {
    const app = makeApp(stubLoaders);
    const res = await request(app).get('/api/actions/booking/unknown/actions');
    expect(res.status).toBe(404);
    expect(res.body.reasonCode).toBe('INSUFFICIENT_PERMISSIONS');
  });

  it('booker never sees BOOKING_ACCEPT (participant-based visibility)', async () => {
    const app = makeApp(stubLoaders, 'nir');
    const res = await request(app).get('/api/actions/booking/b1/actions');
    const types = res.body.actions.map((a: any) => a.type);
    expect(types).not.toContain('BOOKING_ACCEPT');
  });
});

describe('GET /api/actions/meet-greet/:id/actions', () => {
  it('returns the M&G action set', async () => {
    const app = makeApp(stubLoaders);
    const res = await request(app).get('/api/actions/meet-greet/mg1/actions');
    expect(res.status).toBe(200);
    const types = res.body.actions.map((a: any) => a.type);
    expect(types).toContain('MEET_GREET_ACCEPT');
    expect(types).toContain('MEET_GREET_DECLINE');
  });

  it('unknown M&G id → 404', async () => {
    const app = makeApp(stubLoaders);
    const res = await request(app).get('/api/actions/meet-greet/unknown/actions');
    expect(res.status).toBe(404);
  });
});

describe('GET /api/actions/prestige/actions', () => {
  it('returns the Prestige action set for the actor', async () => {
    const app = makeApp(stubLoaders);
    const res = await request(app).get('/api/actions/prestige/actions');
    expect(res.status).toBe(200);
    const types = res.body.actions.map((a: any) => a.type);
    expect(types).toContain('PRESTIGE_JOIN');
  });
});

describe('GET /api/actions/provider-application/:id/actions', () => {
  it('returns the application action set', async () => {
    const app = makeApp(stubLoaders);
    const res = await request(app).get('/api/actions/provider-application/app1/actions');
    expect(res.status).toBe(200);
    const types = res.body.actions.map((a: any) => a.type);
    expect(types).toContain('PROVIDER_APPLICATION_SUBMIT');
  });

  it('unknown application id → 404', async () => {
    const app = makeApp(stubLoaders);
    const res = await request(app).get('/api/actions/provider-application/unknown/actions');
    expect(res.status).toBe(404);
  });
});
