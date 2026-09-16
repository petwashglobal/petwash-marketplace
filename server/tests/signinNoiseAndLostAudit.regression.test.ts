import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Live crawl of 60 production pages, 2026-09-17. Two defects hid in the noise:
 *  1. EVERY signed-out page load POSTed /api/audit/record-biometric-failure
 *     with a bare fetch() — rejected 403 "invalid csrf token". So no biometric
 *     failure was EVER recorded, including the CEO's own failed Face ID tap,
 *     and the console filled with 403s from the silent autofill probe.
 *  2. /api/google-forms/config/:formType answered 404 when no Google Form is
 *     configured — a normal state — so /contact and /careers logged
 *     "[API Error] 404" for every visitor.
 */
const R = (p: string) => readFileSync(resolve(__dirname, '..', '..', p), 'utf8');

describe('biometric failure reports actually reach the ledger', () => {
  const src = R('client/src/auth/passkey.ts');
  const fn = src.slice(src.indexOf('async function logBiometricFailure('), src.indexOf('export function isPasskeySupported'));

  it('uses apiRequest (CSRF token) — never a bare fetch to the audit endpoint', () => {
    expect(fn).toContain("const { apiRequest } = await import('@/lib/queryClient');");
    expect(fn).toContain("apiRequest('POST', '/api/audit/record-biometric-failure'");
    expect(fn).not.toMatch(/fetch\(getApiUrl\('\/api\/audit\/record-biometric-failure'\)/);
  });

  it('the silent autofill probe does not report its normal cancel, but real taps do', () => {
    expect(fn).toContain('if (opts.silent && isCanceled) return;');
    const conditional = src.slice(src.indexOf('export async function signInWithPasskeyConditional'));
    expect(conditional).toContain('{ silent: true }');
    // the explicit button and step-up paths keep reporting
    const explicit = src.slice(src.indexOf('export async function signInWithPasskey('), src.indexOf('export async function isConditionalMediationAvailable'));
    expect(explicit).toMatch(/logBiometricFailure\(error, getBiometricMethodName\(\) as any\);/);
  });
});

describe('an unconfigured Google Form is a normal answer, not a 404', () => {
  const route = R('server/routes/google-forms.ts');
  const handler = route.slice(route.indexOf("router.get('/api/google-forms/config/:formType'"), route.indexOf("router.get('/api/google-forms/config'"));

  it('returns 200 { enabled: false } instead of 404', () => {
    expect(handler).toContain('return res.json({ formType, enabled: false });');
    expect(handler).not.toContain("res.status(404).json({ error: 'Form not configured or disabled' })");
  });

  it('the client still falls back to its own form on enabled:false', () => {
    expect(R('client/src/components/GoogleFormEmbed.tsx')).toContain('if (isError || !formConfig || !formConfig.enabled) {');
  });
});
