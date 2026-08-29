/**
 * CEO §B41 (2026-08-29) — the X-Auth-Journey-Id header MUST be
 * read by BOTH the session-mint and the post-login decider so ops
 * can correlate a single client attempt across the two
 * round-trips.
 *
 * Source-anchored: assert the parser regex is present and the
 * hostile-header path is a no-op (never a 4xx / 5xx, never a
 * secret leak).
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const R = (p: string) => fs.readFileSync(path.resolve(__dirname, '..', '..', p), 'utf8');
const ROUTES = R('server/routes.ts');
const POST_LOGIN = R('server/routes/post-login.ts');
const COORDINATOR = R('client/src/lib/postLoginCoordinator.ts');
const ONE_TAP = R('client/src/components/GoogleOneTap.tsx');

describe('CEO §B41 — X-Auth-Journey-Id server threading', () => {
  it('POST /api/auth/session parses the header with the strict regex', () => {
    // 16 hex + optional ;method=<google|apple|phone|email|passkey>.
    // No other shape must be accepted — anything else is silently
    // dropped so a hostile header cannot pollute the log line.
    expect(ROUTES).toMatch(
      /req\.headers\['x-auth-journey-id'\][\s\S]*match\(\/\^\(\[0-9a-f\]\{16\}\)\(\?:;method=\(google\|apple\|phone\|email\|passkey\)\)\?\$\//,
    );
  });

  it('POST /api/auth/session logs authJourneyId + authJourneyMethod on the debug line', () => {
    expect(ROUTES).toMatch(/authJourneyId,/);
    expect(ROUTES).toMatch(/authJourneyMethod,/);
  });

  it('POST /api/auth/post-login parses the same header shape and stamps req', () => {
    expect(POST_LOGIN).toMatch(
      /req\.headers\['x-auth-journey-id'\][\s\S]*match\(\/\^\(\[0-9a-f\]\{16\}\)\(\?:;method=\(google\|apple\|phone\|email\|passkey\)\)\?\$\//,
    );
    expect(POST_LOGIN).toMatch(/\(req as any\)\.authJourneyId/);
    expect(POST_LOGIN).toMatch(/\(req as any\)\.authJourneyMethod/);
  });
});

describe('CEO §B41 — client attaches X-Auth-Journey-Id', () => {
  it('postLoginCoordinator.ts attaches the header if authJourney has one', () => {
    expect(COORDINATOR).toMatch(/authJourneyHeader/);
    expect(COORDINATOR).toMatch(/'X-Auth-Journey-Id'/);
  });

  it('postLoginCoordinator.ts NEVER lets a lib failure break the round-trip', () => {
    // The import is inside try/catch — an authJourney module failure
    // must not throw out of resolvePostLogin.
    expect(COORDINATOR).toMatch(/try \{[\s\S]*authJourneyHeader[\s\S]*\} catch/);
  });

  it('GoogleOneTap.tsx attaches the header on the /api/auth/session call', () => {
    expect(ONE_TAP).toMatch(/authJourneyHeader\(\)/);
    expect(ONE_TAP).toMatch(/'X-Auth-Journey-Id'/);
  });
});

describe('CEO §D4 — no PII in the traced fields anywhere on the wire', () => {
  it('server session log line adds only safe metadata (authJourneyId, method) — no PII', () => {
    // Scan JUST the object argument of the session log call — not
    // the wider code below which destructures the body (a variable
    // named idToken is NOT a log leak).
    const idx = ROUTES.indexOf("[Session] Creating session cookie");
    expect(idx).toBeGreaterThan(0);
    // The object literal closes on the line following userAgent.
    const closeIdx = ROUTES.indexOf('});', idx);
    expect(closeIdx).toBeGreaterThan(idx);
    const block = ROUTES.slice(idx, closeIdx).toLowerCase();
    // Log line MUST include only the safe fields.
    for (const safe of ['hasidtoken', 'expiresinms', 'traceid', 'authjourneyid', 'authjourneymethod', 'useragent']) {
      expect(block).toContain(safe.toLowerCase());
    }
    // And MUST NOT include known-sensitive full-value fields.
    for (const bad of ['password:', 'plaintext', 'rawidtoken', 'oauthtoken', 'bankaccount', 'ssn:']) {
      expect(block).not.toContain(bad.toLowerCase());
    }
  });
});
