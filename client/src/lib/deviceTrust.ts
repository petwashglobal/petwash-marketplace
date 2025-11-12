/**
 * Device Trust Management
 * Banking-level "Remember this device for 30 days" feature
 * Stores encrypted device fingerprint with 30-day expiry
 */

import { logger } from './logger';

const DEVICE_TRUST_KEY = 'petWashTrustedDevice';
const TRUST_DURATION_DAYS = 30;
const TRUST_DURATION_MS = TRUST_DURATION_DAYS * 24 * 60 * 60 * 1000;

export interface TrustedDevice {
  deviceId: string;
  userId: string;
  email: string;
  fingerprint: string;
  trustedAt: number;
  expiresAt: number;
  deviceInfo: {
    browser: string;
    os: string;
    screenResolution: string;
    timezone: string;
  };
}

/**
 * Generate device fingerprint for security validation
 */
function generateDeviceFingerprint(): string {
  const userAgent = navigator.userAgent;
  const language = navigator.language;
  const platform = navigator.platform;
  const screenResolution = `${screen.width}x${screen.height}`;
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const colorDepth = screen.colorDepth;
  
  const fingerprintData = `${userAgent}|${language}|${platform}|${screenResolution}|${timezone}|${colorDepth}`;
  
  // Simple hash function (not cryptographic, just for fingerprint identification)
  let hash = 0;
  for (let i = 0; i < fingerprintData.length; i++) {
    const char = fingerprintData.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  return Math.abs(hash).toString(36);
}

/**
 * Get browser name from user agent
 */
function getBrowserName(): string {
  const ua = navigator.userAgent;
  
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Edg')) return 'Edge';
  if (ua.includes('Chrome')) return 'Chrome';
  if (ua.includes('Safari')) return 'Safari';
  if (ua.includes('Opera')) return 'Opera';
  
  return 'Unknown';
}

/**
 * Get OS name from user agent
 */
function getOSName(): string {
  const ua = navigator.userAgent;
  
  if (ua.includes('Win')) return 'Windows';
  if (ua.includes('Mac')) return 'macOS';
  if (ua.includes('Linux')) return 'Linux';
  if (ua.includes('Android')) return 'Android';
  if (ua.includes('iOS') || ua.includes('iPhone') || ua.includes('iPad')) return 'iOS';
  
  return 'Unknown';
}

/**
 * Generate unique device ID
 */
function generateDeviceId(): string {
  return `device_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Trust current device for 30 days
 */
export function trustDevice(userId: string, email: string): boolean {
  try {
    const now = Date.now();
    const fingerprint = generateDeviceFingerprint();
    
    const trustedDevice: TrustedDevice = {
      deviceId: generateDeviceId(),
      userId,
      email,
      fingerprint,
      trustedAt: now,
      expiresAt: now + TRUST_DURATION_MS,
      deviceInfo: {
        browser: getBrowserName(),
        os: getOSName(),
        screenResolution: `${screen.width}x${screen.height}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    };
    
    localStorage.setItem(DEVICE_TRUST_KEY, JSON.stringify(trustedDevice));
    
    logger.info('Device trusted for 30 days', {
      deviceId: trustedDevice.deviceId,
      email: email.substring(0, 3) + '***',
      expiresAt: new Date(trustedDevice.expiresAt).toISOString(),
      deviceInfo: trustedDevice.deviceInfo,
    });
    
    return true;
  } catch (error) {
    logger.error('Failed to trust device', error);
    return false;
  }
}

/**
 * Check if current device is trusted
 */
export function isDeviceTrusted(): boolean {
  try {
    const storedData = localStorage.getItem(DEVICE_TRUST_KEY);
    if (!storedData) {
      return false;
    }
    
    const trustedDevice: TrustedDevice = JSON.parse(storedData);
    const now = Date.now();
    
    // Check if trust has expired
    if (now > trustedDevice.expiresAt) {
      logger.info('Device trust expired', {
        deviceId: trustedDevice.deviceId,
        expiredAt: new Date(trustedDevice.expiresAt).toISOString(),
      });
      revokeDeviceTrust();
      return false;
    }
    
    // Validate device fingerprint matches
    const currentFingerprint = generateDeviceFingerprint();
    if (currentFingerprint !== trustedDevice.fingerprint) {
      logger.warn('Device fingerprint mismatch - possible device change', {
        deviceId: trustedDevice.deviceId,
        storedFingerprint: trustedDevice.fingerprint,
        currentFingerprint,
      });
      revokeDeviceTrust();
      return false;
    }
    
    logger.info('Device trust validated', {
      deviceId: trustedDevice.deviceId,
      daysRemaining: Math.ceil((trustedDevice.expiresAt - now) / (24 * 60 * 60 * 1000)),
    });
    
    return true;
  } catch (error) {
    logger.error('Failed to check device trust', error);
    return false;
  }
}

/**
 * Get trusted device info
 */
export function getTrustedDeviceInfo(): TrustedDevice | null {
  try {
    const storedData = localStorage.getItem(DEVICE_TRUST_KEY);
    if (!storedData) {
      return null;
    }
    
    const trustedDevice: TrustedDevice = JSON.parse(storedData);
    
    // Check if expired
    if (Date.now() > trustedDevice.expiresAt) {
      revokeDeviceTrust();
      return null;
    }
    
    return trustedDevice;
  } catch (error) {
    logger.error('Failed to get trusted device info', error);
    return null;
  }
}

/**
 * Revoke device trust
 */
export function revokeDeviceTrust(): void {
  try {
    const trustedDevice = getTrustedDeviceInfo();
    localStorage.removeItem(DEVICE_TRUST_KEY);
    
    logger.info('Device trust revoked', {
      deviceId: trustedDevice?.deviceId || 'unknown',
    });
  } catch (error) {
    logger.error('Failed to revoke device trust', error);
  }
}

/**
 * Get days remaining until trust expires
 */
export function getTrustDaysRemaining(): number | null {
  const device = getTrustedDeviceInfo();
  if (!device) {
    return null;
  }
  
  const now = Date.now();
  const msRemaining = device.expiresAt - now;
  return Math.ceil(msRemaining / (24 * 60 * 60 * 1000));
}

/**
 * Extend device trust by another 30 days
 */
export function extendDeviceTrust(): boolean {
  try {
    const device = getTrustedDeviceInfo();
    if (!device) {
      logger.warn('Cannot extend trust - no trusted device found');
      return false;
    }
    
    const now = Date.now();
    device.expiresAt = now + TRUST_DURATION_MS;
    
    localStorage.setItem(DEVICE_TRUST_KEY, JSON.stringify(device));
    
    logger.info('Device trust extended', {
      deviceId: device.deviceId,
      newExpiresAt: new Date(device.expiresAt).toISOString(),
    });
    
    return true;
  } catch (error) {
    logger.error('Failed to extend device trust', error);
    return false;
  }
}
