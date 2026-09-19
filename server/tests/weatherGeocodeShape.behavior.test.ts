import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * 2026-09-19, production:
 *   GET /api/weather/planner?location=Tel Aviv          500 WEATHER_PLANNER_FAILED
 *   GET /api/weather/7-day-planner?location=Tel Aviv    503 weather_unavailable
 *   GET /api/weather/wash-recommendation?location=...   404 Weather data not available
 *
 * geocodeLocation's free branch returned { lat, lng } while LocationCoordinates
 * declares { latitude, longitude }, and an `as LocationCoordinates` cast told
 * the compiler otherwise. Every caller reads geocoded.latitude, so they all read
 * undefined and built open-meteo?latitude=undefined&longitude=undefined, which
 * Open-Meteo rejects with "Cannot initialize Float from invalid String value
 * undefined".
 *
 * The paid Google branch and geocodeLocationFallback always returned the right
 * names — the fault only surfaced when free geocoding became the default
 * (CEO 2026-08-01, "maps no need, free Israel").
 */

const freeResult = {
  lat: 32.0853,
  lng: 34.7818,
  formattedAddress: 'תל־אביב–יפו, ישראל',
  city: 'תל־אביב–יפו',
  country: 'Israel',
  countryCode: 'IL',
};

vi.mock('../lib/freeGeocode', () => ({
  preferFreeGeocode: () => true,
  freeGeocode: async () => freeResult,
}));

vi.mock('../lib/logger', () => ({ logger: { info: () => {}, warn: () => {}, error: () => {} } }));

const { geocodeLocation } = await import('../services/unifiedLocationWeather');

describe('geocodeLocation returns the coordinate field names its callers read', () => {
  beforeEach(() => vi.clearAllMocks());

  it('gives latitude/longitude, not lat/lng', async () => {
    const g = await geocodeLocation('Tel Aviv');
    expect(g).not.toBeNull();
    expect(g!.latitude).toBe(32.0853);
    expect(g!.longitude).toBe(34.7818);
  });

  it('the numbers survive into an Open-Meteo URL — no "undefined"', async () => {
    const g = await geocodeLocation('Tel Aviv');
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${g!.latitude}&longitude=${g!.longitude}&forecast_days=7`;
    expect(url).not.toContain('undefined');
    expect(url).toContain('latitude=32.0853');
    expect(url).toContain('longitude=34.7818');
  });

  it('carries the rest of the declared shape too', async () => {
    const g = await geocodeLocation('Tel Aviv');
    expect(g!.city).toBe('תל־אביב–יפו');
    expect(g!.country).toBe('Israel');
    expect(typeof g!.formattedAddress).toBe('string');
    expect(g!.formattedAddress.length).toBeGreaterThan(0);
  });
});
