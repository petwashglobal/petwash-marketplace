/**
 * The address form must never demand a field it is not showing — regression pin
 * (2026-09-11).
 *
 * THE BUG: the building-number / apartment / floor / entrance / מיקוד /
 * access-notes boxes in GooglePlacesAutocomplete render only when
 * `selectedPlace` is truthy, and `selectedPlace` is set ONLY by picking a row
 * out of the suggestions dropdown. The one escape hatch that synthesises a
 * place for a hand-typed address lived inside the `predictions.length === 0`
 * empty state.
 *
 * So the moment the provider returned ANY row the escape hatch disappeared —
 * and it always returned rows. On our own station address it returned six, five
 * of them the byte-identical string "ויצמן, כפר סבא, מחוז המרכז" (see
 * addressPostcodeBuildingLevel.regression.test.ts). The customer could neither
 * pick a usable row nor open the detail boxes, then delivery flows rejected the
 * submit on `postalCode: z.string().min(1)` — a field they were never shown a
 * box for. A required field with no visible input is an invisible wall.
 *
 * The pin: the escape hatch must be reachable while suggestions are on screen.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = join(__dirname, '..', '..');
const COMPONENT = 'client/src/components/ui/google-places-autocomplete.tsx';
const src = readFileSync(join(REPO_ROOT, COMPONENT), 'utf8');

describe('address form never demands a box it is not rendering', () => {
  it('still gates the detail boxes on a chosen place (documents the coupling)', () => {
    // Not a bug by itself — but it is WHY the escape hatch below must exist.
    // If this ever stops being true, re-read the pin: the blocker may be gone
    // and the escape hatch may no longer be load-bearing.
    expect(src).toMatch(/showExtraFields\s*&&\s*selectedPlace/);
  });

  it('offers "continue with what you typed" WHILE suggestions are showing', () => {
    expect(
      src,
      'the manual escape hatch is missing its test id — customers who cannot ' +
        'use any suggested row have no way to open the detail boxes.',
    ).toContain('places-use-typed-address');

    // It must not be buried in the empty state again. The affordance has to sit
    // under a `predictions.length > 0` branch.
    expect(
      src,
      'the escape hatch must render when predictions EXIST — that is the exact ' +
        'case that blocked the customer (six unusable rows, no way out).',
    ).toMatch(/predictions\.length\s*>\s*0\s*&&[\s\S]{0,600}places-use-typed-address/);
  });

  it('shares one handler, so both dropdown states unblock identically', () => {
    expect(src).toMatch(/const\s+useTypedAddress\s*=\s*useCallback/);
    // Both call sites go through it rather than re-synthesising a place inline.
    const calls = src.match(/useTypedAddress\(\)/g) || [];
    expect(calls.length).toBeGreaterThanOrEqual(2);
  });

  it('does not promise Google suggestions — Google is out of the address path', () => {
    // #1575/#1578 removed Google entirely; suggestions come from OpenStreetMap
    // and our baked-in Israeli street registry. Telling the customer the
    // suggestions are Google's is simply false.
    expect(
      src.replace(/\/\*[\s\S]*?\*\//g, ''), // ignore explanatory comments
      'address hint still claims Google supplies the suggestions.',
    ).not.toMatch(/מ-?Google|מגוגל/);
  });
});
