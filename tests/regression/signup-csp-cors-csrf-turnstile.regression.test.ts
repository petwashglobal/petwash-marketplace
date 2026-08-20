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

    // 2026-08-20 hardening (Agent-2 hunt): the old "second custom middleware"
    // for subdomains was dead code on OPTIONS — the FIRST cors() middleware
    // terminated the preflight with 204 + NO ACAO before the subdomain code
    // ever ran, so signup.petwash.co.il preflights failed silently in prod.
    // Fix: the origin check moved INTO the cors() `origin` callback so the
    // cors package emits the correct ACAO + ACAC on the preflight response.
    // The pins below track the invariants of the new implementation.
    it('CORS_EXACT_ORIGINS lists the real subdomains that need credentialed access', () => {
      const block = src.slice(
        src.indexOf('CORS_EXACT_ORIGINS'),
        src.indexOf('];', src.indexOf('CORS_EXACT_ORIGINS')),
      );
      // Apex + www + the known-controlled subdomains in the repo/docs.
      expect(block).toContain("'https://petwash.co.il'");
      expect(block).toContain("'https://www.petwash.co.il'");
      expect(block).toContain("'https://app.petwash.co.il'");
      expect(block).toContain("'https://signup.petwash.co.il'");
      expect(block).toContain("'https://admin.petwash.co.il'");
      expect(block).toContain("'https://api.petwash.co.il'");
    });

    it('cors() middleware sets credentials:true and uses the origin callback', () => {
      // Preflight must be handled by cors() itself, and every allowed origin
      // must receive Access-Control-Allow-Credentials (never wildcard `*`).
      expect(src).toMatch(/app\.use\(cors\(\{[\s\S]*?origin:\s*corsOriginCallback[\s\S]*?credentials:\s*true/);
    });

    it('subdomain trust is a CLOSED explicit set, not a broad *.petwash.co.il regex', () => {
      // The old PETWASH_SUBDOMAIN_RE trusted ANY *.petwash.co.il with
      // credentials — a takeover of an unclaimed subdomain would inherit
      // __session. Ensure that broad-trust regex is gone.
      expect(src).not.toMatch(/PETWASH_SUBDOMAIN_RE/);
      expect(src).not.toMatch(/\[a-z0-9-\]\+\\\.\)\?petwash\\\.co\\\.il/);
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
