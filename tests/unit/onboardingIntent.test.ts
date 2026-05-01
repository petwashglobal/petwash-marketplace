import { describe, it, expect } from 'vitest';
import {
  SIGNUP_INTENT,
  ALL_SIGNUP_INTENTS,
  isSignupIntent,
  INTENT_DEFAULT_DESTINATION,
  type SignupIntent,
} from '../../shared/lib/onboardingIntent';

/**
 * Phase E — shared signup intent constants.
 *
 * Locks the rule that the four canonical intents are
 *   customer | loyalty | provider | staff_request
 * and prevents future commits from drifting via typos like 'PROVIDER'
 * or 'staff_req'.
 */

describe('SIGNUP_INTENT — canonical strings', () => {
  it('exposes exactly four intents', () => {
    expect(Object.keys(SIGNUP_INTENT).sort()).toEqual([
      'CUSTOMER', 'LOYALTY', 'PROVIDER', 'STAFF',
    ]);
  });

  it('uses snake_case staff_request (matches DB enum)', () => {
    expect(SIGNUP_INTENT.STAFF).toBe('staff_request');
  });

  it('uses lower-case for the others (matches DB enum)', () => {
    expect(SIGNUP_INTENT.CUSTOMER).toBe('customer');
    expect(SIGNUP_INTENT.LOYALTY).toBe('loyalty');
    expect(SIGNUP_INTENT.PROVIDER).toBe('provider');
  });

  it('ALL_SIGNUP_INTENTS includes every key', () => {
    expect([...ALL_SIGNUP_INTENTS].sort()).toEqual([
      'customer', 'loyalty', 'provider', 'staff_request',
    ]);
  });
});

describe('isSignupIntent — type guard', () => {
  it('accepts every canonical value', () => {
    for (const intent of ALL_SIGNUP_INTENTS) {
      expect(isSignupIntent(intent)).toBe(true);
    }
  });

  it('rejects rejected intents (admin / management / super_admin)', () => {
    expect(isSignupIntent('admin')).toBe(false);
    expect(isSignupIntent('management')).toBe(false);
    expect(isSignupIntent('super_admin')).toBe(false);
  });

  it('rejects typos and casing variants', () => {
    expect(isSignupIntent('Customer')).toBe(false);
    expect(isSignupIntent('PROVIDER')).toBe(false);
    expect(isSignupIntent('staff')).toBe(false);
    expect(isSignupIntent('staff_req')).toBe(false);
  });

  it('rejects non-string values defensively', () => {
    expect(isSignupIntent(undefined)).toBe(false);
    expect(isSignupIntent(null)).toBe(false);
    expect(isSignupIntent(0 as any)).toBe(false);
    expect(isSignupIntent({} as any)).toBe(false);
    expect(isSignupIntent([] as any)).toBe(false);
  });
});

describe('INTENT_DEFAULT_DESTINATION — placeholder pre-decider routes', () => {
  it('maps every intent to a placeholder URL', () => {
    for (const intent of ALL_SIGNUP_INTENTS) {
      const dest = INTENT_DEFAULT_DESTINATION[intent as SignupIntent];
      expect(typeof dest).toBe('string');
      expect(dest.startsWith('/')).toBe(true);
    }
  });

  it('K9000 / kiosk / Nayax are NOT in this map (kiosks are not booked)', () => {
    const all = Object.values(INTENT_DEFAULT_DESTINATION);
    expect(all.some(d => d.includes('k9000'))).toBe(false);
    expect(all.some(d => d.includes('kiosk'))).toBe(false);
  });
});
