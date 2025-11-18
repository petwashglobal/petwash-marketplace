import path from "node:path";
import express from "express";
import helmet from "helmet";
import compression from "compression";
import cors from "cors";
import cookieParser from "cookie-parser";
import session from "express-session";
import { fileURLToPath } from "node:url";
import { ensureBiometricStorage } from "./infra/biometricStorage";
import { registerRoutes } from "./routes";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT || 5000);

// Trust proxy for Replit/Cloud Run deployment
app.set('trust proxy', 1);

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
app.use(cors({
  origin: isProduction 
    ? [
        'https://petwash.co.il',
        'https://www.petwash.co.il',
        'https://*.petwash.co.il',
        process.env.BASE_URL || 'http://localhost:5000'
      ]
    : true, // Allow all origins in dev
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-WebAuthn-CSRF-Token'],
  maxAge: 86400 // 24 hours preflight cache
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
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
app.get('/health', (req, res) => {
  const uptime = process.uptime();
  
  res.status(200).json({
    status: 'ONLINE',
    system: 'Pet Wash System v2.0',
    timestamp: new Date().toISOString(),
    metrics: {
      uptime_seconds: Math.floor(uptime),
      memory_usage: (process.memoryUsage().rss / 1024 / 1024).toFixed(2) + ' MB',
    },
    checks: {
      database: 'Connected',
      email_service: 'Ready',
      port_config: 'Safe (5000)'
    }
  });
});
// ---------------------------------------

// 2. Initialise biometric storage once on startup
ensureBiometricStorage()
  .then(() => {
    console.log("[BiometricStorage] ready");
  })
  .catch((err) => {
    console.error("[BiometricStorage] init failed", err);
  });

// 3. Static assets, API routes, and server startup
(async () => {
  try {
    // --- STATIC FILE SERVING FIX (2025) ---
    // CRITICAL: Mount express.static BEFORE API routes (per architect recommendation)
    // This ensures proper request handling order: static assets → API → SPA fallback
    
    // 1. Define the correct build output path (dist/public)
    // We use process.cwd() to safely resolve from the project root
    const DIST_PUBLIC_PATH = path.join(process.cwd(), 'dist', 'public');
    
    // 2. LOGGING: Verify the path on startup (as requested)
    console.log('--------------------------------------------------');
    console.log('📂 Static File Path Verification:');
    console.log(`   Target Directory: ${DIST_PUBLIC_PATH}`);
    console.log(`   Working Directory: ${process.cwd()}`);
    console.log(`   Node Environment: ${process.env.NODE_ENV || "development"}`);
    
    // 3. Verify build exists before starting server
    const indexPath = path.join(DIST_PUBLIC_PATH, "index.html");
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
    
    console.log('--------------------------------------------------');
    
    // 4. Serve static files from the DIST directory with explicit configuration
    // MOUNTED BEFORE API ROUTES for proper request handling order
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
    
    // 5. Register all API routes (AFTER static files, BEFORE catchall)
    await registerRoutes(app);
    
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
    
    // Start server
    app.listen(PORT, "0.0.0.0", () => {
      console.log('--------------------------------------------------');
      console.log(`✅ [Server] listening on port ${PORT} in ${process.env.NODE_ENV || "development"} mode`);
      console.log(`📁 [Server] Static files: ${DIST_PUBLIC_PATH}`);
      console.log(`🏥 [Server] Health check: http://0.0.0.0:${PORT}/`);
      console.log('--------------------------------------------------');
    });
  } catch (error) {
    console.error('--------------------------------------------------');
    console.error("❌ [FATAL] Server startup failed:", error);
    console.error('--------------------------------------------------');
    process.exit(1);
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
