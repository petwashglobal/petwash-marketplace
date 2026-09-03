/**
 * Post-release 2026-09-03 (backlog P1): deploy-hardening remainder.
 * Source-anchored pins for the /api/release-info endpoint, the two
 * shell scripts, and the executable bit.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, statSync, constants } from 'fs';
import { resolve } from 'path';

function read(rel: string): string {
  return readFileSync(resolve(process.cwd(), rel), 'utf8');
}

describe('deploy-hardening remainder — /api/release-info endpoint', () => {
  it('server/index.ts mounts /api/release-info and returns SHA + revision + builtAt', () => {
    const src = read('server/index.ts');
    expect(src).toMatch(/app\.get\(['"]\/api\/release-info['"]/);
    expect(src).toMatch(/sha:\s*process\.env\.GIT_SHA/);
    expect(src).toMatch(/revision:\s*process\.env\.K_REVISION/);
    expect(src).toMatch(/builtAt:\s*process\.env\.BUILD_TIMESTAMP/);
    // Cache-safe — the endpoint must not be cached
    expect(src).toMatch(/res\.set\(['"]Cache-Control['"],\s*['"]no-store['"]\)/);
  });
});

describe('deploy-hardening remainder — critical-route-canary.sh', () => {
  const src = read('scripts/critical-route-canary.sh');

  it('executable', () => {
    // eslint-disable-next-line no-bitwise
    const mode = statSync(resolve(process.cwd(), 'scripts/critical-route-canary.sh')).mode;
    // Owner-executable bit set (0o100 in the mode)
    expect(mode & 0o100).not.toBe(0);
  });

  it('hits /, /signin, /signup and asserts app shell + first asset', () => {
    expect(src).toMatch(/ROUTES=\("\/" "\/signin" "\/signup"\)/);
    expect(src).toMatch(/<div\[\^>\]\+id=\["'\\'']root\["'\\'']/);
    expect(src).toMatch(/first JS asset/);
  });
});

describe('deploy-hardening remainder — audit-cache-headers.sh', () => {
  const src = read('scripts/audit-cache-headers.sh');

  it('executable', () => {
    // eslint-disable-next-line no-bitwise
    const mode = statSync(resolve(process.cwd(), 'scripts/audit-cache-headers.sh')).mode;
    expect(mode & 0o100).not.toBe(0);
  });

  it('checks the five auth routes for a cache-safe Cache-Control', () => {
    expect(src).toMatch(/ROUTES=\("\/" "\/signin" "\/signup" "\/sign-in" "\/login"\)/);
    expect(src).toMatch(/no-store/);
    expect(src).toMatch(/no-cache/);
    expect(src).toMatch(/must-revalidate/);
  });
});
