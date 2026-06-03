/**
 * Issue #153 PR-CI-PAYMENT-MODE — payment-provider posture lock.
 *
 * CEO directive (2026-05-09):
 *   • Stripe is dead, Tranzila is dead.
 *   • Active providers: Nayax + SUMIT/UPay (latter not yet implemented).
 *   • Internal ledger is source of truth for wallet/credits/loyalty.
 *   • Production must fail-closed when an enabled provider lacks its
 *     required secrets. CI/test must boot in mock mode without real
 *     credentials. No fake payment success — mock returns ok:false only.
 *
 * Locked invariants this suite enforces:
 *
 *   A. PAYMENT_PROVIDER_MODE is the canonical 2-value enum (live | mock).
 *      Default when unset is 'live' (so production never silently weakens).
 *   B. validateProductionPaymentSecrets() short-circuits on mock mode and
 *      returns no errors regardless of NODE_ENV.
 *   C. validateProductionPaymentSecrets() in production:
 *        - NAYAX_ENABLED=true  → require NAYAX_API_KEY + NAYAX_WEBHOOK_SECRET
 *        - SUMIT_ENABLED=true  → require SUMIT_API_KEY + SUMIT_WEBHOOK_SECRET
 *      and produces an error per missing secret. Outside production it does
 *      not error on missing secrets (degrades at call-time as today).
 *   D. STRIPE_* env vars produce deprecation warnings, never errors. Tranzila
 *      is FULLY REMOVED (code + flags + routes + env keys deleted); a stray
 *      TRANZILA_* var is inert — no warning, no error.
 *   E. MockPaymentProvider returns ok:false from every method. No fake
 *      success state is reachable through it. verifyWebhook always false.
 *   F. The new module is wired into server/index.ts startup so the result
 *      flows into the existing _startupConfigErrors path.
 *   G. .env.example documents the new env vars (PAYMENT_PROVIDER_MODE,
 *      NAYAX_ENABLED, SUMIT_ENABLED, SUMIT_*).
 *   H. The CI workflow's container smoke test passes the mock env vars
 *      to the docker run.
 *   I. No Stripe code is reintroduced anywhere. STRIPE_* env vars are not
 *      consumed by the new module beyond the deprecation-warning collector.
 *   J. The new module imports nothing from Tranzila/Stripe code paths.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

import {
  getPaymentProviderMode,
  isMockModeActive,
  isNayaxEnabled,
  isSumitEnabled,
  validateProductionPaymentSecrets,
} from '../lib/payment-provider-mode';
import { MockPaymentProvider } from '../services/payment-providers/MockPaymentProvider';

const ROOT = resolve(__dirname, '..', '..');
const indexSrc = readFileSync(resolve(ROOT, 'server/index.ts'), 'utf8');
const moduleSrc = readFileSync(resolve(ROOT, 'server/lib/payment-provider-mode.ts'), 'utf8');
const mockSrc = readFileSync(resolve(ROOT, 'server/services/payment-providers/MockPaymentProvider.ts'), 'utf8');
const envExample = readFileSync(resolve(ROOT, '.env.example'), 'utf8');
const ciYaml = readFileSync(resolve(ROOT, '.github/workflows/petwash-ci.yml'), 'utf8');

// ── A. Mode enum + defaulting ─────────────────────────────────────────────

describe('PR-CI-PAYMENT-MODE — mode enum and defaulting', () => {
  it('1. PAYMENT_PROVIDER_MODE defaults to live when unset', () => {
    expect(getPaymentProviderMode({})).toBe('live');
  });

  it('2. PAYMENT_PROVIDER_MODE=mock resolves to mock', () => {
    expect(getPaymentProviderMode({ PAYMENT_PROVIDER_MODE: 'mock' })).toBe('mock');
    expect(isMockModeActive({ PAYMENT_PROVIDER_MODE: 'mock' })).toBe(true);
  });

  it('3. arbitrary unknown values fall through to live (no silent dilution)', () => {
    expect(getPaymentProviderMode({ PAYMENT_PROVIDER_MODE: 'random' })).toBe('live');
    expect(isMockModeActive({ PAYMENT_PROVIDER_MODE: 'random' })).toBe(false);
  });

  it('4. NAYAX_ENABLED / SUMIT_ENABLED parse strict "true" only', () => {
    expect(isNayaxEnabled({ NAYAX_ENABLED: 'true' })).toBe(true);
    expect(isNayaxEnabled({ NAYAX_ENABLED: 'TRUE' })).toBe(false); // strict
    expect(isNayaxEnabled({ NAYAX_ENABLED: '1' })).toBe(false);
    expect(isSumitEnabled({ SUMIT_ENABLED: 'true' })).toBe(true);
    expect(isSumitEnabled({})).toBe(false);
  });
});

// ── B. Mock mode short-circuits secret requirements ──────────────────────

describe('PR-CI-PAYMENT-MODE — mock mode short-circuits all secret requirements', () => {
  it('5. mock mode + production + everything enabled + NO secrets → zero errors', () => {
    const r = validateProductionPaymentSecrets({
      NODE_ENV: 'production',
      PAYMENT_PROVIDER_MODE: 'mock',
      NAYAX_ENABLED: 'true',
      SUMIT_ENABLED: 'true',
      // Deliberately missing every secret.
    });
    expect(r.errors).toEqual([]);
    expect(r.mode).toBe('mock');
  });

  it('6. mock mode + test env → zero errors, mode=mock', () => {
    const r = validateProductionPaymentSecrets({
      NODE_ENV: 'test',
      PAYMENT_PROVIDER_MODE: 'mock',
    });
    expect(r.errors).toEqual([]);
    expect(r.mode).toBe('mock');
  });
});

// ── C. Production fail-closed when an enabled provider lacks secrets ──────

describe('PR-CI-PAYMENT-MODE — production fail-closed when secrets missing', () => {
  it('7. prod + NAYAX_ENABLED=true + missing NAYAX_API_KEY → error', () => {
    const r = validateProductionPaymentSecrets({
      NODE_ENV: 'production',
      PAYMENT_PROVIDER_MODE: 'live',
      NAYAX_ENABLED: 'true',
      NAYAX_WEBHOOK_SECRET: 'present',
      // NAYAX_API_KEY missing
    });
    expect(r.errors.length).toBe(1);
    expect(r.errors[0]).toMatch(/NAYAX_API_KEY/);
    expect(r.errors[0]).toMatch(/refusing to operate live/);
  });

  it('8. prod + NAYAX_ENABLED=true + missing webhook secret → error', () => {
    const r = validateProductionPaymentSecrets({
      NODE_ENV: 'production',
      PAYMENT_PROVIDER_MODE: 'live',
      NAYAX_ENABLED: 'true',
      NAYAX_API_KEY: 'present',
      // NAYAX_WEBHOOK_SECRET missing
    });
    expect(r.errors.length).toBe(1);
    expect(r.errors[0]).toMatch(/NAYAX_WEBHOOK_SECRET/);
  });

  it('9. prod + NAYAX_ENABLED=true + both secrets present → zero errors', () => {
    const r = validateProductionPaymentSecrets({
      NODE_ENV: 'production',
      PAYMENT_PROVIDER_MODE: 'live',
      NAYAX_ENABLED: 'true',
      NAYAX_API_KEY: 'present',
      NAYAX_WEBHOOK_SECRET: 'present',
    });
    expect(r.errors).toEqual([]);
  });

  it('10. prod + SUMIT_ENABLED=true + missing both secrets → 2 errors', () => {
    const r = validateProductionPaymentSecrets({
      NODE_ENV: 'production',
      PAYMENT_PROVIDER_MODE: 'live',
      SUMIT_ENABLED: 'true',
    });
    expect(r.errors.length).toBe(2);
    expect(r.errors.join(' ')).toMatch(/SUMIT_API_KEY/);
    expect(r.errors.join(' ')).toMatch(/SUMIT_WEBHOOK_SECRET/);
  });

  it('11. development env never errors on missing secrets (degrades at call-time)', () => {
    const r = validateProductionPaymentSecrets({
      NODE_ENV: 'development',
      PAYMENT_PROVIDER_MODE: 'live',
      NAYAX_ENABLED: 'true',
      // Missing both Nayax secrets — but not prod, so no error.
    });
    expect(r.errors).toEqual([]);
  });

  it('12. prod + NAYAX_ENABLED=false → no requirement fires (default state preserved)', () => {
    const r = validateProductionPaymentSecrets({
      NODE_ENV: 'production',
      PAYMENT_PROVIDER_MODE: 'live',
      NAYAX_ENABLED: 'false',
    });
    expect(r.errors).toEqual([]);
  });
});

// ── D. Stripe / Tranzila deprecation warnings (NOT errors) ───────────────

describe('PR-CI-PAYMENT-MODE — Stripe and Tranzila deprecation warnings', () => {
  it('13. STRIPE_* env var present → deprecation warning, no error', () => {
    const r = validateProductionPaymentSecrets({
      NODE_ENV: 'production',
      PAYMENT_PROVIDER_MODE: 'live',
      STRIPE_API_KEY: 'sk_test_xxx',
    });
    expect(r.errors).toEqual([]);
    expect(r.deprecationWarnings.some((w) => /STRIPE_API_KEY/.test(w))).toBe(true);
    expect(r.deprecationWarnings.some((w) => /Stripe is no longer used/i.test(w))).toBe(true);
  });

  it('14. TRANZILA_* env var present → NO warning (Tranzila fully removed, no tripwire kept)', () => {
    // Full rip-out: Tranzila code/flags/routes are deleted and the deprecation
    // collector no longer special-cases TRANZILA_*. A stray TRANZILA_ env var is
    // simply inert — nothing reads it, so it produces neither error nor warning.
    const r = validateProductionPaymentSecrets({
      NODE_ENV: 'production',
      PAYMENT_PROVIDER_MODE: 'live',
      TRANZILA_API_KEY: 'something',
    });
    expect(r.errors).toEqual([]);
    expect(r.deprecationWarnings.some((w) => /TRANZILA/i.test(w))).toBe(false);
  });

  it('15. mock mode also collects deprecation warnings (always reported)', () => {
    const r = validateProductionPaymentSecrets({
      NODE_ENV: 'test',
      PAYMENT_PROVIDER_MODE: 'mock',
      STRIPE_API_KEY: 'x',
      STRIPE_PUBLISHABLE_KEY: 'y',
    });
    expect(r.errors).toEqual([]);
    expect(r.deprecationWarnings.length).toBeGreaterThanOrEqual(2);
  });
});

// ── E. MockPaymentProvider — no fake success, ever ────────────────────────

describe('PR-CI-PAYMENT-MODE — MockPaymentProvider returns ok:false from every call', () => {
  const provider = new MockPaymentProvider();

  it('16. charge returns ok:false', async () => {
    const r = await provider.charge();
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('mock-mode');
    expect(r.provider).toBe('mock');
  });

  it('17. authorize / capture / refund / void / payout all return ok:false', async () => {
    expect((await provider.authorize()).ok).toBe(false);
    expect((await provider.capture()).ok).toBe(false);
    expect((await provider.refund()).ok).toBe(false);
    expect((await provider.void()).ok).toBe(false);
    expect((await provider.payout()).ok).toBe(false);
  });

  it('18. verifyWebhook always returns false', async () => {
    expect(await provider.verifyWebhook()).toBe(false);
  });

  it('19. the source contains no "ok:true" or "ok: true" literal anywhere', () => {
    // Defence in depth: prove no current or future edit can introduce a fake-success.
    // (Comments are stripped to inspect executable code only.)
    const codeOnly = mockSrc
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    expect(codeOnly).not.toMatch(/ok\s*:\s*true/);
  });
});

// ── F. Server startup wiring ──────────────────────────────────────────────

describe('PR-CI-PAYMENT-MODE — server/index.ts wires the validator', () => {
  it('20. index.ts imports validateProductionPaymentSecrets from the canonical module', () => {
    expect(indexSrc).toMatch(
      /import\s*\{[^}]*validateProductionPaymentSecrets[^}]*\}\s*from\s*['"][./]+lib\/payment-provider-mode['"]/,
    );
  });

  it('21. index.ts pushes payment-provider errors into _startupConfigErrors', () => {
    expect(indexSrc).toMatch(/_startupConfigErrors\.push\(\s*['"]\[PaymentProvider\]/);
  });

  it('22. index.ts logs the resolved mode for diagnostics', () => {
    expect(indexSrc).toMatch(/\[PaymentProvider\][\s\S]{0,80}mode=/);
  });
});

// ── G. .env.example documentation ────────────────────────────────────────

describe('PR-CI-PAYMENT-MODE — .env.example documents the new env vars', () => {
  it('23. PAYMENT_PROVIDER_MODE is documented and defaults to mock', () => {
    expect(envExample).toMatch(/^PAYMENT_PROVIDER_MODE=mock$/m);
  });

  it('24. NAYAX_ENABLED + SUMIT_ENABLED defaults are documented and false', () => {
    expect(envExample).toMatch(/^NAYAX_ENABLED=false$/m);
    expect(envExample).toMatch(/^SUMIT_ENABLED=false$/m);
  });

  it('25. SUMIT_* env names are documented (future wiring, not yet implemented)', () => {
    expect(envExample).toMatch(/^SUMIT_API_KEY=/m);
    expect(envExample).toMatch(/^SUMIT_COMPANY_ID=/m);
    expect(envExample).toMatch(/^SUMIT_TERMINAL_ID=/m);
    expect(envExample).toMatch(/^SUMIT_WEBHOOK_SECRET=/m);
    expect(envExample).toMatch(/^SUMIT_API_BASE_URL=/m);
    expect(envExample).toMatch(/^SUMIT_APP_NAME=/m);
  });

  it('26. Tranzila is fully removed from .env.example (no TRANZILA_* keys remain)', () => {
    // Full rip-out: the entire Tranzila block and every TRANZILA_* key are gone.
    expect(envExample).not.toMatch(/TRANZILA_/);
    expect(envExample).not.toMatch(/Tranzila Payment Gateway/);
  });
});

// ── H. CI workflow injects mock env vars into smoke test ─────────────────

describe('PR-CI-PAYMENT-MODE — CI workflow boots smoke in mock mode', () => {
  it('27. petwash-ci.yml smoke test passes PAYMENT_PROVIDER_MODE=mock', () => {
    expect(ciYaml).toMatch(/-e\s+PAYMENT_PROVIDER_MODE=mock/);
  });

  it('28. petwash-ci.yml smoke test pins NAYAX_ENABLED + SUMIT_ENABLED to false', () => {
    expect(ciYaml).toMatch(/-e\s+NAYAX_ENABLED=false/);
    expect(ciYaml).toMatch(/-e\s+SUMIT_ENABLED=false/);
  });
});

// ── I/J. No Stripe reintroduction; module isolation ──────────────────────

describe('PR-CI-PAYMENT-MODE — Stripe never reintroduced; module isolation', () => {
  it('29. payment-provider-mode.ts does NOT import any Stripe / Tranzila / SDK code', () => {
    const codeOnly = moduleSrc
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    expect(codeOnly).not.toMatch(/import[^;]*['"][^'"]*stripe[^'"]*['"]/i);
    expect(codeOnly).not.toMatch(/import[^;]*['"][^'"]*tranzila[^'"]*['"]/i);
    expect(codeOnly).not.toMatch(/import[^;]*['"][^'"]*nayax[^'"]*['"]/i);
    expect(codeOnly).not.toMatch(/import[^;]*['"][^'"]*sumit[^'"]*['"]/i);
  });

  it('30. mock provider does NOT import any vendor SDK', () => {
    const codeOnly = mockSrc
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    expect(codeOnly).not.toMatch(/import[^;]*['"][^'"]*stripe[^'"]*['"]/i);
    expect(codeOnly).not.toMatch(/import[^;]*['"][^'"]*tranzila[^'"]*['"]/i);
  });

  it('31. payment-provider-mode.ts itself does NOT read STRIPE_* via process.env (only the deprecation collector)', () => {
    // Defence: the module must not read STRIPE_API_KEY or any STRIPE_* directly
    // anywhere except as part of generic key-iteration in the deprecation
    // warning collector. We verify there is no `process.env.STRIPE_` literal.
    expect(moduleSrc).not.toMatch(/process\.env\.STRIPE_/);
  });
});
