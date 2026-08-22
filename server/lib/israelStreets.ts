// Offline Israeli STREETS dataset — 63,571 streets across 1,310 cities, baked into
// the app (server/data/israel-streets.json). Refreshed 2026-08-07 straight from the
// OFFICIAL data.gov.il registry (רשות האוכלוסין וההגירה — רשימת רחובות בישראל,
// resource 9ad3862c-8391-4b2f-84a4-2d4c68625f4b, updated weekly; snapshot 02/08/2026).
// Now also stores the official settlement + street CODES (city_code / street_code) —
// the Israel-Post key for any future postcode enrichment. This is the primary source
// for street autocomplete: instant, in-Hebrew, zero runtime network call, no Google
// dependency, no fees. It has street + city (+ codes) only — NO postcode field exists
// in the government data; the exact 7-digit מיקוד + coordinates are filled per address
// by free OSM geocode-on-select for the one address the user actually picks.
import fs from 'fs';
import path from 'path';
import { logger } from './logger';

interface StreetRow { id: number; city_name: string; street_name: string; city_code?: number | null; street_code?: number | null; }
interface IndexedRow { city: string; street: string; nCity: string; nStreet: string }

// INDEX is null until the ASYNC background load finishes. Search returns [] while
// null so callers (geocode/suggest) transparently fall back to Photon. This is the
// fix for the 2026-07-29 outage: the previous version parsed the 6.8MB file
// SYNCHRONOUSLY on the request path, blocking the event loop long enough that Cloud
// Run health checks failed and the instance was killed mid-request (persistent
// HTTP 000). Now the file is read + parsed ONCE in the background at startup — no
// request ever triggers a blocking load.
let INDEX: IndexedRow[] | null = null;
let loadStarted = false;

// Strip Hebrew/Latin punctuation (quotes, maqaf, parens, dots) + lowercase so
// "מלון בקעת-הירדן" and "מלון בקעת הירדן" match the same needle.
export function normalizeStreet(s: string): string {
  return (s || '')
    .replace(/["'`.,()\[\]{}־\-\/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

async function loadAsync(): Promise<void> {
  if (loadStarted) return;
  loadStarted = true;
  // NOTE: no __dirname — this ships in an ESM bundle where __dirname is undefined,
  // and referencing it threw a ReferenceError BEFORE the try below, so the offline
  // streets never loaded. process.cwd() is /app in the container; the Docker image
  // copies server/data/, so this path resolves. (2026-07-30)
  const candidates = [
    path.resolve(process.cwd(), 'server/data/israel-streets.json'),
    path.resolve(process.cwd(), 'dist/server/data/israel-streets.json'),
  ];
  for (const p of candidates) {
    try {
      // Async file read — does NOT block the event loop.
      const buf = await fs.promises.readFile(p, 'utf8');
      const raw = JSON.parse(buf); // one-time parse at startup, off the request path
      const rows: StreetRow[] = Array.isArray(raw?.streets) ? raw.streets : [];
      INDEX = rows.map((r) => ({
        city: r.city_name,
        street: r.street_name,
        nCity: normalizeStreet(r.city_name),
        nStreet: normalizeStreet(r.street_name),
      }));
      logger.info('[israelStreets] loaded (async, startup)', { count: INDEX.length, path: p });
      return;
    } catch (e: any) {
      logger.warn('[israelStreets] load attempt failed', { path: p, error: e?.message });
    }
  }
  logger.error('[israelStreets] could not load dataset — street fallback stays empty (Photon covers)');
  INDEX = [];
}

// Kick off the background load at module import (server startup). Never awaited on
// the request path.
void loadAsync();

/**
 * Search the offline street list. Handles "street city" queries (e.g.
 * "דיזנגוף תל אביב") as well as street-only. Returns street+city pairs, ranked by
 * prefix/whole-match, deduped. No coordinates (geocoded later on save).
 */
export function searchIsraelStreets(query: string, limit = 6): Array<{ street: string; city: string }> {
  // Not loaded yet (still parsing at startup) or empty → caller falls back to Photon.
  if (!loadStarted) void loadAsync();
  const idx = INDEX;
  if (!idx || idx.length === 0) return [];
  const nq = normalizeStreet(query);
  if (nq.length < 2) return [];
  // Drop pure-number tokens — those are house numbers ("דיזנגוף 153 תל אביב"),
  // never part of a street NAME.
  const tokens = nq.split(' ').filter((t) => t && !/^\d+$/.test(t));
  if (tokens.length === 0) return [];

  // Try every split point: tokens 0..k are the street, k+1.. are the city. Take
  // the best-scoring split per row. This beats guessing which word is the city.
  const scoreStreet = (nStreet: string, streetPart: string): number => {
    if (!streetPart) return 0;
    if (nStreet === streetPart) return 8;
    if (nStreet.startsWith(streetPart)) return 6;
    if (streetPart.length >= 2 && nStreet.includes(streetPart)) return 4;
    return 0;
  };

  const scored: Array<{ street: string; city: string; score: number }> = [];
  for (const row of idx) {
    let best = 0;
    for (let k = 0; k < tokens.length; k++) {
      const streetPart = tokens.slice(0, k + 1).join(' ');
      const s0 = scoreStreet(row.nStreet, streetPart);
      if (s0 === 0) continue;
      const cityPart = tokens.slice(k + 1).filter((t) => t.length >= 2);
      const cityHits = cityPart.filter((t) => row.nCity.includes(t)).length;
      const total = s0 + cityHits * 5;
      if (total > best) best = total;
    }
    if (best > 0) scored.push({ street: row.street, city: row.city, score: best });
  }
  scored.sort((a, b) => b.score - a.score || a.street.length - b.street.length);

  const seen = new Set<string>();
  const out: Array<{ street: string; city: string }> = [];
  for (const r of scored) {
    const k = `${r.street}|${r.city}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ street: r.street, city: r.city });
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * Return the streets that live in a specific city, optionally filtered by a
 * name prefix. Powers the "street picker" the AddressPicker shows once the
 * user picks a city from the CityPicker — a real dropdown against the baked
 * data.gov.il registry, not free-text autocomplete. Returns [] while the
 * async loader is still populating INDEX (caller renders a spinner).
 */
export function getStreetsForCity(
  cityName: string,
  prefix = '',
  limit = 200,
): string[] {
  if (!loadStarted) void loadAsync();
  const idx = INDEX;
  if (!idx || idx.length === 0) return [];
  const nCity = normalizeStreet(cityName);
  if (!nCity) return [];
  const nPrefix = normalizeStreet(prefix);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const row of idx) {
    if (row.nCity !== nCity) continue;
    if (nPrefix && !row.nStreet.includes(nPrefix)) continue;
    if (seen.has(row.street)) continue;
    seen.add(row.street);
    out.push(row.street);
    if (out.length >= limit) break;
  }
  return out.sort((a, b) => a.localeCompare(b, 'he'));
}
