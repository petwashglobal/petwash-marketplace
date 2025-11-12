/**
 * Pet Wash™ — Auth Guardian 2025
 * 
 * Hardens Firebase Auth across iOS/Android mobile browsers with:
 * - Config validation for production deployments
 * - Google Sign-in normalization with popup→redirect fallback
 * - Custom claims refresh on auth state changes
 * - Admin route protection with clear UX messages
 * - Telemetry for auth events monitoring
 * 
 * Integration: This module auto-initializes on import (no setup needed)
 * For admin routes: import { routeGuard } from '@/lib/auth-guardian-2025'
 */

import { auth, app } from '@/lib/firebase';
import { 
  signInWithPopup, 
  signInWithRedirect, 
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged
} from 'firebase/auth';
import { logger } from '@/lib/logger';

// Configuration
const EXPECTED = {
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'signinpetwash',
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'signinpetwash.firebaseapp.com',
  adminEmails: [
    'nirhadad1@gmail.com',
    'nir.h@petwash.co.il',
    'ceo@petwash.co.il'
  ],
  telemetryEndpoint: '/api/telemetry/auth',
  platformName: 'Pet Wash™',
};

/**
 * Lightweight UI banner for auth feedback
 */
class AuthBanner {
  private el: HTMLDivElement | null = null;

  private ensure(): HTMLDivElement {
    if (this.el) return this.el;
    
    this.el = document.createElement('div');
    this.el.style.cssText = `
      position:fixed;z-index:2147483647;inset:auto 12px 12px 12px;
      background:linear-gradient(135deg,#0b65ff,#7b61ff);
      color:#fff;padding:14px 16px;border-radius:12px;
      font:600 14px/1.35 ui-sans-serif,system-ui,Segoe UI,Roboto,Helvetica,Arial;
      box-shadow:0 14px 40px rgba(0,0,0,.22);
      display:none;gap:8px;align-items:center
    `;
    
    const btn = document.createElement('button');
    btn.textContent = 'OK';
    btn.style.cssText = `
      margin-left:auto;background:#fff;color:#1a1f36;border:0;border-radius:10px;
      padding:8px 12px;font-weight:700;cursor:pointer
    `;
    btn.onclick = () => { if (this.el) this.el.style.display = 'none'; };
    
    this.el.appendChild(btn);
    document.body.appendChild(this.el);
    
    return this.el;
  }

  show(msg: string): void {
    const box = this.ensure();
    const existingText = box.querySelector('span');
    if (existingText) {
      existingText.textContent = msg;
    } else {
      const span = document.createElement('span');
      span.textContent = msg;
      box.insertBefore(span, box.lastChild);
    }
    box.style.display = 'flex';
  }
}

const banner = new AuthBanner();

/**
 * Send telemetry beacon (fire-and-forget)
 */
function beacon(event: string, detail: unknown): void {
  try {
    const payload = JSON.stringify({
      ts: new Date().toISOString(),
      event,
      detail,
      ua: navigator.userAgent,
      url: location.href,
    });
    
    if (navigator.sendBeacon) {
      navigator.sendBeacon(
        EXPECTED.telemetryEndpoint, 
        new Blob([payload], { type: 'application/json' })
      );
    } else {
      fetch(EXPECTED.telemetryEndpoint, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: payload, 
        keepalive: true 
      }).catch(() => {/* ignore */});
    }
  } catch {
    // Silently fail - telemetry is optional
  }
}

/**
 * Map Firebase auth errors to friendly user messages
 */
function friendlyAuthError(codeOrMsg: string): string {
  const errorMap: Record<string, string> = {
    'auth/popup-closed-by-user': 'Sign-in was cancelled. Please try again.',
    'auth/cancelled-popup-request': 'Another sign-in is already in progress.',
    'auth/popup-blocked': 'Your browser blocked the sign-in window. Please allow popups and try again.',
    'auth/network-request-failed': 'Network issue. Check your connection and try again.',
    'auth/invalid-credential': 'Your session expired. Please sign in again.',
    'auth/unauthorized-domain': 'Domain is not authorized for sign-in. Ask support to add this domain.',
    'auth/internal-error': 'We had a hiccup. Please try again in a moment.',
  };
  
  const matchedKey = Object.keys(errorMap).find(k => codeOrMsg.includes(k));
  return matchedKey ? errorMap[matchedKey] : 'Sign-in failed. Please try again.';
}

/**
 * Normalized Google Sign-In with automatic popup→redirect fallback
 * Handles iOS Safari popup blocking gracefully
 */
export async function signInWithGoogle(): Promise<void> {
  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    
    // Try popup first (better UX)
    try {
      const result = await signInWithPopup(auth, provider);
      await refreshClaims();
      beacon('auth.signin_google_popup_ok', { uid: result.user.uid });
      logger.info('[Auth Guardian] Google sign-in successful (popup)', { uid: result.user.uid });
    } catch (popupError: any) {
      // If popup blocked/closed, fallback to redirect
      const errorCode = popupError?.code || '';
      if (/popup|blocked|by-user|cancelled|operation-not-supported/i.test(errorCode)) {
        logger.info('[Auth Guardian] Popup blocked, falling back to redirect', { reason: errorCode });
        beacon('auth.signin_google_popup_fallback_redirect', { reason: errorCode });
        await signInWithRedirect(auth, provider);
        return; // Flow continues after redirect
      }
      throw popupError;
    }
  } catch (error: any) {
    const errorMsg = friendlyAuthError(String(error?.code || error?.message || error));
    banner.show(errorMsg);
    beacon('auth.signin_google_error', { error: String(error?.code || error?.message || error) });
    logger.error('[Auth Guardian] Google sign-in failed', error);
    throw error;
  }
}

/**
 * Force-refresh ID token to get latest custom claims (admin status, etc.)
 */
async function refreshClaims(): Promise<void> {
  try {
    const user = auth.currentUser;
    if (!user) return;
    
    const tokenResult = await user.getIdTokenResult(true);
    const isAdmin = Boolean(
      tokenResult.claims?.admin || 
      EXPECTED.adminEmails.includes(user.email || '')
    );
    
    // Store admin status globally for easy access
    (window as any).__PW_IS_ADMIN__ = isAdmin;
    
    beacon('auth.token_refreshed', { uid: user.uid, isAdmin });
    logger.info('[Auth Guardian] Token refreshed', { uid: user.uid, isAdmin });
    
    // Warn if user on admin page without admin claims
    const path = location.pathname.toLowerCase();
    if (path.includes('/admin') && !isAdmin) {
      banner.show(
        'Login succeeded, but your account has no admin access yet. ' +
        'Ask an administrator to grant access, then sign out and back in.'
      );
    }
  } catch (error: any) {
    beacon('auth.claims_refresh_error', { 
      error: String(error?.code || error?.message || error) 
    });
    logger.error('[Auth Guardian] Failed to refresh claims', error);
  }
}

/**
 * Route guard for protecting admin-only pages
 */
export async function routeGuard(opts: { 
  adminOnly?: boolean; 
  onDeny?: () => void 
} = {}): Promise<boolean> {
  const user = auth.currentUser;
  
  if (!user) {
    banner.show('Please sign in to continue.');
    beacon('auth.route_guard_no_user', { path: location.pathname });
    opts.onDeny?.();
    return false;
  }
  
  if (opts.adminOnly) {
    const tokenResult = await user.getIdTokenResult(true);
    const isAdmin = Boolean(
      tokenResult.claims?.admin || 
      EXPECTED.adminEmails.includes(user.email || '')
    );
    
    if (!isAdmin) {
      banner.show('This section is restricted to administrators.');
      beacon('auth.route_guard_not_admin', { 
        path: location.pathname, 
        uid: user.uid 
      });
      opts.onDeny?.();
      return false;
    }
  }
  
  return true;
}

/**
 * Initialize Auth Guardian
 */
async function init(): Promise<void> {
  try {
    // Validate Firebase config in production
    const opts = (app as any).options || {};
    const isProd = location.hostname.endsWith('.co.il') || location.hostname.endsWith('.com');
    
    if (isProd) {
      const mismatch =
        opts.projectId !== EXPECTED.projectId ||
        opts.appId !== EXPECTED.appId ||
        opts.apiKey !== EXPECTED.apiKey;
      
      if (mismatch) {
        const msg = `${EXPECTED.platformName}: configuration mismatch detected. Expected "${EXPECTED.projectId}" but got "${opts.projectId}". Sign-in may show wrong branding.`;
        logger.warn('[Auth Guardian] Config mismatch', { actual: opts, expected: EXPECTED });
        banner.show('Security check in progress… Please refresh in a moment.');
        beacon('auth.config_mismatch', { actual: opts, expected: EXPECTED });
      }
    }
    
    // Handle post-redirect result (if any)
    getRedirectResult(auth).catch((error: any) => {
      const errorMsg = friendlyAuthError(String(error?.code || error?.message || error));
      banner.show(errorMsg);
      beacon('auth.redirect_result_error', { 
        error: String(error?.code || error?.message || error) 
      });
      logger.error('[Auth Guardian] Redirect result error', error);
    });
    
    // Auto-refresh claims on auth state changes
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        await refreshClaims();
      }
    });
    
    logger.info('[Auth Guardian] Initialized successfully');
    beacon('auth.guardian_initialized', { 
      projectId: opts.projectId,
      environment: import.meta.env.MODE 
    });
    
  } catch (error: any) {
    logger.error('[Auth Guardian] Initialization failed', error);
    beacon('auth.guardian_init_failed', { 
      error: String(error?.message || error) 
    });
  }
}

// Auto-initialize on import
init();

// Expose helpers globally for UI components
if (typeof window !== 'undefined') {
  (window as any).PW_Auth = {
    signInWithGoogle,
    routeGuard,
    refreshClaims,
  };
}

export { refreshClaims };
