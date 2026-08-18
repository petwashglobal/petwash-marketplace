/**
 * PR-LOCATION-ADDRESS-MODEL-1 — pure address types, no schema, no UI.
 *
 * The vocabulary the LOCATION PR sequence (2..8) will consume. This
 * regression suite pins that:
 *   A. The file exists at shared/address/addressTypes.ts
 *   B. Every named type/interface the downstream PRs will reference is
 *      exported (grep-pinned so a future rename can't silently break the
 *      contract)
 *   C. The file is PURE TYPES — no runtime imports, no runtime exports,
 *      no schema, no fetch, no side effects (grep-pinned negative
 *      assertions on the shape a future author might slip in)
 *   D. The type invariants the CEO's location program spec calls out
 *      are actually enforced by the type shape (distanceMeters must be
 *      `number | null`, geo must be `MaybeGeoPoint` (nullable) never
 *      defaulting to (0,0), ServiceArea is a discriminated union with
 *      no "system-decided" mode, AddressMatch is an offer never an
 *      assignment)
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..');
const TYPES = 'shared/address/addressTypes.ts';

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), 'utf8');
}
function codeOnly(src: string): string {
  let out = src;
  out = out.replace(/\/\*[\s\S]*?\*\//g, '');
  out = out.replace(/(^|[^:])\/\/.*$/gm, '$1');
  return out;
}

// ─────────────────────────────────────────────────────────────────────────
// A. File exists
// ─────────────────────────────────────────────────────────────────────────
describe('PR-LOCATION-ADDRESS-MODEL-1 — A. file present', () => {
  it('A1. shared/address/addressTypes.ts exists', () => {
    expect(existsSync(resolve(ROOT, TYPES))).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// B. Every downstream-consumed name is exported
// ─────────────────────────────────────────────────────────────────────────
describe('PR-LOCATION-ADDRESS-MODEL-1 — B. named exports', () => {
  const src = read(TYPES);
  const code = codeOnly(src);

  // These are the names the PR-2..PR-8 sequence will import. If a future
  // refactor renames one, this test fires so the downstream PRs are not
  // silently broken.
  const REQUIRED_EXPORTS = [
    'GeoPoint',
    'MaybeGeoPoint',
    'StructuredAddress',
    'AddressSource',
    'AddressNormalizedKey',
    'ResolvedAddress',
    'ServiceArea',
    'ServiceAreaRadius',
    'ServiceAreaPolygon',
    'AddressMatch',
    'AddressMatchDecision',
  ];

  for (const name of REQUIRED_EXPORTS) {
    it(`B. exports ${name}`, () => {
      const re = new RegExp(`export\\s+(interface|type)\\s+${name}\\b`);
      expect(re.test(code)).toBe(true);
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// C. File is PURE TYPES — no runtime footprint
// ─────────────────────────────────────────────────────────────────────────
describe('PR-LOCATION-ADDRESS-MODEL-1 — C. pure-types discipline', () => {
  const src = read(TYPES);
  const code = codeOnly(src);

  it('C1. no runtime imports (no `import x from ...` — only `import type`)', () => {
    // Any bare `import {x} from ...` (no `type` keyword) would drag a
    // runtime dependency into what must stay pure-types. Also block
    // `import * as X from` and `import "..."` (side-effect import).
    const lines = code.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('import ')) {
        // Only `import type ...` is allowed. Anything else is a runtime import.
        if (!/^import\s+type\s/.test(trimmed)) {
          throw new Error(`Non-type import found: ${trimmed}`);
        }
      }
    }
    expect(true).toBe(true); // reach the assertion
  });

  it('C2. no exported values (function, const, class, enum) — only types/interfaces', () => {
    // A runtime enum is compiled to a JS object, a const is a value, a
    // function/class is executable. None belong in a pure-types file.
    expect(/export\s+function\b/.test(code)).toBe(false);
    expect(/export\s+const\b/.test(code)).toBe(false);
    expect(/export\s+let\b/.test(code)).toBe(false);
    expect(/export\s+var\b/.test(code)).toBe(false);
    expect(/export\s+class\b/.test(code)).toBe(false);
    expect(/export\s+enum\b/.test(code)).toBe(false); // use string-literal unions instead
  });

  it('C3. no schema / drizzle / db references (types must not know about persistence)', () => {
    const FORBIDDEN = ['drizzle-orm', 'pgTable', 'shared/schema', 'from \'@shared/schema', 'db.select', 'db.insert'];
    for (const f of FORBIDDEN) {
      if (code.includes(f)) {
        throw new Error(`Forbidden persistence reference in types file: ${f}`);
      }
    }
    expect(true).toBe(true);
  });

  it('C4. no UI / React / fetch / DOM references', () => {
    const FORBIDDEN = ['from \'react\'', 'from "react"', 'jsx', 'JSX.', 'window.', 'document.', 'fetch(', 'useState', 'useEffect'];
    for (const f of FORBIDDEN) {
      if (code.includes(f)) {
        throw new Error(`Forbidden UI/runtime reference in types file: ${f}`);
      }
    }
    expect(true).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// D. Type invariants from the location program spec
// ─────────────────────────────────────────────────────────────────────────
describe('PR-LOCATION-ADDRESS-MODEL-1 — D. spec invariants pinned in the type shape', () => {
  const src = read(TYPES);
  const code = codeOnly(src);

  it('D1. GeoPoint is exactly { lat, lng } — no {latitude, longitude}, no swapped-axis {x, y}', () => {
    const block = code.match(/export\s+interface\s+GeoPoint\s*\{([\s\S]*?)\}/)?.[1] || '';
    expect(/\blat\s*:\s*number\b/.test(block)).toBe(true);
    expect(/\blng\s*:\s*number\b/.test(block)).toBe(true);
    // Forbid the near-miss shapes so downstream code cannot import a
    // parallel type that quietly disagrees.
    expect(/\blatitude\b/.test(block)).toBe(false);
    expect(/\blongitude\b/.test(block)).toBe(false);
    expect(/^\s*x\s*:/m.test(block)).toBe(false);
    expect(/^\s*y\s*:/m.test(block)).toBe(false);
  });

  it('D2. MaybeGeoPoint is nullable — "no coords" is representable, never defaulted to (0,0)', () => {
    expect(/export\s+type\s+MaybeGeoPoint\s*=\s*GeoPoint\s*\|\s*null/.test(code)).toBe(true);
  });

  it('D3. ResolvedAddress.geo uses MaybeGeoPoint (never bare GeoPoint that would force a default)', () => {
    const block = code.match(/export\s+interface\s+ResolvedAddress\s*\{([\s\S]*?)\}/)?.[1] || '';
    expect(/\bgeo\s*:\s*MaybeGeoPoint\b/.test(block)).toBe(true);
  });

  it('D4. AddressMatch.distanceMeters is `number | null` — "no fake distance math without lat/lng"', () => {
    // The CEO\'s hard rule: if we don\'t have coordinates we don\'t
    // compute a distance and we don\'t pretend. The nullable type is
    // what enforces this at the language layer.
    const block = code.match(/export\s+interface\s+AddressMatch\s*\{([\s\S]*?)\}/)?.[1] || '';
    expect(/distanceMeters\s*:\s*number\s*\|\s*null/.test(block)).toBe(true);
  });

  it('D5. ServiceArea is a discriminated union of radius | polygon (no "system_decided" mode)', () => {
    // The type must have exactly two arms — provider CONTROLS the area.
    // Allow either the inline form `= A | B;` or the leading-pipe form
    // `=\n  | A\n  | B;` — both are the same discriminated union.
    expect(/export\s+type\s+ServiceArea\s*=\s*\|?\s*ServiceAreaRadius\s*\|\s*ServiceAreaPolygon\s*;/.test(code)).toBe(true);
    // The kind literals must be exactly these two — a future addition
    // of 'auto' or 'system_decided' would silently reintroduce the
    // "system picks for you" mode the CEO forbade.
    const radiusBlock = code.match(/export\s+interface\s+ServiceAreaRadius\s*\{([\s\S]*?)\}/)?.[1] || '';
    const polyBlock = code.match(/export\s+interface\s+ServiceAreaPolygon\s*\{([\s\S]*?)\}/)?.[1] || '';
    expect(/\bkind\s*:\s*['"]radius['"]/.test(radiusBlock)).toBe(true);
    expect(/\bkind\s*:\s*['"]polygon['"]/.test(polyBlock)).toBe(true);
  });

  it('D6. AddressSource union does NOT contain a "google_places" arm (free OSM only rule)', () => {
    const block = code.match(/export\s+type\s+AddressSource\s*=([\s\S]*?);/)?.[1] || '';
    expect(/google[_-]?places/i.test(block)).toBe(false);
  });

  it('D7. AddressMatch carries no "assigned" / "confirmed" / "bookedAt" — it is an OFFER, never an assignment', () => {
    const block = code.match(/export\s+interface\s+AddressMatch\s*\{([\s\S]*?)\}/)?.[1] || '';
    expect(/\bassigned\b/i.test(block)).toBe(false);
    expect(/\bconfirmed\b/i.test(block)).toBe(false);
    expect(/\bbookedAt\b/.test(block)).toBe(false);
    expect(/\bbookingId\b/.test(block)).toBe(false);
  });

  it('D8. AddressMatchDecision carries a timestamp + decidedBy (audit trail for match decisions)', () => {
    const block = code.match(/export\s+interface\s+AddressMatchDecision\s*\{([\s\S]*?)\}/)?.[1] || '';
    expect(/\bat\s*:\s*string\b/.test(block)).toBe(true);
    expect(/\bdecidedBy\s*:\s*string\b/.test(block)).toBe(true);
  });
});
