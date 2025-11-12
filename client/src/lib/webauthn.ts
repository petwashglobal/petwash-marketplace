import {
  startRegistration,
  startAuthentication,
  browserSupportsWebAuthn,
  platformAuthenticatorIsAvailable,
} from '@simplewebauthn/browser';
import { logger } from '@/lib/logger';

/**
 * Check if WebAuthn is supported in this browser
 */
export function isWebAuthnSupported(): boolean {
  return browserSupportsWebAuthn();
}

/**
 * Check if platform authenticator (Face ID, Touch ID, Windows Hello) is available
 */
export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  try {
    return await platformAuthenticatorIsAvailable();
  } catch (error) {
    logger.error('[WebAuthn] Error checking platform authenticator', error);
    return false;
  }
}

/**
 * Get a user-friendly name for the biometric method
 */
export async function getBiometricMethodName(): Promise<string> {
  const isAvailable = await isPlatformAuthenticatorAvailable();
  
  if (!isAvailable) {
    return 'Passkey';
  }

  // Detect platform
  const ua = navigator.userAgent;
  
  if (/iPhone|iPad|iPod/.test(ua)) {
    return 'Face ID / Touch ID';
  } else if (/Macintosh/.test(ua)) {
    return 'Touch ID';
  } else if (/Windows/.test(ua)) {
    return 'Windows Hello';
  } else if (/Android/.test(ua)) {
    return 'Biometric';
  }
  
  return 'Passkey';
}

/**
 * Register a new passkey for the current user
 */
export async function registerPasskey(): Promise<boolean> {
  try {
    logger.info('[WebAuthn] Starting passkey registration');

    // Get registration options from server
    const optionsRes = await fetch('/api/webauthn/register/options', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!optionsRes.ok) {
      const error = await optionsRes.json();
      throw new Error(error.error || 'Failed to get registration options');
    }

    const { options, challengeKey } = await optionsRes.json();

    // Start registration with browser
    const response = await startRegistration(options);

    // Verify registration with server
    const verifyRes = await fetch('/api/webauthn/register/verify', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ response, challengeKey }),
    });

    if (!verifyRes.ok) {
      const error = await verifyRes.json();
      throw new Error(error.error || 'Failed to verify registration');
    }

    logger.info('[WebAuthn] Passkey registered successfully');
    return true;
  } catch (error: any) {
    logger.error('[WebAuthn] Registration failed', error);
    
    // User-friendly error messages
    if (error.name === 'NotAllowedError') {
      throw new Error('Registration was cancelled');
    } else if (error.name === 'InvalidStateError') {
      throw new Error('This passkey is already registered');
    } else if (error.name === 'NotSupportedError') {
      throw new Error('Your device does not support passkeys');
    }
    
    throw error;
  }
}

/**
 * Authenticate using a passkey
 */
export async function authenticateWithPasskey(email: string): Promise<{
  ok: boolean;
  customToken?: string;
  user?: { uid: string; email: string; isAdmin: boolean };
}> {
  try {
    logger.info('[WebAuthn] Starting passkey authentication', { email });

    // Get authentication options from server
    const optionsRes = await fetch('/api/webauthn/login/options', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    if (!optionsRes.ok) {
      const error = await optionsRes.json();
      throw new Error(error.error || 'No passkeys found for this email');
    }

    const { options, challengeKey } = await optionsRes.json();

    // Start authentication with browser
    const response = await startAuthentication(options);

    // Verify authentication with server
    const verifyRes = await fetch('/api/webauthn/login/verify', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ response, challengeKey }),
    });

    if (!verifyRes.ok) {
      const error = await verifyRes.json();
      throw new Error(error.error || 'Authentication failed');
    }

    const result = await verifyRes.json();
    logger.info('[WebAuthn] Authentication successful');
    
    return result;
  } catch (error: any) {
    logger.error('[WebAuthn] Authentication failed', error);
    
    // User-friendly error messages
    if (error.name === 'NotAllowedError') {
      throw new Error('Authentication was cancelled');
    } else if (error.name === 'NotSupportedError') {
      throw new Error('Your device does not support passkeys');
    }
    
    throw error;
  }
}

/**
 * Get user's registered passkeys
 */
export async function getUserPasskeys(): Promise<any[]> {
  try {
    const res = await fetch('/api/webauthn/credentials', {
      credentials: 'include',
    });

    if (!res.ok) {
      throw new Error('Failed to get passkeys');
    }

    const { credentials } = await res.json();
    return credentials || [];
  } catch (error) {
    logger.error('[WebAuthn] Failed to get passkeys', error);
    return [];
  }
}

/**
 * Delete a passkey
 */
export async function deletePasskey(credentialId: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/webauthn/credentials/${credentialId}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (!res.ok) {
      throw new Error('Failed to delete passkey');
    }

    logger.info('[WebAuthn] Passkey deleted');
    return true;
  } catch (error) {
    logger.error('[WebAuthn] Failed to delete passkey', error);
    throw error;
  }
}
