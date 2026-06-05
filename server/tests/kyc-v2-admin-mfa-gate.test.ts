import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(__dirname, '..', '..');
const src = readFileSync(resolve(ROOT, 'server/routes/kyc2026.ts'), 'utf8');

function routeBlock(method: 'get' | 'post', path: string): string {
  const start = src.indexOf(`router.${method}(`);
  const pathIndex = src.indexOf(`'${path}'`, start);
  expect(pathIndex).toBeGreaterThan(-1);

  const nextRoute = src.indexOf('\nrouter.', pathIndex + path.length);
  return src.slice(pathIndex, nextRoute === -1 ? undefined : nextRoute);
}

describe('KYC v2 admin MFA gate', () => {
  it('imports the existing KYC MFA guard and limiter', () => {
    expect(src).toMatch(/requireKYCMFA/);
    expect(src).toMatch(/kycMFALimiter/);
  });

  it.each([
    ['get', '/admin/health', 'kyc:stats:view'],
    ['get', '/admin/audit', 'kyc:audit:view'],
    ['get', '/admin/anomalies', 'kyc:anomaly:view'],
    ['get', '/admin/incidents', 'kyc:stats:view'],
    ['post', '/admin/roles/assign', 'kyc:config:edit'],
  ] as const)('%s %s requires permission and an MFA session', (method, path, permission) => {
    const block = routeBlock(method, path);

    expect(block).toMatch(new RegExp(`requireKYCPermission\\(['"]${permission}['"]\\)`));
    expect(block).toMatch(/requireKYCMFA\(\)/);
    expect(block.indexOf('requireKYCPermission')).toBeLessThan(block.indexOf('requireKYCMFA'));
  });

  it('rate-limits and permission-gates MFA session issuance', () => {
    const block = routeBlock('post', '/admin/mfa/verify');

    expect(block).toMatch(/kycMFALimiter/);
    expect(block).toMatch(/requireKYCPermission\(['"]kyc:audit:view['"]\)/);
  });
});
