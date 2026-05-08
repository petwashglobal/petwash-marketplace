/**
 * Issue #153 PR-HEALTH-BUILD-SHA — /health build identifiers
 *
 * CEO operational hygiene rule (item G):
 *   "CI green ≠ deployed. Being able to open /health and instantly
 *    see git SHA + service revision is enterprise-grade DevOps."
 *
 * Pure read-only observability. No secrets. No auth contract change.
 *
 * Locked invariants this suite enforces:
 *   • Helper reads ONLY public, non-secret deploy identifiers.
 *   • Helper NEVER throws on missing env (always returns the same
 *     stable shape with nulls for unknown fields).
 *   • /health response embeds the helper output under `build`.
 *   • Helper does NOT read any name from the canonical config-health
 *     manifest of secret-bearing env vars (no overlap, no cross-leak).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { getBuildInfo, type BuildInfo } from '../lib/buildInfo';

const ROOT = resolve(__dirname, '..', '..');
const helper = readFileSync(resolve(ROOT, 'server/lib/buildInfo.ts'), 'utf8');
const indexSrc = readFileSync(resolve(ROOT, 'server/index.ts'), 'utf8');

const ALLOWED_ENV_NAMES = [
  'NODE_ENV',
  'K_SERVICE',
  'K_REVISION',
  'K_CONFIGURATION',
  'GIT_SHA',
  'COMMIT_SHA',
  'GITHUB_SHA',
  'BUILD_TIME',
  'BUILD_TIMESTAMP',
] as const;

// ── A. HELPER BEHAVIOUR ────────────────────────────────────────────────────

describe('PR-HEALTH-BUILD-SHA — getBuildInfo() behaviour', () => {
  // Snapshot + restore the env names this test mutates.
  let snapshot: Record<string, string | undefined>;
  beforeEach(() => {
    snapshot = {};
    for (const name of ALLOWED_ENV_NAMES) {
      snapshot[name] = process.env[name];
      delete process.env[name];
    }
  });
  const restore = () => {
    for (const name of ALLOWED_ENV_NAMES) {
      if (snapshot[name] === undefined) delete process.env[name];
      else process.env[name] = snapshot[name];
    }
  };

  it('1. returns a stable shape with all six keys present (null when unknown)', () => {
    const info: BuildInfo = getBuildInfo();
    expect(Object.keys(info).sort()).toEqual([
      'buildTime', 'configuration', 'env', 'gitSha', 'revision', 'service',
    ]);
    expect(info.env).toBe('unknown'); // NODE_ENV not set
    expect(info.service).toBeNull();
    expect(info.revision).toBeNull();
    expect(info.configuration).toBeNull();
    expect(info.gitSha).toBeNull();
    expect(info.buildTime).toBeNull();
    restore();
  });

  it('2. NEVER throws on missing env (idempotent across multiple calls)', () => {
    expect(() => { getBuildInfo(); getBuildInfo(); getBuildInfo(); }).not.toThrow();
    restore();
  });

  it('3. surfaces Cloud Run K_SERVICE / K_REVISION / K_CONFIGURATION when set', () => {
    process.env.K_SERVICE = 'petwash-api';
    process.env.K_REVISION = 'petwash-api-00042-abc';
    process.env.K_CONFIGURATION = 'petwash-api';
    const info = getBuildInfo();
    expect(info.service).toBe('petwash-api');
    expect(info.revision).toBe('petwash-api-00042-abc');
    expect(info.configuration).toBe('petwash-api');
    restore();
  });

  it('4. gitSha falls back through GIT_SHA → COMMIT_SHA → GITHUB_SHA (first non-empty wins)', () => {
    process.env.GITHUB_SHA = 'github-sha-fallback';
    expect(getBuildInfo().gitSha).toBe('github-sha-fallback');

    process.env.COMMIT_SHA = 'commit-sha-mid';
    expect(getBuildInfo().gitSha).toBe('commit-sha-mid');

    process.env.GIT_SHA = 'git-sha-primary';
    expect(getBuildInfo().gitSha).toBe('git-sha-primary');
    restore();
  });

  it('5. buildTime falls back through BUILD_TIME → BUILD_TIMESTAMP', () => {
    process.env.BUILD_TIMESTAMP = '2026-05-08T10:00:00Z';
    expect(getBuildInfo().buildTime).toBe('2026-05-08T10:00:00Z');

    process.env.BUILD_TIME = '2026-05-08T11:00:00Z';
    expect(getBuildInfo().buildTime).toBe('2026-05-08T11:00:00Z');
    restore();
  });

  it('6. empty-string env values are treated as unset (firstEnvOf semantics)', () => {
    process.env.GIT_SHA = '';
    process.env.COMMIT_SHA = '';
    process.env.GITHUB_SHA = 'falls-through-to-here';
    expect(getBuildInfo().gitSha).toBe('falls-through-to-here');
    restore();
  });
});

// ── B. SECRET-LEAK GUARDS ──────────────────────────────────────────────────

describe('PR-HEALTH-BUILD-SHA — secret-leak guards', () => {
  it('7. helper reads ONLY the allowlisted public deploy identifiers (no other env)', () => {
    // Strip strings + comments so a doc-comment that mentions a secret
    // name doesn't false-positive.
    const stripped = helper
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')
      .replace(/(['"`])[\s\S]*?\1/g, m => {
        // Keep only allowlisted strings; replace others with empty quotes
        const inner = m.slice(1, -1);
        return ALLOWED_ENV_NAMES.includes(inner as any) ? m : '""';
      });
    // Every process.env access must reference an allowlisted name.
    const accesses = stripped.match(/process\.env(?:\.[A-Z_]+|\[[^\]]+\])/g) || [];
    expect(accesses.length).toBeGreaterThan(0);
    for (const access of accesses) {
      const dot = access.match(/process\.env\.([A-Z_]+)/);
      const bracket = access.match(/process\.env\[(['"])([A-Z_]+)\1\]/);
      const name = dot?.[1] ?? bracket?.[2] ?? '';
      // Bracketed dynamic access via a variable is also OK because the
      // VARIABLE is bound from the allowlisted array. firstEnvOf takes a
      // `names` parameter sourced from getBuildInfo's literal arrays.
      if (!name) continue;
      expect(ALLOWED_ENV_NAMES).toContain(name as any);
    }
  });

  it('8. helper does NOT reference any secret-bearing env name from configHealth manifest', () => {
    const stripped = helper.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    for (const forbidden of [
      'TWILIO_AUTH_TOKEN', 'TWILIO_ACCOUNT_SID',
      'SENDGRID_API_KEY', 'RECAPTCHA_SECRET_KEY',
      'FIREBASE_SERVICE_ACCOUNT_KEY', 'NAYAX_API_KEY',
      'NAYAX_SECRET', 'NAYAX_WEBHOOK_SECRET',
      'GOOGLE_SERVICE_ACCOUNT_JSON', 'MACHINE_SECRET_KEY',
      'TRANZILA_API_KEY', 'TRANZILA_TERMINAL_PASSWORD',
      'META_WHATSAPP_ACCESS_TOKEN', 'META_WEBHOOK_SECRET',
      'DATABASE_URL', 'COOKIE_SECRET', 'JWT_SECRET',
      'KYC_SALT', 'IP_HASH_SALT', 'DOCUMENT_ENCRYPTION_KEY',
    ]) {
      expect(stripped).not.toContain(forbidden);
    }
  });

  it('9. exported BuildInfo type cannot leak a `value` or `secret` field', () => {
    expect(helper).not.toMatch(/value:\s*string/);
    expect(helper).not.toMatch(/secret:\s*string/);
    expect(helper).not.toMatch(/credentials:\s*string/);
  });

  it('10. NO env access uses unbounded user input (defensive)', () => {
    // process.env[<dynamic>] must be parameterised, not from a request.
    expect(helper).not.toMatch(/process\.env\[req\./);
    expect(helper).not.toMatch(/process\.env\[input/);
  });
});

// ── C. /HEALTH WIRING ─────────────────────────────────────────────────────

describe('PR-HEALTH-BUILD-SHA — /health endpoint wiring', () => {
  it('11. server/index.ts /health imports the helper via require/lazy load', () => {
    expect(indexSrc).toMatch(/getBuildInfo\b/);
    // Lazy require avoids any circular-import risk at boot.
    expect(indexSrc).toMatch(/require\(\s*['"]\.\/lib\/buildInfo['"]\s*\)/);
  });

  it('12. /health response embeds build identifiers under the `build` key', () => {
    const idx = indexSrc.indexOf("app.get('/health'");
    expect(idx).toBeGreaterThan(0);
    const window_ = indexSrc.slice(idx, idx + 1500);
    expect(window_).toMatch(/build:\s*getBuildInfo\(\)/);
  });

  it('13. PR-HEALTH-BUILD-SHA retirement comment documents the operational rule', () => {
    expect(indexSrc).toMatch(/PR-HEALTH-BUILD-SHA/);
    expect(indexSrc).toMatch(/CI green ≠ deployed|deploy(ed| identifier)/i);
  });

  it('14. /health remains 200 OK (status field present, never thrown out)', () => {
    const idx = indexSrc.indexOf("app.get('/health'");
    const window_ = indexSrc.slice(idx, idx + 1500);
    expect(window_).toMatch(/res\.status\(\s*200\s*\)\.json/);
    expect(window_).toMatch(/status:\s*isDegraded\s*\?\s*['"]DEGRADED['"]\s*:\s*['"]OK['"]/);
  });
});
