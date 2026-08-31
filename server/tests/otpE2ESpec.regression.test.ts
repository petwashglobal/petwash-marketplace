/**
 * Regression pin — otp-purpose-flow.e2e.spec.ts must exist and
 * cover CEO OTP brief §10: contextual message, iOS + Android
 * autofill compliance, cross-purpose rejection, expired /
 * attempts-exhausted / status-not-consumable, plus a device-farm
 * placeholder that unskips when ENABLE_DEVICE_FARM_E2E is set.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const SPEC_PATH = path.resolve(
  __dirname,
  '..',
  '..',
  'tests',
  'e2e',
  'otp-purpose-flow.e2e.spec.ts',
);

describe('OTP purpose-flow E2E — spec presence + coverage pin (task #185)', () => {
  it('spec file exists at the canonical path', () => {
    expect(fs.existsSync(SPEC_PATH)).toBe(true);
  });

  it('covers §2 (contextual he-IL / en) for ACCOUNT_ACTIVATION and PURCHASE_CONFIRMATION', () => {
    const src = fs.readFileSync(SPEC_PATH, 'utf8');
    expect(src).toMatch(/ACCOUNT_ACTIVATION/);
    expect(src).toMatch(/PURCHASE_CONFIRMATION/);
    expect(src).toMatch(/Pet Wash™:/);
    expect(src).toMatch(/אם לא ביצעת פעולה זו/);
    expect(src).toMatch(/do not share/);
  });

  it('covers §5 cross-purpose reuse refusal (PURPOSE_MISMATCH)', () => {
    const src = fs.readFileSync(SPEC_PATH, 'utf8');
    expect(src).toMatch(/PURPOSE_MISMATCH/);
    expect(src).toMatch(/cannot be reused/);
  });

  it('covers §7 iOS + Android autofill compliance across purposes × locales', () => {
    const src = fs.readFileSync(SPEC_PATH, 'utf8');
    expect(src).toMatch(/checkAutofillCompliance/);
    expect(src).toMatch(/iOS AutoFill recognises/);
  });

  it('covers §10 expired / attempts-exhausted / status-not-consumable REFUSE reason codes', () => {
    const src = fs.readFileSync(SPEC_PATH, 'utf8');
    for (const reasonCode of ['EXPIRED', 'ATTEMPTS_EXHAUSTED', 'STATUS_NOT_CONSUMABLE']) {
      expect(src, `spec missing reasonCode: ${reasonCode}`).toContain(reasonCode);
    }
  });

  it('carries the device-farm placeholder (skipped in stubbed CI, unskippable via ENABLE_DEVICE_FARM_E2E)', () => {
    const src = fs.readFileSync(SPEC_PATH, 'utf8');
    expect(src).toMatch(/ENABLE_DEVICE_FARM_E2E/);
    expect(src).toMatch(/test\.skip/);
  });
});
