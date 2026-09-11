/**
 * The base member profile gate — one predicate, three consumers.
 *
 * CEO 2026-09-12 (Google signup flow): a member is complete only when the
 * mobile is VERIFIED. Before, 'phone' was satisfied by any string, so a
 * number typed on /complete-profile (never OTP'd) counted as done. The
 * predicate lives in @shared/memberRequiredFields and is used by
 * post-login, the onboarding gate middleware and (via getWhoami) the client.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { MEMBER_REQUIRED_FIELDS, isMemberFieldMissing, getMissingMemberFields } from '@shared/memberRequiredFields';

const read = (f: string) => fs.readFileSync(path.resolve(process.cwd(), f), 'utf8');

describe('member profile gate', () => {
  it('the contract is still name + mobile + terms + privacy — no DOB / gender / address', () => {
    expect(MEMBER_REQUIRED_FIELDS).toEqual(['firstName', 'lastName', 'phone', 'termsAcceptedAt', 'privacyAcceptedAt']);
  });

  it("'phone' is missing until it is VERIFIED", () => {
    expect(isMemberFieldMissing({ phone: '+972500000000', phoneVerified: false }, 'phone')).toBe(true);
    expect(isMemberFieldMissing({ phone: '+972500000000' }, 'phone')).toBe(true);
    expect(isMemberFieldMissing({ phone: null, phoneVerified: true }, 'phone')).toBe(true);
    expect(isMemberFieldMissing({ phone: '+972500000000', phoneVerified: true }, 'phone')).toBe(false);
  });

  it('other fields keep the plain presence rule', () => {
    expect(isMemberFieldMissing({ firstName: '' }, 'firstName')).toBe(true);
    expect(isMemberFieldMissing({ firstName: 'Nir' }, 'firstName')).toBe(false);
    expect(isMemberFieldMissing({ termsAcceptedAt: null }, 'termsAcceptedAt')).toBe(true);
    expect(isMemberFieldMissing({ termsAcceptedAt: new Date() }, 'termsAcceptedAt')).toBe(false);
  });

  it('a Google signup (name + email from Google) is asked only for mobile + consents', () => {
    const googleUser = { firstName: 'Nir', lastName: 'Hadad', email: 'n@example.com', phone: null, phoneVerified: false };
    expect(getMissingMemberFields(googleUser, MEMBER_REQUIRED_FIELDS)).toEqual(['phone', 'termsAcceptedAt', 'privacyAcceptedAt']);
    const done = { ...googleUser, phone: '+61400000000', phoneVerified: true, termsAcceptedAt: new Date(), privacyAcceptedAt: new Date() };
    expect(getMissingMemberFields(done, MEMBER_REQUIRED_FIELDS)).toEqual([]);
  });

  it('all three consumers use the shared predicate (no bare !user[field] left)', () => {
    const postLogin = read('server/routes/post-login.ts');
    expect(postLogin).toContain('getMissingMemberFields(user, required)');
    expect(postLogin).not.toMatch(/required\.filter\(\(field: string\) => !user\[field\]\)/);
    const gate = read('server/middleware/onboardingGate.ts');
    expect(gate).toContain('isMemberFieldMissing(user, f)');
    expect(gate).toContain('isMemberFieldMissing(user as any, field)');
    expect(gate).not.toMatch(/MEMBER_REQUIRED_FIELDS\.filter\(\(f\) => !user\?\.\[f\]\)/);
    expect(gate).not.toMatch(/if \(!\(user as any\)\[field\]\) \{/);
  });

  it('complete-profile refuses consent without the 18+ attestation', () => {
    const postLogin = read('server/routes/post-login.ts');
    expect(postLogin).toContain("AGE_CONFIRMATION_REQUIRED");
    expect(postLogin).toMatch(/ageConfirmed18Plus/);
  });
});
