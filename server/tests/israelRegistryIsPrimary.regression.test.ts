/**
 * The official Israeli street registry must actually be used — regression pin
 * (2026-09-11).
 *
 * `server/data/israel-streets.json` is the CEO's own baked-in copy of the
 * data.gov.il registry (רשות האוכלוסין וההגירה): 63,571 streets / 1,310 cities,
 * each row carrying the official Israel-Post key סמל_ישוב / סמל_רחוב.
 *
 * Two things made it dead weight:
 *
 *  1. The codes were parsed into a type and dropped when the search index was
 *     built, so `city_code` / `street_code` existed in the 6.6MB file and in a
 *     TypeScript interface — and NOWHERE else in the product. No caller, no
 *     response field, no column.
 *
 *  2. The registry was consulted only inside `if (predictions.length === 0)`,
 *     behind Photon. Measured 2026-09-11 against live Photon: 5 of 5 real
 *     Israeli street queries returned 1-6 rows, so that branch never ran and the
 *     registry was never reached once.
 *
 * The registry is authoritative for WHICH STREET EXISTS and for the Israel-Post
 * key. Photon is the only source of coordinates and house numbers. They are
 * merged, not ranked against each other.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { dedupePredictions } from '../routes/geocode';
import { searchIsraelStreets } from '../lib/israelStreets';

const REPO_ROOT = join(__dirname, '..', '..');

/** The index loads asynchronously off the request path. */
async function waitForRegistry(timeoutMs = 20000): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (searchIsraelStreets('ויצמן כפר סבא', 3).length > 0) return;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('israel-streets registry never loaded');
}

describe('the official Israeli registry is primary, and its codes survive', () => {
  it('the dataset really does carry the Israel-Post key', () => {
    const raw = JSON.parse(readFileSync(join(REPO_ROOT, 'server/data/israel-streets.json'), 'utf8'));
    expect(raw.streets.length).toBeGreaterThan(60000);
    const weizmann = raw.streets.find(
      (r: any) => r.city_name === 'כפר סבא' && r.street_name === 'ויצמן',
    );
    // Our own station street. If this changes, the dataset was re-baked.
    expect(weizmann).toMatchObject({ city_code: 6900, street_code: 523 });
  });

  it('searchIsraelStreets returns the codes instead of discarding them', async () => {
    await waitForRegistry();
    const hits = searchIsraelStreets('ויצמן כפר סבא', 6);
    expect(hits.length).toBeGreaterThan(0);
    const ks = hits.find((h) => h.city === 'כפר סבא');
    expect(ks, 'the city the customer typed should rank').toBeTruthy();
    expect(
      ks!.cityCode,
      'the Israel-Post settlement code was dropped when the index was built.',
    ).toBe(6900);
    expect(ks!.streetCode).toBe(523);
  });

  it('is NOT gated behind an empty-Photon branch any more', () => {
    const route = readFileSync(join(REPO_ROOT, 'server/routes/geocode.ts'), 'utf8');
    // The registry must be gathered up-front, not only when Photon came back empty.
    expect(route).toMatch(/const \[photon, registry\] = await Promise\.all/);
    expect(
      route,
      'localStreetSuggest must not sit behind `predictions.length === 0` — Photon ' +
        'answers essentially every Israeli query, so that branch never runs.',
    ).not.toMatch(/predictions\.length === 0\)\s*\{\s*predictions = localStreetSuggest/);
  });

  it('merges the registry name + code with the coordinates only OSM has', () => {
    const registryRow: any = {
      placeId: 'ilstreet:6900-523', description: 'ויצמן, כפר סבא',
      mainText: 'ויצמן', secondaryText: 'כפר סבא',
      street: 'ויצמן', city: 'כפר סבא', countryCode: 'IL',
      cityCode: 6900, streetCode: 523, source: 'registry',
    };
    const osmRow: any = {
      placeId: 'photon:W1', description: 'ויצמן, כפר סבא, מחוז המרכז',
      mainText: 'ויצמן', secondaryText: 'כפר סבא, מחוז המרכז',
      street: 'ויצמן', streetNumber: '', city: 'כפר סבא', state: 'מחוז המרכז',
      countryCode: 'IL', lat: 32.1732053, lng: 34.9172481, source: 'osm',
    };
    const [merged, ...rest] = dedupePredictions([registryRow, osmRow]);
    expect(rest, 'one street must not occupy two rows just because OSM appends a district').toEqual([]);
    expect(merged.cityCode).toBe(6900);
    expect(merged.streetCode).toBe(523);
    expect(merged.lat).toBeCloseTo(32.1732053, 5);
    expect(merged.description).toBe('ויצמן, כפר סבא');
  });

  it('a building-level OSM row stays its own row and keeps its postcode', () => {
    const street: any = {
      placeId: 'a', description: 'ויצמן, כפר סבא', mainText: 'ויצמן', secondaryText: 'כפר סבא',
      street: 'ויצמן', city: 'כפר סבא', countryCode: 'IL', cityCode: 6900, streetCode: 523, source: 'registry',
    };
    const building: any = {
      placeId: 'b', description: 'ויצמן 207, כפר סבא', mainText: 'ויצמן 207', secondaryText: 'כפר סבא',
      street: 'ויצמן', streetNumber: '207', city: 'כפר סבא', postalCode: '4445810',
      countryCode: 'IL', lat: 32.17, lng: 34.92, source: 'osm',
    };
    const out = dedupePredictions([street, building]);
    expect(out).toHaveLength(2);
    expect(out.find((p) => p.streetNumber === '207')!.postalCode).toBe('4445810');
  });
});
