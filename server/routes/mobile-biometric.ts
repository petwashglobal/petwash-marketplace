/**
 * Mobile Biometric Authentication Routes - 2025-2026 Standards
 * 
 * NIST SP 800-63B AAL2 Compliant
 * FIDO2 / WebAuthn Level 3 Ready
 * False Match Rate (FMR): ≤ 1/10,000
 * 
 * Supports:
 * - iOS Face ID / Touch ID (LAContext)
 * - Android BiometricPrompt (BIOMETRIC_STRONG)
 * - Passkey Registration & Authentication
 * - Cross-device authentication (QR flows)
 * - Health data integration (Apple Health, Google Fit)
 */

import { Router, Request, Response } from 'express';
import { 
  generateRegistrationOptions,
  generateAuthenticationOptions,
  verifyRegistrationResponse,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import { isoBase64URL, isoUint8Array } from '@simplewebauthn/server/helpers';
import { db } from '../lib/firebase-admin';
import { logger } from '../lib/logger';
import { validateFirebaseToken } from '../middleware/firebase-auth';
import { Timestamp } from 'firebase-admin/firestore';
import crypto from 'crypto';

const router = Router();

// Configuration following NIST SP 800-63B standards
const MOBILE_CONFIG = {
  rpName: 'Pet Wash Premium',
  rpID: process.env.NODE_ENV === 'production' ? 'petwash.co.il' : 'localhost',
  timeout: 60000, // 60 seconds
  challengeExpiry: 300000, // 5 minutes
  maxDevicesPerUser: 10,
  falseMatchRate: 0.0001, // 1 in 10,000 (NIST requirement)
  userVerification: 'required' as const, // ✅ CRITICAL: Enforce biometric/PIN (NIST SP 800-63B AAL2)
  attestationType: 'none' as const, // For consumer apps (use 'direct' for enterprise)
};

/**
 * PASSKEY REGISTRATION - iOS/Android
 * 
 * POST /api/mobile/biometric/register/options
 * 
 * Client Flow:
 * iOS: Use AuthenticationServices with ASAuthorizationPlatformPublicKeyCredentialProvider
 * Android: Use CredentialManager with CreatePublicKeyCredentialRequest
 */
router.post('/register/options', validateFirebaseToken, async (req: Request, res: Response) => {
  try {
    const { uid, email } = req.firebaseUser!;
    const { deviceInfo } = req.body; // { platform: 'ios'|'android', osVersion, deviceName }
    
    logger.info('[Mobile Biometric] Registration options requested', { uid, email, deviceInfo });
    
    // Get existing credentials to exclude
    const credsSnapshot = await db
      .collection('users')
      .doc(uid)
      .collection('webauthnCredentials')
      .get();
    
    const excludeCredentials = credsSnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: data.credId,
        type: 'public-key' as const,
        transports: data.transports || ['internal', 'hybrid'],
      };
    });
    
    // Check device limit
    if (credsSnapshot.size >= MOBILE_CONFIG.maxDevicesPerUser) {
      return res.status(400).json({ 
        error: 'Maximum number of devices reached',
        maxDevices: MOBILE_CONFIG.maxDevicesPerUser
      });
    }
    
    // Generate registration options
    const options = await generateRegistrationOptions({
      rpName: MOBILE_CONFIG.rpName,
      rpID: MOBILE_CONFIG.rpID,
      userID: isoUint8Array.fromUTF8String(uid),
      userName: email,
      userDisplayName: email.split('@')[0],
      timeout: MOBILE_CONFIG.timeout,
      attestationType: MOBILE_CONFIG.attestationType,
      excludeCredentials,
      authenticatorSelection: {
        authenticatorAttachment: 'platform', // Platform authenticators (Face ID, Touch ID, etc.)
        requireResidentKey: true, // Required for passkeys
        residentKey: 'required',
        userVerification: MOBILE_CONFIG.userVerification,
      },
      supportedAlgorithmIDs: [-7, -257], // ES256, RS256
    });
    
    // Store challenge in Firestore (short-lived)
    await db
      .collection('users')
      .doc(uid)
      .collection('authChallenges')
      .doc('registration')
      .set({
        challenge: options.challenge,
        type: 'registration',
        createdAt: Timestamp.now(),
        expiresAt: Timestamp.fromMillis(Date.now() + MOBILE_CONFIG.challengeExpiry),
        deviceInfo,
      });
    
    // Audit log
    await db.collection('auditLogs').add({
      eventType: 'mobile_biometric_registration_started',
      uid,
      email,
      deviceInfo,
      timestamp: Timestamp.now(),
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    
    res.json({ options });
  } catch (error) {
    logger.error('[Mobile Biometric] Registration options failed', error);
    res.status(500).json({ error: 'Failed to generate registration options' });
  }
});

/**
 * VERIFY PASSKEY REGISTRATION
 * 
 * POST /api/mobile/biometric/register/verify
 * 
 * Client sends attestation response from device
 */
router.post('/register/verify', validateFirebaseToken, async (req: Request, res: Response) => {
  try {
    const { uid, email } = req.firebaseUser!;
    const { credential, deviceInfo } = req.body;
    
    // Retrieve challenge
    const challengeDoc = await db
      .collection('users')
      .doc(uid)
      .collection('authChallenges')
      .doc('registration')
      .get();
    
    if (!challengeDoc.exists) {
      return res.status(400).json({ error: 'Challenge not found or expired' });
    }
    
    const challengeData = challengeDoc.data()!;
    
    // Check expiry
    if (challengeData.expiresAt.toMillis() < Date.now()) {
      await challengeDoc.ref.delete();
      return res.status(400).json({ error: 'Challenge expired' });
    }
    
    // Determine expected origin based on environment
    const origin = req.headers.origin || `https://${MOBILE_CONFIG.rpID}`;
    const expectedOrigin = process.env.NODE_ENV === 'production' 
      ? `https://${MOBILE_CONFIG.rpID}`
      : origin; // Support localhost and staging in development
    
    // Verify registration (MUST enforce user verification for NIST AAL2 compliance)
    const verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge: challengeData.challenge,
      expectedOrigin,
      expectedRPID: MOBILE_CONFIG.rpID,
      requireUserVerification: true, // ✅ CRITICAL: Enforce biometric/PIN verification (NIST AAL2)
    });
    
    if (!verification.verified || !verification.registrationInfo) {
      await challengeDoc.ref.delete();
      return res.status(400).json({ error: 'Verification failed' });
    }
    
    // Extract credential data (@simplewebauthn/server v10+ API)
    const { credentialID, credentialPublicKey, counter, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
    const credId = typeof credentialID === 'string' ? credentialID : isoBase64URL.fromBuffer(credentialID);
    const publicKey = typeof credentialPublicKey === 'string' ? credentialPublicKey : isoBase64URL.fromBuffer(credentialPublicKey);
    
    // Store credential
    await db
      .collection('users')
      .doc(uid)
      .collection('webauthnCredentials')
      .doc(credId)
      .set({
        credId,
        publicKey,
        counter,
        deviceType: credentialDeviceType,
        backedUp: credentialBackedUp,
        transports: credential.response?.transports || ['internal', 'hybrid'],
        platform: deviceInfo?.platform || 'unknown',
        deviceName: deviceInfo?.deviceName || 'Mobile Device',
        osVersion: deviceInfo?.osVersion || 'unknown',
        createdAt: Timestamp.now(),
        lastUsedAt: Timestamp.now(),
        isRevoked: false,
        trustScore: 100, // Initial trust score
        authCount: 0,
        failedAttempts: 0,
      });
    
    // Delete challenge
    await challengeDoc.ref.delete();
    
    // Audit log (use normalized credId to avoid ArrayBuffer issues)
    await db.collection('auditLogs').add({
      eventType: 'mobile_biometric_registration_success',
      uid,
      email,
      deviceInfo,
      credentialId: credId.substring(0, 20) + '...',
      timestamp: Timestamp.now(),
    });
    
    logger.info('[Mobile Biometric] Registration successful', { uid, email, deviceInfo });
    
    res.json({ 
      success: true,
      credential: {
        id: credId,
        deviceName: deviceInfo?.deviceName || 'Mobile Device',
      }
    });
  } catch (error) {
    logger.error('[Mobile Biometric] Registration verification failed', error);
    res.status(500).json({ error: 'Registration verification failed' });
  }
});

/**
 * PASSKEY AUTHENTICATION - iOS/Android
 * 
 * POST /api/mobile/biometric/authenticate/options
 */
router.post('/authenticate/options', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email required' });
    }
    
    // Find user
    const usersSnapshot = await db.collection('users').where('email', '==', email).limit(1).get();
    
    if (usersSnapshot.empty) {
      return res.status(404).json({ error: 'No account found with this email' });
    }
    
    const userDoc = usersSnapshot.docs[0];
    const uid = userDoc.id;
    
    // Get credentials
    const credsSnapshot = await db
      .collection('users')
      .doc(uid)
      .collection('webauthnCredentials')
      .where('isRevoked', '==', false)
      .get();
    
    if (credsSnapshot.empty) {
      return res.status(404).json({ error: 'No biometric credentials found' });
    }
    
    const allowCredentials = credsSnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: data.credId,
        type: 'public-key' as const,
        transports: data.transports,
      };
    });
    
    // Generate authentication options
    const options = await generateAuthenticationOptions({
      rpID: MOBILE_CONFIG.rpID,
      timeout: MOBILE_CONFIG.timeout,
      allowCredentials,
      userVerification: MOBILE_CONFIG.userVerification,
    });
    
    // Store challenge
    await db
      .collection('users')
      .doc(uid)
      .collection('authChallenges')
      .doc('authentication')
      .set({
        challenge: options.challenge,
        type: 'authentication',
        email,
        createdAt: Timestamp.now(),
        expiresAt: Timestamp.fromMillis(Date.now() + MOBILE_CONFIG.challengeExpiry),
      });
    
    logger.info('[Mobile Biometric] Authentication options generated', { email, uid });
    
    res.json({ options, uid });
  } catch (error) {
    logger.error('[Mobile Biometric] Authentication options failed', error);
    res.status(500).json({ error: 'Failed to generate authentication options' });
  }
});

/**
 * VERIFY PASSKEY AUTHENTICATION
 * 
 * POST /api/mobile/biometric/authenticate/verify
 */
router.post('/authenticate/verify', async (req: Request, res: Response) => {
  try {
    const { credential, uid } = req.body;
    
    if (!uid) {
      return res.status(400).json({ error: 'User ID required' });
    }
    
    // Retrieve challenge
    const challengeDoc = await db
      .collection('users')
      .doc(uid)
      .collection('authChallenges')
      .doc('authentication')
      .get();
    
    if (!challengeDoc.exists) {
      return res.status(400).json({ error: 'Challenge not found or expired' });
    }
    
    const challengeData = challengeDoc.data()!;
    
    // Check expiry
    if (challengeData.expiresAt.toMillis() < Date.now()) {
      await challengeDoc.ref.delete();
      return res.status(400).json({ error: 'Challenge expired' });
    }
    
    // Get credential (normalize ID to match stored format)
    const credId = typeof credential.id === 'string' 
      ? credential.id 
      : isoBase64URL.fromBuffer(credential.id);
    
    const credDoc = await db
      .collection('users')
      .doc(uid)
      .collection('webauthnCredentials')
      .doc(credId)
      .get();
    
    if (!credDoc.exists) {
      return res.status(404).json({ error: 'Credential not found' });
    }
    
    const credData = credDoc.data()!;
    
    // Check if revoked
    if (credData.isRevoked) {
      return res.status(403).json({ error: 'Device has been revoked' });
    }
    
    // Determine expected origin based on environment
    const origin = req.headers.origin || `https://${MOBILE_CONFIG.rpID}`;
    const expectedOrigin = process.env.NODE_ENV === 'production' 
      ? `https://${MOBILE_CONFIG.rpID}`
      : origin; // Support localhost and staging in development
    
    // Verify authentication (MUST enforce user verification for NIST AAL2 compliance)
    const verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge: challengeData.challenge,
      expectedOrigin,
      expectedRPID: MOBILE_CONFIG.rpID,
      credential: {
        id: credData.credId,
        publicKey: isoBase64URL.toBuffer(credData.publicKey),
        counter: credData.counter,
        transports: credData.transports,
      },
      requireUserVerification: true, // ✅ CRITICAL: Enforce biometric/PIN verification (NIST AAL2)
    });
    
    if (!verification.verified) {
      // Record failed attempt
      await credDoc.ref.update({
        failedAttempts: (credData.failedAttempts || 0) + 1,
        lastFailedAt: Timestamp.now(),
      });
      
      await challengeDoc.ref.delete();
      return res.status(401).json({ error: 'Authentication failed' });
    }
    
    // Update credential
    await credDoc.ref.update({
      counter: verification.authenticationInfo.newCounter,
      lastUsedAt: Timestamp.now(),
      authCount: (credData.authCount || 0) + 1,
      failedAttempts: 0,
    });
    
    // Get user data
    const userDoc = await db.collection('users').doc(uid).get();
    const userData = userDoc.data()!;
    
    // Delete challenge
    await challengeDoc.ref.delete();
    
    // Create Firebase custom token for mobile app
    const admin = await import('firebase-admin');
    const token = await admin.default.auth().createCustomToken(uid);
    
    // Audit log (use normalized credId)
    await db.collection('auditLogs').add({
      eventType: 'mobile_biometric_authentication_success',
      uid,
      email: userData.email,
      credentialId: credId.substring(0, 20) + '...',
      timestamp: Timestamp.now(),
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    
    logger.info('[Mobile Biometric] Authentication successful', { uid, email: userData.email });
    
    res.json({ 
      success: true,
      token, // Firebase custom token for mobile app
      user: {
        uid,
        email: userData.email,
        displayName: userData.displayName,
        loyaltyTier: userData.loyaltyTier,
      }
    });
  } catch (error) {
    logger.error('[Mobile Biometric] Authentication verification failed', error);
    res.status(500).json({ error: 'Authentication verification failed' });
  }
});

/**
 * HEALTH DATA INTEGRATION - Apple Health & Google Fit
 * Privacy-compliant with explicit consent management
 */

/**
 * REQUEST HEALTH DATA CONSENT
 * 
 * POST /api/mobile/health/consent
 */
router.post('/health/consent', validateFirebaseToken, async (req: Request, res: Response) => {
  try {
    const { uid } = req.firebaseUser!;
    const { platform, permissions } = req.body; // { platform: 'apple'|'google', permissions: ['steps', 'distance'] }
    
    // Store consent
    await db.collection('users').doc(uid).collection('healthConsent').doc(platform).set({
      platform,
      permissions,
      grantedAt: Timestamp.now(),
      status: 'active',
      canRevoke: true,
    });
    
    // Audit log
    await db.collection('auditLogs').add({
      eventType: 'health_data_consent_granted',
      uid,
      platform,
      permissions,
      timestamp: Timestamp.now(),
    });
    
    logger.info('[Health Data] Consent granted', { uid, platform, permissions });
    
    res.json({ success: true });
  } catch (error) {
    logger.error('[Health Data] Consent failed', error);
    res.status(500).json({ error: 'Failed to record consent' });
  }
});

/**
 * SYNC HEALTH DATA
 * 
 * POST /api/mobile/health/sync
 * 
 * Client sends health data after user consent
 */
router.post('/health/sync', validateFirebaseToken, async (req: Request, res: Response) => {
  try {
    const { uid } = req.firebaseUser!;
    const { platform, data } = req.body; 
    // data: { steps: 5234, distance: 3210, date: '2025-10-28' }
    
    // Verify consent exists
    const consentDoc = await db
      .collection('users')
      .doc(uid)
      .collection('healthConsent')
      .doc(platform)
      .get();
    
    if (!consentDoc.exists || consentDoc.data()?.status !== 'active') {
      return res.status(403).json({ error: 'Health data consent required' });
    }
    
    // Store health data (minimal retention)
    const healthRef = db.collection('users').doc(uid).collection('healthData').doc();
    await healthRef.set({
      platform,
      steps: data.steps || 0,
      distance: data.distance || 0,
      date: data.date,
      syncedAt: Timestamp.now(),
      // Data retention: Auto-delete after 30 days (compliance)
      expiresAt: Timestamp.fromMillis(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });
    
    logger.info('[Health Data] Synced', { uid, platform, steps: data.steps, distance: data.distance });
    
    res.json({ success: true });
  } catch (error) {
    logger.error('[Health Data] Sync failed', error);
    res.status(500).json({ error: 'Failed to sync health data' });
  }
});

/**
 * REVOKE HEALTH DATA CONSENT
 * 
 * DELETE /api/mobile/health/consent/:platform
 */
router.delete('/health/consent/:platform', validateFirebaseToken, async (req: Request, res: Response) => {
  try {
    const { uid } = req.firebaseUser!;
    const { platform } = req.params;
    
    // Update consent status
    await db
      .collection('users')
      .doc(uid)
      .collection('healthConsent')
      .doc(platform)
      .update({
        status: 'revoked',
        revokedAt: Timestamp.now(),
      });
    
    // Delete all health data
    const healthDataSnapshot = await db
      .collection('users')
      .doc(uid)
      .collection('healthData')
      .where('platform', '==', platform)
      .get();
    
    const batch = db.batch();
    healthDataSnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    await batch.commit();
    
    // Audit log
    await db.collection('auditLogs').add({
      eventType: 'health_data_consent_revoked',
      uid,
      platform,
      dataDeleted: healthDataSnapshot.size,
      timestamp: Timestamp.now(),
    });
    
    logger.info('[Health Data] Consent revoked and data deleted', { uid, platform });
    
    res.json({ success: true, deletedRecords: healthDataSnapshot.size });
  } catch (error) {
    logger.error('[Health Data] Revocation failed', error);
    res.status(500).json({ error: 'Failed to revoke consent' });
  }
});

/**
 * GET USER'S DEVICES
 * 
 * GET /api/mobile/biometric/devices
 */
router.get('/devices', validateFirebaseToken, async (req: Request, res: Response) => {
  try {
    const { uid } = req.firebaseUser!;
    
    const credsSnapshot = await db
      .collection('users')
      .doc(uid)
      .collection('webauthnCredentials')
      .where('isRevoked', '==', false)
      .get();
    
    const devices = credsSnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: data.credId,
        deviceName: data.deviceName,
        platform: data.platform,
        createdAt: data.createdAt.toDate(),
        lastUsedAt: data.lastUsedAt.toDate(),
        trustScore: data.trustScore,
        authCount: data.authCount,
      };
    });
    
    res.json({ devices });
  } catch (error) {
    logger.error('[Mobile Biometric] Failed to get devices', error);
    res.status(500).json({ error: 'Failed to retrieve devices' });
  }
});

/**
 * REVOKE DEVICE
 * 
 * DELETE /api/mobile/biometric/devices/:deviceId
 */
router.delete('/devices/:deviceId', validateFirebaseToken, async (req: Request, res: Response) => {
  try {
    const { uid } = req.firebaseUser!;
    const { deviceId } = req.params;
    
    await db
      .collection('users')
      .doc(uid)
      .collection('webauthnCredentials')
      .doc(deviceId)
      .update({
        isRevoked: true,
        revokedAt: Timestamp.now(),
        revokedBy: uid,
        revokedReason: 'user_requested',
      });
    
    // Audit log
    await db.collection('auditLogs').add({
      eventType: 'mobile_biometric_device_revoked',
      uid,
      deviceId: deviceId.substring(0, 20) + '...',
      timestamp: Timestamp.now(),
    });
    
    logger.info('[Mobile Biometric] Device revoked', { uid, deviceId });
    
    res.json({ success: true });
  } catch (error) {
    logger.error('[Mobile Biometric] Failed to revoke device', error);
    res.status(500).json({ error: 'Failed to revoke device' });
  }
});

export default router;
