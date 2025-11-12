/**
 * Apple-Style User Device Monitoring Service
 * 
 * Provides comprehensive device tracking and fraud prevention for Pet Wash™
 * - Device fingerprinting and identification
 * - Session tracking across devices
 * - Fraud detection and scoring
 * - Integration with WebAuthn credentials
 * - 7-year audit retention for Israeli Privacy Law compliance
 */

import { db } from '../db';
import { 
  userDevices, 
  userDeviceEvents,
  type InsertUserDevice,
  type InsertUserDeviceEvent,
  type UserDevice,
} from '@shared/schema';
import { desc, eq, and, isNull, sql } from 'drizzle-orm';
import { logger } from '../lib/logger';
import crypto from 'crypto';
import { AuditLedgerService } from './AuditLedgerService';
import { DeviceSecurityAlertsService } from './DeviceSecurityAlertsService';
import { auth as adminAuth } from '../lib/firebase-admin';

export interface DeviceTelemetry {
  userId: string;
  platform: 'iOS' | 'Android' | 'Windows' | 'macOS' | 'Linux' | 'Unknown';
  browser?: string;
  osVersion?: string;
  browserVersion?: string;
  webauthnCredentialId?: string;
  ipAddress?: string;
  ipLocation?: {
    city?: string;
    country?: string;
    region?: string;
    lat?: number;
    lng?: number;
  };
  wifiSsid?: string;
  wifiBssid?: string;
  userAgent?: string;
  deviceLabel?: string;
  metadata?: any;
}

export interface DeviceRegistrationResult {
  device: UserDevice;
  isNewDevice: boolean;
  fraudScore: number;
  fraudSignals: string[];
}

export class UserDeviceService {
  
  /**
   * Generate deterministic device fingerprint from device characteristics
   * Uses SHA-256 hash of stable device attributes
   */
  static generateFingerprint(telemetry: DeviceTelemetry): string {
    const fingerprintData = {
      platform: telemetry.platform,
      browser: telemetry.browser || 'unknown',
      osVersion: telemetry.osVersion || 'unknown',
      userAgent: telemetry.userAgent || 'unknown',
      webauthnCredentialId: telemetry.webauthnCredentialId || '',
      // Include WiFi BSSID hash if available (not SSID as it can change)
      wifiBssidHash: telemetry.wifiBssid 
        ? crypto.createHash('sha256').update(telemetry.wifiBssid).digest('hex')
        : '',
    };
    
    const payload = JSON.stringify(fingerprintData);
    return crypto.createHash('sha256').update(payload).digest('hex');
  }
  
  /**
   * Hash WiFi BSSID (MAC address) for privacy
   */
  static hashWifiBssid(bssid: string): string {
    const salt = process.env.KYC_SALT || 'default-salt';
    return crypto.createHash('sha256').update(bssid + salt).digest('hex');
  }
  
  /**
   * Encrypt WiFi SSID for storage using AES-256-GCM
   * Returns: iv:authTag:encrypted (all hex-encoded)
   */
  static encryptWifiSsid(ssid: string): string {
    try {
      const secret = process.env.KYC_SALT;
      if (!secret) {
        logger.error('[UserDeviceService] KYC_SALT not configured - cannot encrypt WiFi SSID');
        throw new Error('Encryption key not configured');
      }
      
      // Derive 32-byte key from secret using SHA-256
      const key = crypto.createHash('sha256').update(secret).digest();
      
      // Generate random IV (12 bytes for GCM)
      const iv = crypto.randomBytes(12);
      
      // Create cipher
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
      
      // Encrypt
      let encrypted = cipher.update(ssid, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Get auth tag
      const authTag = cipher.getAuthTag().toString('hex');
      
      // Return: iv:authTag:encrypted
      return `${iv.toString('hex')}:${authTag}:${encrypted}`;
    } catch (error) {
      logger.error('[UserDeviceService] Failed to encrypt WiFi SSID', { error });
      throw error;
    }
  }
  
  /**
   * Decrypt WiFi SSID from storage
   * Input format: iv:authTag:encrypted (all hex-encoded)
   */
  static decryptWifiSsid(encrypted: string): string {
    try {
      const secret = process.env.KYC_SALT;
      if (!secret) {
        logger.error('[UserDeviceService] KYC_SALT not configured - cannot decrypt WiFi SSID');
        throw new Error('Decryption key not configured');
      }
      
      // Parse components
      const parts = encrypted.split(':');
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted format');
      }
      
      const [ivHex, authTagHex, encryptedHex] = parts;
      
      // Derive key
      const key = crypto.createHash('sha256').update(secret).digest();
      
      // Convert from hex
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');
      
      // Create decipher
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(authTag);
      
      // Decrypt
      let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      logger.error('[UserDeviceService] Failed to decrypt WiFi SSID', { error });
      throw error;
    }
  }
  
  /**
   * Calculate fraud score based on device telemetry and activity
   * Returns 0-100 (0 = very safe, 100 = very risky)
   */
  static async calculateFraudScore(
    userId: string, 
    telemetry: DeviceTelemetry,
    existingDevices?: UserDevice[]
  ): Promise<{ score: number; signals: string[] }> {
    const signals: string[] = [];
    let score = 0;
    
    // Get user's existing devices if not provided
    if (!existingDevices) {
      existingDevices = await db
        .select()
        .from(userDevices)
        .where(
          and(
            eq(userDevices.userId, userId),
            isNull(userDevices.revokedAt)
          )
        );
    }
    
    // Check for rapid device additions (potential account takeover)
    const recentDevices = existingDevices.filter(d => {
      const hoursSinceAdded = (Date.now() - new Date(d.firstSeenAt).getTime()) / (1000 * 60 * 60);
      return hoursSinceAdded < 24;
    });
    
    if (recentDevices.length >= 3) {
      score += 30;
      signals.push('multiple_devices_24h');
    }
    
    // Check for IP geolocation changes
    if (telemetry.ipLocation && existingDevices.length > 0) {
      const lastDevice = existingDevices[0];
      const lastLocation = lastDevice.ipLocation as any;
      
      if (lastLocation?.country && telemetry.ipLocation.country) {
        if (lastLocation.country !== telemetry.ipLocation.country) {
          score += 20;
          signals.push('country_change');
        }
      }
    }
    
    // Check for suspicious platform combinations
    const platforms = new Set(existingDevices.map(d => d.platform));
    if (platforms.size >= 4) {
      score += 15;
      signals.push('multiple_platforms');
    }
    
    // Unknown platform or browser
    if (telemetry.platform === 'Unknown' || !telemetry.browser) {
      score += 10;
      signals.push('unknown_device_type');
    }
    
    // No WebAuthn credential (less secure)
    if (!telemetry.webauthnCredentialId) {
      score += 5;
      signals.push('no_passkey');
    }
    
    return {
      score: Math.min(score, 100),
      signals,
    };
  }
  
  /**
   * Register or update a device for a user
   * Returns device info and whether it's a new device
   */
  static async registerDevice(
    telemetry: DeviceTelemetry
  ): Promise<DeviceRegistrationResult> {
    const fingerprint = this.generateFingerprint(telemetry);
    
    // Check if device already exists
    const existingDevice = await db
      .select()
      .from(userDevices)
      .where(eq(userDevices.deviceFingerprint, fingerprint))
      .limit(1);
    
    const isNewDevice = existingDevice.length === 0;
    
    // Calculate fraud score
    const { score: fraudScore, signals: fraudSignals } = await this.calculateFraudScore(
      telemetry.userId,
      telemetry
    );
    
    // Prepare WiFi data (encrypted/hashed)
    const wifiSsidEncrypted = telemetry.wifiSsid 
      ? this.encryptWifiSsid(telemetry.wifiSsid)
      : null;
    const wifiBssidHash = telemetry.wifiBssid 
      ? this.hashWifiBssid(telemetry.wifiBssid)
      : null;
    
    let device: UserDevice;
    
    if (isNewDevice) {
      // Create new device
      const [newDevice] = await db
        .insert(userDevices)
        .values({
          userId: telemetry.userId,
          deviceLabel: telemetry.deviceLabel || `${telemetry.platform} Device`,
          deviceFingerprint: fingerprint,
          platform: telemetry.platform,
          browser: telemetry.browser,
          osVersion: telemetry.osVersion,
          browserVersion: telemetry.browserVersion,
          webauthnCredentialId: telemetry.webauthnCredentialId,
          ipAddress: telemetry.ipAddress,
          ipLocation: telemetry.ipLocation,
          wifiSsidEncrypted,
          wifiBssidHash,
          sessionCount: 1,
          trustScore: 50, // Start neutral
          fraudFlags: fraudSignals,
          metadata: telemetry.metadata || {},
          lastSeenAt: new Date(),
        })
        .returning();
      
      device = newDevice;
      
      // Record device_added event
      await this.recordDeviceEvent({
        deviceId: device.id,
        userId: telemetry.userId,
        eventType: 'device_added',
        action: 'add',
        ipAddress: telemetry.ipAddress,
        location: telemetry.ipLocation,
        fraudScore,
        fraudSignals,
        metadata: {
          platform: telemetry.platform,
          browser: telemetry.browser,
        },
      });
      
      // Record in AuditLedger for comprehensive fraud tracking
      await AuditLedgerService.recordEvent({
        eventType: 'loyalty_updated', // Using existing enum, can extend later
        userId: telemetry.userId,
        entityType: 'loyalty_card', // Using existing enum
        entityId: device.id,
        action: 'created',
        newState: {
          deviceAdded: true,
          platform: telemetry.platform,
          fraudScore,
        },
        metadata: {
          type: 'device_registered',
          fraudSignals,
        },
        ipAddress: telemetry.ipAddress,
        userAgent: telemetry.userAgent,
        deviceId: fingerprint,
        fraudScore,
        fraudSignals,
      });
      
      logger.info('[UserDeviceService] New device registered', {
        userId: telemetry.userId,
        deviceId: device.id,
        platform: telemetry.platform,
        fraudScore,
      });
      
      // Send security alert for new device login
      try {
        const userRecord = await adminAuth.getUser(telemetry.userId);
        const userEmail = userRecord.email || 'unknown@petwash.co.il';
        
        // Determine if this is suspicious or just a new device
        const isSuspicious = fraudScore > 60 || fraudSignals.length > 0;
        
        if (isSuspicious) {
          // High-priority suspicious login alert
          const alert = DeviceSecurityAlertsService.createSuspiciousLoginAlert({
            userId: telemetry.userId,
            userEmail,
            deviceLabel: device.deviceLabel,
            platform: telemetry.platform,
            ipAddress: telemetry.ipAddress,
            location: telemetry.ipLocation,
            fraudFlags: fraudSignals,
            trustScore: device.trustScore,
          });
          await DeviceSecurityAlertsService.sendAlert(alert);
        } else {
          // Standard new device alert
          const alert = DeviceSecurityAlertsService.createNewDeviceAlert({
            userId: telemetry.userId,
            userEmail,
            deviceLabel: device.deviceLabel,
            platform: telemetry.platform,
            ipAddress: telemetry.ipAddress,
            location: telemetry.ipLocation,
            trustScore: device.trustScore,
          });
          await DeviceSecurityAlertsService.sendAlert(alert);
        }
      } catch (alertError) {
        // Don't fail device registration if alert fails
        logger.error('[UserDeviceService] Failed to send security alert', {
          error: alertError instanceof Error ? alertError.message : 'Unknown error',
          userId: telemetry.userId,
        });
      }
    } else {
      // Update existing device
      const deviceId = existingDevice[0].id;
      const sessionCount = (existingDevice[0].sessionCount || 0) + 1;
      
      // Check for IP or geo changes
      const ipChanged = existingDevice[0].ipAddress !== telemetry.ipAddress;
      const geoChanged = telemetry.ipLocation && 
        JSON.stringify(existingDevice[0].ipLocation) !== JSON.stringify(telemetry.ipLocation);
      
      const [updatedDevice] = await db
        .update(userDevices)
        .set({
          lastSeenAt: new Date(),
          sessionCount,
          ipAddress: telemetry.ipAddress,
          ipLocation: telemetry.ipLocation,
          wifiSsidEncrypted: wifiSsidEncrypted || existingDevice[0].wifiSsidEncrypted,
          wifiBssidHash: wifiBssidHash || existingDevice[0].wifiBssidHash,
          lastIpChangeAt: ipChanged ? new Date() : existingDevice[0].lastIpChangeAt,
          lastGeoChangeAt: geoChanged ? new Date() : existingDevice[0].lastGeoChangeAt,
          fraudFlags: fraudSignals,
          updatedAt: new Date(),
        })
        .where(eq(userDevices.id, deviceId))
        .returning();
      
      device = updatedDevice;
      
      // Record session event
      await this.recordDeviceEvent({
        deviceId: device.id,
        userId: telemetry.userId,
        eventType: ipChanged ? 'ip_changed' : 'session_started',
        action: 'login',
        ipAddress: telemetry.ipAddress,
        location: telemetry.ipLocation,
        fraudScore,
        fraudSignals,
        metadata: {
          sessionCount,
          ipChanged,
          geoChanged,
        },
      });
    }
    
    return {
      device,
      isNewDevice,
      fraudScore,
      fraudSignals,
    };
  }
  
  /**
   * Get all devices for a user (excluding revoked)
   */
  static async getUserDevices(userId: string): Promise<UserDevice[]> {
    return await db
      .select()
      .from(userDevices)
      .where(
        and(
          eq(userDevices.userId, userId),
          isNull(userDevices.revokedAt)
        )
      )
      .orderBy(desc(userDevices.lastSeenAt));
  }
  
  /**
   * Get device by ID
   */
  static async getDeviceById(deviceId: string): Promise<UserDevice | null> {
    const [device] = await db
      .select()
      .from(userDevices)
      .where(eq(userDevices.id, deviceId))
      .limit(1);
    
    return device || null;
  }
  
  /**
   * Revoke/dismiss a device
   * User-initiated removal of device they don't recognize
   */
  static async revokeDevice(
    deviceId: string,
    userId: string,
    reason: 'user_dismissed' | 'suspicious_activity' | 'security_breach' = 'user_dismissed',
    ipAddress?: string
  ): Promise<boolean> {
    try {
      const [device] = await db
        .update(userDevices)
        .set({
          revokedAt: new Date(),
          revokedReason: reason,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(userDevices.id, deviceId),
            eq(userDevices.userId, userId),
            isNull(userDevices.revokedAt) // Can't revoke already revoked device
          )
        )
        .returning();
      
      if (!device) {
        return false;
      }
      
      // Record revocation event
      await this.recordDeviceEvent({
        deviceId,
        userId,
        eventType: 'device_revoked',
        action: 'revoke',
        ipAddress,
        fraudScore: 0,
        fraudSignals: [reason],
        metadata: {
          reason,
          revokedAt: new Date().toISOString(),
        },
      });
      
      // Record in AuditLedger
      await AuditLedgerService.recordEvent({
        eventType: 'loyalty_updated',
        userId,
        entityType: 'loyalty_card',
        entityId: deviceId,
        action: 'deleted',
        previousState: {
          deviceActive: true,
        },
        newState: {
          deviceRevoked: true,
          reason,
        },
        metadata: {
          type: 'device_revoked',
        },
        ipAddress,
        deviceId,
        fraudScore: 50,
        fraudSignals: [reason],
      });
      
      logger.info('[UserDeviceService] Device revoked', {
        deviceId,
        userId,
        reason,
      });
      
      return true;
    } catch (error) {
      logger.error('[UserDeviceService] Failed to revoke device', { error, deviceId, userId });
      return false;
    }
  }
  
  /**
   * Update device label (rename device)
   */
  static async updateDeviceLabel(
    deviceId: string,
    userId: string,
    newLabel: string
  ): Promise<boolean> {
    try {
      const [device] = await db
        .update(userDevices)
        .set({
          deviceLabel: newLabel,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(userDevices.id, deviceId),
            eq(userDevices.userId, userId)
          )
        )
        .returning();
      
      if (!device) {
        return false;
      }
      
      await this.recordDeviceEvent({
        deviceId,
        userId,
        eventType: 'device_renamed',
        action: 'rename',
        fraudScore: 0,
        fraudSignals: [],
        metadata: {
          newLabel,
        },
      });
      
      return true;
    } catch (error) {
      logger.error('[UserDeviceService] Failed to update device label', { error, deviceId });
      return false;
    }
  }
  
  /**
   * Record a device event in the audit log
   * Private helper method
   */
  private static async recordDeviceEvent(
    event: Omit<InsertUserDeviceEvent, 'createdAt'>
  ): Promise<void> {
    try {
      await db.insert(userDeviceEvents).values({
        ...event,
      });
    } catch (error) {
      logger.error('[UserDeviceService] Failed to record device event', { error, event });
    }
  }
  
  /**
   * Get device events history for a device
   */
  static async getDeviceEvents(deviceId: string, limit = 50): Promise<any[]> {
    return await db
      .select()
      .from(userDeviceEvents)
      .where(eq(userDeviceEvents.deviceId, deviceId))
      .orderBy(desc(userDeviceEvents.createdAt))
      .limit(limit);
  }
  
  /**
   * Get suspicious devices for fraud monitoring
   * Returns devices with fraud score > 50
   */
  static async getSuspiciousDevices(userId?: string): Promise<UserDevice[]> {
    const query = db
      .select()
      .from(userDevices)
      .where(
        and(
          sql`${userDevices.trustScore} < 40 OR array_length(${userDevices.fraudFlags}, 1) > 2`,
          isNull(userDevices.revokedAt)
        )
      )
      .orderBy(desc(userDevices.trustScore));
    
    if (userId) {
      return await query.where(eq(userDevices.userId, userId));
    }
    
    return await query.limit(100);
  }
  
  /**
   * Mark device as current (the device user is currently using)
   */
  static async markAsCurrentDevice(deviceId: string, userId: string): Promise<boolean> {
    try {
      // First, unmark all other devices
      await db
        .update(userDevices)
        .set({ isCurrentDevice: false })
        .where(eq(userDevices.userId, userId));
      
      // Mark this device as current
      const [device] = await db
        .update(userDevices)
        .set({ 
          isCurrentDevice: true,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(userDevices.id, deviceId),
            eq(userDevices.userId, userId)
          )
        )
        .returning();
      
      return !!device;
    } catch (error) {
      logger.error('[UserDeviceService] Failed to mark device as current', { error, deviceId });
      return false;
    }
  }
}
