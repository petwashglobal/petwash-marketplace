/**
 * The e-mail-verified gate was dead (2026-09-13).
 *
 * `requireEmailVerifiedForProtectedPaths` is mounted GLOBALLY in
 * server/routes.ts — before the routers it names attach their own auth
 * (/api/bookings, /api/credit-wallet, /api/escrow, /api/kyc, /api/payout …
 * all mount validateFirebaseToken / optionalFirebaseToken further down the
 * file). So `req.firebaseUser` was always undefined when it ran, its first
 * line was `if (!req.firebaseUser?.uid) return next()`, and every caller
 * sailed through: an account with an unverified e-mail could create bookings,
 * move wallet money and submit KYC.
 *
 * The bail-out is right for a genuinely anonymous caller — it just has to be
 * the answer to "no credentials", not to "identity not resolved yet". The gate
 * now resolves identity itself, for mutating requests on a protected prefix
 * only, and only when nothing else has.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const R = (p: string) => readFileSync(resolve(__dirname, '..', '..', p), 'utf8');
const SRC = R('server/middleware/requireEmailVerified.ts');

describe('the gate resolves identity before deciding', () => {
  it('cheap exits still come first (GET, unprotected path)', () => {
    const body = SRC.slice(SRC.indexOf('export function requireEmailVerifiedForProtectedPaths'));
    expect(body.indexOf("req.method === 'GET'")).toBeLessThan(body.indexOf('PROTECTED_ACTIONS.some'));
    expect(body.indexOf('PROTECTED_ACTIONS.some')).toBeLessThan(body.indexOf('optionalFirebaseToken'));
  });

  it('it no longer gives up merely because nobody has resolved identity yet', () => {
    const body = SRC.slice(SRC.indexOf('export function requireEmailVerifiedForProtectedPaths'));
    // the old first line: an unconditional bail before any path/method check
    expect(body.indexOf('if (!req.firebaseUser?.uid)')).toBeGreaterThan(body.indexOf('PROTECTED_ACTIONS.some'));
  });

  it('it resolves the caller itself and then applies the real check', () => {
    expect(SRC).toContain("const { optionalFirebaseToken } = await import('./firebase-auth');");
    expect(SRC).toContain('await optionalFirebaseToken(req, res,');
    expect(SRC).toContain('return requireEmailVerified(req, res, next);');
  });

  it('a genuinely anonymous caller still passes through to the route’s own auth', () => {
    expect(SRC).toContain('// genuinely anonymous — the route’s own auth will answer'.replace('’', "'"));
  });

  it('the protected list still covers the money and KYC prefixes', () => {
    for (const p of ['/api/bookings', '/api/credit-wallet', '/api/escrow', '/api/kyc', '/api/payout']) {
      expect(SRC).toContain(`'${p}'`);
    }
  });

  it('and it is still mounted globally, which is why it had to resolve identity', () => {
    expect(R('server/routes.ts')).toContain('app.use(requireEmailVerifiedForProtectedPaths);');
  });
});
