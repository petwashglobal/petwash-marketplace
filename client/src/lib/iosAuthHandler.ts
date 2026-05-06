/**
 * iOS Safari Auth Handler
 * 
 * Handles authentication on iOS/iPad Safari where popup auth fails
 * Uses redirect-based auth instead of popup for better compatibility
 * 
 * Based on Fortune 500 best practices for cross-platform auth
 */

import { 
  signInWithPopup,
  signInWithRedirect,
  GoogleAuthProvider,
  FacebookAuthProvider,
  OAuthProvider,
  type Auth,
  type UserCredential,
  type AuthProvider
} from 'firebase/auth';

/**
 * Detects if the current browser is iOS Safari or iPad Safari
 */
export function isIOSSafari(): boolean {
  const ua = navigator.userAgent;
  const platform = navigator.platform;
  
  // iPad detection (including iPadOS 13+ which reports as Mac)
  const isIPad = /iPad|iPhone|iPod/.test(ua) || 
                 (platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  
  // Check if it's Safari (not Chrome or other browsers on iOS)
  const isSafari = /Safari/.test(ua) && !/Chrome|CriOS|FxiOS/.test(ua);
  
  return isIPad && isSafari;
}

/**
 * Detects if running on any iOS/iPadOS browser.
 *
 * iPadOS 13+ may report platform=MacIntel, so maxTouchPoints is required.
 * Chrome/Edge/Firefox on iOS still use WebKit under the hood and can suffer
 * the same popup/session-state problems as Safari.
 */
export function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
         (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/**
 * Returns true only for iPhone/iPod (not iPad).
 * Kept for compatibility, but auth routing now uses isIOS() because iPad and
 * Chrome iOS also lose popup/redirect state in production.
 */
export function isIPhone(): boolean {
  return /iPhone|iPod/.test(navigator.userAgent);
}

/**
 * Single canonical auth strategy resolver.
 *
 * iOS/iPadOS, including Safari, Chrome iOS and installed iOS web-app shells:
 *   redirect
 *
 * Everything else:
 *   popup
 *
 * Why redirect for all iOS:
 *   - iOS browsers are WebKit-based.
 *   - popup windows are commonly blocked, tiny, or lose Firebase state.
 *   - OAuth provider redirects are more stable for Google/Gmail signup and
 *     for post-login session creation on iPhone/iPad.
 *
 * IMPORTANT: The caller must call signInWithPopup() or signInWithRedirect()
 * as the very next statement after receiving the strategy. Avoid awaits in
 * between, or Safari may treat it as no longer user-initiated.
 */
export function getAuthStrategy(): 'popup' | 'redirect' {
  return isIOS() ? 'redirect' : 'popup';
}

/**
 * Enterprise-grade sign-in handler that automatically selects
 * the best auth method based on the platform
 * 
 * @param auth - Firebase Auth instance
 * @param provider - Auth provider (Google, Apple, etc.)
 * @param preferredMethod - Override to force popup or redirect
 * @returns Promise<UserCredential | null>
 */
export async function signInWithBestMethod(
  auth: Auth,
  provider: AuthProvider,
  preferredMethod?: 'popup' | 'redirect'
): Promise<UserCredential | null> {
  const method = preferredMethod || getAuthStrategy();

  if (method === 'redirect') {
    console.log('[Auth] iOS/mobile-safe redirect sign-in selected');
    await signInWithRedirect(auth, provider);
    return null; // Page will redirect; result handled by getRedirectResult in auth flow
  }

  console.log('[Auth] Desktop/Android popup sign-in selected');
  return await signInWithPopup(auth, provider);
}

/**
 * @deprecated — Redirect result is now handled exclusively by AuthProvider.tsx.
 * Do NOT call this function. It exists only for backward compatibility.
 */
export async function handleAuthRedirect(_auth: Auth): Promise<UserCredential | null> {
  console.warn('[Auth] handleAuthRedirect is deprecated — AuthProvider handles redirect results. This call is a no-op.');
  return null;
}

/**
 * Configure Google Auth Provider with best practices
 */
export function createGoogleProvider(): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  
  // Request additional scopes if needed
  provider.addScope('profile');
  provider.addScope('email');
  
  // Force account selection (best UX for multiple accounts)
  provider.setCustomParameters({
    prompt: 'select_account'
  });
  
  return provider;
}

/**
 * Configure Apple Auth Provider with best practices
 */
export function createAppleProvider(): OAuthProvider {
  const provider = new OAuthProvider('apple.com');
  
  provider.addScope('email');
  provider.addScope('name');
  
  return provider;
}

/**
 * Configure Facebook Auth Provider with best practices
 */
export function createFacebookProvider(): FacebookAuthProvider {
  const provider = new FacebookAuthProvider();
  
  provider.addScope('email');
  provider.addScope('public_profile');
  
  provider.setCustomParameters({
    display: 'popup',
  });
  
  return provider;
}

/**
 * Get user-friendly device info for debugging
 */
export function getDeviceInfo(): { 
  device: string; 
  browser: string; 
  os: string;
  isIOS: boolean;
  isIOSSafari: boolean;
  shouldUseRedirect: boolean;
} {
  const ua = navigator.userAgent;
  
  return {
    device: isIOS() ? 'iOS Device' : 'Other',
    browser: /Safari/.test(ua) && !/Chrome/.test(ua) ? 'Safari' : 'Other',
    os: /Mac/.test(navigator.platform) ? 'macOS/iOS' : 'Other',
    isIOS: isIOS(),
    isIOSSafari: isIOSSafari(),
    shouldUseRedirect: isIOS(),
  };
}
