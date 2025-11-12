/**
 * Unified WebAuthn Service - Banking-Level Authentication
 * Consolidates device registry, signed cookies, and comprehensive security
 */

import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type VerifiedRegistrationResponse,
  type VerifiedAuthenticationResponse,
} from '@simplewebauthn/server';
import { isoBase64URL, isoUint8Array } from '@simplewebauthn/server/helpers';
import { db } from '../lib/firebase-admin';
import { logger } from '../lib/logger';
import { Timestamp } from 'firebase-admin/firestore';
import {
  webauthnConfig,
  getRpId,
  getExpectedOrigin,
  isOriginAllowed,
  storeChallengeInCookie,
  retrieveChallengeFromCookie,
  clearChallengeFromCookie,
  getAuthenticatorSelection,
  getSupportedAlgorithms,
  isAttestationFormatAllowed,
  validateAppleAttestation,
  validateAndroidAttestation
} from './config';
import {
  registerDevice,
  updateDeviceOnAuth,
  recordAuthFailure,
  getUserDevices,
  renameDevice as registryRenameDevice,
  setDeviceIcon as registrySetDeviceIcon,
  revokeDevice,
  checkReAuthRequired,
  logAuthEvent
} from './deviceRegistry';
import type { WebAuthnCredential, WebAuthnChallenge } from '../types/webauthn';
import { webauthnMessages, getLanguage, t, bilingualError } from '../lib/i18n';

/**
 * Generate registration options for a user (customer or employee)
 */
export async function generateRegistrationOptionsForUser(
  uid: string,
  email: string,
  isAdmin: boolean,
  req: any,
  res: any
): Promise<{ options: any; success: boolean; error?: any }> {
  try {
    const lang = getLanguage(req);
    const rpId = getRpId(req);
    const origin = getExpectedOrigin(req);
    const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
    
    // Check if origin is allowed
    if (!isOriginAllowed(origin)) {
      logger.warn('[WebAuthn] Registration attempted from unauthorized origin', { origin, uid });
      return {
        success: false,
        error: bilingualError(webauthnMessages.originMismatch, 403, lang),
        options: null
      };
    }
    
    // Get existing credentials to exclude
    const collectionPath = isAdmin ? 'employees' : 'users';
    const credentialsSnapshot = await db
      .collection(collectionPath)
      .doc(uid)
      .collection('webauthnCredentials')
      .get();
    
    const excludeCredentials = credentialsSnapshot.docs.map((doc) => {
      const data = doc.data() as WebAuthnCredential;
      return {
        id: data.credId, // SimpleWebAuthn v10 expects base64url string, not Buffer
        type: 'public-key' as const,
        transports: data.transports || ['internal', 'hybrid'],
      };
    });
    
    // Check device limit
    if (credentialsSnapshot.size >= webauthnConfig.maxDevicesPerUser) {
      logger.warn('[WebAuthn] Max devices reached', { uid, count: credentialsSnapshot.size });
      return {
        success: false,
        error: bilingualError(webauthnMessages.tooManyDevices, 400, lang),
        options: null
      };
    }
    
    // Generate registration options with DIRECT attestation for device verification
    // This requests the attestation certificate from the device (Face ID, Touch ID, etc.)
    const options = await generateRegistrationOptions({
      rpName: webauthnConfig.rpName,
      rpID: rpId,
      userID: isoUint8Array.fromUTF8String(uid),
      userName: email,
      userDisplayName: email.split('@')[0],
      timeout: webauthnConfig.timeout,
      attestationType: 'direct', // Request attestation certificate to verify device authenticity (banking-level security)
      excludeCredentials,
      authenticatorSelection: getAuthenticatorSelection(),
      supportedAlgorithmIDs: getSupportedAlgorithms(),
    });
    
    // Store challenge in signed cookie
    const challengeData: Omit<WebAuthnChallenge, 'csrfToken'> = {
      challenge: options.challenge,
      uid,
      email,
      type: 'registration',
      createdAt: Date.now(),
      expiresAt: Date.now() + webauthnConfig.challengeExpiry,
      rpId,
      origin,
      ipAddress,
      userAgent: req.headers['user-agent']
    };
    
    storeChallengeInCookie(res, challengeData, req);
    
    // Log event
    await logAuthEvent({
      eventType: 'registration_started',
      uid,
      timestamp: Timestamp.now(),
      success: true,
      metadata: {
        platform: req.headers['user-agent'],
        rpId,
        origin,
        ipAddress
      }
    });
    
    logger.info('[WebAuthn] Registration options generated', {
      uid,
      email,
      isAdmin,
      rpId,
      excludedCount: excludeCredentials.length
    });
    
    return {
      success: true,
      options
    };
  } catch (error) {
    logger.error('[WebAuthn] Failed to generate registration options', error);
    return {
      success: false,
      error: bilingualError(webauthnMessages.registrationFailed, 500, getLanguage(req)),
      options: null
    };
  }
}

/**
 * Verify registration response and store credential
 */
export async function verifyAndStoreRegistration(
  response: any,
  req: any,
  res: any
): Promise<{ verified: boolean; credential?: WebAuthnCredential; error?: any }> {
  try {
    const lang = getLanguage(req);
    const rpId = getRpId(req);
    const origin = getExpectedOrigin(req);
    const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    
    // Retrieve and validate challenge from cookie
    const challengeData = retrieveChallengeFromCookie(req);
    
    if (!challengeData) {
      return {
        verified: false,
        error: bilingualError(webauthnMessages.challengeNotFound, 400, lang)
      };
    }
    
    if (challengeData.type !== 'registration') {
      return {
        verified: false,
        error: bilingualError(webauthnMessages.challengeMismatch, 400, lang)
      };
    }
    
    if (!challengeData.uid || !challengeData.email) {
      return {
        verified: false,
        error: bilingualError(webauthnMessages.challengeMismatch, 400, lang)
      };
    }
    
    // Verify origin matches
    if (challengeData.origin !== origin) {
      logger.warn('[WebAuthn] Origin mismatch', { 
        expected: challengeData.origin, 
        actual: origin 
      });
      return {
        verified: false,
        error: bilingualError(webauthnMessages.originMismatch, 403, lang)
      };
    }
    
    // Verify registration response
    const verification: VerifiedRegistrationResponse = await verifyRegistrationResponse({
      response,
      expectedChallenge: challengeData.challenge,
      expectedOrigin: origin,
      expectedRPID: rpId,
      requireUserVerification: webauthnConfig.requireUserVerification,
    });
    
    if (!verification.verified || !verification.registrationInfo) {
      await logAuthEvent({
        eventType: 'registration_failed',
        uid: challengeData.uid,
        timestamp: Timestamp.now(),
        success: false,
        errorMessage: 'Verification failed'
      });
      
      return {
        verified: false,
        error: bilingualError(webauthnMessages.registrationFailed, 400, lang)
      };
    }
    
    // SimpleWebAuthn v10: registrationInfo structure changed
    const { credential, credentialDeviceType, credentialBackedUp, aaguid } =
      verification.registrationInfo;
    const { id: credentialID, publicKey: credentialPublicKey, counter } = credential;
    
    // Extract attestation certificate data for device trust scoring (banking-level security)
    const attestationFormat = verification.registrationInfo.fmt;
    let attestationCertificate = null;
    
    // For Apple/Android attestation, capture the certificate for audit and trust scoring
    if (attestationFormat && (attestationFormat === 'apple' || attestationFormat === 'android-key' || attestationFormat === 'android-safetynet')) {
      try {
        attestationCertificate = {
          format: attestationFormat,
          statement: verification.registrationInfo,
          timestamp: Date.now()
        };
        
        logger.info('[WebAuthn] Attestation certificate captured (consent certificate)', {
          format: attestationFormat,
          uid: challengeData.uid
        });
      } catch (err) {
        logger.warn('[WebAuthn] Failed to extract attestation certificate', {
          error: err instanceof Error ? err.message : String(err)
        });
      }
    }
    
    // Validate attestation if enabled
    if (webauthnConfig.enableAttestationValidation && verification.registrationInfo.fmt) {
      const fmt = verification.registrationInfo.fmt;
      
      if (!isAttestationFormatAllowed(fmt)) {
        logger.warn('[WebAuthn] Attestation format not allowed', { fmt });
        return {
          verified: false,
          error: bilingualError(webauthnMessages.attestationFailed, 400, lang)
        };
      }
      
      // Validate platform-specific attestation
      if (fmt === 'apple' && !validateAppleAttestation(verification.registrationInfo)) {
        return {
          verified: false,
          error: bilingualError(webauthnMessages.attestationFailed, 400, lang)
        };
      }
      
      if ((fmt === 'android-key' || fmt === 'android-safetynet') && 
          !validateAndroidAttestation(verification.registrationInfo)) {
        return {
          verified: false,
          error: bilingualError(webauthnMessages.attestationFailed, 400, lang)
        };
      }
    }
    
    // Determine if this is an admin/employee
    const adminDoc = await db.collection('employees').doc(challengeData.uid).get();
    const isAdmin = adminDoc.exists;
    
    // Register device using device registry with attestation certificate
    const registeredCredential = await registerDevice(
      challengeData.uid,
      isAdmin,
      {
        credId: typeof credentialID === 'string' ? credentialID : isoBase64URL.fromBuffer(credentialID),
        publicKey: typeof credentialPublicKey === 'string' ? credentialPublicKey : isoBase64URL.fromBuffer(credentialPublicKey),
        counter,
        deviceType: credentialDeviceType,
        backedUp: credentialBackedUp,
        transports: response.response?.transports || ['internal', 'hybrid'],
        aaguid: aaguid || undefined,
        attestationFormat: verification.registrationInfo.fmt,
        attestationData: attestationCertificate || verification.registrationInfo // Store the consent certificate
      },
      userAgent,
      ipAddress,
      origin
    );
    
    // Clear challenge cookie
    clearChallengeFromCookie(res);
    
    logger.info('[WebAuthn] Registration verified and credential stored', {
      uid: challengeData.uid,
      email: challengeData.email,
      credId: registeredCredential.credId.substring(0, 20) + '...',
      isAdmin,
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp
    });
    
    return {
      verified: true,
      credential: registeredCredential
    };
  } catch (error) {
    logger.error('[WebAuthn] Registration verification failed', error);
    clearChallengeFromCookie(res);
    
    return {
      verified: false,
      error: bilingualError(webauthnMessages.registrationFailed, 500, getLanguage(req))
    };
  }
}

/**
 * Generate authentication options for login
 */
export async function generateAuthenticationOptionsForEmail(
  email: string,
  req: any,
  res: any
): Promise<{ options: any; success: boolean; error?: any }> {
  try {
    const lang = getLanguage(req);
    const rpId = getRpId(req);
    const origin = getExpectedOrigin(req);
    const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
    
    // Check if origin is allowed
    if (!isOriginAllowed(origin)) {
      logger.warn('[WebAuthn] Authentication attempted from unauthorized origin', { origin, email });
      return {
        success: false,
        error: bilingualError(webauthnMessages.originMismatch, 403, lang),
        options: null
      };
    }
    
    // Find user by email (check both customers and admins)
    let uid: string | null = null;
    let isAdmin = false;
    let credentials: WebAuthnCredential[] = [];
    
    // Check customers first
    const usersSnapshot = await db.collection('users').where('email', '==', email).limit(1).get();
    if (!usersSnapshot.empty) {
      const userDoc = usersSnapshot.docs[0];
      uid = userDoc.id;
      const credsSnapshot = await db
        .collection('users')
        .doc(uid)
        .collection('webauthnCredentials')
        .where('isRevoked', '==', false)
        .get();
      credentials = credsSnapshot.docs.map((doc) => doc.data() as WebAuthnCredential);
    }
    
    // Check admins if not found in customers
    if (!uid) {
      const adminsSnapshot = await db.collection('employees').where('email', '==', email).limit(1).get();
      if (!adminsSnapshot.empty) {
        const adminDoc = adminsSnapshot.docs[0];
        uid = adminDoc.id;
        isAdmin = true;
        const credsSnapshot = await db
          .collection('employees')
          .doc(uid)
          .collection('webauthnCredentials')
          .where('isRevoked', '==', false)
          .get();
        credentials = credsSnapshot.docs.map((doc) => doc.data() as WebAuthnCredential);
      }
    }
    
    if (!uid || credentials.length === 0) {
      logger.warn('[WebAuthn] No credentials found for email', { email });
      return {
        success: false,
        error: bilingualError(webauthnMessages.noCredentialsForEmail, 404, lang),
        options: null
      };
    }
    
    // Filter out low-trust devices
    const trustedCredentials = credentials.filter(
      cred => cred.trustScore >= webauthnConfig.deviceTrustThreshold
    );
    
    if (trustedCredentials.length === 0) {
      logger.warn('[WebAuthn] No trusted credentials found', { email, uid });
      return {
        success: false,
        error: bilingualError(webauthnMessages.deviceLowTrust, 403, lang),
        options: null
      };
    }
    
    const allowCredentials = trustedCredentials.map((cred) => ({
      id: cred.credId,
      transports: cred.transports || ['internal', 'hybrid'],
    }));
    
    const options = await generateAuthenticationOptions({
      rpID: rpId,
      timeout: webauthnConfig.timeout,
      allowCredentials,
      userVerification: webauthnConfig.requireUserVerification ? 'required' : 'preferred',
    });
    
    // Store challenge in signed cookie
    const challengeData: Omit<WebAuthnChallenge, 'csrfToken'> = {
      challenge: options.challenge,
      uid,
      email,
      type: 'authentication',
      createdAt: Date.now(),
      expiresAt: Date.now() + webauthnConfig.challengeExpiry,
      rpId,
      origin,
      ipAddress,
      userAgent: req.headers['user-agent']
    };
    
    storeChallengeInCookie(res, challengeData, req);
    
    // Log event
    await logAuthEvent({
      eventType: 'authentication_started',
      uid,
      timestamp: Timestamp.now(),
      success: true,
      metadata: {
        platform: req.headers['user-agent'],
        rpId,
        origin,
        ipAddress
      }
    });
    
    logger.info('[WebAuthn] Authentication options generated', {
      email,
      uid,
      isAdmin,
      credentialCount: trustedCredentials.length
    });
    
    return {
      success: true,
      options
    };
  } catch (error) {
    logger.error('[WebAuthn] Failed to generate authentication options', error);
    return {
      success: false,
      error: bilingualError(webauthnMessages.authenticationFailed, 500, getLanguage(req)),
      options: null
    };
  }
}

/**
 * Verify authentication response and return user info
 */
export async function verifyAuthenticationAndGetUser(
  response: any,
  req: any,
  res: any
): Promise<{ verified: boolean; uid?: string; email?: string; isAdmin?: boolean; error?: any }> {
  try {
    const lang = getLanguage(req);
    const rpId = getRpId(req);
    const origin = getExpectedOrigin(req);
    const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    
    // Retrieve and validate challenge from cookie
    const challengeData = retrieveChallengeFromCookie(req);
    
    if (!challengeData) {
      return {
        verified: false,
        error: bilingualError(webauthnMessages.challengeNotFound, 400, lang)
      };
    }
    
    if (challengeData.type !== 'authentication') {
      return {
        verified: false,
        error: bilingualError(webauthnMessages.challengeMismatch, 400, lang)
      };
    }
    
    if (!challengeData.uid || !challengeData.email) {
      return {
        verified: false,
        error: bilingualError(webauthnMessages.challengeMismatch, 400, lang)
      };
    }
    
    // Verify origin matches
    if (challengeData.origin !== origin) {
      logger.warn('[WebAuthn] Origin mismatch', { 
        expected: challengeData.origin, 
        actual: origin 
      });
      return {
        verified: false,
        error: bilingualError(webauthnMessages.originMismatch, 403, lang)
      };
    }
    
    const { uid, email } = challengeData;
    
    // Determine if admin
    const adminDoc = await db.collection('employees').doc(uid).get();
    const isAdmin = adminDoc.exists;
    
    // Get credential
    const collectionPath = isAdmin ? 'employees' : 'users';
    const credentialId = isoBase64URL.fromBuffer(response.id);
    const credentialDoc = await db
      .collection(collectionPath)
      .doc(uid)
      .collection('webauthnCredentials')
      .doc(credentialId)
      .get();
    
    if (!credentialDoc.exists) {
      await logAuthEvent({
        eventType: 'authentication_failed',
        uid,
        timestamp: Timestamp.now(),
        success: false,
        errorMessage: 'Credential not found'
      });
      
      return {
        verified: false,
        error: bilingualError(webauthnMessages.credentialNotFound, 404, lang)
      };
    }
    
    const credential = credentialDoc.data() as WebAuthnCredential;
    
    // Check if revoked
    if (credential.isRevoked) {
      logger.warn('[WebAuthn] Revoked credential used', { uid, credId: credentialId });
      return {
        verified: false,
        error: bilingualError(webauthnMessages.deviceRevoked, 403, lang)
      };
    }
    
    // Check trust score
    if (credential.trustScore < webauthnConfig.deviceTrustThreshold) {
      logger.warn('[WebAuthn] Low trust device', { uid, credId: credentialId, trustScore: credential.trustScore });
      await recordAuthFailure(uid, isAdmin, credentialId, 'Low trust score');
      return {
        verified: false,
        error: bilingualError(webauthnMessages.deviceLowTrust, 403, lang)
      };
    }
    
    // Verify authentication response
    const verification: VerifiedAuthenticationResponse = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challengeData.challenge,
      expectedOrigin: origin,
      expectedRPID: rpId,
      credential: {
        id: credential.credId,
        publicKey: isoBase64URL.toBuffer(credential.publicKey),
        counter: credential.counter,
        transports: credential.transports,
      },
      requireUserVerification: webauthnConfig.requireUserVerification,
    });
    
    if (!verification.verified) {
      await recordAuthFailure(uid, isAdmin, credentialId, 'Verification failed');
      await logAuthEvent({
        eventType: 'authentication_failed',
        uid,
        deviceId: credentialId,
        timestamp: Timestamp.now(),
        success: false,
        errorMessage: 'Verification failed'
      });
      
      return {
        verified: false,
        error: bilingualError(webauthnMessages.authenticationFailed, 401, lang)
      };
    }
    
    // Update device after successful authentication
    await updateDeviceOnAuth(
      uid,
      isAdmin,
      credentialId,
      verification.authenticationInfo.newCounter,
      ipAddress,
      userAgent
    );
    
    // Clear challenge cookie
    clearChallengeFromCookie(res);
    
    logger.info('[WebAuthn] Authentication verified successfully', {
      uid,
      email,
      isAdmin,
      credId: credentialId.substring(0, 20) + '...',
      newCounter: verification.authenticationInfo.newCounter
    });
    
    return {
      verified: true,
      uid,
      email,
      isAdmin
    };
  } catch (error) {
    logger.error('[WebAuthn] Authentication verification failed', error);
    clearChallengeFromCookie(res);
    
    const challengeData = retrieveChallengeFromCookie(req);
    if (challengeData?.uid) {
      const adminDoc = await db.collection('employees').doc(challengeData.uid).get();
      const isAdmin = adminDoc.exists;
      const credentialId = isoBase64URL.fromBuffer(response.id);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await recordAuthFailure(challengeData.uid, isAdmin, credentialId, errorMessage);
    }
    
    return {
      verified: false,
      error: bilingualError(webauthnMessages.authenticationFailed, 500, getLanguage(req))
    };
  }
}

/**
 * Get all credentials for a user
 */
export async function getUserCredentials(uid: string, isAdmin: boolean): Promise<WebAuthnCredential[]> {
  return getUserDevices(uid, isAdmin);
}

/**
 * Delete a credential
 */
export async function deleteUserCredential(
  uid: string,
  credentialId: string,
  isAdmin: boolean
): Promise<void> {
  await revokeDevice(uid, isAdmin, credentialId, 'user_requested', uid, 'User requested deletion');
  
  logger.info('[WebAuthn] Credential deleted by user', {
    uid,
    credentialId: credentialId.substring(0, 20) + '...',
    isAdmin,
  });
}

/**
 * Rename a credential
 */
export async function renameUserCredential(
  uid: string,
  credentialId: string,
  newName: string,
  isAdmin: boolean
): Promise<void> {
  await registryRenameDevice(uid, isAdmin, credentialId, newName);
}

/**
 * Set credential icon
 */
export async function setUserCredentialIcon(
  uid: string,
  credentialId: string,
  icon: string,
  isAdmin: boolean
): Promise<void> {
  await registrySetDeviceIcon(uid, isAdmin, credentialId, icon);
}

/**
 * Check if re-authentication is required for sensitive action
 */
export function requireReAuth(lastAuthAt: Timestamp | undefined): boolean {
  return checkReAuthRequired(lastAuthAt, webauthnConfig.reAuthWindow / 60000);
}
