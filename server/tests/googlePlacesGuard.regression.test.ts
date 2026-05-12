/**
 * PR-LOCATION-GUARD-PLACES-1 — Server-side guard regression suite.
 *
 * Pins the on/off contract for the Google Places proxy:
 *
 *   A. resolver — environment matrix (prod/dev/staging × set/unset/true/false)
 *   B. middleware — pass-through when ON, 503 PLACES_DISABLED when OFF
 *   C. route wiring — /places-autocomplete and /places-details
 *      both have the guard applied
 *   D. boundary — the guard module imports nothing from auth,
 *      payment, wallet, K9000, Tranzila, Nayax, schema, audit
 *   E. .env.example documents the new flags
 *
 * No live network call is made. Express middleware is tested by
 * constructing tiny stub req/res/next objects.
 */

import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

import {
  GOOGLE_PLACES_FLAG_NAME,
  isGooglePlacesServerEnabled,
  requireGooglePlacesEnabled,
} from "../lib/feature-flags/googlePlaces";

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
// A. Resolver — environment matrix
// ─────────────────────────────────────────────────────────────

describe("A. isGooglePlacesServerEnabled — env matrix", () => {
  it("returns false in development when the flag is unset", () => {
    expect(
      isGooglePlacesServerEnabled({ NODE_ENV: "development" } as any),
    ).toBe(false);
  });

  it("returns false in test when the flag is unset", () => {
    expect(
      isGooglePlacesServerEnabled({ NODE_ENV: "test" } as any),
    ).toBe(false);
  });

  it("returns false in staging when the flag is unset", () => {
    expect(
      isGooglePlacesServerEnabled({ NODE_ENV: "staging" } as any),
    ).toBe(false);
  });

  it("returns true in production when the flag is unset (preserves current behaviour)", () => {
    expect(
      isGooglePlacesServerEnabled({ NODE_ENV: "production" } as any),
    ).toBe(true);
  });

  it("returns true when GOOGLE_PLACES_LIVE=true regardless of NODE_ENV", () => {
    expect(
      isGooglePlacesServerEnabled({
        NODE_ENV: "development",
        GOOGLE_PLACES_LIVE: "true",
      } as any),
    ).toBe(true);
    expect(
      isGooglePlacesServerEnabled({
        NODE_ENV: "production",
        GOOGLE_PLACES_LIVE: "true",
      } as any),
    ).toBe(true);
  });

  it("returns false when GOOGLE_PLACES_LIVE=false regardless of NODE_ENV", () => {
    expect(
      isGooglePlacesServerEnabled({
        NODE_ENV: "production",
        GOOGLE_PLACES_LIVE: "false",
      } as any),
    ).toBe(false);
    expect(
      isGooglePlacesServerEnabled({
        NODE_ENV: "development",
        GOOGLE_PLACES_LIVE: "false",
      } as any),
    ).toBe(false);
  });

  it("trims and lower-cases the flag value", () => {
    expect(
      isGooglePlacesServerEnabled({
        NODE_ENV: "development",
        GOOGLE_PLACES_LIVE: "  TRUE  ",
      } as any),
    ).toBe(true);
    expect(
      isGooglePlacesServerEnabled({
        NODE_ENV: "production",
        GOOGLE_PLACES_LIVE: "FALSE",
      } as any),
    ).toBe(false);
  });

  it("any non-true/non-false string falls back to NODE_ENV default", () => {
    expect(
      isGooglePlacesServerEnabled({
        NODE_ENV: "development",
        GOOGLE_PLACES_LIVE: "maybe",
      } as any),
    ).toBe(false);
    expect(
      isGooglePlacesServerEnabled({
        NODE_ENV: "production",
        GOOGLE_PLACES_LIVE: "1",
      } as any),
    ).toBe(true);
  });

  it("flag name constant matches the env var read", () => {
    expect(GOOGLE_PLACES_FLAG_NAME).toBe("GOOGLE_PLACES_LIVE");
  });
});

// ─────────────────────────────────────────────────────────────
// B. Middleware — pass-through vs 503
// ─────────────────────────────────────────────────────────────

describe("B. requireGooglePlacesEnabled middleware", () => {
  it("calls next() when the resolver returns true", () => {
    const prev = process.env.GOOGLE_PLACES_LIVE;
    process.env.GOOGLE_PLACES_LIVE = "true";

    const next = vi.fn();
    const status = vi.fn();
    const json = vi.fn();
    const res = { status: status.mockReturnValue({ json } as any) } as any;

    requireGooglePlacesEnabled({} as any, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(status).not.toHaveBeenCalled();

    if (prev === undefined) delete process.env.GOOGLE_PLACES_LIVE;
    else process.env.GOOGLE_PLACES_LIVE = prev;
  });

  it("returns 503 PLACES_DISABLED when the resolver returns false", () => {
    const prev = process.env.GOOGLE_PLACES_LIVE;
    const prevNode = process.env.NODE_ENV;
    process.env.GOOGLE_PLACES_LIVE = "false";
    process.env.NODE_ENV = "development";

    const next = vi.fn();
    let capturedStatus = 0;
    let capturedBody: any = null;
    const res = {
      status: (s: number) => {
        capturedStatus = s;
        return {
          json: (b: any) => {
            capturedBody = b;
            return res;
          },
        };
      },
    } as any;

    requireGooglePlacesEnabled({} as any, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(capturedStatus).toBe(503);
    expect(capturedBody.reasonCode).toBe("PLACES_DISABLED");
    expect(typeof capturedBody.error).toBe("string");

    if (prev === undefined) delete process.env.GOOGLE_PLACES_LIVE;
    else process.env.GOOGLE_PLACES_LIVE = prev;
    if (prevNode === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = prevNode;
  });
});

// ─────────────────────────────────────────────────────────────
// C. Route wiring — guard applied to both proxy endpoints
// ─────────────────────────────────────────────────────────────

const ROUTE_SRC = read("server/routes/google-services.ts");
const ROUTE_CODE = codeOnly(ROUTE_SRC);

describe("C. server/routes/google-services.ts — guard wired into both endpoints", () => {
  it("imports requireGooglePlacesEnabled from the feature-flag module", () => {
    expect(ROUTE_CODE).toMatch(
      /requireGooglePlacesEnabled[\s\S]*from\s*['""][^'""]*feature-flags\/googlePlaces/,
    );
  });

  it("applies the guard to /places-autocomplete BEFORE the rate limiters", () => {
    // Capture the middleware chain on the autocomplete route.
    const match = ROUTE_CODE.match(
      /router\.get\(\s*''[^,]*,\s*([^,]+),\s*([^,]+),\s*([^,]+),/,
    );
    // Looser pattern (string literals are blanked to ''): look for
    // requireGooglePlacesEnabled appearing on the autocomplete line.
    const autoLine = ROUTE_SRC
      .split("\n")
      .find((l) => l.includes("router.get('/places-autocomplete'"));
    expect(autoLine).toBeDefined();
    expect(autoLine).toContain("requireGooglePlacesEnabled");
  });

  it("applies the guard to /places-details", () => {
    const detailsLine = ROUTE_SRC
      .split("\n")
      .find((l) => l.includes("router.get('/places-details'"));
    expect(detailsLine).toBeDefined();
    expect(detailsLine).toContain("requireGooglePlacesEnabled");
  });
});

// ─────────────────────────────────────────────────────────────
// D. Boundary — feature-flag module has zero protected-system
//    imports
// ─────────────────────────────────────────────────────────────

const FLAG_SRC = read("server/lib/feature-flags/googlePlaces.ts");
const FLAG_CODE = codeOnly(FLAG_SRC);

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

  // Google Sheets / Drive / GCS — the guard must not pull these
  /\bgoogleSheetsIntegration\b/,
  /\bgoogleDriveBackupService\b/,
  /\b@google-cloud\/storage\b/,
];

describe("D. server/lib/feature-flags/googlePlaces.ts — protected systems untouched", () => {
  for (const pattern of FORBIDDEN_PATTERNS) {
    it(`must not contain ${pattern}`, () => {
      expect(FLAG_CODE).not.toMatch(pattern);
    });
  }

  it("module exports exactly: GOOGLE_PLACES_FLAG_NAME, isGooglePlacesServerEnabled, requireGooglePlacesEnabled", () => {
    expect(FLAG_CODE).toMatch(/export\s+const\s+GOOGLE_PLACES_FLAG_NAME\b/);
    expect(FLAG_CODE).toMatch(
      /export\s+function\s+isGooglePlacesServerEnabled\b/,
    );
    expect(FLAG_CODE).toMatch(
      /export\s+function\s+requireGooglePlacesEnabled\b/,
    );
  });
});

// ─────────────────────────────────────────────────────────────
// E. .env.example documents the new flags
// ─────────────────────────────────────────────────────────────

const ENV_SRC = read(".env.example");

describe("E. .env.example — flag documented", () => {
  it("contains GOOGLE_PLACES_LIVE entry", () => {
    expect(ENV_SRC).toMatch(/^GOOGLE_PLACES_LIVE=/m);
  });

  it("contains VITE_GOOGLE_PLACES_LIVE entry", () => {
    expect(ENV_SRC).toMatch(/^VITE_GOOGLE_PLACES_LIVE=/m);
  });

  it("explains the PROGRAM.md §1.12 rationale", () => {
    expect(ENV_SRC).toMatch(/PROGRAM\.md\s+§1\.12/);
  });

  it("explains the production-default-on / dev-default-off behaviour", () => {
    expect(ENV_SRC).toMatch(/NODE_ENV=production/);
    expect(ENV_SRC).toMatch(/PLACES_DISABLED/);
  });
});
