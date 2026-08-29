/**
 * Lane A — computeRequiredActions pure-helper pins.
 *
 * CEO FLY MODE II — AUTH CONVERSION P0 (2026-08-29).
 *
 * The pure helper drives the /api/auth/account-resolution response.
 * Testing it directly (rather than the whole handler) keeps the
 * suite deterministic and hermetic — no db, no Firebase, no
 * Express plumbing.
 */
import { describe, it, expect } from 'vitest';
import { computeRequiredActions } from '../routes/account-resolution';

type Row = Parameters<typeof computeRequiredActions>[0];

const completeRow: Row = {
  emailVerified: true,
  phoneVerified: true,
  firstName: 'Alex',
  lastName: 'Ali',
  dateOfBirth: '1990-01-01',
  termsAcceptedAt: new Date('2026-01-01'),
  email: 'alex@x.com',
  phoneE164: '+972501234567',
};

describe('CEO FLY MODE II Lane A — computeRequiredActions', () => {
  it('a fully-populated verified user has ZERO required actions', () => {
    expect(computeRequiredActions(completeRow)).toEqual([]);
  });

  it('unverified phone → mobile_verification', () => {
    expect(
      computeRequiredActions({ ...completeRow, phoneVerified: false }),
    ).toEqual(['mobile_verification']);
  });

  it('unverified email (email present, verified=false) → email_verification', () => {
    expect(
      computeRequiredActions({ ...completeRow, emailVerified: false }),
    ).toEqual(['email_verification']);
  });

  it('unverified email with NO email on file → does NOT require email_verification', () => {
    // A phone-only signup keeps email null; we don't ask to verify
    // something that doesn't exist yet.
    const dto = computeRequiredActions({
      ...completeRow,
      email: null,
      emailVerified: false,
    });
    expect(dto).not.toContain('email_verification');
  });

  it('missing first name → first_name; missing last name → last_name', () => {
    expect(
      computeRequiredActions({ ...completeRow, firstName: null, lastName: null }),
    ).toEqual(['first_name', 'last_name']);
  });

  it('single-char names are treated as MISSING (namesValid discipline)', () => {
    expect(
      computeRequiredActions({ ...completeRow, firstName: 'A', lastName: 'B' }),
    ).toEqual(['first_name', 'last_name']);
  });

  it('missing DOB (null OR sentinel 0001-01-01) → date_of_birth', () => {
    expect(
      computeRequiredActions({ ...completeRow, dateOfBirth: null }),
    ).toEqual(['date_of_birth']);
    expect(
      computeRequiredActions({ ...completeRow, dateOfBirth: '0001-01-01' }),
    ).toEqual(['date_of_birth']);
  });

  it('missing termsAcceptedAt → terms_acceptance', () => {
    expect(
      computeRequiredActions({ ...completeRow, termsAcceptedAt: null }),
    ).toEqual(['terms_acceptance']);
  });

  it('CEO §2 canonical order: verification → names → DOB → terms', () => {
    // A brand-new Google user with a Google-supplied name typically
    // arrives with: email verified (from Google), phone missing, DOB
    // missing, terms not accepted. The action ordering the client
    // renders must be: mobile → dob → terms.
    const googleFresh: Row = {
      emailVerified: true,
      phoneVerified: false,
      firstName: 'Alex',
      lastName: 'Ali',
      dateOfBirth: null,
      termsAcceptedAt: null,
      email: 'alex@gmail.com',
      phoneE164: null,
    };
    expect(computeRequiredActions(googleFresh)).toEqual([
      'mobile_verification',
      'date_of_birth',
      'terms_acceptance',
    ]);
  });

  it('phone-only signup with no name/DOB/terms — canonical order preserved', () => {
    const phoneFresh: Row = {
      emailVerified: false,   // email is null anyway
      phoneVerified: true,    // OTP verified during sign-in
      firstName: null,
      lastName: null,
      dateOfBirth: null,
      termsAcceptedAt: null,
      email: null,
      phoneE164: '+972501234567',
    };
    expect(computeRequiredActions(phoneFresh)).toEqual([
      'first_name',
      'last_name',
      'date_of_birth',
      'terms_acceptance',
    ]);
  });

  it('email-only signup — email verified via OTP, missing everything else', () => {
    const emailFresh: Row = {
      emailVerified: true,     // OTP verified
      phoneVerified: false,
      firstName: null,
      lastName: null,
      dateOfBirth: null,
      termsAcceptedAt: null,
      email: 'alex@x.com',
      phoneE164: null,
    };
    expect(computeRequiredActions(emailFresh)).toEqual([
      'mobile_verification',
      'first_name',
      'last_name',
      'date_of_birth',
      'terms_acceptance',
    ]);
  });
});
