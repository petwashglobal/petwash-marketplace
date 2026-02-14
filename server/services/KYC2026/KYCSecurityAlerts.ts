/**
 * KYC 2026 Real-Time Security Alerts
 * 
 * Sends immediate notifications for:
 * - Critical anomaly detection (risk score >= 50)
 * - Blocked IP/device events
 * - Duplicate document usage across users
 * - Admin accessing KYC records outside business hours
 * - Chain integrity violations in audit trail
 * 
 * Channels: Email (SendGrid), Server Logs
 * Future: Slack webhook, SMS (Twilio)
 */

import { getSendGridClient, isSendGridConfigured } from '../../lib/sendgrid';
import { logger } from '../../lib/logger';
import type { AnomalyFlag } from './KYCAnomalyDetector';

export interface SecurityAlertInput {
  alertType: 'anomaly' | 'block' | 'duplicate_doc' | 'admin_access' | 'chain_breach' | 'mfa_failure' | 'liveness_failure';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  userId?: string;
  ipAddress?: string;
  riskScore?: number;
  anomalies?: AnomalyFlag[];
  metadata?: Record<string, any>;
}

const ALERT_FROM = 'security@petwash.co.il';
const ALERT_TO = 'security@petwash.co.il';
const ALERT_SUBJECT_PREFIX = '[PetWash KYC Security]';

const recentAlerts = new Map<string, number>();
const DEDUP_WINDOW_MS = 5 * 60 * 1000;

export class KYCSecurityAlerts {
  
  static async send(input: SecurityAlertInput): Promise<void> {
    const alertKey = `${input.alertType}:${input.userId || 'system'}:${input.severity}`;
    const lastSent = recentAlerts.get(alertKey);
    if (lastSent && Date.now() - lastSent < DEDUP_WINDOW_MS) {
      logger.info(`[KYC2026:Alert] Dedup suppressed: ${alertKey}`);
      return;
    }
    recentAlerts.set(alertKey, Date.now());

    logger.warn(`[KYC2026:SECURITY_ALERT] ${input.severity.toUpperCase()}: ${input.title}`, {
      alertType: input.alertType,
      userId: input.userId,
      riskScore: input.riskScore,
      description: input.description,
    });

    if (input.severity === 'critical' || input.severity === 'warning') {
      await this.sendEmailAlert(input);
    }
  }

  private static async sendEmailAlert(input: SecurityAlertInput): Promise<void> {
    if (!isSendGridConfigured()) {
      logger.warn('[KYC2026:Alert] SendGrid not configured - email alert skipped');
      return;
    }

    try {
      const sgMail = getSendGridClient();

      const severityEmoji = input.severity === 'critical' ? '🚨' : input.severity === 'warning' ? '⚠️' : 'ℹ️';
      const severityColor = input.severity === 'critical' ? '#dc2626' : input.severity === 'warning' ? '#f59e0b' : '#3b82f6';

      const anomalyRows = (input.anomalies || [])
        .map(a => `<tr><td style="padding:6px;border:1px solid #e5e7eb">${a.type}</td><td style="padding:6px;border:1px solid #e5e7eb">${a.severity}</td><td style="padding:6px;border:1px solid #e5e7eb">${a.description}</td><td style="padding:6px;border:1px solid #e5e7eb">${a.score}</td></tr>`)
        .join('');

      const html = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f9fafb;padding:20px">
          <div style="background:${severityColor};color:white;padding:16px;border-radius:8px 8px 0 0">
            <h2 style="margin:0">${severityEmoji} ${ALERT_SUBJECT_PREFIX} ${input.title}</h2>
          </div>
          <div style="background:white;padding:20px;border:1px solid #e5e7eb;border-radius:0 0 8px 8px">
            <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
              <tr><td style="padding:6px;font-weight:bold;width:120px">Alert Type:</td><td style="padding:6px">${input.alertType}</td></tr>
              <tr><td style="padding:6px;font-weight:bold">Severity:</td><td style="padding:6px;color:${severityColor};font-weight:bold">${input.severity.toUpperCase()}</td></tr>
              <tr><td style="padding:6px;font-weight:bold">User ID:</td><td style="padding:6px">${input.userId || 'N/A'}</td></tr>
              <tr><td style="padding:6px;font-weight:bold">IP Address:</td><td style="padding:6px">${input.ipAddress || 'N/A'}</td></tr>
              <tr><td style="padding:6px;font-weight:bold">Risk Score:</td><td style="padding:6px">${input.riskScore ?? 'N/A'}</td></tr>
              <tr><td style="padding:6px;font-weight:bold">Time:</td><td style="padding:6px">${new Date().toISOString()}</td></tr>
            </table>
            <p style="margin:12px 0"><strong>Description:</strong> ${input.description}</p>
            ${anomalyRows ? `
              <h3 style="margin:16px 0 8px">Detected Anomalies:</h3>
              <table style="width:100%;border-collapse:collapse;font-size:13px">
                <thead><tr style="background:#f3f4f6">
                  <th style="padding:6px;border:1px solid #e5e7eb;text-align:left">Type</th>
                  <th style="padding:6px;border:1px solid #e5e7eb;text-align:left">Severity</th>
                  <th style="padding:6px;border:1px solid #e5e7eb;text-align:left">Description</th>
                  <th style="padding:6px;border:1px solid #e5e7eb;text-align:left">Score</th>
                </tr></thead>
                <tbody>${anomalyRows}</tbody>
              </table>
            ` : ''}
            <hr style="margin:20px 0;border:none;border-top:1px solid #e5e7eb"/>
            <p style="font-size:12px;color:#6b7280">This is an automated security alert from PetWash KYC 2026 Security Monitor. Do not reply to this email.</p>
          </div>
        </div>
      `;

      await sgMail.send({
        to: ALERT_TO,
        from: ALERT_FROM,
        subject: `${ALERT_SUBJECT_PREFIX} ${severityEmoji} ${input.severity.toUpperCase()}: ${input.title}`,
        html,
      });

      logger.info(`[KYC2026:Alert] Email sent: ${input.title}`);
    } catch (err: any) {
      logger.error(`[KYC2026:Alert] Email send failed: ${err.message}`);
    }
  }

  static cleanup(): void {
    const now = Date.now();
    for (const [key, ts] of recentAlerts) {
      if (now - ts > DEDUP_WINDOW_MS * 2) {
        recentAlerts.delete(key);
      }
    }
  }
}
