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
 * The pattern that flags an inline OTP generator. Matches any
 * `crypto.randomInt(100000` occurrence — the shape every one of the
 * 12 legacy generators uses.
 */
const PATTERN = /crypto\.randomInt\s*\(\s*100000/;

/**
 * KNOWN_LEGACY_GENERATORS — the 12 pre-canonical generator sites
 * documented in the OTP trigger inventory. Paths are server/-relative.
 * Removing an entry means the call-site was refactored to import
 * generateOtpCode from shared/auth/otpCodeGeneration.ts.
 */
const KNOWN_LEGACY_GENERATORS: ReadonlySet<string> = new Set([
  'services/UnifiedVerificationService.ts',
  'services/TwilioSMSService.ts',
  'services/RegistrationOTPService.ts',
  'services/TwoFactorAuthService.ts',
  'services/TransactionOTPService.ts',
  'routes/onboarding-verification.ts',
  'routes/profile-settings.ts',
  'routes/provider-phone.ts',
  'routes/admin.ts',
  'routes/israeli-2025-esign.ts',
  'lib/serviceVerificationCrypto.ts',
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
]);

describe('OTP code generator sprawl — source-anchored', () => {
  it('no NEW inline `crypto.randomInt(100000, ...)` generators outside the KNOWN_LEGACY set', () => {
    const offenders: string[] = [];
    for (const f of FILES) {
      // Exempt this pin file (should not be picked up anyway).
      if (f.endsWith('otpCodeGeneratorSprawl.regression.test.ts')) continue;
      let contents: string;
      try { contents = fs.readFileSync(f, 'utf8'); } catch { continue; }
      if (!PATTERN.test(contents)) continue;
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
