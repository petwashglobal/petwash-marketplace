/**
 * ProfileCompletenessService — CEO P0-MY-ACCOUNT.
 */
import { describe, it, expect } from 'vitest';
import {
  evaluateProfileCompleteness,
  type ProfileSnapshot,
} from '../services/marketplace/ProfileCompletenessService';

const complete: ProfileSnapshot = {
  firstName: 'Sarah',
  lastName: 'Cohen',
  email: 'sarah@example.com',
  emailVerified: true,
  phone: '+972501234567',
  phoneVerified: true,
  dateOfBirth: '1990-01-01',
  language: 'he',
  address: 'Tel Aviv',
  termsAcceptedVersion: 'v3',
  currentTermsVersion: 'v3',
};

describe('ProfileCompletenessService', () => {
  it('complete snapshot → COMPLETE with no actions', () => {
    const out = evaluateProfileCompleteness(complete);
    expect(out.profileState).toBe('COMPLETE');
    expect(out.missingFields).toEqual([]);
    expect(out.requiredActions).toEqual([]);
  });

  it('missing surname → INCOMPLETE with COMPLETE_NAME action + PERSONAL deep link', () => {
    const out = evaluateProfileCompleteness({ ...complete, lastName: '' });
    expect(out.profileState).toBe('INCOMPLETE');
    expect(out.missingFields).toContain('firstName');
    expect(out.missingFields).toContain('lastName');
    expect(out.requiredActions[0]).toEqual({ code: 'COMPLETE_NAME', deepLinkCode: 'MY_ACCOUNT_PERSONAL' });
  });

  it('unverified email → VERIFY_EMAIL (not ADD_EMAIL)', () => {
    const out = evaluateProfileCompleteness({ ...complete, emailVerified: false });
    expect(out.missingFields).toContain('emailVerification');
    expect(out.missingFields).not.toContain('email');
    expect(out.requiredActions.some((a) => a.code === 'VERIFY_EMAIL')).toBe(true);
  });

  it('missing phone → ADD_MOBILE (not VERIFY_MOBILE)', () => {
    const out = evaluateProfileCompleteness({ ...complete, phone: '', phoneVerified: false });
    expect(out.missingFields).toContain('mobile');
    expect(out.requiredActions.some((a) => a.code === 'ADD_MOBILE')).toBe(true);
    expect(out.requiredActions.some((a) => a.code === 'VERIFY_MOBILE')).toBe(false);
  });

  it('stale terms version → ACCEPT_TERMS with TERMS deep link', () => {
    const out = evaluateProfileCompleteness({ ...complete, termsAcceptedVersion: 'v2' });
    expect(out.missingFields).toContain('termsAcceptance');
    expect(out.requiredActions.some((a) => a.code === 'ACCEPT_TERMS')).toBe(true);
  });

  it('every action carries a deepLinkCode so Attention can open the exact section', () => {
    const out = evaluateProfileCompleteness({
      firstName: null, lastName: null,
      email: null, phone: null,
      dateOfBirth: null, language: null, address: null,
      currentTermsVersion: 'v3',
    });
    for (const a of out.requiredActions) {
      expect(a.deepLinkCode.length).toBeGreaterThan(0);
    }
  });

  it('COMPLETE is returned only when EVERY dimension is present + verified', () => {
    for (const mutation of [
      { firstName: null }, { lastName: null },
      { email: null }, { emailVerified: false },
      { phone: null }, { phoneVerified: false },
      { dateOfBirth: null }, { language: null }, { address: null },
      { termsAcceptedVersion: 'v2' },
    ] as Array<Partial<ProfileSnapshot>>) {
      const out = evaluateProfileCompleteness({ ...complete, ...mutation });
      expect(out.profileState).toBe('INCOMPLETE');
    }
  });
});
