/**
 * PetWash™ Payment Provider Mode — single source of truth for which
 * payment providers are active and whether the server is allowed to
 * boot without real payment-vendor credentials.
 *
 * Active providers (CEO 2026-05-09):
 *   • Nayax              — K9000 machine card sale
 *   • SUMIT / UPay       — online billing (future, env names documented)
 *   • Internal ledger    — wallet / loyalty / e-gift truth
 *
 * Deprecated (no live wiring permitted):
 *   • Stripe             — never reintroduce
 *   • Tranzila           — flag-gated OFF; cleanup in a follow-up PR
 *
 * Modes:
 *   live  — production default. Real provider clients are used by
 *           code paths that opt in via NAYAX_ENABLED / SUMIT_ENABLED.
 *           Production refuses to operate live when those flags are
 *           true and required secrets are missing (recorded into the
 *           startup config-error collector; /health/strict turns red).
 *   mock  — CI / smoke / test path. Server boots without any real
 *           payment credentials; any payment call returns ok:false.
 *           Per Rule H ("no fake success"): mock mode NEVER pretends
 *           a charge succeeded.
 *
 * Boundaries enforced by this module:
 *   1. No live SUMIT/UPay implementation lives here. Future PRs add it.
 *   2. No Stripe fallback. Stripe env vars trigger a deprecation warning.
 *   3. No Tranzila wiring change. Tranzila env vars trigger a
 *      deprecation warning; existing flag gating in payment-flags.ts
 *      remains the runtime control for Tranzila code paths.
 *   4. Mock mode short-circuits ALL secret requirements regardless of
 *      NODE_ENV — required so CI smoke tests can boot a production
 *      container image with PAYMENT_PROVIDER_MODE=mock.
 */

export type PaymentProviderMode = 'live' | 'mock';

const MOCK = 'mock' as const;
const LIVE = 'live' as const;

export function getPaymentProviderMode(
  env: NodeJS.ProcessEnv = process.env,
): PaymentProviderMode {
  const raw = (env.PAYMENT_PROVIDER_MODE || '').toLowerCase().trim();
  // Mock must be opted-in explicitly. Default is live so unset values in
  // production never silently weaken the secret guards.
  return raw === MOCK ? MOCK : LIVE;
}

export function isMockModeActive(env: NodeJS.ProcessEnv = process.env): boolean {
  return getPaymentProviderMode(env) === MOCK;
}

export function isNayaxEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NAYAX_ENABLED === 'true';
}

export function isSumitEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.SUMIT_ENABLED === 'true';
}

export interface PaymentProviderValidationResult {
  /** Hard errors — production refuses to operate live with these unresolved. */
  errors: string[];
  /** Soft warnings — deprecated env vars still present in the environment. */
  deprecationWarnings: string[];
  /** Effective mode after resolution; for diagnostics. */
  mode: PaymentProviderMode;
}

/**
 * Validate that production has the live secrets it claims to need.
 *
 * Order of evaluation matters:
 *   1. If PAYMENT_PROVIDER_MODE=mock, short-circuit. CI smoke and unit
 *      tests must boot without real credentials.
 *   2. Otherwise, in production:
 *        - When NAYAX_ENABLED=true, NAYAX_API_KEY + NAYAX_WEBHOOK_SECRET
 *          must both be present.
 *        - When SUMIT_ENABLED=true, SUMIT_API_KEY + SUMIT_WEBHOOK_SECRET
 *          must both be present.
 *   3. Outside production, missing secrets are not errors here — feature
 *      call sites still degrade as today.
 *   4. Always: any STRIPE_* / TRANZILA_* / TRANSILA_* env var present is
 *      reported as a deprecation warning (no live wiring change).
 */
export function validateProductionPaymentSecrets(
  env: NodeJS.ProcessEnv = process.env,
): PaymentProviderValidationResult {
  const errors: string[] = [];
  const deprecationWarnings: string[] = [];
  const mode = getPaymentProviderMode(env);

  // Step 1: mock mode short-circuits secret requirements. CI smoke uses this.
  if (mode === MOCK) {
    collectDeprecationWarnings(env, deprecationWarnings);
    return { errors, deprecationWarnings, mode };
  }

  // Step 2: production fail-closed when an enabled provider lacks secrets.
  const nodeEnv = (env.NODE_ENV || '').toLowerCase().trim();
  const isProd = nodeEnv === 'production';

  if (isProd && isNayaxEnabled(env)) {
    if (!env.NAYAX_API_KEY) {
      errors.push(
        'NAYAX_ENABLED=true but NAYAX_API_KEY is missing — refusing to operate live',
      );
    }
    if (!env.NAYAX_WEBHOOK_SECRET) {
      errors.push(
        'NAYAX_ENABLED=true but NAYAX_WEBHOOK_SECRET is missing — refusing to operate live',
      );
    }
  }

  if (isProd && isSumitEnabled(env)) {
    if (!env.SUMIT_API_KEY) {
      errors.push(
        'SUMIT_ENABLED=true but SUMIT_API_KEY is missing — refusing to operate live',
      );
    }
    if (!env.SUMIT_WEBHOOK_SECRET) {
      errors.push(
        'SUMIT_ENABLED=true but SUMIT_WEBHOOK_SECRET is missing — refusing to operate live',
      );
    }
  }

  // Step 3: deprecation warnings (do not affect errors).
  collectDeprecationWarnings(env, deprecationWarnings);

  return { errors, deprecationWarnings, mode };
}

function collectDeprecationWarnings(
  env: NodeJS.ProcessEnv,
  warnings: string[],
): void {
  for (const key of Object.keys(env)) {
    if (/^STRIPE_/i.test(key)) {
      warnings.push(
        `Deprecated env var present: ${key}. Stripe is no longer used by PetWash. Remove from environment.`,
      );
    } else if (/^TRANZILA_/i.test(key) || /^TRANSILA_/i.test(key)) {
      warnings.push(
        `Deprecated env var present: ${key}. Tranzila is being retired in favour of SUMIT/UPay. Remove after migration.`,
      );
    }
  }
}
