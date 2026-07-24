/**
 * Signup age-gate redundancy (CEO 2026-07-24: "typed dob tick terms but Gmail
 * not working"; "provider ticked boxes put mobile, no SMS send button exists").
 *
 * The form had a DOB wheel AND a separate 'I am 18+' checkbox. A valid 18+ DOB
 * did NOT satisfy the checkbox-based consent gate, so Google sign-in and the
 * phone Send button stayed blocked until the user ALSO ticked the redundant
 * box. Now age is confirmed by EITHER (over18 checkbox OR a valid 18+ DOB).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const s = readFileSync(resolve(__dirname, '..', '..', 'client/src/pages/SignUpLuxury.tsx'), 'utf8');

describe('age gate accepts DOB OR the 18+ checkbox', () => {
  it('ageConfirmed = over18 || isAdult', () => {
    expect(s).toMatch(/const ageConfirmed = over18 \|\| isAdult;/);
  });

  it('social/OTP consent uses ageConfirmed, not the raw checkbox', () => {
    expect(s).toMatch(/const consentOk = agreedTerms && ageConfirmed;/);
    expect(s).not.toMatch(/const consentOk = agreedTerms && over18;/);
  });

  it('the Send-code button gate uses ageConfirmed (DOB alone unblocks it)', () => {
    expect(s).toMatch(/const readyForSubmit = !busy && hasContact && ageConfirmed;/);
    expect(s).not.toMatch(/const readyForSubmit = !busy && hasContact && isAdult;/);
  });

  it('consentOk is declared after isAdult (no temporal-dead-zone crash)', () => {
    expect(s.indexOf('const isAdult = age >= 18;')).toBeLessThan(s.indexOf('const consentOk = agreedTerms && ageConfirmed;'));
  });
});
