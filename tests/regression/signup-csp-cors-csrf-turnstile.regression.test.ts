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

// ── the SERVED CSP ──────────────────────────────────────────────────────────
// Firebase Hosting is the ONLY CSP a browser on petwash.co.il ever sees: it
// sends its own Content-Security-Policy from firebase.json and that header
// REPLACES the one server/middleware/securityHeaders.ts sets. Verified live on
// 2026-09-07 — /, /signup, /walk-my-pet, /paw-finder and /sitter-suite each
// return exactly ONE csp header and all five hash identically to the
// firebase.json value. Every pin about what production actually permits must
// therefore read THIS string, not the middleware.
export const hostingCsp: string = (() => {
  const cfg = JSON.parse(root('firebase.json'));
  const sites: any[] = Array.isArray(cfg.hosting) ? cfg.hosting : [cfg.hosting];
  for (const site of sites) {
    for (const block of site?.headers ?? []) {
      for (const h of block?.headers ?? []) {
        if (String(h.key).toLowerCase() === 'content-security-policy') return String(h.value);
      }
    }
  }
  return '';
})();

/** The whole `name src src ...` clause, or '' when the directive is absent. */
export const directive = (name: string) => {
  const found = hostingCsp
    .split(';')
    .map((d) => d.trim())
    .find((d) => d === name || d.startsWith(name + ' '));
  return found ?? '';
};

/** The directive's source expressions as discrete tokens (never substrings). */
const sourcesOf = (name: string) => directive(name).split(/\s+/).slice(1);

/**
 * Does source expression `a` permit everything `b` permits? Implements the
 * three CSP source-expression forms we actually use, so the parity check below
 * does not cry wolf: `https:` (scheme-source) covers every https URL,
 * `https://*.googleapis.com` (wildcard host) covers `https://places.googleapis.com`,
 * and a path-less host covers any path under it.
 *
 * Comparison is on whole tokens. `https://challenges.cloudflare.com.evil.test`
 * CONTAINS an allowed origin as a substring but is a different origin, so
 * substring matching here would be a security bug (and trips CodeQL's
 * js/incomplete-url-substring-sanitization).
 */
export function covers(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.startsWith("'") || b.startsWith("'")) return false; // keywords: exact only
  const isScheme = (x: string) => /^[a-z][a-z0-9+.-]*:$/i.test(x);
  if (isScheme(a)) return b.toLowerCase().startsWith(a.toLowerCase());
  if (isScheme(b)) return false;
  const split = (u: string) => {
    const m = u.match(/^(?:([a-z][a-z0-9+.-]*):\/\/)?([^/]+)(\/.*)?$/i);
    return m ? { scheme: (m[1] ?? '').toLowerCase(), host: m[2].toLowerCase(), path: m[3] ?? '' } : null;
  };
  const A = split(a);
  const B = split(b);
  if (!A || !B) return false;
  if (A.scheme && B.scheme && A.scheme !== B.scheme) return false;
  const hostOk =
    A.host === B.host ||
    (A.host.startsWith('*.') && (B.host.endsWith(A.host.slice(1)) || B.host === A.host.slice(2)));
  if (!hostOk) return false;
  return A.path === '' || B.path.startsWith(A.path);
}

/** True when the served CSP permits `source` under `name`. */
export const allows = (name: string, source: string) =>
  sourcesOf(name).some((s) => covers(s, source));

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

  // 2026-09-07 — the SERVED CSP. The three pins above only read the Express
  // middleware, but /signup is a static SPA route: Firebase Hosting serves it
  // and Firebase Hosting sends its OWN Content-Security-Policy from
  // firebase.json. That header never had challenges.cloudflare.com, so on
  // production the Turnstile script was blocked, executeTurnstileInvisible
  // threw, and email signup dead-ended on "Security verification unavailable"
  // — with the middleware pins above passing the whole time. Same two-artifact
  // class as the VITE_TURNSTILE_SITE_KEY P0: one commit, two deploy targets,
  // and a test that only ever looked at one of them.
  describe('the SERVED (Firebase Hosting) CSP allows Turnstile too', () => {
    it('firebase.json actually declares a Content-Security-Policy', () => {
      expect(hostingCsp).not.toBe('');
    });

    for (const name of ['script-src', 'connect-src', 'frame-src']) {
      it(`hosting ${name} includes https://challenges.cloudflare.com`, () => {
        expect(directive(name)).toContain('https://challenges.cloudflare.com');
      });
    }
  });

  // 2026-09-07 — the SAME bug class as the Turnstile P0 above, found by auditing
  // the rest of that header. Firebase Hosting's CSP is the only one a browser
  // sees, and it omitted FOUR more origins the client loads at runtime. All
  // confirmed blocked against production before the fix, not inferred from
  // source:
  //
  //   api.open-meteo.com    connect-src  "Refused to connect" on
  //                         /walk-my-pet/explore + /sitter-suite/explore —
  //                         every weather widget rendered its error state.
  //   unpkg.com             style-src    window.__loadLeafletCSS() (client/index.html)
  //                         blocked, so the /walk-tracking/:walkId map loads
  //                         unstyled — Leaflet without its CSS is a pile of
  //                         absolutely-positioned tiles.
  //   cdnjs.cloudflare.com  style-src    PawFinder.tsx ships its OWN <link> to a
  //                         second Leaflet CSS copy; blocked on /paw-finder,
  //                         /find-pet, /lost-pet. img-src's `https:` covers
  //                         cdnjs for IMAGES, which is what made this one easy
  //                         to wave through — a stylesheet is not an image.
  //
  // Two more origins were NOT allowlisted, deliberately:
  //   embed.tawk.to   the only caller was components/LiveChatWidget.tsx, which
  //                   nothing mounted and whose VITE_TAWK_* keys were never set.
  //   www.clarity.ms  the only caller was lib/marketing-pixels.ts, which nothing
  //                   in the repo imported.
  // Both files are deleted. Allowlisting an origin for code nobody runs widens
  // the policy and buys nothing. window.Tawk_API and window.clarity were both
  // `undefined` on production, confirming neither ever loaded.
  describe('the SERVED CSP covers every origin the client loads at runtime', () => {
    const RUNTIME_ORIGINS: Array<[string, string, string]> = [
      ['connect-src', 'https://api.open-meteo.com', 'weather widgets on /walk-my-pet/explore + /sitter-suite/explore'],
      ['style-src', 'https://unpkg.com', 'Leaflet CSS via window.__loadLeafletCSS() in client/index.html'],
      ['style-src', 'https://cdnjs.cloudflare.com', 'Leaflet CSS <link> in pages/PawFinder.tsx'],
      // Already present, pinned so a future tidy-up cannot quietly drop them.
      ['connect-src', 'https://ipapi.co', 'IP geolocation in lib/deviceTelemetry.ts'],
      ['script-src', 'https://www.googletagmanager.com', 'GA4 loader in client/index.html'],
      ['script-src', 'https://js.hs-scripts.com', 'HubSpot tracking script'],
    ];

    for (const [name, origin, why] of RUNTIME_ORIGINS) {
      it(`${name} allows ${origin} (${why})`, () => {
        expect(allows(name, origin)).toBe(true);
      });
    }

    const DELETED_DEAD_ORIGINS: Array<[string, string]> = [
      ['https://embed.tawk.to', 'components/LiveChatWidget.tsx — deleted, never mounted'],
      ['https://www.clarity.ms', 'lib/marketing-pixels.ts — deleted, never imported'],
    ];

    for (const [origin, why] of DELETED_DEAD_ORIGINS) {
      it(`does NOT allowlist ${origin} (${why})`, () => {
        expect(hostingCsp).not.toContain(origin);
      });
    }
  });

  // The root cause is not any one missing origin — it is that two CSPs are
  // maintained by hand in two files and nothing compared them. This is the
  // comparison. It fails on any NEW divergence, which must then be either
  // fixed or consciously added to KNOWN_DIVERGENCES with a reason.
  describe('parity: securityHeaders.ts vs the served firebase.json CSP', () => {
    // Evaluate the middleware's directive array in production mode.
    const expressCsp: string = (() => {
      const src = root('server/middleware/securityHeaders.ts');
      const body = src.slice(
        src.indexOf('const CSP_DIRECTIVES'),
        src.indexOf('export function enhancedSecurityHeaders'),
      );
      // eslint-disable-next-line no-new-func
      return new Function(
        'const isDev = false; const replitHosts = "";\n' +
          body.replace(/^const /, 'globalThis.__CSP = ') +
          '\nreturn globalThis.__CSP;',
      )() as string;
    })();

    const expressDirectives = new Map(
      expressCsp
        .split(';')
        .map((d) => d.trim())
        .filter(Boolean)
        .map((d) => {
          const [name, ...sources] = d.split(/\s+/);
          return [name.toLowerCase(), sources] as [string, string[]];
        }),
    );

    // Divergences that are CORRECT and must not fail the build. Each is an
    // origin the middleware still lists but no client code loads — verified by
    // grepping client/src + client/index.html on 2026-09-07. They are left in
    // the middleware rather than removed here because tightening that file is a
    // separate change; what matters is that the SERVED policy stays narrow.
    const KNOWN_DIVERGENCES: Record<string, string[]> = {
      'connect-src': [
        'https://*.firebase.com',        // no client reference; firebaseio/firebaseapp are the live ones
        'https://click.petwash.co.il',   // SendGrid click tracking — email pixels, not the SPA
        'https://media.twiliocdn.com',   // no client reference
      ],
      'script-src': [
        'https://media.twiliocdn.com',   // no client reference
        'https://js.sentry-cdn.com',     // Sentry ships in the bundle, not via CDN loader
        'https://forms.hubspot.com',     // no client reference
      ],
      'frame-src': [
        'https://recaptcha.google.com/', // no client reference
        'https://open.spotify.com',      // only components/SpotifyPartyPlaylist.tsx, which nothing mounts
      ],
      'style-src': [
        'https://fonts.gstatic.com',     // serves font FILES; font-src already allows it
      ],
      // Enforced by the middleware but absent from the served header. Adding it
      // would upgrade http→https subresource requests; the client has no http://
      // subresources (only an <a> to maps.apple.com), so it is a no-op we skip
      // rather than a protection we are missing.
      'upgrade-insecure-requests': [],
    };

    for (const [name, sources] of expressDirectives) {
      if (name === 'upgrade-insecure-requests') continue;

      it(`served CSP defines ${name} at all`, () => {
        expect(directive(name)).not.toBe('');
      });

      it(`served CSP is not narrower than the middleware for ${name}`, () => {
        const exempt = new Set(KNOWN_DIVERGENCES[name] ?? []);
        const blocked = sources.filter((src) => !exempt.has(src) && !allows(name, src));
        expect(blocked).toEqual([]);
      });
    }

    // base-uri and form-action do NOT fall back to default-src. If the served
    // header omits one, that protection is simply absent from every page —
    // which is exactly how base-uri went missing until 2026-09-07.
    for (const name of ['base-uri', 'form-action', 'frame-ancestors', 'object-src']) {
      it(`served CSP carries ${name} (no default-src fallback for the first three)`, () => {
        expect(directive(name)).not.toBe('');
      });
    }
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
