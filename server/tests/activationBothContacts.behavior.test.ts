/**
 * PR-AUTH-IDENTITY-1 CEO MASTER AUTH CONTRACT — activation requires
 * BOTH verified contacts under strict mode. Legacy mode preserves the
 * pre-fix one-of-two behaviour so a solo deploy of this PR does not
 * strand mid-flow users. Grandfathering: an already-active row is
 * NEVER demoted by a re-read.
 *
 * We test the pure computeStatus/derived-isFullyActive semantics via
 * the exported `isBothContactsRequired` toggle. No DB mocking needed
 * for the pure branches; markMobile/EmailVerified are covered by
 * their own downstream tests.
 */
import { describe, it, expect, beforeEach } from 'vitest';

// Import fresh each test so env-flag reads don't leak. The module
// itself reads process.env at CALL time (isBothContactsRequired),
// so a plain import + env mutation is sufficient — no re-import.
import { isBothContactsRequired } from '../services/ActivationService';

describe('isBothContactsRequired — env flag toggle', () => {
  beforeEach(() => {
    delete process.env.AUTH_REQUIRE_BOTH_CONTACTS;
  });

  it('defaults to false when the env var is unset', () => {
    expect(isBothContactsRequired()).toBe(false);
  });

  it('accepts case-insensitive true', () => {
    process.env.AUTH_REQUIRE_BOTH_CONTACTS = 'True';
    expect(isBothContactsRequired()).toBe(true);
    process.env.AUTH_REQUIRE_BOTH_CONTACTS = 'TRUE';
    expect(isBothContactsRequired()).toBe(true);
    process.env.AUTH_REQUIRE_BOTH_CONTACTS = 'true';
    expect(isBothContactsRequired()).toBe(true);
  });

  it('any non-true value is falsy (safe default)', () => {
    process.env.AUTH_REQUIRE_BOTH_CONTACTS = '1';       expect(isBothContactsRequired()).toBe(false);
    process.env.AUTH_REQUIRE_BOTH_CONTACTS = 'yes';     expect(isBothContactsRequired()).toBe(false);
    process.env.AUTH_REQUIRE_BOTH_CONTACTS = 'false';   expect(isBothContactsRequired()).toBe(false);
    process.env.AUTH_REQUIRE_BOTH_CONTACTS = '';        expect(isBothContactsRequired()).toBe(false);
  });
});

/**
 * Source-pin: the computeStatus / isFullyActive contract must be
 * consistent with the docstring. These freeze the exact conditional
 * shape so a well-meaning refactor cannot silently regress either
 * mode.
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
const SRC = readFileSync(resolve(__dirname, '..', 'services', 'ActivationService.ts'), 'utf8');

describe('ActivationService source-pin — MASTER AUTH contract branches', () => {
  it('exports isBothContactsRequired', () => {
    expect(SRC).toMatch(/export function isBothContactsRequired\(\): boolean/);
    expect(SRC).toMatch(/AUTH_REQUIRE_BOTH_CONTACTS/);
  });

  it('computeStatus grandfathers already-active rows regardless of flag', () => {
    // Pin: if the currentStatus is already 'active', return 'active'
    // BEFORE consulting the flag. Prevents accidental demotion.
    expect(SRC).toMatch(/if \(currentStatus === 'active'\) return 'active';/);
  });

  it('STRICT branch requires BOTH timestamps for active', () => {
    // The strict branch must return 'active' only when both are set.
    expect(SRC).toMatch(/if \(strict\)/);
    expect(SRC).toMatch(/if \(mobileVerifiedAt && emailVerifiedAt\) return 'active';/);
    // And expose the intermediate mobile/email_verified states.
    expect(SRC).toMatch(/if \(mobileVerifiedAt\) return 'mobile_verified';/);
    expect(SRC).toMatch(/if \(emailVerifiedAt\) return 'email_verified';/);
  });

  it('LEGACY branch still returns active on either contact', () => {
    // Pin the legacy default so a refactor cannot silently break the
    // rollback path.
    expect(SRC).toMatch(/\/\/ Legacy pre-MASTER-AUTH-contract behaviour/);
    expect(SRC).toMatch(/if \(mobileVerifiedAt \|\| emailVerifiedAt\) return 'active';/);
  });

  it('isFullyActive: suspended/deleted → false regardless', () => {
    expect(SRC).toContain("user.activationStatus === 'suspended' || user.activationStatus === 'deleted'");
    expect(SRC).toContain('suspended\n    ? false');
  });

  it("isFullyActive: existing 'active' rows stay true regardless of flag", () => {
    expect(SRC).toMatch(/user\.activationStatus === 'active'\s*\?\s*true/);
  });

  it('isFullyActive: STRICT mode requires both timestamps for still-activating rows', () => {
    expect(SRC).toMatch(/strict\s*\n\s*\?\s*\(mobileVerifiedAt != null && emailVerifiedAt != null\)/);
  });

  it('isFullyActive: LEGACY mode accepts either timestamp for still-activating rows', () => {
    expect(SRC).toMatch(/:\s*\(mobileVerifiedAt != null \|\| emailVerifiedAt != null\)/);
  });
});

describe('ActivationService source-pin — no other activation function bypasses the flag', () => {
  it('markMobileVerified and markEmailVerified both route through computeStatus', () => {
    expect(SRC).toMatch(/const newStatus = computeStatus\(now, user\.emailVerifiedAt \?\? null, user\.activationStatus \?\? 'draft'\)/);
    expect(SRC).toMatch(/const newStatus = computeStatus\(user\.mobileVerifiedAt \?\? null, now, user\.activationStatus \?\? 'draft'\)/);
  });

  it('_onFullActivation is invoked only when computeStatus returns active', () => {
    // Both mark* functions must gate the side-effect chain on newStatus === 'active'.
    const matches = SRC.match(/if \(newStatus === 'active'\) \{\s*await _onFullActivation/g) || [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });
});
