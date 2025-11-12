/**
 * CSRF Protection Middleware
 * Protects state-changing operations from Cross-Site Request Forgery attacks
 */

import { Request, Response, NextFunction } from 'express';
import { randomBytes } from 'crypto';

// Generate CSRF token
export function generateCsrfToken(): string {
  return randomBytes(32).toString('hex');
}

// Middleware to set CSRF token in session and cookie
export function setCsrfToken(req: Request, res: Response, next: NextFunction) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = generateCsrfToken();
  }
  
  // Set token in cookie for client-side access (SameSite=Strict for CSRF protection)
  res.cookie('XSRF-TOKEN', req.session.csrfToken, {
    httpOnly: false, // Client needs to read this
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  });
  
  next();
}

// Middleware to verify CSRF token
export function verifyCsrfToken(req: Request, res: Response, next: NextFunction) {
  // Skip CSRF check for GET, HEAD, OPTIONS
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }
  
  // Skip for API endpoints using Firebase auth (different protection mechanism)
  if (req.path.startsWith('/api/auth/') || req.path.startsWith('/api/webhook/')) {
    return next();
  }
  
  const tokenFromHeader = req.headers['x-csrf-token'] || req.headers['x-xsrf-token'];
  const tokenFromBody = req.body?._csrf;
  const sessionToken = req.session.csrfToken;
  
  const providedToken = tokenFromHeader || tokenFromBody;
  
  if (!sessionToken) {
    return res.status(403).json({ 
      error: 'CSRF token missing from session' 
    });
  }
  
  if (!providedToken) {
    return res.status(403).json({ 
      error: 'CSRF token missing from request' 
    });
  }
  
  if (providedToken !== sessionToken) {
    return res.status(403).json({ 
      error: 'Invalid CSRF token' 
    });
  }
  
  next();
}

// Endpoint to get CSRF token
export function csrfTokenEndpoint(req: Request, res: Response) {
  res.json({ csrfToken: req.session.csrfToken });
}
