/**
 * Lynx login-session auth (2026-07-06).
 *
 * The operator's Nayax account has no scoped API token (only a push-notification
 * token, which the live API rejects with 401). So LynxClient gained a second auth
 * mode: sign in with LYNX_USERNAME + LYNX_PASSWORD, cache the ~24h session cookie,
 * and reuse/refresh it. This pins that the two-mode auth is wired and gated.
 *
 * Source-introspection (network/secret-coupled), per repo norm for gated clients.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const SRC = readFileSync(resolve(__dirname, '..', 'services', 'LynxClient.ts'), 'utf8');

describe('LynxClient — login-session auth mode', () => {
  it('reads operator login credentials from env', () => {
    expect(SRC).toMatch(/LYNX_USERNAME/);
    expect(SRC).toMatch(/LYNX_PASSWORD/);
  });

  it('is wired ONLY by a real Bearer USER TOKEN (creds alone are NOT a valid Lynx auth mode)', () => {
    // SECURITY CORRECTION (2026-07-07, memory lynx-auth-needs-user-token):
    // username/password (operator login) was PROVEN to be an invalid Lynx API
    // auth method — POST /operational/v1/signin returns HTTP 500 with our creds,
    // and Nayax requires a Bearer User Token. Reporting "wired" on creds alone
    // was a false green. isWired() was hardened to require the token. This test
    // now guards that stricter invariant (do NOT relax back to "token OR creds").
    expect(SRC).toMatch(/return e\.enabled && Boolean\(e\.token\)/);
    // And must NOT fall back to credentials to decide wired-ness.
    expect(SRC).not.toMatch(/return e\.enabled && \([^)]*\|\|\s*hasCredentials\(e\)\)/);
  });

  it('signs in against /operational/v1/signin with {usr,pwd} and caches the cookie', () => {
    expect(SRC).toMatch(/\/operational\/v1\/signin/);
    expect(SRC).toMatch(/usr:\s*e\.username,\s*pwd:\s*e\.password/);
    expect(SRC).toMatch(/sessionCookie\s*=\s*pairs\.join/);
  });

  it('sends the session Cookie when there is no token, and re-logins once on 401', () => {
    expect(SRC).toMatch(/Cookie:\s*sessionCookie!/);
    expect(SRC).toMatch(/res\.status === 401 && !usingToken/);
  });

  it('never logs the credentials or the token', () => {
    // no template/log line should interpolate the password/token/cookie value
    expect(SRC).not.toMatch(/logger\.[a-z]+\([^)]*\$\{[^}]*e\.password/);
    expect(SRC).not.toMatch(/logger\.[a-z]+\([^)]*\$\{[^}]*e\.token/);
    expect(SRC).not.toMatch(/logger\.[a-z]+\([^)]*sessionCookie/);
  });
});
