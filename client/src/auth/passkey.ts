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
    
    await fetch('/api/audit/record-biometric-failure', {
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
  
  if (/iPhone|iPad|iPod/.test(ua)) {
    const isNewerIOS = /iPhone1[0-9]|iPhone[2-9][0-9]/.test(ua) || /iPad Pro/.test(ua);
    return isNewerIOS ? 'Face ID' : 'Touch ID';
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
 * Register a new passkey for the current user
 * PRODUCTION: Platform authenticator preferred (Face ID/Touch ID), with fallback
 */
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
    const optionsResponse = await fetch('/api/webauthn/register/options', {
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
    const verifyResponse = await fetch('/api/webauthn/register/verify', {
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

    // Get authentication options from server
    // Get user email from form or ask
    const emailInput = document.querySelector('input[type="email"]') as HTMLInputElement;
    const email = emailInput?.value?.trim() || '';
    
    // Validate email before sending to backend
    if (!email && !uid) {
      return { success: false, error: 'Please enter your email address first' };
    }
    
    // Basic email validation
    if (email && !email.includes('@')) {
      return { success: false, error: 'Please enter a valid email address' };
    }

    const optionsResponse = await fetch('/api/webauthn/login/options', {
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

    const { options, challengeKey } = await optionsResponse.json();
    
    // PRODUCTION: Use SimpleWebAuthn for standard flow (works reliably on all platforms)
    // SimpleWebAuthn handles JSON to ArrayBuffer conversion automatically
    const credential = await startAuthentication({
      optionsJSON: options,
    });

    // Verify authentication with server
    const verifyResponse = await fetch('/api/webauthn/login/verify', {
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
      return { success: false, error: error.error || 'Authentication verification failed' };
    }

    const { customToken, user: userData } = await verifyResponse.json();

    // Sign in to Firebase with custom token
    const userCredential = await signInWithCustomToken(auth, customToken);
    
    // Session cookie is already set by the server
    // No need to call /api/auth/session again

    return { success: true, uid: userData.uid };
  } catch (error: any) {
    console.error('Passkey sign-in error:', error);
    
    // Log failure to audit ledger (Protocol 3 compliance)
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

    // Get authentication options from server (requires email for new API)
    const email = (document.querySelector('input[type="email"]') as HTMLInputElement)?.value;
    if (!email) {
      console.log('Conditional UI: No email entered yet');
      return false;
    }

    const optionsResponse = await fetch('/api/webauthn/login/options', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
      credentials: 'include',
    });

    if (!optionsResponse.ok) {
      console.error('Conditional UI: Failed to get options');
      return false;
    }

    const { options, challengeKey } = await optionsResponse.json();
    
    // CONDITIONAL UI: This is the key to iPhone Face ID!
    // useBrowserAutofill: true enables mediation: "conditional"
    const credential = await startAuthentication({
      optionsJSON: options,
      useBrowserAutofill: true, // SimpleWebAuthn flag for conditional UI
    });

    // Verify authentication with server
    const verifyResponse = await fetch('/api/webauthn/login/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        challengeKey,
        response: credential,
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
 * Sign in with passkey automatically on page load (banking-level UX)
 * Uses stored email from localStorage, no user interaction required
 * 
 * BANKING UX: Immediate Face ID prompt for returning users
 * - No email input required (uses stored email)
 * - Auto-triggers on page load
 * - Smooth fallback to standard login if fails
 */
export async function signInWithPasskeyAuto(
  storedEmail: string
): Promise<{ success: boolean; error?: string; uid?: string }> {
  try {
    if (!isPasskeySupported()) {
      return { success: false, error: 'Passkeys not supported in this browser' };
    }

    if (!storedEmail) {
      return { success: false, error: 'No stored email provided' };
    }

    console.log('Auto Face ID: Starting authentication for', storedEmail.substring(0, 3) + '***');

    // Get authentication options from server
    const optionsResponse = await fetch('/api/webauthn/login/options', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: storedEmail }),
    });

    if (!optionsResponse.ok) {
      const error = await optionsResponse.json();
      return { success: false, error: error.error || 'Failed to get authentication options' };
    }

    const { options, challengeKey } = await optionsResponse.json();
    
    // Start WebAuthn authentication (standard flow, not conditional)
    const credential = await startAuthentication({
      optionsJSON: options,
    });

    // Verify authentication with server
    const verifyResponse = await fetch('/api/webauthn/login/verify', {
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
      return { success: false, error: error.error || 'Authentication verification failed' };
    }

    const { customToken, user: userData } = await verifyResponse.json();

    // Sign in to Firebase with custom token
    await signInWithCustomToken(auth, customToken);
    
    // Session cookie is already set by the server
    console.log('Auto Face ID: Authentication successful');

    return { success: true, uid: userData.uid };
  } catch (error: any) {
    console.error('Auto Face ID error:', error);
    
    // Log failure to audit ledger (Protocol 3 compliance)
    await logBiometricFailure(error, getBiometricMethodName() as any, storedEmail);
    
    // User-friendly error messages
    if (error.name === 'NotAllowedError') {
      return { success: false, error: 'Authentication cancelled' };
    } else if (error.name === 'SecurityError') {
      return { success: false, error: 'Security error' };
    } else if (error.name === 'AbortError') {
      return { success: false, error: 'Authentication timed out' };
    }
    
    return { success: false, error: error.message || 'Authentication failed' };
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
    const response = await fetch('/api/auth/webauthn/devices', {
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
    const response = await fetch(`/api/auth/webauthn/devices/${credId}`, {
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
    const response = await fetch(`/api/auth/webauthn/devices/${credId}/rename`, {
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
