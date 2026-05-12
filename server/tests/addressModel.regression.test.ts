/**
 * PR-LOCATION-ADDRESS-MODEL-1 — Address model regression suite.
 *
 * Mirrors the discipline pattern from
 * server/tests/israelCitiesDataset.regression.test.ts:
 *
 *   A. file presence + module shape
 *   B. interface shape (compile-time + runtime sentinel)
 *   C. confidence tier order + parity
 *   D. citySymbol integration with the cities dataset
 *   E. file-system isolation (no schema migration, no Drizzle
 *      table, no UI route, no booking wiring, no payment / auth /
 *      wallet / Google Places / postcode runtime / matching code)
 *   F. no runtime functions exported from the model (types only)
 *
 * Reason for the FORBIDDEN_* scans:
 *   PROGRAM.md hard rule §1.5 — Location PRs MUST NOT touch
 *   auth, payment, wallet, K9000, Nayax, Tranzila, RBAC, audit
 *   logging, or schema migrations. This file fails LOUDLY if
 *   the address-model file ever gains an import from one of
 *   those systems.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

import {
  ADDRESS_CONFIDENCE_TIERS,
  ADDRESS_MODEL_SOURCE,
  ADDRESS_MODEL_VERSION,
  type AddressConfidence,
  type CustomerAddress,
  type ProviderAddress,
  type BookingAddress,
} from "../../shared/data/address-model";

import {
  ISRAEL_CITIES,
  findIsraelCityBySymbol,
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

describe("A. shared/data/address-model.ts — file presence", () => {
  it("file exists at the canonical path", () => {
    expect(existsSync(resolve(ROOT, "shared/data/address-model.ts"))).toBe(
      true,
    );
  });

  it("exports the source + version sentinels", () => {
    expect(ADDRESS_MODEL_SOURCE).toBe("petwash-address-model");
    expect(ADDRESS_MODEL_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("exports the confidence tiers as a readonly array", () => {
    expect(Array.isArray(ADDRESS_CONFIDENCE_TIERS)).toBe(true);
    expect(ADDRESS_CONFIDENCE_TIERS.length).toBe(4);
  });
});

// ─────────────────────────────────────────────────────────────
// B. Interface shape — compile-time + runtime sentinel literals
// ─────────────────────────────────────────────────────────────

describe("B. interface shape — sentinel literals satisfy the contracts", () => {
  it("CustomerAddress accepts a city-only literal", () => {
    const sample: CustomerAddress = {
      citySymbol: "5000",
      streetAddress: null,
      buildingNumber: null,
      apartment: null,
      postcode: null,
      lat: null,
      lng: null,
      addressConfidence: "city-only",
      formattedAddress: "Tel Aviv-Yafo",
    };
    expect(sample.citySymbol).toBe("5000");
    expect(sample.addressConfidence).toBe("city-only");
  });

  it("CustomerAddress accepts a verified-coords literal", () => {
    const sample: CustomerAddress = {
      citySymbol: "5000",
      streetAddress: "Rothschild Boulevard",
      buildingNumber: "1",
      apartment: "12",
      postcode: null,
      lat: 32.0667,
      lng: 34.7833,
      addressConfidence: "verified-coords",
      formattedAddress: "Rothschild Blvd 1, Apt 12, Tel Aviv-Yafo",
    };
    expect(sample.addressConfidence).toBe("verified-coords");
    expect(typeof sample.lat).toBe("number");
  });

  it("ProviderAddress accepts a city-list-only literal", () => {
    const sample: ProviderAddress = {
      baseCitySymbol: "5000",
      serviceCitySymbols: ["5000", "8600"],
      serviceRadiusKm: null,
      preferredAreas: [],
      blockedAreas: [],
      lat: null,
      lng: null,
    };
    expect(sample.serviceCitySymbols.length).toBe(2);
    expect(sample.serviceRadiusKm).toBeNull();
  });

  it("ProviderAddress accepts a radius literal with preferred / blocked areas", () => {
    const sample: ProviderAddress = {
      baseCitySymbol: "5000",
      serviceCitySymbols: ["5000"],
      serviceRadiusKm: 5,
      preferredAreas: ["north tel aviv", "florentin"],
      blockedAreas: ["industrial zone"],
      lat: 32.0667,
      lng: 34.7833,
    };
    expect(sample.serviceRadiusKm).toBe(5);
    expect(sample.preferredAreas).toContain("florentin");
    expect(sample.blockedAreas).toContain("industrial zone");
  });

  it("BookingAddress wraps a CustomerAddress and exposes a denormalized citySymbol", () => {
    const serviceAddress: CustomerAddress = {
      citySymbol: "5000",
      streetAddress: null,
      buildingNumber: null,
      apartment: null,
      postcode: null,
      lat: null,
      lng: null,
      addressConfidence: "city-only",
      formattedAddress: "Tel Aviv-Yafo",
    };
    const sample: BookingAddress = {
      serviceAddress,
      citySymbol: serviceAddress.citySymbol,
      matchingRadiusKm: null,
      selectedProviderId: null,
      matchScore: null,
    };
    expect(sample.serviceAddress.citySymbol).toBe(sample.citySymbol);
    expect(sample.selectedProviderId).toBeNull();
    expect(sample.matchScore).toBeNull();
  });

  it("BookingAddress accepts a confirmed-match literal with score", () => {
    const serviceAddress: CustomerAddress = {
      citySymbol: "5000",
      streetAddress: "Rothschild Boulevard",
      buildingNumber: "1",
      apartment: null,
      postcode: null,
      lat: 32.0667,
      lng: 34.7833,
      addressConfidence: "verified-coords",
      formattedAddress: "Rothschild Blvd 1, Tel Aviv-Yafo",
    };
    const sample: BookingAddress = {
      serviceAddress,
      citySymbol: "5000",
      matchingRadiusKm: 5,
      selectedProviderId: "prov_abc123",
      matchScore: 0.87,
    };
    expect(sample.selectedProviderId).toBe("prov_abc123");
    expect(sample.matchScore).toBeGreaterThan(0);
    expect(sample.matchScore).toBeLessThanOrEqual(1);
  });
});

// ─────────────────────────────────────────────────────────────
// C. Confidence tier order + parity
// ─────────────────────────────────────────────────────────────

describe("C. AddressConfidence — tier order matches PROGRAM.md §3.2", () => {
  it("contains exactly the 4 tiers in escalating order", () => {
    expect([...ADDRESS_CONFIDENCE_TIERS]).toEqual([
      "city-only",
      "street-known",
      "building-known",
      "verified-coords",
    ]);
  });

  it("every tier value is assignable to AddressConfidence", () => {
    for (const tier of ADDRESS_CONFIDENCE_TIERS) {
      const x: AddressConfidence = tier;
      expect(typeof x).toBe("string");
    }
  });

  it("no tier value is repeated", () => {
    const set = new Set(ADDRESS_CONFIDENCE_TIERS);
    expect(set.size).toBe(ADDRESS_CONFIDENCE_TIERS.length);
  });
});

// ─────────────────────────────────────────────────────────────
// D. citySymbol integration — sentinel literals resolve in the
//    cities dataset (proves model + data line up)
// ─────────────────────────────────────────────────────────────

describe("D. citySymbol integration with shared/data/israel-cities.ts", () => {
  it("the dataset has at least one row (cities PR must have merged)", () => {
    expect(ISRAEL_CITIES.length).toBeGreaterThan(0);
  });

  it("an arbitrary sentinel citySymbol resolves in the dataset", () => {
    const sample = ISRAEL_CITIES[0];
    expect(sample).toBeDefined();
    const found = findIsraelCityBySymbol(sample.citySymbol);
    expect(found?.citySymbol).toBe(sample.citySymbol);
  });

  it("a CustomerAddress citySymbol can be cross-checked against the dataset (consumer-pattern smoke)", () => {
    const sample: CustomerAddress = {
      citySymbol: ISRAEL_CITIES[0].citySymbol,
      streetAddress: null,
      buildingNumber: null,
      apartment: null,
      postcode: null,
      lat: null,
      lng: null,
      addressConfidence: "city-only",
      formattedAddress: ISRAEL_CITIES[0].hebrewName,
    };
    expect(findIsraelCityBySymbol(sample.citySymbol)).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────
// E. File-system isolation — protected systems untouched
// ─────────────────────────────────────────────────────────────

const MODEL_SRC = read("shared/data/address-model.ts");
const MODEL_CODE = codeOnly(MODEL_SRC);

const FORBIDDEN_IMPORTS: ReadonlyArray<RegExp> = [
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

  // UI / framework — types must not depend on React or Express
  /\bfrom\s+["']react["']/,
  /\bfrom\s+["']express["']/,
  /\bfrom\s+["']wouter["']/,

  // Google Places / live geocoding
  /\bgoogle\.maps\b/,
  /\bGooglePlaces\b/,
  /\bplaces\.api\b/i,
];

describe("E. address-model.ts — protected systems untouched", () => {
  for (const pattern of FORBIDDEN_IMPORTS) {
    it(`must not contain ${pattern}`, () => {
      expect(MODEL_CODE).not.toMatch(pattern);
    });
  }

  it("declares no Drizzle table", () => {
    expect(MODEL_CODE).not.toMatch(/pgTable\s*\(/);
  });

  it("declares no Express router", () => {
    expect(MODEL_CODE).not.toMatch(/Router\s*\(/);
  });
});

// ─────────────────────────────────────────────────────────────
// F. Types only — no runtime functions exported beyond const tags
// ─────────────────────────────────────────────────────────────

describe("F. address-model.ts — types only", () => {
  it("exports exactly the expected runtime values (no functions)", () => {
    // ADDRESS_CONFIDENCE_TIERS, ADDRESS_MODEL_SOURCE,
    // ADDRESS_MODEL_VERSION are the only runtime exports.
    // Everything else is a type, which has no runtime presence.
    const runtimeValues = {
      ADDRESS_CONFIDENCE_TIERS,
      ADDRESS_MODEL_SOURCE,
      ADDRESS_MODEL_VERSION,
    };
    for (const [key, value] of Object.entries(runtimeValues)) {
      expect(typeof value).not.toBe("function");
      expect(value).toBeDefined();
      // Sanity: keys present
      expect(key.length).toBeGreaterThan(0);
    }
  });

  it("source file contains no exported function declarations", () => {
    // Code-only scan: no `export function` or `export const x = (` ...
    expect(MODEL_CODE).not.toMatch(/export\s+function\b/);
    expect(MODEL_CODE).not.toMatch(
      /export\s+const\s+\w+\s*=\s*\(/,
    );
    expect(MODEL_CODE).not.toMatch(/export\s+async\s+function\b/);
  });

  it("source file contains no class declarations", () => {
    expect(MODEL_CODE).not.toMatch(/export\s+class\b/);
    expect(MODEL_CODE).not.toMatch(/^class\b/m);
  });
});

// ─────────────────────────────────────────────────────────────
// G. Postcode field exists but no runtime trusts it yet
// ─────────────────────────────────────────────────────────────

describe("G. postcode field exists but is NOT TRUSTED (PROGRAM.md §3.13)", () => {
  it("CustomerAddress.postcode literal accepts null", () => {
    const sample: CustomerAddress = {
      citySymbol: "5000",
      streetAddress: null,
      buildingNumber: null,
      apartment: null,
      postcode: null,
      lat: null,
      lng: null,
      addressConfidence: "city-only",
      formattedAddress: "Tel Aviv-Yafo",
    };
    expect(sample.postcode).toBeNull();
  });

  it("the source file documents the postcode-deferred posture", () => {
    expect(MODEL_SRC).toMatch(/NOT TRUSTED/);
    expect(MODEL_SRC).toMatch(/PROGRAM\.md\s+§3\.13/);
  });
});
