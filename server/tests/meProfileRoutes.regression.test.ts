/**
 * Regression pin — /api/me/profile mount + contract shape.
 *
 * The effects layer arrives in a follow-up commit; this pin catches
 * accidental unmount or drift of the contract's canonical URLs.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const ROUTES = fs.readFileSync(path.join(__dirname, '../routes.ts'), 'utf8');
const ROUTER = fs.readFileSync(path.join(__dirname, '../routes/me-profile.ts'), 'utf8');

describe('MeProfile — mount + contract shape', () => {
  it('imports meProfileRoutes', () => {
    expect(ROUTES).toMatch(/import\s+meProfileRoutes\s+from\s+["']\.\/routes\/me-profile["']/);
  });

  it('mounts under /api/me with Firebase auth + rate limit', () => {
    expect(ROUTES).toMatch(/app\.use\(\s*['"]\/api\/me['"]\s*,\s*validateFirebaseToken\s*,\s*apiLimiter\s*,\s*meProfileRoutes\s*\)/);
  });

  it('router defines GET /profile', () => {
    expect(ROUTER).toMatch(/router\.get\(\s*['"]\/profile['"]/);
  });

  it('router defines PATCH /profile', () => {
    expect(ROUTER).toMatch(/router\.patch\(\s*['"]\/profile['"]/);
  });

  it('router defines the four contact-change endpoints', () => {
    for (const p of ['initiate', 'verify', 'commit', 'cancel']) {
      expect(ROUTER).toMatch(new RegExp(`router\\.post\\(\\s*['"]/contact-change/${p}['"]`));
    }
  });

  it('every handler enforces auth_required (defense in depth)', () => {
    const authGuards = ROUTER.match(/auth_required/g) ?? [];
    // GET + PATCH + 4 contact-change = 6 handlers minimum.
    expect(authGuards.length).toBeGreaterThanOrEqual(6);
  });

  it('handlers return 501 with reason (honest surface until effects wire lands)', () => {
    expect(ROUTER).toMatch(/status\(501\)/);
    expect(ROUTER).toContain("'not_implemented'");
  });

  it('cancel endpoint always succeeds with state=CANCELLED (idempotent)', () => {
    // A caller may cancel a change flow that never existed; the
    // server accepts it without leaking backing state.
    expect(ROUTER).toMatch(/state:\s*['"]CANCELLED['"]/);
  });
});
