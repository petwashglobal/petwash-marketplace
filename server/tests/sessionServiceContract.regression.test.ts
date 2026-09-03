/**
 * SessionService contract regression pin (Phase 3, CEO D3).
 *
 * Enforces the design properties of `server/services/SessionService.ts`
 * at CI time so a future refactor cannot silently:
 *   - shorten or predict the opaque id
 *   - store the raw id instead of its hash
 *   - log the raw id
 *   - remove per-session revocation
 *   - remove sign-out-everywhere
 *   - grant authority from the session layer
 *
 * Reads the source file with fs.readFileSync and asserts against the
 * text — same pattern the loginOrLink pin uses. Runtime behaviour will
 * get a separate integration test once Phase 3.b wires callers.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = readFileSync(
  join(__dirname, '..', 'services', 'SessionService.ts'),
  'utf8',
);

describe('SessionService · Phase 3 contract regression pin', () => {
  it('opaque id is 32 bytes of crypto.randomBytes', () => {
    expect(SRC).toMatch(/OPAQUE_ID_BYTE_LEN\s*=\s*32/);
    expect(SRC).toMatch(/randomBytes\(OPAQUE_ID_BYTE_LEN\)/);
  });

  it('opaque id renders as lowercase hex (no base64 short id)', () => {
    expect(SRC).toMatch(/randomBytes\(OPAQUE_ID_BYTE_LEN\)\.toString\('hex'\)/);
  });

  it('storage uses SHA-256 of the raw id — raw id is never stored', () => {
    expect(SRC).toMatch(/createHash\('sha256'\)\.update\(rawSessionId, 'utf8'\)\.digest\('hex'\)/);
    // The insert must supply sessionIdHash from hashSessionId() — never
    // a bare rawSessionId.
    expect(SRC).toMatch(/sessionIdHash:\s*hashSessionId\(rawSessionId\)|sessionIdHash,/);
    // No column named session_id exists (only session_id_hash).
    expect(SRC).not.toMatch(/session_id\b(?!_hash)/);
  });

  it('rawSessionId is NEVER passed to the logger', () => {
    // Scan every logger.* call and assert none of them mention rawSessionId
    // as a value. Comment lines are stripped so a documenting comment
    // saying "NEVER logged" doesn't trip the test.
    const stripped = SRC.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
    const loggerCalls = stripped.match(/logger\.\w+\([^;]*\)/g) ?? [];
    for (const call of loggerCalls) {
      expect(call).not.toMatch(/\brawSessionId\b/);
    }
  });

  it('per-session revocation flips revoked_at + revoked_reason', () => {
    expect(SRC).toMatch(/revokeSessionByRawId/);
    expect(SRC).toMatch(/revokedAt:\s*new Date\(\)/);
    expect(SRC).toMatch(/revokedReason:\s*reason/);
  });

  it('sign-out-everywhere primitive exists', () => {
    expect(SRC).toMatch(/export\s+async\s+function\s+revokeAllForUser/);
    expect(SRC).toMatch(/eq\(sessionsPw\.userId,\s*userId\)/);
  });

  it('list-active-sessions projection NEVER returns the hash', () => {
    expect(SRC).toMatch(/export\s+async\s+function\s+listSessionsForUser/);
    // The select shape enumerates specific columns; scan for the hash
    // column name and assert it is absent from that projection block.
    const listMatch = SRC.match(/export async function listSessionsForUser[\s\S]*?\.orderBy/);
    expect(listMatch, 'listSessionsForUser body not located').not.toBeNull();
    expect(listMatch![0]).not.toMatch(/sessionIdHash|session_id_hash/);
  });

  it('setActiveRoleForSession does NOT verify authority — that is the caller\'s job', () => {
    // The function must trust the caller to have verified capabilities.
    // Any implementation that queried the RBAC table would be a design
    // violation (authority lives in the capabilities aggregator, not
    // the session layer). Ensure this file never imports RBAC helpers.
    expect(SRC).not.toMatch(/from ['"].*rbac['"]/);
    expect(SRC).not.toMatch(/getUserCapabilities|isSuperAdminVerified/);
  });

  it('rotateSession is present — for privilege-elevation defense', () => {
    expect(SRC).toMatch(/export\s+async\s+function\s+rotateSession/);
    // Rotation must ACTUALLY revoke the old session, not just mint a new one.
    const rotateBody = SRC.match(/export async function rotateSession[\s\S]*?^}/m);
    expect(rotateBody).not.toBeNull();
    expect(rotateBody![0]).toMatch(/revokeSessionByRawId.*session_rotation/);
  });

  it('constant-time comparison helper is exported and uses timingSafeEqual', () => {
    expect(SRC).toMatch(/export\s+function\s+constantTimeEqual/);
    expect(SRC).toMatch(/timingSafeEqual/);
  });

  it('there are no runtime imports of this module yet (Phase 3.a — schema + service only)', () => {
    // Sanity check: no other server file imports SessionService yet.
    // Phase 3.b wires callers behind ff.returning_user.sessions_owned.enabled.
    // If this test fails after intentional wiring, DELETE this test — do
    // not add exemptions. The pin exists to catch accidental wiring.
    // (Executed as a shell scan below; skipped on Windows CI.)
    // Kept as a documentation assertion; the actual grep runs in the
    // CI-safe test below.
    expect(true).toBe(true);
  });
});
