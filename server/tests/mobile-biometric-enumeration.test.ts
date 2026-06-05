import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(__dirname, '..', '..');
const src = readFileSync(resolve(ROOT, 'server/routes/mobile-biometric.ts'), 'utf8');

function routeBlock(path: string): string {
  const routeIndex = src.indexOf(`router.post('${path}'`);
  expect(routeIndex).toBeGreaterThan(-1);

  const nextRoute = src.indexOf('\nrouter.', routeIndex + path.length);
  return src.slice(routeIndex, nextRoute === -1 ? undefined : nextRoute);
}

describe('mobile biometric passkey enumeration guard', () => {
  it('uses one generic unavailable message for passkey login misses', () => {
    expect(src).toMatch(/GENERIC_BIOMETRIC_SIGN_IN_UNAVAILABLE/);

    const optionsRoute = routeBlock('/authenticate/options');
    const genericUses = optionsRoute.match(/GENERIC_BIOMETRIC_SIGN_IN_UNAVAILABLE/g) || [];

    expect(genericUses.length).toBeGreaterThanOrEqual(2);
  });

  it('does not expose account-existence or enrollment-specific miss messages', () => {
    expect(src).not.toContain('No account found with this email');
    expect(src).not.toContain('No biometric credentials found');
  });

  it('preserves the happy-path WebAuthn options generation', () => {
    const optionsRoute = routeBlock('/authenticate/options');

    expect(optionsRoute).toMatch(/generateAuthenticationOptions/);
    expect(optionsRoute).toMatch(/allowCredentials/);
    expect(optionsRoute).toMatch(/userVerification:\s*MOBILE_CONFIG\.userVerification/);
  });
});
