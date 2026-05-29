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
      // Must start with "SG." — the only format accepted by the SendGrid SDK.
      key: 'SENDGRID_API_KEY',
      pattern: /^SG\.[A-Za-z0-9_-]{20,}$/,
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

// ── Tranzila webhook bypass guard ─────────────────────────────────────────────
// TRANZILA_WEBHOOK_BYPASS_SIGNATURE=true is allowed ONLY in isolated local dev.
// If it is set in production or staging the server MUST refuse to start.
// This prevents an operator from accidentally deploying with signature verification
// disabled, turning the webhook endpoint into an unauthenticated write path.
(function assertNoTranzilaBypassInProdOrStaging() {
  const env = (process.env.NODE_ENV || '').toLowerCase();
  const bypassSet = process.env.TRANZILA_WEBHOOK_BYPASS_SIGNATURE === 'true';
  if (bypassSet && (env === 'production' || env === 'staging')) {
    const msg =
      '\n🚨 [startup] FATAL: TRANZILA_WEBHOOK_BYPASS_SIGNATURE=true is set in ' +
      env.toUpperCase() + '.\n' +
      '   This disables HMAC signature verification on all Tranzila webhooks.\n' +
      '   Any caller can forge webhook events and manipulate payment state.\n' +
      '   Remove TRANZILA_WEBHOOK_BYPASS_SIGNATURE from your ' + env + ' environment\n' +
      '   and restart the server.\n';
    console.error(msg);
    // Recorded in _startupSecurityViolations: an active bypass of payment signature
    // verification in production is an immediate security danger, not just a missing feature.
    // /health/strict returns 503 for security violations, so CI smoke test blocks promotion.
    _startupSecurityViolations.push(
      'TRANZILA_WEBHOOK_BYPASS_SIGNATURE=true is forbidden in ' + env,
    );
  }
})();

import { validateProductionPaymentSecrets as _validatePaymentSecrets } from './lib/payment-provider-mode';

// ── Payment provider mode + production secret validation ────────────────────
// PR-CI-PAYMENT-MODE: refuse to operate live in production when an enabled
// payment provider (Nayax, SUMIT/UPay) lacks its required secrets. Mock mode
// (PAYMENT_PROVIDER_MODE=mock) short-circuits all secret requirements so CI
// smoke and unit tests boot without real vendor credentials. Stripe and
// Tranzila are deprecated; their env vars trigger a deprecation warning
// here but do NOT crash the boot — Tranzila code paths are flag-gated OFF
// in payment-flags.ts and Stripe is no longer wired. See
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
const _earlyHealthHandler = (_req: any, res: any) => {
  res.status(200).json({
    status: _initPhase === 'ready' ? 'ok' : _initError ? 'degraded' : 'starting',
    phase: _initPhase,
    elapsedMs: Date.now() - _initStartedTs,
    error: _initError,
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

// C. CORS — strict allowlist with credential safety (CWE-942)
// Access-Control-Allow-Credentials is ONLY set when the request origin exactly
// matches an entry in the static CORS_EXACT_ORIGINS list.  This is enforced by
// the `cors` npm package, which CodeQL recognises as a safe CORS implementation.
// For regex-matched subdomains and dev/preview origins we serve a non-credentialed
// response with a literal '*' wildcard — no user-controlled value is ever reflected
// into a response header, eliminating the taint path CodeQL tracks (CWE-942).
const CORS_EXACT_ORIGINS: string[] = [
  'https://petwash.co.il',
  'https://www.petwash.co.il',
  ...(process.env.BASE_URL ? [process.env.BASE_URL] : ['http://localhost:5000']),
];
const CORS_DEV_PATTERNS: RegExp[] = [
  /\.run\.app$/,
  /\.replit\.dev$/,
  /\.repl\.co$/,
  /\.replit\.app$/,
];
const PETWASH_SUBDOMAIN_RE = /^https:\/\/([a-z0-9-]+\.)?petwash\.co\.il$/;

const _CORS_METHODS  = 'GET, POST, PUT, PATCH, DELETE, OPTIONS';
const _CORS_HEADERS  = 'Content-Type, Authorization, X-WebAuthn-CSRF-Token, X-Firebase-AppCheck, X-CSRF-Token';

// 1. Credentialed CORS — `cors` package with static array; CodeQL-safe.
//    Only origins in CORS_EXACT_ORIGINS receive Access-Control-Allow-Credentials.
app.use(cors({
  origin: CORS_EXACT_ORIGINS,
  credentials: true,
  methods: _CORS_METHODS.split(', '),
  allowedHeaders: _CORS_HEADERS.split(', '),
  maxAge: 86400,
}));

// 2. Non-credentialed CORS for *.petwash.co.il subdomains and dev/preview origins.
//    Uses a literal '*' wildcard — no user-supplied value reaches the header.
//    Access-Control-Allow-Credentials is intentionally absent (incompatible with '*').
app.use((req: any, res: any, next: any) => {
  const reqOrigin = req.headers.origin as string | undefined;
  if (!reqOrigin) return next();
  const isSubdomain = PETWASH_SUBDOMAIN_RE.test(reqOrigin);
  const isDevOrigin = !isProduction && CORS_DEV_PATTERNS.some(p => p.test(reqOrigin));
  if (isSubdomain || isDevOrigin) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', _CORS_METHODS);
    res.setHeader('Access-Control-Allow-Headers', _CORS_HEADERS);
    res.setHeader('Access-Control-Max-Age', '86400');
    if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  } else if (isProduction && reqOrigin) {
    console.warn(`[CORS] Blocked origin: ${reqOrigin}`);
  }
  return next();
});

app.use(express.json({ limit: '10mb' })); // Increased limit for base64 image uploads
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// CSRF protection: double-submit cookie pattern via csrf-csrf (OWASP ASVS 4.0 §4.2.3 / CWE-352)
// Uses csrf-csrf v4 `skipCsrfCheck` to exempt routes that are not CSRF-vulnerable:
//   • GET / HEAD / OPTIONS — safe methods that never mutate state.
//   • /api/webhooks/* — HMAC-verified out-of-band; browsers cannot forge HMAC signatures.
//   • Bearer-authenticated requests — browsers cannot auto-attach Authorization headers,
//     so cross-origin requests with Authorization: Bearer <token> are not CSRF-vulnerable.
// `doubleCsrfProtection` is applied via app.use() directly so CodeQL's
// js/missing-csrf-middleware query can statically detect the protection.
const csrfSecret = process.env.SESSION_SECRET || process.env.COOKIE_SECRET || (() => {
  const fallback = crypto.randomBytes(32).toString('hex');
  // Do not throw — crashing here kills the process before port binds (Cloud Run startup probe failure).
  // Sessions and CSRF tokens will not survive restarts; fix by setting SESSION_SECRET in Secret Manager.
  console.error('[startup] SECURITY: SESSION_SECRET and COOKIE_SECRET are both unset — CSRF protection uses an ephemeral key; set one immediately.');
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
  // Post-login role-routing and onboarding steps — all require a valid Firebase
  // session cookie (requireAuth) which already scopes them to the authenticated user.
  '/api/auth/post-login',
  '/api/auth/choose-role',
  '/api/auth/complete-profile',
]);

const { doubleCsrfProtection, generateCsrfToken } = doubleCsrf({
  getSecret: () => csrfSecret,
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
    // Maya voice provider webhooks (Twilio, Vapi, Retell, etc.) are server-to-server
    // and authenticated by provider HMAC at the route level (e.g. X-Twilio-Signature
    // in TwilioVoiceProvider). Browsers never originate these requests, so there is
    // no CSRF attack surface. Without this exemption every inbound call is rejected
    // with EBADCSRFTOKEN before the route handler runs.
    if (/^\/api\/maya\/voice\//.test(req.path)) return true;
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
    // Public cookie-banner consent capture (client/src/lib/consent.ts:70).
    // Hit by unauthenticated visitors on first-page-load before a pw.csrf cookie
    // is established, and the endpoint only writes the visitor's own consent
    // choices. Same path was returning 403 in production; exempt until a token
    // round-trip helper is added to the client.
    if (req.path === '/api/consent') return true;
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
      const fallback = crypto.randomBytes(32).toString('hex');
      // Do not throw — crashing here kills the process before port binds (Cloud Run startup probe failure).
      console.error('[startup] SECURITY: SESSION_SECRET and COOKIE_SECRET are both unset — sessions use an ephemeral key and will not persist across restarts; set one immediately.');
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

// Canonical URL redirect (www → non-www) for SEO
app.use((req, res, next) => {
  const host = req.get('host')?.toLowerCase() || '';
  if (host.startsWith('www.')) {
    const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
    const nonWwwHost = host.replace(/^www\./, '');
    return res.redirect(301, `${protocol}://${nonWwwHost}${req.originalUrl}`);
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
      return res.status(200).send('<!DOCTYPE html><html><head><title>Pet Wash™</title></head><body><p>Starting up...</p></body></html>');
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
      
      import('./services/googleSheetsIntegration').then(m => m.processStartupRetries()).catch(() => {});
      import('./services/JobDispatchService').then(m => m.JobDispatchService.startDispatchPoller()).catch(() => {});

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
        maxAge: '1d', // Cache static assets for 1 day
        etag: true,
        lastModified: true,
        index: false, // Don't serve index.html for directory requests - let SPA handle routing
        setHeaders: (res, filePath) => {
          // Set correct MIME types for images
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
      console.log('[Cron] All cron jobs initialized successfully');
    } catch (error) {
      console.error('[Cron] Failed to initialize cron jobs (non-fatal):', error);
    }
    
    import('./services/googleSheetsIntegration').then(m => m.processStartupRetries()).catch(() => {});
    import('./services/JobDispatchService').then(m => m.JobDispatchService.startDispatchPoller()).catch(() => {});
    import('./services/JobExpiryNotificationService').then(m => m.jobExpiryNotificationService.start()).catch(() => {});
    import('./jobs/booking-expiry').then(m => m.startBookingExpiryPoller()).catch(() => {});
    import('./jobs/booking-accept-timeout').then(m => m.startAcceptTimeoutPoller()).catch(() => {});
    import('./jobs/rebook-scheduler').then(m => m.startRebookScheduler()).catch(() => {});
    import('./services/providerMonitoring').then(m => m.startProviderMonitoringWatchdog()).catch((e) => console.error('[ProviderWatchdog] Failed to initialize:', e));
    import('./jobs/exception-email').then(m => m.startExceptionEmailJob()).catch((e) => console.error('[ExceptionEmail] Failed to initialize:', e));
    import('./jobs/daily-close-reminder').then(m => m.startDailyCloseReminder()).catch((e) => console.error('[DailyCloseReminder] Failed to initialize:', e));

    // Email Spend Guard — wire alarm callback so budget alerts reach nir.h@petwash.co.il
    import('./services/EmailSpendGuard').then(async ({ emailSpendGuard }) => {
      const { sendSecurityAlert } = await import('./services/alerts');
      emailSpendGuard.setAlarmCallback(sendSecurityAlert);
      console.log('[EmailSpendGuard] ✅ Active — hourly/daily budget alarms wired');
    }).catch(e => console.error('[EmailSpendGuard] Failed to initialize:', e));

    // Gemini Platform Security Monitor — scans all platforms every 15 min
    import('./services/GeminiPlatformSecurityMonitor').then(({ geminiPlatformMonitor }) => {
      geminiPlatformMonitor.start();
    }).catch(e => console.error('[PlatformMonitor] Failed to start:', e));

    // Gemini Spam Guard — AI spam detection + HQ reporting every 30 min
    import('./services/GeminiSpamGuard').then(({ geminiSpamGuard }) => {
      geminiSpamGuard.startScheduler();
    }).catch(e => console.error('[SpamGuard] Failed to start scheduler:', e));
    
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
            const injected = rawHtml.replace(
              '</head>',
              `<script>window.__FIREBASE_CONFIG__=${JSON.stringify(firebaseConfig)};</script></head>`,
            );
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
            return res.send(injected);
          }
        } catch (injectErr) {
          console.error('[SPA] Firebase config injection failed, falling back to sendFile:', injectErr);
        }
      }
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
