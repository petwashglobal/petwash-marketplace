/**
 * Regression pin — the K9000 analytics CONTRACT the admin dashboard joins on.
 *
 * Two failure modes, both silent on screen (which is what makes them dangerous —
 * a wrong number in an admin fiscal view looks exactly like a right one):
 *
 *  1. THE STATION JOIN. `byStation` groups on the TERMINAL REGISTRY's station id.
 *     Bay rows also carry `stationId`, the raw k9000_wash_events column, which
 *     different importers have written with different keys for the same physical
 *     station. A client joining bay rows to station rows on the raw column loses
 *     the station name and shows the bare key instead. `registryStationId` exists
 *     so the join is on the same identity the grouping used.
 *
 *  2. CURRENCY SEGREGATION. A real AUD 10 transaction exists on an Israeli
 *     terminal (currency mis-set at the machine). An earlier report of mine added
 *     it straight into the shekel total and produced a phantom "₪10" line. Foreign
 *     rows must be reported and never summed into the shekel figures.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const API = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes', 'admin-nayax-events.ts'), 'utf8');
const UI = fs.readFileSync(
  path.resolve(__dirname, '..', '..', 'client', 'src', 'pages', 'admin', 'AdminNayaxEvents.tsx'), 'utf8');

describe('analytics station join', () => {
  it('the API labels bay rows with the REGISTRY station id', () => {
    expect(API).toMatch(/registryStationId: t\.stationId/);
  });

  it('byStation groups on the registry id, not the raw column', () => {
    expect(API).toMatch(/byStation: roll\(\(r\) => terminalForMachine\(r\.terminalId\)\?\.stationId/);
  });

  it('the dashboard joins on registryStationId, never the raw stationId', () => {
    expect(UI).toMatch(/m\.set\(b\.registryStationId, b\.stationNameHe\)/);
    // The raw column must not be used as the join key.
    expect(UI).not.toMatch(/m\.set\(b\.stationId,/);
  });

  it('an unregistered terminal is labelled as such, never blanked', () => {
    expect(API).toMatch(/registered: false/);
    expect(UI).toMatch(/לא רשום/);
  });
});

describe('foreign currency is reported but never summed into shekels', () => {
  it('the API totals are computed from the ILS rows only', () => {
    expect(API).toMatch(/const ils = rows\.filter\(\(r\) => r\.currency === 'ILS'\)/);
    expect(API).toMatch(/const totalAgorot = ils\.reduce/);
  });

  it('nonIls is a separate field on the response', () => {
    expect(API).toMatch(/nonIls: nonIls\.map/);
  });

  it('the dashboard renders foreign rows in their OWN currency, not with a shekel sign', () => {
    // The foreign block prints `{r.gross} {r.currency}` — never through ils().
    expect(UI).toMatch(/\{r\.gross\.toLocaleString\('he-IL'\)\} \{r\.currency\}/);
  });

  it('the shekel formatter is only ever fed shekel figures', () => {
    // Every ils(...) call site takes a grossAgorot/100 or grossIls value.
    const calls = Array.from(UI.matchAll(/ils\(([^)]*)\)/g)).map((m) => m[1].trim());
    expect(calls.length).toBeGreaterThan(0);
    for (const c of calls) {
      expect(
        /grossAgorot \/ 100$|grossIls$/.test(c),
        `ils() called with "${c}" — it must only ever format a shekel amount`,
      ).toBe(true);
    }
  });
});

describe('the screen states observations, not fiscal treatment', () => {
  it('no longer claims there is no per-transaction invoice', () => {
    // 481 individual documents exist; the old copy said the opposite.
    expect(UI).not.toMatch(/אין חשבונית פר-עסקה/);
  });

  it('does not hard-code a document count that would go stale', () => {
    expect(UI).not.toMatch(/481 מסמכי/);
    expect(UI).toMatch(/analytics\.totals\.withTaxDocument\.toLocaleString/);
  });

  it('attributes the ruling to the bookkeeper rather than asserting a period', () => {
    expect(UI).toMatch(/הנהלת החשבונות/);
    // Must not state a VAT period conclusion anywhere on the screen.
    expect(UI).not.toMatch(/תקופת דיווח|תקופת המע"מ|תקופת המע״מ/);
  });
});
