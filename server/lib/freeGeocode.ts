/**
 * freeGeocode — server-side address → coordinates on FREE OpenStreetMap (Nominatim),
 * NOT the paid Google Geocoding API (CEO 2026-08-01: "maps no need, free Israel").
 *
 * Google Geocoding bills per call; the free OSM tier covers every Israeli address.
 * Any server geocoder (booking, provider search, weather) should call this instead
 * of maps.googleapis.com. Israel-scoped, cached, and it respects Nominatim's usage
 * policy (identifying User-Agent + a short in-process cache to avoid hammering it).
 */
import { logger } from './logger';

export interface FreeGeocodeResult {
  lat: number;
  lng: number;
  formattedAddress: string;
  city?: string;
  country?: string;
  countryCode?: string;
  postalCode?: string;
}

const NOMINATIM_SEARCH = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = process.env.NOMINATIM_USER_AGENT || 'PetWash/1.0 (support@petwash.co.il)';

const cache = new Map<string, { at: number; data: FreeGeocodeResult | null }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h — addresses don't move
const CACHE_MAX = 2000;

/** Geocode an address string to coordinates via free OSM/Nominatim. Israel-biased. */
export async function freeGeocode(query: string, lang: string = 'he'): Promise<FreeGeocodeResult | null> {
  const q = (query || '').trim();
  if (!q) return null;

  const key = `${lang}:${q.toLowerCase()}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data;

  const params = new URLSearchParams({
    q,
    format: 'jsonv2',
    addressdetails: '1',
    limit: '1',
    countrycodes: 'il',
    'accept-language': lang,
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const r = await fetch(`${NOMINATIM_SEARCH}?${params.toString()}`, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!r.ok) {
      logger.warn('[freeGeocode] nominatim non-2xx', { status: r.status });
      return null;
    }
    const arr: any[] = await r.json();
    const first = Array.isArray(arr) ? arr[0] : null;
    if (!first || first.lat == null || first.lon == null) {
      if (cache.size >= CACHE_MAX) cache.clear();
      cache.set(key, { at: Date.now(), data: null });
      return null;
    }
    const a = first.address || {};
    const out: FreeGeocodeResult = {
      lat: parseFloat(first.lat),
      lng: parseFloat(first.lon),
      formattedAddress: first.display_name || q,
      city: a.city || a.town || a.village || a.municipality,
      country: a.country || 'Israel',
      countryCode: (a.country_code || 'il').toUpperCase(),
      postalCode: a.postcode,
    };
    if (cache.size >= CACHE_MAX) cache.clear();
    cache.set(key, { at: Date.now(), data: out });
    return out;
  } catch (err: any) {
    logger.warn('[freeGeocode] failed (soft)', { error: err?.message });
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/** True when we should use FREE geocoding instead of the paid Google API. Google is
 *  only used when GOOGLE_PLACES_LIVE is explicitly 'true' (off by default = free). */
export function preferFreeGeocode(): boolean {
  return process.env.GOOGLE_PLACES_LIVE !== 'true';
}
