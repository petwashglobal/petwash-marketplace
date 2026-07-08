/**
 * create-profile 18+ floor + rate limiter — regression pins (2026-07-08).
 *
 * Launch-readiness / KYC sweep: POST /api/users/create-profile (the social /
 * profile-completion account-mint endpoint) had two gaps vs its /api/auth/*
 * siblings:
 *   1. NO rate limiter — an open door for automated account-farming.
 *   2. Its age check rejected only under-13, while PetWash is an 18+ marketplace
 *      and the phone/email rails already reject under-18 (checkSignupAge).
 *
 * Fixes: authLimiter added; the DOB age floor raised 13 → 18. (Social sign-in
 * still attests 18+ via checkbox rather than a verified DOB — strengthening that
 * to a required birthdate is a separate product/conversion decision, flagged not
 * forced.)
 *
 * Source-level pins (same style as credit-wallet-confirm-idor.test.ts).
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const ROUTES = fs.readFileSync(path.resolve(__dirname, '..', 'routes.ts'), 'utf8');

describe('create-profile 18+ floor + rate limit (2026-07-08)', () => {
  it('the account-mint endpoint is rate-limited (authLimiter)', () => {
    expect(ROUTES).toMatch(/app\.post\('\/api\/users\/create-profile',\s*authLimiter,/);
  });

  it('the age floor is 18, not 13', () => {
    expect(ROUTES).toMatch(/if \(age < 18\) validationErrors\.push\('You must be at least 18 years old'\)/);
    expect(ROUTES).not.toMatch(/if \(age < 13\)/);
  });
});
