/**
 * PR-AUTH-DEDUP-REQUIRE-ADMIN — rbac's `requireAdmin` renamed to
 * `requireSuperAdmin`; the general-admin gate in adminAuth is
 * untouched.
 *
 * Background:
 *   server/adminAuth.ts::requireAdmin       — canonical GENERAL admin
 *     gate: session-cookie or bearer, 4h age gate, accepts
 *     recognised admin roles (staff/ops/finance/regional) OR super
 *     admin.
 *   server/middleware/rbac.ts::requireAdmin — a materially DIFFERENT
 *     gate: lightweight, SUPER_ADMIN_EMAILS allowlist only.
 *     Misleadingly-named — a caller reading `import { requireAdmin }
 *     from '../middleware/rbac'` might reasonably assume the two are
 *     interchangeable and silently downgrade a general-admin route to
 *     super-admin-only (or, worse, silently widen a super-admin route
 *     if the two ever converged).
 *
 * Fix (semantic, NOT behavioural):
 *   Rename rbac's export to `requireSuperAdmin`. Update ONLY the call
 *   sites that were consuming that rbac export. Preserve every gate's
 *   current authorization behaviour exactly:
 *     - unauthenticated caller  → 401 (unchanged)
 *     - super-admin caller      → next()  (unchanged)
 *     - ordinary admin caller   → 403 by requireSuperAdmin (unchanged),
 *                                  200 by adminAuth.requireAdmin
 *                                  (unchanged)
 *     - public user             → 403 (unchanged)
 *
 * Not in scope of this PR (called out explicitly for the next ticket):
 *   - Migrating rbac's gate to isSuperAdminVerified() (auth-behaviour
 *     change — would lock out unverified super-admins).
 *   - Widening any route from super-admin-only to general-admin.
 *   - Touching adminAuth.ts::requireAdmin.
 *   - Touching self-contained inline `requireAdmin` shims in other
 *     route files (admin-provider-verification.ts,
 *     admin-notifications.ts, etc.) — those are separate archetypes
 *     that don't import from rbac.
 *
 * Sections:
 *   A. rbac.ts export surface — old symbol gone, new symbol present
 *   B. adminAuth.ts::requireAdmin intact (behavior unchanged)
 *   C. Every ex-caller of rbac.requireAdmin now imports the new name
 *      AND uses it at every call site
 *   D. No stale `requireAdmin` import from middleware/rbac anywhere
 *   E. No circular import (rbac.ts does NOT import from adminAuth.ts)
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { readdirSync, statSync } from 'fs';
import { resolve, join } from 'path';

const ROOT = resolve(__dirname, '..', '..');
const RBAC = 'server/middleware/rbac.ts';
const ADMIN_AUTH = 'server/adminAuth.ts';

// The full list of files that used to import `requireAdmin` from rbac
// (found via `grep -rEn "from ['\"](\.\.?/)+middleware/rbac['\"]"` +
// `requireAdmin` before the rename). If any file is added to this
// import in the future, it MUST be added to this list so this test
// catches it.
const CALL_SITES: string[] = [
  'server/routes/audit.ts',
  'server/routes/unified-booking.ts',
  'server/routes/devices.ts',
  'server/routes/loyalty.ts',
  'server/routes/control-panel.ts',
  'server/routes/franchise-mgmt.ts',
  'server/routes/israeli-cpi.ts',
  'server/routes/coupons.ts',
  'server/routes/provider-intake.ts',
];

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), 'utf8');
}
function codeOnly(src: string): string {
  let out = src;
  out = out.replace(/\/\*[\s\S]*?\*\//g, '');
  out = out.replace(/(^|[^:])\/\/.*$/gm, '$1');
  return out;
}

// ─────────────────────────────────────────────────────────────────────────
// A. rbac.ts — old symbol gone, new symbol present
// ─────────────────────────────────────────────────────────────────────────
describe('PR-AUTH-DEDUP-REQUIRE-ADMIN — A. rbac export surface', () => {
  const src = read(RBAC);
  const code = codeOnly(src);

  it('A1. rbac.ts exports requireSuperAdmin as a named export', () => {
    expect(/export\s+function\s+requireSuperAdmin\s*\(/.test(code)).toBe(true);
  });

  it('A2. rbac.ts NO LONGER exports the misleadingly-named requireAdmin', () => {
    // No `export function requireAdmin(` and no `export ... requireAdmin`
    // in the default-object literal either. Comment references are OK
    // (they are stripped by codeOnly).
    expect(/export\s+function\s+requireAdmin\s*\(/.test(code)).toBe(false);
    expect(/export\s+const\s+requireAdmin\b/.test(code)).toBe(false);
    // Default export object must not carry the old key either.
    const defaultExport = code.match(/export\s+default\s*\{[\s\S]*?^\}\s*;?/m)?.[0] || '';
    expect(/\brequireAdmin\b/.test(defaultExport)).toBe(false);
    expect(/\brequireSuperAdmin\b/.test(defaultExport)).toBe(true);
  });

  it('A3. requireSuperAdmin body preserves the pre-rename behavior contract', () => {
    // 401 on missing firebaseUser.email; check isSuperAdmin(email) → next();
    // 403 else; same shapes the pre-rename requireAdmin returned.
    const body =
      code.match(/export\s+function\s+requireSuperAdmin\s*\([\s\S]*?^\}/m)?.[0] || '';
    expect(/if\s*\(\s*!\s*req\.firebaseUser\?\.email\s*\)/.test(body)).toBe(true);
    expect(/res\.status\(\s*401\s*\)/.test(body)).toBe(true);
    expect(/if\s*\(\s*isSuperAdmin\s*\(\s*userEmail\s*\)\s*\)\s*\{[\s\S]{0,80}?return\s+next\(\s*\)/.test(body)).toBe(true);
    expect(/res\.status\(\s*403\s*\)/.test(body)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// B. adminAuth.ts — untouched, still the general-admin gate
// ─────────────────────────────────────────────────────────────────────────
describe('PR-AUTH-DEDUP-REQUIRE-ADMIN — B. adminAuth.requireAdmin intact', () => {
  const src = read(ADMIN_AUTH);
  const code = codeOnly(src);

  it('B1. adminAuth.ts still exports requireAdmin', () => {
    expect(/export\s+const\s+requireAdmin\s*=/.test(code)).toBe(true);
  });

  it('B2. adminAuth.requireAdmin still accepts general admin roles via isAdminRole (not narrowed to super-admin-only)', () => {
    // The pre-existing acceptance criterion:
    //   const hasAdminClaim = isSuperAdminUser || isAdminRole(role) || isAdminRole(claims.role);
    // Grep-pin so a well-meaning refactor cannot silently narrow it.
    expect(
      /const\s+hasAdminClaim\s*=\s*isSuperAdminUser\s*\|\|\s*isAdminRole\(\s*role\s*\)\s*\|\|\s*isAdminRole\(\s*claims\.role\s*\)/.test(code),
    ).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// C. Every ex-caller uses the new name
// ─────────────────────────────────────────────────────────────────────────
describe('PR-AUTH-DEDUP-REQUIRE-ADMIN — C. call sites migrated', () => {
  for (const rel of CALL_SITES) {
    describe(`  ${rel}`, () => {
      const src = read(rel);
      const code = codeOnly(src);

      it('imports requireSuperAdmin from ../middleware/rbac', () => {
        expect(
          /import\s*\{[^}]*\brequireSuperAdmin\b[^}]*\}\s*from\s*['"](\.\.?\/)+middleware\/rbac['"]/.test(code),
        ).toBe(true);
      });

      it('does NOT still import requireAdmin from middleware/rbac', () => {
        expect(
          /import\s*\{[^}]*\brequireAdmin\b[^}]*\}\s*from\s*['"](\.\.?\/)+middleware\/rbac['"]/.test(code),
        ).toBe(false);
      });

      it('uses requireSuperAdmin at every call site (no bare requireAdmin symbol remaining in code)', () => {
        // If the file also imports the general-admin `requireAdmin`
        // from adminAuth for some routes, that is fine — but the
        // ex-rbac call sites should NOT still be reading `requireAdmin`
        // that would resolve to whichever import happens to win at
        // scope. The safe check: this file's code section must not
        // reference a bare `requireAdmin` identifier that isn't
        // qualified. As of the rename, none of these files use
        // adminAuth's export either, so the identifier should be
        // completely absent.
        expect(/\brequireAdmin\b/.test(code)).toBe(false);
      });
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// D. Repo-wide: no stale `requireAdmin` import from middleware/rbac
// ─────────────────────────────────────────────────────────────────────────
describe('PR-AUTH-DEDUP-REQUIRE-ADMIN — D. no stale rbac requireAdmin imports', () => {
  function walk(dir: string, out: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
      // Skip node_modules and build outputs
      if (name === 'node_modules' || name === 'dist' || name === '.git' || name === 'build') continue;
      const p = join(dir, name);
      let s;
      try { s = statSync(p); } catch { continue; }
      if (s.isDirectory()) walk(p, out);
      else if (/\.(ts|tsx|js|mjs|cjs)$/.test(name)) out.push(p);
    }
    return out;
  }

  it('D1. no file in the repo imports `requireAdmin` from a middleware/rbac path', () => {
    const files = walk(resolve(ROOT, 'server'));
    const offenders: string[] = [];
    for (const f of files) {
      const src = readFileSync(f, 'utf8');
      // Skip the test file itself (mentions the identifier in prose).
      if (f.endsWith('authDedupRequireAdmin.regression.test.ts')) continue;
      const code = codeOnly(src);
      if (
        /import\s*\{[^}]*\brequireAdmin\b[^}]*\}\s*from\s*['"](\.\.?\/)+middleware\/rbac['"]/.test(code)
      ) {
        offenders.push(f.replace(ROOT + '/', ''));
      }
    }
    expect(offenders).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// E. No circular import (rbac.ts must not depend on adminAuth.ts)
// ─────────────────────────────────────────────────────────────────────────
describe('PR-AUTH-DEDUP-REQUIRE-ADMIN — E. no circular import', () => {
  const src = read(RBAC);
  const code = codeOnly(src);

  it('E1. rbac.ts does NOT import from adminAuth.ts (adminAuth depends on rbac, not the reverse)', () => {
    expect(/from\s*['"](\.\.?\/)*adminAuth['"]/.test(code)).toBe(false);
    expect(/import\s*\(\s*['"](\.\.?\/)*adminAuth['"]\s*\)/.test(code)).toBe(false);
  });
});
