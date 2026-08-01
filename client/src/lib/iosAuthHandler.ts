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
  signInWithCredential,
  updateProfile,
  GoogleAuthProvider,
  FacebookAuthProvider,
  OAuthProvider,
  type Auth,
  type UserCredential,
  type AuthProvider
} from 'firebase/auth';
import { Capacitor } from '@capacitor/core';

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
 * True for ANY mobile browser (iOS AND Android AND touch-first small screens).
 *
 * Why this matters: mobile browsers (mobile Chrome on Android, mobile Safari)
 * routinely BLOCK signInWithPopup — the popup silently fails with
 * `auth/popup-blocked`, so the Google/Apple buttons appear to "do nothing".
 * Previously only iOS was routed to redirect, so every ANDROID phone got popup
 * → blocked → social signup broken on mobile. (CEO 2026-07-30) (2026-07-30)
 */
export function isMobileDevice(): boolean {
  if (isIOS()) return true;
  const ua = navigator.userAgent || '';
  if (/Android|webOS|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(ua)) return true;
  try {
    // Touch-first device with no fine pointer (Android tablets, etc.)
    if ((navigator.maxTouchPoints || 0) > 1 && window.matchMedia?.('(pointer: coarse)')?.matches) {
      return true;
    }
  } catch { /* matchMedia unavailable — fall through */ }
  return false;
}

/**
 * Single canonical auth strategy resolver.
 *
 * ALL mobile (iOS + Android + touch): redirect — popups are blocked on mobile.
 * Desktop: popup.
 *
 * IMPORTANT: The caller must call signInWithPopup() or signInWithRedirect()
 * as the very next statement after receiving the strategy. Avoid awaits in
 * between, or Safari may treat it as no longer user-initiated.
 */
export function getAuthStrategy(): 'popup' | 'redirect' {
  return isMobileDevice() ? 'redirect' : 'popup';
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
 * True only inside the native Capacitor iOS app (not Safari/web). Native
 * "Sign in with Apple" is required by App Store rule 4.8 when other social
 * sign-ins are offered; on web we keep the OAuth popup/redirect flow.
 */
export function isNativeApplePlatform(): boolean {
  try {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
  } catch {
    return false;
  }
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Native Sign in with Apple for the Capacitor iOS app, exchanged into Firebase.
 * Apple is sent SHA-256(nonce); Firebase is given the RAW nonce so it can verify
 * the identity token. Returns the same UserCredential shape as signInWithPopup,
 * so the caller's post-auth flow (session exchange, loyalty, consent) is identical.
 *
 * The native sheet comes from @capacitor-firebase/authentication (Capacitor-8,
 * loaded lazily so web builds never pull it). Requires the "Sign in with Apple"
 * capability on the iOS target in Xcode + Apple provider enabled in Firebase —
 * operator/Xcode steps.
 */
export async function signInWithAppleNative(auth: Auth): Promise<UserCredential> {
  // Apple Sign In via @capacitor-firebase/authentication (Capacitor-8 native) —
  // the SAME plugin Google-native uses. This replaces @capacitor-community/
  // apple-sign-in, which only supported Capacitor 7: it pinned capacitor-swift-pm
  // to v7 and broke the iOS SPM graph against the Cap-8 plugins, blocking EVERY
  // iOS build. The plugin returns the Apple credential and the Firebase JS SDK
  // owns the session, so the post-auth flow stays identical to web + Google.
  // LITERAL specifier so Vite bundles the plugin JS into a lazy chunk. The old
  // vite-ignored variable-specifier form left a BARE specifier in the built
  // bundle — WKWebView cannot resolve bare imports at runtime, so EVERY native
  // Apple/Google tap threw instantly ("sign-in did not complete"). Web builds
  // only fetch this chunk if the function is ever called (it is native-gated).
  const mod: any = await import('@capacitor-firebase/authentication');
  const FirebaseAuthentication = mod.FirebaseAuthentication;
  if (!FirebaseAuthentication) {
    throw new Error('Apple sign-in plugin not available (native build only)');
  }

  // The plugin generates the nonce, sends Apple the SHA-256 hash, and returns the
  // RAW nonce so Firebase can verify the identity token.
  const result: any = await FirebaseAuthentication.signInWithApple({
    scopes: ['email', 'name'],
  });

  const idToken: string | undefined = result?.credential?.idToken;
  const rawNonce: string | undefined = result?.credential?.nonce;
  if (!idToken) {
    throw new Error('Apple sign-in returned no identity token');
  }
  const provider = new OAuthProvider('apple.com');
  const credential = provider.credential({ idToken, rawNonce });
  const userCredential = await signInWithCredential(auth, credential);

  // Apple sends the user's name ONLY on the very first authorization, and it is
  // NOT inside the identity token — so Firebase's displayName is null for Apple
  // users. Capture givenName/familyName from this first credential and persist it
  // onto the Firebase profile, otherwise the name is lost forever (Apple never
  // re-sends it on subsequent sign-ins) and every downstream consumer (loyalty
  // auto-enroll, prestige_passes, the Apple Wallet pass "MEMBER" field) falls back
  // to "Member". Best-effort: a failure here must not break the sign-in.
  try {
    const user = userCredential.user;
    if (user && !user.displayName) {
      // The Firebase plugin surfaces Apple's first-time name on result.user.
      const given = (result?.user?.givenName || result?.user?.displayName || '').toString().trim();
      const family = (result?.user?.familyName || '').toString().trim();
      const fullName = `${given} ${family}`.trim();
      if (fullName) {
        await updateProfile(user, { displayName: fullName });
      }
    }
  } catch {
    // Non-fatal — sign-in already succeeded; name persistence is opportunistic.
  }

  return userCredential;
}

/**
 * True inside ANY native Capacitor app (iOS or Android). Used to pick the native
 * Google sign-in plugin instead of the web redirect — the redirect can't return to
 * capacitor://localhost, so web-style Google sign-in silently fails in the app.
 */
export function isNativePlatform(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/**
 * Native Google sign-in for the Capacitor app, exchanged into Firebase. 2026-06-18.
 * The web signInWithRedirect path is broken in the native webview (the OAuth callback
 * returns to petwash.co.il, never back to capacitor://localhost → getRedirectResult is
 * always null). Use the native Google plugin → idToken → signInWithCredential, same
 * UserCredential shape as the web flow so the caller's post-auth logic is identical.
 *
 * Plugin: @capacitor-firebase/authentication (Cap-8 + firebase-12 compatible; lazy-
 * imported so web builds don't pull it). The plugin returns a Google credential; we
 * sign into the Firebase JS SDK with it so the rest of the app (session exchange,
 * loyalty, consent) is identical to web. Set { skipNativeAuth: true } in the plugin's
 * capacitor config so it ONLY returns the credential (the JS SDK owns the session).
 * Requires native config (iOS: GoogleService-Info.plist + reversed-client-id URL
 * scheme in Info.plist; Android: google-services.json) — operator/Xcode steps.
 */
export async function signInWithGoogleNative(auth: Auth): Promise<UserCredential> {
  // Literal specifier — see signInWithAppleNative: bare specifiers don't
  // resolve in the WKWebView, Vite must bundle this into a chunk.
  const mod: any = await import('@capacitor-firebase/authentication');
  const FirebaseAuthentication = mod.FirebaseAuthentication;
  if (!FirebaseAuthentication) {
    throw new Error('Google sign-in plugin not available (native build only)');
  }
  const result: any = await FirebaseAuthentication.signInWithGoogle();
  const idToken: string | undefined = result?.credential?.idToken;
  const accessToken: string | undefined = result?.credential?.accessToken;
  if (!idToken && !accessToken) {
    throw new Error('Google sign-in returned no credential');
  }
  const credential = GoogleAuthProvider.credential(idToken ?? null, accessToken ?? null);
  return signInWithCredential(auth, credential);
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
 * Yahoo (Firebase generic OIDC provider 'yahoo.com'). Requests profile+email so
 * signup can auto-fill the user's name. Requires a Yahoo OAuth app registered in
 * the Firebase console (like Facebook/Apple) before it will authenticate.
 */
export function createYahooProvider(): OAuthProvider {
  const provider = new OAuthProvider('yahoo.com');
  provider.addScope('profile');
  provider.addScope('email');
  provider.setCustomParameters({ prompt: 'login' });
  return provider;
}

/**
 * Microsoft (Firebase generic OIDC provider 'microsoft.com' — Azure AD; covers
 * Outlook/Hotmail/Live personal accounts and work/school accounts). tenant:
 * 'common' accepts both. Requires a Microsoft/Azure app in the Firebase console.
 */
export function createMicrosoftProvider(): OAuthProvider {
  const provider = new OAuthProvider('microsoft.com');
  provider.addScope('User.Read');
  provider.addScope('email');
  provider.setCustomParameters({ prompt: 'select_account', tenant: 'common' });
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
