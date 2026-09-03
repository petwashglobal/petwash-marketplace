/**
 * Regression pin — /api/simple-auth/* write endpoints stay retired.
 *
 * Auth-rebuild Phase 10.b retired the entire /api/simple-auth/* write
 * surface. Each of those endpoints was creating identities in the
 * `customers` table with a session-cookie identity that had NO Firebase
 * UID — every account minted that way was a ghost that could sign in
 * but could NOT participate in loyalty, bookings, payouts, wallet,
 * provider or admin flows.
 *
 * The retired endpoints now return 410 GONE:
 *   POST /api/simple-auth/signup
 *   POST /api/simple-auth/login
 *   POST /api/simple-auth/logout
 *
 * GET /api/simple-auth/me remains LIVE, served by publicAuthRouter —
 * it is a read-only shim (returns 200 for logged-out, session-derived
 * user for logged-in) used by the mobile clean-console mode. That
 * one is NOT retired.
 *
 * If this pin fails, someone re-added a working handler for one of
 * the three retired endpoints — reject that change and instead route
 * the caller through the canonical flow:
 *   Firebase Auth → POST /api/auth/session → POST /api/users/create-profile
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..', '..');
const routes = readFileSync(join(ROOT, 'server/routes.ts'), 'utf8');

const RETIRED_ENDPOINTS = [
  { method: 'post', path: '/api/simple-auth/signup' },
  { method: 'post', path: '/api/simple-auth/login' },
  { method: 'post', path: '/api/simple-auth/logout' },
];

describe('simple-auth write endpoints retired (410 GONE)', () => {
  for (const { method, path } of RETIRED_ENDPOINTS) {
    it(`${method.toUpperCase()} ${path} responds 410`, () => {
      // Match the handler for this endpoint and require it to reach a 410 branch.
      // We do this per-endpoint so it's clear which one regressed.
      const escapedPath = path.replace(/\//g, '\\/');
      const handlerRegex = new RegExp(
        `app\\.${method}\\(\\s*['"]${escapedPath}['"][\\s\\S]{0,1200}?res\\.status\\(410\\)`,
      );
      expect(
        handlerRegex.test(routes),
        `${method.toUpperCase()} ${path} must return 410 GONE (auth-rebuild Phase 10.b)`,
      ).toBe(true);
    });
  }

  it('routes.ts must not import verifyPassword from ./simpleAuth (dead after 10.b)', () => {
    // The only caller was the retired /login handler. If this import
    // comes back, someone is likely re-adding password verification
    // against the ghost `customers` table — the exact path 10.b closed.
    const badImports = [
      /import\s*\{[^}]*\bverifyPassword\b[^}]*\}\s*from\s*['"]\.\/simpleAuth['"]/,
      /await\s+import\(\s*['"]\.\/simpleAuth['"]\s*\)/,
    ];
    for (const re of badImports) {
      expect(re.test(routes), `routes.ts must not re-import from ./simpleAuth (${re})`).toBe(false);
    }
  });
});
