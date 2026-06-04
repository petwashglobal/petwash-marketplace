/**
 * Tripwire: production must NEVER trust a Replit origin.
 *
 * Replit was a development environment only; a leaked-credential or compromised
 * Replit must not be able to make authenticated cross-origin calls to PetWash.
 * This test reads server/index.ts and fails CI if:
 *   1. the credentialed CORS allowlist (CORS_EXACT_ORIGINS) ever lists a Replit
 *      domain, or
 *   2. the Replit dev-origin patterns ever stop being gated by !isProduction.
 *
 * If this test fails, someone is about to open a Replit door into production —
 * do not merge.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";

const src = readFileSync(path.resolve(__dirname, "../index.ts"), "utf8");

describe("CORS guard — production never trusts Replit", () => {
  it("credentialed CORS allowlist (CORS_EXACT_ORIGINS) has no Replit domain", () => {
    const start = src.indexOf("CORS_EXACT_ORIGINS");
    const block = src.slice(start, src.indexOf("];", start));
    expect(start).toBeGreaterThan(-1);
    expect(block.toLowerCase()).not.toMatch(/replit|repl\.co/);
  });

  it("Replit dev-origin CORS patterns remain gated to non-production", () => {
    // The only place Replit origins are allowed must be guarded by !isProduction.
    expect(src).toMatch(/!isProduction\s*&&\s*CORS_DEV_PATTERNS/);
  });

  it("production blocks unknown origins (fail-closed branch present)", () => {
    expect(src).toMatch(/isProduction[\s\S]{0,80}Blocked origin/);
  });
});
