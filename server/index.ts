if (process.env.GOOGLE_API_KEY && process.env.GEMINI_API_KEY) {
  delete process.env.GEMINI_API_KEY;
}

import path from "node:path";
import express from "express";
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
  contentSecurityPolicy: false, // Disabled for now - enable with proper policy in future
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
    secret: process.env.SESSION_SECRET || process.env.COOKIE_SECRET || "dev_secret_change_in_production",
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

// --- 2025 HEALTH MONITORING ENDPOINT ---
// Track server readiness state
let serverReady = false;

// Health endpoint - always responds 200 for Cloud Run liveness check
app.get('/health', (req, res) => {
  const uptime = process.uptime();
  
  res.set('X-Octopus-Source', 'petwash-backend-global');
  res.status(200).json({
    status: serverReady ? 'ONLINE' : 'STARTING',
    system: 'Pet Wash System v2.0',
    timestamp: new Date().toISOString(),
    metrics: {
      uptime_seconds: Math.floor(uptime),
      memory_usage: (process.memoryUsage().rss / 1024 / 1024).toFixed(2) + ' MB',
    },
    checks: {
      database: serverReady ? 'Connected' : 'Initializing',
      email_service: serverReady ? 'Ready' : 'Initializing',
      port_config: `Port ${PORT}`
    }
  });
});

// --- CRITICAL: Block all non-health requests until initialization is complete ---
// This prevents 404s during startup when routes aren't registered yet
app.use((req, res, next) => {
  if (req.path === '/health') {
    return next();
  }
  
  if (isProduction && !serverReady) {
    if (req.path === '/' || req.method === 'HEAD') {
      return res.status(200).send('<!DOCTYPE html><html><head><title>Pet Wash™</title></head><body><p>Starting up...</p></body></html>');
    }
    return res.status(503).json({
      error: 'Service Unavailable',
      message: 'Server is starting up, please retry in a moment',
      retryAfter: 5
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
      
      // Mark server as ready in development mode
      serverReady = true;
      
      // Process any pending Google Sheets retry queue items from previous sessions
      import('./services/googleSheetsIntegration').then(m => m.processStartupRetries()).catch(() => {});
      
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
    
    // 5b2. Process pending Google Sheets retry queue (production)
    import('./services/googleSheetsIntegration').then(m => m.processStartupRetries()).catch(() => {});
    
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
      const status = err.status || 500;
      const message = err.message || 'Internal Server Error';
      
      console.error(`[CRITICAL ERROR] ${new Date().toISOString()}:`, err);

      // Don't leak stack traces to users in production
      res.status(status).json({
        error: true,
        message: process.env.NODE_ENV === 'production' ? 'Something went wrong' : message,
      });
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
    
    // Mark server as fully ready
    serverReady = true;
    
    console.log('--------------------------------------------------');
    console.log(`✅ [Server] Initialization complete - ${process.env.NODE_ENV || 'development'} mode`);
    console.log(`🏥 [Server] Health endpoint: /health`);
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
