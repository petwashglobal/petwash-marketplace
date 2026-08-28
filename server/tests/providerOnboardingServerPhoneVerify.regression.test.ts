/**
 * Provider onboarding — server-authoritative phone verification.
 *
 * CEO 2026-08-28 §19/§43: "Client boolean is NEVER authority. Provider
 * onboarding reads canonical server verified identity capability.
 * Cannot manually POST phoneVerified=true."
 *
 * Until this commit server/routes/provider-onboarding.ts accepted
 * `phoneNumber` from FormData with no verification check — any actor
 * with a valid Firebase ID token could POST any phone string and
 * submit an application. Applicants entered the admin queue with
 * unverified contact numbers; on approval the marketplace stored
 * unverified provider phones on real bookings.
 *
 * The pin here is: the /apply handler MUST read a server-verified
 * phone truth (Firebase user.phone_number set OR
 * users.mobile_verified_at present) BEFORE accepting the submission,
 * and MUST fail-closed with PHONE_NOT_VERIFIED (400) if neither is
 * present. A refactor that removes the check trips CI.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes', 'provider-onboarding.ts'),
  'utf8',
);

describe('provider-onboarding — server-verified phone before /apply', () => {
  it('reads firebaseUser.phone_number as the primary authority', () => {
    // Firebase's own phone-provider path lands the number here — if the
    // user completed the OTP flow via Firebase Auth, the token itself
    // proves the verification. No DB read needed for that branch.
    expect(SRC).toMatch(/firebaseHasPhone = !!authenticatedUser\?\.phone_number/);
  });

  it('falls back to users.mobile_verified_at on the Postgres side', () => {
    // When a user verified via the /api/auth/phone-session flow the
    // Firebase user may not carry phone_number (custom-token mint), but
    // markMobileVerified stamps users.mobile_verified_at. Both paths
    // are set only by an authentic OTP round-trip — no client can
    // forge either.
    expect(SRC).toMatch(/mobileVerifiedAt:\s*users\.mobileVerifiedAt/);
    expect(SRC).toMatch(/postgresHasPhone = !!row\?\.mobileVerifiedAt/);
  });

  it('returns 400 PHONE_NOT_VERIFIED when neither authority sees a verified phone', () => {
    // Fail-closed. Applicant is routed back to /account/security to
    // verify — no silent-continue path.
    expect(SRC).toMatch(/if \(!firebaseHasPhone && !postgresHasPhone\)/);
    expect(SRC).toMatch(/errorCode:\s*['"]PHONE_NOT_VERIFIED['"]/);
    // The status is 400 (client-fixable state) not 401 (a valid Firebase
    // token IS present; the missing thing is the verified phone).
    expect(SRC).toMatch(/return res\.status\(400\)\.json\(\{[\s\S]*?PHONE_NOT_VERIFIED/);
  });

  it('fails safely on DB error — does NOT silently continue', () => {
    // If the lookup throws we do NOT let a swallow-warn path reopen
    // the bypass. Return 502 so the client retries deterministically.
    expect(SRC).toMatch(/errorCode:\s*['"]VERIFY_LOOKUP_FAILED['"]/);
    expect(SRC).toMatch(/return res\.status\(502\)/);
  });

  it('the check runs BEFORE the ID-number validation (so the applicant is bounced early)', () => {
    // Ordering matters: PHONE_NOT_VERIFIED should fire before we ask
    // the applicant for their Israeli ID / passport number, otherwise
    // they waste a form fill before hitting the block.
    const phoneCheckIdx = SRC.indexOf("errorCode: 'PHONE_NOT_VERIFIED'");
    const idNumberCheckIdx = SRC.indexOf("errorCode: 'ID_NUMBER_REQUIRED'");
    expect(phoneCheckIdx).toBeGreaterThan(0);
    expect(idNumberCheckIdx).toBeGreaterThan(0);
    expect(phoneCheckIdx).toBeLessThan(idNumberCheckIdx);
  });

  it('CEO §43 — /apply never reads phoneVerified from the request body (client boolean is not authority)', () => {
    // Defence-in-depth: a refactor that started trusting the client's
    // React state (or a body field named phoneVerified) would silently
    // reopen the bypass the fix at 42483a118 closed. Assert the whole
    // provider-onboarding.ts source never reads phoneVerified off any
    // body-shaped identifier.
    for (const pattern of [
      /req\.body\.phoneVerified/,
      /req\.body\?\.phoneVerified/,
      /\{[^}]*phoneVerified[^}]*\}\s*=\s*req\.body/,
    ]) {
      expect(SRC).not.toMatch(pattern);
    }
  });

  it('CEO §43 — authority read comes from Firebase user OR Postgres users.mobile_verified_at, both server-owned', () => {
    // Pin the two authoritative sources. A rename or drop of either
    // half re-opens the bypass on the surviving path.
    expect(SRC).toMatch(/firebaseHasPhone = !!authenticatedUser\?\.phone_number/);
    expect(SRC).toMatch(/users\.mobileVerifiedAt/);
    expect(SRC).toMatch(/postgresHasPhone = !!row\?\.mobileVerifiedAt/);
  });
});
