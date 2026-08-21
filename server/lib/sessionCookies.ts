import { Request, Response } from 'express';
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

const APEX_DOMAIN = 'petwash.co.il';
const APEX_DOMAIN_SUFFIX = '.' + APEX_DOMAIN;

// Extract the caller's Host header (strip any :port). Trusts the last
// forwarded Host over the raw Host header — Cloud Run / Firebase Hosting
// terminates TLS in front of us, so req.hostname reflects the visible host
// after Express applies the proxy trust config we already set in index.ts.
function requestHost(req: Request | undefined | null): string | undefined {
  if (!req) return undefined;
  const raw = (req.hostname || req.headers?.host || '').toString();
  if (!raw) return undefined;
  const host = raw.split(':')[0].trim().toLowerCase();
  return host || undefined;
}

// Return the cookie Domain that the browser will actually accept for THIS
// request. Sending Domain=.petwash.co.il on a request that arrived at
// staging.a.run.app / *.web.app / localhost / preview-*.petwashglobal.dev
// makes the browser silently DROP the cookie (RFC 6265 §5.3.6 "reject
// cookies whose Domain attribute is not a suffix of the request host"),
// so /api/session/whoami then 401s and the user is "signed in but kicked
// out on every reload". Only send Domain when the request host actually
// ends in .petwash.co.il (or IS petwash.co.il itself); otherwise omit
// Domain so the browser scopes the cookie to the exact host.
//
// Dev remains undefined so the cookie binds to the exact localhost host.
// This function must return the SAME value from setSessionCookie and
// clearSessionCookie for a given request — the browser will not clear a
// cookie whose Domain (or lack of one) does not match what was set.
const resolveCookieDomain = (req?: Request | null): string | undefined => {
  if (process.env.NODE_ENV === 'development') return undefined;
  const host = requestHost(req);
  if (!host) return undefined; // no host header → host-only cookie is safest
  if (host === APEX_DOMAIN || host.endsWith(APEX_DOMAIN_SUFFIX)) {
    return APEX_DOMAIN_SUFFIX;
  }
  // Cloud Run *.a.run.app / *.web.app / preview / staging / anywhere else —
  // Domain=.petwash.co.il would be rejected; omit Domain so the cookie is
  // bound to the exact host and actually reaches the client.
  return undefined;
};

// Back-compat alias used by unit tests / older callers that didn't pass req.
// Prefer resolveCookieDomain(req).
const getCookieDomain = (): string | undefined => {
  if (process.env.NODE_ENV === 'development') return undefined;
  return APEX_DOMAIN_SUFFIX;
};

export async function createSessionCookie(idToken: string, res: Response, req?: Request): Promise<void> {
  try {
    logger.debug('[SessionCookies] Starting session cookie creation');
    
    logger.debug('[SessionCookies] Calling Firebase Admin createSessionCookie', { 
      expiresInMs: COOKIE_MAX_AGE,
      idTokenLength: idToken.length
    });
    
    const sessionCookie = await firebaseAdmin.auth().createSessionCookie(idToken, { 
      expiresIn: COOKIE_MAX_AGE 
    });
    logger.debug('[SessionCookies] Session cookie created successfully');

    setSessionCookie(res, sessionCookie, req);

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

export function setSessionCookie(res: Response, sessionCookie: string, req?: Request) {
  const cookieDomain = resolveCookieDomain(req);
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  // CRITICAL FIX: Multi-domain cookie (petwash.co.il + www.petwash.co.il)
  // domain: '.petwash.co.il' = Works on both apex and www subdomain
  // sameSite: 'none' = Required for cross-domain with Secure flag
  // httpOnly: Prevents XSS attacks (no JavaScript access)
  // secure: HTTPS-only in production (required for sameSite: 'none')
  const cookieOptions: any = {
    httpOnly: true,
    secure: !isDevelopment,    // true in production, false in development
    // BUGFIX 2026-06-19: was 'none'. The API is SAME-SITE (petwash.co.il/api/*),
    // so pw_session is a FIRST-PARTY cookie → must be 'lax'. SameSite=None marks
    // it cross-site; iOS Safari ITP then drops/partitions it, so after Google
    // sign-in the cookie wasn't sent on /api/session/whoami → HTTP 401 "session
    // cookie not accepted". Lax is sent same-site AND on the top-level GET return
    // from the OAuth redirect, so login completes. (Native apps use Bearer, not
    // this cookie — no cross-site need.)
    sameSite: 'lax',
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

export function clearSessionCookie(res: Response, req?: Request) {
  // MUST resolve Domain the SAME way setSessionCookie did for this request,
  // or the browser will refuse to clear the cookie (RFC 6265: a Set-Cookie
  // whose Domain does not match the original cookie's Domain does not
  // overwrite it → the cookie survives logout). See resolveCookieDomain().
  const cookieDomain = resolveCookieDomain(req);
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
