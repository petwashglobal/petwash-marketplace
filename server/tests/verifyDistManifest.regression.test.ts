/**
 * Post-release 2026-09-03 (backlog P1): dist-manifest verifier — real
 * behavioural test. Sets up two tiny fake dist directories in a temp
 * folder, runs the script against each, and asserts the exit codes
 * and console output.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { execFileSync } from 'child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';

const SCRIPT = resolve(process.cwd(), 'scripts/verify-dist-manifest.ts');

function run(distDir: string): { code: number; stdout: string; stderr: string } {
  try {
    const stdout = execFileSync('npx', ['tsx', SCRIPT, distDir], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { code: 0, stdout, stderr: '' };
  } catch (e: any) {
    return {
      code: typeof e.status === 'number' ? e.status : 1,
      stdout: String(e.stdout || ''),
      stderr: String(e.stderr || ''),
    };
  }
}

let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'verify-dist-'));
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe('verify-dist-manifest — happy path', () => {
  it('exits 0 when every ref exists on disk', () => {
    mkdirSync(join(tmp, 'assets'), { recursive: true });
    // A tiny valid dist: index.html references App.js and App.js references
    // a lazy chunk SignUp.js. Both exist.
    writeFileSync(join(tmp, 'assets', 'App-abc.js'), 'import("/assets/SignUp-xyz.js")');
    writeFileSync(join(tmp, 'assets', 'SignUp-xyz.js'), 'export default {};');
    writeFileSync(
      join(tmp, 'index.html'),
      '<html><body><script src="/assets/App-abc.js"></script></body></html>',
    );
    const r = run(tmp);
    expect(r.code).toBe(0);
    expect(r.stdout).toMatch(/every referenced asset exists on disk/);
  }, 20_000);
});

describe('verify-dist-manifest — missing lazy chunk (the 2026-08-29 shape)', () => {
  it('exits 1 and names the missing asset', () => {
    mkdirSync(join(tmp, 'assets'), { recursive: true });
    // index.html and App.js are present; SignUp-xyz.js is NOT — this
    // is exactly the stale-chunk 404 shape.
    writeFileSync(join(tmp, 'assets', 'App-abc.js'), 'import("/assets/SignUp-xyz.js")');
    writeFileSync(
      join(tmp, 'index.html'),
      '<html><body><script src="/assets/App-abc.js"></script></body></html>',
    );
    const r = run(tmp);
    expect(r.code).toBe(1);
    expect(r.stderr).toMatch(/\/assets\/SignUp-xyz\.js/);
    expect(r.stderr).toMatch(/missing asset/);
  }, 20_000);
});

describe('verify-dist-manifest — missing dist dir', () => {
  it('exits 2 with a diagnostic', () => {
    const r = run(join(tmp, 'does-not-exist'));
    expect(r.code).toBe(2);
    expect(r.stderr).toMatch(/dist dir not found/);
  }, 20_000);
});

describe('verify-dist-manifest — CI wire', () => {
  it('is called from the deploy-backend job in petwash-ci.yml', async () => {
    const { readFileSync } = await import('fs');
    const src = readFileSync(resolve(process.cwd(), '.github/workflows/petwash-ci.yml'), 'utf8');
    expect(src).toMatch(/Verify dist manifest \(all referenced assets exist on disk\)/);
    expect(src).toMatch(/npx tsx scripts\/verify-dist-manifest\.ts dist\/public/);
  });
});
