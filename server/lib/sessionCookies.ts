import { Response } from 'express';
import firebaseAdmin from './firebase-admin';
import { logger } from './logger';

// Session cookie name. MUST be exactly `__session`: Firebase Hosting forwards ONLY a
// cookie named `__session` from the browser through its CDN to Cloud Run; any other name
// (we used `pw_session`) is stripped en route, so the backend never saw it → web login
// failed with HTTP 401 on /api/session/whoami. server/index.ts aliases the forwarded
// `__session` back onto `req.cookies.pw_session` so existing readers are unchanged.
// (Changed 'pw_session' → '__session' 2026-06-19.)
const SESSION_COOKIE_NAME = '__session';
// "Remember me" duration. 2026-06-18: raised 5d -> 14d, which is the MAXIMUM a
// Firebase session cookie allows (createSessionCookie hard-caps expiresIn at 14
// days). A true 30-day "stay signed in" requires silently re-minting the cookie on
// activity — a larger change tracked separately; 14 days is the longest single cookie.
const COOKIE_MAX_AGE = 1209600000; // 14 days in milliseconds (Firebase session-cookie max)

// PR-AUTH-SECURITY-9 (2026-08-17): "Remember me on this device" persistence.
//   ON  → 14 day persistent cookie (Firebase hard max)
//   OFF → SESSION cookie: browser drops it on tab close. Firebase Admin still
//         requires a positive cryptographic expiresIn, so we mint a short-lived
//         crypto cookie but DO NOT set a browser maxAge → the browser drops it
//         when the tab/window closes. No password is stored anywhere.
const REMEMBER_ME_MAX_AGE = COOKIE_MAX_AGE;
const SESSION_ONLY_MAX_AGE = 24 * 60 * 60 * 1000; // 1 day crypto only

// Environment-based cookie domain configuration
const getCookieDomain = (): string | undefined => {
  // In development, don't set a domain (cookies will be set for the exact host)
  if (process.env.NODE_ENV === 'development') {
    return undefined;
  }
  // In production, use .petwash.co.il to cover root + www
  return '.petwash.co.il';
};

export async function createSessionCookie(
  idToken: string,
  res: Response,
  opts?: { expiresInMs?: number; rememberMe?: boolean },
): Promise<void> {
  try {
    // PR-AUTH-SECURITY-9 semantics:
    //   rememberMe:true                              → persistent 14-day cookie
    //   rememberMe:false                             → SESSION cookie (no browser maxAge)
    //   rememberMe undefined + expiresInMs positive  → persistent (legacy path)
    //   rememberMe undefined + expiresInMs falsy     → persistent 14-day (default preserved)
    const requested = opts?.expiresInMs;
    const isSessionOnly = opts?.rememberMe === false;
    const persistentTargetMs = requested && requested > 0
      ? Math.min(requested, REMEMBER_ME_MAX_AGE)
      : REMEMBER_ME_MAX_AGE;
    const cryptoExpiresIn = isSessionOnly ? SESSION_ONLY_MAX_AGE : persistentTargetMs;
    const browserMaxAge = isSessionOnly ? undefined : persistentTargetMs;

    logger.debug('[SessionCookies] Starting session cookie creation', {
      isSessionOnly,
      cryptoExpiresIn,
      browserMaxAge: browserMaxAge ?? '(session)',
      idTokenPrefix: idToken.substring(0, 20) + '...',
    });

    const sessionCookie = await firebaseAdmin.auth().createSessionCookie(idToken, {
      expiresIn: cryptoExpiresIn,
    });
    logger.debug('[SessionCookies] Session cookie created successfully');

    setSessionCookie(res, sessionCookie, { maxAge: browserMaxAge });

    logger.info('[SessionCookies] Session cookie set successfully', {
      persistence: isSessionOnly ? 'session' : `${Math.round(persistentTargetMs / 86400000)}d`,
    });
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

export function setSessionCookie(
  res: Response,
  sessionCookie: string,
  opts?: { maxAge?: number },
) {
  const cookieDomain = getCookieDomain();
  const isDevelopment = process.env.NODE_ENV === 'development';

  // CRITICAL FIX: Multi-domain cookie (petwash.co.il + www.petwash.co.il)
  // domain: '.petwash.co.il' = Works on both apex and www subdomain
  // httpOnly: Prevents XSS attacks (no JavaScript access)
  // secure: HTTPS-only in production
  //
  // 2026-08-17 (PR-AUTH-SECURITY-9): opts.maxAge is honored so callers can
  // request a SESSION cookie (undefined maxAge → browser drops on tab close)
  // vs a persistent 14-day "remember me" cookie. Never stores a password.
  const cookieOptions: any = {
    httpOnly: true,
    secure: !isDevelopment,    // true in production, false in development
    // BUGFIX 2026-06-19: was 'none'. The API is SAME-SITE (petwash.co.il/api/*),
    // so __session is a FIRST-PARTY cookie → must be 'lax'. SameSite=None marks
    // it cross-site; iOS Safari ITP then drops/partitions it, so after Google
    // sign-in the cookie wasn't sent on /api/session/whoami → HTTP 401 "session
    // cookie not accepted". Lax is sent same-site AND on the top-level GET return
    // from the OAuth redirect, so login completes. (Native apps use Bearer, not
    // this cookie — no cross-site need.)
    sameSite: 'lax',
    path: '/',
    domain: cookieDomain  // .petwash.co.il in production, undefined in dev
  };
  const effectiveMaxAge = opts?.maxAge;
  if (typeof effectiveMaxAge === 'number' && effectiveMaxAge > 0) {
    cookieOptions.maxAge = effectiveMaxAge;
  } else if (opts === undefined) {
    // Legacy callers (no opts) — preserve prior 14-day persistent default.
    cookieOptions.maxAge = COOKIE_MAX_AGE;
  }
  // No maxAge key → Set-Cookie without Expires/Max-Age → SESSION cookie.

  res.cookie(SESSION_COOKIE_NAME, sessionCookie, cookieOptions);

  logger.debug('[SessionCookies] Session cookie set (multi-domain)', {
    name: SESSION_COOKIE_NAME,
    domain: cookieDomain || '(host-only)',
    maxAge: cookieOptions.maxAge ?? '(session)',
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
    sameSite: 'lax',  // Must match setSessionCookie (changed 'none' → 'lax' 2026-06-19)
    path: '/',
    domain: cookieDomain  // Must match domain from setSessionCookie
  };

  res.clearCookie(SESSION_COOKIE_NAME, clearOptions);
  // Also clear the legacy 'pw_session' cookie name (pre-2026-06-19) so a stale
  // copy in any browser can't shadow the new __session cookie after logout.
  res.clearCookie('pw_session', clearOptions);
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
