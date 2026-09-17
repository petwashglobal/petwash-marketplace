import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';

/**
 * Live 2026-09-17: /pet-wash-day-planner showed no forecast — the API answered
 * 404 "Forecast data not available" while Open-Meteo answered fine from other
 * networks. The handler threw away the upstream status and reason, so the
 * cause could not be diagnosed from logs. It now logs them and answers 503.
 */
const warn = vi.fn();
vi.mock('../lib/logger', () => ({ logger: { warn, info: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock('../lib/gemini-client', () => ({ getVertexAIConfig: () => null }));
vi.mock('../services/unifiedLocationWeather', () => ({
  geocodeLocation: async () => ({ latitude: 32.08, longitude: 34.78, name: 'Tel Aviv', country: 'Israel' }),
  getWeatherForecast: async () => null,
  getUnifiedLocationData: async () => null,
}));
vi.mock('../services/smartWeatherAdvisor', () => ({ smartWeatherAdvisor: {} }));
vi.mock('../middleware/firebase-auth', () => ({ optionalFirebaseToken: (_q: any, _s: any, n: any) => n() }));
vi.mock('../middleware/roleAuth', () => ({ optionalEmployeeProfile: (_q: any, _s: any, n: any) => n() }));
vi.mock('../db', () => ({ pool: { query: async () => ({ rows: [] }) } }));
vi.mock('../lib/firebase-admin', () => ({ db: {} }));

let upstream: { status: number; body: any };
beforeEach(() => {
  warn.mockClear();
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const { status, body } = upstream;
    return { ok: status < 400, status, json: async () => body } as any;
  }));
});
afterEach(() => vi.unstubAllGlobals());

async function app() {
  const { default: router } = await import('../routes/weather');
  const a = express();
  a.use('/api/weather', router);
  return a;
}

describe('7-day planner upstream failure', () => {
  it('a refused upstream call -> 503 weather_unavailable, with status + reason logged', async () => {
    upstream = { status: 429, body: { error: true, reason: 'Daily API request limit exceeded' } };
    const r = await request(await app()).get('/api/weather/7-day-planner?location=Tel%20Aviv');
    expect(r.status).toBe(503);
    expect(r.body.error).toBe('weather_unavailable');
    expect(warn).toHaveBeenCalledWith('[Weather] 7-day planner upstream failure', expect.objectContaining({ status: 429, reason: 'Daily API request limit exceeded' }));
  });

  it('a 200 with no daily block is treated the same way', async () => {
    upstream = { status: 200, body: {} };
    const r = await request(await app()).get('/api/weather/7-day-planner?location=Tel%20Aviv');
    expect(r.status).toBe(503);
  });
});
