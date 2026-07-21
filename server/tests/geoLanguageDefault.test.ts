/**
 * First-visit language rule (CEO, standing): Israel → Hebrew first; the rest of
 * the world → English first. A saved user preference always wins over geo.
 *
 * Why the server endpoint exists: the client used to call three third-party geo
 * APIs directly — and our own CSP blocks two of them (only ipapi.co is in
 * connect-src), so there was ONE working service, on a ~1k/day free tier. When
 * it rate-limited, detection failed and international first-time visitors got
 * stuck on the Hebrew boot default — the opposite of the rule.
 *
 * /api/geo/language resolves the country server-side (no CSP, no per-visitor
 * quota, 6h in-process cache) and the client consults it FIRST.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..');
const route = readFileSync(resolve(ROOT, 'server/routes/geo-language.ts'), 'utf8');
const client = readFileSync(resolve(ROOT, 'client/src/lib/geolocation.ts'), 'utf8');
const mount = readFileSync(resolve(ROOT, 'server/routes.ts'), 'utf8');

describe('geo language — the rule', () => {
  it('Israel maps to Hebrew on the server', () => {
    expect(route).toMatch(/IL:\s*'he'/);
  });

  it('unknown country falls to English, never Hebrew', () => {
    expect(route).toMatch(/COUNTRY_LANGUAGE\[country\]\s*\|\|\s*'en'/);
  });

  it('client total-failure fallback is English (rest-of-world rule)', () => {
    expect(client).toMatch(/Geolocation detection failed — defaulting to English/);
    // The catch-all return must be 'en'.
    expect(client).toMatch(/logger\.error\('Geolocation error', error\);\s*\n\s*return 'en';/);
  });

  it('saved preference always wins — geo never overrides pw_lang', () => {
    expect(client).toMatch(/pw_lang/);
    expect(client).toMatch(/skipping geo detection/);
  });
});

describe('geo language — the plumbing that made it fail', () => {
  it('client consults OUR endpoint first', () => {
    expect(client).toMatch(/getApiUrl\('\/api\/geo\/language'\)/);
    // Our endpoint must come before the external fallback in the list.
    expect(client.indexOf("/api/geo/language")).toBeLessThan(client.indexOf('ipapi.co/json'));
  });

  it('client no longer calls the CSP-blocked services', () => {
    // ipinfo.io and ip-api.com are NOT in connect-src; calling them can never
    // work. Check for fetchable URL LITERALS — the history comment may still
    // name the services in prose.
    expect(client).not.toMatch(/https:\/\/ipinfo\.io/);
    expect(client).not.toMatch(/https:\/\/ip-api\.com/);
  });

  it('server endpoint is mounted', () => {
    expect(mount).toMatch(/app\.use\('\/api\/geo',\s*apiLimiter,\s*geoLanguageRoutes\)/);
  });

  it('server responses are never CDN-cached (per-caller by IP)', () => {
    expect(route).toMatch(/no-store/);
  });

  it('server rejects private/loopback IPs instead of geolocating them', () => {
    expect(route).toMatch(/isPublicIp/);
  });
});
