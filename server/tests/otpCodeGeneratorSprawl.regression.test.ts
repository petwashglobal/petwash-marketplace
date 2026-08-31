/**
 * Regression pin — task #186.
 *
 * OTP code generation lives in ONE file:
 *   shared/auth/otpCodeGeneration.ts
 *
 * This pin walks server/{services,routes,lib} and refuses to boot
 * the test suite if ANY file introduces a NEW `crypto.randomInt(100000, ...)`
 * pattern outside a documented KNOWN_LEGACY set.
 *
 * The 12 legacy generators identified in the OTP trigger inventory
 * (docs/audit/2026-08-31-otp-verification-trigger-inventory.md, gap
 * #3) are frozen here as documented debt. Removing an entry from
 * KNOWN_LEGACY_GENERATORS requires the call-site to have been
 * refactored to import `generateOtpCode` from the canonical file.
 * NEVER add a new entry here to silence CI — refactor the call-site
 * instead.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const SERVER_ROOT = path.resolve(__dirname, '..');

function walkNarrow(dirs: string[]): string[] {
  const out: string[] = [];
  const stack = [...dirs];
  while (stack.length) {
    const cur = stack.pop()!;
    let entries: fs.Dirent[] = [];
    try { entries = fs.readdirSync(cur, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      if (e.name === 'node_modules' || e.name === 'tests' || e.name === '__tests__') continue;
      const p = path.join(cur, e.name);
      if (e.isDirectory()) { stack.push(p); continue; }
      if (e.isFile() && p.endsWith('.ts')) out.push(p);
    }
  }
  return out;
}

const FILES = walkNarrow([
  path.join(SERVER_ROOT, 'services'),
  path.join(SERVER_ROOT, 'routes'),
  path.join(SERVER_ROOT, 'lib'),
]);

/**
 * Patterns that flag an inline 6-digit OTP generator. The 12 legacy
 * sites use three shape families:
 *   (a) crypto.randomInt(100000, 1000000)           — direct
 *   (b) crypto.randomInt(100000, 999999)             — direct, tight range
 *   (c) Math.floor(100000 + crypto.randomInt(900000)) — offset form
 *   (d) randomInt(100000, 1000000)                   — named import
 *
 * The union below catches all four. Splitting them keeps the regex
 * simple and grep-debuggable — a future engineer running `grep -E`
 * with any single pattern can find the corresponding site quickly.
 */
const PATTERNS: readonly RegExp[] = [
  /crypto\.randomInt\s*\(\s*100000/,                                     // (a) + (b)
  /Math\.floor\s*\(\s*100000\s*\+\s*crypto\.randomInt\s*\(\s*900000/,     // (c)
  /\brandomInt\s*\(\s*100000\s*,\s*1000000\)/,                            // (d) named import
];

function containsGenerator(contents: string): boolean {
  for (const p of PATTERNS) if (p.test(contents)) return true;
  return false;
}

/**
 * KNOWN_LEGACY_GENERATORS — the 12 pre-canonical generator sites
 * documented in the OTP trigger inventory. Paths are server/-relative.
 * Removing an entry means the call-site was refactored to import
 * generateOtpCode from shared/auth/otpCodeGeneration.ts.
 */
const KNOWN_LEGACY_GENERATORS: ReadonlySet<string> = new Set([
  // Empty — all 10 user-auth OTP generators identified in the trigger
  // inventory (docs/audit/2026-08-31-otp-verification-trigger-inventory.md
  // gap #3) have been migrated to shared/auth/otpCodeGeneration.ts
  // as of task #187. This set stays as a shape for the next time a
  // similar refactor lane opens.
]);

/**
 * NOT_OTP_GENERATORS — files that share the crypto.randomInt(100000, …)
 * SHAPE but produce a DIFFERENT domain object (station handoff PIN,
 * pickup token) that has its own governance (see HandoffCodeSpec).
 * These are documented explicitly so a future engineer reading this
 * pin understands they were NOT accidental exemptions.
 */
const NOT_OTP_GENERATORS: ReadonlySet<string> = new Set([
  // K9000 station handoff token — governed by HandoffCodeSpec, not the
  // user-auth OTP registry. Excluded from the trigger inventory
  // (docs/audit/2026-08-31-otp-verification-trigger-inventory.md).
  'services/booking-engines/k9000/K9000StationBookingEngine.ts',
  // Walk-My-Pet booking confirmation code — a handoff PIN the pet
  // parent shares with the sitter to prove pickup, not a user-auth OTP.
  // Same domain family as the K9000 station token above.
  'routes/walk-my-pet.ts',
]);

describe('OTP code generator sprawl — source-anchored', () => {
  it('no NEW inline `crypto.randomInt(100000, ...)` generators outside the KNOWN_LEGACY set', () => {
    const offenders: string[] = [];
    for (const f of FILES) {
      // Exempt this pin file (should not be picked up anyway).
      if (f.endsWith('otpCodeGeneratorSprawl.regression.test.ts')) continue;
      let contents: string;
      try { contents = fs.readFileSync(f, 'utf8'); } catch { continue; }
      if (!containsGenerator(contents)) continue;
      const rel = path.relative(SERVER_ROOT, f);
      if (KNOWN_LEGACY_GENERATORS.has(rel)) continue;
      if (NOT_OTP_GENERATORS.has(rel)) continue;
      offenders.push(rel);
    }
    expect(
      offenders,
      `new inline OTP generators (must use generateOtpCode from shared/auth/otpCodeGeneration.ts): ${offenders.join(', ')}`,
    ).toEqual([]);
  });
});
