/**
 * CSRF Protection for WebAuthn Registration Endpoints
 * Prevents cross-site request forgery attacks during passkey registration
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { logger } from '../lib/logger';

/**
 * Generate a CSRF token for WebAuthn operations
 */
export function generateWebAuthnCsrfToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * Set CSRF token for WebAuthn operations
 * This middleware should be applied before registration endpoints
 */
export function setWebAuthnCsrfToken(req: Request, res: Response, next: NextFunction) {
  // Only generate token for authenticated users
  if (!req.cookies?.pw_session) {
    return next();
  }
  
  // Generate or reuse existing token
  if (!req.session.webauthnCsrfToken) {
    req.session.webauthnCsrfToken = generateWebAuthnCsrfToken();
  }
  
  // Set in response header for client to read
  res.setHeader('X-WebAuthn-CSRF-Token', req.session.webauthnCsrfToken);
  
  next();
}

/**
 * Verify CSRF token for WebAuthn registration
 * Protects against CSRF attacks during passkey registration
 */
export function verifyWebAuthnCsrfToken(req: Request, res: Response, next: NextFunction) {
  const tokenFromHeader = req.headers['x-webauthn-csrf-token'] as string;
  const tokenFromBody = req.body?.csrfToken;
  const sessionToken = req.session.webauthnCsrfToken;
  
  const providedToken = tokenFromHeader || tokenFromBody;
  
  if (!sessionToken) {
    logger.warn('[WebAuthn CSRF] No CSRF token in session', {
      path: req.path,
      ip: req.ip
    });
    return res.status(403).json({
      error: 'CSRF token missing from session',
      error_en: 'Security token missing. Please refresh the page and try again.',
      error_he: 'אסימון אבטחה חסר. אנא רענן את הדף ונסה שוב.'
    });
  }
  
  if (!providedToken) {
    logger.warn('[WebAuthn CSRF] No CSRF token provided', {
      path: req.path,
      ip: req.ip
    });
    return res.status(403).json({
      error: 'CSRF token missing from request',
      error_en: 'Security token missing. Please try again.',
      error_he: 'אסימון אבטחה חסר. אנא נסה שוב.'
    });
  }
  
  // Constant-time comparison to prevent timing attacks
  if (!crypto.timingSafeEqual(
    Buffer.from(providedToken),
    Buffer.from(sessionToken)
  )) {
    logger.warn('[WebAuthn CSRF] Invalid CSRF token', {
      path: req.path,
      ip: req.ip
    });
    return res.status(403).json({
      error: 'Invalid CSRF token',
      error_en: 'Security token invalid. Please refresh the page and try again.',
      error_he: 'אסימון אבטחה לא חוקי. אנא רענן את הדף ונסה שוב.'
    });
  }
  
  logger.debug('[WebAuthn CSRF] Token verified successfully', {
    path: req.path
  });
  
  next();
}

/**
 * Clear CSRF token after successful operation
 */
export function clearWebAuthnCsrfToken(req: Request) {
  delete req.session.webauthnCsrfToken;
}

/**
 * Combined middleware: Set token for GET requests, verify for POST requests
 */
export function webauthnCsrfProtection(req: Request, res: Response, next: NextFunction) {
  if (req.method === 'GET' || req.method === 'OPTIONS') {
    return setWebAuthnCsrfToken(req, res, next);
  }
  
  if (req.method === 'POST' && req.path.includes('/register')) {
    return verifyWebAuthnCsrfToken(req, res, next);
  }
  
  // For other methods/paths, just continue
  next();
}
