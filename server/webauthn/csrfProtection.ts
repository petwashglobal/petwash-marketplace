/**
 * CSRF Protection for WebAuthn Registration Endpoints
 * Prevents cross-site request forgery attacks during passkey registration
 */

import { Request, Response, NextFunction } from 'express';
import session from 'express-session';
import crypto from 'crypto';
import { logger } from '../lib/logger';

// Extend Request to include sessionStore from express-session
interface SessionRequest extends Request {
  sessionStore: session.Store;
}

/**
 * Generate a CSRF token for WebAuthn operations
 */
export function generateWebAuthnCsrfToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * Ensure WebAuthn session exists (bootstrap anonymous session for unauthenticated flows)
 * SECURITY: Forces express-session to persist for CSRF token storage
 * Works with saveUninitialized: false by writing to session to trigger persistence
 */
export function ensureWebAuthnSession(req: Request, res: Response, next: NextFunction) {
  const sessionReq = req as SessionRequest;
  
  // If session doesn't exist, generate one using sessionStore
  if (!req.session) {
    logger.warn('[WebAuthn Session] No session found, generating new session...');
    
    if (!sessionReq.sessionStore) {
      logger.error('[WebAuthn Session] Session store not available');
      return res.status(500).json({
        error: 'Session store not configured',
        error_en: 'Server configuration error. Please contact support.',
        error_he: 'שגיאת הגדרות שרת. אנא צור קשר עם התמיכה.'
      });
    }
    
    // Generate new session using sessionStore
    sessionReq.sessionStore.generate(sessionReq);
    req.session.webauthnInitialized = true;
    logger.info('[WebAuthn Session] New session generated and bootstrapped');
    next();
  } else {
    // Session exists, just ensure it's initialized for WebAuthn
    if (!req.session.webauthnInitialized) {
      req.session.webauthnInitialized = true;
      logger.debug('[WebAuthn Session] Session bootstrapped for WebAuthn flow');
    }
    next();
  }
}

/**
 * Set CSRF token for WebAuthn operations
 * This middleware should be applied before registration/authentication endpoints
 * SECURITY FIX: Works with anonymous sessions (pre-login) so passkey authentication works
 * NOTE: Requires ensureWebAuthnSession to run first
 */
export function setWebAuthnCsrfToken(req: Request, res: Response, next: NextFunction) {
  // Session should exist (ensured by ensureWebAuthnSession middleware)
  if (!req.session) {
    logger.error('[WebAuthn CSRF] No session - ensureWebAuthnSession middleware not applied');
    return res.status(500).json({
      error: 'Session required',
      error_en: 'Session initialization failed. Please refresh the page.',
      error_he: 'אתחול ההפעלה נכשל. אנא רענן את הדף.'
    });
  }
  
  // Generate or reuse existing token (bound to session, not pw_session cookie)
  if (!req.session.webauthnCsrfToken) {
    req.session.webauthnCsrfToken = generateWebAuthnCsrfToken();
    logger.debug('[WebAuthn CSRF] New token generated');
  } else {
    logger.debug('[WebAuthn CSRF] Reusing existing token');
  }
  
  // Set in response header for client to read
  res.setHeader('X-WebAuthn-CSRF-Token', req.session.webauthnCsrfToken);
  
  logger.debug('[WebAuthn CSRF] Token issued', {
    path: req.path,
    hasSession: !!req.session,
    hasPwSession: !!req.cookies?.pw_session
  });
  
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
  // SECURITY: Check lengths match before comparison to prevent RangeError DoS
  if (providedToken.length !== sessionToken.length) {
    logger.warn('[WebAuthn CSRF] Token length mismatch', {
      path: req.path,
      ip: req.ip
    });
    return res.status(403).json({
      error: 'Invalid CSRF token',
      error_en: 'Security token invalid. Please refresh the page and try again.',
      error_he: 'אסימון אבטחה לא חוקי. אנא רענן את הדף ונסה שוב.'
    });
  }
  
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
  
  // SECURITY: Clear token after successful verification to prevent replay attacks
  clearWebAuthnCsrfToken(req);
  
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
