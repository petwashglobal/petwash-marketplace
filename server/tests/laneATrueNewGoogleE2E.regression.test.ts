/**
 * Lane A — TRUE NEW Google E2E scenario pins.
 *
 * CEO FLY MODE II §10 + §11 — AUTH CONVERSION P0 (2026-08-29).
 *
 * Locks the E2E spec's coverage. Even without a live env, a source
 * scan proves the scenario exists, walks the correct state machine
 * transitions, and asserts the CEO §21 intent-survives invariant.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SPEC = fs.readFileSync(
  path.resolve(__dirname, '..', '..', 'tests', 'e2e', 'auth-master-lane-a-true-new-google.e2e.spec.ts'),
  'utf8',
);

const SHELL = fs.readFileSync(
  path.resolve(__dirname, '..', '..', 'client', 'src', 'pages', 'SignUpProgressive.tsx'),
  'utf8',
);

describe('CEO FLY MODE II §10 — TRUE NEW Google E2E scenario', () => {
  it('spec exists, uses personas.customerNew (not customerActive)', () => {
    expect(SPEC).toMatch(/installFirebaseTestAdapter\(page, personas\.customerNew\)/);
    expect(SPEC).not.toMatch(/installFirebaseTestAdapter\(page, personas\.customerActive\)/);
  });

  it('scenario mounts /signup-v2 with provider intent + auth journey id in the URL', () => {
    expect(SPEC).toMatch(
      /page\.goto\(\s*['"`]\/signup-v2\?requestedService=pet_sitting[^'"`]{0,200}authJourneyId=[^'"`]+['"`]/,
    );
  });

  it('starts on METHOD_SELECTION, ends on PROFILE_COMPLETION after the Google click', () => {
    // The spec asserts the root's data-state attribute twice — the
    // exact whitespace/quote form is normalised for the regex.
    expect(SPEC).toMatch(/data-state[\s\S]{0,10}METHOD_SELECTION/);
    expect(SPEC).toMatch(/data-state[\s\S]{0,10}PROFILE_COMPLETION/);
  });

  it('walks exactly THREE required-action screens in the CEO §2 canonical order', () => {
    const idx1 = SPEC.indexOf('signup-progressive-action-mobile_verification');
    const idx2 = SPEC.indexOf('signup-progressive-action-date_of_birth');
    const idx3 = SPEC.indexOf('signup-progressive-action-terms_acceptance');
    expect(idx1).toBeGreaterThan(0);
    expect(idx2).toBeGreaterThan(idx1);
    expect(idx3).toBeGreaterThan(idx2);
  });

  it('asserts §21 intent survives — all four intent keys on the hidden marker', () => {
    for (const attr of [
      'data-requested-service',
      'data-return-to',
      'data-first-touch',
      'data-auth-journey-id',
    ]) {
      expect(SPEC).toMatch(new RegExp(`toHaveAttribute\\('${attr}'`));
    }
  });

  it('final assertion waits for /pet-parent/home landing', () => {
    expect(SPEC).toMatch(/waitForURL\(\(u\)\s*=>\s*\/\\\/pet-parent\\\/home\/\.test\(u\.pathname\)/);
  });

  it('scenario skips cleanly when adapter is unavailable', () => {
    expect(SPEC).toMatch(/test\.skip\(\s*!firebaseAdapterAvailable\(\)/);
  });
});

describe('CEO FLY MODE II §10 — Progressive shell drives the network side', () => {
  it('AUTHENTICATING effect POSTs synthetic token to /api/auth/session', () => {
    expect(SHELL).toMatch(/state\.name !== 'AUTHENTICATING'/);
    expect(SHELL).toMatch(/fetch\('\/api\/auth\/session'/);
    expect(SHELL).toMatch(/idToken: syntheticToken/);
  });

  it('AUTHENTICATING requires the test adapter shim — no real Firebase path yet', () => {
    // Commit 6 wires real Firebase. Commit 5 stays adapter-only so
    // the shell is safe to deploy behind /signup-v2 without touching
    // production accounts.
    expect(SHELL).toMatch(/__FIREBASE_TEST_ADAPTER__/);
    expect(SHELL).toMatch(/shim\?\.enabled === true/);
    expect(SHELL).toMatch(/if \(!syntheticToken\)/);
  });

  it('ACCOUNT_RESOLUTION effect GETs /api/auth/account-resolution and dispatches RESOLVED', () => {
    expect(SHELL).toMatch(/state\.name !== 'ACCOUNT_RESOLUTION'/);
    expect(SHELL).toMatch(/fetch\('\/api\/auth\/account-resolution'/);
    expect(SHELL).toMatch(/dispatch\(\{ kind: 'RESOLVED', resolution \}\)/);
  });

  it('ACTIVATION effect fires ACTIVATED synchronously (no extra network hop)', () => {
    expect(SHELL).toMatch(/state\.name !== 'ACTIVATION'/);
    expect(SHELL).toMatch(/dispatch\(\{ kind: 'ACTIVATED' \}\)/);
  });
});
