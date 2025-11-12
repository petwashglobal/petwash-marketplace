import { Response } from 'express';
import firebaseAdmin from './firebase-admin';
import { logger } from './logger';

// Mobile-compatible session cookie name (matches production requirements)
const SESSION_COOKIE_NAME = 'pw_session';
const COOKIE_MAX_AGE = 432000000; // 5 days in milliseconds (432,000,000ms)

// Environment-based cookie domain configuration
const getCookieDomain = (): string | undefined => {
  // In development, don't set a domain (cookies will be set for the exact host)
  if (process.env.NODE_ENV === 'development') {
    return undefined;
  }
  // In production, use .petwash.co.il to cover root + www
  return '.petwash.co.il';
};

export async function createSessionCookie(idToken: string, res: Response): Promise<void> {
  try {
    logger.debug('[SessionCookies] Starting session cookie creation');
    
    logger.debug('[SessionCookies] Calling Firebase Admin createSessionCookie', { 
      expiresInMs: COOKIE_MAX_AGE,
      idTokenPrefix: idToken.substring(0, 20) + '...'
    });
    
    const sessionCookie = await firebaseAdmin.auth().createSessionCookie(idToken, { 
      expiresIn: COOKIE_MAX_AGE 
    });
    logger.debug('[SessionCookies] Session cookie created successfully');
    
    setSessionCookie(res, sessionCookie);
    
    logger.info('[SessionCookies] Session cookie set successfully');
  } catch (error: any) {
    // Check if this is an expected Firebase auth error (invalid ID token)
    const isAuthError = error?.code?.startsWith('auth/') || error?.message?.includes('ID token');
    
    if (isAuthError) {
      logger.warn('[SessionCookies] Invalid ID token provided (client error)', {
        errorMessage: error.message,
        errorCode: error.code
      });
    } else {
      logger.error('[SessionCookies] Failed to create session cookie (server error)', {
        errorMessage: error.message,
        errorCode: error.code,
        errorType: error.constructor?.name,
        stack: error.stack
      });
    }
    throw error;
  }
}

export function setSessionCookie(res: Response, sessionCookie: string) {
  const cookieDomain = getCookieDomain();
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  // CRITICAL FIX: Multi-domain cookie (petwash.co.il + www.petwash.co.il)
  // domain: '.petwash.co.il' = Works on both apex and www subdomain
  // sameSite: 'none' = Required for cross-domain with Secure flag
  // httpOnly: Prevents XSS attacks (no JavaScript access)
  // secure: HTTPS-only in production (required for sameSite: 'none')
  const cookieOptions: any = {
    httpOnly: true,
    secure: !isDevelopment,    // true in production, false in development
    sameSite: isDevelopment ? 'lax' : 'none',  // 'none' in production for cross-domain, 'lax' in dev
    path: '/',
    maxAge: COOKIE_MAX_AGE,
    domain: cookieDomain  // .petwash.co.il in production, undefined in dev
  }
  
  res.cookie(SESSION_COOKIE_NAME, sessionCookie, cookieOptions);
  
  logger.debug('[SessionCookies] Session cookie set (multi-domain)', {
    name: SESSION_COOKIE_NAME,
    domain: cookieDomain || '(host-only)',
    maxAge: COOKIE_MAX_AGE,
    environment: process.env.NODE_ENV,
    attributes: `HttpOnly; Secure=${!isDevelopment}; SameSite=${cookieOptions.sameSite}`
  });
}

export function clearSessionCookie(res: Response) {
  const cookieDomain = getCookieDomain();
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  // Clear cookie with matching configuration (must match setSessionCookie exactly)
  const clearOptions: any = {
    httpOnly: true,
    secure: !isDevelopment,
    sameSite: isDevelopment ? 'lax' : 'none',  // Must match the set configuration
    path: '/',
    domain: cookieDomain  // Must match domain from setSessionCookie
  };
  
  res.clearCookie(SESSION_COOKIE_NAME, clearOptions);
}

export async function verifySessionCookie(
  cookie: string | undefined,
  checkRevoked: boolean = false
): Promise<any> {
  if (!cookie) {
    throw new Error('No session cookie provided');
  }

  try {
    const decodedClaims = await firebaseAdmin
      .auth()
      .verifySessionCookie(cookie, checkRevoked);
    
    return decodedClaims;
  } catch (error) {
    logger.error('Session cookie verification failed:', error);
    throw error;
  }
}

export { SESSION_COOKIE_NAME };
