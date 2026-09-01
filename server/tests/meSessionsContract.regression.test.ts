/**
 * Regression pin — /api/me/sessions surface (auth-rebuild Phase 9).
 *
 * The Account Security page reads and mutates its OWN sessions_pw
 * graph through these three endpoints. If any of these contracts
 * regress, users either lose the ability to revoke devices or
 * gain the ability to revoke someone else's.
 *
 * Invariants pinned here:
 *
 *   1. All three endpoints sit behind validateFirebaseToken.
 *   2. Single-session /:rowId/revoke verifies OWNERSHIP by re-listing
 *      the caller's sessions and matching the rowId — a stranger's
 *      known rowId cannot be revoked from another account.
 *   3. Row-id path param is parsed as integer-string, not blindly
 *      passed to BigInt (would crash on non-numeric input).
 *   4. revoke-all requires step-up proof for purpose 'delete_account'
 *      (same trust boundary as account destruction — a phished tab
 *      must not silently orphan the user from all devices).
 *   5. Response shape uses PublicSessionRow — never exposes
 *      session_id_hash or full user-agent, ip stays truncated.
 *   6. rowId in wire format is a string (bigint → JSON safety).
 *   7. Router is mounted at /api/me in routes.ts.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..', '..');
const route = readFileSync(join(ROOT, 'server/routes/me-sessions.ts'), 'utf8');
const routes = readFileSync(join(ROOT, 'server/routes.ts'), 'utf8');

describe('/api/me/sessions surface', () => {
  it('all three endpoints sit behind validateFirebaseToken', () => {
    // GET /sessions
    expect(route).toMatch(
      /router\.get\(\s*['"]\/sessions['"][\s\S]{0,120}?validateFirebaseToken/,
    );
    // POST /sessions/:rowId/revoke
    expect(route).toMatch(
      /router\.post\(\s*['"]\/sessions\/:rowId\/revoke['"][\s\S]{0,150}?validateFirebaseToken/,
    );
    // POST /sessions/revoke-all
    expect(route).toMatch(
      /router\.post\(\s*['"]\/sessions\/revoke-all['"][\s\S]{0,150}?validateFirebaseToken/,
    );
  });

  it('single-session revoke verifies ownership before mutating', () => {
    // The handler MUST call listSessionsForUser(uid) and confirm the
    // rowId belongs to the caller BEFORE revokeSessionByRowId.
    const body = route.match(
      /router\.post\(\s*['"]\/sessions\/:rowId\/revoke['"][\s\S]*?revokeSessionByRowId/,
    );
    expect(body, '/sessions/:rowId/revoke handler').toBeTruthy();
    expect(body![0]).toMatch(/listSessionsForUser\(uid\)/);
    expect(body![0]).toMatch(/own\.find\(/);
    // If not found, MUST return 404 (never 200-with-null which leaks
    // existence).
    expect(body![0]).toMatch(/SESSION_NOT_FOUND/);
    expect(body![0]).toMatch(/status\(404\)/);
  });

  it('rowId param is validated numeric BEFORE BigInt() conversion', () => {
    // A raw BigInt('abc') throws SyntaxError and 500s the request.
    // Handler must reject BAD_ROW_ID on non-numeric input.
    expect(route).toMatch(/\/\^\\d\+\$\/\.test\(raw\)/);
    expect(route).toMatch(/error:\s*['"]BAD_ROW_ID['"]/);
  });

  it('revoke-all requires step-up for delete_account (same trust boundary as account deletion)', () => {
    expect(route).toMatch(
      /router\.post\(\s*['"]\/sessions\/revoke-all['"][\s\S]{0,300}?requireStepUp\(\s*['"]delete_account['"]\s*\)/,
    );
  });

  it('response never exposes session_id_hash and truncates user-agent hints', () => {
    // The public projection type — check field names + no hash field.
    const iface = route.match(/interface PublicSessionRow\s*\{[\s\S]*?\}/);
    expect(iface, 'PublicSessionRow interface must exist').toBeTruthy();
    expect(/sessionIdHash/.test(iface![0])).toBe(false);
    // UA fields are ALL "…Hint" (marks that they've been truncated).
    expect(iface![0]).toMatch(/registrationUserAgentHint/);
    expect(iface![0]).toMatch(/lastSeenUserAgentHint/);
    // toPublic() actually calls truncate() on the UA fields — a bug
    // that passes UA raw would leak a full fingerprint.
    const toPub = route.match(/function toPublic[\s\S]*?\n\}/);
    expect(toPub).toBeTruthy();
    expect(toPub![0]).toMatch(/truncate\(s\.registrationUserAgent/);
    expect(toPub![0]).toMatch(/truncate\(s\.lastSeenUserAgent/);
  });

  it('rowId is serialised as string on the wire (JSON bigint-safe)', () => {
    // toPublic uses s.rowId.toString() and rowId.toString() responses.
    expect(route).toMatch(/rowId:\s*s\.rowId\.toString\(\)/);
    expect(route).toMatch(/rowId:\s*rowId\.toString\(\)/);
  });

  it('router is mounted under /api/me in server/routes.ts', () => {
    expect(routes).toMatch(/import meSessionsRoutes from ["']\.\/routes\/me-sessions["']/);
    expect(routes).toMatch(/app\.use\(\s*['"]\/api\/me['"][^)]*meSessionsRoutes\s*\)/);
  });
});
