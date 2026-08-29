/**
 * AUTH MASTER Lane F — Firebase test adapter scaffold pins.
 *
 * The adapter is a dev-only surface with strict install refusals. If
 * any of these invariants regress, an E2E harness can silently ship a
 * production-touching bypass into the wild — so they are source-anchored
 * pins, not runtime tests.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', '..', 'tests', 'e2e', 'firebaseTestAdapter.ts'),
  'utf8',
);

describe('AUTH MASTER Lane F — Firebase test adapter contract', () => {
  it('exports the persona catalog', () => {
    expect(SRC).toMatch(/export const personas = \{/);
    // Five personas required for the CTA→gate→onboarding matrix.
    for (const key of [
      'customerActive',
      'providerActive',
      'providerPending',
      'staffActive',
      'adminActive',
    ]) {
      expect(SRC).toMatch(new RegExp(`\\b${key}\\b`));
    }
  });

  it('exports installFirebaseTestAdapter, uninstall, and availability probe', () => {
    expect(SRC).toMatch(/export async function installFirebaseTestAdapter/);
    expect(SRC).toMatch(/export async function uninstallFirebaseTestAdapter/);
    expect(SRC).toMatch(/export function firebaseAdapterAvailable/);
  });

  it('refuses to install without TEST_BYPASS_TOKEN', () => {
    // The install path must throw when the shared bypass secret is
    // absent — the pin is worded loosely so a refactor can change the
    // message without breaking the guarantee.
    expect(SRC).toMatch(
      /if \(!process\.env\.TEST_BYPASS_TOKEN\) \{[\s\S]*throw new Error\(/,
    );
  });

  it('refuses to install against a production BASE_URL', () => {
    expect(SRC).toMatch(/isProductionUrl/);
    // Both apex + www variants must be recognized.
    expect(SRC).toMatch(/'petwash\.co\.il'/);
    expect(SRC).toMatch(/'www\.petwash\.co\.il'/);
    expect(SRC).toMatch(/refusing to install: BASE_URL points at production/);
  });

  it('installs the shim via page.addInitScript BEFORE any page script runs', () => {
    expect(SRC).toMatch(/page\.addInitScript/);
    expect(SRC).toMatch(/__FIREBASE_TEST_ADAPTER__/);
    // The shim must carry an `enabled: true` flag the client can gate on
    // and the persona so client-side branches can read it.
    expect(SRC).toMatch(/enabled: true/);
  });

  it('intercepts /api/auth/session with a persona-shaped success', () => {
    expect(SRC).toMatch(/page\.route\(['"]\*\*\/api\/auth\/session['"]/);
    // The intercept must fulfill with 200 + user payload.
    expect(SRC).toMatch(/status: 200/);
    expect(SRC).toMatch(/source: 'firebase-test-adapter'/);
    // Marker cookie only — never a real signed session cookie.
    expect(SRC).toMatch(/pw_session_synthetic=/);
  });

  it('intercepts /api/auth/post-login with the persona canonical destination', () => {
    expect(SRC).toMatch(/page\.route\(['"]\*\*\/api\/auth\/post-login['"]/);
    expect(SRC).toMatch(/destination: persona\.canonicalDestination/);
  });

  it('customer persona canonical destination matches Lane C (/pet-parent/home)', () => {
    // Lane C nailed the canonical customer destination — the adapter's
    // persona catalog must not drift from it.
    expect(SRC).toMatch(
      /customerActive:[\s\S]{0,400}canonicalDestination: '\/pet-parent\/home'/,
    );
  });

  it('synthetic ID token is a marker string, NEVER a real JWT format', () => {
    // The adapter's fake token must be visibly non-JWT so a log scan or
    // a server-side check can spot it as a test artifact. If a
    // refactor accidentally makes it look like a JWT (three
    // dot-separated base64 chunks), the pin catches it.
    expect(SRC).toMatch(/synthetic-id-token::/);
  });

  it('documents Phase F2 boundary — client-side wiring lives outside this scaffold', () => {
    // The scaffold PR intentionally does NOT modify client code. The
    // pin locks the boundary so a future PR that widens Phase F1
    // stays honest about what it is doing.
    expect(SRC).toMatch(/Phase F2/);
    expect(SRC).toMatch(/import\.meta\.env\.DEV/);
  });
});
