// Free address autocomplete — NO Google billing (2026-06-18; upgraded 2026-07-29).
//
// The dropdown users actually see calls THIS route. It previously used Nominatim
// /search, which is built for full-address geocoding, not type-ahead, so partial
// street names barely surfaced and it returned no structured street/house-number.
//
// Now: Photon (photon.komoot.io, OSM, key-free, built for autocomplete) is the
// primary — it returns real Hebrew Israeli STREETS with house numbers, biased to
// the Israel bbox. Nominatim stays as a fallback, and our OWN baked-in
// israel-cities dataset is the never-empty floor. Every prediction carries the
// parsed street / streetNumber / city / postalCode / state / lat / lng inline, so
// the client fills the structured form with no second round-trip and no key.
import { Router, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { redisRateLimitStore } from '../middleware/rateLimiterRedisStore';
import { logger } from '../lib/logger';
import { searchIsraelCities } from '@shared/data/israel-cities';
import { searchIsraelStreets, getStreetsForCity } from '../lib/israelStreets';

const router = Router();

const USER_AGENT = process.env.NOMINATIM_USER_AGENT || 'PetWash/1.0 (support@petwash.co.il)';
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const PHOTON_URL = 'https://photon.komoot.io/api/';
const IL_BBOX = '34.2,29.4,35.95,33.4'; // minLon,minLat,maxLon,maxLat

interface Prediction {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
  street?: string;
  streetNumber?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  countryCode: string;
  lat?: number;
  lng?: number;
}

// Small TTL cache so repeated keystrokes / popular queries don't hammer providers.
const cache = new Map<string, { at: number; data: any }>();
const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX = 500;

// Release-blocker B3 (CEO 2026-09-02): shared Redis store — external
// geocoder provider cap must be fleet-wide, not per-pod.
const suggestLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60, // per IP/min — generous for typing, still polite to the providers
  standardHeaders: true,
  legacyHeaders: false,
  store: redisRateLimitStore('geocode_suggest'),
});

async function photonSuggest(q: string): Promise<Prediction[]> {
  const url = `${PHOTON_URL}?q=${encodeURIComponent(q)}&limit=6&lang=default&bbox=${IL_BBOX}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const r = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' }, signal: controller.signal });
    if (!r.ok) throw new Error(`photon http ${r.status}`);
    const data: any = await r.json();
    const feats: any[] = Array.isArray(data?.features) ? data.features : [];
    return feats
      .filter((f) => (f?.properties?.countrycode || 'IL') === 'IL')
      .map((f) => {
        const p = f.properties || {};
        const coords = f.geometry?.coordinates || [];
        const street = p.street || p.name || '';
        const streetNumber = p.housenumber ? String(p.housenumber) : '';
        const city = p.city || p.district || p.county || '';
        const state = p.state || '';
        const mainText = [street, streetNumber].filter(Boolean).join(' ');
        const secondaryText = [city, state].filter(Boolean).join(', ');
        const description = [mainText, secondaryText].filter(Boolean).join(', ');
        return {
          placeId: `photon:${p.osm_type || 'X'}${p.osm_id || ''}`,
          description,
          mainText: mainText || description,
          secondaryText,
          street,
          streetNumber,
          city,
          state,
          postalCode: p.postcode || undefined,
          countryCode: p.countrycode || 'IL',
          lat: typeof coords[1] === 'number' ? coords[1] : undefined,
          lng: typeof coords[0] === 'number' ? coords[0] : undefined,
        } as Prediction;
      })
      .filter((p) => p.description);
  } finally {
    clearTimeout(timeout);
  }
}

async function nominatimSuggest(q: string, lang: string): Promise<Prediction[]> {
  const params = new URLSearchParams({
    q, format: 'jsonv2', addressdetails: '1', limit: '6', countrycodes: 'il', 'accept-language': lang,
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const r = await fetch(`${NOMINATIM_URL}?${params.toString()}`, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!r.ok) throw new Error(`nominatim http ${r.status}`);
    const rows = await r.json();
    return (Array.isArray(rows) ? rows : []).map((x: any) => {
      const a = x.address || {};
      const street = a.road || a.pedestrian || a.footway || '';
      const streetNumber = a.house_number ? String(a.house_number) : '';
      const city = a.city || a.town || a.village || a.municipality || '';
      return {
        placeId: String(x.place_id),
        description: x.display_name,
        mainText: [street, streetNumber].filter(Boolean).join(' ') || x.name || String(x.display_name || '').split(',')[0],
        secondaryText: x.display_name,
        street,
        streetNumber,
        city,
        state: a.state || undefined,
        postalCode: a.postcode || undefined,
        countryCode: 'IL',
        lat: Number(x.lat),
        lng: Number(x.lon),
      } as Prediction;
    });
  } finally {
    clearTimeout(timeout);
  }
}

// Offline street suggestions from our OWN baked-in Israeli dataset (63k streets,
// zero network, Hebrew). Returns [] until the async startup load finishes (Photon
// covers the gap). No coords/house-number — user types the number, coords filled
// by geocode-on-save.
function localStreetSuggest(q: string): Prediction[] {
  return searchIsraelStreets(q, 6).map((r) => ({
    placeId: `ilstreet:${r.street}|${r.city}`,
    description: `${r.street}, ${r.city}`,
    mainText: r.street,
    secondaryText: r.city,
    street: r.street,
    city: r.city,
    countryCode: 'IL',
  }));
}

// Never-empty floor: city suggestions from our OWN baked-in dataset, zero network.
function localCitySuggest(q: string): Prediction[] {
  const isHebrew = /[֐-׿]/.test(q);
  return searchIsraelCities(q, isHebrew ? 'he' : 'en', 6).map((c) => {
    const name = isHebrew ? c.hebrewName || c.englishName : c.englishName || c.hebrewName;
    return {
      placeId: `ilcity:${c.citySymbol}`,
      description: name,
      mainText: name,
      secondaryText: isHebrew ? 'ישראל' : 'Israel',
      city: name,
      state: c.district || undefined,
      countryCode: 'IL',
    } as Prediction;
  });
}

// GET /api/geocode/suggest?q=...&lang=he — address predictions with parts + lat/lng inline.
router.get('/suggest', suggestLimiter, async (req: Request, res: Response) => {
  const q = String(req.query.q || '').trim();
  const lang = String(req.query.lang || 'he');
  if (q.length < 3) return res.json({ predictions: [] });

  const cacheKey = `${lang}:${q.toLowerCase()}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return res.json({ predictions: hit.data });
  }

  // PRIMARY: Photon — real Hebrew Israeli streets WITH house numbers AND
  // coordinates. Coordinates matter: PetTrek fares and booker↔provider proximity
  // matching need them, and the offline street list has none. Photon is free (no
  // Google fee).
  let predictions: Prediction[] = [];
  try {
    predictions = await photonSuggest(q);
  } catch (err: any) {
    logger.warn('[geocode/suggest] photon failed (soft)', { error: err?.message });
  }

  // FALLBACK: our OWN baked-in 63k Israeli streets (server/data/israel-streets.json,
  // loaded async at startup — never blocks the request path). Fills any street
  // Photon's OSM map is missing and is the reliability backstop when Photon is
  // down/slow. No coords → user types the house number, coords filled on save.
  if (predictions.length === 0) {
    predictions = localStreetSuggest(q);
  }
  if (predictions.length === 0) {
    try {
      predictions = await nominatimSuggest(q, lang);
    } catch (err: any) {
      logger.warn('[geocode/suggest] nominatim failed (soft)', { error: err?.message });
    }
  }
  if (predictions.length === 0) {
    predictions = localCitySuggest(q); // guaranteed offline city floor
  }

  if (cache.size >= CACHE_MAX) cache.clear();
  cache.set(cacheKey, { at: Date.now(), data: predictions });
  return res.json({ predictions });
});

// GET /api/geocode/reverse?lat=..&lng=..&lang=he — coords -> address (free OSM).
// Replaces the dead Google "use my location" / reverse wires. 2026-06-18.
router.get('/reverse', suggestLimiter, async (req: Request, res: Response) => {
  const lat = parseFloat(String(req.query.lat || ''));
  const lng = parseFloat(String(req.query.lng || ''));
  const lang = String(req.query.lang || 'he');
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ error: 'lat and lng required' });
  }
  const cacheKey = `rev:${lang}:${lat.toFixed(5)},${lng.toFixed(5)}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return res.json((hit as any).data);
  }
  const params = new URLSearchParams({
    lat: String(lat), lon: String(lng), format: 'jsonv2', addressdetails: '1', 'accept-language': lang,
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?${params.toString()}`, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!r.ok) return res.json({ formattedAddress: '', lat, lng });
    const x: any = await r.json();
    const a = x?.address || {};
    const out = {
      formattedAddress: x?.display_name || '',
      street: a.road || a.pedestrian || undefined,
      streetNumber: a.house_number || undefined,
      city: a.city || a.town || a.village || a.municipality,
      postalCode: a.postcode,
      countryCode: (a.country_code || 'il').toUpperCase(),
      lat, lng,
    };
    if (cache.size >= CACHE_MAX) cache.clear();
    cache.set(cacheKey, { at: Date.now(), data: out });
    return res.json(out);
  } catch (err: any) {
    logger.warn('[geocode/reverse] failed (soft)', { error: err?.message });
    return res.json({ formattedAddress: '', lat, lng });
  } finally {
    clearTimeout(timeout);
  }
});

// GET /api/geocode/streets?city=<hebrew or english city name>&q=<optional prefix>
// Returns the list of streets that live in the given city, drawn from the baked
// data.gov.il registry (server/data/israel-streets.json). Powers the client
// AddressPicker's street picker sheet — a real dropdown against the official
// Israel Post keys instead of free-text autocomplete. Empty response is safe;
// the client falls back to typing an address freehand into Photon.
router.get('/streets', suggestLimiter, async (req: Request, res: Response) => {
  const city = String(req.query.city || '').trim();
  const q = String(req.query.q || '').trim();
  if (!city) return res.json({ streets: [] });
  try {
    const streets = getStreetsForCity(city, q, 200);
    return res.json({ streets });
  } catch (err: any) {
    logger.warn('[geocode/streets] failed (soft)', { error: err?.message });
    return res.json({ streets: [] });
  }
});

export default router;
