/**
 * CSRF token generation P0 (2026-08-11).
 *
 * csrf-csrf v4 made `getSessionIdentifier` a REQUIRED option (no default). Our
 * doubleCsrf() config omitted it, so the library's constructMessage() called
 * `getSessionIdentifier(req)` → `undefined(req)` → threw "getSessionIdentifier is
 * not a function". Result in production:
 *   · GET /api/csrf-token 500'd → no pw.csrf cookie was ever issued
 *   · every CSRF-protected POST returned 403 EBADCSRFTOKEN
 * which silently broke marketplace search, booking creation, and new-user /
 * loyalty / provider onboarding. This test proves the config actually works.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { doubleCsrf } from 'csrf-csrf';

describe('CSRF: doubleCsrf must be configured so a token can be generated', () => {
  // Mirror the production config shape (server/index.ts).
  function makeCsrf() {
    return doubleCsrf({
      getSecret: () => 'x'.repeat(32),
      getSessionIdentifier: () => '',
      cookieName: 'pw.csrf',
      cookieOptions: { sameSite: 'strict', secure: true, httpOnly: false },
      size: 64,
      getCsrfTokenFromRequest: (req: any) => req.headers['x-csrf-token'],
    });
  }

  it('generateCsrfToken does not throw and sets the cookie', () => {
    const { generateCsrfToken } = makeCsrf();
    const cookies: Record<string, string> = {};
    const res: any = { cookie: (n: string, v: string) => { cookies[n] = v; }, getHeader: () => undefined, setHeader: () => {}, append: () => {} };
    const tok = generateCsrfToken({ headers: {}, cookies: {} } as any, res);
    expect(String(tok).length).toBeGreaterThan(0);
    expect(cookies['pw.csrf']).toBeTruthy();
  });

  it('a token echoed in the header validates against its cookie', () => {
    const { generateCsrfToken, doubleCsrfProtection } = makeCsrf();
    const cookies: Record<string, string> = {};
    const res: any = { cookie: (n: string, v: string) => { cookies[n] = v; }, getHeader: () => undefined, setHeader: () => {}, append: () => {} };
    const tok = generateCsrfToken({ headers: {}, cookies: {} } as any, res);
    let passed = true;
    doubleCsrfProtection(
      { method: 'POST', path: '/api/marketplace/search', headers: { 'x-csrf-token': tok }, cookies: { 'pw.csrf': cookies['pw.csrf'] } } as any,
      res,
      (err: any) => { if (err) passed = false; },
    );
    expect(passed).toBe(true);
  });

  it('the production config still declares getSessionIdentifier', () => {
    const src = readFileSync(resolve(__dirname, '..', 'index.ts'), 'utf8');
    expect(src).toMatch(/getSessionIdentifier\s*:/);
  });
});
