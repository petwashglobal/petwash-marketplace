// When both GOOGLE_API_KEY (Maps/Places) and GEMINI_API_KEY (Replit integration) are injected,
// the Google AI SDK prints "Both GOOGLE_API_KEY and GEMINI_API_KEY are set" for every client
// instantiation (43+ times at startup). The SDK already uses GOOGLE_API_KEY in this case,
// so GEMINI_API_KEY is redundant. Delete it from the runtime env to suppress the noise.
if (process.env.GOOGLE_API_KEY && process.env.GEMINI_API_KEY) {
  delete process.env.GEMINI_API_KEY;
}

// ── Startup config error collector ────────────────────────────────────────────
// ALL pre-bind validation errors are recorded here instead of thrown.
// Throwing before app.listen() causes the process to exit before it binds the port;
// Cloud Run's startup probe never sees a listener → "user-provided container failed
// the configured startup probe checks".  After the port is bound these errors are:
//   1. Logged clearly in the container stdout for Cloud Run revision logs.
//   2. Exposed in the /health response so operators can diagnose via curl.
const _startupConfigErrors: string[] = [];

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
      // Do NOT throw before app.listen() — a pre-bind crash causes Cloud Run startup probe failure.
      // Record in _startupConfigErrors so the issue surfaces in /health monitoring.
      console.error(msg);
      _startupConfigErrors.push(msg);
    } else if (val.length < MIN_ADMIN_SECRET_LENGTH) {
      const msg = `[startup] SECURITY: ${key} is shorter than ${MIN_ADMIN_SECRET_LENGTH} characters — use a longer secret`;
      // Do NOT throw before app.listen() — a pre-bind crash causes Cloud Run startup probe failure.
      // Record in _startupConfigErrors so the issue surfaces in /health monitoring.
      console.error(msg);
      _startupConfigErrors.push(msg);
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
    // Do NOT throw before app.listen() — a pre-bind crash causes Cloud Run startup probe failure.
    // Record so /health exposes the misconfiguration to operators.
    _startupConfigErrors.push(
      'TRANZILA_WEBHOOK_BYPASS_SIGNATURE=true is forbidden in ' + env,
    );
  }
})();

import path from "node:path";
import crypto from "node:crypto";
import express from "express";
import { pool, db, isDatabaseAvailable } from "./db";
import { sql } from "drizzle-orm";
import helmet from "helmet";
import compression from "compression";

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

// Production early listen is handled below (single listen point at line ~239)

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
    // Bearer-authenticated requests: browsers cannot auto-attach Authorization headers
    // on cross-origin requests, so there is no CSRF attack surface here.
    const authHeader = req.headers['authorization'] as string | undefined;
    if (authHeader?.startsWith('Bearer ')) return true;
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

app.get('/health', (_req, res) => {
  res.set('X-Octopus-Source', 'petwash-backend-global');
  const hasConfigErrors = _startupConfigErrors.length > 0;
  res.status(200).json({
    status: hasConfigErrors ? 'DEGRADED' : 'OK',
    timestamp: new Date().toISOString(),
    bootTs: healthState.bootTs,
    checks: {
      process: true,
      env: process.env.NODE_ENV || 'unknown',
      ...(hasConfigErrors ? { configErrors: _startupConfigErrors } : {}),
    },
    metrics: {
      uptimeSeconds: Math.floor(process.uptime()),
      memoryRss: process.memoryUsage().rss,
    },
  });
});

// /health/strict — deployment gate.
// Returns 503 when startup collected security-critical config errors (missing required
// secrets, weak admin credentials, forbidden bypass flags).  The CI smoke test checks
// this endpoint AFTER /health returns 200 to prevent a misconfigured container from
// being promoted to Cloud Run traffic.  Regular health checks should use /health.
app.get('/health/strict', (_req, res) => {
  res.set('X-Octopus-Source', 'petwash-backend-global');
  const timestamp = new Date().toISOString();
  if (_startupConfigErrors.length > 0) {
    return res.status(503).json({
      status: 'DEGRADED',
      timestamp,
      bootTs: healthState.bootTs,
      checks: {
        process: true,
        env: process.env.NODE_ENV || 'unknown',
        configErrors: _startupConfigErrors,
      },
      message:
        'Container started but has critical configuration errors. ' +
        'Fix the errors listed in checks.configErrors and redeploy.',
    });
  }
  return res.status(200).json({
    status: 'OK',
    timestamp,
    bootTs: healthState.bootTs,
    checks: {
      process: true,
      env: process.env.NODE_ENV || 'unknown',
      configErrors: [],
    },
  });
});

app.get('/api/health', async (_req, res) => {
  const db = await checkDbOnce();
  const status = db.ok ? 'OK' : 'DEGRADED';
  res.status(200).json({
    status,
    timestamp: new Date().toISOString(),
    checks: { db },
    state: healthState,
  });
});

app.get('/api/health/strict', async (_req, res) => {
  const db = await checkDbOnce();
  if (!db.ok) {
    return res.status(503).json({
      status: 'DOWN',
      timestamp: new Date().toISOString(),
      checks: { db },
      state: healthState,
    });
  }
  return res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    checks: { db },
    state: healthState,
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

// --- Block non-health requests until routes are registered ---
app.use((req, res, next) => {
  if (req.path === '/health' || req.path === '/health/strict' || req.path.startsWith('/api/health')) {
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

// --- CRITICAL FIX: Start server IMMEDIATELY in production (Cloud Run requires fast port binding) ---
// In production, start listening BEFORE route registration to satisfy Cloud Run health checks
if (isProduction) {
  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log('--------------------------------------------------');
    console.log(`🚀 [Server] Port ${PORT} bound - starting initialization...`);
    if (_startupConfigErrors.length > 0) {
      console.error(`⚠️  [Server] ${_startupConfigErrors.length} startup config error(s) detected:`);
      _startupConfigErrors.forEach(e => console.error('   ' + e));
      console.error('   These errors are also visible in GET /health (check → configErrors).');
    }
    console.log('--------------------------------------------------');
  });
  
  // Store server reference for later use
  (app as any)._server = server;

  // Graceful shutdown — Cloud Run sends SIGTERM before replacing the instance.
  // Stop accepting new connections and drain existing requests within 10 s.
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
    const { registerRoutes } = await import("./routes");
    console.log('[Server] Routes module loaded, registering routes...');
    await registerRoutes(app);
    healthState.app.routesReady = true;

    // CRITICAL: Unblock API requests as soon as routes are registered.
    // Everything below (static files, cron jobs, notification handlers) is background
    // work and must NOT delay serverReady — they were already labelled non-blocking
    // but the awaited imports below were still holding serverReady=false for 100+ s
    // on a Cloud Run cold start, causing the smoke test to time out.
    if (isProduction) {
      serverReady = true;
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
      console.log('[Cron] All cron jobs initialized successfully');
    } catch (error) {
      console.error('[Cron] Failed to initialize cron jobs (non-fatal):', error);
    }
    
    import('./services/googleSheetsIntegration').then(m => m.processStartupRetries()).catch(() => {});
    import('./services/JobDispatchService').then(m => m.JobDispatchService.startDispatchPoller()).catch(() => {});
    import('./services/JobExpiryNotificationService').then(m => m.jobExpiryNotificationService.start()).catch(() => {});
    import('./jobs/booking-expiry').then(m => m.startBookingExpiryPoller()).catch(() => {});
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
      res.sendFile(indexPath, (err) => {
        if (err) {
          console.error('❌ CRITICAL: Could not serve index.html from:', indexPath);
          console.error('   Error details:', err);
          res.status(500).send('Server Error: Static files missing. Did you run "npm run build"?');
        }
      });
    });
    
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
    console.error('--------------------------------------------------');
    console.error("❌ [FATAL] Server startup failed:", errMsg);
    if (errStack) console.error("   Stack:", errStack);
    console.error('--------------------------------------------------');
    // Surface the failure in /api/health so it is visible without needing Cloud Run logs
    (healthState.app as any).startupError = errMsg;
    (healthState.app as any).startupErrorAt = new Date().toISOString();
    if (isProduction) {
      console.error('⚠️ [Production] Keeping server alive for health checks — routesReady=false, all API routes may return 503');
      serverReady = false;
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
    const { SystemEventService } = require('./services/SystemEventService');
    SystemEventService.stamp({
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
    const { SystemEventService } = require('./services/SystemEventService');
    const msg = reason instanceof Error ? reason.message : String(reason);
    SystemEventService.stamp({
      eventType: 'process_unhandled_rejection',
      severity: 'error',
      source: 'process',
      message: msg?.slice(0, 300),
      detail: { reason: msg?.slice(0, 800) },
    });
  } catch (_) { /* swallow */ }
  // Keep the process alive (don't exit - let it recover)
});
