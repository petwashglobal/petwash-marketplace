/**
 * PR-LOCATION-CITY-PICKER-1 — pure helpers for the Israel
 * city picker.
 *
 * The picker UI is a thin shell on top of these helpers. The
 * helpers are pure functions over shared/data/israel-cities.ts
 * so they can be unit-tested without a DOM. The component file
 * (CityPicker.tsx) holds only React + Tailwind. No DB, no API,
 * no schema, no Google Places.
 *
 * Hard rules (docs/location/PROGRAM.md §3.4):
 *   - No live geocoding. The dataset is the only source.
 *   - No IP / browser geolocation auto-fill.
 *   - No free-text city. Caller receives citySymbol + names.
 *   - Hebrew + English search.
 *   - Popular cities first (priority 100 rows).
 */

import {
  ISRAEL_CITIES,
  getPopularIsraelCities,
  searchIsraelCities,
  type IsraelCity,
} from "@shared/data/israel-cities";

/**
 * Picker language — only the two locales the picker UI is
 * built for in this PR. Other locales will be added in a
 * follow-up.
 */
export type PickerLanguage = "en" | "he";

/**
 * Selection payload the picker returns to its parent. Matches
 * the shape PROGRAM.md §3.4 specifies. The citySymbol is the
 * canonical key; the names are the display strings the parent
 * can render in a chip / receipt / confirmation without doing
 * another dataset lookup.
 */
export interface CityPickerSelection {
  citySymbol: string;
  hebrewName: string;
  englishName: string;
}

/**
 * Sentinel returned when there are no matches for a query.
 * Components iterate the array; the empty-state UI is shown
 * when length === 0.
 */
export const NO_RESULTS: readonly IsraelCity[] = Object.freeze([]);

/**
 * Project an IsraelCity row to the picker payload shape.
 */
export function toSelection(city: IsraelCity): CityPickerSelection {
  return {
    citySymbol: city.citySymbol,
    hebrewName: city.hebrewName,
    englishName: city.englishName,
  };
}

/**
 * Soft cap on the search-result list rendered in the sheet.
 * Israel has 1272 rows; rendering them all on every keystroke
 * is wasteful and hurts mobile scroll. The picker shows the
 * first N matches and prompts the user to refine.
 */
export const DEFAULT_RESULT_LIMIT = 80;

/**
 * Filter the dataset for a given query string and language.
 *
 *   - Empty / whitespace-only query returns the popular cities
 *     list (priority 100 rows). This is the "default state" of
 *     the picker before the user types.
 *   - Any non-empty query delegates to searchIsraelCities, then
 *     truncates to {limit}. Hebrew or English is auto-handled
 *     by the dataset's normalizers.
 *
 * Returns a readonly slice so callers cannot mutate the cached
 * dataset by reference.
 */
export function filterIsraelCities(
  query: string,
  language: PickerLanguage,
  limit: number = DEFAULT_RESULT_LIMIT,
): readonly IsraelCity[] {
  const q = (query || "").trim();
  if (q.length === 0) {
    return getPopularIsraelCities();
  }
  const matches = searchIsraelCities(q, language);
  if (matches.length <= limit) return matches;
  return matches.slice(0, limit);
}

/**
 * Return the popular-cities row list used to seed the sheet
 * before the user types. Thin wrapper so the component does
 * not import the dataset module directly.
 */
export function popularCitiesForPicker(): readonly IsraelCity[] {
  return getPopularIsraelCities();
}

/**
 * Choose the display string for a city in the given language.
 * Falls back to the other language when the primary is empty
 * (the dataset has 6 rows with no English name; preserved
 * as-imported per PR-LOCATION-CITIES-1).
 */
export function displayName(
  city: IsraelCity,
  language: PickerLanguage,
): string {
  if (language === "he") {
    return city.hebrewName || city.englishName;
  }
  return city.englishName || city.hebrewName;
}

/**
 * Choose the secondary (smaller) line. The picker shows the
 * primary name in the user's locale and the other-language
 * name underneath as a hint, so a Hebrew user typing English
 * spelling still recognises the row.
 */
export function secondaryName(
  city: IsraelCity,
  language: PickerLanguage,
): string {
  if (language === "he") {
    return city.englishName;
  }
  return city.hebrewName;
}

/**
 * Provenance — picker version separate from the dataset
 * version. Future popularity-cap tweaks bump this; the
 * dataset version moves only when the underlying rows change.
 */
export const CITY_PICKER_VERSION = "2026-05-12" as const;

/** Source dataset rows count. Sanity-checked in regression tests. */
export const CITY_PICKER_DATASET_SIZE = ISRAEL_CITIES.length;
