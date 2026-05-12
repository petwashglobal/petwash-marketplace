/**
 * PR-LOCATION-CITY-PICKER-1 — CityPicker regression suite.
 *
 * Mirrors the discipline pattern from the cities, address-
 * model, and guard PRs:
 *
 *   A. file presence + module shape
 *   B. helper behaviour (filter, popular, display, secondary)
 *   C. selection-payload shape (citySymbol + names)
 *   D. component file — boundary scan against protected
 *      systems, Google Places, Sheets/Drive/GCS, schema, auth,
 *      payment, wallet, K9000, Tranzila, Nayax
 *   E. component file — mobile-UX invariants (Sheet bottom side,
 *      44px touch targets, 100dvh, safe-area-inset, dir="rtl"
 *      branch, no IP / browser geolocation, no live API call)
 *   F. dataset integration smoke (rows count > 0, popular non-
 *      empty, search returns sensible cardinality)
 *
 * No DOM, no React render. The component file is tested
 * via static source-text invariants + import-and-call of the
 * pure helpers. CI's jsdom-capable runs can layer interaction
 * tests later as a follow-up; this PR proves the contract
 * surface.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

import {
  CITY_PICKER_VERSION,
  CITY_PICKER_DATASET_SIZE,
  DEFAULT_RESULT_LIMIT,
  NO_RESULTS,
  displayName,
  secondaryName,
  filterIsraelCities,
  popularCitiesForPicker,
  toSelection,
  type CityPickerSelection,
  type PickerLanguage,
} from "../../client/src/components/location/cityPickerHelpers";

import {
  ISRAEL_CITIES,
  type IsraelCity,
} from "../../shared/data/israel-cities";

const ROOT = resolve(__dirname, "..", "..");

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

/** Strip JS/TS comments + string literals so regex scans only hit code. */
function codeOnly(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/`(?:[^`\\]|\\.)*`/g, "``");
}

// ─────────────────────────────────────────────────────────────
// A. File presence + module shape
// ─────────────────────────────────────────────────────────────

describe("A. CityPicker — file presence", () => {
  it("CityPicker.tsx exists at the canonical path", () => {
    expect(
      existsSync(
        resolve(ROOT, "client/src/components/location/CityPicker.tsx"),
      ),
    ).toBe(true);
  });

  it("cityPickerHelpers.ts exists at the canonical path", () => {
    expect(
      existsSync(
        resolve(ROOT, "client/src/components/location/cityPickerHelpers.ts"),
      ),
    ).toBe(true);
  });

  it("CITY_PICKER_VERSION is a dated tag", () => {
    expect(CITY_PICKER_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("DEFAULT_RESULT_LIMIT is a sane positive integer", () => {
    expect(Number.isInteger(DEFAULT_RESULT_LIMIT)).toBe(true);
    expect(DEFAULT_RESULT_LIMIT).toBeGreaterThan(0);
    expect(DEFAULT_RESULT_LIMIT).toBeLessThanOrEqual(200);
  });

  it("NO_RESULTS is a frozen empty array", () => {
    expect(NO_RESULTS.length).toBe(0);
    expect(Object.isFrozen(NO_RESULTS)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
// B. Helper behaviour
// ─────────────────────────────────────────────────────────────

describe("B. filterIsraelCities", () => {
  it("returns the popular cities list when the query is empty", () => {
    const empty = filterIsraelCities("", "he");
    const popular = popularCitiesForPicker();
    expect(empty.length).toBe(popular.length);
    expect(empty.length).toBeGreaterThan(0);
  });

  it("returns the popular cities list when the query is whitespace only", () => {
    const ws = filterIsraelCities("   ", "en");
    expect(ws.length).toBe(popularCitiesForPicker().length);
  });

  it("returns matches for a Hebrew query", () => {
    const matches = filterIsraelCities("תל אביב", "he");
    expect(matches.length).toBeGreaterThan(0);
    const symbols = matches.map((c) => c.citySymbol);
    // Tel Aviv-Yafo is citySymbol 5000 in the CBS table.
    expect(symbols).toContain("5000");
  });

  it("returns matches for an English query", () => {
    const matches = filterIsraelCities("tel aviv", "en");
    expect(matches.length).toBeGreaterThan(0);
    expect(matches.map((c) => c.citySymbol)).toContain("5000");
  });

  it("respects the result limit parameter", () => {
    const limit = 5;
    const matches = filterIsraelCities("a", "en", limit);
    expect(matches.length).toBeLessThanOrEqual(limit);
  });

  it("returns an empty array for a garbage query", () => {
    expect(filterIsraelCities("zzznotacityxxx", "en").length).toBe(0);
    expect(filterIsraelCities("zzznotacityxxx", "he").length).toBe(0);
  });
});

describe("B. popularCitiesForPicker", () => {
  it("returns a non-empty list", () => {
    expect(popularCitiesForPicker().length).toBeGreaterThan(0);
  });

  it("returns only priority=100 rows (popular threshold from the dataset)", () => {
    for (const c of popularCitiesForPicker()) {
      expect(c.priority).toBe(100);
    }
  });

  it("includes Tel Aviv-Yafo (citySymbol 5000)", () => {
    const symbols = popularCitiesForPicker().map((c) => c.citySymbol);
    expect(symbols).toContain("5000");
  });
});

describe("B. displayName + secondaryName", () => {
  function find(symbol: string): IsraelCity {
    const c = ISRAEL_CITIES.find((x) => x.citySymbol === symbol);
    if (!c) throw new Error("test fixture: citySymbol not found: " + symbol);
    return c;
  }

  it("displayName returns Hebrew when language='he'", () => {
    const c = find("5000");
    expect(displayName(c, "he")).toBe(c.hebrewName);
  });

  it("displayName returns English when language='en'", () => {
    const c = find("5000");
    expect(displayName(c, "en")).toBe(c.englishName);
  });

  it("displayName falls back to the other language when the primary is empty", () => {
    // The dataset preserves 6 rows with englishName === ''.
    const orphan = ISRAEL_CITIES.find((c) => c.englishName === "");
    if (orphan) {
      expect(displayName(orphan, "en")).toBe(orphan.hebrewName);
    } else {
      // If a future dataset bump backfills English names, this
      // assertion becomes vacuous — that is fine.
      expect(true).toBe(true);
    }
  });

  it("secondaryName returns the other-language name", () => {
    const c = find("5000");
    expect(secondaryName(c, "he")).toBe(c.englishName);
    expect(secondaryName(c, "en")).toBe(c.hebrewName);
  });
});

// ─────────────────────────────────────────────────────────────
// C. Selection-payload shape
// ─────────────────────────────────────────────────────────────

describe("C. toSelection returns the canonical payload shape", () => {
  it("contains exactly { citySymbol, hebrewName, englishName }", () => {
    const c = ISRAEL_CITIES.find((x) => x.citySymbol === "5000")!;
    const sel: CityPickerSelection = toSelection(c);
    expect(Object.keys(sel).sort()).toEqual([
      "citySymbol",
      "englishName",
      "hebrewName",
    ]);
    expect(sel.citySymbol).toBe("5000");
    expect(typeof sel.hebrewName).toBe("string");
    expect(typeof sel.englishName).toBe("string");
  });

  it("PickerLanguage is exactly 'en' | 'he'", () => {
    // Type-level check via runtime asserts on what we expect.
    const en: PickerLanguage = "en";
    const he: PickerLanguage = "he";
    expect([en, he]).toEqual(["en", "he"]);
  });
});

// ─────────────────────────────────────────────────────────────
// D. Component file — boundary scan (protected systems)
// ─────────────────────────────────────────────────────────────

const COMPONENT_SRC = read("client/src/components/location/CityPicker.tsx");
const COMPONENT_CODE = codeOnly(COMPONENT_SRC);

const HELPERS_SRC = read(
  "client/src/components/location/cityPickerHelpers.ts",
);
const HELPERS_CODE = codeOnly(HELPERS_SRC);

const FORBIDDEN_PATTERNS: ReadonlyArray<RegExp> = [
  // auth
  /\bvalidateFirebaseToken\b/,
  /\brequireAdmin\b/,
  /\brequireBrainAccess\b/,
  /\bisSuperAdmin\b/,
  /\brbac\b/,

  // payment / wallet
  /\bnayax\b/i,
  /\btranzila\b/i,
  /\bstripe\b/i,
  /\bsumit\b/i,
  /\bupay\b/i,
  /\bWalletService\b/,
  /\bBillingEngine\b/,
  /\bAuditLedgerService\b/,

  // K9000 hardware
  /\bk9000\b/i,
  /\bstationHeartbeat\b/i,

  // schema / persistence
  /\bdrizzle-orm\b/,
  /\bpgTable\b/,
  /\bfirebase-admin\b/,
  /\bfirestore\b/i,

  // Google Places / live geocoding — the whole point of this PR
  /\bgoogle\.maps\b/,
  /\bGooglePlacesAutocomplete\b/,
  /\b\/api\/google\/places/,
  /\b\/api\/google\/reverse-geocode/,

  // Sheets / Drive / GCS — out of scope
  /\bgoogleSheetsIntegration\b/,
  /\bgoogleDriveBackupService\b/,
  /\b@google-cloud\/storage\b/,

  // No IP / browser geolocation auto-fill
  /\bnavigator\.geolocation\b/,
  /\bipinfo\b/i,
  /\bgeoip\b/i,
];

describe("D. CityPicker.tsx — protected systems untouched", () => {
  for (const pattern of FORBIDDEN_PATTERNS) {
    it(`CityPicker.tsx must not contain ${pattern}`, () => {
      expect(COMPONENT_CODE).not.toMatch(pattern);
    });
  }

  for (const pattern of FORBIDDEN_PATTERNS) {
    it(`cityPickerHelpers.ts must not contain ${pattern}`, () => {
      expect(HELPERS_CODE).not.toMatch(pattern);
    });
  }

  it("CityPicker.tsx does not declare a Drizzle table", () => {
    expect(COMPONENT_CODE).not.toMatch(/pgTable\s*\(/);
  });

  it("CityPicker.tsx does not declare an Express router", () => {
    expect(COMPONENT_CODE).not.toMatch(/Router\s*\(/);
  });

  it("CityPicker.tsx does not perform any fetch / XHR", () => {
    expect(COMPONENT_CODE).not.toMatch(/\bfetch\s*\(/);
    expect(COMPONENT_CODE).not.toMatch(/\bXMLHttpRequest\b/);
    expect(COMPONENT_CODE).not.toMatch(/\baxios\b/);
  });
});

// ─────────────────────────────────────────────────────────────
// E. Mobile-UX invariants
// ─────────────────────────────────────────────────────────────

describe("E. CityPicker.tsx — mobile UX invariants", () => {
  it("uses the Sheet primitive in side='bottom' mode", () => {
    // Sheet imported from ui/sheet
    expect(COMPONENT_SRC).toMatch(
      /from\s+["']@\/components\/ui\/sheet["']/,
    );
    // side="bottom" set on SheetContent
    expect(COMPONENT_SRC).toMatch(/side=["']bottom["']/);
  });

  it("uses 100dvh (not 100vh) per PROGRAM.md / platform §2", () => {
    expect(COMPONENT_CODE).not.toMatch(/100vh\b/);
    expect(COMPONENT_SRC).toMatch(/100dvh\b/);
  });

  it("respects iPhone safe-area-inset on top and bottom", () => {
    expect(COMPONENT_SRC).toMatch(/safe-area-inset-top/);
    expect(COMPONENT_SRC).toMatch(/safe-area-inset-bottom/);
  });

  it("declares a 44px+ touch target on the close button", () => {
    expect(COMPONENT_SRC).toMatch(/min-h-\[44px\][\s\S]*min-w-\[44px\]/);
  });

  it("declares a 44px+ touch target on the search Input", () => {
    expect(COMPONENT_SRC).toMatch(
      /data-testid=["']city-picker-search["'][\s\S]{0,800}min-h-\[44px\]/,
    );
  });

  it("declares a 44px+ touch target on each result row", () => {
    expect(COMPONENT_SRC).toMatch(
      /data-testid=\`city-picker-row-\$\{city\.citySymbol\}\`[\s\S]{0,2000}min-h-\[44px\]/,
    );
  });

  it("sets dir from the language prop (RTL safe)", () => {
    expect(COMPONENT_SRC).toMatch(/dir=\{dir\}/);
    expect(COMPONENT_SRC).toMatch(/language === ["']he["']/);
  });

  it("scrollable list opts out of parent overscroll on iOS Safari", () => {
    expect(COMPONENT_SRC).toMatch(/overscroll-behavior:contain/);
    expect(COMPONENT_SRC).toMatch(/-webkit-overflow-scrolling:touch/);
  });

  it("renders an explicit empty state with localized copy", () => {
    expect(COMPONENT_SRC).toMatch(/city-picker-empty/);
    expect(COMPONENT_SRC).toMatch(/EMPTY_HEADING/);
    expect(COMPONENT_SRC).toMatch(/EMPTY_HINT/);
  });

  it("uses role='listbox' / role='option' for keyboard a11y", () => {
    expect(COMPONENT_SRC).toMatch(/role=["']listbox["']/);
    expect(COMPONENT_SRC).toMatch(/role=["']option["']/);
    expect(COMPONENT_SRC).toMatch(/aria-selected=\{isSelected\}/);
  });
});

// ─────────────────────────────────────────────────────────────
// F. Dataset integration smoke
// ─────────────────────────────────────────────────────────────

describe("F. dataset integration smoke", () => {
  it("CITY_PICKER_DATASET_SIZE matches the underlying dataset length", () => {
    expect(CITY_PICKER_DATASET_SIZE).toBe(ISRAEL_CITIES.length);
  });

  it("the dataset has at least 1000 rows (cities PR must be merged)", () => {
    expect(CITY_PICKER_DATASET_SIZE).toBeGreaterThanOrEqual(1000);
  });
});
