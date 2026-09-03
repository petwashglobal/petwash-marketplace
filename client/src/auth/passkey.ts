/**
 * Passkey / WebAuthn Frontend Utilities
 * Handles Face ID, Touch ID, Windows Hello, and Android biometric authentication
 * PRODUCTION: Conditional UI + Platform Authenticator for iOS Face ID
 */

import {
  startRegistration,
  startAuthentication,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/browser';
import { auth } from '@/lib/firebase';
import { signInWithCustomToken } from 'firebase/auth';
import { getApiUrl } from '@/lib/apiConfig';

/**
 * Log biometric authentication failure to immutable audit ledger (Protocol 3 compliance)
 * @param error - The WebAuthn error object
 * @param authMethod - The authentication method used
 * @param deviceId - Optional device identifier
 */
async function logBiometricFailure(
  error: any,
  authMethod: 'passkey' | 'face_id' | 'touch_id' | 'windows_hello' | 'biometric' = 'passkey',
  deviceId?: string
): Promise<void> {
  try {
    const errorType = error.name || 'UnknownWebAuthnError';
    const isCanceled = errorType === 'NotAllowedError' || errorType === 'AbortError';
    
    await fetch(getApiUrl('/api/audit/record-biometric-failure'), {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        errorType,
        errorMessage: error.message || 'N/A',
        deviceId,
        isCanceled,
        authMethod,
        metadata: {
          browser: getBrowserName(),
          platform: navigator.platform,
          timestamp: new Date().toISOString(),
        },
      }),
    });
    
    console.log('[Biometric Audit] Failure logged to immutable ledger', {
      errorType,
      isCanceled,
      authMethod,
    });
  } catch (auditError) {
    // Silently fail audit logging - don't block user authentication flow
    console.warn('[Biometric Audit] Failed to log to audit ledger:', auditError);
  }
}

/**
 * Check if WebAuthn is supported in this browser
 */
export function isPasskeySupported(): boolean {
  return !!(
    window.PublicKeyCredential &&
    navigator.credentials &&
    navigator.credentials.create
  );
}

/**
 * Check if platform authenticator (Face ID, Touch ID, Windows Hello) is available
 */
export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  if (!isPasskeySupported()) return false;
  
  try {
    if (PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) {
      return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Get device type string for display
 */
export function getDeviceType(): string {
  const ua = navigator.userAgent;
  
  if (/iPhone|iPad|iPod/.test(ua)) {
    return 'iOS Device';
  } else if (/Android/.test(ua)) {
    return 'Android Device';
  } else if (/Macintosh|Mac OS X/.test(ua)) {
    return 'Mac';
  } else if (/Windows/.test(ua)) {
    return 'Windows PC';
  } else {
    return 'This Device';
  }
}

/**
 * Get biometric method name for this device
 */
export function getBiometricMethodName(): string {
  const ua = navigator.userAgent;

  if (/iPhone|iPod/.test(ua)) {
    // Modern iOS Safari user-agents do NOT expose the device model, so the old
    // /iPhone1[0-9]/ model sniff never matched and EVERY iPhone was labelled
    // "Touch ID" (CEO caught it on a Face ID iPhone). Every iPhone sold since
    // 2018 (except the discontinued SE line) uses Face ID — label it Face ID;
    // the iOS system sheet itself shows the exact method at auth time.
    return 'Face ID';
  } else if (/iPad/.test(ua)) {
    return /iPad Pro/.test(ua) ? 'Face ID' : 'Touch ID';
  } else if (/Android/.test(ua)) {
    return 'Biometric';
  } else if (/Macintosh|Mac OS X/.test(ua)) {
    return 'Touch ID';
  } else if (/Windows/.test(ua)) {
    return 'Windows Hello';
  } else {
    return 'Passkey';
  }
}

/**
 * Detect if user is on Chrome browser on iOS
 */
export function isChromeiOS(): boolean {
  const ua = navigator.userAgent;
  return /CriOS|Chrome/.test(ua) && /iPhone|iPad|iPod/.test(ua);
}

/**
 * Detect if user is on Safari browser on iOS
 */
export function isSafariIOS(): boolean {
  const ua = navigator.userAgent;
  return /Safari/.test(ua) && !/CriOS|Chrome|FxiOS/.test(ua) && /iPhone|iPad|iPod/.test(ua);
}

/**
 * Get the current browser name
 */
export function getBrowserName(): string {
  const ua = navigator.userAgent;
  
  if (/CriOS|Chrome/.test(ua)) {
    return 'Chrome';
  } else if (/FxiOS|Firefox/.test(ua)) {
    return 'Firefox';
  } else if (/EdgiOS|Edg/.test(ua)) {
    return 'Edge';
  } else if (/Safari/.test(ua) && !/Chrome/.test(ua)) {
    return 'Safari';
  } else {
    return 'Browser';
  }
}

/**
 * UI discovery hint only — NEVER a source of truth. The server authoritative
 * record of "this account has a passkey" is the Firestore credential collection
 * exposed by GET /api/webauthn/credentials (see getServerPasskeyStatus below).
 *
 * This flag is written on successful registration + successful passkey login and
 * used ONLY by the signed-out login screen to soften the discovery of the
 * one-tap "Sign in with Face ID" button (which cannot query the server for a
 * per-user credential without leaking whether the account exists). A cleared /
 * missing flag must NEVER be treated as "no passkey enrolled" — the browser's
 * conditional-mediation autofill still surfaces synced passkeys, and any UI that
 * shows "Face ID: enabled" MUST derive that from the server call.
 */
function rememberPasskeyEmailHint(email?: string | null): void {
  try { if (email) localStorage.setItem('petwash_passkey_email', email); } catch { /* storage disabled */ }
}

/**
 * Server-authoritative passkey status for the CURRENT authenticated user.
 *
 * Returns { enrolled, count } derived from GET /api/webauthn/credentials, which
 * requires a valid session cookie. This is the ONLY source of truth for
 * "Face ID enabled on your PetWash account" — Settings/EnableFaceIDCard and any
 * enrollment-status badge MUST use this instead of reading localStorage. On any
 * network / auth failure returns { enrolled: false, count: 0 } so the UI fails
 * closed (offers registration) rather than falsely showing "enabled".
 */
export async function getServerPasskeyStatus(): Promise<{ enrolled: boolean; count: number }> {
  try {
    const res = await fetch(getApiUrl('/api/webauthn/credentials'), {
      method: 'GET',
      credentials: 'include',
    });
    if (!res.ok) return { enrolled: false, count: 0 };
    const data = await res.json();
    const list = Array.isArray(data?.credentials) ? data.credentials : [];
    const active = list.filter((c: any) => !c?.isRevoked);
    return { enrolled: active.length > 0, count: active.length };
  } catch {
    return { enrolled: false, count: 0 };
  }
}

export async function registerPasskey(
  firebaseToken: string,
  deviceName?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!isPasskeySupported()) {
      return { success: false, error: 'Passkeys not supported in this browser' };
    }
    
    // Check if platform authenticator is available (Face ID, Touch ID, Windows Hello)
    const hasPlatformAuth = await isPlatformAuthenticatorAvailable();

    // Get registration options from server (using session cookie)
    const optionsResponse = await fetch(getApiUrl('/api/webauthn/register/options'), {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!optionsResponse.ok) {
      const error = await optionsResponse.json();
      return { success: false, error: error.error || 'Failed to get registration options' };
    }

    const { options, challengeKey } = await optionsResponse.json();
    
    // PRODUCTION: Prefer platform authenticator (Face ID/Touch ID) with fallback
    // If platform auth not available (old devices), allow cross-platform (USB/NFC keys)
    const enhancedOptions: PublicKeyCredentialCreationOptionsJSON = {
      ...options,
      authenticatorSelection: {
        ...(options.authenticatorSelection || {}),
        authenticatorAttachment: hasPlatformAuth ? 'platform' : undefined,  // Prefer platform, fallback to any
        userVerification: 'required' // Always require biometric/PIN
      },
      timeout: 60000,
    };

    // Start WebAuthn registration
    const credential = await startRegistration({
      optionsJSON: enhancedOptions,
    });

    // Verify registration with server
    const verifyResponse = await fetch(getApiUrl('/api/webauthn/register/verify'), {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        challengeKey,
        response: credential,
      }),
    });

    if (!verifyResponse.ok) {
      const error = await verifyResponse.json();
      return { success: false, error: error.error || 'Registration verification failed' };
    }

    // UI hint only — the Firestore write above (via server verify) is the
    // authoritative "this account is enrolled" record. See rememberPasskeyEmailHint.
    rememberPasskeyEmailHint(auth.currentUser?.email);
    return { success: true };
  } catch (error: any) {
    console.error('Passkey registration error:', error);
    
    // Log failure to audit ledger (Protocol 3 compliance)
    await logBiometricFailure(error, getBiometricMethodName() as any);
    
    if (error.name === 'NotAllowedError') {
      return { success: false, error: 'Permission denied. Please try again.' };
    } else if (error.name === 'SecurityError') {
      return { success: false, error: 'Security error. Please use HTTPS.' };
    } else if (error.name === 'InvalidStateError') {
      return { success: false, error: 'A passkey already exists for this device.' };
    }
    
    return { success: false, error: error.message || 'Registration failed' };
  }
}

/**
 * Sign in with passkey (manual trigger via button)
 * PRODUCTION: Platform authenticator preferred for Face ID/Touch ID
 */
export async function signInWithPasskey(
  uid?: string
): Promise<{ success: boolean; error?: string; uid?: string }> {
  try {
    if (!isPasskeySupported()) {
      return { success: false, error: 'Passkeys not supported in this browser' };
    }

    const emailInput = document.querySelector('input[type="email"]') as HTMLInputElement;
    let email = emailInput?.value?.trim() || '';
    
    if (!email && !uid) {
      try {
        const storedEmail = localStorage.getItem('petwash_passkey_email');
        if (storedEmail) {
          email = storedEmail;
        }
      } catch {}
    }
    
    if (email && !email.includes('@')) {
      return { success: false, error: 'Please enter a valid email address' };
    }

    const optionsResponse = await fetch(getApiUrl('/api/webauthn/login/options'), {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: email || undefined }),
    });

    if (!optionsResponse.ok) {
      const error = await optionsResponse.json();
      return { success: false, error: error.error || 'Failed to get authentication options' };
    }

    const { options, challengeKey, discoverable } = await optionsResponse.json();
    
    const credential = await startAuthentication({
      optionsJSON: options,
    });

    const verifyResponse = await fetch(getApiUrl('/api/webauthn/login/verify'), {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        challengeKey,
        response: credential,
        discoverable: discoverable || false,
      }),
    });

    if (!verifyResponse.ok) {
      const error = await verifyResponse.json();
      return { success: false, error: error.error || 'Authentication verification failed' };
    }

    const { customToken, user: userData } = await verifyResponse.json();

    await signInWithCustomToken(auth, customToken);

    // Refresh the UI hint so the button surfaces next time on this device.
    // Not authority — the successful server verify above is the record.
    rememberPasskeyEmailHint(userData?.email || auth.currentUser?.email);
    return { success: true, uid: userData.uid };
  } catch (error: any) {
    console.error('Passkey sign-in error:', error);
    
    await logBiometricFailure(error, getBiometricMethodName() as any);
    
    if (error.name === 'NotAllowedError') {
      return { success: false, error: 'Authentication cancelled or timed out.' };
    } else if (error.name === 'SecurityError') {
      return { success: false, error: 'Security error. Please use HTTPS.' };
    }
    
    return { success: false, error: error.message || 'Sign-in failed' };
  }
}

/**
 * Check if conditional mediation is available (required for Samsung/Android)
 * Chrome on Android needs feature detection to avoid silent failures
 */
export async function isConditionalMediationAvailable(): Promise<boolean> {
  if (!isPasskeySupported()) return false;
  
  try {
    if (PublicKeyCredential.isConditionalMediationAvailable) {
      return await PublicKeyCredential.isConditionalMediationAvailable();
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Sign in with passkey using Conditional UI (auto-triggers Face ID on iPhone)
 * This enables native Face ID prompt without QR codes on Safari
 * 
 * CRITICAL for iPhone Face ID:
 * - Uses mediation: "conditional" to trigger native browser UI
 * - Requires autocomplete="webauthn" on email input
 * - Enables one-tap Face ID on iPhone Safari (no QR codes)
 * 
 * SAMSUNG/ANDROID FIX:
 * - Checks conditional mediation availability first
 * - Falls back to standard flow if unsupported
 * 
 * SIMPLIFIED HYBRID: Works with existing backend, cleaner client code
 */
export async function signInWithPasskeyConditional(): Promise<boolean> {
  try {
    if (!isPasskeySupported()) {
      console.log('Conditional UI: Passkeys not supported');
      return false;
    }

    // Samsung/Android: Check if conditional mediation is supported
    const conditionalSupported = await isConditionalMediationAvailable();
    if (!conditionalSupported) {
      console.log('Conditional UI: Not supported on this browser, falling back to standard flow');
      return false;
    }

    // Conditional UI uses discoverable credentials — email is NOT required.
    // The browser autofills the passkey from the RP ID alone (Face ID / fingerprint picker).
    // Optionally hint with email if already entered, but never block on it.
    const emailInput = document.querySelector('input[type="email"]') as HTMLInputElement | null;
    const email = emailInput?.value?.trim() || undefined;

    const optionsResponse = await fetch(getApiUrl('/api/webauthn/login/options'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(email ? { email } : {}),
      credentials: 'include',
    });

    if (!optionsResponse.ok) {
      // Expected fallback, NOT an error: the conditional-UI probe runs on every page
      // load for signed-out visitors, and a non-OK here (no passkey, rate-limited, or
      // the options endpoint busy) just means "fall back to the normal sign-in flow".
      // Logged as console.error it spammed red errors on every page and made a healthy
      // site look broken in devtools. (2026-08-04)
      console.debug('Conditional UI: options unavailable — using standard sign-in flow');
      return false;
    }

    const { options, challengeKey, discoverable } = await optionsResponse.json();
    
    // CONDITIONAL UI: This is the key to iPhone Face ID!
    // useBrowserAutofill: true enables mediation: "conditional"
    const credential = await startAuthentication({
      optionsJSON: options,
      useBrowserAutofill: true, // SimpleWebAuthn flag for conditional UI
    });

    // Verify authentication with server
    // Pass discoverable flag so server uses the correct verification path
    const verifyResponse = await fetch(getApiUrl('/api/webauthn/login/verify'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        challengeKey,
        response: credential,
        discoverable: discoverable || false,
      }),
    });

    if (!verifyResponse.ok) {
      console.error('Conditional UI: Verification failed');
      return false;
    }

    const { customToken } = await verifyResponse.json();

    // Sign in to Firebase with custom token
    const userCredential = await signInWithCustomToken(auth, customToken);
    
    // Session cookie is already set by the server
    console.log('Conditional UI: Face ID login successful');
    return true;

  } catch (error: any) {
    // Log failure to audit ledger (Protocol 3 compliance)
    await logBiometricFailure(error, getBiometricMethodName() as any);
    
    // Silently ignore NotAllowedError in conditional mode (just means no passkey)
    if (error.name === 'NotAllowedError' || error.name === 'AbortError') {
      console.log('Conditional UI: No passkey available or user cancelled');
      return false;
    }
    
    console.error('Conditional UI sign-in error:', error);
    return false;
  }
}

/**
 * Request biometric re-authentication for sensitive actions
 */
export async function requestBiometricReAuth(): Promise<{ success: boolean; error?: string }> {
  try {
    if (!isPasskeySupported()) {
      return { success: false, error: 'Biometric authentication not available' };
    }

    const user = auth.currentUser;
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    const result = await signInWithPasskey(user.uid);
    
    return result;
  } catch (error: any) {
    console.error('Biometric re-auth error:', error);
    return { success: false, error: error.message || 'Re-authentication failed' };
  }
}

/**
 * Get user's registered passkey devices
 */
export async function getUserPasskeyDevices(firebaseToken: string) {
  try {
    const response = await fetch(getApiUrl('/api/auth/webauthn/devices'), {
      headers: {
        'Authorization': `Bearer ${firebaseToken}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to get devices');
    }

    const { devices } = await response.json();
    return devices;
  } catch (error) {
    console.error('Get devices error:', error);
    return [];
  }
}

/**
 * Remove a passkey device
 */
export async function removePasskeyDevice(
  firebaseToken: string,
  credId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(getApiUrl(`/api/auth/webauthn/devices/${credId}`), {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${firebaseToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.error || 'Failed to remove device' };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Remove device error:', error);
    return { success: false, error: error.message || 'Failed to remove device' };
  }
}

/**
 * Rename a passkey device
 */
export async function renamePasskeyDevice(
  firebaseToken: string,
  credId: string,
  newName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(getApiUrl(`/api/auth/webauthn/devices/${credId}/rename`), {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${firebaseToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ newName }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.error || 'Failed to rename device' };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Rename device error:', error);
    return { success: false, error: error.message || 'Failed to rename device' };
  }
}
