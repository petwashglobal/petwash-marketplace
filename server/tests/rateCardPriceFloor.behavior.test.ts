/**
 * The rate card that makes a provider bookable enforces the platform price
 * floor / ceiling (2026-09-13). CEO rule (Rover / MadPaws model): each provider
 * sets their own rate, but never below the per-service minimum in
 * shared/providerMinPrices.ts. PUT /api/provider-os/rate-card accepted any
 * positive number — a ₪1 walk went live in search.
 */
import { describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

const updates: Array<Record<string, unknown>> = [];
vi.mock('../lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock('../customAuth', () => ({ requireAuth: (req: any, _res: any, next: any) => { req.user = { uid: 'prov-1' }; next(); } }));
vi.mock('../db', () => {
  const chain = { set: (v: any) => { updates.push(v); return chain; }, where: () => chain, returning: async () => [{ id: 1 }] };
  return { db: { update: () => chain } };
});

import router, { rateCardPriceViolations } from '../routes/provider-rate-card';

function app() {
  const a = express();
  a.use(express.json());
  a.use('/api/provider-os', router);
  return a;
}

describe('rateCardPriceViolations', () => {
  it('floors: walk ₪49, sitter day ₪99, training ₪149', () => {
    expect(rateCardPriceViolations({ walkerHourlyIls: 48, available: true })).toMatchObject([{ platform: 'walk_my_pet', reason: 'too_low', minIls: 49 }]);
    expect(rateCardPriceViolations({ walkerHourlyIls: 49, available: true })).toEqual([]);
    expect(rateCardPriceViolations({ sitterDayIls: 98, available: true })).toMatchObject([{ platform: 'sitter_suite', minIls: 99 }]);
    expect(rateCardPriceViolations({ trainerHourlyIls: 100, available: true })).toMatchObject([{ platform: 'academy', minIls: 149 }]);
  });
  it('0 means "not offering" and is allowed', () => {
    expect(rateCardPriceViolations({ walkerHourlyIls: 0, sitterDayIls: 0, trainerHourlyIls: 0, available: false })).toEqual([]);
  });
  it('ceilings apply too (walk ₪500)', () => {
    expect(rateCardPriceViolations({ walkerHourlyIls: 501, available: true })).toMatchObject([{ reason: 'too_high', maxIls: 500 }]);
  });
  it('the optional sitter HOURLY rate has no floor in the price table', () => {
    expect(rateCardPriceViolations({ sitterDayIls: 450, sitterHourIls: 60, available: true })).toEqual([]);
  });
});

describe('PUT /api/provider-os/rate-card', () => {
  it('a ₪1 walk is refused and nothing is written', async () => {
    updates.length = 0;
    const r = await request(app()).put('/api/provider-os/rate-card').send({ walkerHourlyIls: 1, available: true });
    expect(r.status).toBe(400);
    expect(r.body).toMatchObject({ error: 'PRICE_OUT_OF_RANGE', violations: [{ platform: 'walk_my_pet', minIls: 49 }] });
    expect(updates).toHaveLength(0);
  });
  it('a valid rate card is saved', async () => {
    updates.length = 0;
    const r = await request(app()).put('/api/provider-os/rate-card').send({ walkerHourlyIls: 80, sitterDayIls: 450, trainerHourlyIls: 200, available: true });
    expect(r.status).toBe(200);
    expect(updates.length).toBeGreaterThan(0);
  });
});

describe('every other provider rate writer applies the same floor', () => {
  const { readFileSync } = require('node:fs');
  const { join } = require('node:path');
  const read = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8');
  it('walker registration and walker self-update', () => {
    const src = read('routes/walk-my-pet.ts');
    expect(src).toContain("validateProviderRates('walk_my_pet', [Math.round(Number(safeBody.baseHourlyRate) * 100)])");
    expect(src).toContain("validateProviderRates('walk_my_pet', [Math.round(rateIls * 100)])");
    expect(src.indexOf("validateProviderRates('walk_my_pet', [Math.round(rateIls * 100)])")).toBeLessThan(src.indexOf('.set({ ...safeUpdates, updatedAt: new Date() })'));
  });
  it('trainer registration', () => {
    expect(read('routes/academy.ts')).toContain("validateProviderRates('academy', [Math.round(trainerRateIls * 100)])");
  });
});
