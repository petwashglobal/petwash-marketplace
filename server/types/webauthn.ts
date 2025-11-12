import { Timestamp } from 'firebase-admin/firestore';

/**
 * Enhanced WebAuthn Credential with Banking-Level Security
 * Collection: webauthn_credentials/{uid}/devices/{credId}
 */
export interface WebAuthnCredential {
  credId: string;
  publicKey: string;
  counter: number;
  
  // Device Identification
  deviceName: string;
  deviceIcon?: string;
  aaguid?: string;
  
  // Transport & Capabilities
  transports?: AuthenticatorTransport[];
  deviceType: 'singleDevice' | 'multiDevice';
  backedUp: boolean;
  backupEligible?: boolean;
  backupState?: boolean;
  
  // Timestamps
  createdAt: Timestamp;
  lastUsedAt: Timestamp;
  updatedAt: Timestamp;
  
  // Registration Context
  userAgent?: string;
  ipAddress?: string;
  registrationOrigin?: string;
  
  // Trust & Security
  trustScore: number;
  riskLevel: 'low' | 'medium' | 'high';
  isRevoked: boolean;
  revokedAt?: Timestamp;
  revokedReason?: string;
  
  // Usage Analytics
  usageCount: number;
  lastAuthSuccess: Timestamp;
  lastAuthFailure?: Timestamp;
  consecutiveFailures: number;
  
  // Attestation
  attestationFormat?: string;
  attestationData?: any;
  
  // Platform Detection
  platform?: 'ios' | 'android' | 'windows' | 'macos' | 'linux' | 'unknown';
  browserName?: string;
  browserVersion?: string;
}

/**
 * User Passkey Status
 * Stored in: users/{uid} or employees/{uid}
 */
export interface UserPasskeyStatus {
  hasPasskey: boolean;
  trustedDevices?: string[];
  passkeyCreatedAt?: Timestamp;
  lastPasskeyUsedAt?: Timestamp;
  totalDevices?: number;
  preferredDeviceId?: string;
}

/**
 * Challenge stored in signed cookie during registration/login
 */
export interface WebAuthnChallenge {
  challenge: string;
  uid?: string;
  email?: string;
  type: 'registration' | 'authentication';
  createdAt: number;
  expiresAt: number;
  rpId: string;
  origin: string;
  ipAddress: string;
  userAgent?: string;
  csrfToken?: string;
}

/**
 * WebAuthn configuration
 */
export interface WebAuthnConfig {
  rpId: string;
  rpName: string;
  origins: string[];
  timeout: number;
  attestation: 'none' | 'direct' | 'indirect';
  challengeExpiry: number;
  sessionMaxAge: number;
  reAuthWindow: number;
  
  // Banking-level security
  requireUserVerification: boolean;
  maxDevicesPerUser: number;
  deviceTrustThreshold: number;
  enableAttestationValidation: boolean;
}

/**
 * Device Trust Scoring Factors
 */
export interface DeviceTrustFactors {
  ageInDays: number;
  usageFrequency: number;
  failureRate: number;
  isBackedUp: boolean;
  hasValidAttestation: boolean;
  consistentLocation: boolean;
  consistentUserAgent: boolean;
}

/**
 * Device Revocation Record
 */
export interface DeviceRevocationRecord {
  deviceId: string;
  uid: string;
  revokedAt: Timestamp;
  revokedBy: string;
  reason: 'user_requested' | 'suspicious_activity' | 'device_lost' | 'policy_violation' | 'admin_action';
  notificationSent: boolean;
  ipAddress?: string;
}

/**
 * Passkey Authentication Event (for analytics)
 */
export interface PasskeyAuthEvent {
  eventType: 'registration_started' | 'registration_completed' | 'registration_failed' |
             'authentication_started' | 'authentication_completed' | 'authentication_failed' |
             'device_revoked' | 'device_renamed' | 'trust_score_updated';
  uid: string;
  deviceId?: string;
  timestamp: Timestamp;
  success: boolean;
  errorCode?: string;
  errorMessage?: string;
  metadata?: {
    platform?: string;
    browser?: string;
    rpId?: string;
    origin?: string;
    ipAddress?: string;
    trustScore?: number;
  };
}

/**
 * Bilingual error response
 */
export interface BilingualError {
  code: string;
  message_en: string;
  message_he: string;
  recoveryAction_en?: string;
  recoveryAction_he?: string;
  httpStatus: number;
}

/**
 * Device usage pattern
 */
export interface DeviceUsagePattern {
  deviceId: string;
  uid: string;
  firstUsed: Timestamp;
  lastUsed: Timestamp;
  totalAuthentications: number;
  averageAuthsPerDay: number;
  commonIpAddresses: string[];
  commonUserAgents: string[];
  suspiciousActivityDetected: boolean;
  lastRiskAssessment: Timestamp;
}

/**
 * Re-authentication requirement
 */
export interface ReAuthRequirement {
  required: boolean;
  reason: 'sensitive_action' | 'time_expired' | 'security_policy' | 'device_change';
  lastAuthAt?: Timestamp;
  gracePeriodMinutes: number;
}
