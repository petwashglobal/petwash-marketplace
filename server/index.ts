// Preserve GEMINI_API_KEY for Generative AI services even when GOOGLE_API_KEY (Maps) is also set.
// The two keys serve different Google APIs and must coexist.
if (process.env.GOOGLE_API_KEY && process.env.GEMINI_API_KEY) {
  process.env.GEMINI_AI_KEY = process.env.GEMINI_API_KEY; // stable alias for Gemini generative AI
}

// ── Startup secrets validation (fail fast with clear errors) ──────────────────
(function validateSecrets() {
  const REQUIRED = [
    { key: 'TWILIO_ACCOUNT_SID',  pattern: /^AC[a-f0-9]{32}$/,         hint: 'Must start with AC and be 34 chars (found in Twilio Console)' },
    { key: 'TWILIO_AUTH_TOKEN',   pattern: /^[a-f0-9]{32}$/,           hint: 'Must be 32 hex chars (rotate at console.twilio.com)' },
    { key: 'RECAPTCHA_SECRET_KEY',pattern: /^6[A-Za-z0-9_-]{39,}$/,    hint: 'Must start with 6 — get from Google reCAPTCHA console' },
    { key: 'SUPER_ADMIN_EMAILS',  pattern: /.+@.+/,                    hint: 'Must be at least one valid email address' },
  ];
  const warnings: string[] = [];
  for (const { key, pattern, hint } of REQUIRED) {
    const val = (process.env[key] || '').trim();
    if (!val) {
      warnings.push(`[startup] ⚠️  ${key} is missing — ${hint}`);
    } else if (!pattern.test(val)) {
      warnings.push(`[startup] ⚠️  ${key} has unexpected format — ${hint}`);
    }
  }
  if (warnings.length > 0) {
    console.warn('\n' + warnings.join('\n') + '\n');
  }

  // ── reCAPTCHA key unification — fatal if frontend and backend keys diverge ──
  function extractSiteKey(raw: string): string {
    if (!raw) return '';
    const m = raw.match(/6L[A-Za-z0-9_-]{38,}/);
    return m ? m[0] : raw.trim();
  }
  const viteKey    = extractSiteKey(process.env.VITE_RECAPTCHA_SITE_KEY || '');
  const backendKey = extractSiteKey(process.env.RECAPTCHA_SITE_KEY || '');
  if (viteKey && backendKey && viteKey !== backendKey) {
    const msg =
      `[startup] FATAL: reCAPTCHA frontend/backend site key mismatch detected.\n` +
      `  VITE_RECAPTCHA_SITE_KEY = ${viteKey.slice(0, 12)}... (frontend)\n` +
      `  RECAPTCHA_SITE_KEY      = ${backendKey.slice(0, 12)}... (backend)\n` +
      `  Frontend tokens will ALWAYS fail backend Enterprise verification.\n` +
      `  Fix: set VITE_RECAPTCHA_SITE_KEY = RECAPTCHA_SITE_KEY (${backendKey})\n` +
      `  The frontend now reads its site key from /api/recaptcha/site-key (backend-authoritative).`;
    console.error('\n' + msg + '\n');
    if (process.env.NODE_ENV === 'production') {
      throw new Error('reCAPTCHA frontend/backend key mismatch — refusing to start in production');
    }
  } else if (!backendKey) {
    console.error('[startup] FATAL: RECAPTCHA_SITE_KEY is not set — reCAPTCHA will not function');
  }
})();

import path from "node:path";
import crypto from "node:crypto";
import express from "express";
import { pool, db, isDatabaseAvailable } from "./db";
import { sql } from "drizzle-orm";
import helmet from "helmet";
import compression from "compression";
// CORS middleware - inline implementation due to ESM import issues
function cors(options: { origin: any; credentials?: boolean; methods?: string[]; allowedHeaders?: string[]; maxAge?: number }) {
  return (req: any, res: any, next: any) => {
    const origin = req.get('Origin');
    
    // Handle origin checking
    if (options.origin === true || !origin) {
      res.set('Access-Control-Allow-Origin', origin || '*');
    } else if (typeof options.origin === 'function') {
      options.origin(origin, (err: any, allowed: boolean) => {
        if (err || !allowed) {
          return next(err || new Error('Not allowed by CORS'));
        }
        res.set('Access-Control-Allow-Origin', origin);
      });
    } else {
      res.set('Access-Control-Allow-Origin', origin || '*');
    }
    
    if (options.credentials) {
      res.set('Access-Control-Allow-Credentials', 'true');
    }
    
    if (options.methods) {
      res.set('Access-Control-Allow-Methods', options.methods.join(', '));
    }
    
    if (options.allowedHeaders) {
      res.set('Access-Control-Allow-Headers', options.allowedHeaders.join(', '));
    }
    
    if (options.maxAge) {
      res.set('Access-Control-Max-Age', String(options.maxAge));
    }
    
    // Handle preflight
    if (req.method === 'OPTIONS') {
      res.set('Access-Control-Allow-Headers', req.get('Access-Control-Request-Headers') || options.allowedHeaders?.join(', ') || '*');
      return res.status(204).end();
    }
    
    next();
  };
}
import cookieParser from "cookie-parser";
import session from "express-session";
import { fileURLToPath } from "node:url";

// --- CRITICAL: Early startup logging for Cloud Run debugging ---
console.log('--------------------------------------------------');
console.log('🚀 [Startup] PetWash Server initializing...');
console.log(`   Timestamp: ${new Date().toISOString()}`);
console.log(`   Node version: ${process.version}`);
console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`   Port: ${process.env.PORT || 5000}`);
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

const app = express();
const PORT = Number(process.env.PORT || 5000);

// Trust proxy for Replit/Cloud Run deployment
app.set('trust proxy', 1);

// Production early listen is handled below (single listen point at line ~239)

// 1. Security and basic middleware
const isProduction = process.env.NODE_ENV === 'production';

// A. Security Headers — Helmet (basic hardening only)
// CSP, HSTS, X-Frame-Options, Permissions-Policy, COOP/COEP are owned by
// enhancedSecurityHeaders middleware (server/middleware/securityHeaders.ts).
// Helmet is kept for noSniff only to avoid duplicate / conflicting headers.
app.use(helmet({
  contentSecurityPolicy: false,       // Owned by enhancedSecurityHeaders
  hsts: false,                        // Owned by enhancedSecurityHeaders
  frameguard: false,                  // Owned by enhancedSecurityHeaders
  crossOriginEmbedderPolicy: false,   // Owned by enhancedSecurityHeaders
  crossOriginOpenerPolicy: false,     // Owned by enhancedSecurityHeaders
  crossOriginResourcePolicy: false,   // Owned by enhancedSecurityHeaders
  referrerPolicy: false,              // Owned by enhancedSecurityHeaders
  noSniff: true,                      // X-Content-Type-Options: nosniff (harmless to keep)
  xssFilter: false,                   // X-XSS-Protection: 0 — disabled per 2026 OWASP guidance
}));

// B. Compression (Makes your site load 70% faster)
app.use(compression());

// C. CORS - Strict in production, permissive in dev
// FIX 2025: Use function for origin checking (glob patterns don't work in Express CORS)
const allowedOrigins = [
  'https://petwash.co.il',
  'https://www.petwash.co.il',
  process.env.BASE_URL || 'http://localhost:5000',
  // Cloud Run API domain
  /\.run\.app$/,
  // Replit preview domains
  /\.replit\.dev$/,
  /\.repl\.co$/,
  /\.replit\.app$/,
];

app.use(cors({
  origin: isProduction 
    ? (origin, callback) => {
        // Allow requests with no origin (mobile apps, curl, server-to-server)
        if (!origin) return callback(null, true);
        
        // Check against allowed list (strings and regex patterns)
        const isAllowed = allowedOrigins.some(allowed => {
          if (allowed instanceof RegExp) return allowed.test(origin);
          return origin === allowed;
        });
        
        // Also allow any *.petwash.co.il subdomain
        const isPetWashSubdomain = /^https:\/\/([a-z0-9-]+\.)?petwash\.co\.il$/.test(origin);
        
        if (isAllowed || isPetWashSubdomain) {
          callback(null, true);
        } else {
          console.warn(`[CORS] Blocked origin: ${origin}`);
          callback(new Error('Not allowed by CORS'));
        }
      }
    : true, // Allow all origins in dev
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-WebAuthn-CSRF-Token', 'X-Firebase-AppCheck'],
  maxAge: 86400 // 24 hours preflight cache
}));

app.use(express.json({ limit: '10mb' })); // Increased limit for base64 image uploads
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// D. Session with ENHANCED security settings
app.use(
  session({
    name: 'pw.sid', // Custom session cookie name (obscure default)
    secret: process.env.SESSION_SECRET || process.env.COOKIE_SECRET || (isProduction ? (() => { throw new Error('SESSION_SECRET or COOKIE_SECRET must be set in production'); })() : crypto.randomBytes(32).toString('hex')),
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
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    bootTs: healthState.bootTs,
    checks: {
      process: true,
      env: process.env.NODE_ENV || 'unknown',
    },
    metrics: {
      uptimeSeconds: Math.floor(process.uptime()),
      memoryRss: process.memoryUsage().rss,
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
  if (req.path === '/health' || req.path.startsWith('/api/health')) {
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
      const retryUrl = req.originalUrl;
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
        console.error('--------------------------------------------------');
        console.error('💡 Solution: Run "npm run build" before starting the server');
        console.error('--------------------------------------------------');
        
        throw new Error("Build files not found - run 'npm run build' before starting production server");
      }
      
      console.log(`   index.html found: ✅`);
      
      // Verify critical assets exist
      const logoPath = path.join(DIST_PUBLIC_PATH, "brand", "petwash-logo-official.png");
      const logoExists = fs.existsSync(logoPath);
      console.log(`   Logo exists: ${logoExists ? '✅' : '❌'} (${logoPath})`);
      
      if (!logoExists) {
        console.error('   WARNING: Logo not found - images may be broken in production!');
      }
    } else {
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
      console.log('[Cron] All cron jobs initialized successfully');
    } catch (error) {
      console.error('[Cron] Failed to initialize cron jobs (non-fatal):', error);
    }
    
    import('./services/googleSheetsIntegration').then(m => m.processStartupRetries()).catch(() => {});
    import('./services/JobDispatchService').then(m => m.JobDispatchService.startDispatchPoller()).catch(() => {});
    import('./services/JobExpiryNotificationService').then(m => m.jobExpiryNotificationService.start()).catch(() => {});
    import('./jobs/booking-expiry').then(m => m.startBookingExpiryPoller()).catch(() => {});
    import('./jobs/rebook-scheduler').then(m => m.startRebookScheduler()).catch(() => {});
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
  // Keep the process alive (don't exit - let it recover)
  // In production, you might want to restart gracefully here
});

// 3. Unhandled Promise Rejection Catcher
process.on('unhandledRejection', (reason, promise) => {
  console.error('--------------------------------------------------');
  console.error('❌ FATAL: Unhandled Rejection at:', promise);
  console.error('   Reason:', reason);
  console.error('--------------------------------------------------');
  // Keep the process alive (don't exit - let it recover)
});
