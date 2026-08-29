/**
 * CEO FLY MODE II §8 (2026-08-29) — pin the postbuild leak gate script
 * so its forbidden-marker list cannot drift and its build-pipeline
 * wire cannot be quietly removed.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const ROOT = path.resolve(__dirname, '..', '..');

const SCRIPT = fs.readFileSync(
  path.resolve(ROOT, 'scripts', 'check-no-test-adapter-leak.mjs'),
  'utf8',
);

const PKG = JSON.parse(
  fs.readFileSync(path.resolve(ROOT, 'package.json'), 'utf8'),
);

describe('CEO FLY MODE II §8 — postbuild test-adapter leak gate', () => {
  it('scans dist/public — the Vite client-bundle output', () => {
    expect(SCRIPT).toMatch(/dist['"], ['"]public/);
  });

  it('forbidden markers cover shim, token, and every public helper name', () => {
    for (const marker of [
      '__FIREBASE_TEST_ADAPTER__',
      'synthetic-id-token::',
      'FirebaseTestAdapterShim',
      'getFirebaseTestAdapter',
      'isFirebaseTestAdapterActive',
      'installFirebaseTestAdapter',
    ]) {
      expect(SCRIPT).toContain(marker);
    }
  });

  it('scans .js / .mjs / .cjs / .html / .map extensions', () => {
    for (const ext of ["'.js'", "'.mjs'", "'.cjs'", "'.html'", "'.map'"]) {
      expect(SCRIPT).toContain(ext);
    }
  });

  it('exits with a NON-ZERO code when a marker is found', () => {
    expect(SCRIPT).toMatch(/process\.exit\(1\)/);
  });

  it('exits 2 when the dist directory is missing (build was not run)', () => {
    expect(SCRIPT).toMatch(/process\.exit\(2\)/);
  });

  it('is wired into npm run build', () => {
    expect(PKG.scripts.build).toContain('check-no-test-adapter-leak.mjs');
    // The scanner must run AFTER vite build — a scanner-first order
    // would report on stale dist bytes from the previous build.
    expect(PKG.scripts.build).toMatch(
      /vite build[\s\S]*&&[\s\S]*check-no-test-adapter-leak/,
    );
  });
});
