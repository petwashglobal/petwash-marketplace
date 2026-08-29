/**
 * AUTH MASTER Lane F — defense-in-depth pin: /api/auth/session MUST
 * refuse the E2E Firebase test adapter's synthetic marker token with
 * a specific error code.
 *
 * The client-side probe (firebaseTestAdapterClient.ts) already
 * refuses to activate the shim in a production build. The Playwright
 * installer route()-intercepts the POST /api/auth/session so the
 * synthetic token never reaches a real server during tests. This pin
 * locks the final safety net: even if BOTH layers fail and the
 * synthetic token arrives at production, the server refuses it with
 * a glaring log line rather than passing it to verifyIdToken() and
 * hoping for a generic auth/invalid-id-token rejection.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes.ts'),
  'utf8',
);

describe('AUTH MASTER Lane F — synthetic-token refusal on /api/auth/session', () => {
  it('rejects any idToken starting with the synthetic marker', () => {
    // Anchored on the exact prefix the client probe validates.
    expect(SRC).toMatch(/idToken\.startsWith\('synthetic-id-token::'\)/);
  });

  it('uses a distinct errorCode so log alerts can pattern-match', () => {
    expect(SRC).toMatch(/SYNTHETIC_TEST_TOKEN_REFUSED/);
  });

  it('logs at ERROR level (not warn) — this event is a hard alert', () => {
    // If we ever downgrade this to warn, on-call misses a leak.
    expect(SRC).toMatch(
      /logger\.error\([^\n]*Refusing synthetic test-adapter token/,
    );
  });

  it('runs the check BEFORE verifyIdToken (guard on empty-token check)', () => {
    // The synthetic-token guard must sit between the MISSING_TOKEN
    // check and the verifyIdToken call, so a synthetic token never
    // hits Firebase Admin (which would burn quota + produce a noisy
    // generic error).
    const emptyIdx = SRC.indexOf("errorCode: 'MISSING_TOKEN'");
    const synthIdx = SRC.indexOf("SYNTHETIC_TEST_TOKEN_REFUSED");
    const verifyIdx = SRC.indexOf('fbAdminAuth.verifyIdToken(idToken, true)');
    expect(emptyIdx).toBeGreaterThan(0);
    expect(synthIdx).toBeGreaterThan(emptyIdx);
    expect(verifyIdx).toBeGreaterThan(synthIdx);
  });

  it('returns 400, not 401 — client cannot retry with a "refresh token" recovery', () => {
    // A 401 would trigger client-side token-refresh flows. This
    // token is fundamentally not-a-JWT — 400 tells the client to
    // stop retrying and fix its inputs.
    expect(SRC).toMatch(
      /SYNTHETIC_TEST_TOKEN_REFUSED[\s\S]{0,20}\}\);/,
    );
    // Belt: the return statement uses status(400)
    const block = SRC.slice(
      SRC.indexOf('Refusing synthetic'),
      SRC.indexOf('SYNTHETIC_TEST_TOKEN_REFUSED') + 100,
    );
    expect(block).toMatch(/status\(400\)/);
  });
});
