/**
 * Wallet Telemetry Service
 * 
 * AI-assisted monitoring to infer wallet pass add success/failure:
 * - UA detection for Apple Passbook installer
 * - Visibility change tracking (user left tab = wallet opened)
 * - Post-click beacons (2s timeout to detect success)
 * - Google Wallet redirect tracking
 * - Heuristic-based success inference with confidence scores
 * 
 * All telemetry stored in Firestore with 90-day retention.
 */

import { db } from '../lib/firebase-admin';
import { logger } from '../lib/logger';
import useragent from 'useragent';

interface TelemetryBeacon {
  type: 'apple-click' | 'apple-post-2s' | 'google-click' | 'google-post-2s' | 'visibility-hidden' | 'popup-blocked';
  token: string;
  timestamp: Date;
  extra?: any;
  ip?: string;
  userAgent?: string;
}

interface DownloadEvent {
  kind: 'apple' | 'google';
  token: string;
  timestamp: Date;
  ip: string;
  userAgent: string;
  isPassbookInstaller?: boolean;  // iOS Wallet app UA detected
  deviceInfo?: {
    family: string;
    os: string;
    version: string;
  };
}

interface WalletSession {
  token: string;
  userId?: string;
  passType: 'vip' | 'business' | 'voucher';
  platform: 'apple' | 'google';
  createdAt: Date;
  clickedAt?: Date;
  downloadedAt?: Date;
  visibilityChangeAt?: Date;
  successConfirmedAt?: Date;
  beacons: TelemetryBeacon[];
  downloads: DownloadEvent[];
  inferredSuccess: boolean;
  confidenceScore: number;  // 0-100
  status: 'pending' | 'likely_success' | 'confirmed_success' | 'likely_failed' | 'abandoned';
}

export class WalletTelemetryService {
  private static readonly COLLECTION = 'wallet_telemetry';
  private static readonly RETENTION_DAYS = 90;

  /**
   * Create a new wallet session token
   */
  static async createSession(data: {
    userId?: string;
    passType: 'vip' | 'business' | 'voucher';
    platform: 'apple' | 'google';
  }): Promise<string> {
    const token = this.generateSecureToken();
    
    const session: WalletSession = {
      token,
      userId: data.userId,
      passType: data.passType,
      platform: data.platform,
      createdAt: new Date(),
      beacons: [],
      downloads: [],
      inferredSuccess: false,
      confidenceScore: 0,
      status: 'pending'
    };

    await db.collection(this.COLLECTION).doc(token).set(session);
    
    logger.info('[WalletTelemetry] Session created', { token, ...data });
    
    return token;
  }

  /**
   * Record a client-side beacon event
   */
  static async recordBeacon(beacon: TelemetryBeacon): Promise<void> {
    try {
      const sessionRef = db.collection(this.COLLECTION).doc(beacon.token);
      const sessionDoc = await sessionRef.get();

      if (!sessionDoc.exists) {
        logger.warn('[WalletTelemetry] Beacon for unknown session', { token: beacon.token });
        return;
      }

      const session = sessionDoc.data() as WalletSession;

      // Update session with new beacon
      session.beacons.push({
        ...beacon,
        timestamp: new Date()
      });

      // Update specific timestamps based on beacon type
      if (beacon.type === 'apple-click' || beacon.type === 'google-click') {
        session.clickedAt = new Date();
      }
      
      if (beacon.type === 'visibility-hidden') {
        session.visibilityChangeAt = new Date();
      }

      // Recalculate success inference
      const inference = this.inferSuccess(session);
      session.inferredSuccess = inference.success;
      session.confidenceScore = inference.confidence;
      session.status = inference.status;

      await sessionRef.update(session);

      logger.info('[WalletTelemetry] Beacon recorded', { 
        token: beacon.token, 
        type: beacon.type,
        confidence: inference.confidence,
        status: inference.status
      });

    } catch (error) {
      logger.error('[WalletTelemetry] Error recording beacon:', error);
    }
  }

  /**
   * Record a wallet pass download event
   */
  static async recordDownload(event: DownloadEvent): Promise<void> {
    try {
      const sessionRef = db.collection(this.COLLECTION).doc(event.token);
      const sessionDoc = await sessionRef.get();

      if (!sessionDoc.exists) {
        logger.warn('[WalletTelemetry] Download for unknown session', { token: event.token });
        return;
      }

      const session = sessionDoc.data() as WalletSession;

      // Parse user agent to detect iOS Passbook installer
      const agent = useragent.parse(event.userAgent);
      const isPassbookInstaller = this.isApplePassbookInstaller(event.userAgent);

      const downloadEvent: DownloadEvent = {
        ...event,
        timestamp: new Date(),
        isPassbookInstaller,
        deviceInfo: {
          family: agent.family,
          os: agent.os.family,
          version: agent.os.toVersion()
        }
      };

      session.downloads.push(downloadEvent);
      session.downloadedAt = new Date();

      // Apple Passbook installer UA is STRONG signal of success
      if (isPassbookInstaller) {
        session.inferredSuccess = true;
        session.confidenceScore = 95;
        session.status = 'confirmed_success';
        logger.info('[WalletTelemetry] ✅ Apple Passbook installer detected - HIGH CONFIDENCE SUCCESS', { 
          token: event.token 
        });
      } else {
        // Recalculate inference
        const inference = this.inferSuccess(session);
        session.inferredSuccess = inference.success;
        session.confidenceScore = inference.confidence;
        session.status = inference.status;
      }

      await sessionRef.update(session);

      logger.info('[WalletTelemetry] Download recorded', { 
        token: event.token,
        kind: event.kind,
        isPassbookInstaller,
        os: agent.os.family,
        confidence: session.confidenceScore
      });

    } catch (error) {
      logger.error('[WalletTelemetry] Error recording download:', error);
    }
  }

  /**
   * Infer success using AI-ish heuristics
   */
  private static inferSuccess(session: WalletSession): {
    success: boolean;
    confidence: number;
    status: 'pending' | 'likely_success' | 'confirmed_success' | 'likely_failed' | 'abandoned';
  } {
    let confidence = 0;
    let reasons: string[] = [];

    // HEURISTIC 1: Apple Passbook installer UA (95% confidence)
    const hasPassbookUA = session.downloads.some(d => d.isPassbookInstaller);
    if (hasPassbookUA) {
      confidence = 95;
      reasons.push('Passbook installer UA detected');
      return { success: true, confidence, status: 'confirmed_success' };
    }

    // HEURISTIC 2: Visibility change within 5s of click (70% confidence)
    if (session.clickedAt && session.visibilityChangeAt) {
      const timeDiff = session.visibilityChangeAt.getTime() - session.clickedAt.getTime();
      if (timeDiff > 0 && timeDiff < 5000) {
        confidence += 70;
        reasons.push(`Tab hidden ${timeDiff}ms after click (likely wallet opened)`);
      }
    }

    // HEURISTIC 3: Download occurred (40% confidence)
    if (session.downloadedAt) {
      confidence += 40;
      reasons.push('Pass file downloaded');
    }

    // HEURISTIC 4: Post-click beacon received (20% confidence)
    const hasPostClickBeacon = session.beacons.some(b => 
      b.type === 'apple-post-2s' || b.type === 'google-post-2s'
    );
    if (hasPostClickBeacon) {
      confidence += 20;
      reasons.push('Post-click beacon received');
    }

    // HEURISTIC 5: Popup blocked (negative signal)
    const hasPopupBlocked = session.beacons.some(b => b.type === 'popup-blocked');
    if (hasPopupBlocked) {
      confidence = Math.max(0, confidence - 50);
      reasons.push('Popup blocker detected (negative signal)');
    }

    // HEURISTIC 6: No activity after 30s (likely abandoned)
    const now = new Date().getTime();
    const lastActivity = Math.max(
      session.clickedAt?.getTime() || 0,
      session.downloadedAt?.getTime() || 0,
      ...session.beacons.map(b => b.timestamp.getTime())
    );
    
    if (now - lastActivity > 30000 && confidence < 50) {
      return { success: false, confidence: 10, status: 'abandoned' };
    }

    // Cap confidence at 100
    confidence = Math.min(100, confidence);

    // Determine status
    let status: 'pending' | 'likely_success' | 'confirmed_success' | 'likely_failed' | 'abandoned';
    if (confidence >= 80) {
      status = 'confirmed_success';
    } else if (confidence >= 50) {
      status = 'likely_success';
    } else if (confidence >= 20) {
      status = 'pending';
    } else {
      status = 'likely_failed';
    }

    logger.debug('[WalletTelemetry] Inference', { 
      token: session.token, 
      confidence, 
      status, 
      reasons 
    });

    return { 
      success: confidence >= 50, 
      confidence, 
      status 
    };
  }

  /**
   * Detect Apple Passbook installer from User-Agent
   * iOS Wallet app has "Passbook" in UA when adding passes
   */
  private static isApplePassbookInstaller(ua: string): boolean {
    if (!ua) return false;
    
    const uaLower = ua.toLowerCase();
    
    // iOS 6-8 used "Passbook"
    // iOS 9+ uses "Wallet" or "PassKit"
    return (
      uaLower.includes('passbook') ||
      uaLower.includes('passk it') ||
      (uaLower.includes('wallet') && uaLower.includes('ios')) ||
      (uaLower.includes('passkit') && uaLower.includes('mobile'))
    );
  }

  /**
   * Get telemetry statistics for admin dashboard
   */
  static async getStats(timeRange: 'today' | 'week' | 'month' = 'today'): Promise<{
    total: number;
    confirmedSuccess: number;
    likelySuccess: number;
    failed: number;
    abandoned: number;
    avgConfidence: number;
    platforms: { apple: number; google: number };
    passTypes: { vip: number; business: number; voucher: number };
  }> {
    try {
      const now = new Date();
      let startDate: Date;

      if (timeRange === 'today') {
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      } else if (timeRange === 'week') {
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else {
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }

      const snapshot = await db.collection(this.COLLECTION)
        .where('createdAt', '>=', startDate)
        .get();

      const sessions = snapshot.docs.map(doc => doc.data() as WalletSession);

      const stats = {
        total: sessions.length,
        confirmedSuccess: sessions.filter(s => s.status === 'confirmed_success').length,
        likelySuccess: sessions.filter(s => s.status === 'likely_success').length,
        failed: sessions.filter(s => s.status === 'likely_failed').length,
        abandoned: sessions.filter(s => s.status === 'abandoned').length,
        avgConfidence: sessions.reduce((sum, s) => sum + s.confidenceScore, 0) / (sessions.length || 1),
        platforms: {
          apple: sessions.filter(s => s.platform === 'apple').length,
          google: sessions.filter(s => s.platform === 'google').length
        },
        passTypes: {
          vip: sessions.filter(s => s.passType === 'vip').length,
          business: sessions.filter(s => s.passType === 'business').length,
          voucher: sessions.filter(s => s.passType === 'voucher').length
        }
      };

      return stats;

    } catch (error) {
      logger.error('[WalletTelemetry] Error getting stats:', error);
      throw error;
    }
  }

  /**
   * Cleanup old telemetry data (90 day retention)
   */
  static async cleanup(): Promise<number> {
    try {
      const cutoffDate = new Date(Date.now() - this.RETENTION_DAYS * 24 * 60 * 60 * 1000);
      
      const snapshot = await db.collection(this.COLLECTION)
        .where('createdAt', '<', cutoffDate)
        .limit(500) // Batch delete
        .get();

      const batch = db.batch();
      snapshot.docs.forEach(doc => batch.delete(doc.ref));
      
      await batch.commit();

      logger.info('[WalletTelemetry] Cleanup completed', { 
        deleted: snapshot.size,
        cutoffDate 
      });

      return snapshot.size;

    } catch (error) {
      logger.error('[WalletTelemetry] Cleanup error:', error);
      return 0;
    }
  }

  /**
   * Generate secure token for session tracking
   */
  private static generateSecureToken(): string {
    return require('crypto').randomBytes(32).toString('base64url');
  }
}
