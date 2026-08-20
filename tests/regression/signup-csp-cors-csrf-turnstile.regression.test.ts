import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

// Firebase-audit 2026-08-20 wave-2 pins:
//
// SEV-1 #1 — CSP blocked https://challenges.cloudflare.com in script-src,
//   connect-src, and frame-src. Turnstile widget silently failed to load,
//   executeTurnstileInvisible returned null, and every /api/auth/sms/start +
//   /api/auth/email/start hit TURNSTILE_TOKEN_REQUIRED 400. Mobile + email
//   OTP signup dead. All three directives now include the origin.
//
// SEV-2 #4 — CORS middleware overwrote the credentialed ACAO the `cors` package
//   had set for apex/www with a wildcard `*`, AND set no ACAC, so every
//   subdomain fetch with `credentials:'include'` lost the __session cookie
//   (illegal `*` + credentials:true combo also blocked apex). Subdomain path
//   now mirrors the origin with Access-Control-Allow-Credentials: true.
//
// SEV-2 #5 — /api/auth/login/2fa/start and /api/auth/login/2fa/verify were
//   missing from AUTH_CSRF_EXEMPT; every legacy 2FA'd account 403'd at login.
//
// SEV-2 #6 — VITE_TURNSTILE_SITE_KEY + TURNSTILE_SECRET_KEY were undocumented
//   in .env.example; missing them silently reproduced the SEV-1 signup dead-end.

const root = (rel: string) => readFileSync(join(__dirname, '..', '..', rel), 'utf8');

describe('signup wave-2 pins — CSP + CORS + CSRF + Turnstile docs', () => {
  describe('CSP allows Cloudflare Turnstile in all three directives', () => {
    const csp = root('server/middleware/securityHeaders.ts');

    it('script-src includes https://challenges.cloudflare.com', () => {
      const scriptSrc = csp.match(/"script-src",[\s\S]*?\]\.filter/)?.[0] ?? '';
      expect(scriptSrc).toContain('https://challenges.cloudflare.com');
    });

    it('connect-src includes https://challenges.cloudflare.com', () => {
      const connectSrc = csp.match(/"connect-src",[\s\S]*?\]\.filter/)?.[0] ?? '';
      expect(connectSrc).toContain('https://challenges.cloudflare.com');
    });

    it('frame-src includes https://challenges.cloudflare.com', () => {
      const frameSrc = csp.match(/"frame-src",[\s\S]*?\]\.filter/)?.[0] ?? '';
      expect(frameSrc).toContain('https://challenges.cloudflare.com');
    });
  });

  describe('CORS mirrors petwash.co.il subdomains with credentials', () => {
    const src = root('server/index.ts');

    it('subdomain branch mirrors the origin (never a wildcard)', () => {
      // The block guarded by isSubdomain must set ACAO to reqOrigin and ACAC:true.
      const subdomainBlock = src.match(/if \(isSubdomain\)\s*\{[\s\S]*?\}/)?.[0] ?? '';
      expect(subdomainBlock).toMatch(/Access-Control-Allow-Origin['"],\s*reqOrigin/);
      expect(subdomainBlock).toMatch(/Access-Control-Allow-Credentials['"],\s*['"]true['"]/);
      expect(subdomainBlock).not.toMatch(/Access-Control-Allow-Origin['"],\s*['"]\*['"]/);
    });

    it('Vary: Origin is set so proxies do not cache the wrong CORS response', () => {
      const subdomainBlock = src.match(/if \(isSubdomain\)\s*\{[\s\S]*?\}/)?.[0] ?? '';
      expect(subdomainBlock).toMatch(/Vary['"],\s*['"]Origin['"]/);
    });
  });

  describe('CSRF exempt list covers the 2FA login endpoints', () => {
    const src = root('server/index.ts');
    it('login/2fa/start is exempt', () => {
      expect(src).toMatch(/['"]\/api\/auth\/login\/2fa\/start['"]/);
    });
    it('login/2fa/verify is exempt', () => {
      expect(src).toMatch(/['"]\/api\/auth\/login\/2fa\/verify['"]/);
    });
  });

  describe('.env.example documents Turnstile keys', () => {
    const env = root('.env.example');
    it('declares VITE_TURNSTILE_SITE_KEY', () => {
      expect(env).toMatch(/^VITE_TURNSTILE_SITE_KEY=/m);
    });
    it('declares TURNSTILE_SECRET_KEY', () => {
      expect(env).toMatch(/^TURNSTILE_SECRET_KEY=/m);
    });
  });
});
