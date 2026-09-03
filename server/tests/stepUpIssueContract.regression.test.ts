/**
 * Regression pin — POST /api/me/step-up/issue (auth-rebuild Phase 7).
 *
 * The step-up proof MINT endpoint is what turns StepUpService from a
 * "callable primitive nobody calls" into a runtime hop clients can
 * actually use to obtain the proof for /link/initiate, /change-mobile,
 * /soft-merge, etc. Because this endpoint mints a bearer of privilege,
 * its contract must not silently relax.
 *
 * Invariants:
 *
 *   1. Handler sits behind validateFirebaseToken (the caller must
 *      already be signed in — the mint proves FRESH re-auth on top
 *      of that, it doesn't authenticate from scratch).
 *   2. Fresh ID token is verified with checkRevoked=true.
 *   3. Fresh token's uid MUST match the caller's uid (no cross-user
 *      proof mint even with a valid ID token).
 *   4. auth_time recency is enforced against RECENT_AUTH_MAX_SECONDS
 *      (currently 5 minutes). No unbounded / no-check branch exists.
 *   5. Response body carries the opaque proof — the endpoint never
 *      logs the raw proof value.
 *   6. Router is mounted at /api/me in server/routes.ts.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..', '..');
const route = readFileSync(join(ROOT, 'server/routes/me-step-up.ts'), 'utf8');
const routes = readFileSync(join(ROOT, 'server/routes.ts'), 'utf8');

describe('POST /api/me/step-up/issue contract', () => {
  it('handler is behind validateFirebaseToken', () => {
    expect(route).toMatch(
      /router\.post\(\s*['"]\/step-up\/issue['"][\s\S]{0,200}?validateFirebaseToken/,
    );
  });

  it('verifies freshIdToken with checkRevoked=true', () => {
    expect(route).toMatch(
      /admin\.auth\(\)\.verifyIdToken\(\s*freshIdToken\s*,\s*true\s*\)/,
    );
  });

  it('enforces uid match between session and freshIdToken', () => {
    expect(route).toMatch(/decoded\.uid\s*!==\s*callerUid/);
    expect(route).toMatch(/error:\s*['"]UID_MISMATCH['"]/);
  });

  it('enforces auth_time recency (finite AND within window)', () => {
    // The finite check MUST be present — non-finite auth_time is
    // treated as invalid, never as "0 = infinitely old".
    expect(route).toMatch(/Number\(decoded\.auth_time\)/);
    expect(route).toMatch(/Number\.isFinite\(authTime\)/);
    // The recency window MUST be a constant, not read from mutable state.
    expect(route).toMatch(/const RECENT_AUTH_MAX_SECONDS\s*=\s*\d+\s*\*\s*\d+/);
    expect(route).toMatch(/nowSec\s*-\s*authTime\s*>\s*RECENT_AUTH_MAX_SECONDS/);
    expect(route).toMatch(/error:\s*['"]RECENCY_INSUFFICIENT['"]/);
  });

  it('never logs the raw proof — only issuance metadata', () => {
    const infoBlock = route.match(/logger\.info\(\s*['"][^'"]*proof issued['"][\s\S]*?\}\s*\);/);
    expect(infoBlock).toBeTruthy();
    // The log must NOT include the proof token itself.
    expect(infoBlock![0].includes('issued.token')).toBe(false);
    expect(infoBlock![0].includes('proof:')).toBe(false);
    // Must include the age + expiry for correlation.
    expect(infoBlock![0]).toMatch(/freshAuthAgeSeconds/);
    expect(infoBlock![0]).toMatch(/expiresAt/);
  });

  it('router is mounted under /api/me in server/routes.ts', () => {
    expect(routes).toMatch(/import meStepUpRoutes from ["']\.\/routes\/me-step-up["']/);
    expect(routes).toMatch(/app\.use\(\s*['"]\/api\/me['"][^)]*meStepUpRoutes\s*\)/);
  });
});
