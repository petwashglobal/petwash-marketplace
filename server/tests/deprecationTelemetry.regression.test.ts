/**
 * CEO FLY MODE II §22 (2026-08-29) — deprecation telemetry pins.
 *
 * Locks the shape of the shared telemetry helper AND its wiring on
 * every retirement-candidate 2FA endpoint. If a caller shape drifts
 * (extra PII leaks in, or a handler stops emitting the beacon), the
 * pin fails.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const LIB = fs.readFileSync(
  path.resolve(__dirname, '..', 'lib', 'deprecationTelemetry.ts'),
  'utf8',
);

const ROUTES = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes.ts'),
  'utf8',
);

describe('CEO FLY MODE II §22 — deprecationTelemetry helper', () => {
  it('exports recordDeprecationHit(req, route, opts)', () => {
    expect(LIB).toMatch(/export function recordDeprecationHit/);
    // Positional shape locks: no accidental swap.
    expect(LIB).toMatch(
      /req: Request,\s*route: string,\s*opts: \{ uid\?: string \| null \} = \{\}/,
    );
  });

  it('logs at WARN level with the stable [Deprecation] tag', () => {
    expect(LIB).toMatch(
      /logger\.warn\(\s*'\[Deprecation\] retirement-candidate hit'/,
    );
  });

  it('logs route + method + uid + clientFamily + appVersion + ip + ts (nothing else PII)', () => {
    for (const field of ['route', 'method', 'uid', 'clientFamily', 'appVersion', 'ip', 'ts']) {
      // Accept either object shorthand (`clientFamily,`) or explicit
      // property (`clientFamily: ...`) — both mean "the field is on
      // the log payload."
      expect(LIB).toMatch(new RegExp(`\\b${field}[,:]`));
    }
    // Explicitly refuse to write the raw user agent or the request body.
    // Both would be regressions — this pin catches either.
    expect(LIB).not.toMatch(/userAgent:/);
    expect(LIB).not.toMatch(/body:/);
    // No raw Authorization header value must reach the log — a
    // `req.headers.authorization` write would be a token leak.
    expect(LIB).not.toMatch(/req\.headers\.authorization/i);
  });

  it('never throws — outer try/catch swallows telemetry failures', () => {
    // A telemetry crash MUST NOT break the still-live handler.
    expect(LIB).toMatch(/try \{[\s\S]*\} catch/);
  });

  it('clientFamily is a hash slice, not the raw UA', () => {
    expect(LIB).toMatch(/createHash\('sha256'\)/);
    expect(LIB).toMatch(/\.digest\('hex'\)\.slice\(0, 8\)/);
    // A regression that leaks the plain UA would look like `clientFamily: ua`
    expect(LIB).not.toMatch(/clientFamily: ua[,\s}]/);
  });

  it('slices X-App-Version to 32 chars — bounds a hostile header', () => {
    expect(LIB).toMatch(/\.slice\(0, 32\)/);
  });
});

describe('CEO FLY MODE II §22 — 2FA endpoints call the beacon', () => {
  for (const [route, method] of [
    ['/api/auth/2fa/send', 'post'],
    ['/api/auth/2fa/request', 'post'],
    ['/api/auth/2fa/verify', 'post'],
    ['/api/auth/2fa/status', 'get'],
  ] as const) {
    it(`app.${method}('${route}', ...) calls recordDeprecationHit`, () => {
      // Anchor the beacon call to the handler block for that exact
      // route. Regex loosely scoped to the 400 chars after the
      // handler declaration to catch drift without over-fitting.
      const handlerIdx = ROUTES.indexOf(
        `app.${method}('${route}'`,
      );
      expect(handlerIdx).toBeGreaterThan(0);
      const block = ROUTES.slice(handlerIdx, handlerIdx + 1200);
      expect(block).toMatch(
        new RegExp(`recordDeprecationHit\\(req, '${route.replace(/\//g, '\\/')}', \\{ uid \\}\\)`),
      );
    });
  }
});
