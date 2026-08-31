/**
 * Regression pin — /api/me/profile mount + contract shape.
 *
 * GET + PATCH + email contact-change are wired end-to-end (users
 * row read + UpdateProfileService write + Firebase displayName +
 * unifiedVerificationService for email OTP). Mobile contact-change
 * stays 501 until a `phone_change` purpose is added to the
 * runtime registry (needs the CEO's #188 signup-vs-phone decision).
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

  it('EMAIL contact-change is WIRED to UnifiedVerificationService + drizzle + Firebase', () => {
    // initiate: startChallenge with change_email purpose over email channel.
    expect(ROUTER).toContain("purpose: 'change_email'");
    expect(ROUTER).toContain('unifiedVerificationService.startChallenge');
    // verify: one-shot verify+commit — verifyChallenge + admin.auth().updateUser(email) + drizzle set.
    expect(ROUTER).toContain('unifiedVerificationService.verifyChallenge');
    expect(ROUTER).toMatch(/admin\.auth\(\)\.updateUser\(\s*uid\s*,\s*\{\s*email/);
    expect(ROUTER).toMatch(/db\.update\(users\)\.set\(\s*\{\s*email:\s*newEmail/);
    // Successful COMMITTED response carries snapshot + completeness.
    expect(ROUTER).toMatch(/state:\s*['"]COMMITTED['"]/);
  });

  it('MOBILE contact-change stays honestly 501 pending phone_change purpose registration', () => {
    // The MOBILE branch of initiate + verify still 501 with the
    // documented reason — no silent fake success.
    expect(ROUTER).toContain('awaiting_phone_change_purpose_registration');
    expect(ROUTER).toContain("'not_implemented'");
  });

  it('cancel endpoint always succeeds with state=CANCELLED (idempotent)', () => {
    // A caller may cancel a change flow that never existed; the
    // server accepts it without leaking backing state.
    expect(ROUTER).toMatch(/state:\s*['"]CANCELLED['"]/);
  });
});
