/**
 * Device Security Alerts Service
 * Monitors device activity and sends real-time alerts for suspicious behavior
 * Integrates with Email and FCM push notifications
 */

import { logger } from '../lib/logger';
import { AuditLedgerService } from './AuditLedgerService';
import { EmailService } from '../emailService';

interface SecurityAlert {
  userId: string;
  userEmail: string;
  alertType: 'new_device' | 'suspicious_login' | 'location_change' | 'fraud_detected';
  severity: 'low' | 'medium' | 'high' | 'critical';
  deviceInfo: {
    deviceLabel: string;
    platform: string;
    ipAddress?: string;
    location?: {
      city?: string;
      country?: string;
    };
  };
  details: string;
  timestamp: Date;
  fraudScore?: number;
  fraudFlags?: string[];
}

interface AlertPreferences {
  emailEnabled: boolean;
  smsEnabled: boolean;
  pushEnabled: boolean;
  minSeverity: 'low' | 'medium' | 'high' | 'critical';
}

export class DeviceSecurityAlertsService {

  /**
   * Send security alert via all enabled channels
   */
  static async sendAlert(alert: SecurityAlert, preferences?: AlertPreferences): Promise<void> {
    try {
      // Default preferences: all channels enabled, medium+ severity
      const prefs: AlertPreferences = preferences || {
        emailEnabled: true,
        smsEnabled: true,
        pushEnabled: true,
        minSeverity: 'medium',
      };

      // Check if alert meets minimum severity
      if (!this.meetsSeverityThreshold(alert.severity, prefs.minSeverity)) {
        logger.info('[Device Security] Alert below threshold, skipping', {
          alertSeverity: alert.severity,
          minSeverity: prefs.minSeverity,
        });
        return;
      }

      // Log to audit trail
      await this.logToAudit(alert);

      // Send notifications in parallel
      const promises: Promise<any>[] = [];

      if (prefs.emailEnabled) {
        promises.push(this.sendEmailAlert(alert));
      }

      // SMS alerts removed - using Firebase Auth MFA for phone verification
      // For critical alerts, email and push notifications are sufficient

      if (prefs.pushEnabled) {
        promises.push(this.sendPushAlert(alert));
      }

      await Promise.allSettled(promises);

      logger.info('[Device Security] Alert sent successfully', {
        userId: alert.userId,
        alertType: alert.alertType,
        severity: alert.severity,
      });
    } catch (error) {
      logger.error('[Device Security] Failed to send alert', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: alert.userId,
      });
      throw error;
    }
  }

  /**
   * Send email notification
   */
  private static async sendEmailAlert(alert: SecurityAlert): Promise<void> {
    const subject = this.getEmailSubject(alert);
    const htmlContent = this.getEmailHTML(alert);

    await EmailService.send({
      to: alert.userEmail,
      subject,
      html: htmlContent,
    });

    logger.info('[Device Security] Email alert sent', {
      userId: alert.userId,
      alertType: alert.alertType,
    });
  }

  /**
   * SMS alerts removed - Firebase Auth MFA handles phone verification
   * For critical security alerts, use email and push notifications
   */

  /**
   * Send FCM push notification
   */
  private static async sendPushAlert(alert: SecurityAlert): Promise<void> {
    // Note: In production, integrate with FCM to send push notifications
    // This requires the user's FCM token stored in Firestore
    logger.info('[Device Security] Push alert would be sent', {
      userId: alert.userId,
      alertType: alert.alertType,
      note: 'FCM integration required',
    });
  }

  /**
   * Log security alert to immutable audit trail
   */
  private static async logToAudit(alert: SecurityAlert): Promise<void> {
    await AuditLedgerService.recordEvent({
      eventType: 'security_alert',
      userId: alert.userId,
      eventData: {
        alertType: alert.alertType,
        severity: alert.severity,
        deviceLabel: alert.deviceInfo.deviceLabel,
        platform: alert.deviceInfo.platform,
        ipAddress: alert.deviceInfo.ipAddress,
        location: alert.deviceInfo.location,
        fraudScore: alert.fraudScore,
        fraudFlags: alert.fraudFlags,
        details: alert.details,
      },
      metadata: {
        timestamp: alert.timestamp.toISOString(),
        source: 'DeviceSecurityAlertsService',
      },
    });
  }

  /**
   * Check if alert severity meets threshold
   */
  private static meetsSeverityThreshold(
    alertSeverity: SecurityAlert['severity'],
    minSeverity: SecurityAlert['severity']
  ): boolean {
    const severityLevels = {
      low: 1,
      medium: 2,
      high: 3,
      critical: 4,
    };

    return severityLevels[alertSeverity] >= severityLevels[minSeverity];
  }

  /**
   * Get email subject based on alert type
   */
  private static getEmailSubject(alert: SecurityAlert): string {
    const emoji = {
      low: '🔔',
      medium: '⚠️',
      high: '🚨',
      critical: '🔴',
    }[alert.severity];

    switch (alert.alertType) {
      case 'new_device':
        return `${emoji} New Device Logged In - Pet Wash™`;
      case 'suspicious_login':
        return `${emoji} Suspicious Login Attempt - Pet Wash™`;
      case 'location_change':
        return `${emoji} Unusual Location Detected - Pet Wash™`;
      case 'fraud_detected':
        return `${emoji} URGENT: Potential Fraud Detected - Pet Wash™`;
      default:
        return `${emoji} Security Alert - Pet Wash™`;
    }
  }

  /**
   * Get email HTML content
   */
  private static getEmailHTML(alert: SecurityAlert): string {
    const { deviceInfo, details, fraudScore, fraudFlags } = alert;
    const locationStr = deviceInfo.location
      ? `${deviceInfo.location.city}, ${deviceInfo.location.country}`
      : 'Unknown';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Security Alert</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f5f5f5;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 0;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <!-- Header -->
                <tr>
                  <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px 12px 0 0;">
                    <h1 style="margin: 0; color: white; font-size: 28px; font-weight: 600;">🔒 Security Alert</h1>
                    <p style="margin: 10px 0 0; color: rgba(255,255,255,0.9); font-size: 16px;">Pet Wash™ Account Security</p>
                  </td>
                </tr>
                
                <!-- Content -->
                <tr>
                  <td style="padding: 40px;">
                    <div style="background-color: ${this.getSeverityColor(alert.severity)}; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
                      <h2 style="margin: 0 0 10px; color: #1a1a1a; font-size: 20px;">${this.getAlertTitle(alert.alertType)}</h2>
                      <p style="margin: 0; color: #4a4a4a; font-size: 15px; line-height: 1.6;">${details}</p>
                    </div>

                    <h3 style="margin: 0 0 15px; color: #1a1a1a; font-size: 16px; font-weight: 600;">Device Details:</h3>
                    <table width="100%" cellpadding="8" cellspacing="0" style="margin-bottom: 30px;">
                      <tr>
                        <td style="color: #666; font-size: 14px; padding: 8px 0; border-bottom: 1px solid #eee;">Device Name</td>
                        <td style="color: #1a1a1a; font-size: 14px; font-weight: 500; padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">${deviceInfo.deviceLabel}</td>
                      </tr>
                      <tr>
                        <td style="color: #666; font-size: 14px; padding: 8px 0; border-bottom: 1px solid #eee;">Platform</td>
                        <td style="color: #1a1a1a; font-size: 14px; font-weight: 500; padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">${deviceInfo.platform}</td>
                      </tr>
                      <tr>
                        <td style="color: #666; font-size: 14px; padding: 8px 0; border-bottom: 1px solid #eee;">Location</td>
                        <td style="color: #1a1a1a; font-size: 14px; font-weight: 500; padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">${locationStr}</td>
                      </tr>
                      ${deviceInfo.ipAddress ? `
                      <tr>
                        <td style="color: #666; font-size: 14px; padding: 8px 0; border-bottom: 1px solid #eee;">IP Address</td>
                        <td style="color: #1a1a1a; font-size: 14px; font-weight: 500; padding: 8px 0; border-bottom: 1px solid #eee; text-align: right; font-family: monospace;">${deviceInfo.ipAddress}</td>
                      </tr>
                      ` : ''}
                      ${fraudScore !== undefined ? `
                      <tr>
                        <td style="color: #666; font-size: 14px; padding: 8px 0; border-bottom: 1px solid #eee;">Trust Score</td>
                        <td style="color: ${fraudScore >= 70 ? '#10b981' : fraudScore >= 40 ? '#f59e0b' : '#ef4444'}; font-size: 14px; font-weight: 600; padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">${100 - fraudScore}/100</td>
                      </tr>
                      ` : ''}
                    </table>

                    ${fraudFlags && fraudFlags.length > 0 ? `
                    <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; border-left: 4px solid #f59e0b; margin-bottom: 30px;">
                      <h4 style="margin: 0 0 10px; color: #92400e; font-size: 14px; font-weight: 600;">⚠️ Security Flags:</h4>
                      <ul style="margin: 0; padding-left: 20px; color: #92400e; font-size: 13px;">
                        ${fraudFlags.map(flag => `<li style="margin: 5px 0;">${flag}</li>`).join('')}
                      </ul>
                    </div>
                    ` : ''}

                    <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
                      <h4 style="margin: 0 0 10px; color: #1a1a1a; font-size: 14px; font-weight: 600;">🛡️ What Should I Do?</h4>
                      <ul style="margin: 0; padding-left: 20px; color: #4a4a4a; font-size: 13px; line-height: 1.8;">
                        <li>If this was you, you can safely ignore this email</li>
                        <li>If you don't recognize this device, <strong>secure your account immediately</strong></li>
                        <li>Review all connected devices and remove any you don't recognize</li>
                        <li>Change your password if you suspect unauthorized access</li>
                      </ul>
                    </div>

                    <div style="text-align: center;">
                      <a href="https://www.petwash.co.il/connected-devices" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 15px;">
                        Review Connected Devices
                      </a>
                    </div>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="padding: 30px 40px; background-color: #f9fafb; border-radius: 0 0 12px 12px; text-align: center;">
                    <p style="margin: 0 0 10px; color: #6b7280; font-size: 12px;">
                      This is an automated security alert from Pet Wash™
                    </p>
                    <p style="margin: 0; color: #6b7280; font-size: 12px;">
                      Time: ${alert.timestamp.toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' })} (Israel Time)
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
  }

  /**
   * Get email text content (plain text fallback)
   */
  private static getEmailText(alert: SecurityAlert): string {
    const { deviceInfo, details, fraudScore, fraudFlags } = alert;
    const locationStr = deviceInfo.location
      ? `${deviceInfo.location.city}, ${deviceInfo.location.country}`
      : 'Unknown';

    let text = `🔒 SECURITY ALERT - Pet Wash™\n\n`;
    text += `${this.getAlertTitle(alert.alertType)}\n\n`;
    text += `${details}\n\n`;
    text += `DEVICE DETAILS:\n`;
    text += `- Device: ${deviceInfo.deviceLabel}\n`;
    text += `- Platform: ${deviceInfo.platform}\n`;
    text += `- Location: ${locationStr}\n`;
    if (deviceInfo.ipAddress) {
      text += `- IP Address: ${deviceInfo.ipAddress}\n`;
    }
    if (fraudScore !== undefined) {
      text += `- Trust Score: ${100 - fraudScore}/100\n`;
    }
    if (fraudFlags && fraudFlags.length > 0) {
      text += `\n⚠️ SECURITY FLAGS:\n`;
      fraudFlags.forEach(flag => {
        text += `  • ${flag}\n`;
      });
    }
    text += `\n`;
    text += `WHAT SHOULD I DO?\n`;
    text += `• If this was you, you can safely ignore this email\n`;
    text += `• If you don't recognize this device, secure your account immediately\n`;
    text += `• Review connected devices: https://www.petwash.co.il/connected-devices\n`;
    text += `• Change your password if you suspect unauthorized access\n\n`;
    text += `---\n`;
    text += `Time: ${alert.timestamp.toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' })} (Israel Time)\n`;
    text += `This is an automated security alert from Pet Wash™`;

    return text;
  }

  /**
   * Get SMS text (concise version)
   */
  // getSMSText method removed - SMS alerts deprecated in favor of Firebase Auth MFA

  /**
   * Get alert title based on type
   */
  private static getAlertTitle(alertType: SecurityAlert['alertType']): string {
    switch (alertType) {
      case 'new_device':
        return 'New Device Signed In';
      case 'suspicious_login':
        return 'Suspicious Login Attempt Detected';
      case 'location_change':
        return 'Unusual Location Detected';
      case 'fraud_detected':
        return 'Potential Fraud Detected';
      default:
        return 'Security Alert';
    }
  }

  /**
   * Get severity background color
   */
  private static getSeverityColor(severity: SecurityAlert['severity']): string {
    switch (severity) {
      case 'low':
        return '#e0f2fe'; // Light blue
      case 'medium':
        return '#fef3c7'; // Light yellow
      case 'high':
        return '#fee2e2'; // Light red
      case 'critical':
        return '#fecaca'; // Darker red
      default:
        return '#f3f4f6'; // Gray
    }
  }

  /**
   * Helper: Create alert for new device login
   */
  static createNewDeviceAlert(params: {
    userId: string;
    userEmail: string;
    deviceLabel: string;
    platform: string;
    ipAddress?: string;
    location?: { city?: string; country?: string };
    trustScore: number;
  }): SecurityAlert {
    const severity: SecurityAlert['severity'] = 
      params.trustScore < 40 ? 'high' : 
      params.trustScore < 70 ? 'medium' : 'low';

    return {
      userId: params.userId,
      userEmail: params.userEmail,
      alertType: 'new_device',
      severity,
      deviceInfo: {
        deviceLabel: params.deviceLabel,
        platform: params.platform,
        ipAddress: params.ipAddress,
        location: params.location,
      },
      details: `A new device (${params.deviceLabel}) has signed in to your Pet Wash™ account. If this was you, you can safely ignore this message.`,
      timestamp: new Date(),
      fraudScore: 100 - params.trustScore,
    };
  }

  /**
   * Helper: Create alert for suspicious login
   */
  static createSuspiciousLoginAlert(params: {
    userId: string;
    userEmail: string;
    deviceLabel: string;
    platform: string;
    ipAddress?: string;
    location?: { city?: string; country?: string };
    fraudFlags: string[];
    trustScore: number;
  }): SecurityAlert {
    return {
      userId: params.userId,
      userEmail: params.userEmail,
      alertType: 'suspicious_login',
      severity: 'high',
      deviceInfo: {
        deviceLabel: params.deviceLabel,
        platform: params.platform,
        ipAddress: params.ipAddress,
        location: params.location,
      },
      details: `We detected suspicious activity during a login attempt on your Pet Wash™ account. Please review your connected devices and secure your account if needed.`,
      timestamp: new Date(),
      fraudScore: 100 - params.trustScore,
      fraudFlags: params.fraudFlags,
    };
  }
}
