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
    // reCAPTCHA — google.com is the primary loader; recaptcha.net is used in
    // regions where google.com is blocked or when Google routes through it.
    // Both must be present or the widget silently fails with fail-closed active.
    "https://www.google.com/recaptcha/",
    "https://www.gstatic.com/recaptcha/",
    "https://www.recaptcha.net",
    // Twilio
    "https://media.twiliocdn.com",
    // Sentry
    "https://js.sentry-cdn.com",
    // HubSpot tracking & forms
    "https://js.hs-scripts.com",
    "https://js.hubspot.com",
    "https://js.hs-analytics.net",
    "https://forms.hubspot.com",
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
    "https://cdn.jsdelivr.net",
    "data:",
    replitHosts,
  ].filter(Boolean).join(" "),

  // Images — specific allowlist. No wildcard (*) — that defeats CSP protection.
  // Provider/pet photos must be stored in Firebase Storage or GCS.
  [
    "img-src",
    "'self'",
    "data:",                                // Base64 inline previews (profile photo upload)
    "blob:",                                // Camera/canvas blobs
    "https://maps.googleapis.com",          // Google Maps tiles
    "https://maps.gstatic.com",             // Maps static assets
    "https://lh3.googleusercontent.com",    // Google profile photos
    "https://lh4.googleusercontent.com",    // Google profile photos (alternate shard)
    "https://lh5.googleusercontent.com",
    "https://lh6.googleusercontent.com",
    "https://storage.googleapis.com",       // GCS buckets
    "https://firebasestorage.googleapis.com", // Firebase Storage
    "https://www.google.com",               // reCAPTCHA iframe badge
    "https://www.gstatic.com",              // Google static assets
    "https://avatars.githubusercontent.com", // Dev/GitHub avatars
    replitHosts,
  ].filter(Boolean).join(" "),

  // Fetch / XHR — only our own backend + external APIs used by the client
  [
    "connect-src",
    "'self'",
    // Firebase (incl. *.firebaseapp.com — the Auth handler domain. Missing it
    // silently broke Google sign-in on Cloud Run-served HTML; fixed 2026-06-13.)
    "https://*.googleapis.com",
    "https://*.firebaseio.com",
    "https://*.firebase.com",
    "https://*.firebaseapp.com",
    "wss://*.firebaseio.com",
    "https://petwash.co.il",
    "https://www.petwash.co.il",
    // Google Places / Maps
    "https://places.googleapis.com",
    "https://maps.googleapis.com",
    // reCAPTCHA connect (mirrors script-src — recaptcha.net for non-google regions)
    "https://www.recaptcha.net",
    // Gemini AI (client-side SDK)
    "https://generativelanguage.googleapis.com",
    // SendGrid click-tracking pixel
    "https://click.petwash.co.il",
    // Sentry
    "https://*.sentry.io",
    "https://*.ingest.sentry.io",
    // Twilio
    "https://media.twiliocdn.com",
    // HubSpot analytics, forms, conversations
    "https://*.hubspot.com",
    "https://*.hubapi.com",
    "https://track.hubspot.com",
    "https://forms.hubspot.com",
    // Dev
    replitHosts,
    isDev ? "ws://localhost:*" : "",
    isDev ? "wss://localhost:*" : "",
  ].filter(Boolean).join(" "),

  // Frames — Google reCAPTCHA + Firebase/Google auth. Without
  // accounts.google.com + *.firebaseapp.com the signInWithPopup / __/auth
  // iframe is silently blocked by CSP → "click does nothing". Matches the
  // working firebase.json hosting policy (fixed 2026-06-13).
  [
    "frame-src",
    "'self'",
    "https://www.google.com/recaptcha/",
    "https://recaptcha.google.com/",
    "https://accounts.google.com",
    "https://*.firebaseapp.com",
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

  // ── DNS prefetch control ─────────────────────────────────────────────────
  // Prevents browser from pre-resolving hostnames embedded in page content,
  // which can leak visited URLs to third-party DNS resolvers.
  res.setHeader('X-DNS-Prefetch-Control', 'off');

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
