/**
 * Production Monitoring & Alerting System
 * Ensures luxury inbox features run smoothly without silent failures
 * 
 * EXPORTS: sendAlert, sendSlackAlert
 */

import { logger } from './lib/logger';
import { db as adminDb } from './lib/firebase-admin';
import sgMail from '@sendgrid/mail';
import { getStationAnalyticsFor24Hours } from './stationsService';

// Initialize SendGrid if available
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const ALERT_EMAIL = process.env.REPORTS_EMAIL_TO || 'admin@petwash.co.il';
const SLACK_WEBHOOK = process.env.SLACK_WEBHOOK_URL || process.env.ALERTS_SLACK_WEBHOOK; // Optional

if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
}

// ============================================
// MONITORING CONFIGURATION
// ============================================

export const MONITORING_CONFIG = {
  cronJobs: {
    vaccineReminder: {
      name: 'Vaccine Reminder Job',
      schedule: '0 9 * * *', // Daily 9 AM
      maxConsecutiveFailures: 2,
      alertThreshold: 'high'
    },
    birthdayCoupon: {
      name: 'Birthday Coupon Job',
      schedule: '0 8 * * *', // Daily 8 AM
      maxConsecutiveFailures: 2,
      alertThreshold: 'high'
    },
    dataIntegrity: {
      name: 'Data Integrity Check',
      schedule: '0 0 * * 0', // Weekly Sunday midnight
      maxConsecutiveFailures: 1,
      alertThreshold: 'medium'
    }
  },
  firestoreMetrics: {
    petReads: {
      path: 'users/{uid}/pets',
      spikeThreshold: 1000, // Alert if >1000 reads/hour
      normalRange: [0, 500]
    },
    inboxWrites: {
      path: 'userInbox/{uid}/messages',
      spikeThreshold: 500, // Alert if >500 writes/hour
      normalRange: [0, 200]
    },
    voucherWrites: {
      path: 'birthday_vouchers',
      spikeThreshold: 100, // Alert if >100 writes/hour
      normalRange: [0, 50]
    }
  },
  nayax: {
    webhookFailures: {
      threshold: 5, // Alert if >5 failures in 10 minutes
      timeWindow: 10 * 60 * 1000 // 10 minutes
    },
    pendingTransactions: {
      maxAge: 15 * 60 * 1000, // Alert if pending >15 minutes
      checkInterval: 5 * 60 * 1000 // Check every 5 minutes
    },
    inactiveStations: {
      maxInactivity: 24 * 60 * 60 * 1000, // Alert if no transactions >24 hours
      checkInterval: 60 * 60 * 1000 // Check every hour
    }
  },
  healthCheck: {
    interval: 300000, // 5 minutes
    timeout: 10000, // 10 seconds
    endpoints: [
      '/healthz',
      '/readiness'
    ]
  }
};

// ============================================
// CRON JOB MONITORING
// ============================================

interface CronJobStatus {
  jobName: string;
  lastRun: Date | null;
  lastSuccess: Date | null;
  lastFailure: Date | null;
  consecutiveFailures: number;
  status: 'healthy' | 'degraded' | 'critical';
  errorMessage?: string;
}

const cronJobStatuses = new Map<string, CronJobStatus>();

/**
 * Record cron job execution
 */
export async function recordCronExecution(
  jobName: string, 
  success: boolean, 
  errorMessage?: string
): Promise<void> {
  const now = new Date();
  
  let status = cronJobStatuses.get(jobName) || {
    jobName,
    lastRun: null,
    lastSuccess: null,
    lastFailure: null,
    consecutiveFailures: 0,
    status: 'healthy' as const
  };

  status.lastRun = now;

  if (success) {
    status.lastSuccess = now;
    status.consecutiveFailures = 0;
    status.status = 'healthy';
    status.errorMessage = undefined;
    logger.info(`[MONITOR] Cron job success: ${jobName}`);
  } else {
    status.lastFailure = now;
    status.consecutiveFailures += 1;
    status.errorMessage = errorMessage;
    
    // Determine severity
    const config = Object.values(MONITORING_CONFIG.cronJobs).find(j => j.name === jobName);
    if (config && status.consecutiveFailures >= config.maxConsecutiveFailures) {
      status.status = 'critical';
      await sendAlert({
        type: 'cron_failure',
        severity: 'critical',
        jobName,
        message: `Cron job "${jobName}" has failed ${status.consecutiveFailures} times consecutively`,
        details: errorMessage
      });
    } else if (status.consecutiveFailures >= 1) {
      status.status = 'degraded';
    }
    
    logger.error(`[MONITOR] Cron job failure: ${jobName}`, { consecutiveFailures: status.consecutiveFailures, error: errorMessage });
  }

  cronJobStatuses.set(jobName, status);
  
  // Store in Firestore for dashboard
  try {
    await adminDb.collection('system_monitoring')
      .doc('cron_jobs')
      .collection('history')
      .add({
        jobName,
        timestamp: now,
        success,
        errorMessage,
        consecutiveFailures: status.consecutiveFailures,
        status: status.status
      });
  } catch (error) {
    logger.error('[MONITOR] Failed to store cron status', error);
  }
}

/**
 * Get cron job health status
 */
export function getCronJobStatus(): CronJobStatus[] {
  return Array.from(cronJobStatuses.values());
}

// ============================================
// FIRESTORE METRICS TRACKING
// ============================================

interface MetricsSnapshot {
  timestamp: Date;
  petReads: number;
  inboxWrites: number;
  voucherWrites: number;
}

const metricsHistory: MetricsSnapshot[] = [];
const MAX_METRICS_HISTORY = 24; // Keep last 24 hours (hourly snapshots)

/**
 * Track Firestore operation
 */
export async function trackFirestoreOperation(
  operation: 'pet_read' | 'inbox_write' | 'voucher_write'
): Promise<void> {
  const now = new Date();
  const currentHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());
  
  // Get or create current hour snapshot
  let snapshot = metricsHistory.find(s => s.timestamp.getTime() === currentHour.getTime());
  
  if (!snapshot) {
    snapshot = {
      timestamp: currentHour,
      petReads: 0,
      inboxWrites: 0,
      voucherWrites: 0
    };
    metricsHistory.push(snapshot);
    
    // Trim old history
    if (metricsHistory.length > MAX_METRICS_HISTORY) {
      metricsHistory.shift();
    }
  }

  // Increment counter
  switch (operation) {
    case 'pet_read':
      snapshot.petReads++;
      if (snapshot.petReads > MONITORING_CONFIG.firestoreMetrics.petReads.spikeThreshold) {
        await sendAlert({
          type: 'firestore_spike',
          severity: 'warning',
          message: `Pet reads spike detected: ${snapshot.petReads} reads in current hour`,
          details: `Threshold: ${MONITORING_CONFIG.firestoreMetrics.petReads.spikeThreshold}`
        });
      }
      break;
    case 'inbox_write':
      snapshot.inboxWrites++;
      if (snapshot.inboxWrites > MONITORING_CONFIG.firestoreMetrics.inboxWrites.spikeThreshold) {
        await sendAlert({
          type: 'firestore_spike',
          severity: 'warning',
          message: `Inbox writes spike detected: ${snapshot.inboxWrites} writes in current hour`,
          details: `Threshold: ${MONITORING_CONFIG.firestoreMetrics.inboxWrites.spikeThreshold}`
        });
      }
      break;
    case 'voucher_write':
      snapshot.voucherWrites++;
      if (snapshot.voucherWrites > MONITORING_CONFIG.firestoreMetrics.voucherWrites.spikeThreshold) {
        await sendAlert({
          type: 'firestore_spike',
          severity: 'warning',
          message: `Voucher writes spike detected: ${snapshot.voucherWrites} writes in current hour`,
          details: `Threshold: ${MONITORING_CONFIG.firestoreMetrics.voucherWrites.spikeThreshold}`
        });
      }
      break;
  }
}

/**
 * Get Firestore metrics
 */
export function getFirestoreMetrics(): MetricsSnapshot[] {
  return metricsHistory;
}

// ============================================
// DATA INTEGRITY CHECKS
// ============================================

export interface IntegrityCheckResult {
  timestamp: Date;
  checks: {
    name: string;
    passed: boolean;
    issues?: string[];
  }[];
  overallStatus: 'healthy' | 'warning' | 'critical';
}

/**
 * Run comprehensive data integrity checks
 */
export async function runDataIntegrityChecks(): Promise<IntegrityCheckResult> {
  const result: IntegrityCheckResult = {
    timestamp: new Date(),
    checks: [],
    overallStatus: 'healthy'
  };

  try {
    // Check 1: All pets have valid data
    const petsCheck = await checkPetsIntegrity();
    result.checks.push(petsCheck);

    // Check 2: No duplicate voucher codes
    const vouchersCheck = await checkVoucherIntegrity();
    result.checks.push(vouchersCheck);

    // Check 3: Inbox messages are properly formatted
    const inboxCheck = await checkInboxIntegrity();
    result.checks.push(inboxCheck);

    // Determine overall status
    const hasFailures = result.checks.some(c => !c.passed);
    const criticalIssues = result.checks.filter(c => !c.passed && c.issues && c.issues.length > 10);
    
    if (criticalIssues.length > 0) {
      result.overallStatus = 'critical';
      await sendAlert({
        type: 'data_integrity',
        severity: 'critical',
        message: `Data integrity check failed: ${criticalIssues.length} critical issues`,
        details: JSON.stringify(result.checks, null, 2)
      });
    } else if (hasFailures) {
      result.overallStatus = 'warning';
      await sendAlert({
        type: 'data_integrity',
        severity: 'warning',
        message: `Data integrity check warnings detected`,
        details: JSON.stringify(result.checks, null, 2)
      });
    }

    logger.info('[MONITOR] Data integrity check completed', { status: result.overallStatus });
    
  } catch (error) {
    logger.error('[MONITOR] Data integrity check failed', error);
    result.overallStatus = 'critical';
    result.checks.push({
      name: 'integrity_check_error',
      passed: false,
      issues: [error instanceof Error ? error.message : 'Unknown error']
    });
  }

  // Store result
  try {
    await adminDb.collection('system_monitoring')
      .doc('data_integrity')
      .collection('history')
      .add(result);
  } catch (error) {
    logger.error('[MONITOR] Failed to store integrity check result', error);
  }

  return result;
}

/**
 * Check pets data integrity
 */
async function checkPetsIntegrity() {
  const issues: string[] = [];
  
  try {
    const usersSnapshot = await adminDb.collection('users').limit(100).get();
    
    for (const userDoc of usersSnapshot.docs) {
      const petsSnapshot = await adminDb
        .collection('users')
        .doc(userDoc.id)
        .collection('pets')
        .get();
      
      for (const petDoc of petsSnapshot.docs) {
        const pet = petDoc.data();
        
        // Check required fields
        if (!pet.name) {
          issues.push(`Pet ${petDoc.id} missing name`);
        }
        
        // Check birthday format
        if (pet.birthday && !/^\d{4}-\d{2}-\d{2}$/.test(pet.birthday)) {
          issues.push(`Pet ${petDoc.id} has invalid birthday format: ${pet.birthday}`);
        }
        
        // Check vaccine dates format
        if (pet.vaccineDates) {
          for (const [type, date] of Object.entries(pet.vaccineDates)) {
            if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date as string)) {
              issues.push(`Pet ${petDoc.id} has invalid ${type} vaccine date: ${date}`);
            }
          }
        }
      }
    }
  } catch (error) {
    issues.push(`Error checking pets: ${error instanceof Error ? error.message : 'Unknown'}`);
  }

  return {
    name: 'pets_integrity',
    passed: issues.length === 0,
    issues: issues.length > 0 ? issues : undefined
  };
}

/**
 * Check voucher data integrity
 */
async function checkVoucherIntegrity() {
  const issues: string[] = [];
  const voucherCodes = new Set<string>();
  
  try {
    const vouchersSnapshot = await adminDb.collection('birthday_vouchers').get();
    
    for (const voucherDoc of vouchersSnapshot.docs) {
      const voucher = voucherDoc.data();
      
      // Check for duplicates
      if (voucherCodes.has(voucher.code)) {
        issues.push(`Duplicate voucher code: ${voucher.code}`);
      }
      voucherCodes.add(voucher.code);
      
      // Check code format
      if (!/^BDAY-[A-Z0-9]+-\d{4}-[A-Z0-9]+$/.test(voucher.code)) {
        issues.push(`Invalid voucher code format: ${voucher.code}`);
      }
      
      // Check required fields
      if (!voucher.uid || !voucher.discountPercent || !voucher.birthdayYear) {
        issues.push(`Voucher ${voucher.code} missing required fields`);
      }
    }
  } catch (error) {
    issues.push(`Error checking vouchers: ${error instanceof Error ? error.message : 'Unknown'}`);
  }

  return {
    name: 'voucher_integrity',
    passed: issues.length === 0,
    issues: issues.length > 0 ? issues : undefined
  };
}

/**
 * Check inbox data integrity
 */
async function checkInboxIntegrity() {
  const issues: string[] = [];
  
  try {
    const inboxSnapshot = await adminDb.collectionGroup('messages').limit(100).get();
    
    for (const messageDoc of inboxSnapshot.docs) {
      const message = messageDoc.data();
      
      // Check required fields
      if (!message.title || !message.bodyHtml || !message.type) {
        issues.push(`Message ${messageDoc.id} missing required fields`);
      }
      
      // Check type validity
      const validTypes = ['voucher', 'system', 'receipt', 'promo', 'reminder'];
      if (!validTypes.includes(message.type)) {
        issues.push(`Message ${messageDoc.id} has invalid type: ${message.type}`);
      }
    }
  } catch (error) {
    issues.push(`Error checking inbox: ${error instanceof Error ? error.message : 'Unknown'}`);
  }

  return {
    name: 'inbox_integrity',
    passed: issues.length === 0,
    issues: issues.length > 0 ? issues : undefined
  };
}

// ============================================
// ALERT SYSTEM
// ============================================

interface Alert {
  type: 'cron_failure' | 'firestore_spike' | 'data_integrity' | 'system_error' | 'nayax_webhook_failures' | 'nayax_pending_transactions' | 'nayax_inactive_stations' | 'nayax_report_failed' | 'low_stock_alert' | 'utility_renewal_alert';
  severity: 'critical' | 'warning' | 'info';
  message: string;
  details?: string;
  jobName?: string;
}

/**
 * Send alert via email and/or Slack
 */
async function sendAlert(alert: Alert): Promise<void> {
  const timestamp = new Date().toISOString();
  const severityEmoji = alert.severity === 'critical' ? '🚨' : alert.severity === 'warning' ? '⚠️' : 'ℹ️';
  
  logger.warn(`[ALERT] ${severityEmoji} ${alert.message}`, alert);

  // Send email alert
  if (SENDGRID_API_KEY) {
    try {
      const emailContent = `
        <h2>${severityEmoji} Pet Wash Monitoring Alert</h2>
        <p><strong>Type:</strong> ${alert.type}</p>
        <p><strong>Severity:</strong> ${alert.severity}</p>
        <p><strong>Message:</strong> ${alert.message}</p>
        ${alert.jobName ? `<p><strong>Job:</strong> ${alert.jobName}</p>` : ''}
        ${alert.details ? `<p><strong>Details:</strong></p><pre>${alert.details}</pre>` : ''}
        <p><strong>Timestamp:</strong> ${timestamp}</p>
      `;

      await sgMail.send({
        to: ALERT_EMAIL,
        from: 'alerts@petwash.co.il',
        subject: `${severityEmoji} Pet Wash Alert: ${alert.message}`,
        html: emailContent
      });
      
      logger.info('[ALERT] Email sent successfully');
    } catch (error) {
      logger.error('[ALERT] Failed to send email', error);
    }
  }

  // Send Slack alert (optional)
  if (SLACK_WEBHOOK) {
    try {
      const response = await fetch(SLACK_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `${severityEmoji} *${alert.message}*`,
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `${severityEmoji} *${alert.message}*\n*Type:* ${alert.type}\n*Severity:* ${alert.severity}${alert.jobName ? `\n*Job:* ${alert.jobName}` : ''}`
              }
            },
            ...(alert.details ? [{
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `\`\`\`${alert.details}\`\`\``
              }
            }] : [])
          ]
        })
      });

      if (!response.ok) {
        throw new Error(`Slack webhook failed: ${response.statusText}`);
      }
      
      logger.info('[ALERT] Slack notification sent successfully');
    } catch (error) {
      logger.error('[ALERT] Failed to send Slack notification', error);
    }
  }

  // Store alert in Firestore
  try {
    await adminDb.collection('system_monitoring')
      .doc('alerts')
      .collection('history')
      .add({
        ...alert,
        timestamp: new Date()
      });
  } catch (error) {
    logger.error('[ALERT] Failed to store alert', error);
  }
}

// ============================================
// MONITORING DASHBOARD DATA
// ============================================

/**
 * Get comprehensive monitoring status
 */
export async function getMonitoringStatus() {
  return {
    timestamp: new Date(),
    cronJobs: getCronJobStatus(),
    firestoreMetrics: getFirestoreMetrics(),
    system: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      nodeVersion: process.version
    }
  };
}

// ============================================
// NAYAX MONITORING
// ============================================

interface NayaxWebhookFailure {
  timestamp: Date;
  eventId: string;
  error: string;
}

const nayaxWebhookFailures: NayaxWebhookFailure[] = [];

/**
 * Track Nayax webhook failure
 */
export async function trackNayaxWebhookFailure(eventId: string, error: string): Promise<void> {
  const now = new Date();
  
  nayaxWebhookFailures.push({
    timestamp: now,
    eventId,
    error
  });
  
  // Clean old failures (older than time window)
  const cutoff = new Date(now.getTime() - MONITORING_CONFIG.nayax.webhookFailures.timeWindow);
  const recentFailures = nayaxWebhookFailures.filter(f => f.timestamp > cutoff);
  nayaxWebhookFailures.length = 0;
  nayaxWebhookFailures.push(...recentFailures);
  
  // Check if threshold exceeded
  if (recentFailures.length >= MONITORING_CONFIG.nayax.webhookFailures.threshold) {
    await sendAlert({
      type: 'nayax_webhook_failures',
      severity: 'critical',
      message: `Nayax webhook failures exceeded threshold: ${recentFailures.length} failures in 10 minutes`,
      details: `Recent failures:\n${recentFailures.map(f => `${f.eventId}: ${f.error}`).join('\n')}`
    });
  }
  
  logger.warn(`[NAYAX] Webhook failure tracked: ${eventId}`, { totalRecentFailures: recentFailures.length });
}

/**
 * Check for pending Nayax transactions
 * Fixed: Filter in memory to avoid composite index requirement
 */
export async function checkPendingNayaxTransactions(): Promise<void> {
  try {
    const cutoffTime = new Date(Date.now() - MONITORING_CONFIG.nayax.pendingTransactions.maxAge);
    
    const pendingSnapshot = await adminDb
      .collection('nayax_transactions')
      .where('status', '==', 'pending')
      .get();
    
    const oldPendingTransactions = pendingSnapshot.docs.filter(doc => {
      const data = doc.data() as any;
      const createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
      return createdAt < cutoffTime;
    });
    
    if (oldPendingTransactions.length > 0) {
      const transactions = oldPendingTransactions.map(doc => {
        const data = doc.data() as any;
        return {
          id: doc.id,
          uid: data.uid,
          ...data
        };
      });
      
      await sendAlert({
        type: 'nayax_pending_transactions',
        severity: 'warning',
        message: `${oldPendingTransactions.length} Nayax transactions pending for >15 minutes`,
        details: `Transaction IDs:\n${transactions.map(t => `${t.id} (${t.uid || 'unknown user'})`).join('\n')}`
      });
      
      logger.warn(`[NAYAX] Pending transactions alert`, { count: oldPendingTransactions.length });
    }
  } catch (error) {
    logger.error('[NAYAX] Failed to check pending transactions', error);
  }
}

/**
 * Check for inactive Nayax stations
 */
export async function checkInactiveNayaxStations(): Promise<void> {
  try {
    const cutoffTime = new Date(Date.now() - MONITORING_CONFIG.nayax.inactiveStations.maxInactivity);
    
    // Get all active terminals
    const terminalsSnapshot = await adminDb
      .collection('nayax_terminals')
      .where('isActive', '==', true)
      .get();
    
    const inactiveStations: any[] = [];
    
    for (const terminalDoc of terminalsSnapshot.docs) {
      const terminal = terminalDoc.data();
      const terminalId = terminalDoc.id;
      
      // Check for recent transactions
      const recentTransactions = await adminDb
        .collection('nayax_transactions')
        .where('terminalId', '==', terminalId)
        .where('createdAt', '>', cutoffTime.toISOString())
        .limit(1)
        .get();
      
      if (recentTransactions.empty) {
        inactiveStations.push({
          id: terminalId,
          name: terminal.name,
          location: terminal.location
        });
      }
    }
    
    if (inactiveStations.length > 0) {
      await sendAlert({
        type: 'nayax_inactive_stations',
        severity: 'warning',
        message: `${inactiveStations.length} Nayax stations with no transactions in 24 hours`,
        details: `Inactive stations:\n${inactiveStations.map(s => `${s.id} - ${s.name} (${s.location})`).join('\n')}`
      });
      
      logger.warn(`[NAYAX] Inactive stations alert`, { count: inactiveStations.length, stations: inactiveStations });
    }
  } catch (error) {
    logger.error('[NAYAX] Failed to check inactive stations', error);
  }
}

/**
 * Generate and send daily Nayax report
 * Sends comprehensive summary at 7 AM Israel time
 */
export async function sendDailyNayaxReport() {
  try {
    logger.info('[NAYAX REPORT] Generating daily report...');
    
    // Get yesterday's date range (Israel time)
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    
    const today = new Date(yesterday);
    today.setDate(today.getDate() + 1);
    
    const yesterdayISO = yesterday.toISOString();
    const todayISO = today.toISOString();
    
    // Fetch transactions for yesterday
    const transactionsSnapshot = await adminDb
      .collection('nayax_transactions')
      .where('createdAt', '>=', yesterdayISO)
      .where('createdAt', '<', todayISO)
      .get();
    
    // Fetch voucher redemptions for yesterday
    const vouchersSnapshot = await adminDb
      .collection('nayax_vouchers')
      .where('redeemedAt', '>=', yesterdayISO)
      .where('redeemedAt', '<', todayISO)
      .get();
    
    // Get all terminals
    const terminalsSnapshot = await adminDb
      .collection('nayax_terminals')
      .where('isActive', '==', true)
      .get();
    
    // Calculate metrics
    let totalRevenue = 0;
    let totalMerchantFees = 0;
    let totalWashes = 0;
    let failedTransactions = 0;
    let pendingTransactions = 0;
    let completedPayments = 0;
    
    const MERCHANT_FEE_RATE = parseFloat(process.env.NAYAX_MERCHANT_FEE_RATE || '0.055');
    const VAT_RATE = parseFloat(process.env.VAT_RATE || '0.18'); // Israeli VAT rate from env
    
    let totalVAT = 0;
    let totalNetBeforeFees = 0;
    let totalNetAfterFees = 0;
    
    transactionsSnapshot.docs.forEach(doc => {
      const tx = doc.data();
      if (tx.status === 'approved' || tx.status === 'completed') {
        const amount = tx.amount || 0;
        totalRevenue += amount;
        completedPayments++;
        
        // Use PERSISTED values from transaction (for audit compliance)
        totalMerchantFees += tx.merchantFee || 0;
        totalVAT += tx.vatAmount || 0;
        totalNetBeforeFees += tx.netBeforeFees || 0;
        totalNetAfterFees += tx.netAfterFees || 0;
      } else if (tx.status === 'failed') {
        failedTransactions++;
      } else if (tx.status === 'pending') {
        pendingTransactions++;
      }
    });
    
    // Count voucher redemptions
    const voucherRedemptions = vouchersSnapshot.size;
    totalWashes = completedPayments + voucherRedemptions;
    
    // Use aggregated persisted values (not recalculated)
    const netBeforeFees = totalNetBeforeFees;
    const vatAmount = totalVAT;
    const netAfterFees = totalNetAfterFees;
    
    // Active stations
    const activeStations = terminalsSnapshot.size;
    
    // Get station analytics (Smart Monitoring)
    const stationAnalytics = await getStationAnalyticsFor24Hours();
    
    // Format date for email
    const reportDate = yesterday.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    
    // Generate HTML email
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
    .container { max-width: 700px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%); color: white; padding: 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 28px; font-weight: 600; }
    .header p { margin: 10px 0 0 0; opacity: 0.9; font-size: 14px; }
    .rate-badges { margin-top: 15px; display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }
    .rate-badge { background: rgba(255,255,255,0.2); padding: 6px 14px; border-radius: 20px; font-size: 12px; font-weight: 600; backdrop-filter: blur(10px); }
    .content { padding: 30px; }
    .metric-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
    .metric { background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); padding: 20px; border-radius: 8px; border-left: 4px solid #0ea5e9; }
    .metric-label { font-size: 13px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
    .metric-value { font-size: 32px; font-weight: 700; color: #0f172a; }
    .metric-unit { font-size: 16px; color: #64748b; margin-left: 4px; }
    .section { margin-bottom: 30px; }
    .section-title { font-size: 18px; font-weight: 600; color: #0f172a; margin-bottom: 15px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; }
    .revenue-breakdown { background: #f8fafc; padding: 20px; border-radius: 8px; }
    .revenue-item { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #e2e8f0; }
    .revenue-item:last-child { border-bottom: none; }
    .revenue-label { color: #475569; font-weight: 500; }
    .revenue-value { color: #0f172a; font-weight: 600; }
    .alert { background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 15px; margin-bottom: 20px; }
    .alert-warning { background: #fefce8; border-color: #fde047; }
    .alert-icon { display: inline-block; margin-right: 8px; }
    .footer { background: #f8fafc; padding: 25px; text-align: center; border-top: 1px solid #e2e8f0; }
    .btn { display: inline-block; background: #0ea5e9; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; margin-top: 15px; }
    .btn:hover { background: #0284c7; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🐾 Pet Wash™ Daily Nayax Report</h1>
      <p>${reportDate}</p>
      <div class="rate-badges">
        <span class="rate-badge">VAT Rate: ${(VAT_RATE * 100).toFixed(0)}%</span>
        <span class="rate-badge">Merchant Fee: ${(MERCHANT_FEE_RATE * 100).toFixed(2)}%</span>
      </div>
    </div>
    
    <div class="content">
      ${failedTransactions > 0 || pendingTransactions > 0 ? `
      <div class="alert ${pendingTransactions > 0 ? 'alert-warning' : ''}">
        <span class="alert-icon">${failedTransactions > 0 ? '⚠️' : '⏳'}</span>
        <strong>Attention Required:</strong> 
        ${failedTransactions > 0 ? `${failedTransactions} failed transaction${failedTransactions > 1 ? 's' : ''}` : ''}
        ${failedTransactions > 0 && pendingTransactions > 0 ? ' and ' : ''}
        ${pendingTransactions > 0 ? `${pendingTransactions} pending transaction${pendingTransactions > 1 ? 's' : ''}` : ''}
      </div>
      ` : ''}
      
      <div class="metric-grid">
        <div class="metric">
          <div class="metric-label">Total Washes</div>
          <div class="metric-value">${totalWashes}</div>
        </div>
        <div class="metric">
          <div class="metric-label">Active Stations</div>
          <div class="metric-value">${activeStations}</div>
        </div>
      </div>
      
      <div class="section">
        <h2 class="section-title">Revenue Summary</h2>
        <div class="revenue-breakdown">
          <div class="revenue-item">
            <span class="revenue-label">Gross Revenue</span>
            <span class="revenue-value">₪${totalRevenue.toFixed(2)}</span>
          </div>
          <div class="revenue-item">
            <span class="revenue-label">VAT (${(VAT_RATE * 100).toFixed(0)}%)</span>
            <span class="revenue-value">₪${vatAmount.toFixed(2)}</span>
          </div>
          <div class="revenue-item">
            <span class="revenue-label">Net Before Fees</span>
            <span class="revenue-value">₪${netBeforeFees.toFixed(2)}</span>
          </div>
        </div>
      </div>
      
      <div class="section">
        <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 20px; border-radius: 8px; color: white;">
          <h2 style="margin: 0 0 15px 0; font-size: 18px; font-weight: 600; border-bottom: 2px solid rgba(255,255,255,0.3); padding-bottom: 8px;">💳 Merchant Fees</h2>
          <div style="display: flex; justify-content: space-between; margin-bottom: 15px;">
            <span style="font-weight: 500;">Nayax Merchant Fees</span>
            <span style="font-weight: 700; font-size: 20px;">₪${totalMerchantFees.toFixed(2)}</span>
          </div>
          <div style="background: rgba(0,0,0,0.2); padding: 15px; border-radius: 6px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-weight: 500;">🏦 Net Revenue After Fees</span>
              <span style="font-weight: 700; font-size: 24px;">₪${netAfterFees.toFixed(2)}</span>
            </div>
            <p style="margin: 10px 0 0 0; font-size: 12px; opacity: 0.9;">Final amount to Pet Wash Ltd after VAT and merchant fees</p>
          </div>
        </div>
      </div>
      
      <div class="section">
        <h2 class="section-title">Transaction Details</h2>
        <div class="revenue-breakdown">
          <div class="revenue-item">
            <span class="revenue-label">Card Payments</span>
            <span class="revenue-value">${completedPayments}</span>
          </div>
          <div class="revenue-item">
            <span class="revenue-label">Voucher Redemptions</span>
            <span class="revenue-value">${voucherRedemptions}</span>
          </div>
          <div class="revenue-item">
            <span class="revenue-label">Failed Scans</span>
            <span class="revenue-value" style="color: ${failedTransactions > 0 ? '#dc2626' : '#0f172a'}">${failedTransactions}</span>
          </div>
          <div class="revenue-item">
            <span class="revenue-label">Pending Scans</span>
            <span class="revenue-value" style="color: ${pendingTransactions > 0 ? '#f59e0b' : '#0f172a'}">${pendingTransactions}</span>
          </div>
        </div>
      </div>
      
      ${stationAnalytics.length > 0 ? `
      <div class="section">
        <h2 class="section-title">📡 Smart Monitoring (24h Overview)</h2>
        <div style="overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <thead>
              <tr style="background: #f8fafc; border-bottom: 2px solid #e2e8f0;">
                <th style="padding: 12px 8px; text-align: left; color: #64748b; font-weight: 600;">Station</th>
                <th style="padding: 12px 8px; text-align: center; color: #64748b; font-weight: 600;">Status</th>
                <th style="padding: 12px 8px; text-align: center; color: #64748b; font-weight: 600;">Uptime</th>
                <th style="padding: 12px 8px; text-align: center; color: #64748b; font-weight: 600;">Offline</th>
                <th style="padding: 12px 8px; text-align: center; color: #64748b; font-weight: 600;">Weather</th>
                <th style="padding: 12px 8px; text-align: center; color: #64748b; font-weight: 600;">Last HB</th>
              </tr>
            </thead>
            <tbody>
              ${stationAnalytics.map(station => {
                const statusColor = {
                  online: '#10b981',
                  idle: '#eab308',
                  warning_low_activity: '#f59e0b',
                  offline: '#ef4444',
                  maintenance: '#8b5cf6'
                }[station.currentStatus] || '#64748b';
                
                const statusIcon = {
                  online: '🟢',
                  idle: '🟡',
                  warning_low_activity: '🟠',
                  offline: '🔴',
                  maintenance: '🟣'
                }[station.currentStatus] || '⚪';
                
                const formatMinutes = (mins: number) => {
                  if (mins < 60) return `${mins}m`;
                  const hours = Math.floor(mins / 60);
                  const remainMins = mins % 60;
                  return remainMins > 0 ? `${hours}h ${remainMins}m` : `${hours}h`;
                };
                
                const formatTime = (date: Date | null) => {
                  if (!date) return 'Never';
                  const now = new Date();
                  const diffMins = Math.floor((now.getTime() - date.getTime()) / 60000);
                  if (diffMins < 5) return 'Just now';
                  if (diffMins < 60) return `${diffMins}m ago`;
                  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
                  return `${Math.floor(diffMins / 1440)}d ago`;
                };
                
                return `
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  <td style="padding: 12px 8px; font-weight: 500; color: #0f172a;">
                    ${station.stationId}<br>
                    <span style="font-size: 11px; color: #94a3b8;">${station.label}</span>
                  </td>
                  <td style="padding: 12px 8px; text-align: center;">
                    <span style="display: inline-block; padding: 4px 10px; border-radius: 12px; background: ${statusColor}22; color: ${statusColor}; font-weight: 600; font-size: 11px;">
                      ${statusIcon} ${station.currentStatus}
                    </span>
                  </td>
                  <td style="padding: 12px 8px; text-align: center; font-weight: 600; color: ${station.uptimePercent >= 95 ? '#10b981' : station.uptimePercent >= 80 ? '#f59e0b' : '#ef4444'};">
                    ${station.uptimePercent.toFixed(1)}%
                  </td>
                  <td style="padding: 12px 8px; text-align: center; color: ${station.offlineIncidents.count > 0 ? '#ef4444' : '#64748b'};">
                    ${station.offlineIncidents.count > 0 ? `${station.offlineIncidents.count}× (${formatMinutes(station.offlineIncidents.totalMinutes)})` : '—'}
                  </td>
                  <td style="padding: 12px 8px; text-align: center; color: ${station.weatherSuppressedWarnings > 0 ? '#0ea5e9' : '#64748b'};">
                    ${station.weatherSuppressedWarnings > 0 ? `${station.weatherSuppressedWarnings}×` : '—'}
                  </td>
                  <td style="padding: 12px 8px; text-align: center; font-size: 11px; color: #64748b;">
                    ${formatTime(station.lastHeartbeatAt)}
                  </td>
                </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
        <div style="margin-top: 15px; padding: 12px; background: #f0f9ff; border-left: 4px solid #0ea5e9; border-radius: 4px; font-size: 12px; color: #64748b;">
          <strong style="color: #0f172a;">Legend:</strong> 
          🟢 Online | 🟡 Idle | 🟠 Low Activity | 🔴 Offline | 🟣 Maintenance | 
          <strong style="color: #0f172a;">Weather:</strong> Suppressed low-activity warnings | 
          <strong style="color: #0f172a;">Last HB:</strong> Last heartbeat received
        </div>
      </div>
      ` : ''}
    </div>
    
    <div class="footer">
      <p style="color: #64748b; margin: 0 0 10px 0;">Review detailed transactions in the admin dashboard</p>
      <a href="https://petwash.co.il/admin/users" class="btn">View Admin Dashboard</a>
      <p style="color: #94a3b8; font-size: 12px; margin-top: 20px;">
        Pet Wash™ Automated Reporting System
      </p>
    </div>
  </div>
</body>
</html>
    `;
    
    // Send email via SendGrid
    if (!SENDGRID_API_KEY) {
      logger.warn('[NAYAX REPORT] SendGrid not configured, skipping email');
      return;
    }
    
    const msg = {
      to: 'Support@PetWash.co.il',
      from: 'reports@petwash.co.il',
      subject: `🐾 Pet Wash™ Daily Nayax Report - ${reportDate}`,
      html: htmlContent
    };
    
    await sgMail.send(msg);
    
    logger.info('[NAYAX REPORT] Daily report sent successfully', {
      date: reportDate,
      totalWashes,
      totalRevenue,
      activeStations
    });
    
  } catch (error) {
    logger.error('[NAYAX REPORT] Failed to send daily report', error);
    
    // Send alert about failed report
    await sendAlert({
      type: 'nayax_report_failed',
      severity: 'warning',
      message: 'Failed to generate daily Nayax report',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Send a simple Slack alert with just a message
 * Used by stations alert service for low-stock and utility renewal notifications
 */
export async function sendSlackAlert(message: string): Promise<void> {
  if (!SLACK_WEBHOOK) {
    logger.debug('[ALERT] Slack webhook not configured, skipping notification');
    return;
  }

  try {
    const response = await fetch(SLACK_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: message
      })
    });

    if (!response.ok) {
      throw new Error(`Slack webhook failed: ${response.statusText}`);
    }
    
    logger.info('[ALERT] Slack notification sent successfully');
  } catch (error) {
    logger.error('[ALERT] Failed to send Slack notification', error);
  }
}

/**
 * Export alert for manual trigger
 */
export { sendAlert };
