/**
 * CEO 2026-08-29 P0-2 / P0-3 / §12 §18 — second-wave hotfix
 * hardening invariants.
 *
 * PR #2169 landed the extraction. This suite pins:
 *   * critical-route-browser-canary.spec.ts covers the exact §4
 *     fail-pattern set and asserts REAL UI proof selectors (§5)
 *   * verify-dist-manifest walks the TRANSITIVE Vite build graph
 *     (§7 §8) — not just the assets referenced by index.html
 *   * vite.config.ts emits build.manifest (required by the graph
 *     walker)
 *   * AuthRouteErrorBoundary + /api/errors/log wire release-info
 *     comparison so every crash carries a classification (§12 §18)
 *
 * Every assertion is source-anchored so a refactor that quietly
 * loosened one of these guards trips CI before shipping.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const REPO = path.resolve(__dirname, '..', '..');

const CANARY = fs.readFileSync(
  path.join(REPO, 'tests', 'e2e', 'critical-route-browser-canary.spec.ts'),
  'utf8',
);
const VERIFY = fs.readFileSync(
  path.join(REPO, 'scripts', 'verify-dist-manifest.ts'),
  'utf8',
);
const VITE = fs.readFileSync(
  path.join(REPO, 'vite.config.ts'),
  'utf8',
);
const BOUNDARY = fs.readFileSync(
  path.join(REPO, 'client', 'src', 'components', 'AuthRouteErrorBoundary.tsx'),
  'utf8',
);
const ROUTES = fs.readFileSync(
  path.join(REPO, 'server', 'routes.ts'),
  'utf8',
);

describe('critical-route-browser-canary.spec.ts (CEO §4 §5 §6)', () => {
  it('exercises the exact §4 fail-pattern set — nothing missing', () => {
    for (const fragment of [
      "Cannot read properties of undefined",
      "reading ['\"]default['\"]",
      "ChunkLoadError",
      "Failed to fetch dynamically imported module",
      "error loading dynamically imported",
      "Importing a module script failed",
      "module script failed",
      "Loading chunk",
      "Loading CSS chunk",
      "vite:preloadError",
    ]) {
      expect(CANARY, `canary missing pattern: ${fragment}`).toContain(fragment);
    }
  });

  it('drives EVERY route the CEO §4 §5 named — signed-out safe versions of protected routes included', () => {
    for (const p of [
      "'/'",
      "'/signin'",
      "'/sign-in'",
      "'/login'",
      "'/signup'",
      "'/signup?flow=provider'",
      "'/signup?flow=prestige'",
      "'/pet-parent/home'",
      "'/provider/home'",
      "'/my-account'",
      "'/account/transactions'",
    ]) {
      expect(CANARY, `canary missing route: ${p}`).toContain(p);
    }
  });

  it('asserts real UI proof selectors — NOT just HTTP 200 (§5)', () => {
    // The proof selector waits for actual sign-in / sign-up form or
    // a mounted home. HTTP 200 alone cannot prove the SPA rendered.
    expect(CANARY).toMatch(/const AUTH_PROOF =/);
    expect(CANARY).toMatch(/waitForSelector\(spec\.proofSelector/);
  });

  it('FAILS when AuthRouteErrorBoundary rendered (§5 — recovery UX is not a healthy render)', () => {
    expect(CANARY).toMatch(/data-testid="auth-boundary-fallback"/);
    expect(CANARY).toMatch(/AuthRouteErrorBoundary rendered — the real page did not mount/);
  });

  it('records pageerror / console.error / requestfailed / 5xx / unhandledrejection (§4)', () => {
    expect(CANARY).toMatch(/page\.on\('pageerror'/);
    expect(CANARY).toMatch(/page\.on\('console'/);
    expect(CANARY).toMatch(/page\.on\('response'/);
    expect(CANARY).toMatch(/page\.on\('requestfailed'/);
    expect(CANARY).toMatch(/window\.addEventListener\('unhandledrejection'/);
  });

  it('probes /api/release-info so a stale-client vs current-defect classification is possible', () => {
    expect(CANARY).toMatch(/\/api\/release-info/);
    expect(CANARY).toMatch(/releaseBuildId/);
  });
});

describe('verify-dist-manifest — transitive Vite graph walker (CEO §7 §8)', () => {
  it('reads the Vite build manifest from .vite/manifest.json OR manifest.json', () => {
    expect(VERIFY).toMatch(/VITE_MANIFEST_CANDIDATES = \[/);
    expect(VERIFY).toContain("'.vite'");
    expect(VERIFY).toContain("'manifest.json'");
  });

  it('walks entry.file + entry.css + imports + dynamicImports for every manifest key', () => {
    // A refactor that skipped dynamicImports re-opens the exact
    // /signin failure mode.
    expect(VERIFY).toMatch(/entry\.file/);
    expect(VERIFY).toMatch(/entry\.css/);
    expect(VERIFY).toMatch(/entry\.imports/);
    expect(VERIFY).toMatch(/entry\.dynamicImports/);
  });

  it('FAILS the deploy when a manifest key referenced by imports is dangling', () => {
    expect(VERIFY).toMatch(/manifest key referenced by import graph is missing/);
  });

  it('FAILS the deploy when the Vite manifest itself is missing (§8)', () => {
    expect(VERIFY).toMatch(/Vite manifest not found \(expected build\.manifest=true\)/);
  });

  it('exits 1 when EITHER the HTML scan OR the graph walker finds a gap', () => {
    expect(VERIFY).toMatch(/if \(missing\.length > 0 \|\| graphMissing\.length > 0\)/);
    expect(VERIFY).toMatch(/process\.exit\(1\)/);
  });
});

describe('vite.config.ts (CEO §7)', () => {
  it('enables build.manifest so the graph walker has something to read', () => {
    // A refactor that turned this back off silently breaks the P0-3
    // guard.
    expect(VITE).toMatch(/manifest: true,/);
  });
});

describe('AuthRouteErrorBoundary — release-info classification (CEO §12 §18)', () => {
  it('probes /api/release-info before shipping the crash report', () => {
    expect(BOUNDARY).toMatch(/const rel = await fetch\('\/api\/release-info'/);
    expect(BOUNDARY).toMatch(/releaseClassification: classification/);
  });

  it('classifies as STALE_CLIENT_RELEASE_MISMATCH or CURRENT_RELEASE_RUNTIME_DEFECT', () => {
    expect(BOUNDARY).toMatch(/'STALE_CLIENT_RELEASE_MISMATCH'/);
    expect(BOUNDARY).toMatch(/'CURRENT_RELEASE_RUNTIME_DEFECT'/);
    // Fallback when either id is unknown.
    expect(BOUNDARY).toMatch(/'UNKNOWN_RELEASE'/);
  });

  it('release-info probe has a bounded timeout — a slow server cannot delay the crash report', () => {
    expect(BOUNDARY).toMatch(/const ctrl = new AbortController\(\);/);
    expect(BOUNDARY).toMatch(/setTimeout\(\(\) => ctrl\.abort\(\), 2500\)/);
  });

  it('/api/errors/log records the classification alongside the fingerprint', () => {
    expect(ROUTES).toContain('serverBuildId: errorReport.serverBuildId');
    expect(ROUTES).toContain('gitSha: errorReport.gitSha');
    expect(ROUTES).toContain('releaseClassification: errorReport.releaseClassification');
  });
});
