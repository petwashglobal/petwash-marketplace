/**
 * Regression pin — one-tap Firebase custom-token exposure surface
 * (AUDIT-LOG-13 / #216).
 *
 * Before the fix, the mobile-ops one-tap flow leaked a Firebase custom
 * token in two places:
 *   1. server/security/productionHardeningAndOneTap.ts autoSignHtml
 *      inlined `const customToken = "..."` directly into the rendered
 *      HTML at /ops/one-tap and /ops/one-tap-employee. That surface is
 *      visible to browser extensions, page-source viewers, HAR
 *      exports, analytics/RUM snapshots, and any bfcache reload.
 *   2. server/routes/employees.ts /generate-mobile-link built a URL
 *      of the shape `/ops/one-tap-employee?token=<CUSTOM_TOKEN>`. That
 *      surface is visible to browser history, referer headers on any
 *      outbound link the auto-signed page renders, CDN edge logs, and
 *      server access logs.
 *
 * Firebase custom tokens are bearer credentials — anyone who reads one
 * can create an authenticated session as the target user for its TTL.
 *
 * Fix: the server now stashes the custom token in Redis under a short-
 * TTL random handoff CODE and hands out ONLY the code. The HTML fetches
 * the token from POST /api/oauth/one-tap/exchange (Redis GETDEL — one-
 * shot), and receives it in the response body — a surface that is not
 * seen by extensions on other tabs, browser history, referer, CDN
 * logs, or page-source views.
 *
 * This pin refuses any regression that puts the custom token back into
 * either surface.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..', '..');
const oneTapSrc = readFileSync(
  join(ROOT, 'server/security/productionHardeningAndOneTap.ts'),
  'utf8',
);
const employeesSrc = readFileSync(join(ROOT, 'server/routes/employees.ts'), 'utf8');
const handoffSrc = readFileSync(
  join(ROOT, 'server/security/oneTapHandoff.ts'),
  'utf8',
);
const redisSrc = readFileSync(join(ROOT, 'server/services/redis.ts'), 'utf8');

describe('AUDIT-LOG-13 / #216 — one-tap custom-token exposure', () => {
  it('autoSignHtml does NOT interpolate the customToken into the HTML', () => {
    // The old shape was `const customToken = ${JSON.stringify(opts.customToken)};`
    // — any reintroduction of a customToken-typed field on the options bag
    // that flows into the string template is refused. The template MUST
    // only carry the handoff CODE and fetch the token via /api/oauth/one-tap/exchange.
    expect(oneTapSrc).not.toMatch(/opts\.customToken/);
    expect(oneTapSrc).not.toMatch(/JSON\.stringify\(opts\.customToken/);
    expect(oneTapSrc).toMatch(/opts\.handoffCode/);
    expect(oneTapSrc).toMatch(/\/api\/oauth\/one-tap\/exchange/);
  });

  it('/ops/one-tap-employee accepts a code, never a custom token in the URL', () => {
    // The endpoint used to read `req.query.token` and pass it straight to
    // autoSignHtml as the custom token. It now reads `req.query.code` and
    // the token itself never crosses the URL.
    expect(oneTapSrc).not.toMatch(/const customToken = String\(req\.query\.token/);
    expect(oneTapSrc).toMatch(/const handoffCode = String\(req\.query\.code/);
  });

  it('employees.ts generate-mobile-link URL carries a handoff code, not a custom token', () => {
    // Old shape: /ops/one-tap-employee?token=${encodeURIComponent(customToken)}
    expect(employeesSrc).not.toMatch(/one-tap-employee\?token=\$\{encodeURIComponent\(customToken\)/);
    expect(employeesSrc).toMatch(/one-tap-employee\?code=\$\{encodeURIComponent\(handoffCode\)/);
    // The endpoint must actually call createHandoff — otherwise it's just
    // renaming the leak.
    expect(employeesSrc).toMatch(/createHandoff\(\{[\s\S]{0,120}?customToken/);
  });

  it('exchange endpoint uses Redis GETDEL and returns customToken in the response body ONLY', () => {
    // consumeHandoff MUST use getDel — anything else (get then del) is a
    // race window that lets the same code be consumed twice.
    expect(handoffSrc).toMatch(/redis\.getDel\(/);
    // Redis service exposes an atomic getDel wrapping ioredis.getdel.
    expect(redisSrc).toMatch(/async getDel\(/);
    expect(redisSrc).toMatch(/client\.getdel\(/);
    // Exchange endpoint returns the token in a JSON body — never in a URL.
    expect(oneTapSrc).toMatch(/res\.status\(200\)\.json\(\{\s*customToken:\s*envelope\.customToken\s*\}\)/);
  });

  it('exchange endpoint returns a generic error for unknown/expired/consumed/Redis-down handoffs', () => {
    // Refusing to distinguish "unknown code" from "Redis outage" keeps an
    // attacker from iterating. All failure branches must return
    // one_tap_handoff_invalid.
    const matches = oneTapSrc.match(/one_tap_handoff_invalid/g) || [];
    expect(matches.length).toBeGreaterThanOrEqual(3);
  });
});
