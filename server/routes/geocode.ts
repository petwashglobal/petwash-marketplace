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

// BUILDING_LEVEL_POSTCODE (2026-09-11)
// An Israeli מיקוד is 7 digits and identifies a BUILDING, not a street or a city.
// OSM/Photon will happily hand back the postcode of a whole street segment,
// district or city object, and it splits a long street into segments that carry
// DIFFERENT codes. Verified live on our own station address:
//   q="ויצמן 185 כפר סבא" -> 6 predictions, 5 of them the identical string
//   "ויצמן, כפר סבא, מחוז המרכז", carrying 4445810 / 4426119 / 4425416.
// Whichever row the customer tapped, they were shown — and saved — a postcode
// belonging to some other stretch of Weizmann. So: a postcode is emitted ONLY
// when the hit is a building (it carries its own house number). Everywhere else
// the field stays empty and the customer types it. An empty מיקוד is honest; a
// confident wrong one is a misdelivered package.

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
  /** סמל_ישוב / סמל_רחוב — the official Israel-Post key, from OUR registry. */
  cityCode?: number | null;
  streetCode?: number | null;
  /** 'registry' = the official data.gov.il list; 'osm' = Photon/Nominatim. */
  source?: 'registry' | 'osm';
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

/** Exported for the regression pin — pure, no network. */
export function photonFeatureToPrediction(f: any): Prediction {
  const p = f?.properties || {};
  const coords = f?.geometry?.coordinates || [];
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
    // Building-level only — see BUILDING_LEVEL_POSTCODE note above.
    postalCode: p.housenumber && p.postcode ? String(p.postcode) : undefined,
    countryCode: p.countrycode || 'IL',
    source: 'osm' as const,
    lat: typeof coords[1] === 'number' ? coords[1] : undefined,
    lng: typeof coords[0] === 'number' ? coords[0] : undefined,
  };
}

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
      .map(photonFeatureToPrediction)
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
        // Building-level only — see BUILDING_LEVEL_POSTCODE note above.
        postalCode: streetNumber && a.postcode ? String(a.postcode) : undefined,
        countryCode: 'IL',
        source: 'osm' as const,
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
    placeId: `ilstreet:${r.cityCode ?? ''}-${r.streetCode ?? ''}`,
    description: `${r.street}, ${r.city}`,
    mainText: r.street,
    secondaryText: r.city,
    street: r.street,
    city: r.city,
    countryCode: 'IL',
    cityCode: r.cityCode ?? null,
    streetCode: r.streetCode ?? null,
    source: 'registry' as const,
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

/**
 * OSM splits one street into many segments, so a single street can come back as
 * several features with the SAME description and different coordinates. Untouched,
 * the customer saw six rows of which five read identically
 * ("ויצמן, כפר סבא, מחוז המרכז") — a dropdown you cannot choose from, which is
 * why address search "did not bring the address". Collapse on what the customer
 * actually reads, and keep the most specific row for each (a hit carrying a house
 * number beats a bare street).
 */
export function dedupePredictions(list: Prediction[]): Prediction[] {
  const best = new Map<string, Prediction>();
  for (const p of list) {
    // Key on what the address IS, not on the sentence we printed. OSM appends a
    // district ("ויצמן, כפר סבא, מחוז המרכז") where our registry does not
    // ("ויצמן, כפר סבא") — keying on the description alone left both on screen as
    // two rows for one street.
    const key = (p.street || p.city)
      ? `${(p.street || '').trim()}|${(p.streetNumber || '').trim()}|${(p.city || '').trim()}`.toLowerCase()
      : (p.description || '').replace(/\s+/g, ' ').trim().toLowerCase();
    if (!key) continue;
    const seen = best.get(key);
    if (!seen) { best.set(key, p); continue; }
    best.set(key, mergePrediction(seen, p));
  }
  return Array.from(best.values());
}

/**
 * Two sources describing one street, each holding something the other lacks.
 * The registry is authoritative for the NAME and carries the official
 * Israel-Post code; OSM is the only one with coordinates and house numbers.
 * Losing either is a real loss, so combine rather than pick.
 */
function mergePrediction(a: Prediction, b: Prediction): Prediction {
  const registry = a.source === 'registry' ? a : b.source === 'registry' ? b : null;
  const osm = a.source === 'osm' ? a : b.source === 'osm' ? b : null;
  const base = registry ?? a;
  const other = registry ? (osm ?? b) : b;
  return {
    ...base,
    // A building-level hit beats a bare street — it is the only one allowed to
    // carry a postcode (see BUILDING_LEVEL_POSTCODE).
    streetNumber: base.streetNumber || other.streetNumber,
    postalCode: base.postalCode || other.postalCode,
    lat: base.lat ?? other.lat,
    lng: base.lng ?? other.lng,
    state: base.state || other.state,
    cityCode: base.cityCode ?? other.cityCode ?? null,
    streetCode: base.streetCode ?? other.streetCode ?? null,
    // Keep the registry's clean description when we have one.
    description: registry ? registry.description : base.description,
    mainText: registry ? registry.mainText : base.mainText,
    secondaryText: registry ? registry.secondaryText : base.secondaryText,
  };
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

  // OUR OWN official registry runs FIRST, alongside Photon — not as a
  // never-reached fallback.
  //
  // It used to sit behind `if (predictions.length === 0)`, and Photon answers
  // every plausible Israeli query with something, so those 63,571 official
  // streets / 1,310 cities (data.gov.il, רשות האוכלוסין וההגירה) were in effect
  // dead weight in the image: measured 2026-09-11, Photon returned 1-6 rows for
  // 5/5 real Israeli street queries, so the local branch never ran once.
  //
  // The two sources are not rivals. The registry is authoritative for WHICH
  // STREET EXISTS and carries the Israel-Post key; Photon is the only one with
  // coordinates and house numbers. mergePrediction() combines them, so one row
  // ends up with the official name + code AND real coordinates.
  const [photon, registry] = await Promise.all([
    photonSuggest(q).catch((err: any) => {
      logger.warn('[geocode/suggest] photon failed (soft)', { error: err?.message });
      return [] as Prediction[];
    }),
    Promise.resolve(localStreetSuggest(q)),
  ]);

  // Registry first: it is the authority on the name, and dedupe keeps the first
  // row it sees as the base for the merge.
  let predictions: Prediction[] = [...registry, ...photon];

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

  predictions = dedupePredictions(predictions);

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
      // Building-level only — see BUILDING_LEVEL_POSTCODE note above. "Use my
      // location" that lands mid-street must not stamp that segment's code.
      postalCode: a.house_number ? a.postcode : undefined,
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
