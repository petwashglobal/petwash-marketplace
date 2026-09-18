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
/** A PATH with node but deliberately no gcloud. This is the DEFAULT for every run. */
let noGcloudPath = '';
/** A PATH whose `gcloud` reports a CURRENT service that already binds the secret. */
let boundGcloudPath = '';

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
  // ONLY this dir: the CI runner image ships gcloud in /usr/bin, so a PATH that
  // still carried the system dirs would not be gcloud-free at all.
  noGcloudPath = binDir;

  // A gcloud that answers instantly with a service that DOES bind the secret.
  // The real thing must never be reached from a test: an unauthenticated
  // `gcloud run services describe` sits on the metadata server for tens of
  // seconds, which is how this file timed out on CI while passing locally —
  // and a test that reaches a live GCP project is not a test.
  const gcloudDir = mkdtempSync(join(tmpdir(), 'pw-gcloud-'));
  mkdirSync(gcloudDir, { recursive: true });
  writeFileSync(join(gcloudDir, 'node'), `#!/bin/sh\nexec ${process.execPath} "$@"\n`, { mode: 0o755 });
  writeFileSync(
    join(gcloudDir, 'gcloud'),
    // `echo` and not a heredoc + `cat`: PATH here is the fake bin dir alone, so
    // only shell builtins are reachable.
    '#!/bin/sh\necho \''
    + JSON.stringify({
      spec: {
        template: {
          spec: {
            containers: [{
              env: [
                { name: 'DATABASE_URL', valueFrom: { secretKeyRef: { name: 'DATABASE_URL' } } },
                { name: 'TURNSTILE_SECRET_KEY', valueFrom: { secretKeyRef: { name: 'TURNSTILE_SECRET_KEY' } } },
              ],
            }],
          },
        },
      },
    })
    + '\'\n',
    { mode: 0o755 },
  );
  boundGcloudPath = gcloudDir;
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
/**
 * The three variables the gate reads to decide "is this a production release".
 *
 * They are STRIPPED from the inherited environment, so the only ones the gate
 * sees are the ones a test passes explicitly. 2026-09-18: this file left the
 * red baseline because it was green on a PR — and then failed on all 18
 * pushes to main that followed. The Actions runner sets GITHUB_REF to
 * refs/heads/main on a push-to-main run, the gate treats that as production,
 * and the "non-production" test inherited it. Green on every PR, red on
 * every merge, and nothing in the PR could have shown it.
 */
const PRODUCTION_SIGNALS = ['TURNSTILE_INVARIANT_ENV', 'NODE_ENV', 'GITHUB_REF'] as const;

function hermeticEnv(): Record<string, string | undefined> {
  const base: Record<string, string | undefined> = { ...process.env };
  for (const k of PRODUCTION_SIGNALS) delete base[k];
  return base;
}

function run(env: Record<string, string>, dist = goodDist): { code: number; out: string } {
  const cmd = `${JSON.stringify(process.execPath)} ${JSON.stringify(SCRIPT)} --dist ${JSON.stringify(dist)} 2>&1`;
  try {
    const out = execFileSync('/bin/sh', ['-c', cmd], {
      encoding: 'utf8',
      // PATH is pinned to a gcloud-free one BEFORE the caller's env, so a test
      // only talks to gcloud when it deliberately puts one on the PATH.
      env: { ...hermeticEnv(), PATH: noGcloudPath, ...env },
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
    const r = run({ TURNSTILE_INVARIANT_ENV: 'production', PATH: boundGcloudPath });
    expect(r.code).toBe(1);
    expect(r.out).toContain('Currently deployed service binds TURNSTILE_SECRET_KEY');
    expect(r.out).toContain('not evidence about the next revision');
  });

  it('non-production warns instead of blocking', () => {
    const r = run({ PATH: noGcloudPath });
    expect(r.code).toBe(0);
    expect(r.out).toContain('Non-production release');
  });

  it('a push-to-main run counts as production even when nobody set TURNSTILE_INVARIANT_ENV', () => {
    // The deploy workflow relies on this inference; it is also the signal the
    // previous test must NOT inherit from the runner (see PRODUCTION_SIGNALS).
    const r = run({ GITHUB_REF: 'refs/heads/main' });
    expect(r.code).toBe(1);
    expect(r.out).not.toContain('Non-production release');
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

describe('the known-outage waiver is narrow, loud, and self-removing', () => {
  /**
   * WHY IT EXISTS. I merged the gate before anything could satisfy it: neither
   * Turnstile key has ever been created, and they can only be created in a
   * Cloudflare account. The very next production deploy failed at this gate —
   * blocking an unrelated release to enforce a check for a key that could not
   * yet exist. Fail-closed is right for a REGRESSION; it is wrong as a hostage.
   *
   * So the waiver covers exactly the provisioning gap and nothing else.
   */
  const ACK = { TURNSTILE_KNOWN_OUTAGE_ACK: '2026-09-06 · awaiting widget' };

  it('lets a release through when the ONLY problem is that nothing is provisioned', () => {
    const d = mkdtempSync(join(tmpdir(), 'pw-unprov-'));
    writeFileSync(join(d, 'app.js'), 'var a="SITE_KEY_MISSING";', 'utf8'); // no key
    execFileSync(process.execPath, [WRITER, '--dist', d], { stdio: 'ignore' });
    const r = run({ TURNSTILE_INVARIANT_ENV: 'production', ...ACK }, d);
    expect(r.code).toBe(0);
    expect(r.out).toContain('RELEASING WITH A KNOWN TURNSTILE OUTAGE');
    rmSync(d, { recursive: true, force: true });
  });

  it('still BLOCKS the same release without the waiver', () => {
    const d = mkdtempSync(join(tmpdir(), 'pw-unprov2-'));
    writeFileSync(join(d, 'app.js'), 'var a="SITE_KEY_MISSING";', 'utf8');
    execFileSync(process.execPath, [WRITER, '--dist', d], { stdio: 'ignore' });
    const r = run({ TURNSTILE_INVARIANT_ENV: 'production' }, d);
    expect(r.code).toBe(1);
    rmSync(d, { recursive: true, force: true });
  });

  it('NEVER covers a pipeline fault — missing build metadata still blocks', () => {
    // The waiver is about a key nobody has created. A build that forgot to
    // write its own metadata is a regression we control, and shipping it
    // would leave the health endpoint reporting UNKNOWN forever.
    const d = mkdtempSync(join(tmpdir(), 'pw-fault-'));
    writeFileSync(join(d, 'app.js'), 'var a="SITE_KEY_MISSING";var k="0x4AAAAAAABkMYinukE8nzYS";', 'utf8');
    const r = run({
      TURNSTILE_INVARIANT_ENV: 'production',
      CLOUDRUN_SECRET_MAPPINGS: 'TURNSTILE_SECRET_KEY=TURNSTILE_SECRET_KEY:latest',
      ...ACK,
    }, d);
    expect(r.code).toBe(1);
    expect(r.out).toContain('does NOT cover these');
    rmSync(d, { recursive: true, force: true });
  });

  it('NEVER covers metadata that disagrees with the artifact', () => {
    const d = mkdtempSync(join(tmpdir(), 'pw-stale2-'));
    writeFileSync(join(d, 'app.js'), 'var a="SITE_KEY_MISSING";var k="0x4AAAAAAABkMYinukE8nzYS";', 'utf8');
    writeFileSync(join(d, 'build-config.json'),
      JSON.stringify({ schema: 1, turnstileConfigured: false, turnstileWidgetPresent: true }), 'utf8');
    const r = run({
      TURNSTILE_INVARIANT_ENV: 'production',
      CLOUDRUN_SECRET_MAPPINGS: 'TURNSTILE_SECRET_KEY=TURNSTILE_SECRET_KEY:latest',
      ...ACK,
    }, d);
    expect(r.code).toBe(1);
    expect(r.out).toContain('disagrees with the artifact');
    rmSync(d, { recursive: true, force: true });
  });

  it('tells you to REMOVE it once Turnstile is actually provisioned', () => {
    // Otherwise the waiver quietly becomes permanent and hides the next
    // regression — which is the whole failure mode the gate exists to stop.
    const r = run({
      TURNSTILE_INVARIANT_ENV: 'production',
      CLOUDRUN_SECRET_MAPPINGS: 'TURNSTILE_SECRET_KEY=TURNSTILE_SECRET_KEY:latest',
      ...ACK,
    });
    expect(r.code).toBe(0);
    expect(r.out).toContain('REMOVE TURNSTILE_KNOWN_OUTAGE_ACK');
  });

  it('says out loud that signup is still down — a waived release is not a healthy one', () => {
    const d = mkdtempSync(join(tmpdir(), 'pw-loud-'));
    writeFileSync(join(d, 'app.js'), 'var a="SITE_KEY_MISSING";', 'utf8');
    execFileSync(process.execPath, [WRITER, '--dist', d], { stdio: 'ignore' });
    const r = run({ TURNSTILE_INVARIANT_ENV: 'production', ...ACK }, d);
    expect(r.out).toContain('Signup and code sign-in are DOWN in production');
    rmSync(d, { recursive: true, force: true });
  });
});
