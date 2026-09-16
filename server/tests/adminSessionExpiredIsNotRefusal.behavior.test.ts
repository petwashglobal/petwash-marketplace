import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * AN EXPIRED SESSION IS NOT A REFUSAL.
 *
 * 2026-09-17: the CEO opened /admin/paw-finder in his own signed-in Chrome and
 * got the full-page wall "אין הרשאת גישה — this account is not authorised for
 * the PetWash admin area". Nothing was wrong with his account: the admin
 * session is capped at 4h (ADMIN_SESSION_MAX_AGE_SECONDS = 14400) and his was
 * older. The server says so explicitly — 401 with sessionExpired: true — but
 * the client threw that away and fell through to the access-denied screen.
 */
const R = (p: string) => readFileSync(resolve(__dirname, '..', '..', p), 'utf8');

describe('the client keeps the server\'s reason', () => {
  const hook = R('client/src/hooks/useAdminAuth.ts');
  it('carries sessionExpired off the 401 instead of a bare "Authentication failed"', () => {
    expect(hook).toContain("res.status === 401 && errorData.sessionExpired === true");
    expect(hook).toContain('sessionExpired: Boolean((error as (Error & { sessionExpired?: boolean }) | null)?.sessionExpired),');
  });
});

describe('the guard sends an expired admin to sign in, not to a wall', () => {
  const guard = R('client/src/components/AdminRouteGuard.tsx');
  it('redirects on sessionExpired, before the access-denied fall-through', () => {
    expect(guard).toContain('const { admin, isLoading: adminLoading, isError, sessionExpired } = useAdminAuth();');
    expect(guard).toContain('setLocation(`/admin/login?expired=1&next=${encodeURIComponent(window.location.pathname)}`);');
    const expiredAt = guard.indexOf('if (sessionExpired) {');
    const deniedAt = guard.indexOf('Logged in but NOT an admin');
    expect(expiredAt).toBeGreaterThan(0);
    expect(expiredAt).toBeLessThan(deniedAt);
  });
});

describe('the sign-in page explains why you are back', () => {
  it('shows the 4-hour note in Hebrew and English when expired=1', () => {
    const login = R('client/src/pages/admin/AdminLoginV2.tsx');
    expect(login).toContain("new URLSearchParams(window.location.search).get('expired') === '1'");
    expect(login).toContain('הכניסה לניהול תקפה ל-4 שעות והסתיימה');
    expect(login).toContain('your access has not changed');
  });
});

describe('the server still states the reason', () => {
  it('adminAuth answers 401 + sessionExpired when the 4h window lapses', () => {
    const src = R('server/adminAuth.ts');
    expect(src).toContain('ADMIN_SESSION_MAX_AGE_SECONDS = 14400');
    expect(src).toMatch(/sessionExpired:\s*true/);
  });
});
