/**
 * CEO FLY MODE II §14 + §17 (2026-08-29) — /api/privilege/link + register
 * deprecation-telemetry pins.
 *
 * Source-anchored so a refactor cannot silently drop the
 * §15 rule ("BOTH email + email_verified read from the decoded auth
 * context — NEVER from the request body"), the auth requirement, or
 * the deprecation telemetry on the anonymous /register path.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes', 'privilege-loyalty.ts'),
  'utf8',
);

describe('CEO FLY MODE II §14 + §17 — /api/privilege/link', () => {
  it('exposes POST /link', () => {
    expect(SRC).toMatch(/router\.post\('\/link'/);
  });

  it('requires auth — returns 401 AUTHENTICATION_REQUIRED when no session/bearer', () => {
    // The /link handler must never accept identity from the request body.
    expect(SRC).toMatch(/AUTHENTICATION_REQUIRED/);
    expect(SRC).toMatch(/return res\.status\(401\)/);
  });

  it('accepts both session-cookie and Bearer ID token', () => {
    const linkIdx = SRC.indexOf("router.post('/link'");
    const block = SRC.slice(linkIdx, linkIdx + 3000);
    expect(block).toMatch(/verifySessionCookie/);
    expect(block).toMatch(/fbAdminAuth\.verifyIdToken\(bearerToken, true\)/);
  });

  it('reads email + email_verified from the DECODED auth context, never from body', () => {
    const linkIdx = SRC.indexOf("router.post('/link'");
    const block = SRC.slice(linkIdx, linkIdx + 3000);
    // The decoded token exposes .email and .email_verified — verify
    // BOTH are what the service call receives.
    // Object shorthand OR explicit — both are fine as long as the
    // service call receives the auth-context values by name.
    expect(block).toMatch(/emailFromAuthContext[,:]/);
    expect(block).toMatch(/emailVerified[,:]/);
    expect(block).toMatch(/decoded\.email_verified === true/);
    // Explicit refusal-of-body-field: no req.body.email path.
    expect(block).not.toMatch(/req\.body\.email/);
    expect(block).not.toMatch(/req\.body\.firebaseUid/);
    expect(block).not.toMatch(/req\.body\.uid/);
  });

  it('maps every NoLinkReason to an HTTP status distinct from 200', () => {
    // NO_LEGACY_MEMBER → 404, EMAIL_NOT_VERIFIED / MISSING_EMAIL → 400,
    // UID_ALREADY_… / MEMBER_ALREADY_… → 409, RACE_ON_LINK → 409+retryable,
    // MISSING_UID → 401, LOOKUP_FAILED → 503.
    for (const marker of [
      "res.status(404)",
      "res.status(400)",
      "res.status(409)",
      "res.status(401)",
      "res.status(503)",
    ]) {
      expect(SRC).toContain(marker);
    }
    // RACE_ON_LINK is explicitly flagged retryable so the client can retry.
    // Multi-line: the 409 return may split reason/retryable across lines.
    expect(SRC).toMatch(/RACE_ON_LINK[\s\S]{0,120}retryable: true/);
  });

  it('happy path returns 200 with outcome + memberId + firebaseUid', () => {
    const linkIdx = SRC.indexOf("router.post('/link'");
    const block = SRC.slice(linkIdx, linkIdx + 3000);
    expect(block).toMatch(/status\(200\)[\s\S]{0,200}outcome: result\.outcome/);
    expect(block).toMatch(/memberId: result\.memberId/);
    expect(block).toMatch(/firebaseUid: result\.firebaseUid/);
  });
});

describe('CEO FLY MODE II §17 — /register deprecation telemetry on the anon path', () => {
  it('records a deprecation beacon on ANONYMOUS /register hits', () => {
    // Look at the /register handler prelude — the recordDeprecationHit
    // call must sit under a "no session cookie AND no bearer" guard.
    const registerIdx = SRC.indexOf("router.post('/register'");
    const block = SRC.slice(registerIdx, registerIdx + 2000);
    expect(block).toMatch(/if \(!hasBearer && !hasSessionCookie\)/);
    expect(block).toMatch(/recordDeprecationHit\(req, '\/api\/privilege\/register:anonymous'\)/);
  });

  it('telemetry never breaks the handler — swallowed in try/catch', () => {
    const registerIdx = SRC.indexOf("router.post('/register'");
    const block = SRC.slice(registerIdx, registerIdx + 2000);
    // A telemetry crash must not 500 the enrolment.
    expect(block).toMatch(/try \{[\s\S]{0,200}recordDeprecationHit[\s\S]{0,200}\} catch/);
  });

  it('the AUTHENTICATED path does NOT emit the anonymous beacon', () => {
    // The if-guard `if (!hasBearer && !hasSessionCookie)` guarantees
    // the beacon only fires on true anonymous hits. This pin is
    // structural — it locks that the check is not accidentally
    // inverted to fire on every request.
    const registerIdx = SRC.indexOf("router.post('/register'");
    const block = SRC.slice(registerIdx, registerIdx + 2000);
    // The line must be `!hasBearer && !hasSessionCookie`, not the
    // inverse `hasBearer || hasSessionCookie` or an unconditional call.
    expect(block).toMatch(/if \(!hasBearer && !hasSessionCookie\)/);
    // The beacon must appear inside that block — count the marker.
    const anonBeacons = (block.match(/api\/privilege\/register:anonymous/g) || []).length;
    expect(anonBeacons).toBe(1);
  });
});
