/**
 * Enhanced Security Headers Middleware
 * =====================================
 * Covers: HSTS, CSP, MIME sniffing, clickjacking, FLoC opt-out,
 *         Permissions-Policy, COOP/COEP/CORP, referrer control.
 *
 * CSP is kept strict but compatible with:
 *  - Firebase Auth (accounts.google.com, apis.google.com)
 *  - Google Maps & Places API (maps.googleapis.com, maps.gstatic.com)
 *  - Gemini / Vertex AI (generativelanguage.googleapis.com)
 *  - SendGrid click-tracking (click.petwash.co.il)
 *  - Twilio JS (media.twiliocdn.com)
 *  - Stripe.js (js.stripe.com)
 *  - Sentry telemetry (*.sentry.io)
 *  - Replit DevTools (*.replit.dev, *.repl.co)
 *
 * Last reviewed against:
 *  Google CSP evaluator – March 2025
 *  OWASP Secure Headers Project – 2025 baseline
 *  SendGrid deliverability docs – Q1 2025
 */

import { Request, Response, NextFunction } from 'express';

const isDev = process.env.NODE_ENV !== 'production';

// Replit preview domains (only relevant in dev)
const replitHosts = isDev
  ? " *.replit.dev *.repl.co *.replit.app"
  : "";

const CSP_DIRECTIVES = [
  // Documents
  `default-src 'self'${replitHosts}`,

  // Scripts — 'strict-dynamic' for future inline-hash support; nonce approach on SSR pages
  [
    "script-src",
    "'self'",
    // Google / Firebase
    "https://apis.google.com",
    "https://www.gstatic.com",
    "https://accounts.google.com",
    // Maps & Places widget
    "https://maps.googleapis.com",
    "https://maps.gstatic.com",
    // reCAPTCHA Enterprise
    "https://www.google.com/recaptcha/",
    "https://www.gstatic.com/recaptcha/",
    // Stripe
    "https://js.stripe.com",
    // Twilio
    "https://media.twiliocdn.com",
    // Sentry
    "https://js.sentry-cdn.com",
    // Dev tunnels
    replitHosts,
    // Vite HMR (dev only)
    isDev ? "'unsafe-eval'" : "",
  ].filter(Boolean).join(" "),

  // Styles
  [
    "style-src",
    "'self'",
    "'unsafe-inline'",          // Required by Tailwind CSS / shadcn injected styles
    "https://fonts.googleapis.com",
    "https://fonts.gstatic.com",
    replitHosts,
  ].filter(Boolean).join(" "),

  // Fonts
  [
    "font-src",
    "'self'",
    "https://fonts.gstatic.com",
    "data:",
    replitHosts,
  ].filter(Boolean).join(" "),

  // Images — wide allowlist needed for Google Maps tiles, user avatars, CDN
  [
    "img-src",
    "'self'",
    "data:",
    "blob:",
    "https://maps.googleapis.com",
    "https://maps.gstatic.com",
    "https://lh3.googleusercontent.com",   // Google profile photos
    "https://storage.googleapis.com",       // GCS / Firebase Storage
    "https://firebasestorage.googleapis.com",
    "https://www.google.com",
    "https://www.gstatic.com",
    "https://avatars.githubusercontent.com",
    replitHosts,
    "*",                                    // Pet images from provider CDNs — tighten in v2
  ].filter(Boolean).join(" "),

  // Fetch / XHR — only our own backend + external APIs used by the client
  [
    "connect-src",
    "'self'",
    // Firebase
    "https://*.googleapis.com",
    "https://*.firebaseio.com",
    "https://*.firebase.com",
    "wss://*.firebaseio.com",
    // Google Places / Maps
    "https://places.googleapis.com",
    "https://maps.googleapis.com",
    // Gemini AI (client-side SDK)
    "https://generativelanguage.googleapis.com",
    // SendGrid click-tracking pixel
    "https://click.petwash.co.il",
    // Sentry
    "https://*.sentry.io",
    "https://*.ingest.sentry.io",
    // Twilio
    "https://media.twiliocdn.com",
    // Stripe
    "https://api.stripe.com",
    // Dev
    replitHosts,
    isDev ? "ws://localhost:*" : "",
    isDev ? "wss://localhost:*" : "",
  ].filter(Boolean).join(" "),

  // Frames — only Google reCAPTCHA + Stripe payment UI
  [
    "frame-src",
    "'self'",
    "https://www.google.com/recaptcha/",
    "https://recaptcha.google.com/",
    "https://js.stripe.com",
    "https://hooks.stripe.com",
    replitHosts,
  ].filter(Boolean).join(" "),

  // No plugins (Flash, etc.)
  "object-src 'none'",

  // Base tag restricted to self
  "base-uri 'self'",

  // Form actions restricted to self
  "form-action 'self'",

  // Upgrade insecure requests in production
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

export function enhancedSecurityHeaders(req: Request, res: Response, next: NextFunction) {
  // ── HSTS ─────────────────────────────────────────────────────────────────
  if (!isDev) {
    res.setHeader(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    );
  }

  // ── Content-Security-Policy ───────────────────────────────────────────────
  // Skip CSP in dev: Vite injects inline <script type="module"> blocks that CSP
  // blocks even with 'unsafe-inline' (module scripts need a nonce in CSP L3).
  // CSP is enforced in production where it matters for real user protection.
  if (!isDev) {
    res.setHeader('Content-Security-Policy', CSP_DIRECTIVES);
  }

  // ── MIME sniffing ─────────────────────────────────────────────────────────
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // ── Clickjacking ──────────────────────────────────────────────────────────
  // Same-origin allows our own iframes (embedded maps, reCAPTCHA handled by CSP)
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');

  // ── Referrer control ──────────────────────────────────────────────────────
  // strict-origin-when-cross-origin: sends full path within petwash.co.il,
  // only the origin to external sites — required for Google OAuth redirects.
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // ── Adobe Flash / PDF cross-domain ───────────────────────────────────────
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');

  // ── Cross-Origin isolation ────────────────────────────────────────────────
  // COEP: credentialless allows cross-origin assets without CORS headers
  res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
  // COOP: same-origin-allow-popups lets signInWithPopup (Google/Apple/Facebook)
  // post messages from the OAuth popup back to this page.
  // 'same-origin' would silently block popup → message channel → blank auth.
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  // RELAXED: cross-origin needed for Replit domain verification + CDN assets
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

  // ── Permissions Policy ────────────────────────────────────────────────────
  // camera/geolocation/payment allowed for self (Maps "use my location" + checkout)
  // FLoC / Topics API opt-out included (interest-cohort, browsing-topics)
  res.setHeader(
    'Permissions-Policy',
    [
      'camera=(self)',
      'microphone=()',
      'geolocation=(self)',
      'payment=(self)',
      'interest-cohort=()',       // FLoC opt-out (older Chrome)
      'browsing-topics=()',       // Topics API opt-out (Chrome 115+)
      'private-state-token-issuance=()',
      'private-state-token-redemption=()',
    ].join(', ')
  );

  next();
}
