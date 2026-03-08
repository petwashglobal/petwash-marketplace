if (process.env.GOOGLE_API_KEY && process.env.GEMINI_API_KEY) {
  delete process.env.GEMINI_API_KEY;
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
console.log('--------------------------------------------------');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT || 5000);

// Trust proxy for Replit/Cloud Run deployment
app.set('trust proxy', 1);

// Production early listen is handled below (single listen point at line ~239)

// 1. Security and basic middleware
const isProduction = process.env.NODE_ENV === 'production';

// A. Security Headers (ENHANCED 2025 - Protects users from script injections, XSS, clickjacking)
app.use(helmet({
  contentSecurityPolicy: isProduction ? {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://www.google.com", "https://www.gstatic.com", "https://www.googletagmanager.com", "https://connect.facebook.net", "https://analytics.tiktok.com", "https://www.clarity.ms", "https://maps.googleapis.com", "https://www.googleadservices.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "blob:", "https:", "http:"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      connectSrc: ["'self'", "https://*.googleapis.com", "https://*.google.com", "https://*.firebaseio.com", "https://*.firebaseapp.com", "https://*.cloudfunctions.net", "https://identitytoolkit.googleapis.com", "https://securetoken.googleapis.com", "wss://*.firebaseio.com", "https://ipapi.co", "https://ip-api.com", "https://ipinfo.io", "https://www.google-analytics.com", "https://api.hubspot.com", "https://*.sentry.io", "https://*.clarity.ms", "https://*.facebook.com", "https://*.tiktok.com"],
      frameSrc: ["'self'", "https://www.google.com", "https://*.firebaseapp.com", "https://docs.google.com"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: []
    }
  } : false,
  crossOriginEmbedderPolicy: false,
  hsts: isProduction ? {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  } : false, // HSTS only in production
  frameguard: { action: 'deny' }, // Prevent clickjacking
  noSniff: true, // Prevent MIME type sniffing
  xssFilter: true // Enable XSS filter
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
    secret: process.env.SESSION_SECRET || process.env.COOKIE_SECRET || (isProduction ? (() => { throw new Error('SESSION_SECRET or COOKIE_SECRET must be set in production'); })() : require('crypto').randomBytes(32).toString('hex')),
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

// --- Block non-health requests until routes are registered ---
app.use((req, res, next) => {
  if (req.path === '/health' || req.path.startsWith('/api/health')) {
    return next();
  }
  
  if (isProduction && !serverReady) {
    if (req.path === '/' || req.method === 'HEAD') {
      return res.status(200).send('<!DOCTYPE html><html><head><title>Pet Wash™</title></head><body><p>Starting up...</p></body></html>');
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
    // CRITICAL: Add timeout to prevent indefinite hangs in Cloud Run
    const ROUTE_REGISTRATION_TIMEOUT = 120000; // 120 seconds max (large app needs time)
    console.log('[Server] Loading routes module (dynamic import)...');
    const { registerRoutes } = await import("./routes");
    console.log('[Server] Routes module loaded, registering routes...');
    const routeRegistrationPromise = registerRoutes(app);
    const routeTimeoutPromise = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('Route registration timed out after 120 seconds')), ROUTE_REGISTRATION_TIMEOUT)
    );
    
    await Promise.race([routeRegistrationPromise, routeTimeoutPromise]);
    
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
      console.log('[Cron] All cron jobs initialized successfully');
    } catch (error) {
      console.error('[Cron] Failed to initialize cron jobs (non-fatal):', error);
    }
    
    import('./services/googleSheetsIntegration').then(m => m.processStartupRetries()).catch(() => {});
    import('./services/JobDispatchService').then(m => m.JobDispatchService.startDispatchPoller()).catch(() => {});
    import('./services/JobExpiryNotificationService').then(m => m.jobExpiryNotificationService.start()).catch(() => {});

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
    
    // --- 2025 PRODUCTION SAFETY NET ---
    
    // 6. Global Error Handler (Prevents Server Crashes)
    // NOTE: This must be registered BEFORE the catchall route to catch API errors
    app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      const status = err.statusCode || err.status || 500;
      const traceId = (req as any).traceId || res.getHeader('x-trace-id') || '';
      
      console.error(`[CRITICAL ERROR] ${new Date().toISOString()}:`, err);

      if (!res.headersSent) {
        res.status(status).json({
          error: err.code || 'SERVER_ERROR',
          message: status >= 500
            ? 'Something went wrong. Please try again later.'
            : (err.message || 'Request failed'),
          traceId,
        });
      }
    });
    
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
    
    serverReady = true;
    healthState.app.routesReady = true;
    connectDbNonBlocking().catch(() => {});
    
    console.log('--------------------------------------------------');
    console.log(`✅ [Server] Initialization complete - ${process.env.NODE_ENV || 'development'} mode`);
    console.log(`🏥 [Server] Health endpoint: /health`);
    console.log(`🏥 [Server] API Health endpoint: /api/health`);
    console.log('--------------------------------------------------');
  } catch (error) {
    console.error('--------------------------------------------------');
    console.error("❌ [FATAL] Server startup failed:", error);
    console.error('--------------------------------------------------');
    if (isProduction) {
      console.error('⚠️ [Production] Keeping server alive for health checks - routes may be unavailable');
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
