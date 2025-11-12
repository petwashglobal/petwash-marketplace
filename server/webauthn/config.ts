/**
 * Banking-Level WebAuthn Configuration
 * Implements signed cookies, attestation policy, and multi-domain support
 */

import { logger } from '../lib/logger';
import { WebAuthnConfig, WebAuthnChallenge } from '../types/webauthn';
import crypto from 'crypto';

const APP_ENV = process.env.APP_ENV || 'development';
const isDev = APP_ENV === 'development';

/**
 * Secret key for signing challenge cookies
 * In production, this MUST be set via environment variable
 */
const CHALLENGE_COOKIE_SECRET = process.env.WEBAUTHN_COOKIE_SECRET || 
  (isDev ? 'dev-only-secret-change-in-production' : '');

if (!CHALLENGE_COOKIE_SECRET && !isDev) {
  throw new Error('WEBAUTHN_COOKIE_SECRET environment variable is required in production');
}

/**
 * Multi-Domain RP Support
 * Dynamically supports petwash.co.il, www subdomain, Replit preview, staging, and localhost
 */
const buildRpIds = (): string[] => {
  const baseIds = [
    'petwash.co.il',
    'www.petwash.co.il',
    'localhost',
    '127.0.0.1'
  ];
  
  // Add current Replit dev domain dynamically
  if (process.env.REPLIT_DEV_DOMAIN) {
    baseIds.push(process.env.REPLIT_DEV_DOMAIN);
  }
  
  // Add staging domain if configured
  if (process.env.STAGING_DOMAIN) {
    baseIds.push(process.env.STAGING_DOMAIN);
  }
  
  // Add custom RP IDs from environment (comma-separated)
  if (process.env.CUSTOM_RP_IDS) {
    const customIds = process.env.CUSTOM_RP_IDS.split(',').map(id => id.trim());
    baseIds.push(...customIds);
  }
  
  // Remove duplicates
  return Array.from(new Set(baseIds));
};

export const RP_IDS = buildRpIds();

/**
 * Authorized Origins
 * Dynamically supports all environments with proper protocol
 */
const buildOrigins = (): string[] => {
  const baseOrigins = [
    'https://petwash.co.il',
    'https://www.petwash.co.il',
    'http://localhost:5000',
    'http://localhost:5173',  // Vite default dev server
    'http://127.0.0.1:5000',
    'http://127.0.0.1:5173'   // Vite default dev server
  ];
  
  // Add current Replit dev domain with HTTPS
  if (process.env.REPLIT_DEV_DOMAIN) {
    baseOrigins.push(`https://${process.env.REPLIT_DEV_DOMAIN}`);
  }
  
  // Add staging domain with HTTPS
  if (process.env.STAGING_DOMAIN) {
    baseOrigins.push(`https://${process.env.STAGING_DOMAIN}`);
  }
  
  // Add custom origins from environment (comma-separated)
  if (process.env.CUSTOM_ORIGINS) {
    const customOrigins = process.env.CUSTOM_ORIGINS.split(',').map(o => o.trim());
    baseOrigins.push(...customOrigins);
  }
  
  // Remove duplicates
  return Array.from(new Set(baseOrigins));
};

export const ORIGINS = buildOrigins();

/**
 * Attestation Policy
 * Define which attestation formats are accepted and how to validate them
 */
export const ATTESTATION_POLICY = {
  // Attestation formats we accept
  acceptedFormats: [
    'none',        // No attestation (most common, privacy-focused)
    'packed',      // TPM or FIDO2 authenticators
    'fido-u2f',    // Legacy U2F tokens
    'android-key', // Android KeyStore
    'android-safetynet', // Android SafetyNet (deprecated but still in use)
    'apple',       // Apple attestation
    'tpm'          // Windows TPM
  ] as const,
  
  // Require attestation for high-security scenarios
  requireAttestation: process.env.WEBAUTHN_REQUIRE_ATTESTATION === 'true',
  
  // Validate Apple attestation certificates
  validateAppleAttestation: true,
  
  // Validate Android attestation
  validateAndroidAttestation: true,
  
  // Trust root certificates (placeholder for production)
  trustedRoots: [] as string[],
};

/**
 * Banking-Level WebAuthn Configuration
 */
export const webauthnConfig: WebAuthnConfig = {
  // Relying Party
  rpId: process.env.WEBAUTHN_RP_ID || 'petwash.co.il',
  rpName: process.env.WEBAUTHN_RP_NAME || 'Pet Wash™',
  origins: ORIGINS,
  
  // Timeouts
  timeout: 120000, // 2 minutes for user to complete biometric
  challengeExpiry: 300000, // 5 minutes
  sessionMaxAge: 432000000, // 5 days
  reAuthWindow: 300000, // 5 minutes for sensitive actions
  
  // Attestation - Request device certificates for banking-level security
  attestation: 'direct', // 'none', 'direct', or 'indirect' - direct validates device authenticity
  
  // Banking-level security
  requireUserVerification: true,
  maxDevicesPerUser: 10,
  deviceTrustThreshold: 40, // Minimum trust score to allow auth
  enableAttestationValidation: process.env.WEBAUTHN_VALIDATE_ATTESTATION === 'true',
};

/**
 * Get expected origin for the current request
 */
export function getExpectedOrigin(req: any): string {
  const host = req.get('host') || '';
  const protocol = req.protocol || 'https';
  return `${protocol}://${host}`;
}

/**
 * Validate origin is allowed
 */
export function isOriginAllowed(origin: string): boolean {
  // Exact match
  if (ORIGINS.includes(origin)) {
    return true;
  }
  
  // Wildcard for Replit dev domains (development only)
  if (isDev && origin.includes('.replit.dev')) {
    return true;
  }
  
  return false;
}

/**
 * Get RP ID dynamically based on request hostname
 */
export function getRpId(req?: any): string {
  if (!req) {
    return webauthnConfig.rpId;
  }

  const host = req.get('host') || '';
  const hostname = host.split(':')[0];
  
  if (RP_IDS.includes(hostname)) {
    return hostname;
  }
  
  return webauthnConfig.rpId;
}

/**
 * Check if secure cookie flag should be used
 */
export function shouldUseSecureCookie(req?: any): boolean {
  if (!req) {
    return !isDev;
  }

  const protocol = req.protocol || 'https';
  const host = req.get('host') || '';
  
  // Allow insecure cookies for localhost HTTP
  if (protocol === 'http' && (host.startsWith('localhost') || host.startsWith('127.0.0.1'))) {
    return false;
  }
  
  return true;
}

/**
 * Sign challenge data for cookie storage
 * Prevents tampering with challenge data
 */
export function signChallenge(data: Omit<WebAuthnChallenge, 'csrfToken'>): string {
  const payload = JSON.stringify(data);
  const signature = crypto
    .createHmac('sha256', CHALLENGE_COOKIE_SECRET)
    .update(payload)
    .digest('hex');
  
  return `${Buffer.from(payload).toString('base64')}.${signature}`;
}

/**
 * Verify and parse signed challenge from cookie
 */
export function verifyChallenge(signedData: string): WebAuthnChallenge | null {
  try {
    const [encodedPayload, signature] = signedData.split('.');
    
    if (!encodedPayload || !signature) {
      logger.warn('[WebAuthn Config] Invalid signed challenge format');
      return null;
    }
    
    // Verify signature
    const payload = Buffer.from(encodedPayload, 'base64').toString('utf8');
    const expectedSignature = crypto
      .createHmac('sha256', CHALLENGE_COOKIE_SECRET)
      .update(payload)
      .digest('hex');
    
    // Constant-time comparison to prevent timing attacks
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      logger.warn('[WebAuthn Config] Challenge signature verification failed');
      return null;
    }
    
    // Parse and validate payload
    const data = JSON.parse(payload) as WebAuthnChallenge;
    
    // Check expiration
    if (data.expiresAt < Date.now()) {
      logger.info('[WebAuthn Config] Challenge expired', {
        expiresAt: new Date(data.expiresAt),
        now: new Date()
      });
      return null;
    }
    
    return data;
  } catch (error) {
    logger.error('[WebAuthn Config] Failed to verify challenge', error);
    return null;
  }
}

/**
 * Store challenge in signed cookie
 */
export function storeChallengeInCookie(
  res: any,
  challenge: Omit<WebAuthnChallenge, 'csrfToken'>,
  req?: any
): string {
  const signedChallenge = signChallenge(challenge);
  const useSecure = shouldUseSecureCookie(req);
  
  // Set secure, HTTP-only cookie
  res.cookie('wa_challenge', signedChallenge, {
    httpOnly: true,
    secure: useSecure,
    sameSite: useSecure ? 'none' : 'lax',
    path: '/',
    maxAge: webauthnConfig.challengeExpiry,
  });
  
  logger.debug('[WebAuthn Config] Challenge stored in cookie', {
    type: challenge.type,
    expiresIn: webauthnConfig.challengeExpiry,
    secure: useSecure
  });
  
  return signedChallenge;
}

/**
 * Retrieve and verify challenge from cookie
 */
export function retrieveChallengeFromCookie(req: any): WebAuthnChallenge | null {
  const signedChallenge = req.cookies?.wa_challenge;
  
  if (!signedChallenge) {
    logger.warn('[WebAuthn Config] No challenge cookie found');
    return null;
  }
  
  return verifyChallenge(signedChallenge);
}

/**
 * Clear challenge cookie
 */
export function clearChallengeFromCookie(res: any): void {
  res.clearCookie('wa_challenge', {
    httpOnly: true,
    secure: !isDev,
    sameSite: !isDev ? 'none' : 'lax',
    path: '/'
  });
  
  logger.debug('[WebAuthn Config] Challenge cookie cleared');
}

/**
 * Validate attestation format
 */
export function isAttestationFormatAllowed(format: string): boolean {
  return ATTESTATION_POLICY.acceptedFormats.includes(format as any);
}

/**
 * Validate Apple attestation
 * Placeholder for production implementation
 */
export function validateAppleAttestation(attestationObject: any): boolean {
  if (!ATTESTATION_POLICY.validateAppleAttestation) {
    return true; // Validation disabled
  }
  
  // TODO: Implement Apple attestation validation
  // - Verify certificate chain
  // - Check nonce
  // - Validate signature
  
  logger.debug('[WebAuthn Config] Apple attestation validation not yet implemented');
  return true; // Allow for now
}

/**
 * Validate Android attestation
 * Placeholder for production implementation
 */
export function validateAndroidAttestation(attestationObject: any): boolean {
  if (!ATTESTATION_POLICY.validateAndroidAttestation) {
    return true; // Validation disabled
  }
  
  // TODO: Implement Android attestation validation
  // - Verify SafetyNet or Key attestation
  // - Check certificate chain
  // - Validate integrity
  
  logger.debug('[WebAuthn Config] Android attestation validation not yet implemented');
  return true; // Allow for now
}

/**
 * Get authenticator selection criteria
 */
export function getAuthenticatorSelection() {
  return {
    authenticatorAttachment: 'platform' as const, // Prefer platform authenticators (Face ID, Touch ID, Windows Hello)
    requireResidentKey: false,
    residentKey: 'preferred' as const,
    userVerification: webauthnConfig.requireUserVerification ? 'required' as const : 'preferred' as const,
  };
}

/**
 * Get supported algorithm IDs
 */
export function getSupportedAlgorithms(): number[] {
  return [
    -7,   // ES256 (ECDSA with SHA-256)
    -257, // RS256 (RSASSA-PKCS1-v1_5 with SHA-256)
    -8,   // EdDSA
    -37,  // PS256 (RSASSA-PSS with SHA-256)
  ];
}

/**
 * Get supported transports
 */
export function getSupportedTransports(): AuthenticatorTransport[] {
  return ['internal', 'hybrid', 'usb', 'nfc', 'ble'];
}

/**
 * Log configuration on startup
 */
logger.info('[WebAuthn Config] Banking-level configuration initialized', {
  rpId: webauthnConfig.rpId,
  rpName: webauthnConfig.rpName,
  environment: APP_ENV,
  requireUserVerification: webauthnConfig.requireUserVerification,
  maxDevicesPerUser: webauthnConfig.maxDevicesPerUser,
  deviceTrustThreshold: webauthnConfig.deviceTrustThreshold,
  attestation: webauthnConfig.attestation,
  signedCookies: !!CHALLENGE_COOKIE_SECRET
});
