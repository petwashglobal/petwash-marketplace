/**
 * CEO MASTER 2026-08-28 P0 runbook §10 §15 §20 §26 — deploy-hardening
 * script invariants.
 *
 * verify-dist-manifest and critical-route-canary are safety scripts.
 * The exact behaviour they enforce is what the /signin incident
 * turned into a rule; these tests pin the invariants so a refactor
 * cannot silently loosen the guard.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const VERIFY = fs.readFileSync(
  path.resolve(__dirname, '..', '..', 'scripts', 'verify-dist-manifest.ts'),
  'utf8',
);
const CANARY = fs.readFileSync(
  path.resolve(__dirname, '..', '..', 'scripts', 'critical-route-canary.sh'),
  'utf8',
);
const PKG = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '..', '..', 'package.json'), 'utf8'),
);

describe('verify-dist-manifest.ts (CEO §10 §20)', () => {
  it('parses both <script src> and <link rel=... href=...> references', () => {
    // Both attribute orderings matter — Vite may emit either.
    expect(VERIFY).toMatch(/const scriptRe = \/<script\[\^>\]\*\\bsrc="\(\[\^"\]\+\)"/);
    expect(VERIFY).toMatch(/const linkRe = \/<link\[\^>\]\*\\brel="\(\[\^"\]\+\)"\[\^>\]\*\\bhref="/);
    expect(VERIFY).toMatch(/const linkRe2 = \/<link\[\^>\]\*\\bhref="\(\[\^"\]\+\)"\[\^>\]\*\\brel="/);
  });

  it('EXITS 1 when any local asset is missing on disk', () => {
    // The DEPLOY BLOCKER — a missing hashed asset is exactly the
    // /signin incident cause. A refactor that turned this into a
    // warn or exit 0 re-opens the hole.
    expect(VERIFY).toMatch(/process\.exit\(1\)/);
    expect(VERIFY).toMatch(/DO NOT DEPLOY/);
  });

  it('treats external URLs (fonts.googleapis, apis.google) as ok — CDN references are not our concern', () => {
    expect(VERIFY).toMatch(/function isLocal\(url: string\): boolean \{\s*\n\s*return url\.startsWith\('\/'\) && !url\.startsWith\('\/\/'\);/);
    expect(VERIFY).toMatch(/results\.push\(\{ ref, ok: true, onDisk: '\(external\)' \}\);/);
  });

  it('logs the missing asset URL AND the expected on-disk path', () => {
    // Operator's ONLY way to fix a failing verify is knowing
    // exactly which chunk vanished + where the packager expected
    // it. Log both.
    expect(VERIFY).toMatch(/console\.error\(`  \$\{r\.ref\.url\}  →  expected at \$\{r\.onDisk\}`\);/);
  });

  it('MISSING index.html itself fails hard (build did not finish)', () => {
    expect(VERIFY).toMatch(/MISSING dist\/public\/index\.html/);
    expect(VERIFY).toMatch(/did the build finish/);
  });
});

describe('critical-route-canary.sh (CEO §15 §26)', () => {
  it('enumerates the CEO §15 critical route set — nothing missing', () => {
    // A refactor that dropped /signin from the canary silently
    // removes the very guard that caught this incident.
    for (const r of [
      '"/"',
      '"/signin"',
      '"/sign-in"',
      '"/login"',
      '"/signup"',
      '"/pet-parent/home"',
      '"/provider/home"',
      '"/my-account"',
      '"/account/transactions"',
    ]) {
      expect(CANARY, `canary missing ${r}`).toContain(r);
    }
  });

  it('scans the response body for the exact P0 fingerprint (reading default / lazy chunk)', () => {
    // Never let the SIGN-IN incident string reach a customer
    // silently. If the canary body carries the pattern, fail.
    expect(CANARY).toMatch(/FAIL_FINGERPRINT_RE=".*reading 'default'.*Cannot read properties of undefined.*ChunkLoadError.*Loading chunk/);
  });

  it('accepts 200 OR any 30x redirect — protected routes may bounce to /signin', () => {
    expect(CANARY).toMatch(/301\|302\|303\|307\|308/);
  });

  it('EXITS 1 when any route is unhealthy', () => {
    expect(CANARY).toMatch(/exit 1/);
    expect(CANARY).toMatch(/FAIL — one or more critical routes unhealthy/);
  });

  it('has a per-request timeout so a slow host cannot hang the canary forever', () => {
    expect(CANARY).toMatch(/TIMEOUT="\$\{TIMEOUT:-10\}"/);
    expect(CANARY).toMatch(/--max-time "\$\{TIMEOUT\}"/);
  });

  it('emits ONE line per route with ✓ / ✗ + route + http-code + body-size', () => {
    // Operator glance: 30-second answer to "did the last deploy
    // break /signin?"
    expect(CANARY).toMatch(/printf "  ✓  %-30s  %s  %sB\\n"/);
    expect(CANARY).toMatch(/printf "  ✗  %-30s  %s  %sB  %s\\n"/);
  });
});

describe('package.json wiring (CEO §10 §20)', () => {
  it('postbuild HOOK runs verify-dist-manifest — cannot be forgotten', () => {
    // A build without the verify step is exactly how a missing
    // chunk shipped. Coupling them at the npm-script layer means
    // `npm run build` and every deployer that calls it get the
    // guard automatically.
    expect(PKG.scripts.postbuild).toBe('tsx scripts/verify-dist-manifest.ts');
  });

  it('canary script is exposed as npm run canary — one command, no arg guessing', () => {
    expect(PKG.scripts.canary).toBe('bash scripts/critical-route-canary.sh');
  });
});
