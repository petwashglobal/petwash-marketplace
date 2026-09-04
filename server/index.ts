// ─────────────────────────────────────────────────────────────────────────────
// EARLY UNCAUGHT-EXCEPTION HANDLERS — first lines of the file on purpose.
//
// Cloud Run silent-startup-failure debugging: when something in the import
// chain throws synchronously, Node prints the error to stderr and exits.
// Cloud Run's revision log captures stderr fine — but a previous CI bug
// hid those lines behind a missing logging.viewer IAM grant for the
// "Diagnose failed revision" workflow step. So operators saw only
// "startup probe failed" with no signal.
//
// These handlers force a clear, unmistakable error block to stdout
// (which Cloud Run ALWAYS captures regardless of severity filter
// settings). They are installed BEFORE the first import below so they
// catch errors raised during the very first imported module's top-level
// code — exactly the place where everything has been silently dying.
//
// Cost: zero. If nothing throws, these listeners are inert. If
// something throws, the next deploy log will have a giant
// "🆘 BOOT-CRASH" block visible without needing IAM grants or
// Logs Explorer queries.
// ─────────────────────────────────────────────────────────────────────────────
process.stdout.write('🟢 [BOOT] server/index.ts module loading t=' + Date.now() + '\n');
// Flipped true once the HTTP server is listening. BEFORE that, an uncaught
// exception is a real boot failure → fast-fail so Cloud Run's probe doesn't hang.
// AFTER that, a recoverable runtime error (e.g. @neondatabase/serverless throwing
// "Cannot set property message of ErrorEvent" on a Neon connection blip) must NOT
// exit — doing so caused a prod restart loop every ~90s that broke signup. (2026-07-30)
let __petwashBootComplete = false;
process.on('uncaughtException', (err: any) => {
  const block = [
    '',
    '🆘══════════════════════════════════════════════════════════════════',
    ' 🆘 UNCAUGHT EXCEPTION DURING SERVER BOOT',
    ' 🆘 (this is why Cloud Run startup probe failed)',
    '🆘══════════════════════════════════════════════════════════════════',
    `  name:    ${err?.name || '(no name)'}`,
    `  message: ${err?.message || String(err)}`,
    `  code:    ${(err as any)?.code || '(no code)'}`,
    `  cause:   ${(err as any)?.cause ? JSON.stringify((err as any).cause).slice(0, 200) : '(no cause)'}`,
    '  stack:',
    String(err?.stack || '(no stack)').split('\n').slice(0, 20).map(l => '    ' + l).join('\n'),
    '🆘══════════════════════════════════════════════════════════════════',
    '',
  ].join('\n');
  process.stdout.write(block);
  process.stderr.write(block);
  // Only fast-fail during BOOT. Once the server is listening, a recoverable
  // uncaught error must not kill the process (the keep-alive net at the bottom
  // of this file logs + lets it recover) — otherwise a single Neon connection
  // blip restart-loops production and breaks signup. (2026-07-30)
  if (__petwashBootComplete) {
    process.stderr.write('[boot-guard] uncaught exception AFTER boot — staying alive, letting it recover\n');
    return;
  }
  // Give the runtime a beat to flush before exiting, then exit 1 so
  // Cloud Run gets a clean signal and doesn't wait 240 s on the probe.
  setTimeout(() => process.exit(1), 250).unref();
});
process.on('unhandledRejection', (reason: any) => {
  const block = [
    '',
    '⚠️══════════════════════════════════════════════════════════════════',
    ' ⚠️  UNHANDLED PROMISE REJECTION DURING BOOT',
    '⚠️══════════════════════════════════════════════════════════════════',
    `  reason: ${reason?.message || String(reason)}`,
    '  stack:',
    String(reason?.stack || '(no stack)').split('\n').slice(0, 20).map(l => '    ' + l).join('\n'),
    '⚠️══════════════════════════════════════════════════════════════════',
    '',
  ].join('\n');
  process.stdout.write(block);
  process.stderr.write(block);
});

// When both GOOGLE_API_KEY (Maps/Places) and GEMINI_API_KEY (Replit integration) are injected,
// the Google AI SDK prints "Both GOOGLE_API_KEY and GEMINI_API_KEY are set" for every client
// instantiation (43+ times at startup). The SDK already uses GOOGLE_API_KEY in this case,
// so GEMINI_API_KEY is redundant. Delete it from the runtime env to suppress the noise.
if (process.env.GOOGLE_API_KEY && process.env.GEMINI_API_KEY) {
  delete process.env.GEMINI_API_KEY;
}

// Mirror APPLE_WALLET_* production secrets onto the env names the wallet code
// reads. Must run before any wallet module is imported (the modern Apple Wallet
// service reads its env at module load). Non-destructive, never logs values.
import { applyWalletEnvCompat } from './lib/wallet-env-compat';
import { logger } from './lib/logger'; // F3: poller-startup failures now log (→ Sentry via F1) instead of a silent catch(){}
{
  const _walletEnvFilled = applyWalletEnvCompat();
  if (_walletEnvFilled > 0) {
    console.log(`[startup] Apple Wallet env compatibility shim normalized ${_walletEnvFilled} name(s)`);
  }
}

// ── Startup error collectors ───────────────────────────────────────────────────
// Throwing before app.listen() exits the process before it binds the port;
// Cloud Run's startup probe never sees a listener → "user-provided container failed
// the configured startup probe checks".  Instead of throwing we record two buckets:
//
//   _startupConfigErrors      – missing or malformed secrets / env vars.
//                               Features that rely on them will fail at call-time,
//                               but the app is not actively dangerous.
//                               /health reports DEGRADED; /health/strict stays 200.
//
//   _startupSecurityViolations – active security dangers: weak admin credentials,
//                               forbidden bypass flags set in production, etc.
//                               These mean the running service IS dangerous right now.
//                               /health reports DEGRADED; /health/strict returns 503.
//
// Both are logged clearly in container stdout for Cloud Run revision logs and exposed
// via /health so operators can diagnose without reading raw logs.
const _startupConfigErrors: string[] = [];
const _startupSecurityViolations: string[] = [];

// ── Startup secrets validation ────────────────────────────────────────────────
(function validateSecrets() {
  const isProd = process.env.NODE_ENV === 'production';

  // Secrets required for core functionality with expected format patterns.
  // In production a missing or malformed value is recorded in _startupConfigErrors
  // and exposed via /health so operators can diagnose without reading Cloud Run logs.
  // Throwing here would exit the process before app.listen() binds the port, causing
  // Cloud Run's startup probe to fail ("user-provided container failed...").
  const REQUIRED: Array<{
    key: string;
    pattern: RegExp;
    hint: string;
    fatalInProd: boolean;
  }> = [
    {
      key: 'TWILIO_ACCOUNT_SID',
      pattern: /^AC[a-f0-9]{32}$/,
      hint: 'Must start with AC and be 34 chars (found in Twilio Console → Account Info)',
      fatalInProd: true,
    },
    {
      key: 'TWILIO_AUTH_TOKEN',
      pattern: /^[a-f0-9]{32}$/,
      hint: 'Must be 32 lowercase hex chars (rotate at console.twilio.com)',
      fatalInProd: true,
    },
    {
      // Primary outbound number used when TWILIO_MESSAGING_SERVICE_SID is absent.
      // Either this OR TWILIO_MESSAGING_SERVICE_SID must be present.
      key: 'TWILIO_PHONE_NUMBER',
      pattern: /^\+[1-9]\d{7,14}$/,
      hint: 'Must be in E.164 format, e.g. +972501234567',
      fatalInProd: false, // non-fatal alone — acceptable if TWILIO_MESSAGING_SERVICE_SID set instead
    },
    {
      // SendGrid API key — required for ALL transactional email.
      // Format is SG.<id>.<secret> — note the SECOND dot separating the two
      // parts. The old class [A-Za-z0-9_-] excluded that dot, so this rule
      // false-flagged EVERY valid key as "🚨 FATAL unexpected format" at boot
      // (harmless — email still worked — but alarming noise). [\w.-] allows it.
      key: 'SENDGRID_API_KEY',
      pattern: /^SG\.[\w.-]{20,}$/,
      hint: 'Must start with "SG." — create at app.sendgrid.com → Settings → API Keys',
      fatalInProd: true,
    },
    {
      key: 'RECAPTCHA_SECRET_KEY',
      pattern: /^6[A-Za-z0-9_-]{39,}$/,
      hint: 'Must start with 6 — get from Google reCAPTCHA console',
      fatalInProd: false,
    },
    {
      key: 'SUPER_ADMIN_EMAILS',
      pattern: /.+@.+/,
      hint: 'Must be at least one valid email address',
      fatalInProd: false,
    },
  ];

  // Placeholder values that operators copy from documentation but never replace.
  // If any configured secret literally matches one of these strings the service
  // that depends on it will fail at call-time with a confusing API error rather
  // than immediately on startup — reject them early.
  const PLACEHOLDER_PATTERNS = [
    /^your-/i,
    /^YOUR_/,
    /^<.*>$/,
    /^example/i,
    /^placeholder/i,
    /^changeme$/i,
    /^\+1234567890$/,          // default phone placeholder in .env.example — update both if example changes
  ];

  function isPlaceholder(val: string): boolean {
    return PLACEHOLDER_PATTERNS.some(re => re.test(val));
  }

  const fatalErrors: string[] = [];
  const warnings: string[] = [];

  for (const { key, pattern, hint, fatalInProd } of REQUIRED) {
    const val = (process.env[key] || '').trim();
    const isFatal = isProd && fatalInProd;
    const push = (msg: string) => (isFatal ? fatalErrors : warnings).push(msg);

    if (!val) {
      push(`[startup] ${isFatal ? '🚨 FATAL' : '⚠️ '} ${key} is missing — ${hint}`);
    } else if (isPlaceholder(val)) {
      push(`[startup] ${isFatal ? '🚨 FATAL' : '⚠️ '} ${key} contains a placeholder value — replace it with the real secret (${hint})`);
    } else if (!pattern.test(val)) {
      push(`[startup] ${isFatal ? '🚨 FATAL' : '⚠️ '} ${key} has unexpected format — ${hint}`);
    }
  }

  // TWILIO_PHONE_NUMBER is individually non-fatal but we need at least one sender.
  if (isProd) {
    const hasPhone    = !!(process.env.TWILIO_PHONE_NUMBER || '').trim();
    const hasMsgSvc   = !!(process.env.TWILIO_MESSAGING_SERVICE_SID || '').trim();
    if (!hasPhone && !hasMsgSvc) {
      fatalErrors.push(
        '[startup] 🚨 FATAL Neither TWILIO_PHONE_NUMBER nor TWILIO_MESSAGING_SERVICE_SID is set — ' +
        'SMS/OTP will be completely non-functional in production'
      );
    }
  }

  if (warnings.length > 0) {
    console.warn('\n' + warnings.join('\n') + '\n');
  }
  if (fatalErrors.length > 0) {
    const msg = '\n' + fatalErrors.join('\n') + '\n';
    console.error(msg);
    // Do NOT throw — a pre-bind crash prevents Cloud Run from ever seeing a listener on
    // the configured port, which causes the startup probe to fail with
    // "user-provided container failed the configured startup probe checks".
    // Record errors and expose via /health so operators can diagnose without needing
    // to read Cloud Run revision logs.
    _startupConfigErrors.push(...fatalErrors);
  }

  // ── ADMIN_SECRET / PETWASH_ADMIN_SECRET weak-value guard ─────────────────────
  // Multiple routes gate admin-only actions behind these secrets.
  // A weak, missing, or default value gives any caller full admin access.
  const WEAK_ADMIN_SECRETS = new Set([
    '', 'change_me', 'changeme', 'secret', 'admin', 'password',
    'petwash', 'test', 'default', '123456', 'admin123',
  ]);
  const MIN_ADMIN_SECRET_LENGTH = 16;
  for (const key of ['ADMIN_SECRET', 'PETWASH_ADMIN_SECRET']) {
    const val = (process.env[key] || '').trim();
    if (!val) {
      const msg = `[startup] SECURITY: ${key} is not set — admin-protected routes will deny all requests`;
      process.env.NODE_ENV === 'production' ? console.error(msg) : console.warn(msg);
    } else if (WEAK_ADMIN_SECRETS.has(val.toLowerCase())) {
      const msg = `[startup] CRITICAL SECURITY: ${key} is set to a known-weak value — rotate immediately!`;
      // Recorded in _startupSecurityViolations (not _startupConfigErrors) because this is
      // an active security danger: any caller can invoke admin routes with a guessable secret.
      // /health/strict returns 503 for security violations, blocking CI smoke-test promotion.
      console.error(msg);
      _startupSecurityViolations.push(msg);
    } else if (val.length < MIN_ADMIN_SECRET_LENGTH) {
      const msg = `[startup] SECURITY: ${key} is shorter than ${MIN_ADMIN_SECRET_LENGTH} characters — use a longer secret`;
      // Same reasoning: short admin secret is an active security weakness, not just a missing feature.
      console.error(msg);
      _startupSecurityViolations.push(msg);
    }
  }

  // ── reCAPTCHA key unification — fatal if frontend and backend keys diverge ──
  function extractSiteKey(raw: string): string {
    if (!raw) return '';
    const m = raw.match(/6L[A-Za-z0-9_-]{38,}/);
    return m ? m[0] : raw.trim();
  }
  const viteKey    = extractSiteKey(process.env.VITE_RECAPTCHA_SITE_KEY || ''); // frontend build-time key (for mismatch check only)
  const backendKey = extractSiteKey(process.env.RECAPTCHA_SITE_KEY || '');
  if (viteKey && backendKey && viteKey !== backendKey) {
    const msg =
      `[startup] FATAL: reCAPTCHA frontend/backend site key mismatch detected.\n` +
      `  VITE_RECAPTCHA_SITE_KEY = ${viteKey.slice(0, 12)}... (frontend)\n` +
      `  RECAPTCHA_SITE_KEY      = ${backendKey.slice(0, 12)}... (backend)\n` +
      `  Frontend tokens will ALWAYS fail backend Enterprise verification.\n` +
      `  Fix: set VITE_RECAPTCHA_SITE_KEY = RECAPTCHA_SITE_KEY (${backendKey})\n` +
      `  The frontend now reads its site key from /api/recaptcha/site-key (backend-authoritative).`;
    // Downgraded from throw → warn: crashing before port binds causes Cloud Run startup probe failure.
    console.warn('\n' + msg + '\n');
  } else if (!backendKey) {
    console.error('[startup] FATAL: RECAPTCHA_SITE_KEY is not set — reCAPTCHA will not function');
  }
})();

import { validateProductionPaymentSecrets as _validatePaymentSecrets } from './lib/payment-provider-mode';

// ── Payment provider mode + production secret validation ────────────────────
// PR-CI-PAYMENT-MODE: refuse to operate live in production when an enabled
// payment provider (Nayax, SUMIT/UPay) lacks its required secrets. Mock mode
// (PAYMENT_PROVIDER_MODE=mock) short-circuits all secret requirements so CI
// smoke and unit tests boot without real vendor credentials. Stripe is
// deprecated; its env vars trigger a deprecation warning here but do NOT crash
// the boot. (Tranzila was fully removed.) See
// server/lib/payment-provider-mode.ts for the canonical contract.
(function validatePaymentProviderSecrets() {
  const result = _validatePaymentSecrets(process.env);
  for (const err of result.errors) {
    console.error('🚨 [PaymentProvider] ' + err);
    _startupConfigErrors.push('[PaymentProvider] ' + err);
  }
  for (const warn of result.deprecationWarnings) {
    console.warn('⚠️  [PaymentProvider] ' + warn);
  }
  console.info(`[PaymentProvider] mode=${result.mode} errors=${result.errors.length} deprecationWarnings=${result.deprecationWarnings.length}`);
})();

import path from "node:path";
import crypto from "node:crypto";
import fs from "node:fs";
import express from "express";
import { pool, db, isDatabaseAvailable } from "./db";
import { classifyRuntimeServices } from "./lib/runtimeServiceHealth";
import { sql } from "drizzle-orm";
import helmet from "helmet";
import compression from "compression";
import { publicAuthRouter } from "./routes/publicAuthRoutes";
import { providerAppRouter } from "./routes/provider-app";
// PR-CI-SMOKE-HOTFIX: top-level ESM-correct imports. These were previously
// inline `require(...)` calls that throw ReferenceError in this ESM module
// (broke /health and would have broken startup config diagnostic + uncaught
// exception / unhandled rejection handlers once smoke got past the Nayax fix).
// Top-level imports load eagerly; call-site try/catch still protects against
// runtime errors inside the called functions.
import { getBuildInfo as _getBuildInfo } from "./lib/buildInfo";
import { logStartupConfigDiagnostic as _logStartupConfigDiagnostic } from "./lib/configHealth";
import { SystemEventService as _SystemEventService } from "./services/SystemEventService";

import cookieParser from "cookie-parser";
import session from "express-session";
import { fileURLToPath } from "node:url";
import cors from "cors";
import { doubleCsrf } from "csrf-csrf";
import { initSentry } from "./lib/observability";
import { initializeGoogleServices } from "./config/google-services";

// --- CRITICAL: Early startup logging for Cloud Run debugging ---
console.log('--------------------------------------------------');
console.log('🚀 [Startup] PetWash Server initializing...');
console.log(`   Timestamp: ${new Date().toISOString()}`);
console.log(`   Node version: ${process.version}`);
console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`   Port: ${process.env.PORT || 8080}`);
console.log(`   DATABASE_URL: ${process.env.DATABASE_URL ? '✅ SET' : '❌ NOT SET'}`);
console.log(`   FIREBASE_SERVICE_ACCOUNT_KEY: ${process.env.FIREBASE_SERVICE_ACCOUNT_KEY ? '✅ SET' : '❌ NOT SET'}`);
console.log(`   COOKIE_SECRET: ${process.env.COOKIE_SECRET ? '✅ SET' : '❌ NOT SET'}`);
console.log(`   GOOGLE_MAPS_API_KEY: ${process.env.GOOGLE_MAPS_API_KEY ? `✅ SET (${process.env.GOOGLE_MAPS_API_KEY.length} chars)` : '❌ NOT SET'}`);
console.log('--------------------------------------------------');

// Validate Places API key in background — runs 10 seconds after boot to avoid slowing startup.
// This catches the silent failure mode where the key in GCP Secret Manager is stale/invalid.
setTimeout(async () => {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) {
    console.warn('[Places] ⚠️  GOOGLE_MAPS_API_KEY not set — Places autocomplete is DISABLED for all users');
    return;
  }
  // Cost guard 2026-06-12: this boot-time validation makes a PAID Places call on
  // every restart. Off by default; set PLACES_LIVE_HEALTHCHECK=true to re-enable.
  if (process.env.PLACES_LIVE_HEALTHCHECK !== 'true') {
    console.warn('[Places] boot key-check skipped (set PLACES_LIVE_HEALTHCHECK=true to re-enable) — no paid Places call');
    return;
  }
  try {
    const res = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': 'suggestions.placePrediction.placeId',
      },
      body: JSON.stringify({ input: 'Tel Aviv', languageCode: 'en', includedRegionCodes: ['il'] }),
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const data = await res.json();
      const count = (data.suggestions || []).length;
      console.log(`[Places] ✅ Places API key valid — ${count} test predictions returned`);
    } else {
      const data = await res.json().catch(() => ({}));
      console.error(
        `[Places] ❌ CRITICAL: Places API key is INVALID (HTTP ${res.status}). ` +
        `All address autocomplete on the live site is broken. ` +
        `Update GOOGLE_MAPS_API_KEY in GCP Secret Manager. ` +
        `Error: ${data?.error?.message || 'Unknown'}`
      );
    }
  } catch (err: any) {
    console.warn(`[Places] ⚠️  Places API key validation failed (network): ${err.message}`);
  }
}, 10_000);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** HTML-encode a string to prevent reflected XSS when embedding in HTML responses. */
function htmlEncode(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

const app = express();
const PORT = Number(process.env.PORT || 8080);

// OBSERVABILITY 2026-06-18: Sentry was fully built but NEVER initialized at boot, so
// auth (and all) failures only ever went to stdout and nobody could see them. Wire it
// now — it safely no-ops when SENTRY_DSN is unset (free tier / self-hosted GlitchTip).
try {
  initSentry();
} catch (e) {
  console.warn('[startup] Sentry init skipped:', (e as Error)?.message);
}

// GOOGLE SERVICES 2026-07-09: initializeGoogleServices() was fully built but,
// exactly like Sentry above, was NEVER called at boot — so the Places singleton
// stayed null and every place-details lookup threw "Google Maps Places service
// not initialized" (station reviews / place details). Wire it now; it logs a
// warning and no-ops cleanly when GOOGLE_MAPS_API_KEY is unset. (Address
// autocomplete uses the key directly and is a SEPARATE issue — the key itself is
// currently EXPIRED, an ops renewal, not a code fix.)
try {
  initializeGoogleServices();
} catch (e) {
  console.warn('[startup] Google Services init skipped:', (e as Error)?.message);
}

// Trust proxy for Replit/Cloud Run deployment
app.set('trust proxy', 1);

// ── STARTUP PHASE TRACKING ─────────────────────────────────────────────────
// Previous production builds bound the Cloud Run port here and continued route
// registration "in the background". That looked clever, but it created a real
// Cloud Run failure mode: once the startup/health request completed, background
// CPU could be throttled and a cold instance could sit forever in loading_routes,
// returning SERVICE_STARTING to every real API request.
//
// Production now binds only after routes/static/catchall are installed. The
// no-traffic candidate deploy + startup probe may take a little longer, but it
// either promotes a truly ready backend or fails closed before customer traffic.
let _initStartedTs = Date.now();
let _initPhase = 'pre_middleware';
let _initError: string | null = null;
// PR-HEALTH-BUILD-SHA operational rule: CI green ≠ deployed. /health carries the
// build identifier (git SHA + build time) under the `build` key so an operator can
// open /health and confirm exactly which revision is actually live — not just that
// a pipeline passed. _getBuildInfo() is a pure, never-throws helper (reads only env),
// so embedding it keeps this ultra-early handler bulletproof for the Cloud Run
// startup probe while restoring the deploy-identity observability.
// FAIL-CLOSED: when init has actually errored (_initError set), return 503 so
// the Cloud Run startup probe FAILS and the broken revision is NOT promoted.
// Previously we returned 200 with body {status:'DEGRADED'} — the probe checks
// status code only, so failed revisions passed and served 503s to real users.
// During normal startup (_initError still null, _initPhase not yet 'ready'),
// we return 200 so the probe's short interval + high failureThreshold budget
// can absorb legitimate cold-start time without rejecting healthy deploys.
const _earlyHealthHandler = (_req: any, res: any) => {
  const hasBooted = !!_initError;
  res.status(hasBooted ? 503 : 200).json({
    status: hasBooted ? 'DEGRADED' : 'OK',
    phase: _initPhase,
    elapsedMs: Date.now() - _initStartedTs,
    error: _initError,
    build: _getBuildInfo(),
    ts: new Date().toISOString(),
  });
};
app.get('/health', _earlyHealthHandler);
app.get('/_health', _earlyHealthHandler);

type HttpServer = ReturnType<typeof app.listen>;

// Heartbeat: emits a line every 10s with current init phase. If the next
// deploy ever fails again, the Cloud Run revision log will show exactly
// which phase the server died in, instead of total silence.
const _startupHeartbeat = setInterval(() => {
  if (_initPhase === 'ready') {
    clearInterval(_startupHeartbeat);
    return;
  }
  const elapsed = ((Date.now() - _initStartedTs) / 1000).toFixed(1);
  console.log(`[Startup t=${elapsed}s] phase=${_initPhase}${_initError ? ` error=${_initError}` : ''}`);
}, 10_000);
_startupHeartbeat.unref();

// 1. Security and basic middleware
const isProduction = process.env.NODE_ENV === 'production';

// A. Security Headers — Helmet (defense-in-depth hardening)
// The enhancedSecurityHeaders middleware (server/middleware/securityHeaders.ts, mounted
// via server/routes.ts) sets the FULL production CSP, HSTS, X-Frame-Options, COOP/COEP,
// etc. on every response. Helmet's values here are a safe minimal baseline that
// enhancedSecurityHeaders will override (res.setHeader replaces, last writer wins).
//
// contentSecurityPolicy: enabled with minimal directives so CodeQL sees a real CSP;
//   disabled in dev so Vite inline-module scripts are not blocked.
// frameguard: enabled everywhere — SAMEORIGIN is the safe default and never breaks flows.
// hsts: enabled in production; enhancedSecurityHeaders sets the same value (idempotent).
// crossOrigin* / referrerPolicy: kept false — enhancedSecurityHeaders sets stronger values;
//   these must NOT be duplicated here or the headers stack with conflicting values.
app.use(helmet({
  contentSecurityPolicy: {
    // CSP is always enabled so CodeQL sees a real policy on every code path.
    // In development a permissive policy is used to allow Vite HMR inline scripts/eval.
    // enhancedSecurityHeaders (server/middleware/securityHeaders.ts) overwrites this with
    // the full production policy on every response, so these directives are only the
    // minimal safe baseline.
    directives: isProduction
      ? {
          // Minimal safe baseline — enhancedSecurityHeaders overwrites this with the
          // full policy (Firebase, Maps, Stripe, etc.) on every production response.
          defaultSrc: ["'self'"],
          objectSrc:  ["'none'"],
          baseUri:    ["'self'"],
        }
      : {
          // Permissive dev baseline: allows Vite HMR inline module scripts and eval()
          defaultSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
          objectSrc:  ["'none'"],
          baseUri:    ["'self'"],
        },
  },
  hsts: isProduction
    ? { maxAge: 31536000, includeSubDomains: true, preload: true }
    : false,                         // No HSTS in dev (localhost is http)
  frameguard: { action: 'sameorigin' }, // X-Frame-Options: SAMEORIGIN — safe everywhere
  crossOriginEmbedderPolicy: false,  // Set exclusively by enhancedSecurityHeaders
  crossOriginOpenerPolicy: false,    // Set exclusively by enhancedSecurityHeaders
  crossOriginResourcePolicy: false,  // Set exclusively by enhancedSecurityHeaders
  referrerPolicy: false,             // Set exclusively by enhancedSecurityHeaders
  noSniff: true,                     // X-Content-Type-Options: nosniff
  xssFilter: false,                  // X-XSS-Protection: 0 — disabled per 2026 OWASP guidance
  dnsPrefetchControl: { allow: false },                        // X-DNS-Prefetch-Control: off
  hidePoweredBy: true,                                         // Remove X-Powered-By header
  permittedCrossDomainPolicies: { permittedPolicies: 'none' }, // X-Permitted-Cross-Domain-Policies: none
}));

// B. Compression (Makes your site load 70% faster)
app.use(compression());

// B2. Maintenance mode — deliberate, operator-controlled kill switch.
// When MAINTENANCE_MODE=true, the API returns 503 for customer-facing
// requests so NO payment, booking, wash activation or wallet mutation can
// run while a partner system is down or during a risky deploy. Deliberately
// lets through:
//   • /api/health*  — so Cloud Run / uptime probes and the maintenance
//     page's auto-retry can tell when we're back
//   • /api/cron/*   — so nightly backups and scheduled jobs keep running
// The branded bilingual page itself is the static /maintenance.html served
// by Firebase Hosting (survives even a fully-dead backend). Default OFF.
app.use((req: any, res: any, next: any) => {
  if (process.env.MAINTENANCE_MODE !== 'true') return next();
  const p = req.path || '';
  if (p.startsWith('/api/health') || p.startsWith('/api/cron/')) return next();
  if (!p.startsWith('/api/')) return next(); // non-API (SPA/static) is CDN-served anyway
  res.set('Retry-After', '120');
  return res.status(503).json({
    maintenance: true,
    error: 'PetWash is temporarily under maintenance — please try again shortly.',
    errorHe: 'PetWash בתחזוקה זמנית — נסו שוב בקרוב.',
    page: '/maintenance.html',
  });
});

// C. CORS — strict allowlist with credential safety (CWE-942)
// Access-Control-Allow-Credentials is ONLY set when the request origin exactly
// matches an entry in the static CORS_EXACT_ORIGINS list OR the closed
// petwash.co.il subdomain regex. Everything is decided INSIDE the `cors`
// package's `origin` callback so the `cors` middleware itself terminates the
// preflight (200/204) with the correct ACAO/ACAC headers set — the old
// "second custom middleware" pattern was dead code on OPTIONS: `cors()` ended
// the OPTIONS request before the subdomain middleware ever ran, so preview
// subdomain preflights got 204 with NO Access-Control-Allow-Origin and the
// browser rejected the follow-up POST. (Behavioral verification — Agent 2
// hunt, 2026-08-20.)
//
// SUBDOMAIN POLICY: only the explicit, controlled apex + subdomain list below
// receives credentialed CORS. The old "trust ANY *.petwash.co.il" fallback
// was too broad — a takeover of an unclaimed subdomain would have inherited
// __session cookies. Real production origins (grepped 2026-08-20 across
// server/, docs/, cloudrun-service.yaml, .github/, firebase.json) are:
//   apex, www, app, signup, admin, api, auth, staging.
const CORS_EXACT_ORIGINS: string[] = [
  'https://petwash.co.il',
  'https://www.petwash.co.il',
  'https://app.petwash.co.il',
  'https://signup.petwash.co.il',
  'https://admin.petwash.co.il',
  'https://api.petwash.co.il',
  'https://auth.petwash.co.il',
  'https://staging.petwash.co.il',
  ...(process.env.BASE_URL ? [process.env.BASE_URL] : ['http://localhost:5000']),
];
const CORS_EXACT_SET = new Set(CORS_EXACT_ORIGINS);
const CORS_DEV_PATTERNS: RegExp[] = [
  /^https:\/\/[a-z0-9-]+\.run\.app$/,
  // Replit preview domains removed 2026-06 — CEO cut all Replit ties.
];

const _CORS_METHODS  = 'GET, POST, PUT, PATCH, DELETE, OPTIONS';
const _CORS_HEADERS  = 'Content-Type, Authorization, X-WebAuthn-CSRF-Token, X-Firebase-AppCheck, X-CSRF-Token';

// Decide-in-one-place origin callback: exact-match apex/www/known subdomains
// only; dev-preview *.run.app in non-prod. User-controlled origin is NEVER
// reflected unchecked — every accept path is either a Set.has() lookup or a
// closed regex anchored to a known suffix. CWE-942 taint path stays closed.
function corsOriginCallback(
  origin: string | undefined,
  cb: (err: Error | null, allow?: boolean) => void,
): void {
  // No Origin header (same-origin request, curl, server-to-server): allow.
  if (!origin) return cb(null, true);
  if (CORS_EXACT_SET.has(origin)) return cb(null, true);
  if (!isProduction && CORS_DEV_PATTERNS.some((p) => p.test(origin))) return cb(null, true);
  if (isProduction) console.warn(`[CORS] Blocked origin: ${origin}`);
  // `cors` package: false = no ACAO header emitted (browser will reject).
  // Do NOT pass an Error here — the cors middleware would 500 the request and
  // shadow the real block reason in the browser.
  return cb(null, false);
}

// 1. Credentialed CORS — the `cors` package handles ALL origin checks AND
//    preflight (OPTIONS) itself. `credentials: true` sets ACAC on every allowed
//    origin, `Vary: Origin` is emitted automatically because `origin` is a fn.
app.use(cors({
  origin: corsOriginCallback,
  credentials: true,
  methods: _CORS_METHODS.split(', '),
  allowedHeaders: _CORS_HEADERS.split(', '),
  maxAge: 86400,
}));

// SendGrid's Event Webhook signature (ECDSA over timestamp + RAW BYTES) can only
// be verified against the exact request body. The global JSON parser was eating
// that body first, so the route-level express.raw() no-op'd and req.body arrived
// as a parsed object — "[object Object]" → JSON.parse crash → 500 → SendGrid
// retry storm (prod logs 2026-07-22). Skip ONLY that path here; every other
// route (incl. the other /api/webhooks/*) keeps the parsed-JSON behavior.
const globalJsonParser = express.json({ limit: '10mb' }); // Increased limit for base64 image uploads
// Same class of bug found on THREE webhook families (SendGrid #1484, then the
// Nayax raw-body audit): route-level express.raw() silently no-ops when this
// global parser has already consumed the body, so signature checks either
// verify the wrong bytes or fail-closed 400 every delivery. Every raw-bytes
// webhook path must be listed here.
const RAW_BODY_WEBHOOK_PATHS = new Set([
  '/api/webhooks/sendgrid',      // SendGrid events — ECDSA over raw bytes
  '/api/webhooks/nayax-events',  // Monyx/kiosk events — HMAC over raw bytes
  '/api/webhooks/whatsapp',      // Meta WhatsApp Cloud API — HMAC-SHA256 over
                                 // raw bytes (x-hub-signature-256). If parsed
                                 // by express.json() first, the signature
                                 // check fails on every real Meta delivery.
  '/api/webhooks/nayax',         // Legacy Nayax webhook (inline handler in
                                 // routes.ts — SHA-256 HMAC over raw bytes via
                                 // nayaxFirestoreService.verifyWebhookSignature).
                                 // NOT covered by the startsWith('/api/webhooks/nayax/')
                                 // guard below because that requires a trailing
                                 // slash — the path Nayax actually posts to per
                                 // docs/NAYAX_PRODUCTION_SETUP_GUIDE.md has NO slash,
                                 // so before this fix every real webhook body was
                                 // consumed by express.json() first, req.body arrived
                                 // as a parsed object, and the handler's
                                 // `req.body as Buffer` cast produced "[object Object]"
                                 // that JSON.parse then crashed → 400 on every delivery.
  '/api/sumit/webhook',          // SUMIT (routes/sumit-webhook.ts) — HMAC-SHA256 over
                                 // raw bytes via sumitClient.verifyWebhookSignature.
                                 // The route mounts its own express.raw({ type: '*/*' })
                                 // but that silently no-ops when the global parser has
                                 // already consumed the body (express body parsers skip
                                 // whenever req._body is set). Before this fix req.body
                                 // arrived as a parsed object, failed the Buffer.isBuffer
                                 // guard at the top of the handler, and returned 400
                                 // invalid_body on every real SUMIT delivery — SUMIT
                                 // then retries on non-2xx, storming the endpoint.
]);
app.use((req, res, next) =>
  (RAW_BODY_WEBHOOK_PATHS.has(req.path) || req.path.startsWith('/api/webhooks/nayax/'))
    ? next()
    : globalJsonParser(req, res, next),
);
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// CRITICAL (2026-06-19): Firebase Hosting CDN strips EVERY request cookie except one
// named exactly `__session` before forwarding to Cloud Run (this is documented Hosting
// behavior, required for its cache layer). Our session cookie is now minted as `__session`
// (see server/lib/sessionCookies.ts) so it survives the Hosting → Cloud Run hop. The ~40
// existing readers still look for `req.cookies.pw_session`, so we alias the forwarded
// `__session` onto `pw_session` here, once, immediately after the cookie parser. This is
// why web login returned HTTP 401 "session cookie not accepted on /api/session/whoami":
// the browser had the cookie, but Hosting deleted it en route to the backend.
// (Native apps authenticate with a Bearer header and never relied on this cookie.)
app.use((req, _res, next) => {
  const c = (req as any).cookies;
  if (c && c.__session && !c.pw_session) {
    c.pw_session = c.__session;
  }
  next();
});

// CSRF protection: double-submit cookie pattern via csrf-csrf (OWASP ASVS 4.0 §4.2.3 / CWE-352)
// Uses csrf-csrf v4 `skipCsrfCheck` to exempt routes that are not CSRF-vulnerable:
//   • GET / HEAD / OPTIONS — safe methods that never mutate state.
//   • /api/webhooks/* — HMAC-verified out-of-band; browsers cannot forge HMAC signatures.
//   • /api/pass/apple/v1/* — Apple Wallet PassKit web service calls authenticate with
//     Authorization: ApplePass <token>, and Wallet cannot send a browser CSRF header.
//   • Bearer-authenticated requests — browsers cannot auto-attach Authorization headers,
//     so cross-origin requests with Authorization: Bearer <token> are not CSRF-vulnerable.
// `doubleCsrfProtection` is applied via app.use() directly so CodeQL's
// js/missing-csrf-middleware query can statically detect the protection.
// SEV-1 evil-hunt 2026-08-20: the previous fallback (random per-instance key)
// silently broke multi-instance Cloud Run — a CSRF token minted on instance A
// is unverifiable on instance B (different secret), so every CSRF-protected
// POST rolled the dice on 403 EBADCSRFTOKEN under any horizontal scale. In
// production we FAIL BOOT if neither SESSION_SECRET nor COOKIE_SECRET is set
// (better a loud crash Cloud Run reports than silent EBADCSRFTOKEN storms);
// non-production continues to accept an ephemeral key with a WARN so local
// dev / tests don't require the env. The secret VALUE is never logged.
const _csrfSecretFromEnv = process.env.SESSION_SECRET || process.env.COOKIE_SECRET;
const csrfSecretConfigured = !!_csrfSecretFromEnv;
const csrfSecret: string = _csrfSecretFromEnv || (() => {
  if (process.env.NODE_ENV === 'production') {
    // Fail loud + fast. Cloud Run marks the revision unhealthy and reports the
    // reason to the operator; no request is served against a per-instance key.
    console.error('[startup] FATAL: SESSION_SECRET and COOKIE_SECRET are both unset in production. Set one in Secret Manager and redeploy — refusing to boot with a per-instance CSRF key (would silently break multi-instance CSRF verification).');
    throw new Error('SESSION_SECRET_REQUIRED_IN_PRODUCTION');
  }
  const fallback = crypto.randomBytes(32).toString('hex');
  console.error('[startup] SECURITY: SESSION_SECRET and COOKIE_SECRET are both unset — CSRF protection uses an ephemeral key. Fine for dev/tests; MUST be set in production.');
  return fallback;
})();

// Auth session / OTP endpoints that are exempt from CSRF token validation.
// Security on each is enforced by Firebase ID-token verification or Twilio OTP
// (both server-verified), making a second CSRF layer redundant here.
// These POSTs originate on the login page before any session cookie exists, so
// the browser never has a pw.csrf cookie to send — the middleware would reject
// them all with 403 and break every login method (email, Google, phone, magic-link).
//
// Post-login auth-flow endpoints are also exempt: they are always called
// immediately after a successful Firebase sign-in (before the pw.csrf cookie
// is reliably issued to the new browser session), the frontend has no CSRF-token
// plumbing, and each endpoint is already protected by Firebase session-cookie
// verification (requireAuth).  Exempting them here removes a broken CSRF gate
// that would otherwise silently block all role-routing, onboarding, and admin
// redirects with a 403 — causing every login to fall back to /home regardless
// of the user's role.
//
// NOTE: /api/auth/signout is intentionally NOT exempt: it operates on an existing
// session, so CSRF protection there prevents a malicious page from force-logging users out.
const AUTH_CSRF_EXEMPT = new Set([
  '/api/auth/session',
  '/api/auth/phone-session',
  '/api/auth/phone/send-code',
  '/api/auth/phone/verify-code',
  // Canonical "Sprint 2" SMS auth front door (server/routes/auth-sms.ts). Same
  // pre-session origin and same Twilio-OTP-as-primary-auth property as the
  // legacy /phone/send-code + /phone/verify-code pair above. Without these
  // entries the live login page (SignIn.tsx) and signup page (SignUpLuxury.tsx)
  // get EBADCSRFTOKEN on every "send code" attempt, since both call
  // /api/auth/sms/start and /api/auth/sms/verify directly.
  '/api/auth/sms/start',
  '/api/auth/sms/verify',
  // Email-code OTP front door (server/routes/auth-email.ts) — same pre-session
  // origin as the SMS pair; the matched code IS the auth proof. Without these,
  // SignUpLuxury's "send email code" gets EBADCSRFTOKEN before any session exists.
  '/api/auth/email/start',
  '/api/auth/email/verify',
  // Passwordless email login — mints a customToken from the HMAC-signed proof
  // returned by /api/auth/email/verify (mirror of /api/auth/phone-session).
  // Pre-session origin, the proof token IS the auth. Without this it 403s.
  '/api/auth/email-session',
  // Dual-verify step 2 (server/routes/publicAuthRoutes.ts:601 & :681). The
  // client (SignUpLuxury.tsx dual-verify block) POSTs an id-token + a signed
  // email-/mobile-verified proof token in the JSON body — the handler
  // Firebase-Admin-verifies BOTH before doing anything. Neither the id-token
  // nor the proof token rides in an Authorization: Bearer header, so the
  // Bearer-CSRF-skip does NOT fire and the global gate returns 403
  // EBADCSRFTOKEN — dead-ending EVERY signup at the "second contact" step.
  // (Signup-friction audit 2026-08-19 SEV-1 #1.)
  '/api/auth/verify-signup-email',
  '/api/auth/verify-signup-mobile',
  // Post-login role-routing and onboarding steps — all require a valid Firebase
  // session cookie (requireAuth) which already scopes them to the authenticated user.
  '/api/auth/post-login',
  '/api/auth/choose-role',
  '/api/auth/complete-profile',
  // Two-step login (mfa/sms) — the pre-session challenge posts an idToken +
  // MFA proof in the JSON body BEFORE a session cookie exists. Missing from
  // the exempt list = 403 EBADCSRFTOKEN on every 2FA'd account, locking
  // legacy/admin-provisioned users out at login even with TWO_STEP_LOGIN_READY
  // gated off. (Firebase-audit 2026-08-20 SEV-2 #5.)
  '/api/auth/login/2fa/start',
  '/api/auth/login/2fa/verify',
  // Pre-session / anonymous auth-namespace POSTs that fire DURING sign-in,
  // before a Firebase Bearer or pw.csrf cookie exists. None mutate
  // auth-sensitive third-party state:
  //   • seed-intent  — writes the visitor's OWN signup-intent cookie so
  //     returning users route to the right onboarding after OAuth. Was 403 →
  //     returning providers landed on /home instead of /provider-onboarding.
  //   • client-event / track-error — anonymous auth telemetry into
  //     auth_events (same safety profile as /api/track/interactions).
  '/api/auth/seed-intent',
  '/api/auth/client-event',
  '/api/auth/track-error',
  // Client-side error reporter (routes.ts POST /api/errors/log). It fires
  // EXACTLY when something breaks for an anonymous visitor — the moment a
  // pw.csrf cookie is least likely to exist. Live proof 2026-07-23 22:59: a
  // visitor's signup crashed, the app tried to report it, and the reporter
  // itself was rejected 403 EBADCSRFTOKEN — leaving us blind to the original
  // error. Telemetry-only endpoint (writes an error row; mutates nothing).
  '/api/errors/log',
]);

const { doubleCsrfProtection, generateCsrfToken } = doubleCsrf({
  getSecret: () => csrfSecret,
  // REQUIRED in csrf-csrf v4 (no default). Without it, the library calls
  // `getSessionIdentifier(req)` → `undefined(req)` → THROWS "getSessionIdentifier
  // is not a function", so `generateCsrfToken` 500s (GET /api/csrf-token) and
  // token validation errors — meaning NO csrf cookie is ever issued and EVERY
  // protected POST returns 403 EBADCSRFTOKEN. That silently broke marketplace
  // search, booking creation, and new-user / loyalty / provider onboarding.
  // We use stateless double-submit (token in the pw.csrf cookie must equal the
  // X-CSRF-Token header), so a constant identifier is correct — CSRF-validated
  // requests here are the anonymous/cookie ones (Bearer-authed calls skip CSRF).
  // (2026-08-11)
  getSessionIdentifier: () => '',
  cookieName: 'pw.csrf',
  cookieOptions: {
    sameSite: isProduction ? ('strict' as const) : ('lax' as const),
    secure: isProduction,
    httpOnly: false, // Must be JS-readable so the frontend can send it in X-CSRF-Token
  },
  size: 64,
  getCsrfTokenFromRequest: (req: any) => req.headers['x-csrf-token'] as string | undefined,
  // skipCsrfProtection: routes that are inherently CSRF-safe and do not need token validation.
  skipCsrfProtection: (req: any) => {
    // Safe HTTP methods never mutate state.
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return true;
    // HMAC-verified webhooks are authenticated out-of-band; not CSRF-vulnerable.
    if (/^\/api\/webhooks\//.test(req.path)) return true;
    // SUMIT's payment/document callback (server/routes/sumit-webhook.ts, mounted
    // at /api/sumit/webhook). SUMIT is server-to-server and cannot send the
    // double-submit X-CSRF-Token; the handler HMAC-verifies the raw body with
    // SUMIT_WEBHOOK_SECRET before doing anything. Without this skip the global
    // CSRF gate 403s every real SUMIT webhook before activation can run — the
    // [[csrf-public-post-regression-class]] failure mode.
    if (req.path === '/api/sumit/webhook') return true;
    // WebAuthn / passkey (Face ID, Touch ID) ceremonies are inherently CSRF-safe:
    // every register/authenticate step requires a SERVER-ISSUED challenge (stored in
    // a signed, HMAC'd cookie) AND the authenticator signs over the page origin, which
    // verifyRegistration/AuthenticationResponse checks via expectedOrigin/expectedRPID.
    // A cross-origin attacker can neither read the challenge nor produce a valid signed
    // assertion. Without this skip the @simplewebauthn/browser client (which sends no
    // X-CSRF-Token) gets EBADCSRFTOKEN on /register/options + /register/verify, so
    // passkey ENROLLMENT silently fails — the reported "Face ID doesn't work" bug.
    if (/^\/api\/webauthn\//.test(req.path)) return true;
    // Maya voice provider webhooks (Twilio, Vapi, Retell, etc.) are server-to-server
    // and authenticated by provider HMAC at the route level (e.g. X-Twilio-Signature
    // in TwilioVoiceProvider). Browsers never originate these requests, so there is
    // no CSRF attack surface. Without this exemption every inbound call is rejected
    // with EBADCSRFTOKEN before the route handler runs.
    if (/^\/api\/maya\/voice\//.test(req.path)) return true;
    // Apple Wallet's PassKit web service is called by iOS Wallet, not the SPA.
    // It authenticates with Authorization: ApplePass <token> and cannot provide
    // the double-submit X-CSRF-Token header used by browser clients.
    if (/^\/api\/pass\/apple\/v1\//.test(req.path)) return true;
    // Bearer-authenticated requests: browsers cannot auto-attach Authorization headers
    // on cross-origin requests, so there is no CSRF attack surface here.
    const authHeader = req.headers['authorization'] as string | undefined;
    if (authHeader?.startsWith('Bearer ')) return true;
    // Auth session / OTP endpoints (see AUTH_CSRF_EXEMPT above).
    if (AUTH_CSRF_EXEMPT.has(req.path)) return true;
    // navigator.sendBeacon() cannot attach custom headers per the W3C Beacon spec,
    // so an X-CSRF-Token header is physically impossible from the call site at
    // client/src/lib/interactionTracker.ts:294. The endpoint only records
    // anonymous UX telemetry (no auth-sensitive state mutation), so the lack of a
    // CSRF token is acceptable. Live production was returning 403 on every flush.
    if (req.path === '/api/track/interactions') return true;
    // Same class as /api/track/interactions: anonymous auth-event telemetry
    // beacon (client/src/lib/authTelemetry via sendBeacon / fetch). The handler
    // (routes.ts /api/telemetry/auth) only logs and returns 204 — no auth-
    // sensitive mutation — but it was NOT exempted, so CSRF returned 403 on
    // every anonymous pageview and the client logged an [API Error]. Exempt it.
    if (req.path === '/api/telemetry/auth') return true;
    // Cloud-Scheduler backup trigger (server/routes/cron-backup.ts). Machine-to-
    // machine; authenticated by the x-cron-secret header (timing-safe vs CRON_SECRET),
    // not a browser cookie, so the double-submit CSRF token can't be sent. Without
    // this skip, Cloud Scheduler's POST is 403'd before the handler's secret check.
    if (/^\/api\/cron\//.test(req.path)) return true;
    // Public cookie-banner consent capture (client/src/lib/consent.ts:70).
    // Hit by unauthenticated visitors on first-page-load before a pw.csrf cookie
    // is established, and the endpoint only writes the visitor's own consent
    // choices. Same path was returning 403 in production; exempt until a token
    // round-trip helper is added to the client.
    // Consent capture — the visitor's OWN consent choices (cookie banner,
    // biometric/Face-ID consent required by Apple & Google, OAuth consent
    // audit fired at sign-in, onboarding consent). All run pre/peri-login
    // with no Bearer, write no auth-sensitive state, and were each returning
    // 403 EBADCSRFTOKEN in production. Prefix-match covers the sub-paths
    // (/api/consent/biometric, /oauth, /onboarding) — the old exact-match
    // only covered the bare cookie-banner POST.
    if (/^\/api\/consent(\/|$)/.test(req.path)) return true;
    // Public contact form (client/src/pages/Contact.tsx). Unauthenticated
    // visitors, Zod-validated, rate-limited (apiLimiter) — same profile as
    // the already-exempt /api/global-forms and /api/franchise/inquiry.
    if (req.path === '/api/contact') return true;
    // Public waitlist / demand-capture (client "Join waitlist" / "Notify me").
    // Anonymous visitors POST interest before any login — Zod-validated,
    // rate-limited, consent-gated. Same safety profile as /api/contact.
    if (req.path === '/api/waitlist') return true;
    // Booking Rescue intent capture ("no dead clicks") — anonymous + logged-in
    // POST started-but-stopped events; Zod-validated, rate-limited, no money path.
    if (req.path === '/api/intent') return true;
    // Kenzo AI chat widget (client/src/components/AiChatWidget.tsx → POST
    // /api/ai/chat). Anonymous visitors converse with Kenzo before any login,
    // so there is no Firebase Bearer and no pw.csrf cookie round-trip. The
    // endpoint mutates no auth-sensitive state (it returns an AI answer and
    // logs an anonymous learned-FAQ row) and is already double rate-limited
    // (aiChatLimiter + aiChatHourlyLimiter). Without this exemption EVERY
    // Kenzo message returned 403 EBADCSRFTOKEN in production — the reported
    // "Kenzo stopped working across all devices" regression.
    if (req.path === '/api/ai/chat') return true;
    // Public lead-capture / marketing forms (server/routes/globalForms.ts mounted
    // at /api/global-forms, and the franchise-prospect inquiry at
    // /api/franchise/inquiry from server/routes/franchise.ts). These accept
    // submissions from unauthenticated visitors who have no pw.csrf cookie yet,
    // each handler validates its own payload with Zod, and rate limiting is
    // already enforced upstream (apiLimiter). Without this exemption every
    // contact/newsletter/franchise/sales-lead/refund-request POST was returning
    // 403 in production — the public lead-capture pipeline was silently dead.
    if (/^\/api\/global-forms\//.test(req.path)) return true;
    if (req.path === '/api/franchise/inquiry') return true;
    // PUBLIC careers / CV application (client/src/pages/Careers.tsx → the
    // four anonymous POSTs of the apply flow). /careers is an open page and
    // every one of these routes is deliberately unauthenticated
    // (server/routes/careers.ts: /apply, /start-application, and the two
    // /applications/:id/* draft routes carry NO validateFirebaseToken), so an
    // applicant who is not signed in sends NO Bearer — and without a Bearer the
    // global gate 403'd EBADCSRFTOKEN on every step. Net effect: the entire
    // public job-application funnel, CV upload included, was silently dead for
    // exactly the people it exists for. The classic
    // [[csrf-public-post-regression-class]] failure.
    //
    // Safe to exempt: the two /applications/:id/* routes require `sessionId`,
    // a server-issued UUID handed out by /start-application and checked with
    // sessionIdOwns() (careers.ts:30) — a cross-origin attacker cannot read it,
    // so a forged POST is rejected 403 on ownership regardless of CSRF. /apply
    // and /start-application are Zod-validated, rate-limited (apiLimiter at the
    // mount) lead-capture with no auth-sensitive state — the same profile as
    // /api/contact and /api/franchise/inquiry above.
    //
    // Scoped deliberately: /api/careers/admin/* (applicant PII, shortlist and
    // status mutations, positions CRUD) is NOT matched and keeps full CSRF
    // protection.
    if (req.path === '/api/careers/apply') return true;
    if (req.path === '/api/careers/start-application') return true;
    if (/^\/api\/careers\/applications\/[^/]+\/(autosave|documents)$/.test(req.path)) return true;
    // PUBLIC guest eGift checkout (server/routes/egift-guest.ts → POST
    // /api/egift/guest/start). A stranger buys a gift WITHOUT signing up, so
    // there is no Firebase Bearer and — on a first visit — no pw.csrf cookie to
    // round-trip. Same safety profile as the other public POSTs above and then
    // some: Turnstile bot-check + payment rate limiter, a SERVER-OWNED price
    // (the client cannot dictate the amount), and PAY-THEN-ISSUE (nothing of
    // value is created until SUMIT verifies the charge). Without this the guest
    // buy 403s EBADCSRFTOKEN — the [[csrf-public-post-regression-class]] failure.
    if (req.path === '/api/egift/guest/start') return true;
    return false;
  },
});

// Expose a GET endpoint so the SPA can fetch a fresh CSRF token on load.
app.get('/api/csrf-token', (req: any, res: any) => {
  res.json({ csrfToken: generateCsrfToken(req, res) });
});

// Apply CSRF middleware globally. Exemptions are declared inside skipCsrfCheck above.
// Calling app.use(doubleCsrfProtection) directly (not wrapped) lets CodeQL's
// js/missing-csrf-middleware query recognise the protection on this Express app.
app.use(doubleCsrfProtection);

// D. Session with ENHANCED security settings
app.use(
  session({
    name: 'pw.sid', // Custom session cookie name (obscure default)
    secret: process.env.SESSION_SECRET || process.env.COOKIE_SECRET || (() => {
      // Same rule as CSRF (index.ts:724-733): hard-fail in production so a
      // misconfigured revision is marked unhealthy by Cloud Run instead of
      // silently issuing per-instance random session keys. On scale-out
      // every replica would generate its own key → session cookies from
      // replica A are invalid on replica B → users randomly logged out.
      if (process.env.NODE_ENV === 'production') {
        console.error('[startup] FATAL: SESSION_SECRET and COOKIE_SECRET are both unset in production. Set one in Secret Manager and redeploy — refusing to boot with a per-instance session key.');
        throw new Error('SESSION_SECRET_REQUIRED_IN_PRODUCTION');
      }
      const fallback = crypto.randomBytes(32).toString('hex');
      console.error('[startup] SECURITY: SESSION_SECRET and COOKIE_SECRET are both unset — sessions use an ephemeral key. Fine for dev/tests; MUST be set in production.');
      return fallback;
    })(),
    resave: false,
    saveUninitialized: false,
    rolling: true, // Reset expiry on each request (keep active users logged in)
    cookie: {
      secure: isProduction, // HTTPS only in production
      httpOnly: true, // Prevent JavaScript access
      sameSite: isProduction ? 'strict' : 'lax', // STRICT in production for max CSRF protection
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      domain: isProduction ? '.petwash.co.il' : undefined // Share across subdomains in production
    }
  })
);

// Canonical URL redirect (www → non-www) for SEO.
//
// Uses 308 (Permanent Redirect) NOT 301: `authDomain: petwash.co.il` makes
// www.petwash.co.il a foreign origin, so if any client lands on www and the
// browser POSTs /api/auth/session (or any other auth-relevant POST) before
// the client-side www→apex JS runs, the browser downgrades 301 + POST to
// GET, dropping the idToken body. 308 preserves method AND body so the mint
// call reaches the apex intact. GETs behave identically under 308.
app.use((req, res, next) => {
  const host = req.get('host')?.toLowerCase() || '';
  if (host.startsWith('www.')) {
    const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
    const nonWwwHost = host.replace(/^www\./, '');
    return res.redirect(308, `${protocol}://${nonWwwHost}${req.originalUrl}`);
  }
  next();
});

// --- 2026 HEALTH MONITORING (Cloud Run Production Standard) ---
let serverReady = false;

// PR-HEALTH-READY: sanitized startup phase label exposed via /api/health.
// Pure label — never carries error content, env names, or secret values.
// Transitions: booting → loading_routes → registering_routes → ready
//                       (or → failed on caught exception, no detail exposed)
let startupPhase: 'booting' | 'loading_routes' | 'registering_routes' | 'ready' | 'failed' = 'booting';
const bootEpochMs = Date.now();

// PR-HEALTH-READY-2: when startupPhase transitions to 'failed' in the catch
// block, capture WHICH phase we were in at the moment of catch + the error
// constructor name only. NEVER the message / stack / code (those can leak
// internal paths or secret-derived text). Pure diagnostic labels.
let failedAtPhase: 'loading_routes' | 'registering_routes' | null = null;
let errorKind: string | null = null;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let t: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    t = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (t) clearTimeout(t);
  });
}

const healthState = {
  bootTs: new Date().toISOString(),
  db: {
    ok: false as boolean,
    lastOkAt: null as string | null,
    lastCheckAt: null as string | null,
    lastError: null as string | null,
    lastMs: null as number | null,
  },
  app: { ok: true, routesReady: false },
};

const dbConnectFn = async () => {
  if (!isDatabaseAvailable) throw new Error('DATABASE_URL not configured');
  const client = await pool.connect();
  client.release();
};
const dbPingFn = async () => {
  if (!isDatabaseAvailable) throw new Error('DATABASE_URL not configured');
  await db.execute(sql`SELECT 1`);
};

async function connectDbNonBlocking(): Promise<void> {
  const t0 = Date.now();
  console.log('[DB] connecting...');
  try {
    await withTimeout(dbConnectFn(), 5000, 'DB connect');
    const ms = Date.now() - t0;
    console.log(`[DB] connected in ${ms}ms`);
    healthState.db.ok = true;
    healthState.db.lastError = null;
    healthState.db.lastOkAt = new Date().toISOString();
    healthState.db.lastMs = ms;
  } catch (e: any) {
    const ms = Date.now() - t0;
    const msg = e?.message ? e.message : String(e);
    console.error(`[DB] connect failed in ${ms}ms: ${msg}`);
    healthState.db.ok = false;
    healthState.db.lastError = msg;
    healthState.db.lastMs = ms;
  }
}

async function checkDbOnce(): Promise<{ ok: boolean; ms: number; error?: string }> {
  const t0 = Date.now();
  healthState.db.lastCheckAt = new Date().toISOString();
  try {
    await withTimeout(dbPingFn(), 2000, 'DB ping');
    const ms = Date.now() - t0;
    healthState.db.ok = true;
    healthState.db.lastError = null;
    healthState.db.lastOkAt = new Date().toISOString();
    healthState.db.lastMs = ms;
    return { ok: true, ms };
  } catch (e: any) {
    const ms = Date.now() - t0;
    const msg = e?.message ? e.message : String(e);
    healthState.db.ok = false;
    healthState.db.lastError = msg;
    healthState.db.lastMs = ms;
    return { ok: false, ms, error: msg };
  }
}

// /health/strict — CI deployment gate.
//
// Returns 503 ONLY when _startupSecurityViolations is non-empty, i.e. when the app
// is ACTIVELY DANGEROUS right now:
//   • weak / guessable admin credentials
//   • payment-signature bypass flag set in production or staging
//
// Missing or malformed secrets (_startupConfigErrors) do NOT trigger a 503 here because:
//   • their absence degrades features but does not make the app insecure
//   • the CI smoke test runs with no real secrets intentionally; blocking on absent secrets
//     would make /health/strict return 503 every time in CI regardless of code quality
//
// /health (above) always returns 200 and reports both buckets — use it for Cloud Run
// startup/liveness probes.  Use /health/strict only as a deployment promotion gate.
app.get('/health/strict', (_req, res) => {
  res.set('X-Octopus-Source', 'petwash-backend-global');
  const timestamp = new Date().toISOString();
  const runtime = classifyRuntimeServices(process.env, isDatabaseAvailable);
  if (_startupSecurityViolations.length > 0) {
    return res.status(503).json({
      status: 'DANGEROUS',
      timestamp,
      bootTs: healthState.bootTs,
      runtimeServices: runtime,
      checks: {
        process: true,
        env: process.env.NODE_ENV || 'unknown',
        securityViolations: _startupSecurityViolations,
        ...(_startupConfigErrors.length > 0 ? { configErrors: _startupConfigErrors } : {}),
      },
      message:
        'Container has active security violations. ' +
        'Fix the items in checks.securityViolations and redeploy before promoting traffic.',
    });
  }
  return res.status(200).json({
    status:
      runtime.productionCriticalMissing.length > 0
        ? 'CRITICAL'
        : _startupConfigErrors.length > 0
          ? 'DEGRADED'
          : 'OK',
    timestamp,
    bootTs: healthState.bootTs,
    runtimeServices: runtime,
    checks: {
      process: true,
      env: process.env.NODE_ENV || 'unknown',
      // securityViolations is empty (guaranteed by the guard above) — omitted for brevity;
      // consumers can treat absence as equivalent to an empty array.
      ...(_startupConfigErrors.length > 0 ? { configErrors: _startupConfigErrors } : {}),
    },
  });
});

/**
 * Post-release 2026-09-03 (backlog P1): /api/release-info.
 *
 * A tiny, always-on endpoint that returns just the deployed build's
 * fingerprint — git SHA, Cloud Run revision, and build timestamp.
 * Used by scripts/critical-route-canary.sh + release-smoke.yml to
 * confirm the revision under test is actually the one they expected,
 * not a rolled-back or mid-flight one. Never touches the DB.
 *
 * Sources (with graceful fallbacks so the endpoint is always cheap):
 *   • GIT_SHA          — injected by the CI build step. `unknown` if unset.
 *   • BUILD_TIMESTAMP  — ISO8601 injected at build time. Falls back to
 *                        the boot epoch, which is the same for the whole
 *                        revision.
 *   • K_REVISION       — Cloud Run auto-sets this per revision.
 */
app.get('/api/release-info', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.status(200).json({
    sha: process.env.GIT_SHA || 'unknown',
    revision: process.env.K_REVISION || null,
    builtAt: process.env.BUILD_TIMESTAMP || new Date(bootEpochMs).toISOString(),
    bootTs: healthState.bootTs,
    nodeEnv: process.env.NODE_ENV || 'unknown',
  });
});

app.get('/api/health', async (_req, res) => {
  const db = await checkDbOnce();
  const status = db.ok ? 'OK' : 'DEGRADED';
  const traceId = crypto.randomUUID();
  // PR-HEALTH-READY: sanitized fields only. NO startupError.message, NO
  // stack traces, NO env var names, NO secret names, NO DB / provider keys.
  // Pure boolean + label state — see startupPhase typedef for the closed
  // enum surface. K_REVISION is set by Cloud Run automatically (revision
  // name, public-safe).
  res.status(200).json({
    status,
    timestamp: new Date().toISOString(),
    checks: { db: { ok: db.ok, ms: db.ms } },
    routesReady: !!healthState.app.routesReady,
    serverReady,
    startupPhase,
    failedAtPhase,
    errorKind,
    bootTs: healthState.bootTs,
    uptimeSec: Math.floor((Date.now() - bootEpochMs) / 1000),
    traceId,
    revision: process.env.K_REVISION || null,
    // Boolean only — NEVER the secret value. Operators use this to confirm
    // multi-instance CSRF verification will actually agree across pods.
    csrfSecretConfigured,
    state: {
      bootTs: healthState.bootTs,
      app: { ok: healthState.app.ok, routesReady: healthState.app.routesReady },
      db: {
        ok: healthState.db.ok,
        lastOkAt: healthState.db.lastOkAt,
        lastCheckAt: healthState.db.lastCheckAt,
      },
    },
  });
});

// Bot-check production readiness — reports whether the environment variables
// required by the Turnstile enforcement middleware are configured. Returns
// BOOLEANS only, never the key values. Operators use this to verify a
// deployment has the secrets set before flipping enforcement live.
app.get('/api/health/bot-check', (_req, res) => {
  const turnstileServerConfigured = !!process.env.TURNSTILE_SECRET_KEY;
  // The client-side site key rides with the built bundle so a running
  // server cannot observe it directly. What it CAN observe: whether the
  // envs it needs (TURNSTILE_SECRET_KEY) are present, and whether the
  // widget's paired env name (VITE_TURNSTILE_SITE_KEY) was set at build
  // time (some deployments export it to the server env too for a matched
  // pair). Both flags exposed so an ops dashboard can flag a mismatched
  // rollout without exposing key material.
  const turnstileSiteKeyEnvPresent = !!process.env.VITE_TURNSTILE_SITE_KEY;
  const enforcementActive = turnstileServerConfigured;
  res.status(200).json({
    status: enforcementActive ? 'READY' : 'ADVISORY',
    timestamp: new Date().toISOString(),
    botCheck: 'turnstile',
    turnstileServerConfigured,
    turnstileSiteKeyEnvPresent,
    enforcementActive,
    protectedSurfaces: [
      'signup_sms_start',
      'signup_email_start',
    ],
    note: enforcementActive
      ? 'Turnstile enforced on protected surfaces. Missing/invalid tokens will 400/403.'
      : 'TURNSTILE_SECRET_KEY not set — protected surfaces log a WARN and skip the check.',
  });
});

app.get('/api/health/strict', async (_req, res) => {
  const db = await checkDbOnce();
  if (!db.ok) {
    return res.status(503).json({
      status: 'DOWN',
      timestamp: new Date().toISOString(),
      checks: { db: { ok: false, ms: db.ms } },
    });
  }
  return res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    checks: { db: { ok: true, ms: db.ms } },
  });
});

// --- Places health — registered BEFORE the startup guard so it is always reachable ---
// routes.ts takes >120 s to load on a cold start (GCP service inits).  The startup guard
// blocks every non-health path until serverReady=true.  Registering this route here means
// Express matches it before the guard middleware fires, bypassing the 503 window entirely.
app.get('/api/google/places-health', async (req, res) => {
  const traceId = (req as any).traceId || crypto.randomUUID().slice(0, 12);
  const checks: Record<string, any> = {
    traceId,
    timestamp: new Date().toISOString(),
    apiKeyConfigured: !!process.env.GOOGLE_MAPS_API_KEY,
    apiKeyLength: process.env.GOOGLE_MAPS_API_KEY?.length || 0,
  };

  if (!process.env.GOOGLE_MAPS_API_KEY) {
    checks.status = 'GOOGLE_KEY_MISSING';
    checks.reason = 'GOOGLE_MAPS_API_KEY env var not present in runtime';
    return res.status(200).json(checks);
  }

  // Cost guard 2026-06-12: this PUBLIC, unauthenticated endpoint made a PAID
  // Places call on every hit (trivially abusable → runaway bill). By default it
  // now reports config status only. Set PLACES_LIVE_HEALTHCHECK=true to allow the
  // live probe (and ideally protect/rotate the key in GCP first).
  if (process.env.PLACES_LIVE_HEALTHCHECK !== 'true') {
    checks.status = 'CONFIG_ONLY';
    checks.reason = 'Live Places probe disabled (PLACES_LIVE_HEALTHCHECK!=true) — no paid call made';
    return res.status(200).json(checks);
  }

  try {
    const response = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': process.env.GOOGLE_MAPS_API_KEY,
        'X-Goog-FieldMask': 'suggestions.placePrediction.placeId,suggestions.placePrediction.text',
      },
      body: JSON.stringify({ input: 'Tel Aviv', languageCode: 'en', includedRegionCodes: ['il'] }),
    });
    const data = await response.json() as any;
    checks.googleHttpStatus = response.status;
    checks.predictionsCount = (data.suggestions || []).length;
    if (response.ok) {
      checks.status = 'OK';
    } else if (response.status === 401 || response.status === 403) {
      checks.status = 'GOOGLE_KEY_INVALID';
      checks.reason = data.error?.message || `Google rejected key (HTTP ${response.status})`;
    } else {
      checks.status = `HTTP_${response.status}`;
      checks.reason = data.error?.message || `Unexpected HTTP ${response.status} from Google`;
    }
  } catch (error: any) {
    checks.status = 'NETWORK_ERROR';
    checks.reason = `Could not reach Google Places API: ${error.message}`;
  }

  return res.status(200).json(checks);
});

// --- Early-mount critical auth routes (cold-start safety) ---
// publicAuthRouter contains phone OTP, session creation, and simple-auth/me.
// Mounting it here (before registerRoutes) means these endpoints are available
// immediately on first request — even during the 60-120 s Cloud Run cold-start
// window where registerRoutes() is still executing.
// registerRoutes() skips re-mounting this router to prevent duplicate handling.
app.use(publicAuthRouter);
// Provider-app API (native iOS). Inert unless PROVIDER_APP_API_ENABLED === "true".
app.use(providerAppRouter);

// --- Block non-health requests until routes are registered ---
app.use((req, res, next) => {
  if (req.path === '/health' || req.path === '/health/strict' || req.path.startsWith('/api/health')) {
    return next();
  }

  // Google Places autocomplete and details are user-facing on first page load.
  // Early-bypass the startup guard so address suggestions are never blocked by
  // a cold-start window — the handlers forward to google-services.ts once it
  // is registered; if the API key is missing they return 503 with a clear reason.
  if (
    req.path === '/api/google/places-autocomplete' ||
    req.path === '/api/google/places-details'
  ) {
    return next();
  }

  if (isProduction && !serverReady) {
    if (req.path === '/' || req.method === 'HEAD') {
      return res.status(200).send('<!DOCTYPE html><html><head><title>PetWash™</title></head><body><p>Starting up...</p></body></html>');
    }

    // Wallet pass routes: return a retryable HTML page instead of raw JSON.
    // Safari / iPhone would otherwise download the JSON as "google.json" and never open Wallet.
    const isWalletPath =
      (req.path.startsWith('/api/gift-cards/') && req.path.includes('/wallet/')) ||
      req.path.startsWith('/api/pass/') ||
      req.path.startsWith('/api/wallet/apple') ||
      req.path.startsWith('/api/wallet/google') ||
      req.path.startsWith('/api/prestige-pass/apple-wallet') ||
      req.path.startsWith('/api/prestige-pass/google-wallet');

    if (isWalletPath) {
      const retryUrl = htmlEncode(req.originalUrl);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Retry-After', '5');
      return res.status(503).send(`<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="refresh" content="5;url=${retryUrl}">
  <title>PetWash™ — טוען...</title>
  <style>
    body { font-family: -apple-system, sans-serif; background: #000; color: #C6A35B;
           text-align: center; padding: 60px 20px; }
    h1   { font-size: 1.5rem; margin-bottom: 12px; }
    p    { color: #fff; font-size: 0.95rem; line-height: 1.6; }
    small{ color: #666; font-size: 0.75rem; }
  </style>
</head>
<body>
  <h1>🐾 PetWash™</h1>
  <p>השרת מתחיל... הדף יתרענן אוטומטית בעוד <strong>5 שניות</strong>.</p>
  <p><small>Server starting up — retrying automatically in 5s…</small></p>
</body>
</html>`);
    }

    const traceId = (req as any).traceId || crypto.randomUUID();
    return res.status(503).json({
      error: 'SERVICE_STARTING',
      message: 'Server is starting up, please retry in a moment',
      retryAfter: 5,
      traceId
    });
  }
  
  next();
});
// ---------------------------------------

// 2. Initialise biometric storage once on startup (non-blocking, lazy import)
import("./infra/biometricStorage").then(({ ensureBiometricStorage }) => {
  ensureBiometricStorage()
    .then(() => console.log("[BiometricStorage] ready"))
    .catch((err) => console.error("[BiometricStorage] init failed", err));
}).catch((err) => console.error("[BiometricStorage] module load failed", err));

// 2b. Google Cloud legal compliance validation (non-blocking)
import("./compliance/google-cloud-dpa-registry").then(({ validateGCPCompliance }) => {
  validateGCPCompliance();
}).catch((err) => console.error("[GCP Compliance] registry load failed", err));

function attachGracefulShutdown(server: HttpServer): void {
  const shutdownHandler = (signal: string) => {
    console.warn(`[Graceful] ${signal} received — closing HTTP server`);
    server.close(() => {
      console.warn('[Graceful] HTTP server closed cleanly');
      process.exit(0);
    });
    setTimeout(() => {
      console.error('[Graceful] Forced exit after 10 s timeout');
      process.exit(1);
    }, 10_000).unref();
  };
  process.on('SIGTERM', () => shutdownHandler('SIGTERM'));
  process.on('SIGINT',  () => shutdownHandler('SIGINT'));
}

// --- Late-init diagnostic ---
if (isProduction) {
  _initPhase = 'late_init_diagnostics';
  setImmediate(() => {
    console.log('--------------------------------------------------');
    console.log(`🚀 [Server] Production initialization running before port bind...`);
    // PR-CONFIG-HEALTH: log the canonical env-var manifest snapshot.
    // Names only — never values. Surfaces missing required/recommended
    // vars in deploy logs so the next misconfiguration fails LOUD,
    // not silent.
    try {
      _logStartupConfigDiagnostic();
    } catch (e) {
      console.error('[Server] config-health diagnostic failed (non-fatal):', e);
    }
    if (_startupConfigErrors.length > 0) {
      console.error(`⚠️  [Server] ${_startupConfigErrors.length} startup config error(s) detected:`);
      _startupConfigErrors.forEach(e => console.error('   ' + e));
      console.error('   These errors are also visible in GET /health (check → configErrors).');
    }
    if (_startupSecurityViolations.length > 0) {
      console.error(`🚨 [Server] ${_startupSecurityViolations.length} SECURITY VIOLATION(S) detected at startup:`);
      _startupSecurityViolations.forEach(e => console.error('   ' + e));
      console.error('   These violations are visible in GET /health/strict (checks → securityViolations).');
      console.error('   GET /health/strict returns 503 DANGEROUS — CI deploy gate will block promotion.');
    }
    console.log('--------------------------------------------------');
  }); // end setImmediate
}

// 3. Static assets, API routes, and server startup
(async () => {
  try {
    // --- STATIC FILE SERVING FIX (2025) ---
    // CRITICAL: Mount express.static BEFORE API routes (per architect recommendation)
    // This ensures proper request handling order: static assets → API → SPA fallback
    
    // 1. Define the correct build output path (dist/public)
    // We use process.cwd() to safely resolve from the project root
    const DIST_PUBLIC_PATH = path.join(process.cwd(), 'dist', 'public');
    
    // CRITICAL FIX: Define indexPath at module scope so it's available in catchall route
    const indexPath = path.join(DIST_PUBLIC_PATH, "index.html");
    
    // 2. LOGGING: Verify the path on startup (as requested)
    console.log('--------------------------------------------------');
    console.log('📂 Static File Path Verification:');
    console.log(`   Target Directory: ${DIST_PUBLIC_PATH}`);
    console.log(`   Working Directory: ${process.cwd()}`);
    console.log(`   Node Environment: ${process.env.NODE_ENV || "development"}`);
    
    // 3. Verify build exists before starting server (PRODUCTION ONLY)
    // In development, Vite serves source files directly - no build needed
    if (process.env.NODE_ENV !== 'development') {
      const fs = await import("fs");
      
      if (!fs.existsSync(indexPath)) {
        console.error('--------------------------------------------------');
        console.error('❌ CRITICAL: index.html not found!');
        console.error(`   Expected path: ${indexPath}`);
        console.error(`   Current working directory: ${process.cwd()}`);
        console.error(`   __dirname: ${__dirname}`);
        
        // List what's actually in the directory
        try {
          const distExists = fs.existsSync(path.join(process.cwd(), "dist"));
          console.error(`   dist/ exists: ${distExists}`);
          if (distExists) {
            const distContents = fs.readdirSync(path.join(process.cwd(), "dist"));
            console.error(`   dist/ contents: ${distContents.join(", ")}`);
            
            const publicExists = fs.existsSync(DIST_PUBLIC_PATH);
            console.error(`   dist/public/ exists: ${publicExists}`);
            if (publicExists) {
              const publicContents = fs.readdirSync(DIST_PUBLIC_PATH);
              console.error(`   dist/public/ contents: ${publicContents.slice(0, 10).join(", ")}...`);
            }
          }
        } catch (e) {
          console.error(`   Could not list directory contents:`, e);
        }
        // Do not throw — crashing here kills the process and causes Cloud Run startup probe failure.
        // Run in degraded mode: API routes still work; only the SPA shell is unavailable.
        console.error('⚠️  [startup] Degraded mode: dist/public/index.html not found. API routes remain available. Run "npm run build" to restore full frontend serving.');
      } else {
        console.log(`   index.html found: ✅`);

        // Verify critical assets exist
        const logoPath = path.join(DIST_PUBLIC_PATH, "brand", "petwash-logo-official.png");
        const logoExists = fs.existsSync(logoPath);
        console.log(`   Logo exists: ${logoExists ? '✅' : '❌'} (${logoPath})`);

        if (!logoExists) {
          console.error('   WARNING: Logo not found - images may be broken in production!');
        }
      }
      console.log(`   ✅ Development mode - Vite will serve source files directly`);
    }
    
    console.log('--------------------------------------------------');
    
    // 4. Register all API routes FIRST (critical for dev mode)
    // MUST be BEFORE Vite middleware or production static files
    // NOTE: No artificial timeout here — Cloud Run's own startup timeout (600s, set via --timeout flag)
    // is the safety net. A 120s Promise.race was causing premature failure in production:
    // routes.ts is ~14 000 lines with many GCP service initialisations that legitimately take >120s
    // on a cold start. The race silently tripped the catch block, left routesReady=false and
    // serverReady=false, making every non-health route return 503 indefinitely.
    console.log('[Server] Loading routes module (dynamic import)...');
    startupPhase = 'loading_routes';
    _initPhase = 'loading_routes';
    const { registerRoutes } = await import("./routes");
    console.log('[Server] Routes module loaded, registering routes...');
    startupPhase = 'registering_routes';
    _initPhase = 'registering_routes';
    await registerRoutes(app);
    healthState.app.routesReady = true;
    _initPhase = 'ready';
    console.log(`[Startup] ✅ Routes registered. Total init time: ${((Date.now() - _initStartedTs) / 1000).toFixed(1)}s`);

    // Release-blocker B1 (CEO 2026-09-02): kick the system_config
    // hydrate + refresh loop so every pod picks up admin flag changes
    // within SYSTEM_CONFIG_REFRESH_MS (default 30s) and defaults are
    // no longer per-pod. Non-blocking — the first hydrate is
    // fire-and-forget so a slow DB never delays boot.
    try {
      const { systemConfig } = await import('./services/SystemConfig');
      systemConfig.startRefreshLoop();
    } catch (e: any) {
      console.warn('[Startup] SystemConfig refresh loop failed to start (non-blocking)', e?.message);
    }

    // Release-blocker A3+A4+A5 completion (CEO 2026-09-02):
    // fiscal_document_outbox drainer. runFiscalDocumentAndPersistOnFailure
    // persists a row on inline failure; this loop retries it with
    // exponential backoff until success or MAX_ATTEMPTS (→
    // failed_needs_review for ops intervention). Non-blocking on boot.
    try {
      const { pool } = await import('./db');
      const { startFiscalOutboxDrainer } = await import('./services/fiscalDocumentOutboxDrainer');
      const { default: VATCalculatorService } = await import('./services/VATCalculatorService');
      const { IsraeliDigitalReceiptService } = await import('./services/IsraeliDigitalReceiptService');
      const { bridgeLegacyBooking } = await import('./services/legacyBookingBridge');
      startFiscalOutboxDrainer(pool as any, {
        handlers: {
          vat_ledger: async (p: any) => {
            await VATCalculatorService.recordTransactionFromGross(
              p.source,
              p.bookingId,
              p.grossAmountIls,
              p.bookingId,
              p.metadata ?? {},
              p.settlement ?? undefined,
            );
          },
          academy_receipt: async (p: any) => {
            // The drainer retries with the ORIGINAL payload we stored;
            // the receipt service is idempotent by bookingId.
            await IsraeliDigitalReceiptService.generateReceipt(p);
          },
          walk_legacy_bridge: async (p: any) => {
            await bridgeLegacyBooking({
              ownerId: p.ownerId,
              providerUserId: p.providerUserId,
              providerProfileId: p.providerProfileId,
              providerType: p.providerType,
              serviceType: p.serviceType,
              startDate: new Date(p.startDateIso),
              endDate: new Date(p.endDateIso),
              petCount: p.petCount,
              subtotalCents: p.subtotalCents,
              serviceFeeCents: p.serviceFeeCents,
              totalCents: p.totalCents,
              providerPayoutCents: p.providerPayoutCents,
              ownerMessage: null,
              legacyRef: p.legacyRef,
              petDetails: p.petDetails,
            });
          },
          digital_receipt: async (p: any) => {
            await IsraeliDigitalReceiptService.generateReceipt(p);
          },
          // Post-release 2026-09-03 (backlog P1): SUMIT credit-note stamp
          // retry. Handler re-runs the local UPDATE that writes
          // sumitDocumentId back onto the digital_receipt row. Idempotent:
          // repeating the UPDATE with the same value is a no-op.
          sumit_credit_stamp: async (p: any) => {
            const { db } = await import('./db');
            const { digitalReceipts } = await import('@shared/schema');
            const { eq } = await import('drizzle-orm');
            await db.update(digitalReceipts)
              .set({ sumitDocumentId: p.sumitDocumentId, issuerOfRecord: 'sumit' })
              .where(eq(digitalReceipts.id, p.creditNoteId));
          },
        },
      });
    } catch (e: any) {
      console.warn('[Startup] FiscalOutboxDrainer failed to start (non-blocking)', e?.message);
    }

    // Log Firebase client config availability immediately after routes are ready.
    // This makes it trivial to verify in Cloud Run logs whether the browser will
    // receive a real Firebase API key or fall back to the placeholder, which is
    // the #1 reason Google sign-in and email/password auth silently fail in prod.
    const fbApiKey = process.env.FIREBASE_WEB_API_KEY || process.env.VITE_FIREBASE_API_KEY || '';
    if (fbApiKey) {
      console.log('✅ [Firebase] Client config injection ENABLED — browser will receive real API key');
      console.log(`   authDomain: ${process.env.FIREBASE_AUTH_DOMAIN || 'petwash.co.il'} | projectId: ${process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || 'signinpetwash'}`);
    } else {
      console.error('🚨 [Firebase] NEITHER FIREBASE_WEB_API_KEY NOR VITE_FIREBASE_API_KEY is set in this environment.');
      console.error('   window.__FIREBASE_CONFIG__ will NOT be injected into the SPA HTML.');
      console.error('   The browser will fall back to build-time VITE_ vars (usually empty in Cloud Run).');
      console.error('   Result: all Firebase auth (Google, email/password, phone) will fail with auth/invalid-credential or similar.');
      console.error('   Fix: add FIREBASE_WEB_API_KEY to Cloud Run environment variables / GCP Secret Manager.');
    }

    // CRITICAL: Unblock API requests as soon as routes are registered.
    // Everything below (static files, cron jobs, notification handlers) is background
    // work and must NOT delay serverReady — they were already labelled non-blocking
    // but the awaited imports below were still holding serverReady=false for 100+ s
    // on a Cloud Run cold start, causing the smoke test to time out.
    if (isProduction) {
      serverReady = true;
      startupPhase = 'ready';
      console.log('✅ [Server] Routes ready — startup guard lifted (background init continues)');
    }

    // Non-blocking: start notification retry sweeper (runs every 2 minutes).
    setImmediate(() => {
      import('./services/NotificationRetryService').then(({ NotificationRetryService }) => {
        NotificationRetryService.startSweeper();
      }).catch(err => console.warn('[RetryService] Failed to start sweeper', err));
    });

    // Non-blocking: start KYC deletion job — deletes biometric files after review (every 15 minutes).
    setImmediate(() => {
      import('./jobs/kycDeletionJob').then(({ startKycDeletionJob }) => {
        startKycDeletionJob();
      }).catch(err => console.warn('[KycDeletionJob] Failed to start:', err));
    });

    // Non-blocking: backfill trust metrics for all providers missing or stale data.
    // Runs once per cold start — safe to re-run (idempotent).
    setImmediate(() => {
      import('./utils/providerTrustMetrics').then(({ backfillAllProviderTrustMetrics }) => {
        backfillAllProviderTrustMetrics().catch(err =>
          console.warn('[TrustBackfill] Startup backfill failed', err)
        );
      });
    });

    // Non-blocking: backfill ranking scores for all providers (runs after trust, 500ms delay).
    setTimeout(() => {
      import('./utils/providerRanking').then(({ backfillAllProviderRankingScores }) => {
        backfillAllProviderRankingScores().catch(err =>
          console.warn('[RankingBackfill] Startup backfill failed', err)
        );
      });
    }, 500);

    // Non-blocking: K9000 cleanup recovery.
    // If the server restarted while a bay was in "cleanup" status, the 30-second
    // setTimeout that was scheduled in enterCleanupPhase() is gone. This scan
    // either finalizes expired cleanup sessions immediately or reschedules the
    // remaining timer, preventing bays from being stuck in "cleanup" after a restart.
    setImmediate(() => {
      import('./services/K9000RedemptionService').then(({ registerCleanupRecovery }) => {
        registerCleanupRecovery().catch((err: Error) =>
          console.warn('[K9000CleanupRecovery] Startup scan failed', err.message)
        );
      }).catch((err: Error) =>
        console.warn('[K9000CleanupRecovery] Failed to import service', err.message)
      );
    });

    // Non-blocking: start machine command timeout scanner — checks every 15 s
    // for commands that have been sent but not ACKed within their deadline.
    // Retries safe commands up to maxRetries times, then marks failed and
    // triggers compensation if the command was a START_PUMP after a payment.
    setImmediate(() => {
      import('./services/MachineCommandService').then(({ startCommandTimeoutScanner }) => {
        startCommandTimeoutScanner();
      }).catch((err: Error) =>
        console.warn('[MachineCommandScanner] Failed to start', err.message)
      );
    });

    // 5. Serve static files - CONDITIONAL based on environment
    // DEVELOPMENT: Use Vite dev server with HMR for hot reloading
    // PRODUCTION: Serve pre-built static files from dist/public
    if (process.env.NODE_ENV === 'development') {
      console.log('🔧 [Dev Mode] Initializing Vite dev server with HMR...');
      const { setupVite } = await import('./vite');
      const server = app.listen(PORT, '0.0.0.0', () => {
        __petwashBootComplete = true; // boot done — recoverable errors now recover, not crash
        console.log(`--------------------------------------------------`);
        console.log(`✅ [Server] listening on port ${PORT} in development mode`);
        console.log(`📁 [Server] Using Vite dev server (source files with HMR)`);
        console.log(`🏥 [Server] Health check: http://0.0.0.0:${PORT}/`);
        // PR-CONFIG-HEALTH: dev-mode env-var manifest log too, names only.
        try {
          _logStartupConfigDiagnostic();
        } catch (e) {
          console.error('[Server] config-health diagnostic failed (non-fatal):', e);
        }
        console.log(`--------------------------------------------------`);
      });
      await setupVite(app, server);
      console.log('✅ [Vite] Dev server initialized - source files will hot-reload');

      // Wire provider matching WebSocket on the same port
      import('./routes/matching-ws').then(({ setupMatchingWebSocket }) => {
        setupMatchingWebSocket(server);
      }).catch((e) => console.error('[MatchingWS] Setup failed', e));

      serverReady = true;
      healthState.app.routesReady = true;
      connectDbNonBlocking().catch(() => {});
      
      import('./services/googleSheetsIntegration').then(m => m.processStartupRetries()).catch((e) => logger.error('[GoogleSheets] startup retries failed to init (non-fatal)', e));
      import('./services/JobDispatchService').then(m => m.JobDispatchService.startDispatchPoller()).catch((e) => logger.error('[JobDispatch] dispatch poller FAILED to start — jobs will NOT dispatch', e));

      // Notification event handlers
      try {
        const { registerNotificationEventHandlers } = await import('./services/events/NotificationEventHandlers');
        registerNotificationEventHandlers();
      } catch (e: any) {
        console.error('[Notifications] Failed to register handlers (non-fatal):', e.message);
      }

      // Cron jobs (dev mode — runs same as production)
      try {
        console.log('[Cron] Initializing automated jobs...');
        // FREE self-monitoring: watch DB health, alert (email/Slack) on outage.
        // Would have caught the 2026-06-17 DB DEGRADED incident. No paid vendor.
        const { startHealthWatchdogCron } = await import('./cron/health-watchdog');
        startHealthWatchdogCron();
        const { startMonthlySettlementsCron } = await import('./cron/monthly-settlements');
        startMonthlySettlementsCron();
        const { startWinbackCron } = await import('./cron/winback');
        startWinbackCron();
        const { startRecoveryAutomationCron } = await import('./cron/recovery-automation');
        startRecoveryAutomationCron();
        const { startAutoApproveCompletionsCron } = await import('./cron/auto-approve-completions');
        startAutoApproveCompletionsCron();
        // PR-3 P0-1: Boot auto-void cron. Without this, card holds for
        // payments stuck in 'authorised' state are never released — customers
        // see phantom charges for 15+ minutes when an operator doesn't respond.
        const { startAutoVoidCron } = await import('./cron/auto-void-expired-payments');
        startAutoVoidCron();
        // PR-5: Boot station heartbeat monitor. Scans kiosk_machines every
        // 2 minutes and inserts an 'offline' station_alert when a kiosk
        // stops sending heartbeats for >15 minutes. Read-only on
        // kiosk_machines; bridges to pet_wash_stations via nayax_terminal_id.
        const { startHeartbeatMonitorCron } = await import('./cron/station-heartbeat-monitor');
        startHeartbeatMonitorCron();
        console.log('[Cron] All cron jobs initialized successfully');
      } catch (e: any) {
        console.error('[Cron] Failed to initialize cron jobs (non-fatal):', e.message);
      }

      // Skip the rest of initialization in development mode
      // (Vite handles serving index.html and static assets)
      return;
    } else {
      console.log('📦 [Production Mode] Serving pre-built static files from dist/public');
      // Serve static files from the DIST directory with explicit configuration
      // MOUNTED AFTER API ROUTES for proper request handling order
      app.use(express.static(DIST_PUBLIC_PATH, {
        // INDEX-HTML-NO-CACHE (CEO 2026-08-23):
        // Previously this served EVERY file — including index.html —
        // with `Cache-Control: max-age=86400` (1 day). That broke
        // deploys: a browser that fetched index.html an hour ago
        // still had it cached pointing at the OLD Vite asset hashes
        // (index-CSjpXYZ.js). After a new deploy renamed those to
        // index-DIFFERENT.js, the browser fetched the OLD names →
        // 404 → white-screen or "cannot load assets" error the CEO
        // reported. Standard Vite/SPA hosting pattern:
        //
        //   • index.html         → no-store   (always fetch fresh)
        //   • assets/*.js|css    → immutable  (hashed, safe to
        //                          cache forever — the hash IS the
        //                          cache-buster)
        //   • other statics      → 1 day     (photos, favicons)
        //
        // maxAge remains the default 1-day; setHeaders overrides it
        // per-file below so the shortest-lived resource (index.html)
        // is never stuck stale.
        maxAge: '1d',
        etag: true,
        lastModified: true,
        index: false, // Don't serve index.html for directory requests - let SPA handle routing
        setHeaders: (res, filePath) => {
          // index.html — never cache. This is the CRITICAL rule that
          // makes SPA deploys safe: the SHELL is always fresh, and
          // it always points at the current-deploy asset hashes.
          if (filePath.endsWith('/index.html') || filePath.endsWith('\\index.html')) {
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
            return;
          }
          // Hashed Vite assets under /assets/ — safe to cache forever.
          // Vite content-hashes every file (index-abc123.js); the hash
          // changes on any content change, so the URL itself is the
          // cache-buster. `immutable` tells the browser it never
          // needs to revalidate.
          if (filePath.includes('/assets/') || filePath.includes('\\assets\\')) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          }
          // MIME hints for common image types (unchanged from before).
          if (filePath.endsWith('.png')) {
            res.setHeader('Content-Type', 'image/png');
          } else if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
            res.setHeader('Content-Type', 'image/jpeg');
          } else if (filePath.endsWith('.svg')) {
            res.setHeader('Content-Type', 'image/svg+xml');
          }
        }
      }));
    }
    
    // 5a. Initialize notification event handlers (AFTER routes) - NON-BLOCKING
    try {
      console.log('[Notifications] Registering event handlers...');
      const { registerNotificationEventHandlers } = await import('./services/events/NotificationEventHandlers');
      registerNotificationEventHandlers();
      console.log('[Notifications] Event handlers registered successfully');
    } catch (error) {
      console.error('[Notifications] Failed to register handlers (non-fatal):', error);
    }
    
    // 5b. Initialize automated cron jobs (AFTER routes, BEFORE error handlers) - NON-BLOCKING
    try {
      console.log('[Cron] Initializing automated jobs...');
      const { startMonthlySettlementsCron } = await import("./cron/monthly-settlements");
      startMonthlySettlementsCron();
      const { startWinbackCron } = await import("./cron/winback");
      startWinbackCron();
      const { startRecoveryAutomationCron } = await import("./cron/recovery-automation");
      startRecoveryAutomationCron();
      const { startAutoApproveCompletionsCron } = await import("./cron/auto-approve-completions");
      startAutoApproveCompletionsCron();
      // PR-3 P0-1: Boot auto-void cron. Without this, card holds for
      // payments stuck in 'authorised' state are never released — customers
      // see phantom charges for 15+ minutes when an operator doesn't respond.
      const { startAutoVoidCron } = await import("./cron/auto-void-expired-payments");
      startAutoVoidCron();
      // PR-5: Boot station heartbeat monitor. Inserts 'offline' alerts when
      // a K9000 kiosk stops sending heartbeats for >15 minutes.
      const { startHeartbeatMonitorCron } = await import("./cron/station-heartbeat-monitor");
      startHeartbeatMonitorCron();
      // Lane C.2 (post-release 2026-09-03) — Journey Brain Phase 2:
      // hourly sweep of expired journey_checkpoints rows so abandoned
      // wizard state never accumulates on disk indefinitely.
      const { startJourneyCheckpointsPrunerCron } = await import("./cron/journey-checkpoints-prune");
      startJourneyCheckpointsPrunerCron();
      // Journey Brain Phase 6 (post-release 2026-09-04):
      // hourly sweep of next_best_action_feedback rows older than
      // 90 days. Composer suppression only ever looks back 7 days,
      // so old feedback is dead weight in the primary table.
      const { startNextBestActionFeedbackPrunerCron } = await import("./cron/next-best-action-feedback-prune");
      startNextBestActionFeedbackPrunerCron();
      console.log('[Cron] All cron jobs initialized successfully');
    } catch (error) {
      console.error('[Cron] Failed to initialize cron jobs (non-fatal):', error);
    }
    
    // F3 (2026-08-06 hidden-failure hunt): these six were started with a SILENT
    // catch(()=>{}) — unlike the logged ones just below. If any failed to boot (bad
    // import, top-level init throw), the poller never ran with ZERO trace: escrow
    // never auto-releases (customer money stuck on hold), expired bookings never
    // clean up, and jobs never dispatch to operators (charged-not-delivered). Now
    // each logs on startup failure so a dead poller is visible (and via logger→Sentry).
    import('./services/googleSheetsIntegration').then(m => m.processStartupRetries()).catch((e) => logger.error('[GoogleSheets] startup retries failed to init (non-fatal)', e));
    import('./services/JobDispatchService').then(m => m.JobDispatchService.startDispatchPoller()).catch((e) => logger.error('[JobDispatch] dispatch poller FAILED to start — jobs will NOT dispatch', e));
    import('./services/JobExpiryNotificationService').then(m => m.jobExpiryNotificationService.start()).catch((e) => logger.error('[JobExpiry] notification service failed to start', e));
    import('./jobs/booking-expiry').then(m => m.startBookingExpiryPoller()).catch((e) => logger.error('[BookingExpiry] poller FAILED to start — escrow auto-release/slot cleanup will NOT run', e));
    import('./jobs/booking-accept-timeout').then(m => m.startAcceptTimeoutPoller()).catch((e) => logger.error('[AcceptTimeout] poller failed to start', e));
    import('./jobs/rebook-scheduler').then(m => m.startRebookScheduler()).catch((e) => logger.error('[Rebook] scheduler failed to start', e));
    import('./services/providerMonitoring').then(m => m.startProviderMonitoringWatchdog()).catch((e) => console.error('[ProviderWatchdog] Failed to initialize:', e));
    import('./jobs/exception-email').then(m => m.startExceptionEmailJob()).catch((e) => console.error('[ExceptionEmail] Failed to initialize:', e));
    import('./jobs/daily-close-reminder').then(m => m.startDailyCloseReminder()).catch((e) => console.error('[DailyCloseReminder] Failed to initialize:', e));

    // BackgroundJobProcessor — the ~19 cron jobs in backgroundJobs.ts (daily Firestore
    // backup, hourly Alerts-Center sweep, monthly financial reconciliation, weekly
    // data-integrity check, birthday processing, etc.) were defined inside static
    // start() but start() was NEVER called — the whole scheduler was dead, so none of
    // these ran in production. Wire it here at boot like the other schedulers.
    // (Two paid-AI sub-jobs DO live in this class but self-gate behind AI_CRONS_ENABLED
    //  internally, so starting the scheduler does NOT trigger any paid AI unless that flag is set.)
    import('./backgroundJobs').then(m => m.BackgroundJobProcessor.start()).catch((e) => console.error('[BackgroundJobs] Failed to start scheduler:', e));

    // Email Spend Guard — wire alarm callback so budget alerts reach nir.h@petwash.co.il
    import('./services/EmailSpendGuard').then(async ({ emailSpendGuard }) => {
      const { sendSecurityAlert } = await import('./services/alerts');
      emailSpendGuard.setAlarmCallback(sendSecurityAlert);
      console.log('[EmailSpendGuard] ✅ Active — hourly/daily budget alarms wired');
    }).catch(e => console.error('[EmailSpendGuard] Failed to initialize:', e));

    // Gemini Platform Security Monitor — scans all platforms every 15 min.
    // DISABLED by default 2026-06-12 to stop silent paid-AI spend after an
    // unexpected Google bill. Re-enable intentionally with AI_CRONS_ENABLED=true.
    if (process.env.AI_CRONS_ENABLED === 'true') {
      import('./services/GeminiPlatformSecurityMonitor').then(({ geminiPlatformMonitor }) => {
        geminiPlatformMonitor.start();
      }).catch(e => console.error('[PlatformMonitor] Failed to start:', e));
    } else {
      console.warn('[AI Crons] Gemini Platform Security Monitor DISABLED (set AI_CRONS_ENABLED=true to re-enable) — no paid AI calls');
    }

    // Gemini Spam Guard — AI spam detection + HQ reporting every 30 min.
    // DISABLED by default 2026-06-12 (paid AI spend). Re-enable with AI_CRONS_ENABLED=true.
    if (process.env.AI_CRONS_ENABLED === 'true') {
      import('./services/GeminiSpamGuard').then(({ geminiSpamGuard }) => {
        geminiSpamGuard.startScheduler();
      }).catch(e => console.error('[SpamGuard] Failed to start scheduler:', e));
    } else {
      console.warn('[AI Crons] Gemini Spam Guard DISABLED (set AI_CRONS_ENABLED=true to re-enable) — no paid AI calls');
    }
    
    // 5c. Initialize Israeli CPI data - TRULY NON-BLOCKING (fire-and-forget)
    // CRITICAL: Do NOT await - these can be slow and should not delay serverReady
    (async () => {
      try {
        console.log('[CPI] Initializing Israeli Consumer Price Index data (background)...');
        const IsraeliCPIService = (await import('./services/IsraeliCPIService')).default;
        const isCurrent = await IsraeliCPIService.isCPIDataCurrent();
        if (!isCurrent) {
          console.log('[CPI] No CPI data found - seeding initial data...');
          await IsraeliCPIService.seedInitialData();
        } else {
          const latest = await IsraeliCPIService.getLatestCPI();
          console.log(`[CPI] ✅ CPI data current - Latest: ${latest?.month} = ${latest?.indexValue}`);
        }
      } catch (error) {
        console.error('[CPI] Failed to initialize CPI data (non-fatal):', error);
      }
    })();
    
    // 5d. Initialize Control Panel Registry - TRULY NON-BLOCKING (fire-and-forget)
    // CRITICAL: Do NOT await - database seeding should not delay serverReady
    (async () => {
      try {
        console.log('[Control Panel] Initializing registry data (background)...');
        const { initializeControlPanelRegistry } = await import('./services/ControlPanelRegistry');
        await initializeControlPanelRegistry();
        console.log('[Control Panel] ✅ Registry initialized successfully');
      } catch (error) {
        console.error('[Control Panel] Failed to initialize registry (non-fatal):', error);
      }
    })();
    
    // NOTE: The canonical error handler is registered inside registerRoutes() at the end
    // of server/routes.ts. It uses structured logger.error with full traceId/stack context.
    // A duplicate handler was previously registered here (index.ts) but was unreachable:
    // registerRoutes() is fully awaited above, so routes.ts handler always fires first.
    // Removed 2026-03 to eliminate the dead code. See server/routes.ts for the live handler.

    // 7. SPA Catchall Route - Serve index.html for ALL non-API routes (UNIVERSAL - works in dev AND production)
    // CRITICAL FIX 2025: Removed production-only check - now works in ALL environments
    app.get("*", (req, res, next) => {
      // CRITICAL FIX: Exclude ONLY actual static asset directories (not SPA routes like /gallery)
      // This prevents images/assets from being served as HTML
      const staticAssetPaths = [
        '/api/',           // API endpoints
        '/assets/',        // Vite build assets (JS/CSS bundles)
        '/brand/',         // Brand assets (logos)
        '/payments/',      // Payment-related images
        '/icons/',         // Icon files
        '/docs/',          // Documentation files
        '/reports/',       // Report files  
        '/documents/',     // Document files
        '/.well-known/'    // Well-known URIs
        // NOTE: /gallery/ removed - it's a SPA route, not a static asset directory
      ];
      
      // Also exclude requests for files with static asset extensions
      const staticExtensions = ['.png', '.jpg', '.jpeg', '.svg', '.ico', '.webp', '.gif', '.pdf', '.json', '.xml', '.txt', '.woff', '.woff2', '.ttf', '.eot', '.js', '.css'];
      const hasStaticExtension = staticExtensions.some(ext => req.path.toLowerCase().endsWith(ext));
      
      if (staticAssetPaths.some(path => req.path.startsWith(path)) || hasStaticExtension) {
        // Let the request fall through - if express.static didn't handle it, return 404
        return res.status(404).send('File not found');
      }
      
      // Serve index.html for all other routes (SPA routing - includes /gallery, /about, /contact, etc.)
      // In production, inject Firebase client config so auth works even when the build
      // was compiled without VITE_ environment variables.
      if (isProduction) {
        try {
          const rawHtml = fs.readFileSync(indexPath, 'utf8');

          // PR-SEO-PER-ROUTE-METADATA (2026-08-15) — items 23 + 24 + 25.
          // The SPA catchall used to serve the SAME homepage <title>/description
          // for /privacy, /terms, /walk-my-pet/explore. Crawlers that don't
          // execute JS (or that snapshot before hydration) indexed the homepage
          // wording on the wrong URL. Inject route-specific <title> / meta
          // description / og:title / og:description / canonical + a summary
          // paragraph inside the initial <div id="root"> so the page is
          // meaningful even before React hydrates. React overwrites the root
          // on mount, so this fallback only appears to non-JS clients.
          type RouteMeta = { title: string; description: string; summary: string };
          const ROUTE_META: Record<string, RouteMeta> = {
            '/privacy': {
              title: 'Privacy Policy | PetWash™',
              description: 'PetWash™ privacy policy — what data we collect, how we use it, and the rights you have under Israeli privacy law and GDPR. Contact support@petwash.co.il.',
              summary: 'Privacy Policy — This page explains what personal data PetWash™ collects, how it is used, who it is shared with, how long it is kept, and the rights you have to access, correct, delete, or restrict it. It is written to comply with Israeli privacy law and the EU GDPR. Full text loads with the app; if JavaScript is disabled, contact support@petwash.co.il for a printable copy.',
            },
            '/terms': {
              title: 'Terms of Service | PetWash™',
              description: 'PetWash™ terms of service — the agreement between you and PetWash Ltd covering account use, bookings, payments, refunds, and dispute resolution.',
              summary: 'Terms of Service — This page contains the binding agreement between you and PetWash Ltd covering account registration, service bookings, payments, refunds, cancellations, provider conduct, and dispute resolution. Full text loads with the app; if JavaScript is disabled, contact support@petwash.co.il for a printable copy.',
            },
            '/walk-my-pet/explore': {
              title: 'Walk My Pet™ — Book a Dog Walker in Israel | PetWash™',
              description: 'Browse Walk My Pet™ dog walkers across Israel. Real-time GPS tracking, verified providers, split payments. Hebrew and English.',
              summary: 'Walk My Pet™ — Browse verified dog walkers across Israel. Every walk includes real-time GPS tracking, before/after photos, and a split-payment engine that pays the walker on completion. Bookings, walker profiles, and reviews load with the app.',
            },
          };
          const routeMeta = ROUTE_META[req.path];

          const projectId =
            process.env.FIREBASE_PROJECT_ID ||
            process.env.VITE_FIREBASE_PROJECT_ID ||
            'signinpetwash';
          // Accept either env var name so the config is injected regardless of
          // which variable was configured in the deployment environment.
          const apiKey = process.env.FIREBASE_WEB_API_KEY || process.env.VITE_FIREBASE_API_KEY || '';
          if (apiKey) {
            const firebaseConfig = {
              apiKey,
              authDomain: 'petwash.co.il',
              projectId,
              storageBucket:
                process.env.FIREBASE_STORAGE_BUCKET ||
                process.env.VITE_FIREBASE_STORAGE_BUCKET ||
                `${projectId}.firebasestorage.app`,
              messagingSenderId:
                process.env.FIREBASE_MESSAGING_SENDER_ID ||
                process.env.VITE_FIREBASE_MESSAGING_SENDER_ID ||
                '',
              appId:
                process.env.FIREBASE_APP_ID ||
                process.env.VITE_FIREBASE_APP_ID ||
                '',
              measurementId:
                process.env.FIREBASE_MEASUREMENT_ID ||
                process.env.VITE_FIREBASE_MEASUREMENT_ID ||
                '',
            };
            let injected = rawHtml.replace(
              '</head>',
              `<script>window.__FIREBASE_CONFIG__=${JSON.stringify(firebaseConfig)};</script></head>`,
            );
            // PR-SEO-PER-ROUTE-METADATA: swap title / description / og:*
            // / canonical for known content routes, plus seed the root with a
            // summary paragraph for non-JS crawlers. React clobbers root on
            // hydrate, so this is a strict SEO / fallback improvement.
            if (routeMeta) {
              const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
              const canonicalUrl = `https://petwash.co.il${req.path}`;
              injected = injected
                .replace(/<title>[\s\S]*?<\/title>/i, `<title>${esc(routeMeta.title)}</title>`)
                .replace(/<meta name="description" content="[^"]*">/i, `<meta name="description" content="${esc(routeMeta.description)}">`)
                .replace(/<meta property="og:title" content="[^"]*">/i, `<meta property="og:title" content="${esc(routeMeta.title)}">`)
                .replace(/<meta property="og:description" content="[^"]*">/i, `<meta property="og:description" content="${esc(routeMeta.description)}">`)
                .replace(/<meta property="og:url" content="[^"]*">/i, `<meta property="og:url" content="${esc(canonicalUrl)}">`)
                .replace(/<link rel="canonical" href="[^"]*">/i, `<link rel="canonical" href="${esc(canonicalUrl)}">`)
                .replace(
                  '<div id="root"></div>',
                  `<div id="root"><main style="max-width:720px;margin:40px auto;padding:0 20px;font-family:system-ui,sans-serif;line-height:1.6"><h1>${esc(routeMeta.title.split(' | ')[0])}</h1><p>${esc(routeMeta.summary)}</p></main></div>`,
                );
            }
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
            return res.send(injected);
          }
        } catch (injectErr) {
          console.error('[SPA] Firebase config injection failed, falling back to sendFile:', injectErr);
        }
      }
      // INDEX-HTML-NO-CACHE (CEO 2026-08-23): matching the direct-static
      // rule above — index.html served through the SPA fallback must ALSO
      // be no-store, otherwise a browser that fell through to sendFile
      // (Firebase-config injection failed → catch block above → this
      // fallback) still caches for 1 day and points at old asset hashes
      // after the next deploy.
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.sendFile(indexPath, (err) => {
        if (err) {
          console.error('❌ CRITICAL: Could not serve index.html from:', indexPath);
          console.error('   Error details:', err);
          res.status(500).send('Server Error: Static files missing. Did you run "npm run build"?');
        }
      });
    });
    
    // Bind production port only after API routes, static assets, and SPA
    // fallback are registered. This keeps Cloud Run from promoting an instance
    // that can answer health checks while real API routes are still unavailable.
    if (isProduction && !(app as any)._server) {
      const server = app.listen(PORT, '0.0.0.0', () => {
        __petwashBootComplete = true; // boot done — recoverable errors now recover, not crash
        console.log('--------------------------------------------------');
        console.log(`✅ [Server] listening on port ${PORT} in production mode`);
        console.log('✅ [Server] Routes/static/catchall are registered before traffic');
        try {
          _logStartupConfigDiagnostic();
        } catch (e) {
          console.error('[Server] config-health diagnostic failed (non-fatal):', e);
        }
        console.log('--------------------------------------------------');
      });
      (app as any)._server = server;
      attachGracefulShutdown(server);
    }

    // Wire provider matching WebSocket (production path)
    if (isProduction) {
      const httpServer = (app as any)._server;
      if (httpServer) {
        import('./routes/matching-ws').then(({ setupMatchingWebSocket }) => {
          setupMatchingWebSocket(httpServer);
        }).catch((e) => console.error('[MatchingWS] Setup failed', e));
      }
    }

    // Wire GENERAL WebSocket (booking chat / walk tracking / station telemetry
    // / admin alerts). setupWebSocket() has been in server/websocket.ts for
    // months but was never actually called on boot — every broadcastBookingChatMessage,
    // broadcastReaction, broadcastBookingChatRead, broadcastTelemetryUpdate,
    // broadcastAlert iterated an empty clients Map and silently no-op'd.
    // Real-time chat, walk-tracking, station telemetry, admin alerts were all
    // dead client-side even though the server "sent" them. (2026-08-21 hunt.)
    // Runs in BOTH dev and prod — chat should work locally too.
    const generalHttpServer = (app as any)._server;
    if (generalHttpServer) {
      import('./websocket').then(({ setupWebSocket }) => {
        setupWebSocket(generalHttpServer);
        console.log('✅ [Server] General WebSocket wired (booking-chat / walk / telemetry / alerts)');
      }).catch((e) => console.error('[WebSocket] Setup failed', e));
    }

    serverReady = true;
    healthState.app.routesReady = true;
    connectDbNonBlocking().catch(() => {});
    
    console.log('--------------------------------------------------');
    console.log(`✅ [Server] Initialization complete - ${process.env.NODE_ENV || 'development'} mode`);
    console.log(`🏥 [Server] Health endpoint: /health`);
    console.log(`🏥 [Server] API Health endpoint: /api/health`);
    console.log('--------------------------------------------------');
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    const errStack = error instanceof Error ? error.stack : undefined;
    // Surface the failure phase + error on the /health endpoint so the next
    // failed deploy shows what actually broke instead of a silent timeout.
    _initError = `${_initPhase}: ${errMsg}`;
    console.error('--------------------------------------------------');
    console.error("❌ [FATAL] Server startup failed:", errMsg);
    console.error(`   Phase at failure: ${_initPhase}`);
    if (errStack) console.error("   Stack:", errStack);
    console.error('--------------------------------------------------');
    // Surface the failure in /api/health so it is visible without needing Cloud Run logs
    (healthState.app as any).startupError = errMsg;
    (healthState.app as any).startupErrorAt = new Date().toISOString();
    if (isProduction) {
      console.error('⚠️ [Production] Keeping server alive for health checks — routesReady=false, all API routes may return 503');
      serverReady = false;
      // PR-HEALTH-READY-2: capture failure phase + error kind for sanitized
      // diagnostic exposure on /api/health. NO message, NO stack, NO code.
      if (startupPhase === 'loading_routes' || startupPhase === 'registering_routes') {
        failedAtPhase = startupPhase;
      }
      errorKind = (error instanceof Error && error.constructor && typeof error.constructor.name === 'string')
        ? error.constructor.name
        : 'Unknown';
      startupPhase = 'failed';
    } else {
      process.exit(1);
    }
  }
})();

// --- UNCAUGHT EXCEPTION HANDLERS (Last Resort Safety Net) ---

// 2. Uncaught Exception Catcher (Prevents total server crash)
process.on('uncaughtException', (err) => {
  console.error('--------------------------------------------------');
  console.error('❌ FATAL: Uncaught Exception:', err);
  console.error('   Stack:', err.stack);
  console.error('--------------------------------------------------');
  // Stamp to system_events — best-effort, fire-and-forget
  try {
    _SystemEventService.stamp({
      eventType: 'process_uncaught_exception',
      severity: 'critical',
      source: 'process',
      message: err?.message?.slice(0, 300) ?? String(err),
      detail: { stack: err?.stack?.slice(0, 800) },
    });
  } catch (_) { /* swallow — DB might be gone */ }
  // Keep the process alive (don't exit - let it recover)
  // In production, you might want to restart gracefully here
});

// 3. Unhandled Promise Rejection Catcher
process.on('unhandledRejection', (reason, promise) => {
  console.error('--------------------------------------------------');
  console.error('❌ FATAL: Unhandled Rejection at:', promise);
  console.error('   Reason:', reason);
  console.error('--------------------------------------------------');
  // Stamp to system_events — best-effort, fire-and-forget
  try {
    const msg = reason instanceof Error ? reason.message : String(reason);
    _SystemEventService.stamp({
      eventType: 'process_unhandled_rejection',
      severity: 'error',
      source: 'process',
      message: msg?.slice(0, 300),
      detail: { reason: msg?.slice(0, 800) },
    });
  } catch (_) { /* swallow */ }
  // Keep the process alive (don't exit - let it recover)
});
