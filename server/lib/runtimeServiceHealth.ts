/**
 * Prod-only runtime-service health classification.
 *
 * Separates runtime services into three tiers so an operator can tell, from
 * /health alone, whether a missing secret is a real production outage or just
 * the CI / local smoke container booting without real credentials:
 *
 *   - productionCriticalMissing — a core user journey is broken in REAL prod.
 *     SMS/OTP (Twilio) gates signup + login, so its absence is critical. This is
 *     evaluated ONLY on a real Cloud Run revision: `K_SERVICE` is injected by
 *     Cloud Run and is NEVER present in the CI smoke container (local `docker run`
 *     / `tsx`), so a missing prod secret can never fail a CI smoke run.
 *   - optionalDegraded — feature degrades but the app is usable (database,
 *     transactional email). Never counted as critical.
 *   - onCloudRun / note — context so consumers interpret the above correctly.
 *
 * Pure function (no side effects, no throw) — safe to unit test and to call on
 * every /health request.
 */

export interface RuntimeServiceHealth {
  onCloudRun: boolean;
  productionCriticalMissing: string[];
  critical: { sms: { provider: string; configured: boolean } };
  optionalDegraded: {
    database: { available: boolean };
    email: { provider: string; configured: boolean };
  };
  note?: string;
}

export function classifyRuntimeServices(
  env: NodeJS.ProcessEnv = process.env,
  databaseAvailable = false,
): RuntimeServiceHealth {
  const onCloudRun = !!(env.K_SERVICE || '').trim();

  // SMS sender requires account SID + auth token + at least one sender
  // (phone number OR messaging service SID) — mirrors TwilioSMSService.initialize().
  const twilioConfigured = !!(
    (env.TWILIO_ACCOUNT_SID || '').trim() &&
    (env.TWILIO_AUTH_TOKEN || '').trim() &&
    ((env.TWILIO_PHONE_NUMBER || '').trim() || (env.TWILIO_MESSAGING_SERVICE_SID || '').trim())
  );
  const emailConfigured = /^SG\.[A-Za-z0-9_-]{20,}/.test((env.SENDGRID_API_KEY || '').trim());

  const productionCriticalMissing: string[] = [];
  if (onCloudRun && !twilioConfigured) productionCriticalMissing.push('sms:twilio');

  return {
    onCloudRun,
    productionCriticalMissing,
    critical: { sms: { provider: 'twilio', configured: twilioConfigured } },
    optionalDegraded: {
      database: { available: !!databaseAvailable },
      email: { provider: 'sendgrid', configured: emailConfigured },
    },
    ...(onCloudRun
      ? {}
      : {
          note:
            'Not on Cloud Run (CI/local) — production-critical secrets are intentionally ' +
            'absent here and are not counted as failures.',
        }),
  };
}
