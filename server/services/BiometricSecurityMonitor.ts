import { db as firestore } from '../lib/firebase-admin';
import { logger } from '../lib/logger';
import { Timestamp } from 'firebase-admin/firestore';

export interface BiometricAuthEvent {
  userId: string;
  email: string;
  timestamp: Date;
  success: boolean;
  deviceId: string;
  ipAddress: string;
  userAgent: string;
  location?: {
    country: string;
    city?: string;
  };
  authenticatorType: string;
  credentialId: string;
}

export interface AnomalyDetectionResult {
  isAnomaly: boolean;
  riskScore: number;
  reasons: string[];
  recommendedAction: 'allow' | 'challenge' | 'block';
}

export class BiometricSecurityMonitor {
  private readonly ANOMALY_THRESHOLD = 0.7;
  private readonly MAX_FAILED_ATTEMPTS = 3;
  private readonly SUSPICIOUS_LOCATION_CHANGE_HOURS = 2;
  private readonly DATA_RETENTION_DAYS = 2555;

  async recordAuthenticationEvent(event: BiometricAuthEvent): Promise<void> {
    try {
      await firestore
        .collection('biometric_auth_events')
        .add({
          ...event,
          timestamp: Timestamp.fromDate(event.timestamp),
          analyzed: false,
          anomalyScore: 0,
        });

      logger.info('[BiometricMonitor] Auth event recorded', {
        userId: event.userId,
        success: event.success,
        deviceId: event.deviceId,
      });

      if (!event.success) {
        await this.checkFailedAttempts(event.userId, event.deviceId);
      }
    } catch (error) {
      logger.error('[BiometricMonitor] Failed to record auth event:', error);
    }
  }

  async detectAnomalies(event: BiometricAuthEvent): Promise<AnomalyDetectionResult> {
    const reasons: string[] = [];
    let riskScore = 0;

    const recentEvents = await this.getRecentAuthEvents(event.userId, 24);

    const newDeviceRisk = await this.checkNewDevice(event.userId, event.deviceId);
    if (newDeviceRisk > 0) {
      reasons.push('New device detected');
      riskScore += newDeviceRisk;
    }

    const locationRisk = await this.checkSuspiciousLocation(event, recentEvents);
    if (locationRisk > 0) {
      reasons.push('Suspicious location change');
      riskScore += locationRisk;
    }

    const velocityRisk = await this.checkVelocityAnomaly(recentEvents);
    if (velocityRisk > 0) {
      reasons.push('Unusual authentication frequency');
      riskScore += velocityRisk;
    }

    const failureRisk = await this.checkRecentFailures(event.userId, event.deviceId);
    if (failureRisk > 0) {
      reasons.push('Recent failed authentication attempts');
      riskScore += failureRisk;
    }

    const timeRisk = this.checkUnusualTime(event.timestamp);
    if (timeRisk > 0) {
      reasons.push('Authentication at unusual time');
      riskScore += timeRisk;
    }

    const normalizedScore = Math.min(riskScore / 5, 1);

    const recommendedAction = this.getRecommendedAction(normalizedScore);

    logger.info('[BiometricMonitor] Anomaly detection complete', {
      userId: event.userId,
      riskScore: normalizedScore,
      reasons,
      action: recommendedAction,
    });

    return {
      isAnomaly: normalizedScore >= this.ANOMALY_THRESHOLD,
      riskScore: normalizedScore,
      reasons,
      recommendedAction,
    };
  }

  private async checkNewDevice(userId: string, deviceId: string): Promise<number> {
    try {
      const deviceSnapshot = await firestore
        .collection('users')
        .doc(userId)
        .collection('webauthnCredentials')
        .where('deviceId', '==', deviceId)
        .limit(1)
        .get();

      return deviceSnapshot.empty ? 0.3 : 0;
    } catch (error) {
      logger.error('[BiometricMonitor] Error checking device:', error);
      return 0;
    }
  }

  private async checkSuspiciousLocation(
    event: BiometricAuthEvent,
    recentEvents: BiometricAuthEvent[]
  ): Promise<number> {
    if (!event.location || recentEvents.length === 0) return 0;

    const lastEvent = recentEvents[0];
    if (!lastEvent.location) return 0;

    const timeDiff = event.timestamp.getTime() - lastEvent.timestamp.getTime();
    const hoursDiff = timeDiff / (1000 * 60 * 60);

    if (
      event.location.country !== lastEvent.location.country &&
      hoursDiff < this.SUSPICIOUS_LOCATION_CHANGE_HOURS
    ) {
      return 0.5;
    }

    return 0;
  }

  private async checkVelocityAnomaly(recentEvents: BiometricAuthEvent[]): Promise<number> {
    if (recentEvents.length < 5) return 0;

    const lastHourEvents = recentEvents.filter(
      (e) => Date.now() - e.timestamp.getTime() < 60 * 60 * 1000
    );

    return lastHourEvents.length > 10 ? 0.4 : 0;
  }

  private async checkRecentFailures(userId: string, deviceId: string): Promise<number> {
    try {
      const failedEventsSnapshot = await firestore
        .collection('biometric_auth_events')
        .where('userId', '==', userId)
        .where('deviceId', '==', deviceId)
        .where('success', '==', false)
        .where('timestamp', '>', Timestamp.fromDate(new Date(Date.now() - 15 * 60 * 1000)))
        .get();

      const failureCount = failedEventsSnapshot.size;

      if (failureCount >= this.MAX_FAILED_ATTEMPTS) {
        return 0.6;
      } else if (failureCount >= 2) {
        return 0.3;
      }

      return 0;
    } catch (error) {
      logger.error('[BiometricMonitor] Error checking failures:', error);
      return 0;
    }
  }

  private checkUnusualTime(timestamp: Date): number {
    const hour = timestamp.getHours();
    
    if (hour >= 2 && hour <= 5) {
      return 0.2;
    }

    return 0;
  }

  private getRecommendedAction(riskScore: number): 'allow' | 'challenge' | 'block' {
    if (riskScore >= 0.8) return 'block';
    if (riskScore >= 0.5) return 'challenge';
    return 'allow';
  }

  private async getRecentAuthEvents(userId: string, hours: number): Promise<BiometricAuthEvent[]> {
    try {
      const cutoffTime = Timestamp.fromDate(new Date(Date.now() - hours * 60 * 60 * 1000));

      const eventsSnapshot = await firestore
        .collection('biometric_auth_events')
        .where('userId', '==', userId)
        .where('timestamp', '>', cutoffTime)
        .orderBy('timestamp', 'desc')
        .limit(50)
        .get();

      return eventsSnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          ...data,
          timestamp: data.timestamp.toDate(),
        } as BiometricAuthEvent;
      });
    } catch (error) {
      logger.error('[BiometricMonitor] Error fetching recent events:', error);
      return [];
    }
  }

  private async checkFailedAttempts(userId: string, deviceId: string): Promise<void> {
    const failureCount = await this.checkRecentFailures(userId, deviceId);

    if (failureCount >= 0.6) {
      await this.createSecurityAlert(userId, deviceId, 'excessive_failed_attempts');
    }
  }

  private async createSecurityAlert(
    userId: string,
    deviceId: string,
    type: string
  ): Promise<void> {
    try {
      await firestore.collection('security_alerts').add({
        userId,
        deviceId,
        type,
        timestamp: Timestamp.now(),
        resolved: false,
        severity: 'high',
      });

      logger.warn('[BiometricMonitor] Security alert created', {
        userId,
        deviceId,
        type,
      });
    } catch (error) {
      logger.error('[BiometricMonitor] Failed to create security alert:', error);
    }
  }

  async getSecurityInsights(userId: string): Promise<{
    totalAuth: number;
    successRate: number;
    uniqueDevices: number;
    recentAnomalies: number;
    lastAuthTimestamp?: Date;
  }> {
    try {
      const last30Days = Timestamp.fromDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));

      const eventsSnapshot = await firestore
        .collection('biometric_auth_events')
        .where('userId', '==', userId)
        .where('timestamp', '>', last30Days)
        .get();

      const events = eventsSnapshot.docs.map((doc) => doc.data());
      const totalAuth = events.length;
      const successfulAuth = events.filter((e) => e.success).length;
      const uniqueDevices = new Set(events.map((e) => e.deviceId)).size;
      const recentAnomalies = events.filter((e) => e.anomalyScore >= this.ANOMALY_THRESHOLD).length;

      const lastEvent = events.sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis())[0];

      return {
        totalAuth,
        successRate: totalAuth > 0 ? successfulAuth / totalAuth : 0,
        uniqueDevices,
        recentAnomalies,
        lastAuthTimestamp: lastEvent ? lastEvent.timestamp.toDate() : undefined,
      };
    } catch (error) {
      logger.error('[BiometricMonitor] Error getting security insights:', error);
      return {
        totalAuth: 0,
        successRate: 0,
        uniqueDevices: 0,
        recentAnomalies: 0,
      };
    }
  }

  async cleanupOldData(): Promise<void> {
    try {
      const cutoffDate = Timestamp.fromDate(
        new Date(Date.now() - this.DATA_RETENTION_DAYS * 24 * 60 * 60 * 1000)
      );

      const oldEventsQuery = firestore
        .collection('biometric_auth_events')
        .where('timestamp', '<', cutoffDate);

      const oldEventsSnapshot = await oldEventsQuery.get();
      const batch = firestore.batch();

      oldEventsSnapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      if (oldEventsSnapshot.size > 0) {
        await batch.commit();
      }

      const oldAlertsQuery = firestore
        .collection('security_alerts')
        .where('timestamp', '<', cutoffDate)
        .where('resolved', '==', true);

      const oldAlertsSnapshot = await oldAlertsQuery.get();
      const alertsBatch = firestore.batch();

      oldAlertsSnapshot.docs.forEach((doc) => {
        alertsBatch.delete(doc.ref);
      });

      if (oldAlertsSnapshot.size > 0) {
        await alertsBatch.commit();
      }

      logger.info('[BiometricMonitor] Old data cleanup complete', {
        eventsDeleted: oldEventsSnapshot.size,
        alertsDeleted: oldAlertsSnapshot.size,
        cutoffDate: cutoffDate.toDate().toISOString(),
        retentionDays: this.DATA_RETENTION_DAYS,
      });
    } catch (error) {
      logger.error('[BiometricMonitor] Error during cleanup:', error);
    }
  }
}

export const biometricSecurityMonitor = new BiometricSecurityMonitor();
