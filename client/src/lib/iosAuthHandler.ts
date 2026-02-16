/**
 * iOS Safari Auth Handler
 * 
 * Handles authentication on iOS/iPad Safari where popup auth fails
 * Uses redirect-based auth instead of popup for better compatibility
 * 
 * Based on Fortune 500 best practices for cross-platform auth
 */

import { 
  signInWithRedirect, 
  signInWithPopup,
  getRedirectResult,
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
 * Detects if running on any iOS device (for broader compatibility)
 */
export function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
         (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
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
  try {
    // Determine best method
    const useRedirect = preferredMethod === 'redirect' || 
                       (preferredMethod !== 'popup' && (isIOSSafari() || isIOS()));
    
    if (useRedirect) {
      console.log('[iOS Auth] Using redirect-based sign-in for iOS Safari compatibility');
      await signInWithRedirect(auth, provider);
      // Redirect will navigate away, result handled by getRedirectResult
      return null;
    } else {
      console.log('[Auth] Using popup-based sign-in');
      return await signInWithPopup(auth, provider);
    }
  } catch (error) {
    console.error('[Auth] Sign-in failed:', error);
    throw error;
  }
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
    shouldUseRedirect: isIOSSafari() || isIOS(),
  };
}
