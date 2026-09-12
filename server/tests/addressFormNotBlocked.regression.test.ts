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

/**
 * One box === one stored column — mapping pin (2026-09-11).
 *
 * The address UI had boxes that mapped to nothing, columns with no box, and the
 * same column rendered twice on one screen:
 *
 *   • 📍 district and 🌍 country were read-only chips. `user_addresses` has no
 *     column for either, and `country` was never set on the suggestion path, so
 *     that chip could never render and neither was ever saved.
 *   • city was a read-only chip — when the geocoder guessed the wrong city the
 *     customer could not correct it, and the manual path set city:'' with no box.
 *   • /subscriptions rendered its OWN city + postal boxes on top of the shared
 *     component's, so the customer saw two postal-code boxes with contradictory
 *     placeholders ("לדוג׳ 6291302" vs "12345") and only one was submitted.
 *   • the upsert overwrote `label` unconditionally while every sibling field used
 *     `?? match.X`, so each re-save reset a customer's Home/Work to "other".
 */
describe('address mapping: one box, one column', () => {
  const PICKER = 'client/src/components/ui/address-picker.tsx';
  const ROUTE = 'server/routes/user-addresses.ts';
  const SUBS = 'client/src/pages/Subscriptions.tsx';
  const read = (rel: string) => readFileSync(join(REPO_ROOT, rel), 'utf8');

  it('city is an editable box, not a read-only chip', () => {
    expect(src).toContain('input-address-city');
    expect(src).toMatch(/handleCityChange/);
  });

  it('drops the chips that had no column behind them', () => {
    // Neither district/state nor country exists on user_addresses.
    expect(src).not.toMatch(/🌍\s*\{selectedPlace\.country\}/);
    expect(src).not.toMatch(/📍\s*\{selectedPlace\.state\}/);
  });

  it('address parts are passed by NAME, not seven positional strings', () => {
    // The old signature was (base, bldg, apt, zip, flr, ent, nts) — transposing
    // two of them silently wrote a floor into a מיקוד.
    expect(src).toMatch(/interface AddressParts/);
    expect(src).not.toMatch(/base: PlaceDetails,\s*bldg: string/);
  });

  it('the upsert never resets a customer\'s own Home/Work label', () => {
    const route = read(ROUTE);
    expect(
      route,
      'label must be optional — a default of "other" makes "not supplied" ' +
        'indistinguishable from a real relabel.',
    ).not.toMatch(/label:\s*z\.enum\(\[[^\]]*\]\)\.default\(/);
    expect(
      route,
      'label must fall back to the stored value on a dedupe match, like every ' +
        'sibling field does.',
    ).toMatch(/label:\s*data\.label\s*\?\?\s*match\.label/);
  });

  it('the upsert enriches street / number / city on a match', () => {
    const route = read(ROUTE);
    for (const f of ['street', 'streetNumber', 'city']) {
      expect(route, `${f} was dropped on a match, so an address saved from ` +
        '"use my location" could never gain it.').toMatch(
        new RegExp(`${f}:\\s*data\\.${f}\\s*\\?\\?\\s*match\\.${f}`),
      );
    }
  });

  it('auto-save does not stamp "other" over the customer\'s label', () => {
    const picker = read(PICKER);
    expect(
      picker,
      'the picker auto-saves on every pick; sending label:"other" there undoes ' +
        'the customer\'s Home/Work every time.',
    ).not.toMatch(/label:\s*["']other["']/);
  });

  it('"use my location" keeps the parts the reverse geocode already resolved', () => {
    const picker = read(PICKER);
    expect(picker).toMatch(/street:\s*data\?\.street/);
    expect(picker).toMatch(/postalCode:\s*data\?\.postalCode/);
  });

  it('subscriptions does not render a second city / postal box', () => {
    const subs = read(SUBS);
    expect(
      subs,
      'two postal-code boxes on one screen, with different placeholders, only ' +
        'one of them submitted.',
    ).not.toContain('input-postal-code');
    expect(subs).not.toContain('data-testid="input-city"');
  });
});
