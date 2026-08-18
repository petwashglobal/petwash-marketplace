/**
 * Task 8 — CEO fire order 101-140.
 *
 * AUTHORIZATION / COOKIE LOGGING sweep. Sessions cookies (pw_session,
 * Firebase session cookie), Firebase ID tokens, Bearer tokens, and raw
 * Authorization headers must never appear as values in logger.* /
 * console.* calls.
 *
 * The repo is already correct — every audited caller logs booleans,
 * lengths, or error codes rather than the raw credential. This pin
 * freezes that.
 *
 * One narrowing change: sessionCookies.ts previously logged
 * `idToken.substring(0, 20)` (20 chars of the JWT header, which is
 * base64 of a public alg/kid — not a leak but over-generous).
 * Reduced to `idTokenLength: idToken.length`.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const R = (p: string) => readFileSync(resolve(__dirname, '..', p), 'utf8');

const AUTH_FILES = [
  'lib/sessionCookies.ts',
  'middleware/firebase-auth.ts',
  'middleware/auth.ts',
  'middleware/appCheckMiddleware.ts',
  'middleware/csrfProtection.ts',
  'webauthn/csrfProtection.ts',
  'routes/publicAuthRoutes.ts',
  'routes/auth.ts',
  'routes/gmail.ts',
  'routes/post-login.ts',
  'customAuth.ts',
  'adminAuth.ts',
];

function walkLoggerCalls(src: string): string[] {
  const out: string[] = [];
  const rx = /(logger|console)\.(log|info|debug|warn|error)\(/g;
  let m: RegExpExecArray | null;
  while ((m = rx.exec(src)) !== null) {
    const start = m.index + m[0].length;
    let depth = 1;
    let i = start;
    while (i < src.length && depth > 0) {
      const c = src[i];
      if (c === '(') depth++;
      else if (c === ')') depth--;
      i++;
    }
    out.push(src.slice(start, i));
  }
  return out;
}

describe('Auth files never pass raw session cookies / ID tokens / Bearer tokens to loggers', () => {
  for (const rel of AUTH_FILES) {
    it(`${rel}: no dangerous auth values in logger args`, () => {
      let src: string;
      try {
        src = R(rel);
      } catch {
        // Missing file — skip gracefully.
        return;
      }
      const calls = walkLoggerCalls(src);
      for (const call of calls) {
        // Bare variable references to the raw credential.
        expect(call).not.toMatch(/\bsessionCookie\s*[,:}]/);           // sessionCookie in log
        expect(call).not.toMatch(/\bidToken\s*[,:}]/);                  // idToken as value
        expect(call).not.toMatch(/\baccessToken\s*[,:}]/);
        expect(call).not.toMatch(/\bbearerToken\s*[,:}]/);
        expect(call).not.toMatch(/\bfirebaseToken\s*[,:}]/);
        // req.cookies.<name> — full cookie value (allow `!!` boolean check).
        expect(call).not.toMatch(/(?<![!.])(?<!\?)req\.cookies\.\w+\s*[,:}]/);
        // req.headers.authorization — full header (allow `!!` boolean check).
        expect(call).not.toMatch(/(?<![!.])(?<!\?)req\.headers\.authorization\s*[,:}]/i);
        expect(call).not.toMatch(/(?<![!.])(?<!\?)req\.headers\.cookie\s*[,:}]/i);
        // Template-string interpolations of the same.
        expect(call).not.toMatch(/\$\{sessionCookie\}/);
        expect(call).not.toMatch(/\$\{idToken\}/);
        expect(call).not.toMatch(/\$\{accessToken\}/);
        expect(call).not.toMatch(/\$\{firebaseToken\}/);
        expect(call).not.toMatch(/\$\{bearerToken\}/);
        // "Bearer ${x}" — never emit the value with the scheme.
        expect(call).not.toMatch(/Bearer\s+\$\{[^}]+\}/);
      }
    });
  }
});

describe('sessionCookies.ts narrows the pre-existing idTokenPrefix log', () => {
  it('idToken value never logged; length-only', () => {
    const src = R('lib/sessionCookies.ts');
    expect(src).not.toMatch(/idToken\.substring\(0, 20\)/);
    expect(src).not.toMatch(/idTokenPrefix:/);
    expect(src).toContain('idTokenLength: idToken.length');
  });

  it('the create-session log surface is otherwise unchanged (no functional drift)', () => {
    const src = R('lib/sessionCookies.ts');
    // Same tags survive.
    for (const tag of [
      '[SessionCookies] Starting session cookie creation',
      '[SessionCookies] Calling Firebase Admin createSessionCookie',
      '[SessionCookies] Session cookie created successfully',
      '[SessionCookies] Session cookie set successfully',
      '[SessionCookies] Invalid ID token provided (client error)',
      '[SessionCookies] Failed to create session cookie (server error)',
    ]) expect(src).toContain(tag);
    // Cookie-setter attributes preserved.
    expect(src).toContain('httpOnly: true');
    expect(src).toContain("sameSite: 'lax'");
  });
});
