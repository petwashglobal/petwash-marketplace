/**
 * The "Israeli-2025 government-grade" e-sign router must fail closed.
 *
 * Its JWS signing is cryptographically void (random throwaway HS256 secret,
 * never the ES256 key) and verifySignature() does no crypto check yet /verify
 * returns "valid and compliant with Israeli law". Until rebuilt, the whole
 * router must reject (501) unless ESIGN_ISRAELI_2025_ENABLED=true.
 *
 * Source-introspection guard.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const src = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes', 'israeli-2025-esign.ts'),
  'utf8',
);

describe('Israeli-2025 e-sign — fail-closed', () => {
  it('installs a router-level guard gated on ESIGN_ISRAELI_2025_ENABLED', () => {
    expect(src).toMatch(/router\.use\(/);
    expect(src).toMatch(/ESIGN_ISRAELI_2025_ENABLED === 'true'/);
  });

  it('rejects with 501 when not explicitly enabled', () => {
    expect(src).toMatch(/status\(501\)/);
    expect(src).toMatch(/ESIGN_ISRAELI_2025_DISABLED/);
  });

  it('the guard is wired before the route handlers', () => {
    const guardAt = src.indexOf('ESIGN_ISRAELI_2025_ENABLED');
    const firstRoute = src.indexOf("router.post('/create'");
    expect(guardAt).toBeGreaterThan(-1);
    expect(firstRoute).toBeGreaterThan(-1);
    expect(guardAt).toBeLessThan(firstRoute);
  });
});
