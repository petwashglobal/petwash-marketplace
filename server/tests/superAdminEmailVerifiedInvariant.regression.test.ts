/**
 * Regression pin — SUPER_ADMIN elevation requires email_verified
 * (CEO invariant, audit item 199 / D6-adjacent).
 *
 * The failure mode this pin defends against is the shape
 *
 *   if (isSuperAdmin(email)) { grant super-admin }
 *
 * where the email allowlist match alone clears the gate. Firebase
 * allows a user to sign up with any email address they type; the
 * email is UNVERIFIED until they click the confirmation link. That
 * means anyone can create a Firebase account under
 * `<admin>@petwash.co.il` (as long as the real owner never claimed
 * it) and clear the naive allowlist check.
 *
 * The fix landed in server/middleware/rbac.ts:
 *   - Only `isSuperAdminVerified(req)` (which checks BOTH the
 *     email allowlist AND req.firebaseUser.email_verified === true)
 *     may be used as an authority signal.
 *   - The bare `isSuperAdmin(email)` helper still exists as a
 *     data-only utility, but every one of its callers must be
 *     paired with an `email_verified === true` check in the same
 *     branch.
 *
 * This pin walks the server tree (node:fs only — see sourceFiles) and
 * refuses:
 *   1. any `isSuperAdmin(<expr>)` call outside rbac.ts that is not
 *      paired with an `email_verified === true` check nearby, or
 *      replaced by `isSuperAdminVerified`;
 *   2. inside rbac.ts, any bare `isSuperAdmin(...)` outside the
 *      enumerated definition/wrapper lines. rbac.ts is exempt from (1)
 *      because pinning the definition module against itself is
 *      circular — but that blanket exemption is exactly what let FIVE
 *      of rbac.ts's own gates (requireAdmin, requireInternalAccount,
 *      blockPublicUser, requireMinRole, enforceSelfOnly) keep the bare
 *      allowlist check long after every other call site was migrated;
 *   3. a second, locally-parsed `SUPER_ADMINS` array used as the sole
 *      authority (gates.ts had one; it drifted — no CI-placeholder
 *      detection, and module-load-time parsing ignored secret
 *      rotation until restart);
 *   4. `isSuperAdminVerified` called with anything but a Request, or
 *      awaited. It is SYNCHRONOUS and reads
 *      `req.firebaseUser.email_verified`; given an email string it
 *      returns the primitive `false`, and `.catch` on a boolean throws
 *      `TypeError: false.catch is not a function` — a 500 for every
 *      caller of the route, not a silent deny.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..', '..');

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'coverage', '.next', 'tests',
  // '.claude' holds git worktrees — full checkouts of this repo at older
  // SHAs. Walking them made this pin scan every historical copy of the tree
  // and report their pre-fix call-sites as live offenders: 735 phantom
  // failures locally (CI was green only because a clean checkout has no
  // worktrees). The invariant is about THIS working tree, so skip them.
  '.claude',
]);

/**
 * Walk the repo for .ts sources.
 *
 * This used to shell out to `rg`. That made the pin depend on ripgrep
 * being installed: when it is missing, execSync throws with status 127,
 * which the old catch (`if (err?.status === 1) return []`) did not
 * handle, so the whole pin ERRORED instead of reporting. A security
 * invariant must not be silently contingent on a developer tool being
 * on PATH — this walker uses only node:fs.
 */
let _fileCache: string[] | null = null;
const _srcCache = new Map<string, string>();

/** Read a source file once, then serve it from memory. */
function readSource(file: string): string {
  let src = _srcCache.get(file);
  if (src === undefined) {
    src = readFileSync(file, 'utf8');
    _srcCache.set(file, src);
  }
  return src;
}

function sourceFiles(): string[] {
  if (_fileCache) return _fileCache;
  const out: string[] = [];
  const walk = (dir: string) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = join(dir, e.name);
      if (e.isDirectory()) {
        if (SKIP_DIRS.has(e.name)) continue;
        walk(full);
      } else if (e.name.endsWith('.ts') && !e.name.endsWith('.d.ts')) {
        const rel = full.replace(ROOT + '/', '');
        if (rel.startsWith('server/tests/')) continue;
        out.push(full);
      }
    }
  };
  walk(ROOT);
  _fileCache = out;
  return out;
}

/** `<abs file>:<1-based line>` for every line matching `re`. */
function grepRepo(re: RegExp): string[] {
  // Compile ONCE. Rebuilding the RegExp per line (the previous shape) cost
  // enough over a repo this size to blow vitest's 5s default test timeout.
  const lineRe = new RegExp(re.source);
  const hits: string[] = [];
  for (const file of sourceFiles()) {
    let src: string;
    try {
      src = readSource(file);
    } catch {
      continue;
    }
    lineRe.lastIndex = 0;
    if (!lineRe.test(src)) continue;
    const lines = src.split('\n');
    for (let i = 0; i < lines.length; i++) {
      lineRe.lastIndex = 0;
      if (lineRe.test(lines[i])) hits.push(`${file}:${i + 1}`);
    }
  }
  return hits;
}

// Scanning several thousand source files is legitimately slower than the
// 5s default. Warm the caches once and give the scanning clauses room.
const SCAN_TIMEOUT_MS = 120_000;

/** Lines around `lineNo` (1-based), used to look for a paired check. */
function windowAround(file: string, lineNo: number, radius = 8): string {
  const lines = readSource(file).split('\n');
  return lines.slice(Math.max(0, lineNo - radius), Math.min(lines.length, lineNo + radius)).join('\n');
}

describe('CEO invariant — SUPER_ADMIN elevation requires email_verified', () => {
  beforeAll(() => {
    // Pay the walk + read cost once, so it is not billed to whichever
    // clause happens to run first.
    for (const f of sourceFiles()) readSource(f);
  }, SCAN_TIMEOUT_MS);

  it('rbac.ts anchors the paired shape (isSuperAdmin + email_verified === true)', () => {
    const src = readFileSync(join(ROOT, 'server/middleware/rbac.ts'), 'utf8');
    // The canonical isSuperAdminVerified helper must exist and gate on
    // email_verified strict-equality (never `!fu.email_verified`, which
    // treats `undefined` and `false` alike but not the string 'true').
    expect(src).toMatch(/export function isSuperAdminVerified\(req: Request\): boolean/);
    expect(src).toMatch(/fu\.email_verified\s*!==\s*true/);
    // The one other call site that unrolls the pair MUST also test
    // strict-equality to true.
    expect(src).toMatch(/isSuperAdmin\([^)]+\)\s*&&\s*req\.firebaseUser\.email_verified\s*===\s*true/);
  });

  it('unpaired isSuperAdmin(...) call-sites must not GROW past the ceiling', () => {
    // Any file that calls isSuperAdmin(...) — outside the helper module
    // and outside the tests dir — SHOULD either
    //   (a) additionally test `email_verified === true` within the same
    //       small window, OR
    //   (b) use the wrapper isSuperAdminVerified(req) instead.
    //
    // A call that fails BOTH is the audit-199 anti-pattern.
    //
    // Today's count is CEILING — every new bare isSuperAdmin() call
    // pushes over the ceiling and fails the pin. Migrations to the
    // paired shape (or to isSuperAdminVerified) DROP the count and the
    // ceiling ratchets down in follow-up commits. When the count reaches
    // 0, this pin becomes the strict "MUST pair" invariant.
    const hits = grepRepo(/\bisSuperAdmin\s*\(/);
    const strays: string[] = [];
    for (const hit of hits) {
      const idx = hit.lastIndexOf(':');
      const file = hit.slice(0, idx);
      const lineNo = parseInt(hit.slice(idx + 1), 10);
      const rel = file.replace(ROOT + '/', '');
      if (rel === 'server/middleware/rbac.ts') continue; // covered by its own `it` below
      const window = windowAround(file, lineNo);
      const usesWrapper = /isSuperAdminVerified\s*\(/.test(window);
      const hasVerifiedCheck = /email_verified\s*===\s*true/.test(window);
      if (usesWrapper || hasVerifiedCheck) continue;
      strays.push(`${rel}:${lineNo}`);
    }
    // #240 migration: production runtime is now clean. STRICT ceiling —
    // any new bare isSuperAdmin() call-site outside rbac.ts, without a
    // paired email_verified === true check nearby, fails the pin.
    const CEILING = 0;
    expect(
      strays.length,
      `unpaired isSuperAdmin(...) call-sites: ${strays.length} — must be 0. New offenders:\n${strays.join('\n')}`,
    ).toBeLessThanOrEqual(CEILING);
  }, SCAN_TIMEOUT_MS);

  // ── The blind spot ────────────────────────────────────────────────
  // The clause above SKIPS server/middleware/rbac.ts, because that file
  // is where the paired shape is defined and pinning it against itself
  // is circular. That exemption was load-bearing for the pin and a hole
  // in the codebase: rbac.ts is the module every route imports its
  // guards from, and FIVE of its own gates (requireAdmin,
  // requireInternalAccount, blockPublicUser, requireMinRole,
  // enforceSelfOnly) cleared on the bare allowlist for exactly as long
  // as the exemption existed. This clause replaces the blanket skip
  // with a narrow, enumerated one.
  it('rbac.ts itself may call bare isSuperAdmin ONLY where the pair is defined', () => {
    const file = join(ROOT, 'server/middleware/rbac.ts');
    const lines = readFileSync(file, 'utf8').split('\n');
    const offenders: string[] = [];

    lines.forEach((line, i) => {
      if (!/\bisSuperAdmin\s*\(/.test(line)) return;
      // Legitimate, enumerated shapes inside the definition module:
      //   1. the definition itself / the JSDoc-documented wrappers
      //      (isSuperAdminAllowlisted, isSuperAdminVerified) delegating
      //      to the primitive;
      //   2. an inline use that spells out the pair on the same line.
      const isDefinition = /export function isSuperAdmin\s*\(/.test(line);
      const isWrapperDelegation = /^\s*return isSuperAdmin\(email\);\s*$/.test(line);
      const spellsOutThePair =
        /isSuperAdmin\([^)]*\)\s*&&[^;]*email_verified\s*===\s*true/.test(line);
      if (isDefinition || isWrapperDelegation || spellsOutThePair) return;
      offenders.push(`server/middleware/rbac.ts:${i + 1}: ${line.trim()}`);
    });

    expect(
      offenders,
      'rbac.ts gates must use isSuperAdminVerified(req), not the bare ' +
        'allowlist primitive. Offending lines:\n' + offenders.join('\n'),
    ).toEqual([]);
  });

  // ── No second allowlist ───────────────────────────────────────────
  // gates.ts used to parse SUPER_ADMIN_EMAILS itself into a SUPER_ADMINS
  // array and match on it directly. A duplicate allowlist drifts: it
  // missed rbac's CI-placeholder detection, and being module-load-time
  // it ignored a rotated secret until restart. Membership tests against
  // any such local array must be paired with the verified primitive.
  it('a local SUPER_ADMIN array must never be the sole authority', () => {
    const offenders: string[] = [];
    for (const hit of grepRepo(/SUPER_ADMINS?\s*\.\s*includes\s*\(/)) {
      const idx = hit.lastIndexOf(':');
      const file = hit.slice(0, idx);
      const lineNo = parseInt(hit.slice(idx + 1), 10);
      const window = windowAround(file, lineNo);
      if (/isSuperAdminVerified\s*\(/.test(window)) continue;
      if (/email_verified\s*===\s*true/.test(window)) continue;
      offenders.push(`${file.replace(ROOT + '/', '')}:${lineNo}`);
    }
    expect(
      offenders,
      'SUPER_ADMINS.includes(...) used as the sole authority — pair it ' +
        'with isSuperAdminVerified(req), or import the rbac primitive ' +
        'instead of re-parsing SUPER_ADMIN_EMAILS:\n' + offenders.join('\n'),
    ).toEqual([]);
  }, SCAN_TIMEOUT_MS);

  // ── No THIRD allowlist either ─────────────────────────────────────
  // The clause above catches a named SUPER_ADMINS array. Several routes
  // instead parsed process.env.SUPER_ADMIN_EMAILS inline into a local
  // (adminEmails / _superAdminEmails / AUTHORIZED_USERS) and matched the
  // email string — invisible to every other clause, because the word
  // "isSuperAdmin" never appears. police-check, admin-provider-review,
  // admin-reconfirmation, backup and push-notifications all shipped that
  // way. Any file that parses the secret itself must also carry the
  // email_verified pairing, or be enumerated below as a non-authorization
  // use with a stated reason.
  it('no file may parse SUPER_ADMIN_EMAILS into its own gate without email_verified', () => {
    // Files that legitimately touch the secret but do NOT authorize with it.
    const NON_AUTHORIZATION: Record<string, string> = {
      'server/index.ts':
        'startup env-var validation — checks the secret is set, grants nothing',
      'server/routes/recaptcha.ts':
        'health readout — reports whether the secret is configured',
      'server/services/SmsAbuseDetector.ts':
        'picks the alert recipient address — not a gate',
      'server/routes/control-panel.ts':
        'only names the secret in a comment; gate is the imported requireAdmin',
      'server/company-registration-secure.ts':
        'isAuthorizedUser() checks a PARAMETER, not the request caller; it is a '
        + 'defense-in-depth second layer behind requireAdmin at '
        + 'routes.ts /api/admin/company-registration, never the sole authority',
    };

    const offenders: string[] = [];
    for (const file of sourceFiles()) {
      const src = readSource(file);
      if (!/process\.env\.SUPER_ADMIN_EMAILS/.test(src)) continue;
      const rel = file.replace(ROOT + '/', '');
      if (rel in NON_AUTHORIZATION) continue;
      if (/isSuperAdminVerified\s*\(/.test(src)) continue;
      // Accept any real verification test — `email_verified === true`,
      // `emailVerified !== true` (early-return shape), `!emailVerified`.
      // NOT `!== false`: that is banned outright by the clause below.
      if (/email_?[Vv]erified/.test(src)) continue;
      offenders.push(
        `${rel} — parses SUPER_ADMIN_EMAILS but never checks email_verified`,
      );
    }
    expect(
      offenders,
      'Import isSuperAdminVerified from server/middleware/rbac instead of '
        + 're-parsing the secret, or add the file to NON_AUTHORIZATION with a '
        + 'reason:\n' + offenders.join('\n'),
    ).toEqual([]);
  }, SCAN_TIMEOUT_MS);

  // ── `!== false` is never a verification check ─────────────────────
  // publicAuthRoutes.ts gated /api/admin/auth-events on
  //     decodedToken.email_verified !== false
  // Firebase OMITS email_verified for several sign-in paths, so for the
  // unverified accounts this exists to stop the claim is `undefined`, and
  // `undefined !== false` is true. The check handed the gate to precisely
  // the callers it was written to deny. Only the boolean `true` counts.
  it('email_verified is never tested with !== false (undefined would pass)', () => {
    const offenders: string[] = [];
    for (const hit of grepRepo(/email_?[Vv]erified\s*!==\s*false/)) {
      const idx = hit.lastIndexOf(':');
      const file = hit.slice(0, idx);
      const lineNo = parseInt(hit.slice(idx + 1), 10);
      const line = readSource(file).split('\n')[lineNo - 1];
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) continue; // prose about the bug
      offenders.push(`${file.replace(ROOT + '/', '')}:${lineNo}`);
    }
    expect(
      offenders,
      'Use `email_verified === true`. `!== false` treats a MISSING claim as '
        + 'verified:\n' + offenders.join('\n'),
    ).toEqual([]);
  }, SCAN_TIMEOUT_MS);

  // ── Call it correctly ─────────────────────────────────────────────
  // isSuperAdminVerified is SYNCHRONOUS and takes the Express Request —
  // it has to read req.firebaseUser.email_verified. Two #240 call sites
  // passed an email STRING and awaited the result:
  //     await isSuperAdminVerified(email).catch(() => false)
  // With a string there is no firebaseUser, so it returns the primitive
  // `false`, and `.catch` on a boolean throws
  // `TypeError: false.catch is not a function`. That is not a silent
  // deny — it 500'd every caller of the route, owner and admin alike.
  it('isSuperAdminVerified is passed a Request and never awaited', () => {
    const offenders: string[] = [];
    for (const hit of grepRepo(/isSuperAdminVerified\s*\(/)) {
      const idx = hit.lastIndexOf(':');
      const file = hit.slice(0, idx);
      const lineNo = parseInt(hit.slice(idx + 1), 10);
      const rel = file.replace(ROOT + '/', '');
      if (rel === 'server/middleware/rbac.ts') continue; // the definition
      const line = readSource(file).split('\n')[lineNo - 1];
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) continue; // prose about it
      if (/^\s*import\s|from '.*rbac'/.test(line)) continue;

      if (/await\s+isSuperAdminVerified/.test(line) || /isSuperAdminVerified\s*\([^)]*\)\s*\.\s*(then|catch)/.test(line)) {
        offenders.push(`${rel}:${lineNo}: awaited/thenable — it returns a plain boolean`);
        continue;
      }
      // The argument must look like a request, not an email string.
      const m = line.match(/isSuperAdminVerified\s*\(([^)]*)\)/);
      if (m && !/^\s*(req|_req|request|authReq)\b/.test(m[1])) {
        offenders.push(`${rel}:${lineNo}: argument \`${m[1].trim()}\` is not a Request`);
      }
    }
    expect(
      offenders,
      'isSuperAdminVerified(req) takes the Express Request and returns a ' +
        'boolean synchronously:\n' + offenders.join('\n'),
    ).toEqual([]);
  }, SCAN_TIMEOUT_MS);
});
