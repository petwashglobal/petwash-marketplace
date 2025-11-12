/**
 * Additional Security Headers Middleware
 * Enhances security beyond Helmet defaults
 */

import { Request, Response, NextFunction } from 'express';

export function enhancedSecurityHeaders(req: Request, res: Response, next: NextFunction) {
  // Strict-Transport-Security (HSTS)
  // Force HTTPS for 1 year, include subdomains
  res.setHeader(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains; preload'
  );
  
  // X-Frame-Options
  // Prevent clickjacking attacks
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  
  // X-Content-Type-Options
  // Prevent MIME sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Referrer-Policy
  // Control referrer information (relaxed for domain verification)
  res.setHeader('Referrer-Policy', 'no-referrer');
  
  // X-Permitted-Cross-Domain-Policies
  // Restrict Adobe Flash and PDF cross-domain requests
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  
  // Cross-Origin-Embedder-Policy
  // Prevent documents from loading cross-origin resources
  res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
  
  // Cross-Origin-Opener-Policy
  // Isolate browsing context
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  
  // Cross-Origin-Resource-Policy
  // RELAXED: Allow cross-origin for Replit domain verification and CDN assets
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  
  next();
}
