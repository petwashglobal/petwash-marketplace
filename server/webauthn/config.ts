/**
 * Banking-Level WebAuthn Configuration
 * Implements signed cookies, attestation policy, and multi-domain support
 */

import { logger } from '../lib/logger';
import { WebAuthnConfig } from '../types/webauthn';

/**
 * Environment detection.
 *
 * PRODUCTION FIX 2026-09-13: this used to be `APP_ENV === 'development'` with
 * APP_ENV defaulting to 'development'. APP_ENV is NOT set on Cloud Run
 * (NODE_ENV=production is), so production logged `"environment":"development"`
 * and the `.replit.dev` wildcard origin branch below was LIVE in production.
 * NODE_ENV=production now always wins, whatever APP_ENV says.
 */
const APP_ENV = process.env.APP_ENV || 'development';
export const isDev = process.env.NODE_ENV !== 'production' && APP_ENV === 'development';

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
  rpName: process.env.WEBAUTHN_RP_NAME || '⁦PetWash™⁩',
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

function firstHeaderValue(value: unknown): string {
  if (Array.isArray(value)) value = value[0];
  if (typeof value !== 'string') return '';
  return value.split(',')[0].trim();
}

function readHeader(req: any, name: string): string {
  if (!req) return '';
  if (typeof req.get === 'function') return firstHeaderValue(req.get(name));
  return firstHeaderValue(req.headers?.[name.toLowerCase()]);
}

/**
 * Get the origin the BROWSER is on for this request.
 *
 * PRODUCTION FIX 2026-09-13: this used to be `${req.protocol}://${req.get('host')}`.
 * Behind Firebase Hosting -> Cloud Run the Host header is the run.app host
 * (petwash-api-….a.run.app), so every ceremony was refused as
 * "unauthorized origin" and, had it got further, would have been verified
 * against the wrong expectedOrigin (clientDataJSON.origin is https://petwash.co.il).
 *
 * Order:
 *   1. `Origin` — a browser always sends it on a POST (same-origin fetch included)
 *      and a page script cannot forge it.
 *   2. `X-Forwarded-Host` (https) — set by Firebase Hosting / proxies.
 *   3. Host with req.protocol — local dev without a proxy.
 *
 * This function does NOT decide trust. The result is always gated by
 * isOriginAllowed(), and @simplewebauthn then checks it against the
 * authenticator-signed clientDataJSON.origin — so a non-browser client that
 * forges these headers can only choose among allowlisted origins, and still
 * cannot produce an assertion signed for one.
 *
 * A malformed or opaque Origin ("null") is returned as-is so the allowlist
 * refuses it; it never falls through to the forwarded host.
 */
export function getExpectedOrigin(req: any): string {
  const originHeader = readHeader(req, 'origin');
  if (originHeader) {
    try {
      const parsed = new URL(originHeader);
      return parsed.origin; // normalises case / default ports; "null" for opaque schemes
    } catch {
      return originHeader;
    }
  }

  const forwardedHost = readHeader(req, 'x-forwarded-host');
  if (forwardedHost) {
    return `https://${forwardedHost}`;
  }

  const host = readHeader(req, 'host');
  const protocol = req?.protocol || 'https';
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

  // Wildcard for Replit dev domains (development only — never when NODE_ENV=production)
  if (isDev) {
    try {
      const { protocol, hostname } = new URL(origin);
      if (protocol === 'https:' && hostname.endsWith('.replit.dev')) return true;
    } catch {
      /* not a URL — refuse */
    }
  }

  return false;
}

/**
 * Get RP ID for the request: the hostname of the browser origin
 * (getExpectedOrigin) when it is a configured RP ID, else the configured default.
 * Registration and authentication both go through this one helper.
 */
export function getRpId(req?: any): string {
  if (!req) {
    return webauthnConfig.rpId;
  }

  let hostname = '';
  try {
    hostname = new URL(getExpectedOrigin(req)).hostname;
  } catch {
    hostname = '';
  }

  if (hostname && RP_IDS.includes(hostname)) {
    return hostname;
  }

  return webauthnConfig.rpId;
}

/**
 * The single place a ceremony learns where it is running.
 */
export function resolveCeremonyContext(req: any): { origin: string; rpId: string; allowed: boolean } {
  const origin = getExpectedOrigin(req);
  return { origin, rpId: getRpId(req), allowed: isOriginAllowed(origin) };
}

/**
 * Validate attestation format
 */
export function isAttestationFormatAllowed(format: string): boolean {
  return ATTESTATION_POLICY.acceptedFormats.includes(format as any);
}

/**
 * Validate Apple attestation.
 *
 * NOT IMPLEMENTED: full Apple WebAuthn attestation validation (chain to Apple's
 * WebAuthn Root CA, nonce extension check, signature verification).
 *
 * Behaviour is deliberately honest:
 *  - If the policy flag is OFF, attestation isn't required → return true.
 *  - If the policy flag is ON, the caller is asking us to PROVE the device is
 *    genuine Apple hardware. We can't yet, so we FAIL CLOSED rather than
 *    silently returning true and pretending to enforce. This prevents a
 *    "banking-level attestation" config that is actually a no-op.
 *
 * Note: the whole attestation block is additionally gated by
 * webauthnConfig.enableAttestationValidation (env WEBAUTHN_VALIDATE_ATTESTATION),
 * which is OFF by default — so default passkey registration is unaffected.
 */
export function validateAppleAttestation(attestationObject: any): boolean {
  if (!ATTESTATION_POLICY.validateAppleAttestation) {
    return true; // Apple attestation trust-anchor validation intentionally not required
  }

  logger.error(
    '[WebAuthn Config] 🔴 Apple attestation validation is ENABLED but NOT IMPLEMENTED — failing closed. ' +
    'Implement the Apple WebAuthn root-CA chain check, or set ATTESTATION_POLICY.validateAppleAttestation=false ' +
    '(or unset WEBAUTHN_VALIDATE_ATTESTATION) until then.'
  );
  return false; // fail closed — never pretend to enforce
}

/**
 * Validate Android attestation.
 *
 * NOT IMPLEMENTED: SafetyNet / key-attestation chain + integrity verification.
 * Fails closed when enabled, for the same reason as Apple above.
 */
export function validateAndroidAttestation(attestationObject: any): boolean {
  if (!ATTESTATION_POLICY.validateAndroidAttestation) {
    return true; // Android attestation trust-anchor validation intentionally not required
  }

  logger.error(
    '[WebAuthn Config] 🔴 Android attestation validation is ENABLED but NOT IMPLEMENTED — failing closed. ' +
    'Implement the Android key/SafetyNet attestation check, or set ATTESTATION_POLICY.validateAndroidAttestation=false ' +
    '(or unset WEBAUTHN_VALIDATE_ATTESTATION) until then.'
  );
  return false; // fail closed — never pretend to enforce
}

/**
 * Get authenticator selection criteria
 */
export function getAuthenticatorSelection() {
  return {
    authenticatorAttachment: 'platform' as const, // Prefer platform authenticators (Face ID, Touch ID, Windows Hello)
    requireResidentKey: true,
    residentKey: 'required' as const,
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
  environment: process.env.NODE_ENV === 'production' ? 'production' : APP_ENV,
  devOriginWildcards: isDev,
  challengeStore: 'redis (single-use, server-side)',
  requireUserVerification: webauthnConfig.requireUserVerification,
  maxDevicesPerUser: webauthnConfig.maxDevicesPerUser,
  deviceTrustThreshold: webauthnConfig.deviceTrustThreshold,
  attestation: webauthnConfig.attestation,
});
