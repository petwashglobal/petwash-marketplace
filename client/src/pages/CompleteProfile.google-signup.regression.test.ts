/**
 * Google OAuth is authentication only — it must not bypass PetWash™‎ onboarding.
 * (CEO spec, 2026-09-12.)
 *
 * NEW USER  → /complete-profile: name + email pre-filled from Google; asks only
 *             for what is missing; mobile + OTP; explicit Terms + Privacy (with
 *             the 18+ attestation); marketing separate and unchecked; NO DOB /
 *             gender / address / pet.
 * RETURNING → /welcome-back greets by name, then straight to the right home.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const read = (f: string) => fs.readFileSync(path.resolve(__dirname, f), 'utf8');
const CP = read('CompleteProfile.tsx');
const WB = read('WelcomeBack.tsx');
const SU = read('SignUpLuxury.tsx');
const APP = read('../App.tsx');

describe('complete-profile after Google', () => {
  it('asks for NO date of birth, gender, address, city or postal code', () => {
    for (const s of ['dateOfBirth', 'setGender', 'GooglePlacesAutocomplete', 'postalCode', 'setCity(']) expect(CP).not.toContain(s);
  });
  it('verifies the mobile by OTP through the signed-in phone flow', () => {
    expect(CP).toContain('/api/user/settings/phone/request-change');
    expect(CP).toContain('/api/user/settings/phone/confirm-change');
    expect(CP).toContain('<OtpCodeInput');
  });
  it('one explicit consent line carries 18+ + Terms + Privacy; marketing is separate and off by default', () => {
    expect(CP).toContain('ageConfirmed18Plus: consent');
    expect(CP).toContain('termsAccepted: consent');
    expect(CP).toContain('privacyAccepted: consent');
    expect(CP).toMatch(/useState\(false\); \/\/ marketing — optional, unchecked/);
    expect(CP).toContain('בן/בת 18 ומעלה');
  });
  it('Continue is gated on a verified mobile and the consent', () => {
    expect(CP).toMatch(/const canContinue =[\s\S]{0,300}phoneVerified[\s\S]{0,300}consent/);
  });
  it('pre-fills from the account and asks only for what the server says is missing', () => {
    expect(CP).toContain('requiredFields.includes');
    expect(CP).toContain('data.user.firstName');
    expect(CP).toContain('data.user.email');
  });
});

describe('returning member', () => {
  it('has a /welcome-back route', () => {
    expect(APP).toContain('path="/welcome-back"');
    expect(APP).toMatch(/lazy\(\(\) => import\("@\/pages\/WelcomeBack"\)\)/);
  });
  it('greets by name and continues on its own', () => {
    expect(WB).toContain('ברוך שובך');
    expect(WB).toContain('AUTO_CONTINUE_MS');
    expect(WB).toContain('data-testid="welcome-back-continue"');
    expect(WB).toContain('data-testid="welcome-back-not-you"');
  });
  it('SignUpLuxury sends a returning, complete member through /welcome-back', () => {
    expect(SU).toContain("import { welcomeBackOr } from '@/lib/welcomeBack'");
    expect((SU.match(/navigate\(welcomeBackOr\(data, dest\)\)/g) || []).length).toBe(2); // both navigate sites
    expect(SU).not.toMatch(/navigate\(data\?\.nextUrl/);

  });
});
