/**
 * Unified WebAuthn Service - Banking-Level Authentication
 * Consolidates device registry, server-side single-use challenges, and comprehensive security
 *
 * 2026-09-13 — passkey sign-in had never worked in production. Stacked causes,
 * all fixed here and in ./config.ts / ./challengeStore.ts / ./deviceRegistry.ts:
 *   1. expected origin was built from the Host header (the Cloud Run run.app host
 *      behind Firebase Hosting) -> every ceremony refused as "unauthorized origin".
 *   2. the challenge lived in a `wa_challenge` cookie, which Firebase Hosting strips
 *      -> verify could never find it. Now server-side in Redis, single-use, bound.
 *   3. the credential id was read as `isoBase64URL.fromBuffer(response.id)`; in
 *      @simplewebauthn v13 `response.id` is already a base64url STRING, and
 *      `new Uint8Array(string)` is empty -> every lookup was for credId "".
 *   4. deviceRegistry used `db.FieldValue` (undefined) -> enrolment and login threw
 *      after the credential was written / verified.
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
  resolveCeremonyContext,
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
import {
  issueChallenge,
  consumeChallenge,
  type ConsumeRefusal,
  type StoredChallenge,
} from './challengeStore';
import type { WebAuthnCredential } from '../types/webauthn';
import { webauthnMessages, getLanguage, bilingualError, type Language } from '../lib/i18n';

export type WebAuthnServiceError = ReturnType<typeof bilingualError>;

/**
 * Map a service error onto an HTTP response. `bilingualError` returns
 * `{ error, error_en, error_he, statusCode }` — the routes used to read
 * `error.status` / `error.message`, which do not exist, so every failure
 * became a generic 400 and the real reason was lost.
 */
export function sendWebAuthnError(
  res: any,
  err: WebAuthnServiceError | undefined,
  fallbackStatus: number,
  fallbackMessage: string,
): void {
  if (!err) {
    res.status(fallbackStatus).json({ error: fallbackMessage });
    return;
  }
  res.status(err.statusCode || fallbackStatus).json({
    error: err.error || fallbackMessage,
    error_en: err.error_en,
    error_he: err.error_he,
  });
}

function refusalToError(reason: ConsumeRefusal, lang: Language): WebAuthnServiceError {
  switch (reason) {
    case 'store_unavailable':
      return bilingualError(webauthnMessages.challengeStoreUnavailable, 503, lang);
    case 'mismatch':
      return bilingualError(webauthnMessages.challengeMismatch, 400, lang);
    case 'expired':
      return bilingualError(webauthnMessages.challengeExpired, 400, lang);
    case 'invalid_id':
    case 'not_found':
    default:
      return bilingualError(webauthnMessages.challengeNotFound, 400, lang);
  }
}

function clientIp(req: any): string {
  return req.ip || req.connection?.remoteAddress || 'unknown';
}

/** base64url credential id as sent by the browser (response.id). */
const CREDENTIAL_ID_RE = /^[A-Za-z0-9_-]{16,1024}$/;

export function readCredentialId(response: any): string | null {
  const id = response?.id;
  if (typeof id !== 'string' || !CREDENTIAL_ID_RE.test(id)) return null;
  // @simplewebauthn also enforces id === rawId; refuse early so we never look up
  // a credential by one value and verify another.
  if (typeof response?.rawId === 'string' && response.rawId !== id) return null;
  return id;
}

/** Printable uid characters only — no control chars, no replacement char from bad UTF-8. */
const SAFE_UID_RE = /^[^/\s\x00-\x1f\x7f�]{1,128}$/;

/**
 * The uid we put in `userID` at registration, recovered from the assertion's
 * userHandle (discoverable credentials always return it). Only used to find
 * WHERE the credential doc lives; the signature check against that doc's public
 * key is what authenticates.
 */
export function uidFromUserHandle(userHandle: unknown): string | null {
  if (typeof userHandle !== 'string' || !userHandle) return null;
  let uid: string;
  try {
    uid = Buffer.from(userHandle, 'base64url').toString('utf8');
  } catch {
    return null;
  }
  if (uid === '.' || uid === '..' || !SAFE_UID_RE.test(uid)) return null;
  return uid;
}

/**
 * Generate registration options for a user (customer or employee)
 */
export async function generateRegistrationOptionsForUser(
  uid: string,
  email: string,
  isAdmin: boolean,
  req: any,
): Promise<{ options: any; success: boolean; challengeId?: string; error?: WebAuthnServiceError }> {
  try {
    const lang = getLanguage(req);
    const { origin, rpId, allowed } = resolveCeremonyContext(req);
    const ipAddress = clientIp(req);

    if (!allowed) {
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
        id: data.credId, // base64url string
        type: 'public-key' as const,
        transports: data.transports || ['internal', 'hybrid'],
      };
    });

    if (credentialsSnapshot.size >= webauthnConfig.maxDevicesPerUser) {
      logger.warn('[WebAuthn] Max devices reached', { uid, count: credentialsSnapshot.size });
      return {
        success: false,
        error: bilingualError(webauthnMessages.tooManyDevices, 400, lang),
        options: null
      };
    }

    const options = await generateRegistrationOptions({
      rpName: webauthnConfig.rpName,
      rpID: rpId,
      userID: isoUint8Array.fromUTF8String(uid),
      userName: email,
      userDisplayName: email.split('@')[0],
      timeout: webauthnConfig.timeout,
      attestationType: 'direct', // Request attestation certificate to verify device authenticity
      excludeCredentials,
      authenticatorSelection: getAuthenticatorSelection(),
      supportedAlgorithmIDs: getSupportedAlgorithms(),
    });

    const issued = await issueChallenge({
      challenge: options.challenge,
      type: 'registration',
      rpId,
      origin,
      uid,
      email,
      collection: collectionPath,
      discoverable: false,
    });
    if (!issued.ok) {
      return {
        success: false,
        error: bilingualError(webauthnMessages.challengeStoreUnavailable, 503, lang),
        options: null
      };
    }

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
      isAdmin,
      rpId,
      excludedCount: excludeCredentials.length
    });

    return {
      success: true,
      options,
      challengeId: issued.challengeId,
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
 * Verify registration response and store credential.
 *
 * `expectedUid` is the signed-in caller. The challenge must have been issued to
 * that same uid — a challenge minted for account A can never enrol a passkey on
 * account B.
 */
export async function verifyAndStoreRegistration(
  response: any,
  challengeId: unknown,
  expectedUid: string,
  req: any,
): Promise<{ verified: boolean; credential?: WebAuthnCredential; error?: WebAuthnServiceError }> {
  try {
    const lang = getLanguage(req);
    const { origin, rpId, allowed } = resolveCeremonyContext(req);
    const ipAddress = clientIp(req);
    const userAgent = req.headers['user-agent'] || 'unknown';

    if (!allowed) {
      logger.warn('[WebAuthn] Registration verify from unauthorized origin', { origin, uid: expectedUid });
      return { verified: false, error: bilingualError(webauthnMessages.originMismatch, 403, lang) };
    }

    const consumed = await consumeChallenge(challengeId, {
      type: 'registration',
      rpId,
      origin,
      uid: expectedUid,
    });
    if (!consumed.ok) {
      return { verified: false, error: refusalToError(consumed.reason, lang) };
    }
    const challengeData = consumed.record;

    if (!challengeData.uid || !challengeData.email) {
      return { verified: false, error: bilingualError(webauthnMessages.challengeMismatch, 400, lang) };
    }

    const verification: VerifiedRegistrationResponse = await verifyRegistrationResponse({
      response,
      expectedChallenge: challengeData.challenge,
      expectedOrigin: challengeData.origin,
      expectedRPID: challengeData.rpId,
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

      return { verified: false, error: bilingualError(webauthnMessages.registrationFailed, 400, lang) };
    }

    const { credential, credentialDeviceType, credentialBackedUp, aaguid } =
      verification.registrationInfo;
    const { id: credentialID, publicKey: credentialPublicKey, counter } = credential;

    const attestationFormat = verification.registrationInfo.fmt;
    let attestationCertificate = null;

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

    if (webauthnConfig.enableAttestationValidation && verification.registrationInfo.fmt) {
      const fmt = verification.registrationInfo.fmt;

      if (!isAttestationFormatAllowed(fmt)) {
        logger.warn('[WebAuthn] Attestation format not allowed', { fmt });
        return { verified: false, error: bilingualError(webauthnMessages.attestationFailed, 400, lang) };
      }

      if (fmt === 'apple' && !validateAppleAttestation(verification.registrationInfo)) {
        return { verified: false, error: bilingualError(webauthnMessages.attestationFailed, 400, lang) };
      }

      if ((fmt === 'android-key' || fmt === 'android-safetynet') &&
          !validateAndroidAttestation(verification.registrationInfo)) {
        return { verified: false, error: bilingualError(webauthnMessages.attestationFailed, 400, lang) };
      }
    }

    // The collection the options step excluded credentials from — the same one
    // the route's isAdmin decision picked for this signed-in caller.
    const isAdmin = challengeData.collection === 'employees';

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
        attestationData: attestationCertificate || verification.registrationInfo
      },
      userAgent,
      ipAddress,
      origin
    );

    logger.info('[WebAuthn] Registration verified and credential stored', {
      uid: challengeData.uid,
      credId: registeredCredential.credId.substring(0, 20) + '...',
      isAdmin,
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp
    });

    return { verified: true, credential: registeredCredential };
  } catch (error) {
    logger.error('[WebAuthn] Registration verification failed', error);
    return {
      verified: false,
      error: bilingualError(webauthnMessages.registrationFailed, 400, getLanguage(req))
    };
  }
}

/**
 * Generate authentication options for login (email-scoped)
 */
export async function generateAuthenticationOptionsForEmail(
  email: string,
  req: any,
): Promise<{ options: any; success: boolean; challengeId?: string; error?: WebAuthnServiceError }> {
  try {
    const lang = getLanguage(req);
    const { origin, rpId, allowed } = resolveCeremonyContext(req);
    const ipAddress = clientIp(req);

    if (!allowed) {
      logger.warn('[WebAuthn] Authentication attempted from unauthorized origin', { origin });
      return {
        success: false,
        error: bilingualError(webauthnMessages.originMismatch, 403, lang),
        options: null
      };
    }

    let uid: string | null = null;
    let isAdmin = false;
    let credentials: WebAuthnCredential[] = [];

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
      logger.warn('[WebAuthn] No credentials found for email lookup');
      return {
        success: false,
        error: bilingualError(webauthnMessages.noCredentialsForEmail, 404, lang),
        options: null
      };
    }

    const trustedCredentials = credentials.filter(
      cred => cred.trustScore >= webauthnConfig.deviceTrustThreshold
    );

    if (trustedCredentials.length === 0) {
      logger.warn('[WebAuthn] No trusted credentials found', { uid });
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

    const issued = await issueChallenge({
      challenge: options.challenge,
      type: 'authentication',
      rpId,
      origin,
      uid,
      email,
      collection: isAdmin ? 'employees' : 'users',
      discoverable: false,
    });
    if (!issued.ok) {
      return {
        success: false,
        error: bilingualError(webauthnMessages.challengeStoreUnavailable, 503, lang),
        options: null
      };
    }

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
      uid,
      isAdmin,
      credentialCount: trustedCredentials.length
    });

    return { success: true, options, challengeId: issued.challengeId };
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
 * Generate authentication options for discoverable credentials (no email required).
 * Called by the conditional-UI probe on every signed-out page load, so it needs
 * no user and must answer a normal 200 whenever the origin is allowed and the
 * challenge store is up.
 */
export async function generateDiscoverableAuthenticationOptions(
  req: any,
): Promise<{ options: any; success: boolean; challengeId?: string; error?: WebAuthnServiceError }> {
  try {
    const lang = getLanguage(req);
    const { origin, rpId, allowed } = resolveCeremonyContext(req);

    if (!allowed) {
      logger.warn('[WebAuthn] Discoverable auth from unauthorized origin', { origin });
      return {
        success: false,
        error: bilingualError(webauthnMessages.originMismatch, 403, lang),
        options: null
      };
    }

    const options = await generateAuthenticationOptions({
      rpID: rpId,
      timeout: webauthnConfig.timeout,
      allowCredentials: [],
      userVerification: 'required',
    });

    const issued = await issueChallenge({
      challenge: options.challenge,
      type: 'authentication',
      rpId,
      origin,
      uid: null,
      email: null,
      collection: null,
      discoverable: true,
    });
    if (!issued.ok) {
      return {
        success: false,
        error: bilingualError(webauthnMessages.challengeStoreUnavailable, 503, lang),
        options: null
      };
    }

    logger.info('[WebAuthn] Discoverable authentication options generated', { rpId, origin });

    return { success: true, options, challengeId: issued.challengeId };
  } catch (error) {
    logger.error('[WebAuthn] Failed to generate discoverable authentication options', error);
    return {
      success: false,
      error: bilingualError(webauthnMessages.authenticationFailed, 500, getLanguage(req)),
      options: null
    };
  }
}

type AuthResult = { verified: boolean; uid?: string; email?: string; isAdmin?: boolean; error?: WebAuthnServiceError };

/**
 * Verify a passkey assertion. The challenge is consumed (single use) FIRST; the
 * stored record — not anything the client says — decides whether this is a
 * discoverable or an email-scoped ceremony.
 */
export async function verifyAuthentication(
  response: any,
  challengeId: unknown,
  req: any,
): Promise<AuthResult> {
  const lang = getLanguage(req);
  const ctx = resolveCeremonyContext(req);

  if (!ctx.allowed) {
    logger.warn('[WebAuthn] Authentication verify from unauthorized origin', { origin: ctx.origin });
    return { verified: false, error: bilingualError(webauthnMessages.originMismatch, 403, lang) };
  }

  let consumed: Awaited<ReturnType<typeof consumeChallenge>>;
  try {
    consumed = await consumeChallenge(challengeId, {
      type: 'authentication',
      rpId: ctx.rpId,
      origin: ctx.origin,
    });
  } catch (error) {
    logger.error('[WebAuthn] challenge consume threw', error);
    return { verified: false, error: refusalToError('store_unavailable', lang) };
  }
  if (!consumed.ok) {
    return { verified: false, error: refusalToError(consumed.reason, lang) };
  }

  return consumed.record.discoverable
    ? verifyDiscoverableAuthentication(response, consumed.record, req)
    : verifyAuthenticationAndGetUser(response, consumed.record, req);
}

/**
 * Verify discoverable credential authentication - finds user by userHandle + credential ID.
 * `challengeData` must come from consumeChallenge (already single-use-checked and bound).
 */
export async function verifyDiscoverableAuthentication(
  response: any,
  challengeData: StoredChallenge,
  req: any,
): Promise<AuthResult> {
  try {
    const lang = getLanguage(req);
    const ipAddress = clientIp(req);
    const userAgent = req.headers['user-agent'] || 'unknown';

    if (challengeData.type !== 'authentication' || !challengeData.discoverable) {
      return { verified: false, error: bilingualError(webauthnMessages.challengeMismatch, 400, lang) };
    }

    const credentialId = readCredentialId(response);
    if (!credentialId) {
      return { verified: false, error: bilingualError(webauthnMessages.credentialNotFound, 404, lang) };
    }

    let uid: string | null = null;
    let email: string | null = null;
    let isAdmin = false;
    let credential: WebAuthnCredential | null = null;

    const handleUid = uidFromUserHandle(response?.response?.userHandle);
    if (handleUid) {
      // Admin collection first — registerDevice files a credential under
      // `employees` whenever that doc exists.
      for (const collection of ['employees', 'users'] as const) {
        const credDoc = await db
          .collection(collection)
          .doc(handleUid)
          .collection('webauthnCredentials')
          .doc(credentialId)
          .get();
        if (credDoc.exists) {
          credential = credDoc.data() as WebAuthnCredential;
          uid = handleUid;
          isAdmin = collection === 'employees';
          const userDoc = await db.collection(collection).doc(handleUid).get();
          email = userDoc.exists ? (userDoc.data()?.email || '') : '';
          break;
        }
      }
    }

    if (!uid || !credential || credential.credId !== credentialId) {
      logger.warn('[WebAuthn] Discoverable credential not found', {
        credentialId: credentialId.substring(0, 12) + '...',
        hadUserHandle: !!handleUid,
      });
      return { verified: false, error: bilingualError(webauthnMessages.credentialNotFound, 404, lang) };
    }

    if (credential.isRevoked) {
      logger.warn('[WebAuthn] Discoverable credential is revoked', { uid });
      return { verified: false, error: bilingualError(webauthnMessages.deviceRevoked, 403, lang) };
    }

    if (credential.trustScore < webauthnConfig.deviceTrustThreshold) {
      logger.warn('[WebAuthn] Low trust discoverable device', { uid });
      return { verified: false, error: bilingualError(webauthnMessages.deviceLowTrust, 403, lang) };
    }

    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challengeData.challenge,
      expectedOrigin: challengeData.origin,
      expectedRPID: challengeData.rpId,
      credential: {
        id: credential.credId,
        publicKey: isoBase64URL.toBuffer(credential.publicKey),
        counter: credential.counter,
        transports: credential.transports as any[],
      },
      requireUserVerification: true,
    });

    if (!verification.verified) {
      await recordAuthFailure(uid, isAdmin, credentialId, 'Verification failed');
      return { verified: false, error: bilingualError(webauthnMessages.authenticationFailed, 401, lang) };
    }

    // updateDeviceOnAuth's signature is (uid, isAdmin, credId, newCounter,
    // ipAddress, userAgent) — positional.
    await updateDeviceOnAuth(
      uid,
      isAdmin,
      credentialId,
      verification.authenticationInfo.newCounter,
      ipAddress,
      userAgent,
    );

    await logAuthEvent({
      eventType: 'authentication_completed',
      uid,
      deviceId: credentialId,
      timestamp: Timestamp.now(),
      success: true,
      metadata: {
        rpId: challengeData.rpId,
        origin: challengeData.origin,
        ipAddress,
      }
    });

    logger.info('[WebAuthn] Discoverable authentication successful', { uid, isAdmin });

    return { verified: true, uid, email: email || undefined, isAdmin };
  } catch (error) {
    logger.error('[WebAuthn] Discoverable authentication verification failed', error);
    return {
      verified: false,
      error: bilingualError(webauthnMessages.authenticationFailed, 401, getLanguage(req))
    };
  }
}

/**
 * Verify an email-scoped authentication response and return user info.
 * `challengeData` must come from consumeChallenge (already single-use-checked and bound).
 */
export async function verifyAuthenticationAndGetUser(
  response: any,
  challengeData: StoredChallenge,
  req: any,
): Promise<AuthResult> {
  const lang = getLanguage(req);
  const ipAddress = clientIp(req);
  const userAgent = req.headers['user-agent'] || 'unknown';

  if (challengeData.type !== 'authentication' || challengeData.discoverable || !challengeData.uid || !challengeData.email) {
    return { verified: false, error: bilingualError(webauthnMessages.challengeMismatch, 400, lang) };
  }

  const uid = challengeData.uid;
  const email = challengeData.email;
  const isAdmin = challengeData.collection === 'employees';
  const collectionPath = isAdmin ? 'employees' : 'users';

  const credentialId = readCredentialId(response);
  if (!credentialId) {
    return { verified: false, error: bilingualError(webauthnMessages.credentialNotFound, 404, lang) };
  }

  try {
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

      return { verified: false, error: bilingualError(webauthnMessages.credentialNotFound, 404, lang) };
    }

    const credential = credentialDoc.data() as WebAuthnCredential;

    if (credential.isRevoked) {
      logger.warn('[WebAuthn] Revoked credential used', { uid });
      return { verified: false, error: bilingualError(webauthnMessages.deviceRevoked, 403, lang) };
    }

    if (credential.trustScore < webauthnConfig.deviceTrustThreshold) {
      logger.warn('[WebAuthn] Low trust device', { uid, trustScore: credential.trustScore });
      await recordAuthFailure(uid, isAdmin, credentialId, 'Low trust score');
      return { verified: false, error: bilingualError(webauthnMessages.deviceLowTrust, 403, lang) };
    }

    const verification: VerifiedAuthenticationResponse = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challengeData.challenge,
      expectedOrigin: challengeData.origin,
      expectedRPID: challengeData.rpId,
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
      return { verified: false, error: bilingualError(webauthnMessages.authenticationFailed, 401, lang) };
    }

    await updateDeviceOnAuth(
      uid,
      isAdmin,
      credentialId,
      verification.authenticationInfo.newCounter,
      ipAddress,
      userAgent
    );

    logger.info('[WebAuthn] Authentication verified successfully', {
      uid,
      isAdmin,
      credId: credentialId.substring(0, 20) + '...',
      newCounter: verification.authenticationInfo.newCounter
    });

    return { verified: true, uid, email, isAdmin };
  } catch (error) {
    logger.error('[WebAuthn] Authentication verification failed', error);
    try {
      await recordAuthFailure(uid, isAdmin, credentialId, error instanceof Error ? error.message : 'Unknown error');
    } catch (recordErr) {
      logger.warn('[WebAuthn] could not record auth failure', {
        error: recordErr instanceof Error ? recordErr.message : String(recordErr),
      });
    }
    return {
      verified: false,
      error: bilingualError(webauthnMessages.authenticationFailed, 401, lang)
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
