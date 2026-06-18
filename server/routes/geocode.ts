// Free address autocomplete via OpenStreetMap Nominatim — replaces the broken
// Google Places autocomplete (2026-06-18). Chosen to avoid Google billing (the
// ~$1000 surprise-bill incident). Nominatim policy: a User-Agent is REQUIRED and
// usage is ~1 req/sec — we add a tiny in-memory cache + a per-IP limiter, and the
// client already debounces 300ms.
import { Router, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { logger } from '../lib/logger';

const router = Router();

const USER_AGENT = process.env.NOMINATIM_USER_AGENT || 'PetWash/1.0 (support@petwash.co.il)';
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

// Small TTL cache so repeated keystrokes / popular queries don't hammer Nominatim.
const cache = new Map<string, { at: number; data: any[] }>();
const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX = 500;

const suggestLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60, // per IP/min — generous for typing, still polite to Nominatim
  standardHeaders: true,
  legacyHeaders: false,
});

// GET /api/geocode/suggest?q=...&lang=he — address predictions with lat/lng inline.
router.get('/suggest', suggestLimiter, async (req: Request, res: Response) => {
  const q = String(req.query.q || '').trim();
  const lang = String(req.query.lang || 'he');
  if (q.length < 3) return res.json({ predictions: [] });

  const cacheKey = `${lang}:${q.toLowerCase()}`;
  const hit = cache.get(cacheKey);
  if (hit && (Date.now() - hit.at) < CACHE_TTL_MS) {
    return res.json({ predictions: hit.data });
  }

  const params = new URLSearchParams({
    q, format: 'jsonv2', addressdetails: '1', limit: '6',
    countrycodes: 'il', 'accept-language': lang,
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const r = await fetch(`${NOMINATIM_URL}?${params.toString()}`, {
      headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' },
      signal: controller.signal,
    });
    if (!r.ok) {
      logger.warn('[geocode/suggest] Nominatim non-OK', { status: r.status });
      return res.json({ predictions: [] }); // soft-fail → client lets user type manually
    }
    const rows = await r.json();
    const predictions = (Array.isArray(rows) ? rows : []).map((x: any) => ({
      placeId: String(x.place_id),
      description: x.display_name,
      mainText: x.name || String(x.display_name || '').split(',')[0],
      secondaryText: x.display_name,
      lat: Number(x.lat),
      lng: Number(x.lon),
      city: x.address?.city || x.address?.town || x.address?.village || x.address?.municipality,
      postalCode: x.address?.postcode,
      countryCode: 'IL',
    }));
    if (cache.size >= CACHE_MAX) cache.clear();
    cache.set(cacheKey, { at: Date.now(), data: predictions });
    return res.json({ predictions });
  } catch (err: any) {
    logger.warn('[geocode/suggest] failed (soft)', { error: err?.message });
    return res.json({ predictions: [] });
  } finally {
    clearTimeout(timeout);
  }
});

export default router;
