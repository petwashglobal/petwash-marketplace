/**
 * WebAuthn Device Registry Service
 * Banking-level device lifecycle management, trust scoring, and security monitoring
 */

import { db } from '../lib/firebase-admin';
import { logger } from '../lib/logger';
import { Timestamp } from 'firebase-admin/firestore';
import type {
  WebAuthnCredential,
  DeviceTrustFactors,
  DeviceRevocationRecord,
  DeviceUsagePattern,
  PasskeyAuthEvent
} from '../types/webauthn';

/**
 * Calculate device trust score (0-100)
 * Based on usage patterns, age, failures, and security characteristics
 */
export function calculateDeviceTrustScore(
  credential: WebAuthnCredential,
  factors: Partial<DeviceTrustFactors>
): number {
  let score = 50; // Start at neutral

  // Age factor (0-20 points): older devices are more trusted
  if (factors.ageInDays) {
    if (factors.ageInDays > 90) score += 20;
    else if (factors.ageInDays > 30) score += 15;
    else if (factors.ageInDays > 7) score += 10;
    else score += 5;
  }

  // Usage frequency (0-25 points): regular use builds trust
  if (factors.usageFrequency !== undefined) {
    if (factors.usageFrequency > 50) score += 25;
    else if (factors.usageFrequency > 20) score += 20;
    else if (factors.usageFrequency > 5) score += 10;
    else score += 5;
  }

  // Failure rate (-30 to +10 points)
  if (factors.failureRate !== undefined) {
    if (factors.failureRate === 0) score += 10;
    else if (factors.failureRate < 0.05) score += 5;
    else if (factors.failureRate < 0.1) score += 0;
    else if (factors.failureRate < 0.2) score -= 10;
    else score -= 30;
  }

  // Backup status (0-10 points): backed up devices are slightly more trusted
  if (factors.isBackedUp) score += 10;

  // Attestation validation (0-15 points)
  if (factors.hasValidAttestation) score += 15;

  // Consistent location (0-10 points)
  if (factors.consistentLocation) score += 10;

  // Consistent user agent (0-10 points)
  if (factors.consistentUserAgent) score += 10;

  // Ensure score is between 0-100
  return Math.max(0, Math.min(100, score));
}

/**
 * Get risk level based on trust score
 */
export function getRiskLevel(trustScore: number): 'low' | 'medium' | 'high' {
  if (trustScore >= 70) return 'low';
  if (trustScore >= 40) return 'medium';
  return 'high';
}

/**
 * Get device icon based on platform and transports
 */
export function getDeviceIcon(credential: Partial<WebAuthnCredential>): string {
  const platform = credential.platform || 'unknown';
  const transports = credential.transports || [];

  if (platform === 'ios') return '📱';
  if (platform === 'android') return '🤖';
  if (platform === 'macos') return '💻';
  if (platform === 'windows') return '🖥️';
  
  if (transports.includes('usb')) return '🔑';
  if (transports.includes('nfc')) return '📲';
  if (transports.includes('ble')) return '🔵';
  
  return '🔐';
}

/**
 * Detect platform from user agent
 */
export function detectPlatform(userAgent: string): WebAuthnCredential['platform'] {
  const ua = userAgent.toLowerCase();
  
  if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod')) return 'ios';
  if (ua.includes('android')) return 'android';
  if (ua.includes('windows')) return 'windows';
  if (ua.includes('macintosh') || ua.includes('mac os')) return 'macos';
  if (ua.includes('linux')) return 'linux';
  
  return 'unknown';
}

/**
 * Extract browser info from user agent
 */
export function extractBrowserInfo(userAgent: string): { name: string; version: string } {
  const ua = userAgent.toLowerCase();
  
  // Check for common browsers
  if (ua.includes('edg/')) {
    const match = ua.match(/edg\/([\d.]+)/);
    return { name: 'Edge', version: match?.[1] || 'unknown' };
  }
  if (ua.includes('chrome/')) {
    const match = ua.match(/chrome\/([\d.]+)/);
    return { name: 'Chrome', version: match?.[1] || 'unknown' };
  }
  if (ua.includes('safari/') && !ua.includes('chrome')) {
    const match = ua.match(/version\/([\d.]+)/);
    return { name: 'Safari', version: match?.[1] || 'unknown' };
  }
  if (ua.includes('firefox/')) {
    const match = ua.match(/firefox\/([\d.]+)/);
    return { name: 'Firefox', version: match?.[1] || 'unknown' };
  }
  
  return { name: 'Unknown', version: 'unknown' };
}

/**
 * Register a new device credential
 */
export async function registerDevice(
  uid: string,
  isAdmin: boolean,
  credentialData: Partial<WebAuthnCredential>,
  userAgent: string,
  ipAddress: string,
  origin: string
): Promise<WebAuthnCredential> {
  const now = Timestamp.now();
  const platform = detectPlatform(userAgent);
  const browser = extractBrowserInfo(userAgent);
  
  const credential: WebAuthnCredential = {
    credId: credentialData.credId!,
    publicKey: credentialData.publicKey!,
    counter: credentialData.counter || 0,
    
    // Device identification
    deviceName: credentialData.deviceName || `${platform} Device`,
    deviceIcon: credentialData.deviceIcon || getDeviceIcon({ platform, transports: credentialData.transports }),
    aaguid: credentialData.aaguid,
    
    // Transport & capabilities
    transports: credentialData.transports || [],
    deviceType: credentialData.deviceType || 'singleDevice',
    backedUp: credentialData.backedUp || false,
    backupEligible: credentialData.backupEligible,
    backupState: credentialData.backupState,
    
    // Timestamps
    createdAt: now,
    lastUsedAt: now,
    updatedAt: now,
    
    // Registration context
    userAgent,
    ipAddress,
    registrationOrigin: origin,
    
    // Trust & security (new device starts with moderate trust)
    trustScore: 50,
    riskLevel: 'medium',
    isRevoked: false,
    
    // Usage analytics
    usageCount: 0,
    lastAuthSuccess: now,
    consecutiveFailures: 0,
    
    // Attestation
    attestationFormat: credentialData.attestationFormat,
    attestationData: credentialData.attestationData,
    
    // Platform detection
    platform,
    browserName: browser.name,
    browserVersion: browser.version
  };
  
  // Store in Firestore
  const collectionPath = isAdmin ? 'employees' : 'users';
  await db
    .collection(collectionPath)
    .doc(uid)
    .collection('webauthnCredentials')
    .doc(credential.credId)
    .set(credential);
  
  // Update user status
  await db.collection(collectionPath).doc(uid).update({
    hasPasskey: true,
    passkeyCreatedAt: now,
    lastPasskeyUsedAt: now,
    totalDevices: db.FieldValue.increment(1)
  });
  
  // Log analytics event
  await logAuthEvent({
    eventType: 'registration_completed',
    uid,
    deviceId: credential.credId,
    timestamp: now,
    success: true,
    metadata: {
      platform,
      browser: browser.name,
      origin,
      ipAddress,
      trustScore: credential.trustScore
    }
  });
  
  logger.info('[DeviceRegistry] Device registered', {
    uid,
    credId: credential.credId,
    platform,
    browser: browser.name,
    trustScore: credential.trustScore
  });
  
  return credential;
}

/**
 * Update device after successful authentication
 */
export async function updateDeviceOnAuth(
  uid: string,
  isAdmin: boolean,
  credId: string,
  newCounter: number,
  ipAddress: string,
  userAgent: string
): Promise<void> {
  const collectionPath = isAdmin ? 'employees' : 'users';
  const deviceRef = db
    .collection(collectionPath)
    .doc(uid)
    .collection('webauthnCredentials')
    .doc(credId);
  
  const deviceDoc = await deviceRef.get();
  if (!deviceDoc.exists) {
    throw new Error('Device not found');
  }
  
  const device = deviceDoc.data() as WebAuthnCredential;
  const now = Timestamp.now();
  
  // Calculate age and usage
  const ageInDays = Math.floor((now.toMillis() - device.createdAt.toMillis()) / (1000 * 60 * 60 * 24));
  const usageFrequency = device.usageCount + 1;
  const failureRate = device.consecutiveFailures / Math.max(1, usageFrequency);
  
  // Recalculate trust score
  const newTrustScore = calculateDeviceTrustScore(device, {
    ageInDays,
    usageFrequency,
    failureRate,
    isBackedUp: device.backedUp,
    hasValidAttestation: !!device.attestationData,
    consistentLocation: device.ipAddress === ipAddress,
    consistentUserAgent: device.userAgent === userAgent
  });
  
  // Update device
  await deviceRef.update({
    counter: newCounter,
    lastUsedAt: now,
    updatedAt: now,
    lastAuthSuccess: now,
    usageCount: db.FieldValue.increment(1),
    consecutiveFailures: 0,
    trustScore: newTrustScore,
    riskLevel: getRiskLevel(newTrustScore)
  });
  
  // Update user
  await db.collection(collectionPath).doc(uid).update({
    lastPasskeyUsedAt: now
  });
  
  logger.info('[DeviceRegistry] Device updated after auth', {
    uid,
    credId,
    newTrustScore,
    usageCount: usageFrequency
  });
}

/**
 * Record authentication failure
 */
export async function recordAuthFailure(
  uid: string,
  isAdmin: boolean,
  credId: string,
  reason: string
): Promise<void> {
  const collectionPath = isAdmin ? 'employees' : 'users';
  const deviceRef = db
    .collection(collectionPath)
    .doc(uid)
    .collection('webauthnCredentials')
    .doc(credId);
  
  const deviceDoc = await deviceRef.get();
  if (!deviceDoc.exists) return;
  
  const device = deviceDoc.data() as WebAuthnCredential;
  const now = Timestamp.now();
  
  // Update failure tracking
  const consecutiveFailures = device.consecutiveFailures + 1;
  
  // Reduce trust score on failures
  let newTrustScore = device.trustScore - (consecutiveFailures * 5);
  newTrustScore = Math.max(0, newTrustScore);
  
  await deviceRef.update({
    lastAuthFailure: now,
    updatedAt: now,
    consecutiveFailures,
    trustScore: newTrustScore,
    riskLevel: getRiskLevel(newTrustScore)
  });
  
  // Log event
  await logAuthEvent({
    eventType: 'authentication_failed',
    uid,
    deviceId: credId,
    timestamp: now,
    success: false,
    errorMessage: reason,
    metadata: {
      trustScore: newTrustScore,
      consecutiveFailures
    }
  });
  
  // Auto-revoke if too many failures
  if (consecutiveFailures >= 10) {
    await revokeDevice(uid, isAdmin, credId, 'policy_violation', 'system', 'Too many consecutive failures');
  }
}

/**
 * Revoke a device
 */
export async function revokeDevice(
  uid: string,
  isAdmin: boolean,
  credId: string,
  reason: DeviceRevocationRecord['reason'],
  revokedBy: string,
  reasonText?: string
): Promise<void> {
  const collectionPath = isAdmin ? 'employees' : 'users';
  const deviceRef = db
    .collection(collectionPath)
    .doc(uid)
    .collection('webauthnCredentials')
    .doc(credId);
  
  const now = Timestamp.now();
  
  // Mark as revoked
  await deviceRef.update({
    isRevoked: true,
    revokedAt: now,
    revokedReason: reasonText || reason,
    updatedAt: now
  });
  
  // Create revocation record
  const revocationRecord: DeviceRevocationRecord = {
    deviceId: credId,
    uid,
    revokedAt: now,
    revokedBy,
    reason,
    notificationSent: false
  };
  
  await db.collection('device_revocations').add(revocationRecord);
  
  // Log event
  await logAuthEvent({
    eventType: 'device_revoked',
    uid,
    deviceId: credId,
    timestamp: now,
    success: true,
    metadata: {
      reason,
      revokedBy
    }
  });
  
  logger.warn('[DeviceRegistry] Device revoked', {
    uid,
    credId,
    reason,
    revokedBy
  });
}

/**
 * Get all devices for a user
 */
export async function getUserDevices(uid: string, isAdmin: boolean): Promise<WebAuthnCredential[]> {
  const collectionPath = isAdmin ? 'employees' : 'users';
  const snapshot = await db
    .collection(collectionPath)
    .doc(uid)
    .collection('webauthnCredentials')
    .where('isRevoked', '==', false)
    .orderBy('lastUsedAt', 'desc')
    .get();
  
  return snapshot.docs.map(doc => doc.data() as WebAuthnCredential);
}

/**
 * Rename a device
 */
export async function renameDevice(
  uid: string,
  isAdmin: boolean,
  credId: string,
  newName: string
): Promise<void> {
  const collectionPath = isAdmin ? 'employees' : 'users';
  await db
    .collection(collectionPath)
    .doc(uid)
    .collection('webauthnCredentials')
    .doc(credId)
    .update({
      deviceName: newName,
      updatedAt: Timestamp.now()
    });
  
  logger.info('[DeviceRegistry] Device renamed', { uid, credId, newName });
}

/**
 * Set device icon
 */
export async function setDeviceIcon(
  uid: string,
  isAdmin: boolean,
  credId: string,
  icon: string
): Promise<void> {
  const collectionPath = isAdmin ? 'employees' : 'users';
  await db
    .collection(collectionPath)
    .doc(uid)
    .collection('webauthnCredentials')
    .doc(credId)
    .update({
      deviceIcon: icon,
      updatedAt: Timestamp.now()
    });
}

/**
 * Check if re-authentication is required
 */
export function checkReAuthRequired(
  lastAuthAt: Timestamp | undefined,
  gracePeriodMinutes: number = 5
): boolean {
  if (!lastAuthAt) return true;
  
  const now = Date.now();
  const lastAuth = lastAuthAt.toMillis();
  const gracePeriod = gracePeriodMinutes * 60 * 1000;
  
  return (now - lastAuth) > gracePeriod;
}

/**
 * Log authentication event for analytics
 */
export async function logAuthEvent(event: PasskeyAuthEvent): Promise<void> {
  try {
    // Store in Firestore for analytics
    await db.collection('passkey_auth_events').add({
      ...event,
      timestamp: event.timestamp || Timestamp.now()
    });
    
    // Also log to application logger
    logger.info('[WebAuthn Analytics]', {
      eventType: event.eventType,
      uid: event.uid,
      success: event.success,
      deviceId: event.deviceId
    });
  } catch (error) {
    logger.error('[DeviceRegistry] Failed to log auth event', error);
  }
}

/**
 * Get device usage pattern
 */
export async function getDeviceUsagePattern(
  uid: string,
  isAdmin: boolean,
  credId: string
): Promise<DeviceUsagePattern | null> {
  const collectionPath = isAdmin ? 'employees' : 'users';
  const deviceDoc = await db
    .collection(collectionPath)
    .doc(uid)
    .collection('webauthnCredentials')
    .doc(credId)
    .get();
  
  if (!deviceDoc.exists) return null;
  
  const device = deviceDoc.data() as WebAuthnCredential;
  
  // Calculate metrics
  const ageInDays = Math.floor(
    (Date.now() - device.createdAt.toMillis()) / (1000 * 60 * 60 * 24)
  );
  const averageAuthsPerDay = ageInDays > 0 ? device.usageCount / ageInDays : 0;
  
  return {
    deviceId: credId,
    uid,
    firstUsed: device.createdAt,
    lastUsed: device.lastUsedAt,
    totalAuthentications: device.usageCount,
    averageAuthsPerDay,
    commonIpAddresses: device.ipAddress ? [device.ipAddress] : [],
    commonUserAgents: device.userAgent ? [device.userAgent] : [],
    suspiciousActivityDetected: device.riskLevel === 'high',
    lastRiskAssessment: device.updatedAt
  };
}
