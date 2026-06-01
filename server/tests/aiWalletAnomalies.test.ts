/**
 * AI-W1 — AI Wallet Anomaly Monitor tests.
 *
 * Verifies the scan endpoint: flag gate, aggregator semantics,
 * deterministic floor scoring, Gemini layering, PII non-leak in prompt,
 * hallucinated-id stripping, and graceful fallback when AI unavailable.
 *
 * Does NOT touch the real DB. The mocked db.select() returns whatever
 * the test sets in state.walletRows.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const state = vi.hoisted(() => ({
  flag: false as boolean,
  aiResponse: null as
    | { ok: true; text: string }
    | { ok: false; error: string }
    | null,
  lastPrompt: '' as string,
  walletRows: [] as any[],
}));

vi.mock('../services/SystemConfig', () => ({
  getFeatureFlag: vi.fn(async (key: string) => {
    if (key === 'ff.ai.wallet_anomaly_monitor.enabled') return state.flag;
    return false;
  }),
  systemConfig: { get: vi.fn(), set: vi.fn() },
}));

vi.mock('../lib/gemini-client', () => ({
  safeGenerate: vi.fn(async (_model: string, prompt: string) => {
    state.lastPrompt = prompt;
    if (!state.aiResponse) return { ok: false, text: null, error: 'no_client' };
    if ('error' in state.aiResponse) return { ok: false, text: null, error: state.aiResponse.error };
    return { ok: true, text: state.aiResponse.text };
  }),
}));

vi.mock('../db', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => Promise.resolve(state.walletRows),
      }),
    }),
  },
}));

vi.mock('@shared/schema', () => ({
  walletLedgerEntries: {
    userId: 'user_id', direction: 'direction', eventType: 'event_type',
    amountCents: 'amount_cents', kioskId: 'kiosk_id', ipAddress: 'ip_address',
    divisionCode: 'division_code', createdAt: 'created_at',
  },
}));

const { default: adminWalletAnomaliesRouter } = await import('../routes/admin-wallet-anomalies');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/admin/wallet/anomalies', adminWalletAnomaliesRouter);
  return app;
}

function row(userId: string, overrides: any = {}) {
  return {
    userId,
    direction: 'debit',
    eventType: 'redeem_kiosk',
    amountCents: 5000,
    kioskId: 'kiosk-1',
    ipAddress: '1.1.1.1',
    divisionCode: 'station_k9000',
    createdAt: new Date(),
    ...overrides,
  };
}

beforeEach(() => {
  state.flag = true;
  state.aiResponse = null;
  state.lastPrompt = '';
  state.walletRows = [];
});

describe('AI-W1 wallet anomaly scan', () => {
  it('Test 1 — flag OFF → 503 feature_disabled', async () => {
    state.flag = false;
    const res = await request(buildApp())
      .post('/api/admin/wallet/anomalies/scan')
      .send({ lookbackDays: 7 });
    expect(res.status).toBe(503);
    expect(res.body.error).toBe('feature_disabled');
  });

  it('Test 2 — empty wallet activity → 0 flags', async () => {
    state.walletRows = [];
    state.aiResponse = { ok: true, text: JSON.stringify({ flags: [] }) };
    const res = await request(buildApp())
      .post('/api/admin/wallet/anomalies/scan')
      .send({ lookbackDays: 7 });
    expect(res.status).toBe(200);
    expect(res.body.flags).toEqual([]);
    expect(res.body.scannedUsers).toBe(0);
  });

  it('Test 3 — single huge debit triggers deterministic large_single_debit flag', async () => {
    state.walletRows = [
      row('u1', { amountCents: 80_000, direction: 'debit' }), // ₪800
    ];
    state.aiResponse = { ok: false, error: 'no_client' };
    const res = await request(buildApp())
      .post('/api/admin/wallet/anomalies/scan')
      .send({ lookbackDays: 7 });
    expect(res.status).toBe(200);
    expect(res.body.flags).toHaveLength(1);
    expect(res.body.flags[0].userId).toBe('u1');
    expect(res.body.flags[0].reasons).toContain('large_single_debit');
    expect(res.body.flags[0].evidence.largestSingleDebitIls).toBe(800);
    expect(res.body.flags[0].severity).toBe('medium');
    expect(res.body.flags[0].source).toBe('deterministic');
    expect(res.body.fallback).toBe(true);
  });

  it('Test 4 — repeated refunds bumps severity to high', async () => {
    state.walletRows = [
      row('u1', { eventType: 'refund', amountCents: 1000 }),
      row('u1', { eventType: 'refund', amountCents: 1000 }),
      row('u1', { eventType: 'refund', amountCents: 1000 }),
      row('u1', { eventType: 'refund', amountCents: 1000 }),
    ];
    state.aiResponse = { ok: false, error: 'no_client' };
    const res = await request(buildApp())
      .post('/api/admin/wallet/anomalies/scan')
      .send({ lookbackDays: 7 });
    expect(res.body.flags[0].reasons).toContain('repeated_refunds');
    expect(res.body.flags[0].severity).toBe('high');
  });

  it('Test 5 — prompt NEVER contains raw IPs or user-agents (PII)', async () => {
    state.walletRows = [
      row('u1', { ipAddress: '203.0.113.42' }),
      row('u2', { ipAddress: '198.51.100.7' }),
    ];
    state.aiResponse = { ok: true, text: JSON.stringify({ flags: [] }) };
    await request(buildApp())
      .post('/api/admin/wallet/anomalies/scan')
      .send({ lookbackDays: 7 });
    // The raw IPs MUST NOT reach the model — we send a COUNT only.
    expect(state.lastPrompt).not.toContain('203.0.113.42');
    expect(state.lastPrompt).not.toContain('198.51.100.7');
    // The prompt should contain the uniqueIpCount field instead.
    expect(state.lastPrompt).toContain('uniqueIpCount');
  });

  it('Test 6 — prompt explicitly forbids refund/credit/suspend recommendations', async () => {
    state.walletRows = [row('u1', { amountCents: 50_000 })];
    state.aiResponse = { ok: true, text: JSON.stringify({ flags: [] }) };
    await request(buildApp())
      .post('/api/admin/wallet/anomalies/scan')
      .send({ lookbackDays: 7 });
    expect(state.lastPrompt).toMatch(/MUST NOT/);
    expect(state.lastPrompt).toMatch(/refunds.*credits.*account suspensions/i);
    expect(state.lastPrompt).toMatch(/admin decisions/i);
  });

  it('Test 7 — model invents a userId → stripped from response', async () => {
    state.walletRows = [row('u1', { amountCents: 80_000 })];
    state.aiResponse = {
      ok: true,
      text: JSON.stringify({
        flags: [
          { userId: 'u1', score: 85, reasons: ['large_single_debit'], suggestedAction: 'Review' },
          { userId: 'evil_phantom_user', score: 99, reasons: ['anything'], suggestedAction: 'Refund now' },
        ],
      }),
    };
    const res = await request(buildApp())
      .post('/api/admin/wallet/anomalies/scan')
      .send({ lookbackDays: 7 });
    const userIds = res.body.flags.map((f: any) => f.userId);
    expect(userIds).toContain('u1');
    expect(userIds).not.toContain('evil_phantom_user');
  });

  it('Test 8 — AI + deterministic merge: union of reasons, higher severity wins', async () => {
    state.walletRows = [
      row('u1', { amountCents: 80_000 }), // triggers deterministic large_single_debit (medium)
    ];
    state.aiResponse = {
      ok: true,
      text: JSON.stringify({
        flags: [{ userId: 'u1', score: 90, reasons: ['unusual_pattern'], suggestedAction: 'Look closer' }],
      }),
    };
    const res = await request(buildApp())
      .post('/api/admin/wallet/anomalies/scan')
      .send({ lookbackDays: 7 });
    expect(res.body.flags).toHaveLength(1);
    const f = res.body.flags[0];
    expect(f.userId).toBe('u1');
    // AI score 90 → 'high' beats deterministic 'medium'.
    expect(f.severity).toBe('high');
    // Reasons merged.
    expect(f.reasons).toEqual(expect.arrayContaining(['large_single_debit', 'unusual_pattern']));
    // Source marker says both.
    expect(f.source).toBe('both');
  });

  it('Test 9 — AI unavailable → returns deterministic flags only with fallback:true', async () => {
    state.walletRows = [row('u1', { amountCents: 60_000 })];
    state.aiResponse = { ok: false, error: 'quota_exhausted' };
    const res = await request(buildApp())
      .post('/api/admin/wallet/anomalies/scan')
      .send({ lookbackDays: 7 });
    expect(res.status).toBe(200);
    expect(res.body.fallback).toBe(true);
    expect(res.body.reason).toBe('quota_exhausted');
    expect(res.body.flags).toHaveLength(1);
    expect(res.body.flags[0].source).toBe('deterministic');
  });

  it('Test 10 — non-JSON model output → deterministic only, fallback:true', async () => {
    state.walletRows = [row('u1', { amountCents: 60_000 })];
    state.aiResponse = { ok: true, text: 'I refuse.' };
    const res = await request(buildApp())
      .post('/api/admin/wallet/anomalies/scan')
      .send({ lookbackDays: 7 });
    expect(res.body.fallback).toBe(true);
    expect(res.body.reason).toBe('invalid_model_output');
  });

  it('Test 11 — invalid lookbackDays > 30 → 400', async () => {
    const res = await request(buildApp())
      .post('/api/admin/wallet/anomalies/scan')
      .send({ lookbackDays: 365 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_body');
  });

  it('Test 12 — userIds filter scopes the scan', async () => {
    state.walletRows = [
      row('u1', { amountCents: 80_000 }),
      row('u2', { amountCents: 80_000 }),
    ];
    state.aiResponse = { ok: false, error: 'no_client' };
    const res = await request(buildApp())
      .post('/api/admin/wallet/anomalies/scan')
      .send({ lookbackDays: 7, userIds: ['u1'] });
    expect(res.body.scannedUsers).toBe(1);
    expect(res.body.flags.map((f: any) => f.userId)).toEqual(['u1']);
  });

  it('Test 13 — response shape never contains action verbs the backend would execute', async () => {
    // No `refundAmount`, `creditAmount`, `suspended`, `blocked` etc. The
    // route only emits flags + suggestedAction (free-text). Any future
    // PR that adds a field that LOOKS like a money mutation will trip
    // this test.
    state.walletRows = [row('u1', { amountCents: 60_000 })];
    state.aiResponse = { ok: false, error: 'no_client' };
    const res = await request(buildApp())
      .post('/api/admin/wallet/anomalies/scan')
      .send({ lookbackDays: 7 });
    const json = JSON.stringify(res.body);
    expect(json).not.toMatch(/refundAmount|creditAmount|suspended|blocked|frozen/i);
  });
});
