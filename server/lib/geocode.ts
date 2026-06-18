// Free geocoding via OpenStreetMap Nominatim — NO Google billing (chosen 2026-06-18
// to avoid re-opening the Google Maps spend that caused the surprise bill).
//
// Usage policy notes (https://operations.osmfoundation.org/policies/nominatim/):
//   - A valid HTTP Referer / User-Agent identifying the app is REQUIRED.
//   - Max ~1 request/second. We only geocode on address SAVE (low frequency), so this
//     is fine; do NOT call this in a hot loop. For bulk backfill, throttle to 1/sec.
//   - Always fail gracefully — geocoding is best-effort and must NEVER block a save.

import { logger } from './logger';

export interface GeoPoint { lat: number; lng: number; }

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
// Identify ourselves per Nominatim policy. Override via env if desired.
const USER_AGENT = process.env.NOMINATIM_USER_AGENT || 'PetWash/1.0 (support@petwash.co.il)';

/**
 * Geocode a free-text address to lat/lng. Returns null on any failure (never throws).
 * Biased to Israel (countrycodes=il) since that's our launch market.
 */
export async function geocodeAddress(address: string, opts?: { countryCodes?: string; timeoutMs?: number }): Promise<GeoPoint | null> {
  const q = (address || '').trim();
  if (q.length < 3) return null;

  const params = new URLSearchParams({
    q,
    format: 'json',
    limit: '1',
    addressdetails: '0',
    countrycodes: opts?.countryCodes || 'il',
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts?.timeoutMs ?? 5000);
  try {
    const res = await fetch(`${NOMINATIM_URL}?${params.toString()}`, {
      headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) {
      logger.warn('[geocode] Nominatim non-OK', { status: res.status });
      return null;
    }
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    const lat = parseFloat(data[0].lat);
    const lng = parseFloat(data[0].lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  } catch (err: any) {
    // Network error / timeout / abort — best-effort, swallow.
    logger.warn('[geocode] failed (best-effort)', { error: err?.message });
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
