/**
 * Regression pin — /api/me/profile mount + contract shape.
 *
 * GET + PATCH are wired end-to-end (users row read + UpdateProfileService
 * write + Firebase displayName fan-out). The four contact-change
 * endpoints are still 501 pending the OTP + Redis wire; the pin
 * asserts both realities.
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

  it('GET and PATCH are wired to real DB + UpdateProfileService (no 501 on the primary paths)', () => {
    // GET reads users via drizzle.
    expect(ROUTER).toContain('db.select().from(users)');
    // PATCH calls the pure UpdateProfileService with real WriteEffects.
    expect(ROUTER).toContain('updateProfile(');
    expect(ROUTER).toContain('makeEffects(uid)');
    // Firebase displayName fan-out uses the admin SDK.
    expect(ROUTER).toContain("admin.auth().updateUser");
  });

  it('contact-change initiate / verify / commit are still 501 with reason (awaiting OTP + Redis wire)', () => {
    // 3 out of 4 contact-change endpoints still 501. Cancel is a
    // real 200 already (idempotent).
    const notImplementedCount = (ROUTER.match(/status\(501\)/g) ?? []).length;
    expect(notImplementedCount).toBeGreaterThanOrEqual(3);
    expect(ROUTER).toContain("'not_implemented'");
    expect(ROUTER).toContain('awaiting_otp_wire');
  });

  it('cancel endpoint always succeeds with state=CANCELLED (idempotent)', () => {
    // A caller may cancel a change flow that never existed; the
    // server accepts it without leaking backing state.
    expect(ROUTER).toMatch(/state:\s*['"]CANCELLED['"]/);
  });
});
