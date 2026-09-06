/**
 * The Turnstile release gate must FAIL CLOSED, and must validate the CANDIDATE.
 *
 * TWO HOLES THIS PINS, both found by review of the first version:
 *
 * 1. It inspected `gcloud run services describe petwash-api` — the CURRENTLY
 *    DEPLOYED service. That proves nothing about the revision about to replace
 *    it. A deploy template that dropped the binding would sail past a check of
 *    the old service, and the gate would report success while shipping an
 *    outage.
 *
 * 2. When gcloud failed it pushed a NOTE and continued. So on a production
 *    release where the gate could not evaluate — no credential, permission
 *    denied, malformed output — the release proceeded with the server half
 *    entirely unproven, as long as the client half was fine. A gate that
 *    cannot evaluate must block; deferring to a post-deploy health check turns
 *    the gate into decoration.
 *
 * These run the real script as a subprocess, because the behaviour under test
 * IS its exit code.
 */
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..');
const SCRIPT = join(ROOT, 'scripts', 'guards', 'turnstile-release-invariant.mjs');
const WRITER = join(ROOT, 'scripts', 'guards', 'write-build-config.mjs');

/** A bundle that DID get a site key, so the client half never masks a server-half result. */
let goodDist = '';
/** A PATH with node but deliberately no gcloud. */
let noGcloudPath = '';

beforeAll(() => {
  goodDist = mkdtempSync(join(tmpdir(), 'pw-good-'));
  writeFileSync(
    join(goodDist, 'app.js'),
    'var a="SITE_KEY_MISSING";var k="0x4AAAAAAABkMYinukE8nzYS";',
    'utf8',
  );
  execFileSync(process.execPath, [WRITER, '--dist', goodDist], { stdio: 'ignore' });

  const binDir = mkdtempSync(join(tmpdir(), 'pw-bin-'));
  mkdirSync(binDir, { recursive: true });
  writeFileSync(join(binDir, 'node'), `#!/bin/sh\nexec ${process.execPath} "$@"\n`, { mode: 0o755 });
  noGcloudPath = `${binDir}:/usr/bin:/bin`;
});

afterAll(() => {
  try { rmSync(goodDist, { recursive: true, force: true }); } catch { /* ignore */ }
});

/**
 * Runs the gate and captures BOTH streams.
 *
 * execFileSync returns stdout only, so on a SUCCESSFUL run the warnings — which
 * the script writes to stderr — were invisible. That is how the first version
 * of the non-production test failed: the exit code was right and the message
 * simply had not been captured. Merging the streams keeps the assertions about
 * what an operator actually sees.
 */
function run(env: Record<string, string>, dist = goodDist): { code: number; out: string } {
  const cmd = `${JSON.stringify(process.execPath)} ${JSON.stringify(SCRIPT)} --dist ${JSON.stringify(dist)} 2>&1`;
  try {
    const out = execFileSync('/bin/sh', ['-c', cmd], {
      encoding: 'utf8',
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { code: 0, out };
  } catch (e: any) {
    return { code: e.status ?? -1, out: `${e.stdout ?? ''}${e.stderr ?? ''}` };
  }
}

describe('the gate validates the CANDIDATE deployment', () => {
  it('passes when the candidate mappings bind TURNSTILE_SECRET_KEY', () => {
    const r = run({
      TURNSTILE_INVARIANT_ENV: 'production',
      CLOUDRUN_SECRET_MAPPINGS: 'TURNSTILE_SECRET_KEY=TURNSTILE_SECRET_KEY:latest',
    });
    expect(r.code).toBe(0);
    expect(r.out).toContain('Candidate deployment binds TURNSTILE_SECRET_KEY');
  });

  it('BLOCKS when the candidate mappings omit it, even though other secrets are bound', () => {
    const r = run({
      TURNSTILE_INVARIANT_ENV: 'production',
      CLOUDRUN_SECRET_MAPPINGS: 'DATABASE_URL=DATABASE_URL:latest\nJWT_SECRET=JWT_SECRET:latest',
    });
    expect(r.code).toBe(1);
    expect(r.out).toContain('CANDIDATE deployment does not bind TURNSTILE_SECRET_KEY');
  });

  it('does not accept a near-miss env name', () => {
    // A prefix/suffix match would let TURNSTILE_SECRET_KEY_OLD satisfy the gate.
    const r = run({
      TURNSTILE_INVARIANT_ENV: 'production',
      CLOUDRUN_SECRET_MAPPINGS: 'TURNSTILE_SECRET_KEY_OLD=TURNSTILE_SECRET_KEY:latest',
    });
    expect(r.code).toBe(1);
  });

  it('tells the operator to bind from Secret Manager, NOT to copy the value into GitHub', () => {
    const r = run({
      TURNSTILE_INVARIANT_ENV: 'production',
      CLOUDRUN_SECRET_MAPPINGS: 'DATABASE_URL=DATABASE_URL:latest',
    });
    expect(r.out).toContain('do NOT copy the value into GitHub Actions');
  });
});

describe('FAIL CLOSED when the gate cannot evaluate', () => {
  it('BLOCKS a production release when no candidate mappings are supplied', () => {
    const r = run({ TURNSTILE_INVARIANT_ENV: 'production' });
    expect(r.code).toBe(1);
    expect(r.out).toContain('Could not verify the CANDIDATE deployment');
    expect(r.out).toContain('must BLOCK, not defer to post-deploy health');
  });

  it('BLOCKS when gcloud is unavailable — exit 1, not a skip', () => {
    const r = run({
      TURNSTILE_INVARIANT_ENV: 'production',
      PATH: noGcloudPath,
    });
    expect(r.code).toBe(1);
    expect(r.out).toContain('could not be queried');
  });

  it('BLOCKS when the mappings are present but empty', () => {
    const r = run({
      TURNSTILE_INVARIANT_ENV: 'production',
      CLOUDRUN_SECRET_MAPPINGS: '   ',
      PATH: noGcloudPath,
    });
    expect(r.code).toBe(1);
  });

  it('a healthy CURRENT service is a diagnostic, never a pass', () => {
    // Even if the live service binds it, that says nothing about the candidate.
    const r = run({ TURNSTILE_INVARIANT_ENV: 'production' });
    expect(r.code).toBe(1);
  });

  it('non-production warns instead of blocking', () => {
    const r = run({ PATH: noGcloudPath });
    expect(r.code).toBe(0);
    expect(r.out).toContain('Non-production release');
  });
});

describe('the candidate ARTIFACT must carry usable build metadata', () => {
  it('BLOCKS when build-config.json is missing', () => {
    const d = mkdtempSync(join(tmpdir(), 'pw-nometa-'));
    writeFileSync(join(d, 'app.js'), 'var a="SITE_KEY_MISSING";var k="0x4AAAAAAABkMYinukE8nzYS";', 'utf8');
    const r = run({
      TURNSTILE_INVARIANT_ENV: 'production',
      CLOUDRUN_SECRET_MAPPINGS: 'TURNSTILE_SECRET_KEY=TURNSTILE_SECRET_KEY:latest',
    }, d);
    expect(r.code).toBe(1);
    expect(r.out).toContain('build-config.json is missing');
    rmSync(d, { recursive: true, force: true });
  });

  it('BLOCKS when the metadata disagrees with the artifact it ships beside', () => {
    const d = mkdtempSync(join(tmpdir(), 'pw-stale-'));
    writeFileSync(join(d, 'app.js'), 'var a="SITE_KEY_MISSING";', 'utf8'); // no key
    writeFileSync(
      join(d, 'build-config.json'),
      JSON.stringify({ schema: 1, turnstileConfigured: true, turnstileWidgetPresent: true }),
      'utf8',
    );
    const r = run({
      TURNSTILE_INVARIANT_ENV: 'production',
      CLOUDRUN_SECRET_MAPPINGS: 'TURNSTILE_SECRET_KEY=TURNSTILE_SECRET_KEY:latest',
    }, d);
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/disagrees with the artifact|built WITHOUT/);
    rmSync(d, { recursive: true, force: true });
  });
});
