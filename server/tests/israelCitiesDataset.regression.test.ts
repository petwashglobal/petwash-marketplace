/**
 * PR-LOCATION-CITIES-1 — Israel city seed dataset regression suite.
 *
 * CEO directive (2026-05-10):
 *   • Pure data foundation; NO runtime fetch from any Gist or
 *     external host.
 *   • Postcodes intentionally empty until a CEO-approved postcode
 *     source is layered in. Tests forbid any fake postcode here.
 *   • No backend route, no schema, no booking wiring, no payment /
 *     auth / admin / provider matching.
 *
 * Source-pin invariants (every category fails LOUDLY if the
 * dataset drifts):
 *
 *   A. file presence + module shape
 *   B. dataset volume + per-row shape
 *   C. uniqueness + identity
 *   D. normalization correctness (he + en)
 *   E. helper behaviour (lookup, search, popular)
 *   F. no fake postcode / district / region data
 *   G. no runtime network / persistence / payment / auth wiring
 *   H. file-system isolation (no backend route, no schema, no
 *      Drizzle migration, no booking module touched)
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { resolve } from 'path';

import {
  ISRAEL_CITIES,
  ISRAEL_CITIES_SOURCE,
  ISRAEL_CITIES_SOURCE_VERSION,
  getIsraelCities,
  findIsraelCityBySymbol,
  getPopularIsraelCities,
  searchIsraelCities,
  normalizeHebrewCitySearch,
  normalizeEnglishCitySearch,
  type IsraelCity,
} from '../../shared/data/israel-cities';

const ROOT = resolve(__dirname, '..', '..');

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), 'utf8');
}

/** Strip JS/TS comments + string literals so regex scans only hit code. */
function codeOnly(src: string): string {
  let out = src;
  out = out.replace(/\/\*[\s\S]*?\*\//g, '');
  out = out.replace(/(^|[^:])\/\/.*$/gm, '$1');
  out = out.replace(/'(?:\\.|[^'\\])*'/g, "''");
  out = out.replace(/"(?:\\.|[^"\\])*"/g, '""');
  out = out.replace(/`(?:\\.|[^`\\])*`/g, '``');
  return out;
}

const NEW_FILES = [
  'shared/data/israel-cities.ts',
  'server/tests/israelCitiesDataset.regression.test.ts',
  'docs/location/israel-cities-dataset.md',
];

// ─────────────────────────────────────────────────────────────────────────
// A. File presence + module shape
// ─────────────────────────────────────────────────────────────────────────
describe('PR-LOCATION-CITIES-1 — A. file layout + module shape', () => {
  it('A1. all 3 new files exist', () => {
    for (const rel of NEW_FILES) {
      expect(existsSync(resolve(ROOT, rel)), `expected ${rel}`).toBe(true);
    }
  });

  it('A2. dataset module exports the agreed surface', () => {
    expect(typeof getIsraelCities).toBe('function');
    expect(typeof findIsraelCityBySymbol).toBe('function');
    expect(typeof getPopularIsraelCities).toBe('function');
    expect(typeof searchIsraelCities).toBe('function');
    expect(typeof normalizeHebrewCitySearch).toBe('function');
    expect(typeof normalizeEnglishCitySearch).toBe('function');
    expect(Array.isArray(ISRAEL_CITIES)).toBe(true);
    expect(ISRAEL_CITIES_SOURCE).toBe('gabmic-israel-cities-seed');
    expect(ISRAEL_CITIES_SOURCE_VERSION).toBe('2019-07');
  });
});

// ─────────────────────────────────────────────────────────────────────────
// B. Dataset volume + per-row shape
// ─────────────────────────────────────────────────────────────────────────
describe('PR-LOCATION-CITIES-1 — B. dataset volume + row shape', () => {
  it('B1. dataset has the expected high volume (≥ 1200 rows)', () => {
    expect(ISRAEL_CITIES.length).toBeGreaterThanOrEqual(1200);
  });

  it('B2. dataset has the exact baked row count (pin against silent drift)', () => {
    expect(ISRAEL_CITIES.length).toBe(1272);
  });

  it('B3. every row has a non-empty citySymbol', () => {
    for (const c of ISRAEL_CITIES) {
      expect(typeof c.citySymbol).toBe('string');
      expect(c.citySymbol.length).toBeGreaterThan(0);
      expect(c.citySymbol).toBe(c.citySymbol.trim());
    }
  });

  it('B4. every row has a non-empty hebrewName', () => {
    for (const c of ISRAEL_CITIES) {
      expect(typeof c.hebrewName).toBe('string');
      expect(c.hebrewName.length).toBeGreaterThan(0);
    }
  });

  it('B5. every row has an englishName field (string; may be empty for the 6 known source gaps)', () => {
    let emptyEn = 0;
    for (const c of ISRAEL_CITIES) {
      expect(typeof c.englishName).toBe('string');
      if (c.englishName.length === 0) emptyEn++;
    }
    // Exactly 6 known empty-english rows in the source. If this number
    // changes, the seed has drifted and downstream callers must be
    // re-reviewed before booking matching is enabled.
    expect(emptyEn).toBe(6);
  });

  it('B6. every row has both normalized fields populated where the source has the language', () => {
    for (const c of ISRAEL_CITIES) {
      expect(typeof c.normalizedHebrew).toBe('string');
      expect(c.normalizedHebrew.length).toBeGreaterThan(0);
      expect(typeof c.normalizedEnglish).toBe('string');
      // normalizedEnglish may be '' iff englishName was '' in the source.
      if (c.englishName === '') {
        expect(c.normalizedEnglish).toBe('');
      } else {
        expect(c.normalizedEnglish.length).toBeGreaterThan(0);
      }
    }
  });

  it('B7. every row carries the correct provenance + null-by-default extension fields', () => {
    for (const c of ISRAEL_CITIES) {
      expect(c.source).toBe('gabmic-israel-cities-seed');
      expect(c.aliases).toEqual([]);
      expect(c.district).toBeNull();
      expect(c.region).toBeNull();
      expect(c.postcodes).toEqual([]);
      expect(typeof c.isActive).toBe('boolean');
      expect(typeof c.priority).toBe('number');
      expect(c.priority).toBeGreaterThanOrEqual(0);
      expect(c.notes === null || typeof c.notes === 'string').toBe(true);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────
// C. Uniqueness + identity
// ─────────────────────────────────────────────────────────────────────────
describe('PR-LOCATION-CITIES-1 — C. uniqueness + identity', () => {
  it('C1. citySymbol is unique across the entire dataset', () => {
    const seen = new Map<string, IsraelCity>();
    for (const c of ISRAEL_CITIES) {
      const dup = seen.get(c.citySymbol);
      expect(dup, `duplicate symbol ${c.citySymbol}`).toBeUndefined();
      seen.set(c.citySymbol, c);
    }
    expect(seen.size).toBe(ISRAEL_CITIES.length);
  });

  it('C2. major Israeli cities are present under their official symbols', () => {
    // Spot-check the most populous cities. These are anchors —
    // if any disappear, search/booking UX breaks for most users.
    const mustHave: ReadonlyArray<{ symbol: string; en: string }> = [
      { symbol: '5000', en: 'TEL AVIV - YAFO' },
      { symbol: '3000', en: 'JERUSALEM' },
      { symbol: '4000', en: 'HAIFA' },
      { symbol: '8300', en: 'RISHON LEZIYYON' },
      { symbol: '7900', en: 'PETAH TIQWA' },
      { symbol: '70', en: 'ASHDOD' },
      { symbol: '9000', en: "BE'ER SHEVA" },
      { symbol: '6400', en: 'HERZELIYYA' },
      { symbol: '8700', en: "RA'ANANA" },
      { symbol: '2600', en: 'ELAT' },
    ];
    for (const m of mustHave) {
      const row = findIsraelCityBySymbol(m.symbol);
      expect(row, `missing city symbol ${m.symbol}`).toBeDefined();
      expect(row!.englishName).toBe(m.en);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────
// D. Normalization correctness
// ─────────────────────────────────────────────────────────────────────────
describe('PR-LOCATION-CITIES-1 — D. normalization correctness', () => {
  it('D1. normalizeEnglishCitySearch lower-cases + strips punctuation + collapses whitespace', () => {
    expect(normalizeEnglishCitySearch("BE'ER SHEVA")).toBe('be er sheva');
    expect(normalizeEnglishCitySearch('Tel Aviv - Yafo')).toBe('tel aviv yafo');
    expect(normalizeEnglishCitySearch('  HAIFA  ')).toBe('haifa');
    expect(normalizeEnglishCitySearch('')).toBe('');
  });

  it('D2. normalizeHebrewCitySearch strips parens (incl. BiDi-flipped artifacts) + collapses whitespace', () => {
    // Source has ")שבט(" written in visual order. The stripper drops
    // the parens regardless of which side they appear on.
    expect(normalizeHebrewCitySearch('אבו ג\'ווייעד )שבט(')).toBe('אבו ג ווייעד שבט');
    expect(normalizeHebrewCitySearch('  ירושלים  ')).toBe('ירושלים');
    expect(normalizeHebrewCitySearch('')).toBe('');
  });

  it('D3. baked normalizedHebrew matches the live normalizer for every row', () => {
    for (const c of ISRAEL_CITIES) {
      expect(c.normalizedHebrew).toBe(normalizeHebrewCitySearch(c.hebrewName));
    }
  });

  it('D4. baked normalizedEnglish matches the live normalizer for every row', () => {
    for (const c of ISRAEL_CITIES) {
      expect(c.normalizedEnglish).toBe(normalizeEnglishCitySearch(c.englishName));
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────
// E. Helper behaviour
// ─────────────────────────────────────────────────────────────────────────
describe('PR-LOCATION-CITIES-1 — E. helpers', () => {
  it('E1. getIsraelCities returns the full dataset as a stable reference', () => {
    const a = getIsraelCities();
    const b = getIsraelCities();
    expect(a).toBe(b);
    expect(a.length).toBe(ISRAEL_CITIES.length);
  });

  it('E2. findIsraelCityBySymbol resolves a known symbol and trims input', () => {
    const tlv = findIsraelCityBySymbol('5000');
    expect(tlv?.englishName).toBe('TEL AVIV - YAFO');
    const tlvPadded = findIsraelCityBySymbol('  5000  ');
    expect(tlvPadded?.citySymbol).toBe('5000');
  });

  it('E3. findIsraelCityBySymbol returns undefined for empty / unknown', () => {
    expect(findIsraelCityBySymbol('')).toBeUndefined();
    expect(findIsraelCityBySymbol('   ')).toBeUndefined();
    expect(findIsraelCityBySymbol('THIS-SYMBOL-DOES-NOT-EXIST')).toBeUndefined();
  });

  it('E4. getPopularIsraelCities returns the curated popular subset, sorted, all priority>0', () => {
    const popular = getPopularIsraelCities();
    expect(popular.length).toBeGreaterThanOrEqual(15);
    expect(popular.length).toBeLessThanOrEqual(30);
    for (const c of popular) {
      expect(c.priority).toBeGreaterThan(0);
      expect(c.isActive).toBe(true);
    }
    // Tel Aviv must be in the popular set.
    expect(popular.some((c) => c.citySymbol === '5000')).toBe(true);
  });

  it('E5. searchIsraelCities (en) finds Tel Aviv by partial query', () => {
    const results = searchIsraelCities('tel aviv', 'en');
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((c) => c.citySymbol === '5000')).toBe(true);
  });

  it('E6. searchIsraelCities (he) finds ירושלים by partial query', () => {
    const results = searchIsraelCities('ירוש', 'he');
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((c) => c.citySymbol === '3000')).toBe(true);
  });

  it('E7. searchIsraelCities returns [] for empty / whitespace / no-match query', () => {
    expect(searchIsraelCities('', 'en')).toEqual([]);
    expect(searchIsraelCities('   ', 'en')).toEqual([]);
    expect(searchIsraelCities('zzznotacityxxx', 'en')).toEqual([]);
  });

  it('E8. searchIsraelCities respects limit and prioritizes popular cities', () => {
    const results = searchIsraelCities('a', 'en', 5);
    expect(results.length).toBeLessThanOrEqual(5);
    // The first hit should be a priority-100 city if any popular city
    // contains the letter "a" — Tel Aviv certainly does.
    expect(results[0]?.priority).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// F. No fake postcode / district / region data
// ─────────────────────────────────────────────────────────────────────────
describe('PR-LOCATION-CITIES-1 — F. no invented postcode / district / region data', () => {
  it('F1. every row has postcodes === [] (source has none; we do NOT invent)', () => {
    for (const c of ISRAEL_CITIES) {
      expect(c.postcodes).toEqual([]);
    }
  });

  it('F2. every row has district === null (source has none; we do NOT invent)', () => {
    for (const c of ISRAEL_CITIES) {
      expect(c.district).toBeNull();
    }
  });

  it('F3. every row has region === null (source has none; we do NOT invent)', () => {
    for (const c of ISRAEL_CITIES) {
      expect(c.region).toBeNull();
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────
// G. No runtime network / persistence / payment / auth wiring
// ─────────────────────────────────────────────────────────────────────────
describe('PR-LOCATION-CITIES-1 — G. no runtime network / persistence / payment / auth wiring', () => {
  const FORBIDDEN_RUNTIME: ReadonlyArray<RegExp> = [
    /\bfetch\s*\(/,
    /\bnew\s+FormData\b/,
    /\baxios\b/,
    /\bXMLHttpRequest\b/,
    /apiRequest\(/,
    /localStorage\.(set|remove|clear)/,
    /sessionStorage\.(set|remove|clear)/,
    /\bgist\.github(?:usercontent)?\.com\b/,
    /\bgist\.github\.com\b/,
    /\bhttps?:\/\//,
  ];
  const FORBIDDEN_VENDORS: ReadonlyArray<RegExp> = [
    /\bStripe\b/,
    /\bTranzila\b/i,
    /\bNayax\b/i,
    /\bUPay\b/i,
    /\bSUMIT\b/i,
    /\bMasav\b/i,
    /\bIBAN\b/,
    /\bWallet\b/,
    /\bPayout\b/i,
    /\bBilling\b/,
    /\bPayment(s|Provider|Method)\b/,
  ];
  const FORBIDDEN_AUTH: ReadonlyArray<RegExp> = [
    /\bvalidateFirebaseToken\b/,
    /\brequireAdmin\b/,
    /\brequireBrainAccess\b/,
    /\bisSuperAdmin\b/,
    /\bauditLog\b/,
  ];

  it('G1. shared/data/israel-cities.ts has no runtime network / persistence', () => {
    const src = codeOnly(read('shared/data/israel-cities.ts'));
    for (const rx of FORBIDDEN_RUNTIME) {
      expect(rx.test(src), `israel-cities.ts violates ${rx}`).toBe(false);
    }
  });

  it('G2. shared/data/israel-cities.ts has no payment / vendor identifiers', () => {
    const src = codeOnly(read('shared/data/israel-cities.ts'));
    for (const rx of FORBIDDEN_VENDORS) {
      expect(rx.test(src), `israel-cities.ts contains forbidden ${rx}`).toBe(false);
    }
  });

  it('G3. shared/data/israel-cities.ts has no auth / admin / audit identifiers', () => {
    const src = codeOnly(read('shared/data/israel-cities.ts'));
    for (const rx of FORBIDDEN_AUTH) {
      expect(rx.test(src), `israel-cities.ts contains forbidden ${rx}`).toBe(false);
    }
  });

  it('G4. shared/data/israel-cities.ts has no top-level side effects (only exports)', () => {
    const src = codeOnly(read('shared/data/israel-cities.ts'));
    // Forbid runtime statements that would execute on import.
    expect(/\bconsole\.(log|error|warn|info|debug)\s*\(/.test(src)).toBe(false);
    expect(/\bprocess\.env\b/.test(src)).toBe(false);
    expect(/\beval\s*\(/.test(src)).toBe(false);
    expect(/\bsetTimeout\s*\(/.test(src)).toBe(false);
    expect(/\bsetInterval\s*\(/.test(src)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// H. File-system isolation — no backend route, no schema, no booking touch
// ─────────────────────────────────────────────────────────────────────────
describe('PR-LOCATION-CITIES-1 — H. isolation — no backend route / schema / booking changes', () => {
  it('H1. no new server route file references the dataset', () => {
    // Walk server/routes (one level deep) and confirm no file imports
    // the new dataset module. Phase-1 is data-only; backend wiring
    // belongs to a future PR.
    const routesDir = resolve(ROOT, 'server', 'routes');
    if (!existsSync(routesDir)) return; // server layout differs in some checkouts; skip cleanly
    const entries = readdirSync(routesDir);
    for (const name of entries) {
      if (!name.endsWith('.ts') && !name.endsWith('.tsx')) continue;
      const src = read(`server/routes/${name}`);
      expect(
        src.includes('shared/data/israel-cities'),
        `server/routes/${name} imports the new dataset (out of scope for PR-LOCATION-CITIES-1)`,
      ).toBe(false);
    }
  });

  it('H2. shared/schema files are not touched by this PR', () => {
    // The new dataset must not be imported from any schema file.
    const schemaCandidates = [
      'shared/schema.ts',
      'shared/firestore-schema.ts',
    ];
    for (const rel of schemaCandidates) {
      const abs = resolve(ROOT, rel);
      if (!existsSync(abs)) continue;
      const src = read(rel);
      expect(
        src.includes('shared/data/israel-cities'),
        `${rel} imports the new dataset (schema must not depend on it)`,
      ).toBe(false);
    }
  });

  it('H3. dataset is not yet wired into any client UI component', () => {
    // Phase-1 is data-only. UI wiring belongs to a later PR. We
    // assert nothing under client/src imports the module.
    const clientDir = resolve(ROOT, 'client', 'src');
    if (!existsSync(clientDir)) return;
    function walk(dir: string): string[] {
      const out: string[] = [];
      const stack = [dir];
      while (stack.length) {
        const cur = stack.pop()!;
        for (const entry of readdirSync(cur, { withFileTypes: true })) {
          if (entry.name.startsWith('.')) continue;
          if (entry.name === 'node_modules') continue;
          const full = resolve(cur, entry.name);
          if (entry.isDirectory()) {
            stack.push(full);
          } else if (
            entry.name.endsWith('.ts') ||
            entry.name.endsWith('.tsx')
          ) {
            out.push(full);
          }
        }
      }
      return out;
    }
    for (const file of walk(clientDir)) {
      const src = readFileSync(file, 'utf8');
      expect(
        src.includes('shared/data/israel-cities') ||
          src.includes("from '@shared/data/israel-cities'"),
        `${file.replace(ROOT + '/', '')} imports the dataset (Phase-1 is data-only)`,
      ).toBe(false);
    }
  });
});
