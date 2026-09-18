/**
 * The 60-second provider application (2026-09-18).
 *
 * Live production: 0 providers, 0 applications ever. Every join link led into
 * the three-step wizard (signup → ID → selfie) before anyone knew the
 * applicant's name. This endpoint is the short door, and because it is PUBLIC
 * it must behave: validate, never accept identity data, never create anything
 * but a lead, and answer the same way twice.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const h = vi.hoisted(() => ({ existing: [] as string[], inserted: [] as any[], alerts: [] as any[], turnstileOk: true, lastEmail: '' }));

vi.mock('../db', () => ({
  db: {
    select: () => ({ from: () => ({ where: () => ({ limit: async () => (h.existing.includes(h.lastEmail) ? [{ id: 1 }] : []) }) }) }),
    insert: () => ({ values: async (v: any) => { h.inserted.push(v); } }),
  },
}));
vi.mock('drizzle-orm', () => ({ eq: (_c: any, v: any) => { h.lastEmail = v; return {}; } }));
vi.mock('@shared/schema', () => ({ crmLeads: { email: 'email', id: 'id' } }));
vi.mock('../middleware/rateLimiter', () => ({ paymentLimiter: (_q: any, _s: any, n: any) => n() }));
vi.mock('../lib/verifyTurnstile', () => ({ verifyTurnstileToken: async () => ({ success: h.turnstileOk }) }));
vi.mock('../services/AlertEngine', () => ({ createOrUpdateAlert: async (a: any) => { h.alerts.push(a); } }));

import router, { applicationToLead } from '../routes/provider-quick-apply';

const app = express();
app.use(express.json());
app.use('/api/provider-apply', router);

const good = {
  fullName: 'דנה כהן לוי', phone: '050-1234567', email: 'Dana@Example.com',
  city: 'חיפה', services: ['dog_walking', 'pet_sitting'], about: 'גידלתי כלבים 10 שנים',
};

describe('POST /api/provider-apply/apply', () => {
  beforeEach(() => { h.existing = []; h.inserted = []; h.alerts = []; h.turnstileOk = true; delete process.env.TURNSTILE_SECRET_KEY; });

  it('saves a lead and tells a human', async () => {
    const res = await request(app).post('/api/provider-apply/apply').send(good);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(h.inserted).toHaveLength(1);
    expect(h.inserted[0]).toMatchObject({
      firstName: 'דנה', lastName: 'כהן לוי', email: 'dana@example.com',
      leadSource: 'provider_quick_apply', leadStatus: 'new',
    });
    expect(h.inserted[0].interestedServices).toEqual(['dog_walking', 'pet_sitting']);
    expect(h.inserted[0].notes).toContain('חיפה');
    expect(h.alerts[0]).toMatchObject({ category: 'provider', title: 'New provider application' });
  });

  it('applying twice does not create a second lead', async () => {
    h.existing = ['dana@example.com'];
    const res = await request(app).post('/api/provider-apply/apply').send(good);
    expect(res.body).toMatchObject({ ok: true, alreadyApplied: true });
    expect(h.inserted).toHaveLength(0);
  });

  it('refuses a form that cannot be answered', async () => {
    for (const bad of [
      { ...good, email: 'not-an-email' },
      { ...good, services: [] },
      { ...good, phone: '12' },
      { ...good, fullName: '' },
      { ...good, services: ['hacking'] },
    ]) {
      const res = await request(app).post('/api/provider-apply/apply').send(bad);
      expect(res.status, JSON.stringify(bad)).toBe(400);
    }
    expect(h.inserted).toHaveLength(0);
  });

  it('extra fields — including identity data — are never stored', async () => {
    await request(app).post('/api/provider-apply/apply').send({
      ...good, idNumber: '123456789', passport: 'X1234567', iban: 'IL00', leadStatus: 'converted', leadSource: 'spoofed',
    });
    const saved = JSON.stringify(h.inserted[0]);
    expect(saved).not.toContain('123456789');
    expect(saved).not.toContain('X1234567');
    expect(saved).not.toContain('IL00');
    expect(h.inserted[0].leadStatus).toBe('new');
    expect(h.inserted[0].leadSource).toBe('provider_quick_apply');
  });

  it('when Turnstile is configured, a bot is refused and nothing is saved', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'x';
    h.turnstileOk = false;
    const res = await request(app).post('/api/provider-apply/apply').send(good);
    expect(res.status).toBe(403);
    expect(h.inserted).toHaveLength(0);
  });

  it('a one-word name still works (lastName is not required by a human)', () => {
    const lead = applicationToLead({ ...good, fullName: 'דנה' } as any);
    expect(lead).toMatchObject({ firstName: 'דנה', lastName: '-' });
  });
});
