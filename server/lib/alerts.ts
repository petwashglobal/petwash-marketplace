import { logger } from './observability';
import sgMail from './sendgrid';
import { sendGuardedEmail } from './guarded-sendgrid';

interface AlertConfig {
  name: string;
  threshold: number;
  duration: number;
  severity: 'critical' | 'warning' | 'info';
  enabled: boolean;
}

interface Alert {
  name: string;
  message: string;
  severity: 'critical' | 'warning' | 'info';
  timestamp: Date;
  metadata?: Record<string, any>;
}

class AlertManager {
  private static instance: AlertManager;
  private alerts: Alert[] = [];
  private alertCounts: Map<string, number> = new Map();
  private lastAlertTime: Map<string, Date> = new Map();

  private configs: AlertConfig[] = [
    {
      name: 'auth_error_rate_high',
      threshold: 0.02,
      duration: 300000,
      severity: 'critical',
      enabled: true
    },
    {
      name: 'auth_latency_p95_high',
      threshold: 2000,
      duration: 300000,
      severity: 'warning',
      enabled: true
    },
    {
      name: 'server_error_rate_high',
      threshold: 0.01,
      duration: 300000,
      severity: 'critical',
      enabled: true
    },
    {
      name: 'firestore_error_rate_high',
      threshold: 0.05,
      duration: 300000,
      severity: 'warning',
      enabled: true
    }
  ];

  private constructor() {}

  static getInstance(): AlertManager {
    if (!AlertManager.instance) {
      AlertManager.instance = new AlertManager();
    }
    return AlertManager.instance;
  }

  async triggerAlert(alert: Alert) {
    this.alerts.push(alert);
    
    if (this.alerts.length > 1000) {
      this.alerts = this.alerts.slice(-1000);
    }

    logger.error(`[ALERT] ${alert.name}`, {
      severity: alert.severity,
      message: alert.message,
      metadata: alert.metadata
    });

    const alertKey = alert.name;
    const lastAlert = this.lastAlertTime.get(alertKey);
    const now = new Date();
    
    const cooldown = 3600000;
    if (lastAlert && (now.getTime() - lastAlert.getTime()) < cooldown) {
      return;
    }

    this.lastAlertTime.set(alertKey, now);

    await Promise.all([
      this.sendEmailAlert(alert),
      this.sendSlackAlert(alert)
      // SMS alerts removed - using Firebase Auth MFA for phone verification
    ]);
  }

  private async sendEmailAlert(alert: Alert) {
    const apiKey = process.env.SENDGRID_API_KEY;
    const toEmail = process.env.REPORTS_EMAIL_TO || 'Support@PetWash.co.il';

    if (!apiKey) {
      logger.warn('SendGrid API key not configured - email alert skipped');
      return;
    }

    try {
      const severityColors = {
        critical: '#ef4444',
        warning: '#f59e0b',
        info: '#3b82f6'
      };

      const msg = {
        to: toEmail,
        from: 'alerts@petwash.co.il',
        subject: `[${alert.severity.toUpperCase()}] Pet Wash Alert: ${alert.name}`,
        html: `
          <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: ${severityColors[alert.severity]}; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; font-size: 24px;">⚠️ Alert Triggered</h1>
            </div>
            <div style="background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px;">
              <h2 style="color: #1f2937; margin-top: 0;">${alert.name}</h2>
              <p style="color: #4b5563; font-size: 16px;">${alert.message}</p>
              
              <div style="background: white; border: 1px solid #e5e7eb; border-radius: 6px; padding: 16px; margin-top: 20px;">
                <h3 style="margin-top: 0; color: #374151;">Details</h3>
                <ul style="color: #6b7280; line-height: 1.8;">
                  <li><strong>Severity:</strong> ${alert.severity}</li>
                  <li><strong>Time:</strong> ${alert.timestamp.toISOString()}</li>
                  ${alert.metadata ? `<li><strong>Metadata:</strong> <pre style="background: #f3f4f6; padding: 8px; border-radius: 4px; overflow-x: auto;">${JSON.stringify(alert.metadata, null, 2)}</pre></li>` : ''}
                </ul>
              </div>

              <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
                <a href="https://petwash.co.il/ops-dashboard" style="background: #111; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                  View Ops Dashboard
                </a>
              </div>
            </div>
          </div>
        `
      };

      // PR-EMAIL-3: route through guarded helper.
      const r = await sendGuardedEmail({
        service: 'internal:ops-alert',
        msg,
      });
      if (!r.ok) {
        logger.warn('Email alert blocked or failed', { alertName: alert.name, reason: r.reason });
        return;
      }
      logger.info('Email alert sent', { alertName: alert.name, recipient: toEmail });
    } catch (error) {
      logger.error('Failed to send email alert', error);
    }
  }

  private async sendSlackAlert(alert: Alert) {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;

    if (!webhookUrl) {
      logger.debug('Slack webhook not configured - Slack alert skipped');
      return;
    }

    try {
      const severityEmojis = {
        critical: '🚨',
        warning: '⚠️',
        info: 'ℹ️'
      };

      const severityColors = {
        critical: 'danger',
        warning: 'warning',
        info: 'good'
      };

      const payload = {
        username: 'Pet Wash Alerts',
        icon_emoji: ':dog:',
        attachments: [{
          color: severityColors[alert.severity],
          title: `${severityEmojis[alert.severity]} ${alert.name}`,
          text: alert.message,
          fields: [
            {
              title: 'Severity',
              value: alert.severity,
              short: true
            },
            {
              title: 'Time',
              value: alert.timestamp.toISOString(),
              short: true
            },
            ...(alert.metadata ? [{
              title: 'Metadata',
              value: `\`\`\`${JSON.stringify(alert.metadata, null, 2)}\`\`\``,
              short: false
            }] : [])
          ],
          footer: '⁦PetWash™⁩ Monitoring',
          footer_icon: 'https://petwash.co.il/petwash-logo-official.png'
        }]
      };

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Slack webhook failed: ${response.status}`);
      }

      logger.info('Slack alert sent', { alertName: alert.name });
    } catch (error) {
      logger.error('Failed to send Slack alert', error);
    }
  }

  getRecentAlerts(limit: number = 50): Alert[] {
    return this.alerts.slice(-limit);
  }

  getAlertConfigs(): AlertConfig[] {
    return this.configs;
  }

  updateAlertConfig(name: string, updates: Partial<AlertConfig>) {
    const config = this.configs.find(c => c.name === name);
    if (config) {
      Object.assign(config, updates);
    }
  }
}

export const alertManager = AlertManager.getInstance();

export async function checkAuthErrorRate(errorCount: number, totalCount: number) {
  const errorRate = totalCount > 0 ? errorCount / totalCount : 0;
  
  if (errorRate > 0.02) {
    await alertManager.triggerAlert({
      name: 'auth_error_rate_high',
      message: `Authentication error rate is ${(errorRate * 100).toFixed(2)}% (threshold: 2%)`,
      severity: 'critical',
      timestamp: new Date(),
      metadata: {
        error_count: errorCount,
        total_count: totalCount,
        error_rate: errorRate
      }
    });
  }
}

export async function checkAuthLatency(p95Latency: number) {
  if (p95Latency > 2000) {
    await alertManager.triggerAlert({
      name: 'auth_latency_p95_high',
      message: `P95 authentication latency is ${p95Latency}ms (threshold: 2000ms)`,
      severity: 'warning',
      timestamp: new Date(),
      metadata: {
        p95_latency_ms: p95Latency
      }
    });
  }
}

export async function checkServerErrorRate(errorCount: number, totalCount: number) {
  const errorRate = totalCount > 0 ? errorCount / totalCount : 0;

  if (errorRate > 0.01) {
    // 2026-09-06 lesson: this alert fired correctly at 12:13:57 with a 100% 5xx
    // rate, but carried nothing explaining WHY — database health was green
    // (`SELECT 1` passes on a read-only database) so the operator had a spike
    // with no cause. Attach the write-probe state so the relationship between
    // "everything is 5xx" and "the database refuses writes" is visible in the
    // alert itself, not reconstructed from logs a day later.
    let dbWrite: Record<string, unknown> | undefined;
    try {
      const { getDbWriteReadiness } = await import('./dbWriteReadiness');
      const w = await getDbWriteReadiness();
      dbWrite = {
        db_reachable: w.dbReachable,
        db_readable: w.dbReadable,
        db_writable: w.dbWritable,
        db_write_error_code: w.dbWriteErrorCode,
        db_write_error_kind: w.dbWriteErrorKind,
      };
    } catch { /* enrichment must never suppress the alert */ }

    await alertManager.triggerAlert({
      name: 'server_error_rate_high',
      message: `5xx error rate is ${(errorRate * 100).toFixed(2)}% (threshold: 1%)`
        + (dbWrite && dbWrite.db_writable === false
            ? ` — DATABASE IS NOT WRITABLE (${dbWrite.db_write_error_kind}`
              + `${dbWrite.db_write_error_code ? ` SQLSTATE ${dbWrite.db_write_error_code}` : ''})`
            : ''),
      severity: 'critical',
      timestamp: new Date(),
      metadata: {
        error_count: errorCount,
        total_count: totalCount,
        error_rate: errorRate,
        ...(dbWrite ?? {}),
      }
    });
  }
}

/**
 * DB_WRITE_UNAVAILABLE — the alert that did not exist on 2026-09-06.
 *
 * Fires on the specific, otherwise-invisible state: the database is reachable
 * and answering reads while refusing every write (PostgreSQL SQLSTATE 25006).
 * In that state uptime checks stay green, `/api/health` stays green, and every
 * booking, payment, job and fiscal document silently fails.
 *
 * Deliberately NOT folded into the generic database-down alert: "down" and
 * "up but refusing writes" need different operator responses, and the second
 * one is the one that hides.
 */
export async function checkDbWriteAvailability(): Promise<void> {
  const { getDbWriteReadiness } = await import('./dbWriteReadiness');
  const w = await getDbWriteReadiness();

  // Not configured / unreachable is a different alert's job — this one is
  // specifically about reads working while writes do not.
  if (!w.dbReadable || w.dbWritable) return;

  await alertManager.triggerAlert({
    name: 'db_write_unavailable',
    message:
      `Database is READABLE but NOT WRITABLE (${w.dbWriteErrorKind}`
      + `${w.dbWriteErrorCode ? ` SQLSTATE ${w.dbWriteErrorCode}` : ''}). `
      + 'Reads and uptime checks will look healthy while every write fails — '
      + 'bookings, payments, async jobs and fiscal documents are all affected.',
    severity: 'critical',
    timestamp: new Date(),
    metadata: {
      db_reachable: w.dbReachable,
      db_readable: w.dbReadable,
      db_writable: w.dbWritable,
      db_write_error_code: w.dbWriteErrorCode,
      db_write_error_kind: w.dbWriteErrorKind,
      db_write_latency_ms: w.dbWriteLatencyMs,
      checked_at: w.checkedAt,
      revision: process.env.K_REVISION || null,
    },
  });
}
