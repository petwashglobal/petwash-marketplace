/**
 * AUTH MASTER Lane F — client-side probe guard pins.
 *
 * The client probe is the ONE place that reads the E2E shim from
 * window. Its fail-CLOSED guards are the last line of defense between
 * a mistakenly-installed shim and a real production credential path.
 * Source-anchored pins so a refactor cannot silently weaken them.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(
    __dirname,
    '..',
    '..',
    'client',
    'src',
    'lib',
    'firebaseTestAdapterClient.ts',
  ),
  'utf8',
);

describe('AUTH MASTER Lane F — firebaseTestAdapterClient guards', () => {
  it('exports getFirebaseTestAdapter + isFirebaseTestAdapterActive', () => {
    expect(SRC).toMatch(/export function getFirebaseTestAdapter/);
    expect(SRC).toMatch(/export function isFirebaseTestAdapterActive/);
  });

  it('has the Vite DEV compile-time guard as the FIRST check', () => {
    // Order matters: DEV must be checked FIRST so Vite can eliminate
    // the whole branch in production. If any other check comes first
    // the tree-shake may fail.
    expect(SRC).toMatch(/if \(!import\.meta\.env\.DEV\) return null;/);
    // Belt + suspenders: PROD must also short-circuit.
    expect(SRC).toMatch(/if \(import\.meta\.env\.PROD\) return null;/);
  });

  it('requires shim.enabled === true (strict equality)', () => {
    // Any truthy-but-not-true value must NOT enable the shortcut.
    expect(SRC).toMatch(/raw\.enabled !== true/);
  });

  it('pins the shim contract version', () => {
    expect(SRC).toMatch(/raw\.version !== 1/);
  });

  it('validates the synthetic ID token format', () => {
    // The token must start with the harness marker — any other prefix
    // means the shim is speaking a different dialect or (worse) a
    // real token has been placed in the shim slot.
    expect(SRC).toMatch(/synthetic-id-token::/);
    expect(SRC).toMatch(/startsWith\('synthetic-id-token::'\)/);
  });

  it('has an SSR/worker guard for typeof window', () => {
    expect(SRC).toMatch(/typeof window === 'undefined'/);
  });

  it('swallows any exception as "no adapter" (fail-CLOSED)', () => {
    expect(SRC).toMatch(/\} catch \{[\s\S]{0,80}return null;[\s\S]{0,20}\}/);
  });

  it('never imports from firebase — the probe must not pull the SDK in', () => {
    // A regression that adds `import ... from "firebase/..."` here
    // would pull the real Firebase SDK into any bundle that touches
    // the probe. The probe is a pure window read.
    expect(SRC).not.toMatch(/from ['"]firebase\//);
  });
});
