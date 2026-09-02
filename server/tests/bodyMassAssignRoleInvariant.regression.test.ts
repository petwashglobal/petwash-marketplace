/**
 * Regression pin — server is authority: no client body field escalates
 * role / admin / staff / permissions (Task 30 landing anchor).
 *
 * The CEO's invariant: the server is the authority on who a user is
 * and what they can do. A field the client sent in the request body
 * — `role`, `isAdmin`, `isStaff`, `isSuperAdmin`, `accountType`,
 * `permissions`, `roles` — MUST NOT be trusted as an authority signal
 * or copied verbatim into a users-table update. Doing so lets any
 * authenticated caller POST `{ isAdmin: true }` and grant themselves
 * admin, an OWASP-top-10 mass-assignment escalation.
 *
 * The canonical safe shape:
 *
 *   const parsed = insertUserSchema.pick({ firstName: true, lastName: true, ... }).safeParse(req.body);
 *
 * — a `.pick` allowlist that mentions ONLY the fields the caller may
 * write. Anything sensitive (role, isAdmin, permissions, etc.) is
 * NOT in the pick set, so it silently drops even if the caller
 * sends it.
 *
 * This pin walks the server tree and refuses:
 *
 *   1. Any `req.body.<field>` read of role/isAdmin/isStaff/
 *      isSuperAdmin/permissions/roles/accountType as an authority
 *      signal — unless the file legitimately does an owner-gated
 *      assignment (station-operators.ts is the one carve-out, and
 *      it's a role a stations-owner assigns to a stations-operator
 *      via a closed enum allowlist).
 *
 *   2. Any object-spread of req.body into a users-table update
 *      without an explicit `.pick(...)` narrowing on the same line
 *      or one of the preceding lines. That shape (`.set({ ...req.body })`)
 *      is exactly the mass-assignment escalation.
 */
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..', '..');

/** Files where the pattern is safe because it's server-computed or
 *  owner-gated with a closed enum. */
const ALLOWED_BODY_ROLE_READS = new Set<string>([
  // Owner-gated station-operator assignment; requireStationRole('owner')
  // is applied first and the value is passed through stationRoleSchema
  // (a closed enum). The caller can only assign roles ≤ their own on
  // their own stations — a well-defined delegation.
  'server/routes/station-operators.ts',
]);

function grepRepo(pattern: string): string[] {
  try {
    const out = execSync(
      `rg --no-heading -n -g '*.ts' -g '!server/tests/**' -g '!**/node_modules/**' -g '!client/**' ${JSON.stringify(pattern)} ${ROOT}`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 30_000 },
    );
    return out.split('\n').filter(Boolean);
  } catch (err: any) {
    if (err?.status === 1) return [];
    throw err;
  }
}

describe('CEO invariant — server is authority; no body mass-assign of role/admin/staff', () => {
  it('no server code reads req.body.<role|isAdmin|isStaff|isSuperAdmin|permissions|roles|accountType> as authority', () => {
    const hits = grepRepo(
      String.raw`req\.body\.(role|isAdmin|isStaff|isSuperAdmin|permissions|roles|accountType)\b`,
    );
    const strays = hits
      .map((l) => l.split(':')[0].replace(ROOT + '/', ''))
      .filter((f) => !ALLOWED_BODY_ROLE_READS.has(f));
    expect(
      strays,
      `req.body.<role|isAdmin|isStaff|isSuperAdmin|permissions|roles|accountType> is a mass-assignment vector — the server MUST compute these from Firebase claims + the users table, not from the request body. Offenders:\n${strays.join('\n')}`,
    ).toEqual([]);
  });

  it('no server code spreads req.body into a users-table set() call', () => {
    // The `set({ ...req.body ... })` shape is the canonical
    // mass-assign anti-pattern. Even with an in-body validator, a
    // spread lets an attacker sneak in role/isAdmin/etc. unless the
    // schema is a strict pick allowlist.
    //
    // We filter out comment-only lines so a doc-comment that names the
    // anti-pattern (e.g. a "Pre-fix: ..." explanation in a fix commit)
    // doesn't false-positive.
    const hits = grepRepo(String.raw`\.set\(\s*\{[^}]{0,120}\.{3}req\.body`);
    const strays: string[] = [];
    for (const line of hits) {
      const [file, lineNo, ...rest] = line.split(':');
      const rel = file.replace(ROOT + '/', '');
      if (ALLOWED_BODY_ROLE_READS.has(rel)) continue;
      const content = rest.join(':').trimStart();
      // Comment-only line — `//` or `*` or `/*` prefix. A live spread
      // starts with the executable expression.
      if (/^(\/\/|\/\*|\*)/.test(content)) continue;
      strays.push(`${rel}:${lineNo}`);
    }
    expect(
      strays,
      `.set({ ...req.body }) is a mass-assign vector — use an insertXSchema.pick({...}).parse(req.body) allowlist and set explicit fields. Offenders:\n${strays.join('\n')}`,
    ).toEqual([]);
  });

  it('no server code passes req.body directly to insert(users).values(...)', () => {
    const hits = grepRepo(String.raw`insert\(users\)\s*\.values\(\s*req\.body\b`);
    const strays = hits
      .map((l) => l.split(':')[0].replace(ROOT + '/', ''))
      .filter((f) => !ALLOWED_BODY_ROLE_READS.has(f));
    expect(
      strays,
      `insert(users).values(req.body) is a mass-assign vector. Pass an explicit object with only the allowed fields:\n${strays.join('\n')}`,
    ).toEqual([]);
  });
});
