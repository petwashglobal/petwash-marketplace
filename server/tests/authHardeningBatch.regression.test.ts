/**
 * Three one-line auth defects, 2026-09-13. Each had a correct sibling in the
 * same repo doing the same job properly — these were the outliers.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const R = (p: string) => readFileSync(resolve(__dirname, '..', '..', p), 'utf8');

describe('a revoked session cookie no longer authenticates', () => {
  it('customAuth checks revocation, like the other two verifiers', () => {
    const src = R('server/customAuth.ts');
    expect(src).toContain('verifySessionCookie(sessionCookie, true)');
    expect(src).not.toContain('verifySessionCookie(sessionCookie, false)');
  });
  it('and the siblings still do', () => {
    expect(R('server/adminAuth.ts')).toContain('verifySessionCookie(sessionCookie, true)');
    expect(R('server/middleware/firebase-auth.ts')).toContain('verifySessionCookie(sessionCookie, true)');
  });
});

describe('the internal service secret is compared in constant time', () => {
  it('google-services uses safeEqual, like wallet.ts', () => {
    const src = R('server/routes/google-services.ts');
    expect(src).toContain("import { safeEqual } from '../lib/safeEqual';");
    expect(src).toContain('safeEqual(provided, secret)');
    expect(src).not.toContain('provided === secret');
  });
});

describe('the K9000 IP allowlist cannot be satisfied by a header', () => {
  const src = R('server/middleware/k9000Security.ts');
  it('it no longer reads the raw X-Forwarded-For first hop', () => {
    expect(src).not.toContain("(req.headers['x-forwarded-for'] as string) ||");
  });
  it('it uses req.ip under the app trust-proxy setting, or the socket', () => {
    expect(src).toContain("req.app?.get?.('trust proxy')");
    expect(src).toContain('req.socket.remoteAddress');
  });
  it('which is what the other allowlist in this repo already did', () => {
    expect(R('server/middleware/ipAllowlist.ts')).toContain("req.app.get('trust proxy')");
  });
});
