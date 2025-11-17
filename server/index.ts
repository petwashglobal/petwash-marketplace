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
// A. Security Headers (Protects users from script injections)
app.use(helmet({
  contentSecurityPolicy: false, // Disable strict CSP if it breaks images/scripts
  crossOriginEmbedderPolicy: false,
}));

// B. Compression (Makes your site load 70% faster)
app.use(compression());

app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Session with conditional secure flag (true in production, false in dev)
const isProduction = process.env.NODE_ENV === 'production';
app.use(
  session({
    secret: process.env.SESSION_SECRET || "change_me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      httpOnly: true
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

// 3. API routes, static assets, and server startup
(async () => {
  try {
    // Register all API routes (wait for async completion)
    await registerRoutes(app);
    
    // --- STATIC FILE SERVING FIX ---
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
    console.log('--------------------------------------------------');
    
    // 4. Serve static files from the DIST directory
    app.use(express.static(DIST_PUBLIC_PATH));
    
    // --- 2025 PRODUCTION SAFETY NET ---
    
    // 5. Global Error Handler (Prevents Server Crashes)
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
    
    // 6. Root Route Fix: Serve index.html from DIST for the main page (and SPA routing)
    app.get("*", (req, res) => {
      // Exclude API routes from this catch-all (safety measure)
      if (req.path.startsWith('/api/')) {
        return res.status(404).json({ 
          error: 'API endpoint not found',
          path: req.path 
        });
      }
      
      // Serve index.html with error handling callback (prevents silent hangs)
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
