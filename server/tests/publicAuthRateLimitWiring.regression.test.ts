/**
 * sec-ratelimit-public-auth-endpoints — regression guard.
 *
 * Asserts that the four CodeQL-flagged routes in publicAuthRoutes.ts
 * now carry apiLimiter as route middleware.  We verify wiring via static
 * source inspection rather than a live integration test because:
 *
 *   - The four routes depend on Firebase Admin, Drizzle/PostgreSQL, and
 *     Twilio at import-time.  Spinning up those integrations in vitest
 *     would require test-env credentials that are intentionally absent
 *     from CI.
 *   - Static source inspection is cheaper, deterministic, and fully
 *     sufficient to detect the specific regression (removing the
 *     `apiLimiter` argument from one of the route declarations).
 *
 * The test will FAIL if anyone removes `apiLimiter` from one of these
 * four route declarations, giving a clear signal to fix the security gap
 * before the PR merges.
 *
 * Routes guarded (CodeQL findings):
 *   - GET  /api/simple-auth/me         (~line 113)
 *   - POST /api/consents               (~line 688)
 *   - GET  /api/consents/status        (~line 747)
 *   - GET  /api/admin/auth-events      (~line 1183)
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..');
const SRC = readFileSync(
  resolve(ROOT, 'server/routes/publicAuthRoutes.ts'),
  'utf8'
);

describe('sec-ratelimit-public-auth-endpoints — apiLimiter wiring', () => {
  it('imports apiLimiter from the shared rateLimiter middleware', () => {
    expect(SRC).toMatch(/import\s*\{[^}]*apiLimiter[^}]*\}\s*from\s*['"]\.\.\/middleware\/rateLimiter['"]/);
  });

  it('GET /api/simple-auth/me carries apiLimiter as route middleware', () => {
    expect(SRC).toMatch(
      /publicAuthRouter\.get\(\s*["']\/api\/simple-auth\/me["']\s*,\s*apiLimiter\s*,/
    );
  });

  it('POST /api/consents carries apiLimiter as route middleware', () => {
    expect(SRC).toMatch(
      /publicAuthRouter\.post\(\s*["']\/api\/consents["']\s*,\s*apiLimiter\s*,/
    );
  });

  it('GET /api/consents/status carries apiLimiter as route middleware', () => {
    expect(SRC).toMatch(
      /publicAuthRouter\.get\(\s*["']\/api\/consents\/status["']\s*,\s*apiLimiter\s*,/
    );
  });

  it('GET /api/admin/auth-events carries apiLimiter as route middleware', () => {
    expect(SRC).toMatch(
      /publicAuthRouter\.get\(\s*['"]\/api\/admin\/auth-events['"]\s*,\s*apiLimiter\s*,/
    );
  });
});
