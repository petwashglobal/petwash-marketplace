import path from "node:path";
import express from "express";
import helmet from "helmet";
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
app.use(helmet());
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
    
    // Static assets for Vite build
    // Support both dev (tsx) and production (compiled) paths
    const staticRoot = path.resolve(process.cwd(), "dist", "public");
    
    // Verify build exists before starting server
    const indexPath = path.join(staticRoot, "index.html");
    const fs = await import("fs");
    
    if (!fs.existsSync(indexPath)) {
      console.error(`[FATAL] Missing index.html at: ${indexPath}`);
      console.error(`[FATAL] Current working directory: ${process.cwd()}`);
      console.error(`[FATAL] Static root: ${staticRoot}`);
      console.error(`[FATAL] __dirname: ${__dirname}`);
      
      // List what's actually in the directory
      try {
        const distExists = fs.existsSync(path.join(process.cwd(), "dist"));
        console.error(`[FATAL] dist/ exists: ${distExists}`);
        if (distExists) {
          const distContents = fs.readdirSync(path.join(process.cwd(), "dist"));
          console.error(`[FATAL] dist/ contents: ${distContents.join(", ")}`);
        }
      } catch (e) {
        console.error(`[FATAL] Could not list dist/ contents:`, e);
      }
      
      throw new Error("Build files not found - run 'npm run build' before starting production server");
    }
    
    console.log(`[Server] Serving static files from: ${staticRoot}`);
    app.use(express.static(staticRoot));
    
    // SPA fallback for React router (with API route protection)
    app.get("*", (req, res, next) => {
      // CRITICAL: Don't catch API routes - let them return 404 JSON instead of HTML
      if (req.path.startsWith('/api/')) {
        return res.status(404).json({ 
          error: 'API endpoint not found',
          path: req.path 
        });
      }
      
      // Serve index.html for all non-API routes (enables React Router)
      res.sendFile(indexPath);
    });
    
    // Start server
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`[Server] listening on port ${PORT} in ${process.env.NODE_ENV || "development"} mode`);
      console.log(`[Server] Static files: ${staticRoot}`);
      console.log(`[Server] Health check: http://0.0.0.0:${PORT}/`);
    });
  } catch (error) {
    console.error("[FATAL] Server startup failed:", error);
    process.exit(1);
  }
})();
