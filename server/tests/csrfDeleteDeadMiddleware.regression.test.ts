/**
 * PR-AUTH-CSRF-DELETE-DEAD-MIDDLEWARE — the two hand-rolled CSRF
 * middleware files that were never mounted are removed. The LIVE
 * production CSRF gate (doubleCsrfProtection from `csrf-csrf` in
 * server/index.ts) is untouched.
 *
 * Background:
 *   The audit backlog listed a "CSRF DECISION — wire OR delete the
 *   dead middleware". The actual repo state is:
 *
 *     - LIVE:  server/index.ts uses `doubleCsrfProtection` from the
 *              csrf-csrf library, mounted globally with a curated
 *              exemption list. Recently P0-fixed in #1756 (getSessionIdentifier).
 *              This gate is untouched.
 *
 *     - DEAD:  server/middleware/csrfProtection.ts (hand-rolled
 *              session-token CSRF: setCsrfToken / verifyCsrfToken /
 *              csrfTokenEndpoint / generateCsrfToken). Zero importers
 *              in server, client, or tests.
 *
 *     - DEAD:  server/webauthn/csrfProtection.ts (hand-rolled
 *              WebAuthn-scoped CSRF: generateWebAuthnCsrfToken /
 *              ensureWebAuthnSession). Zero importers.
 *
 *   Both dead files originate from the initial 2024 upload and were
 *   superseded by the csrf-csrf library approach. Keeping them was a
 *   trap — a well-meaning future author might import the wrong one
 *   and silently split the CSRF gate in two, creating a bypass surface.
 *
 * Fix: delete both dead files. The LIVE gate is untouched. Behaviour
 * change: zero (the deleted files had no importers).
 *
 * Sections:
 *   A. Dead files are gone
 *   B. No file in the repo imports the deleted symbols
 *   C. The LIVE csrf-csrf gate in server/index.ts is intact
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { resolve, join } from 'path';

const ROOT = resolve(__dirname, '..', '..');
const DEAD_FILES = [
  'server/middleware/csrfProtection.ts',
  'server/webauthn/csrfProtection.ts',
];
const INDEX = 'server/index.ts';

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
// A. Dead files are gone
// ─────────────────────────────────────────────────────────────────────────
describe('PR-AUTH-CSRF-DELETE-DEAD-MIDDLEWARE — A. dead files removed', () => {
  for (const rel of DEAD_FILES) {
    it(`A. ${rel} does not exist`, () => {
      expect(existsSync(resolve(ROOT, rel))).toBe(false);
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// B. No file in the repo imports the deleted symbols/paths
// ─────────────────────────────────────────────────────────────────────────
describe('PR-AUTH-CSRF-DELETE-DEAD-MIDDLEWARE — B. no importer resurfaces', () => {
  function walk(dir: string, out: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name === 'dist' || name === '.git' || name === 'build') continue;
      const p = join(dir, name);
      let s;
      try { s = statSync(p); } catch { continue; }
      if (s.isDirectory()) walk(p, out);
      else if (/\.(ts|tsx|js|mjs|cjs)$/.test(name)) out.push(p);
    }
    return out;
  }

  const SELF = resolve(__dirname, 'csrfDeleteDeadMiddleware.regression.test.ts');

  it('B1. no file imports from server/middleware/csrfProtection or server/webauthn/csrfProtection', () => {
    const files = walk(resolve(ROOT, 'server')).concat(walk(resolve(ROOT, 'client')));
    const offenders: string[] = [];
    for (const f of files) {
      if (f === SELF) continue;
      const src = readFileSync(f, 'utf8');
      const code = codeOnly(src);
      if (/from\s*['"](\.\.?\/)+middleware\/csrfProtection['"]/.test(code)) {
        offenders.push(`${f} imports from ../middleware/csrfProtection`);
      }
      if (/from\s*['"](\.\.?\/)+webauthn\/csrfProtection['"]/.test(code)) {
        offenders.push(`${f} imports from ../webauthn/csrfProtection`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('B2. no file references the exported symbols by name (grep-pin against silent copy-paste revival)', () => {
    // If a future author copy-pastes the deleted setCsrfToken /
    // verifyCsrfToken / generateWebAuthnCsrfToken helpers into a new
    // location and calls them, this test fires. The symbols are
    // specific enough that a legitimate new use would be an explicit
    // decision — not something that should sneak in unnoticed.
    const files = walk(resolve(ROOT, 'server')).concat(walk(resolve(ROOT, 'client')));
    const DELETED_SYMBOLS = [
      'setCsrfToken',
      'verifyCsrfToken',
      'csrfTokenEndpoint',
      'generateWebAuthnCsrfToken',
      'ensureWebAuthnSession',
    ];
    const offenders: string[] = [];
    for (const f of files) {
      if (f === SELF) continue;
      const src = readFileSync(f, 'utf8');
      const code = codeOnly(src);
      for (const sym of DELETED_SYMBOLS) {
        const re = new RegExp(`\\b${sym}\\b`);
        if (re.test(code)) {
          offenders.push(`${f} references deleted symbol ${sym}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// C. The LIVE csrf-csrf gate in server/index.ts is intact
// ─────────────────────────────────────────────────────────────────────────
describe('PR-AUTH-CSRF-DELETE-DEAD-MIDDLEWARE — C. live gate untouched', () => {
  // NOTE: index.ts contains embedded `*/` sequences inside string
  // literals (URL fragments in explanatory comments) which confuse the
  // simple codeOnly() comment-stripper. These pins live on unique
  // single-line signatures so raw-source grep is fine (and safer).
  const src = read(INDEX);

  it('C1. doubleCsrf from csrf-csrf is still configured', () => {
    // Pin: `const { doubleCsrfProtection, generateCsrfToken } = doubleCsrf({`
    expect(/doubleCsrfProtection\s*,\s*generateCsrfToken\s*\}\s*=\s*doubleCsrf\(/.test(src)).toBe(true);
  });

  it('C2. doubleCsrfProtection is mounted globally via app.use', () => {
    // The gate itself. If this ever disappears we lose CSRF protection
    // on the anonymous / cookie-authed POST surface.
    expect(/app\.use\(\s*doubleCsrfProtection\s*\)/.test(src)).toBe(true);
  });

  it('C3. /api/csrf-token GET endpoint still returns generateCsrfToken', () => {
    // Without this endpoint the SPA cannot fetch a fresh pw.csrf cookie.
    expect(/app\.get\(\s*['"]\/api\/csrf-token['"]/.test(src)).toBe(true);
    expect(/generateCsrfToken\(\s*req\s*,\s*res\s*\)/.test(src)).toBe(true);
  });

  it('C4. Bearer-authenticated requests skip CSRF (the mechanism most of the API uses)', () => {
    // If this skip is removed, every authenticated Bearer POST from
    // the dashboards would demand a token that the client never sends.
    // Pin the exact skip guard so a well-meaning "harden CSRF"
    // refactor cannot silently 403 every dashboard action.
    expect(/authHeader\?\.startsWith\(['"]Bearer /.test(src)).toBe(true);
  });

  it('C5. the pw.csrf cookie name is preserved', () => {
    // Renaming this would immediately invalidate every live session's
    // pending token round-trip (each SPA holds the old cookie name).
    expect(/cookieName:\s*['"]pw\.csrf['"]/.test(src)).toBe(true);
  });
});
