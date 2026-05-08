/**
 * configHealth.ts
 *
 * Single source of truth for the platform's environment-variable
 * manifest. Drives:
 *   1. The startup diagnostic that logs MISSING ENV VAR NAMES (never
 *      values) at boot so deploys fail loud, not silent.
 *   2. The admin-only GET /api/admin/config-health endpoint that
 *      returns presence-only status for ops/CEO visibility.
 *
 * ABSOLUTE RULES
 *   • This module NEVER reads, returns, logs, or echoes a secret value.
 *     Only `name in process.env` boolean checks.
 *   • The `description` strings are SAFE for logs — they document
 *     what the env var is FOR, not its value.
 *   • Adding a new env var here is the canonical way to surface it
 *     in both the boot log and the admin health endpoint.
 *
 * Issue #153 — External API / Secrets / Cloud Configuration Reality
 * Audit (CEO directive). Aligns with the Track-A "fail clearly instead
 * of silent failure" allowed fast-PR list.
 */

import { logger } from './logger';

export type ConfigCategory = 'required' | 'recommended' | 'optional';

export interface EnvVarSpec {
  /** The env var name. NEVER read its value here — only check presence at use sites. */
  name: string;
  category: ConfigCategory;
  /** Safe-to-log description — what the var is FOR, not its value. */
  description: string;
}

/**
 * The canonical manifest. Order is preserved in the report.
 *
 * required    Server should consider this fatal in production. Missing
 *             one of these means a launch-critical surface is broken.
 * recommended Degraded UX without; non-fatal but loud-warning.
 * optional    Feature flag / nice-to-have / sandbox-only.
 *
 * Adding new entries: keep `name` literal and unique; do not add
 * value-shaped data in description; do not add regex/format checks
 * here — that risks accidentally emitting partial values via test
 * messages.
 */
export const CONFIG_MANIFEST: readonly EnvVarSpec[] = [
  // ── Database (server fail-closes without it on every query) ────────────
  { name: 'DATABASE_URL', category: 'required', description: 'PostgreSQL connection string' },

  // ── Firebase client config (web SDK) ────────────────────────────────────
  { name: 'VITE_FIREBASE_API_KEY', category: 'required', description: 'Firebase Web API key (public, restricted by domain in console)' },
  { name: 'VITE_FIREBASE_AUTH_DOMAIN', category: 'required', description: 'Firebase Auth domain (Safari ITP override applies in prod)' },
  { name: 'VITE_FIREBASE_PROJECT_ID', category: 'required', description: 'Firebase project ID' },
  { name: 'VITE_FIREBASE_APP_ID', category: 'required', description: 'Firebase app ID' },
  { name: 'VITE_FIREBASE_STORAGE_BUCKET', category: 'recommended', description: 'Firebase Storage bucket (uploads degrade without)' },
  { name: 'VITE_FIREBASE_MESSAGING_SENDER_ID', category: 'optional', description: 'FCM sender ID (push notifications)' },

  // ── Firebase server-side admin SDK ──────────────────────────────────────
  { name: 'FIREBASE_SERVICE_ACCOUNT_KEY', category: 'recommended', description: 'Firebase Admin SDK service account JSON (Cloud Run ADC fallback if absent)' },

  // ── Phone OTP (Twilio) ──────────────────────────────────────────────────
  { name: 'TWILIO_ACCOUNT_SID', category: 'required', description: 'Twilio account SID (phone signup blocks without)' },
  { name: 'TWILIO_AUTH_TOKEN', category: 'required', description: 'Twilio auth token' },
  { name: 'TWILIO_PHONE_NUMBER', category: 'required', description: 'Twilio FROM phone (E.164)' },

  // ── Email (SendGrid primary, Gmail fallback) ────────────────────────────
  { name: 'SENDGRID_API_KEY', category: 'recommended', description: 'SendGrid API key (transactional email)' },
  { name: 'SENDGRID_FROM_EMAIL', category: 'recommended', description: 'SendGrid verified sender address' },
  { name: 'GMAIL_CLIENT_ID', category: 'optional', description: 'Gmail OAuth client ID (email fallback path)' },
  { name: 'GMAIL_CLIENT_SECRET', category: 'optional', description: 'Gmail OAuth client secret' },
  { name: 'GMAIL_REFRESH_TOKEN', category: 'optional', description: 'Gmail OAuth refresh token' },

  // ── Bot / fraud protection (reCAPTCHA + App Check) ──────────────────────
  { name: 'VITE_RECAPTCHA_SITE_KEY', category: 'required', description: 'reCAPTCHA v3 site key (frontend)' },
  { name: 'RECAPTCHA_SECRET_KEY', category: 'required', description: 'reCAPTCHA v3 secret (server verify)' },
  { name: 'VITE_APP_CHECK_SITE_KEY', category: 'recommended', description: 'Firebase App Check site key (degrades gracefully)' },

  // ── Google Maps / Places / Geocoding ────────────────────────────────────
  { name: 'VITE_GOOGLE_MAPS_API_KEY', category: 'recommended', description: 'Google Maps key (frontend; restrict to petwash.co.il referrer)' },
  { name: 'GOOGLE_MAPS_API_KEY', category: 'recommended', description: 'Google Maps key (server proxy + Geocoding)' },

  // ── Google service-account-driven APIs (Calendar, Sheets, Drive) ────────
  { name: 'GOOGLE_SERVICE_ACCOUNT_JSON', category: 'optional', description: 'Google service account JSON (Calendar/Sheets/Drive — restrict scopes)' },
  { name: 'GOOGLE_FORMS_SPREADSHEET_ID', category: 'optional', description: 'Operational logs spreadsheet ID (avoid auto-create on first run)' },
  { name: 'GOOGLE_DRIVE_TAX_DOCS_FOLDER_ID', category: 'optional', description: 'Tax docs Drive folder ID' },
  { name: 'GOOGLE_WEATHER_API_KEY', category: 'optional', description: 'Weather widget (graceful hide if missing)' },

  // ── K9000 machine bridge ────────────────────────────────────────────────
  { name: 'MACHINE_SECRET_KEY', category: 'required', description: 'K9000 HMAC signing key (server fail-closes in prod if missing)' },
  { name: 'ALLOWED_MACHINE_IPS', category: 'recommended', description: 'Comma-separated allowlist of K9000 machine IPs' },
  { name: 'MACHINE_ACTIVATION_URL', category: 'optional', description: 'K9000 direct-activation endpoint (Flow A only)' },

  // ── Distributed infra ───────────────────────────────────────────────────
  { name: 'REDIS_URL', category: 'optional', description: 'Redis URL (multi-instance rate-limit; in-memory fallback if absent)' },

  // ── Nayax (audit-gated; sandbox optional, prod payouts/refunds NEEDS DEPENDENCY) ─
  { name: 'NAYAX_API_KEY', category: 'optional', description: 'Nayax API key' },
  { name: 'NAYAX_SECRET', category: 'optional', description: 'Nayax API secret' },
  { name: 'NAYAX_MERCHANT_ID', category: 'optional', description: 'Nayax merchant ID' },
  { name: 'NAYAX_WEBHOOK_SECRET', category: 'optional', description: 'Nayax inbound webhook signing secret' },

  // ── Runtime context ─────────────────────────────────────────────────────
  { name: 'NODE_ENV', category: 'recommended', description: 'production / staging / development' },
];

export interface EnvVarStatus {
  present: boolean;
  category: ConfigCategory;
  description: string;
}

export interface ConfigHealthReport {
  generatedAt: string;
  nodeEnv: string;
  total: number;
  presentCount: number;
  missingRequired: readonly string[];
  missingRecommended: readonly string[];
  /** Map of name → presence + safe metadata. NEVER contains the value. */
  status: Readonly<Record<string, EnvVarStatus>>;
}

/**
 * Pure-function presence check. Touches process.env only via the
 * `name in process.env` operator and a non-empty-string guard. Never
 * reads or returns the value.
 */
function isPresent(name: string): boolean {
  if (!(name in process.env)) return false;
  const v = process.env[name];
  return typeof v === 'string' && v.length > 0;
}

export function buildConfigHealthReport(): ConfigHealthReport {
  const status: Record<string, EnvVarStatus> = {};
  const missingRequired: string[] = [];
  const missingRecommended: string[] = [];
  let presentCount = 0;

  for (const spec of CONFIG_MANIFEST) {
    const present = isPresent(spec.name);
    status[spec.name] = {
      present,
      category: spec.category,
      description: spec.description,
    };
    if (present) {
      presentCount += 1;
    } else if (spec.category === 'required') {
      missingRequired.push(spec.name);
    } else if (spec.category === 'recommended') {
      missingRecommended.push(spec.name);
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    nodeEnv: process.env.NODE_ENV || 'unknown',
    total: CONFIG_MANIFEST.length,
    presentCount,
    missingRequired,
    missingRecommended,
    status,
  };
}

/**
 * Boot-time diagnostic. Logs the count of each category and the NAMES
 * of any missing required / recommended env vars.
 *
 * NEVER logs values. NEVER fails fast — keeps prior boot semantics
 * intact and surfaces the gap in logs. Production aborts/failovers
 * remain a separate, intentional CEO-approved change.
 */
export function logStartupConfigDiagnostic(): ConfigHealthReport {
  const report = buildConfigHealthReport();
  logger.info('[ConfigHealth] env manifest snapshot', {
    nodeEnv: report.nodeEnv,
    total: report.total,
    presentCount: report.presentCount,
    missingRequiredCount: report.missingRequired.length,
    missingRecommendedCount: report.missingRecommended.length,
  });
  if (report.missingRequired.length > 0) {
    // ERROR level so it lands in the deploy alert path, but no throw —
    // a future CEO-approved PR can flip this to fail-fast in production.
    logger.error('[ConfigHealth] MISSING REQUIRED env vars (names only — no values)', {
      missing: report.missingRequired,
    });
  }
  if (report.missingRecommended.length > 0) {
    logger.warn('[ConfigHealth] missing RECOMMENDED env vars (names only — no values)', {
      missing: report.missingRecommended,
    });
  }
  return report;
}
