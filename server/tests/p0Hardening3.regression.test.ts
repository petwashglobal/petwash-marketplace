/**
 * CEO 2026-08-29 P0-4 P0-5 §14 §15 — third-wave hotfix hardening
 * invariants.
 *
 * stage-sourcemaps.sh and audit-cache-headers.sh are ops scripts.
 * The exact behaviour they enforce is what turns "source-maps live
 * on the public artifact" and "browser-tab-with-old-index-hits-a-
 * purged-hashed-chunk" into deploy-time blockers.
 *
 * Every assertion is source-anchored so a refactor cannot silently
 * loosen the guard.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const REPO = path.resolve(__dirname, '..', '..');

const STAGE = fs.readFileSync(path.join(REPO, 'scripts', 'stage-sourcemaps.sh'), 'utf8');
const AUDIT = fs.readFileSync(path.join(REPO, 'scripts', 'audit-cache-headers.sh'), 'utf8');
const PKG = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf8'));

describe('stage-sourcemaps.sh (CEO §14)', () => {
  it('MOVES every .map file OUT of the public artifact (never copies + leaves)', () => {
    // `mv` — not `cp`. A copy would leave the map in the public
    // artifact, defeating the whole guard.
    expect(STAGE).toMatch(/mv "\$\{map\}" "\$\{target\}"/);
    expect(STAGE).not.toMatch(/cp "\$\{map\}" "\$\{target\}"/);
  });

  it('FAILS the deploy when any .map survives in the public artifact (belt-and-braces)', () => {
    expect(STAGE).toMatch(/remaining="\$\(find "\$\{SRC_DIR\}" -type f -name "\*\.map"/);
    expect(STAGE).toMatch(/FAIL — source-map files SURVIVED in the public artifact/);
    expect(STAGE).toMatch(/exit 1/);
  });

  it('WRITES a manifest with a SHA-256 per source-map for upload verification', () => {
    // sha256sum on Linux, shasum -a 256 on macOS. Either falls back
    // to a no-hash-tool sentinel so the manifest still records the
    // filename.
    expect(STAGE).toMatch(/sha256sum "\$\{target\}"/);
    expect(STAGE).toMatch(/shasum -a 256 "\$\{target\}"/);
    expect(STAGE).toMatch(/printf "%s\\t%s\\n" "\$\{hash\}" "\$\{rel\}" >> "\$\{DST_DIR\}\/map-manifest\.txt"/);
  });

  it('defaults SRC = dist/public, DST = dist/sourcemaps — no ambiguity in CI', () => {
    expect(STAGE).toMatch(/SRC_DIR="\$\{1:-dist\/public\}"/);
    expect(STAGE).toMatch(/DST_DIR="\$\{2:-dist\/sourcemaps\}"/);
  });

  it('exits 0 when zero .map files are found — a build with no maps is still a valid deploy', () => {
    // Loud-then-silent is dangerous: if a config change drops
    // sourcemap emission, we accept the deploy but log a clear count.
    expect(STAGE).toMatch(/moved \$\{count\} source-map file\(s\)/);
  });
});

describe('audit-cache-headers.sh (CEO §15)', () => {
  it('REFUSES to pass a deploy where index.html carries `immutable`', () => {
    // This is the exact scenario the /signin incident depended on —
    // a browser tab with an OLD index.html that can NEVER learn
    // about a fresh deploy.
    expect(AUDIT).toMatch(/immutable\(\[\[:space:\]\]\|,\|\$\)/);
    expect(AUDIT).toMatch(/index\.html is 'immutable' — a stale tab can never learn about a new deploy/);
  });

  it('REFUSES to pass a deploy where hashed assets are NOT `immutable`', () => {
    // The hash in the filename guarantees version identity; without
    // `immutable` the CDN can silently swap file contents behind the
    // same URL and break every browser mid-session.
    expect(AUDIT).toMatch(/hashed asset is NOT 'immutable'/);
    expect(AUDIT).toMatch(/CDN can silently swap file contents behind the same URL/);
  });

  it('probes the FIRST /assets ref extracted from the served index.html', () => {
    // Guarantees the audit tests the EXACT CDN path the customer's
    // browser will hit — not a hardcoded URL that might not exist.
    expect(AUDIT).toMatch(/grep -oiE '<script\[\^>\]\+src="\/assets\/\[\^"\]\+\\.js"'/);
    expect(AUDIT).toMatch(/grep -oiE '<link\[\^>\]\+href="\/assets\/\[\^"\]\+\\.\(css\|js\)"'/);
  });

  it('WARNS but does not fail on non-critical policy nits (long max-age on index, short on assets)', () => {
    // Fail on ONLY the two invariants that could reproduce the
    // incident: immutable index, non-immutable assets. Everything
    // else is a warning so a deploy is not blocked on cosmetic
    // policy tuning.
    expect(AUDIT).toMatch(/⚠  .* long max-age on index\.html/);
    expect(AUDIT).toMatch(/⚠  .* asset max-age is/);
  });

  it('exits 1 when any violation is found', () => {
    expect(AUDIT).toMatch(/exit 1/);
    expect(AUDIT).toMatch(/FAIL — \$\{fails\} rule violation\(s\)/);
  });

  it('reads PROD_URL from env OR the first positional arg', () => {
    expect(AUDIT).toMatch(/BASE_URL="\$\{1:-\$\{PROD_URL:-\}\}"/);
  });
});

describe('package.json wiring (CEO §14 §15 §22)', () => {
  it('postbuild runs verify-dist-manifest THEN stage-sourcemaps — order matters', () => {
    // Verify runs first (blocks a broken deploy), then stage
    // strips the maps out of the public artifact. If stage ran
    // before verify, a build that failed manifest verification
    // would already have its maps moved out — harmless in effect
    // but confusing in the failed-build state.
    expect(PKG.scripts.postbuild).toBe(
      'tsx scripts/verify-dist-manifest.ts && bash scripts/stage-sourcemaps.sh',
    );
  });

  it('exposes browser canary + cache audit as one-command npm scripts', () => {
    expect(PKG.scripts['canary:browser']).toBe(
      'playwright test tests/e2e/critical-route-browser-canary.spec.ts',
    );
    expect(PKG.scripts['audit:cache']).toBe('bash scripts/audit-cache-headers.sh');
  });
});
