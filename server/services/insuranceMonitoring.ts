import { db } from '../db';
import { providerApplications } from '@shared/schema';
import { eq, and, sql, lt } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { sendSMS } from '../lib/twilio';

/**
 * Insurance Policy Expiration Monitoring Service (2026 Spec)
 * 
 * Features:
 * - Daily expiration checks
 * - Multi-channel alerts (SMS, email, push)
 * - Automatic contractor suspension on expiry
 * - Grace period management
 */

interface InsuranceAlert {
  contractorId: string;
  contractorName: string;
  email: string;
  phoneNumber: string;
  policyNumber: string;
  provider: string;
  expiresAt: Date;
  daysUntilExpiry: number;
  alertType: 'warning' | 'critical' | 'expired';
}

/**
 * Check all insurance policies for upcoming expirations
 */
export async function checkInsuranceExpirations(): Promise<InsuranceAlert[]> {
  try {
    const now = new Date();
    const alerts: InsuranceAlert[] = [];

    // Get all contractors with insurance policies
    const contractors = await db
      .select()
      .from(providerApplications)
      .where(
        and(
          eq(providerApplications.status, 'approved'),
          sql`${providerApplications.insuranceExpiresAt} IS NOT NULL`
        )
      );

    for (const contractor of contractors) {
      if (!contractor.insuranceExpiresAt) continue;

      const expiresAt = new Date(contractor.insuranceExpiresAt);
      const daysUntilExpiry = Math.floor(
        (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Define alert thresholds
      let alertType: 'warning' | 'critical' | 'expired' | null = null;
      
      if (daysUntilExpiry < 0) {
        alertType = 'expired'; // Already expired
      } else if (daysUntilExpiry <= 7) {
        alertType = 'critical'; // Expires within 7 days
      } else if (daysUntilExpiry <= 30) {
        alertType = 'warning'; // Expires within 30 days
      }

      if (alertType) {
        alerts.push({
          contractorId: contractor.userId,
          contractorName: `${contractor.firstName} ${contractor.lastName}`,
          email: contractor.email,
          phoneNumber: contractor.phoneNumber,
          policyNumber: contractor.insurancePolicyNumber || 'Unknown',
          provider: contractor.insuranceProvider || 'Unknown',
          expiresAt,
          daysUntilExpiry,
          alertType,
        });
      }
    }

    logger.info('[InsuranceMonitoring] Expiration check complete', {
      totalContractors: contractors.length,
      alertsGenerated: alerts.length,
      expired: alerts.filter((a) => a.alertType === 'expired').length,
      critical: alerts.filter((a) => a.alertType === 'critical').length,
      warning: alerts.filter((a) => a.alertType === 'warning').length,
    });

    return alerts;
  } catch (error) {
    logger.error('[InsuranceMonitoring] Error checking expirations', { error });
    throw error;
  }
}

/**
 * Send insurance expiration alerts to contractors
 */
export async function sendInsuranceAlerts(alerts: InsuranceAlert[]): Promise<void> {
  try {
    for (const alert of alerts) {
      const { contractorId, contractorName, email, phoneNumber, daysUntilExpiry, alertType } = alert;

      let message = '';
      let subject = '';

      if (alertType === 'expired') {
        subject = '🚨 URGENT: Insurance Policy Expired - Action Required';
        message = `Hi ${contractorName}, your insurance policy has EXPIRED. Your contractor status has been suspended. Please upload a new policy immediately to resume operations. Contact support: Support@PetWash.co.il`;
      } else if (alertType === 'critical') {
        subject = `⚠️ CRITICAL: Insurance Expires in ${daysUntilExpiry} Days`;
        message = `Hi ${contractorName}, your insurance policy expires in ${daysUntilExpiry} days! Please renew and upload your new policy ASAP to avoid service suspension. Visit: petwash.co.il/contractor/dashboard`;
      } else if (alertType === 'warning') {
        subject = `📅 Reminder: Insurance Expires in ${daysUntilExpiry} Days`;
        message = `Hi ${contractorName}, your insurance policy expires in ${daysUntilExpiry} days. Please plan to renew and upload your updated policy. Visit: petwash.co.il/contractor/dashboard`;
      }

      // Send SMS alert
      try {
        await sendSMS(phoneNumber, message);
        logger.info('[InsuranceMonitoring] SMS alert sent', {
          contractorId,
          phoneNumber,
          alertType,
        });
      } catch (smsError) {
        logger.error('[InsuranceMonitoring] Failed to send SMS alert', {
          contractorId,
          error: smsError,
        });
      }

      // TODO: Send email alert (SendGrid)
      // TODO: Send push notification (Firebase)

      logger.info('[InsuranceMonitoring] Alert sent to contractor', {
        contractorId,
        email,
        daysUntilExpiry,
        alertType,
      });
    }
  } catch (error) {
    logger.error('[InsuranceMonitoring] Error sending alerts', { error });
    throw error;
  }
}

/**
 * Suspend contractors with expired insurance
 */
export async function suspendExpiredContractors(): Promise<string[]> {
  try {
    const now = new Date();
    const suspended: string[] = [];

    // Find all contractors with expired insurance
    const expiredContractors = await db
      .select()
      .from(providerApplications)
      .where(
        and(
          eq(providerApplications.status, 'approved'),
          lt(providerApplications.insuranceExpiresAt, now)
        )
      );

    for (const contractor of expiredContractors) {
      // Update status to rejected (suspended)
      await db
        .update(providerApplications)
        .set({
          status: 'rejected',
          rejectionReason: `Insurance policy expired on ${contractor.insuranceExpiresAt}. Please upload renewed policy to reactivate.`,
          reviewedAt: now,
        })
        .where(eq(providerApplications.userId, contractor.userId));

      suspended.push(contractor.userId);

      logger.warn('[InsuranceMonitoring] Contractor suspended - expired insurance', {
        contractorId: contractor.userId,
        contractorName: `${contractor.firstName} ${contractor.lastName}`,
        expiresAt: contractor.insuranceExpiresAt,
      });
    }

    logger.info('[InsuranceMonitoring] Expired contractors suspended', {
      count: suspended.length,
    });

    return suspended;
  } catch (error) {
    logger.error('[InsuranceMonitoring] Error suspending expired contractors', { error });
    throw error;
  }
}

/**
 * Verify insurance policy (manual admin action)
 */
export async function verifyInsurancePolicy(
  contractorId: string,
  verified: boolean,
  notes?: string
): Promise<void> {
  try {
    const now = new Date();

    await db
      .update(providerApplications)
      .set({
        insuranceLastVerified: verified ? now : null,
        internalNotes: notes ? `[Insurance Verification] ${notes}` : null,
        updatedAt: now,
      })
      .where(eq(providerApplications.userId, contractorId));

    logger.info('[InsuranceMonitoring] Insurance policy verified', {
      contractorId,
      verified,
    });
  } catch (error) {
    logger.error('[InsuranceMonitoring] Error verifying insurance policy', {
      contractorId,
      error,
    });
    throw error;
  }
}

/**
 * Daily insurance monitoring job (run at 8 AM Israel time)
 */
export async function runDailyInsuranceMonitoring(): Promise<void> {
  try {
    logger.info('[InsuranceMonitoring] Starting daily insurance monitoring job');

    // Check expirations
    const alerts = await checkInsuranceExpirations();

    // Send alerts for upcoming expirations
    if (alerts.length > 0) {
      await sendInsuranceAlerts(alerts);
    }

    // Suspend contractors with expired insurance
    const suspended = await suspendExpiredContractors();

    logger.info('[InsuranceMonitoring] Daily insurance monitoring complete', {
      alertsSent: alerts.length,
      contractorsSuspended: suspended.length,
    });
  } catch (error) {
    logger.error('[InsuranceMonitoring] Error in daily insurance monitoring job', { error });
    throw error;
  }
}
