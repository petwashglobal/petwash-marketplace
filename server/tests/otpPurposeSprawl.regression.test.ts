/**
 * Regression pin — CEO P0-CEP §4.
 *
 * The OTP purpose vocabulary lives in ONE file:
 *   shared/auth/otpPurposeRegistry.ts
 *
 * This pin walks server/services + server/routes + server/lib and
 * refuses to boot the test suite if any file introduces a NEW string
 * literal used in an OTP-purpose position (e.g. a route inserting a
 * verification_challenges row with a hard-coded purpose that isn't in
 * OTP_PURPOSES).
 *
 * The heuristic is intentionally narrow: we only flag identifiers or
 * property assignments whose literal value doesn't match the registry.
 * A well-meaning engineer cannot silently introduce e.g. "wallet_topup"
 * as an eighth informal purpose — the pin will trip.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { OTP_PURPOSES } from '@shared/auth/otpPurposeRegistry';

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
 * A property-assignment line like:
 *   purpose: 'change_email'
 *   purpose: "wallet_topup"
 * The pin scans specifically for the `purpose:` property, because
 * that is the schema column of verification_challenges. This keeps
 * false positives away from unrelated words that happen to include
 * "purpose".
 */
const ASSIGN = /\bpurpose\s*:\s*['"]([A-Za-z0-9_.-]+)['"]/g;

/**
 * KNOWN_LEGACY — pre-registry purpose strings that live in production
 * OTP paths (UnifiedVerificationService.ts, VerificationEmailDelivery.ts).
 * Frozen here as documented debt; a separate P0-CEP follow-up owns
 * the canonicalisation into OTP_PURPOSES. This pin's job is to make
 * sure the debt DOES NOT GROW: any new purpose literal that is
 * neither in OTP_PURPOSES nor in this list trips CI.
 *
 * Removing an entry from this list requires either:
 *   • The legacy call-site was refactored to a SCREAMING_SNAKE_CASE
 *     purpose that lives in OTP_PURPOSES, OR
 *   • The whole flow was deleted.
 * NEVER add a new entry here to silence CI — add it to OTP_PURPOSES.
 */
const KNOWN_LEGACY: ReadonlySet<string> = new Set([
  'diagnostic_noop',
  'login',
  'signup',
  'egift_redeem',
  'change_email',
  'enable_2fa',
  'disable_2fa',
  'close_account',
  'payout',
]);

/**
 * Anchor tokens — a file only counts as an OTP-purpose call-site if
 * it mentions the verification_challenges schema symbol OR imports
 * the OTPPurposeRegistry. This keeps unrelated domains that also use
 * a "purpose" column (documents, notifications, bookings) out of the
 * pin — same column NAME, different domain, different vocabulary.
 */
const OTP_ANCHORS = [
  'verification_challenges',
  'verificationChallenges',
  'insertVerificationChallengeSchema',
  'otpPurposeRegistry',
];

function isOtpCallSite(contents: string): boolean {
  for (const a of OTP_ANCHORS) if (contents.includes(a)) return true;
  return false;
}

describe('OTP purpose sprawl — source-anchored', () => {
  it('every OTP-purpose literal in a verification_challenges call-site is in OTP_PURPOSES or the frozen KNOWN_LEGACY set', () => {
    const allowed = new Set<string>(OTP_PURPOSES as readonly string[]);
    const offenders: Array<{ file: string; literal: string }> = [];
    for (const f of FILES) {
      // Exempt this pin file (should not be picked up anyway).
      if (f.endsWith('otpPurposeSprawl.regression.test.ts')) continue;
      let contents: string;
      try { contents = fs.readFileSync(f, 'utf8'); } catch { continue; }
      if (!isOtpCallSite(contents)) continue;
      for (const m of contents.matchAll(ASSIGN)) {
        const lit = m[1];
        if (allowed.has(lit)) continue;
        if (KNOWN_LEGACY.has(lit)) continue;
        offenders.push({ file: path.relative(SERVER_ROOT, f), literal: lit });
      }
    }
    expect(
      offenders,
      `off-registry OTP purpose literals: ${offenders.map((o) => `${o.file}:${o.literal}`).join(', ')}`,
    ).toEqual([]);
  });
});
