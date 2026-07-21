/**
 * GET /api/geo/language — first-visit language default from the caller's country.
 *
 * WHY SERVER-SIDE: the client used to hit ipapi.co / ipinfo.io / ip-api.com
 * directly. Two of those three are blocked by our own CSP, so there was no
 * working fallback — and ipapi.co's free tier is ~1k lookups/day, after which
 * detection fails for everyone. When it fails, an INTERNATIONAL visitor gets
 * stuck on the Hebrew default, which is the opposite of the rule.
 *
 * The rule (CEO): Israel → Hebrew first; everywhere else → English first. A saved
 * user preference always wins and is handled entirely on the client — this
 * endpoint is only consulted on a true first visit.
 *
 * Calling our own origin is always CSP-allowed, has no per-visitor rate limit,
 * and reuses the geo lookup the server already does for security alerts.
 */
import { Router, type Request, type Response } from 'express';
import { getClientIP } from '../services/alerts';
import { safeIPFetch } from '../lib/safeOutboundUrl';
import { logger } from '../lib/logger';

const router = Router();

/** Country → first-visit language. Only Hebrew-first markets need an entry;
 *  everything else falls through to English, which is the rule. */
const COUNTRY_LANGUAGE: Record<string, string> = {
  IL: 'he', // Israel — Hebrew first
};

// Tiny in-process cache: country rarely changes for an IP within a session, and
// this keeps us well under any upstream quota. Not durable on purpose — it is a
// best-effort speed-up, never a source of truth.
const cache = new Map<string, { country: string; at: number }>();
const CACHE_MS = 6 * 60 * 60 * 1000; // 6h

function isPublicIp(ip: string): boolean {
  if (!ip) return false;
  if (ip === '127.0.0.1' || ip === '::1') return false;
  if (/^10\./.test(ip) || /^192\.168\./.test(ip) || /^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return false;
  if (/^169\.254\./.test(ip) || /^fe80:/i.test(ip)) return false;
  return true;
}

router.get('/language', async (req: Request, res: Response) => {
  // Never cache the RESPONSE at the CDN — it is per-caller by IP.
  res.set('Cache-Control', 'private, max-age=0, no-store');

  const ip = getClientIP(req);
  let country = '';

  try {
    if (isPublicIp(ip)) {
      const cached = cache.get(ip);
      if (cached && Date.now() - cached.at < CACHE_MS) {
        country = cached.country;
      } else {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2500);
        const r = await safeIPFetch('https://ipapi.co', ip, '/json/', { signal: controller.signal });
        clearTimeout(timeoutId);
        if (r.ok) {
          const data: any = await r.json();
          country = String(data.country_code || data.country || '').toUpperCase();
          if (country) cache.set(ip, { country, at: Date.now() });
        }
      }
    }
  } catch (err: any) {
    logger.warn('[GeoLanguage] country lookup failed — defaulting English', { error: err?.message });
  }

  // Unknown country → English. English is the safe global default; only a
  // confident IL match flips to Hebrew.
  const language = COUNTRY_LANGUAGE[country] || 'en';
  res.json({ country: country || null, language });
});

export default router;
