/**
 * RegistrationResumeService — Program 43.
 */
import { describe, it, expect } from 'vitest';
import {
  nextRegistrationStep,
  type IdentityState,
} from '../services/marketplace/RegistrationResumeService';

const complete: IdentityState = {
  emailVerified: true,
  phoneVerified: true,
  ageConfirmed: true,
  termsAcceptedVersion: 'v3',
  currentTermsVersion: 'v3',
  profileComplete: true,
  hasCustomerCapability: true,
  hasProviderApplicant: false,
  hasProviderActive: false,
};

describe('RegistrationResumeService', () => {
  it('fully complete customer → HOME_CUSTOMER', () => {
    expect(nextRegistrationStep(complete)).toBe('HOME_CUSTOMER');
  });

  it('CONFIRM_AGE is the first step (before anything else)', () => {
    expect(nextRegistrationStep({ ...complete, ageConfirmed: false })).toBe('CONFIRM_AGE');
  });

  it('phone missing → VERIFY_PHONE (§65 both contacts required)', () => {
    expect(nextRegistrationStep({ ...complete, phoneVerified: false })).toBe('VERIFY_PHONE');
  });

  it('email missing → VERIFY_EMAIL', () => {
    expect(nextRegistrationStep({ ...complete, emailVerified: false })).toBe('VERIFY_EMAIL');
  });

  it('stale terms version → ACCEPT_TERMS', () => {
    expect(nextRegistrationStep({ ...complete, termsAcceptedVersion: 'v2' })).toBe('ACCEPT_TERMS');
  });

  it('profile incomplete → COMPLETE_PROFILE', () => {
    expect(nextRegistrationStep({ ...complete, profileComplete: false })).toBe('COMPLETE_PROFILE');
  });

  it('active provider → HOME_PROVIDER (wins over customer)', () => {
    expect(nextRegistrationStep({ ...complete, hasProviderActive: true })).toBe('HOME_PROVIDER');
  });

  it('provider applicant with no active yet → HOME_PROVIDER_PENDING', () => {
    expect(nextRegistrationStep({
      ...complete,
      hasProviderApplicant: true,
      hasCustomerCapability: false,
    })).toBe('HOME_PROVIDER_PENDING');
  });

  it('no capabilities at all → CHOOSE_MODE', () => {
    expect(nextRegistrationStep({
      ...complete,
      hasCustomerCapability: false,
      hasProviderApplicant: false,
      hasProviderActive: false,
    })).toBe('CHOOSE_MODE');
  });
});
