import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * A LAPSED ADMIN IS STILL SIGNED IN.
 *
 * 2026-09-17: the CEO's Google sign-in "looked broken, then logged in". The
 * Firebase user in his browser was days old; every page load re-minted the
 * session cookie with that old auth_time, and /api/session/whoami answered
 * 401 "not authenticated" because the 4h ADMIN window had passed — so the whole
 * site treated him as signed out while member pages and Bearer calls worked.
 * He pressed Google again (fresh auth_time) and was in.
 *
 * Now: whoami reports the lapse (adminSessionExpired) and stays 200; the 4h
 * rule keeps protecting /api/admin/* (sessionAgeGuard + requireAdmin), and the
 * guard's 401 carries sessionExpired so the client asks for a fresh sign-in
 * instead of the "no access" wall.
 */
vi.mock('../lib/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }));

const R = (p: string) => readFileSync(resolve(__dirname, '..', '..', p), 'utf8');

function whoamiHandler(): string {
  const src = R('server/routes.ts');
  const start = src.indexOf("app.get('/api/session/whoami'");
  const end = src.indexOf('\n  });', start);
  expect(start).toBeGreaterThan(0);
  return src.slice(start, end);
}

describe('whoami', () => {
  it('never answers 401 because the admin window lapsed', () => {
    const h = whoamiHandler();
    expect(h).not.toContain("error: 'session-expired'");
    expect(h).toContain('const adminSessionExpired = mfaRequired && sessionAge > maxAge;');
  });
  it('reports the lapse so the admin guard can ask for a fresh sign-in', () => {
    const h = whoamiHandler();
    expect(h).toMatch(/\n\s+adminSessionExpired,\n\s+session: \{/);
  });
});

describe('the 4h rule still guards the admin API', () => {
  it('sessionAgeGuard is mounted on /api/admin/ and /api/kyc/', () => {
    const src = R('server/routes.ts');
    expect(src).toContain("app.use('/api/admin/', sessionAgeGuard(14400));");
    expect(src).toContain("app.use('/api/kyc/', sessionAgeGuard(14400));");
  });

  it('refuses a 5h-old admin session with 401 + sessionExpired: true', async () => {
    const { sessionAgeGuard } = await import('../middleware/session-hardening');
    const req: any = { firebaseUser: { uid: 'u1', auth_time: Math.floor(Date.now() / 1000) - 5 * 3600 } };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();
    await sessionAgeGuard(14400)(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json.mock.calls[0][0]).toMatchObject({ error: 'session_expired', sessionExpired: true });
  });

  it('lets a 1h-old admin session through', async () => {
    const { sessionAgeGuard } = await import('../middleware/session-hardening');
    const req: any = { firebaseUser: { uid: 'u1', auth_time: Math.floor(Date.now() / 1000) - 3600 } };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();
    await sessionAgeGuard(14400)(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('requireAdmin still refuses past 4h', () => {
    const src = R('server/adminAuth.ts');
    expect(src).toContain('ADMIN_SESSION_MAX_AGE_SECONDS = 14400');
    expect(src).toMatch(/if \(sessionAge > ADMIN_SESSION_MAX_AGE_SECONDS\)/);
  });
});

describe('after signing in again the admin lands where they were', () => {
  it('returns to the admin page in ?next', async () => {
    const { adminLandingPath } = await import('../../client/src/lib/adminLandingPath');
    expect(adminLandingPath('?expired=1&next=%2Fadmin%2Fpaw-finder')).toBe('/admin/paw-finder');
    expect(adminLandingPath('?next=/admin')).toBe('/admin');
  });
  it('falls back to the control tower for anything that is not a same-site admin page', async () => {
    const { adminLandingPath } = await import('../../client/src/lib/adminLandingPath');
    for (const bad of ['', '?next=https://evil.example/admin', '?next=//evil.example/admin', '?next=/account', '?next=/admin/login', '?next=/admin%0d%0aX', '?next=javascript:alert(1)', '?next=/adminx']) {
      expect(adminLandingPath(bad)).toBe('/admin/octopus');
    }
  });
});
