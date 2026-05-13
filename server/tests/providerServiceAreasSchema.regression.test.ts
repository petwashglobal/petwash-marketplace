/**
 * PR-LOCATION-PROVIDER-SERVICE-AREAS-1 (Phase 1) — schema
 * regression suite.
 *
 * Pins the additive citySymbol foundation across the four
 * provider-side tables and the migration SQL file. A future
 * PR that silently:
 *   - removes one of the new columns,
 *   - changes a new column from nullable → NOT NULL without
 *     a backfill PR landing first,
 *   - drops one of the new indexes,
 *   - reaches into a legacy column (city / service_area) and
 *     deletes it before Phase 5,
 *   - imports a second city picker,
 *   - bypasses the citySymbol contract on a new column,
 * must fail LOUDLY here.
 *
 *   A. Drizzle schema has the 4 new columns in the right
 *      tables.
 *   B. Drizzle schema has the 4 new indexes by name.
 *   C. Drizzle schema preserves the 5 legacy fields
 *      untouched (no accidental Phase-5 leak).
 *   D. The migration SQL file exists and contains:
 *        - 4 ADD COLUMN IF NOT EXISTS statements
 *        - 4 CREATE INDEX IF NOT EXISTS statements
 *        - 1 GIN index method
 *        - rollback comments at the bottom
 *   E. The migration is idempotent (IF NOT EXISTS on every
 *      stmt) and does NOT touch unrelated systems.
 *   F. No second city picker is imported anywhere in this
 *      PR's diff (constitutional anchor).
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, statSync, readdirSync } from "fs";
import { resolve } from "path";

import {
  contractorServiceAreas,
  walkerProfiles,
  sitterProfiles,
  trainers,
} from "../../shared/schema";

const ROOT = resolve(__dirname, "..", "..");

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

const SCHEMA_SRC = read("shared/schema.ts");
const MIGRATION_PATH = resolve(
  ROOT,
  "migrations/0022_provider_service_areas_city_symbol.sql",
);
const MIGRATION_SRC = readFileSync(MIGRATION_PATH, "utf8");

// ─────────────────────────────────────────────────────────────
// A. Drizzle schema — the 4 new columns are present
// ─────────────────────────────────────────────────────────────

describe("A. Drizzle schema — new city_symbol / service_city_symbols columns", () => {
  it("contractor_service_areas has a citySymbol column", () => {
    const col = (contractorServiceAreas as any).citySymbol;
    expect(col).toBeDefined();
    expect(col.name).toBe("city_symbol");
  });

  it("walker_profiles has a citySymbol column", () => {
    const col = (walkerProfiles as any).citySymbol;
    expect(col).toBeDefined();
    expect(col.name).toBe("city_symbol");
  });

  it("sitter_profiles has a citySymbol column", () => {
    const col = (sitterProfiles as any).citySymbol;
    expect(col).toBeDefined();
    expect(col.name).toBe("city_symbol");
  });

  it("trainers has a serviceCitySymbols TEXT[] column", () => {
    const col = (trainers as any).serviceCitySymbols;
    expect(col).toBeDefined();
    expect(col.name).toBe("service_city_symbols");
  });

  it("contractor_service_areas.city_symbol declaration is varchar(20)", () => {
    // The Drizzle schema source — text search keeps the test
    // resilient to internal Drizzle column-shape changes.
    expect(SCHEMA_SRC).toMatch(
      /citySymbol:\s*varchar\("city_symbol",\s*\{\s*length:\s*20\s*\}\)/,
    );
  });

  it("walker_profiles.city_symbol declaration is varchar(20)", () => {
    // Three tables declare the same varchar(20) column shape.
    const matches = SCHEMA_SRC.match(
      /citySymbol:\s*varchar\("city_symbol",\s*\{\s*length:\s*20\s*\}\)/g,
    );
    expect(matches?.length ?? 0).toBeGreaterThanOrEqual(3);
  });

  it("trainers.service_city_symbols declaration is TEXT[] not null default '{}'", () => {
    expect(SCHEMA_SRC).toMatch(
      /serviceCitySymbols:\s*text\("service_city_symbols"\)\s*\.array\(\)\s*\.notNull\(\)\s*\.default\(sql`ARRAY\[\]::text\[\]`\)/,
    );
  });
});

// ─────────────────────────────────────────────────────────────
// B. Drizzle schema — the 4 new indexes by name
// ─────────────────────────────────────────────────────────────

describe("B. Drizzle schema — new indexes by name", () => {
  it("idx_contractor_areas_city_symbol declared", () => {
    expect(SCHEMA_SRC).toMatch(/idx_contractor_areas_city_symbol/);
  });

  it("idx_walker_profiles_city_symbol declared", () => {
    expect(SCHEMA_SRC).toMatch(/idx_walker_profiles_city_symbol/);
  });

  it("idx_sitter_profiles_city_symbol declared", () => {
    expect(SCHEMA_SRC).toMatch(/idx_sitter_profiles_city_symbol/);
  });

  it("idx_trainers_service_city_symbols declared", () => {
    expect(SCHEMA_SRC).toMatch(/idx_trainers_service_city_symbols/);
  });
});

// ─────────────────────────────────────────────────────────────
// C. Drizzle schema — legacy columns + indexes preserved
//    (catches accidental Phase-5 leak in this PR)
// ─────────────────────────────────────────────────────────────

describe("C. Drizzle schema — legacy columns intact", () => {
  it("contractor_service_areas.city (legacy free-text) still present", () => {
    const col = (contractorServiceAreas as any).city;
    expect(col).toBeDefined();
    expect(col.name).toBe("city");
  });

  it("walker_profiles.city (legacy NOT NULL) still present", () => {
    const col = (walkerProfiles as any).city;
    expect(col).toBeDefined();
    expect(col.name).toBe("city");
  });

  it("sitter_profiles.city (legacy NOT NULL) still present", () => {
    const col = (sitterProfiles as any).city;
    expect(col).toBeDefined();
    expect(col.name).toBe("city");
  });

  it("trainers.service_area (legacy free-text) still present", () => {
    const col = (trainers as any).serviceArea;
    expect(col).toBeDefined();
    expect(col.name).toBe("service_area");
  });

  it("legacy idx_contractor_areas_city index name preserved in schema", () => {
    expect(SCHEMA_SRC).toMatch(/idx_contractor_areas_city["')]/);
  });
});

// ─────────────────────────────────────────────────────────────
// D. Migration SQL — file presence + required statements
// ─────────────────────────────────────────────────────────────

describe("D. migration SQL file", () => {
  it("file exists at the canonical path", () => {
    expect(existsSync(MIGRATION_PATH)).toBe(true);
  });

  it("is substantive (not a stub)", () => {
    expect(statSync(MIGRATION_PATH).size).toBeGreaterThan(1500);
  });

  it("cites PRIVACY.md §3 + §4 + PROGRAM.md §3.7", () => {
    expect(MIGRATION_SRC).toMatch(/PRIVACY\.md\s+§3/);
    expect(MIGRATION_SRC).toMatch(/PRIVACY\.md\s+§4/);
    expect(MIGRATION_SRC).toMatch(/PROGRAM\.md\s+§3\.7/);
  });

  it("contains 4 ADD COLUMN IF NOT EXISTS statements", () => {
    const matches = MIGRATION_SRC.match(/ADD COLUMN IF NOT EXISTS/g);
    expect(matches?.length ?? 0).toBe(4);
  });

  it("contains 4 CREATE INDEX IF NOT EXISTS statements", () => {
    const matches = MIGRATION_SRC.match(/CREATE INDEX IF NOT EXISTS/g);
    expect(matches?.length ?? 0).toBe(4);
  });

  it("uses GIN index method on the trainers array column", () => {
    expect(MIGRATION_SRC).toMatch(
      /idx_trainers_service_city_symbols[\s\S]+?ON trainers USING GIN \(service_city_symbols\)/,
    );
  });

  it("declares the TEXT[] column as NOT NULL DEFAULT ARRAY[]::text[]", () => {
    expect(MIGRATION_SRC).toMatch(
      /service_city_symbols text\[\] NOT NULL DEFAULT ARRAY\[\]::text\[\]/,
    );
  });

  it("each new column declared as varchar(20) on the three scalar tables", () => {
    const matches = MIGRATION_SRC.match(/city_symbol varchar\(20\)/g);
    expect(matches?.length ?? 0).toBeGreaterThanOrEqual(3);
  });

  it("rollback block exists at the bottom (DROP INDEX + DROP COLUMN, commented)", () => {
    expect(MIGRATION_SRC).toMatch(/--\s*DROP INDEX IF EXISTS idx_trainers_service_city_symbols/);
    expect(MIGRATION_SRC).toMatch(/--\s*ALTER TABLE trainers/);
    expect(MIGRATION_SRC).toMatch(/--\s*DROP COLUMN IF EXISTS service_city_symbols/);
  });
});

// ─────────────────────────────────────────────────────────────
// E. Migration SQL — idempotency + no out-of-scope touch
// ─────────────────────────────────────────────────────────────

const FORBIDDEN_IN_MIGRATION: ReadonlyArray<RegExp> = [
  // auth
  /\busers\b.*ALTER/i,
  /firebase_/i,
  // payment / wallet
  /\bwallet_/i,
  /\bbilling_/i,
  /\btranzila_/i,
  /\bnayax_/i,
  /\bstripe_/i,
  // K9000 hardware
  /\bk9000\b/i,
  /\bpet_wash_stations\b/i,
  // legacy DROP COLUMN active (rollback comments only)
  /^DROP COLUMN/m,
  /^ALTER TABLE.*DROP COLUMN(?!\s*IF EXISTS\s+(?:city_symbol|service_city_symbols))/m,
  // any non-additive ALTER
  /ALTER COLUMN/i,
  /RENAME COLUMN/i,
  /RENAME TO/i,
];

describe("E. migration SQL — boundary scan", () => {
  for (const pattern of FORBIDDEN_IN_MIGRATION) {
    it(`migration must not contain ${pattern}`, () => {
      expect(MIGRATION_SRC).not.toMatch(pattern);
    });
  }

  it("migration body touches ONLY the 4 target tables", () => {
    // Find every ALTER TABLE | CREATE INDEX target. Filter out
    // commented-out lines (rollback block).
    const live = MIGRATION_SRC
      .split("\n")
      .filter((l) => !l.trim().startsWith("--"))
      .join("\n");
    const altered = Array.from(
      live.matchAll(/ALTER TABLE\s+(\w+)/g),
    ).map((m) => m[1]);
    const indexed = Array.from(
      live.matchAll(/ON\s+(\w+)(?:\s+USING\s+\w+)?\s*\(/g),
    ).map((m) => m[1]);
    const all = [...altered, ...indexed];
    const allowed = new Set([
      "contractor_service_areas",
      "walker_profiles",
      "sitter_profiles",
      "trainers",
    ]);
    for (const t of all) {
      expect(allowed.has(t)).toBe(true);
    }
  });
});

// ─────────────────────────────────────────────────────────────
// F. Constitutional anchor — no second city picker imported
// ─────────────────────────────────────────────────────────────

describe("F. PR diff — no second city picker introduced", () => {
  it("no new picker component file under client/src/components/location/", () => {
    const dir = resolve(
      ROOT,
      "client/src/components/location",
    );
    expect(existsSync(dir)).toBe(true);
    const files = readdirSync(dir);
    // PR #243 shipped CityPicker.tsx + cityPickerHelpers.ts.
    // No new picker file should appear in this Phase-1 PR.
    const pickerFiles = files.filter(
      (f) => /picker/i.test(f) && f !== "CityPicker.tsx" && f !== "cityPickerHelpers.ts",
    );
    expect(pickerFiles).toEqual([]);
  });

  it("schema.ts does not import any UI component (schema is data-layer only)", () => {
    expect(SCHEMA_SRC).not.toMatch(/from\s+["']@\/components\//);
    expect(SCHEMA_SRC).not.toMatch(/from\s+["']react["']/);
  });

  it("migration SQL does not reference Google Places", () => {
    expect(MIGRATION_SRC).not.toMatch(/google.*places/i);
    expect(MIGRATION_SRC).not.toMatch(/places.*api/i);
  });
});
