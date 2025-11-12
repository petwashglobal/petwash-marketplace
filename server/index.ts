import express, { type Request, Response, NextFunction } from "express";
import session from 'express-session';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import helmet from 'helmet';
import cors from 'cors';
import * as path from 'path';
import * as fs from 'fs';
import { registerRoutes } from "./routes";
import sessionConfig from './sessionConfig';
import { setupVite, serveStatic, log } from "./vite";
import { registerFounderMember } from "./registerFounder";
import { BackgroundJobProcessor } from "./backgroundJobs";
import { aiMonitor } from "./services/AIMonitoringService";
import { logger } from './lib/logger';
import { initializeGoogleServices } from './config/google-services';
import { initSentry, requestIdMiddleware, logRequest, sentryErrorHandler } from './lib/observability';
import { requestIdAndLogs } from './middleware/requestIdAndLogs';
import { circuit } from './middleware/circuit';
import { graceful } from './graceful';
import metricsRouter from './routes/metrics';
import syntheticRouter from './routes/synthetic';
import deploymentRouter from './routes/deployment';
import analyticsRouter from './routes/analytics';
import accountingRouter from './routes/accounting';
import bankRouter from './routes/bank';
import devicesRouter from './routes/devices';
import globalServicesRouter from './routes/globalServices';
import signaturesRouter from './routes/signatures';
import messagesRouter from './routes/messages';
import socialRouter from './routes/social';
import expensesRouter from './routes/expenses';
import securityStatusRouter from './routes/security-status';
import pricingRouter from './routes/pricing';
import multiCurrencyRouter from './routes/multi-currency';
import conciergeRouter from './routes/concierge';
import franchiseMgmtRouter from './routes/franchise-mgmt';
import walkPaymentFlowRouter from './routes/walk-payment-flow';
import reviewsRouter from './routes/reviews'; // Two-sided review system (2026 Contractor Lifecycle)
import contractorRouter from './routes/contractor'; // Contractor lifecycle: trust scores, earnings, violations, badges
import globalFormsRouter from './routes/globalForms'; // Global forms with Google Sheets integration for all 8 platforms
import weatherTestRouter from './routes/weather-test'; // Google Weather API test endpoints
import gmailTestRouter from './routes/gmail-test'; // Gmail API testing and luxury welcome emails
import operationsRouter from './routes/operations'; // Enterprise operations: tasks, incidents, escalation, global franchise management
import { createSentryRelease} from './lib/sentry-releases';
import { enhancedSecurityHeaders } from './middleware/securityHeaders';
import { setCsrfToken, verifyCsrfToken, csrfTokenEndpoint } from './middleware/csrfProtection';

initSentry();

const app = express();

// Trust proxy for proper secure cookie handling behind reverse proxy
app.set('trust proxy', 1);

// Enterprise-grade structured logging with request IDs
app.use(requestIdAndLogs);

// Circuit breaker for fault tolerance
app.use(circuit(20));

// Legacy observability (keep for Sentry integration)
app.use(requestIdMiddleware);

// Permissions-Policy header for WebAuthn support
app.use((req, res, next) => {
  res.setHeader('Permissions-Policy', 'publickey-credentials-get=(self)');
  next();
});

// Enhanced security headers
app.use(enhancedSecurityHeaders);

// Security headers with proper CSP configuration
// Enhanced for Firebase Auth, Google Sign-In, Apple Sign-In (iOS Safari compatible)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'", // Required for inline scripts  
        "'unsafe-eval'", // Required for some Firebase features
        "https://www.google.com", // Google reCAPTCHA
        "https://apis.google.com", // Google Identity Services (REQUIRED for Sign-In)
        "https://www.gstatic.com", // Google reCAPTCHA + Firebase Auth
        "https://www.googleapis.com", // Firebase Auth APIs
        "https://www.googletagmanager.com", // Google Tag Manager
        "https://www.google-analytics.com", // Google Analytics
        "https://*.googleapis.com", // Firebase and other Google APIs
        "https://*.firebaseapp.com", // Firebase
        "https://*.hubspot.com", // HubSpot scripts
        "https://appleid.cdn-apple.com", // Apple Sign-In
      ],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://appleid.cdn-apple.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: [
        "'self'",
        "https://www.google.com",
        "https://www.googleapis.com", // Firebase Auth (critical for iOS Safari)
        "https://securetoken.googleapis.com", // Firebase Auth tokens (REQUIRED)
        "https://identitytoolkit.googleapis.com", // Firebase Auth toolkit (REQUIRED)
        "https://*.googleapis.com",
        "https://*.firebaseapp.com",
        "https://*.firebaseio.com",
        "https://*.google-analytics.com",
        "https://*.analytics.google.com",
        "wss://*.firebaseio.com",
        "https://ipapi.co", // Geolocation service
        "https://ip-api.com", // Geolocation service
        "https://ipinfo.io", // Geolocation service
        "https://*.hubspot.com", // HubSpot CRM
        "https://*.hubapi.com", // HubSpot API
        "https://appleid.apple.com", // Apple Sign-In auth
      ],
      frameSrc: [
        "'self'", 
        "https://www.google.com", // Google reCAPTCHA + Sign-In
        "https://accounts.google.com", // Google OAuth (REQUIRED for sign-in popup/redirect)
        "https://*.firebaseapp.com",
        "https://appleid.apple.com", // Apple Sign-In
      ],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// CORS: Dynamically build allowed origins to match WebAuthn configuration
const buildCorsOrigins = (): string[] => {
  const origins = [
    // Active: petwash.co.il (Israel - Live Now)
    'https://petwash.co.il',
    'https://www.petwash.co.il',
    'https://api.petwash.co.il',
    'https://hub.petwash.co.il',
    'https://status.petwash.co.il',
  ];
  
  // Development: localhost and Vite dev server
  if (process.env.NODE_ENV === 'development') {
    origins.push(
      'http://localhost:5000',
      'http://localhost:5000',
      'http://localhost:5173',  // Vite default
      'http://127.0.0.1:5000',
      'http://127.0.0.1:5173'   // Vite default
    );
  }
  
  // Dynamic Replit domain
  if (process.env.REPLIT_DEV_DOMAIN) {
    origins.push(`https://${process.env.REPLIT_DEV_DOMAIN}`);
  }
  
  // Staging domain
  if (process.env.STAGING_DOMAIN) {
    origins.push(`https://${process.env.STAGING_DOMAIN}`);
  }
  
  // Custom origins from environment
  if (process.env.CUSTOM_ORIGINS) {
    const customOrigins = process.env.CUSTOM_ORIGINS.split(',').map(o => o.trim());
    origins.push(...customOrigins);
  }
  
  // Remove duplicates
  return Array.from(new Set(origins));
};

const allowedOrigins = buildCorsOrigins();

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, curl)
    if (!origin) return callback(null, true);
    
    // CRITICAL: Allow Replit domain verification probes (*.replit.app, *.repl.co)
    // Replit's custom domain verification system sends requests from these origins
    if (origin && (origin.includes('.replit.app') || origin.includes('.repl.co') || origin.includes('.replit.dev'))) {
      logger.info(`[CORS] Allowing Replit verification origin: ${origin}`);
      return callback(null, true);
    }
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn(`[CORS] Blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

// Enable gzip/brotli compression for all responses
app.use(compression());

// Health check endpoints (highest priority - before any middleware)
// Primary health endpoint for production monitoring
app.get('/health', (_req, res) => {
  const isProd = process.env.NODE_ENV === 'production' || 
                 process.env.REPLIT_DEPLOYMENT === '1' || 
                 process.env.REPLIT_DEPLOYMENT === 'true';
  res.status(200).json({ 
    ok: true,
    env: isProd ? 'production' : 'development',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    service: 'PetWash™ Enterprise API',
    version: '2.0.0'
  });
});

// Legacy healthz endpoint (for backward compatibility)
app.get('/healthz', (_req, res) => {
  res.status(200).json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    service: 'Pet Wash API'
  });
});

app.get('/readiness', async (_req, res) => {
  try {
    const { db } = await import('./db');
    const { sql } = await import('drizzle-orm');
    await db.execute(sql`SELECT 1`);
    
    res.status(200).json({ 
      status: 'ready',
      timestamp: new Date().toISOString(),
      checks: {
        database: 'healthy',
        firebase: 'healthy'
      }
    });
  } catch (error) {
    res.status(503).json({ 
      status: 'not_ready',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Enhanced monitoring endpoint
app.get('/api/health/monitoring', async (_req, res) => {
  try {
    const { getMonitoringStatus } = await import('./monitoring');
    const status = await getMonitoringStatus();
    res.status(200).json(status);
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to retrieve monitoring status',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// PERFORMANCE: Aggressive caching for static assets
app.use((req, res, next) => {
  const url = req.url;
  
  if (url.match(/\.(js|css|woff2?|ttf|otf|eot|svg|png|jpg|jpeg|webp|avif|gif|ico)$/)) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Vary', 'Accept-Encoding');
  } else if (url.endsWith('.html') || url === '/') {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  }
  
  next();
});

// Serve static assets - NOTE: In production, serveStatic() handles all static files from server/public
// These are only for development mode when using Vite HMR
if (process.env.NODE_ENV === 'development') {
  app.use('/assets', express.static('dist/public/assets'));
  app.use(express.static('dist/public'));
}
// SECURITY: /attached_assets removed - contains sensitive documents (passports, invoices, insurance)
// Access to sensitive assets must be controlled through authenticated API endpoints
app.use('/docs', express.static('docs'));

// Body parsers
// Cookie secret for CSRF protection (separate from session secret)
const cookieSecret = process.env.COOKIE_SECRET || (
  process.env.NODE_ENV === 'production' 
    ? (() => { throw new Error('COOKIE_SECRET required in production'); })()
    : 'petwash-dev-cookie-secret'
);
app.use(cookieParser(cookieSecret));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Session setup
app.set('trust proxy', 1);
app.use(session(sessionConfig));

// CSRF Protection - Set token in session/cookie
app.use(setCsrfToken);

// CSRF Token endpoint
app.get('/api/csrf-token', csrfTokenEndpoint);

// API request logging (only for /api routes)
app.use((req, res, next) => {
  if (req.path.startsWith("/api")) {
    const start = Date.now();
    
    res.on("finish", () => {
      const duration = Date.now() - start;
      log(`${req.method} ${req.path} ${res.statusCode} in ${duration}ms`);
    });
  }
  
  next();
});

app.use('/', metricsRouter);
app.use('/api', syntheticRouter);
app.use('/api', deploymentRouter);
app.use('/api', analyticsRouter);
app.use('/api/accounting', accountingRouter);
app.use('/api/bank', bankRouter);
app.use('/api/devices', devicesRouter);
app.use('/api/signatures', signaturesRouter); // E-Signature system for legal documents
app.use('/api/messages', messagesRouter); // Secure personal inbox with document signing
app.use('/api/social', socialRouter); // The PetWash Circle - Instagram-style social platform with AI moderation
app.use('/api/pricing', pricingRouter); // Microsoft-style flexible pricing strategies
app.use('/api/currency', multiCurrencyRouter); // Airwallex-style multi-currency operations
app.use('/api/concierge', conciergeRouter); // Apple-style Pet Care Concierge
app.use('/api/franchise', franchiseMgmtRouter); // McDonald's-style franchise management
app.use('/api/reviews', reviewsRouter); // Two-sided review system (2026 Contractor Lifecycle)
app.use('/api/contractor', contractorRouter); // Contractor trust scores, earnings, violations, badges (2026 Lifecycle)
app.use('/api/forms', globalFormsRouter); // Global forms with Google Sheets integration (Contact, Feedback, Newsletter, Franchise, Bookings)
app.use('/api', weatherTestRouter); // Google Weather API test endpoints for validation
app.use('/api/gmail-test', gmailTestRouter); // Gmail API testing and luxury welcome emails
app.use('/', walkPaymentFlowRouter); // Uber-style Emergency Walk payment flow (pay first)
app.use('/api', expensesRouter); // Israeli Employee Expense Management System with 2025 FinTech Architecture
app.use('/api', globalServicesRouter); // Global services: currency, geolocation, legal compliance
app.use('/api/ops', operationsRouter); // Enterprise operations: tasks, incidents, escalation, global franchise management
app.use('/', securityStatusRouter); // PetWash Shield™ Security Status Dashboard

// Status monitoring routes (production uptime and station health)
import statusRouter from './routes/status';
app.use('/status', statusRouter);

// Enterprise feature routes (GDPR, AI Bookkeeping, WhatsApp, Israeli Tax, Bank Integration)
import { registerEnterpriseRoutes } from './enterprise/routes';
registerEnterpriseRoutes(app);

(async () => {
  const startupStartTime = Date.now();
  logger.info('🚀 Server startup initiated');
  
  const server = await registerRoutes(app);
  
  // CRITICAL: Setup static serving FIRST (before expensive operations)
  const isProd = process.env.NODE_ENV === 'production' || 
                 process.env.REPLIT_DEPLOYMENT === '1' || 
                 process.env.REPLIT_DEPLOYMENT === 'true';
  
  if (isProd) {
    logger.info('PRODUCTION MODE: Serving static build');
    const buildRevision = Date.now().toString();
    
    app.use((req, res, next) => {
      if (req.path === '/' || req.path.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Surrogate-Control', 'no-store');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.setHeader('X-Build-Revision', buildRevision);
        res.removeHeader('ETag');
        res.removeHeader('Last-Modified');
      }
      next();
    });
    
    serveStatic(app);
  } else {
    logger.info('DEVELOPMENT MODE: Setting up Vite');
    await setupVite(app, server);
  }

  // CRITICAL: Start server IMMEDIATELY to open port (before expensive operations)
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, async () => {
    const portOpenTime = Date.now() - startupStartTime;
    log(`serving on port ${port}`);
    logger.info(`✅ Port ${port} opened in ${portOpenTime}ms`);
    logger.info('Pet Wash server ready');
    
    // Run expensive initialization tasks AFTER port is open (background)
    setImmediate(async () => {
      try {
        logger.info('⏳ Starting post-startup initialization...');
        
        // File sync (if needed for production)
        if (isProd) {
          const serverPublicPath = path.resolve(import.meta.dirname, 'public');
          const distPublicPath = path.resolve(import.meta.dirname, '..', 'dist', 'public');
          
          if (fs.existsSync(distPublicPath) && !fs.existsSync(path.join(serverPublicPath, 'index.html'))) {
            logger.info('📦 Syncing build files (post-startup)...');
            fs.mkdirSync(serverPublicPath, { recursive: true });
            fs.cpSync(distPublicPath, serverPublicPath, { recursive: true });
            logger.info('✅ Build files synced');
          }
        }
        
        // Setup WebSocket
        try {
          const { setupWebSocket } = await import('./websocket');
          setupWebSocket(server);
          logger.info('✅ WebSocket initialized at /realtime');
        } catch (error) {
          logger.error('Failed to initialize WebSocket:', error);
        }
        
        // Register founder member
        try {
          await registerFounderMember();
        } catch (error) {
          logger.error('Failed to register founder:', error);
        }
        
        // Initialize Google Services
        try {
          initializeGoogleServices();
        } catch (error) {
          logger.error('Failed to initialize Google Services:', error);
        }
        
        // Create Sentry release
        try {
          await createSentryRelease();
        } catch (error) {
          logger.error('Failed to create Sentry release:', error);
        }
        
        // Start background job processor (weather alerts, monitoring, etc.)
        try {
          BackgroundJobProcessor.start();
          logger.info('✅ Background job processor started successfully');
        } catch (error) {
          logger.error('CRITICAL: Failed to start background job processor:', error);
        }

        // Start AI monitoring service (background quality assurance)
        try {
          await aiMonitor.start();
          logger.info('✅ AI monitoring service started successfully');
        } catch (error) {
          logger.error('CRITICAL: Failed to start AI monitoring service:', error);
        }

        // Start Gemini AI Watchdog - Comprehensive real-time monitoring
        try {
          const { default: GeminiWatchdogService } = await import('./services/GeminiWatchdogService');
          await GeminiWatchdogService.start();
          logger.info('✅ Gemini AI Watchdog service started successfully');
        } catch (error) {
          logger.error('CRITICAL: Failed to start Gemini Watchdog service:', error);
        }
        
        const totalStartupTime = Date.now() - startupStartTime;
        logger.info(`✅ Full initialization complete in ${totalStartupTime}ms`);
        logger.info('🚀 ALL SYSTEMS ACTIVE - Premium features enabled');
        
      } catch (error) {
        logger.error('Error during post-startup initialization:', error);
      }
    });
  });
  
  // Enable graceful shutdown
  graceful(server);
})();
