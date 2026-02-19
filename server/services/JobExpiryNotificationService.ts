import { db } from '../db';
import { jobOffers } from '@shared/schema';
import { eq, and, isNull, lte, sql } from 'drizzle-orm';
import { FCMService } from './FCMService';
import { sendLuxuryEmail } from '../email/luxury-email-service';
import { PETWASH_LOGO_BASE64 } from '../email/templates/logo-base64';
import { logger } from '../lib/logger';

const EXPIRY_CHECK_INTERVAL_MS = 15_000;
const BATCH_SIZE = 10;

function generateExpiryEmailHtml(customerName: string, platform: string, serviceDate: string, language: 'he' | 'en'): string {
  const isHebrew = language === 'he';
  const dir = isHebrew ? 'rtl' : 'ltr';
  const platformNames: Record<string, Record<string, string>> = {
    'sitter-suite': { he: 'The Sitter Suite™', en: 'The Sitter Suite™' },
    'walk-my-pet': { he: 'Walk My Pet™', en: 'Walk My Pet™' },
    'pettrek': { he: 'PetTrek™', en: 'PetTrek™' },
  };
  const platformLabel = platformNames[platform]?.[language] || platform;

  return `<!DOCTYPE html>
<html lang="${language}" dir="${dir}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: 'Georgia', serif;">
  <div style="max-width: 520px; margin: 0 auto; padding: 32px 16px;">
    <div style="background: #ffffff; border-radius: 2px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.06);">
      <div style="background: linear-gradient(160deg, #0f172a 0%, #1e293b 50%, #334155 100%); padding: 40px; text-align: center; position: relative;">
        <div style="position: absolute; top: 0; left: 0; right: 0; height: 3px; background: linear-gradient(90deg, #c9a96e, #e8d5a3, #dcc07a, #c9a96e);"></div>
        <img src="${PETWASH_LOGO_BASE64}" alt="Pet Wash™" style="max-width: 120px; height: auto; margin-bottom: 16px;" />
        <h1 style="color: #ffffff; font-size: 22px; font-weight: 400; margin: 0; font-family: 'Georgia', serif;">
          ${isHebrew ? 'הזמנה פגה' : 'Booking Expired'}
        </h1>
      </div>
      <div style="height: 2px; background: linear-gradient(90deg, #c9a96e, #e8d5a3, #dcc07a, #e8d5a3, #c9a96e);"></div>
      <div style="padding: 44px;">
        <p style="font-size: 15px; color: #475569; margin: 0 0 24px; text-align: ${isHebrew ? 'right' : 'left'}; line-height: 1.8;">
          ${isHebrew
            ? `שלום ${customerName}, לצערנו ההזמנה שלך ב-${platformLabel} לתאריך ${serviceDate} פגה, מכיוון שלא נמצא נותן שירות זמין.`
            : `Hi ${customerName}, unfortunately your ${platformLabel} booking for ${serviceDate} has expired because no available provider was found.`}
        </p>
        <p style="font-size: 15px; color: #475569; margin: 0 0 24px; text-align: ${isHebrew ? 'right' : 'left'}; line-height: 1.8;">
          ${isHebrew
            ? 'התשלום שלך שוחרר באופן מלא. אנא נסו להזמין שוב — יתכן שנותני שירות נוספים יהיו זמינים.'
            : 'Your payment has been fully released. Please try booking again — more providers may be available.'}
        </p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="https://petwash.co.il" style="display: inline-block; background: linear-gradient(135deg, #c9a96e, #dcc07a); color: #0f172a; padding: 14px 40px; text-decoration: none; border-radius: 2px; font-size: 14px; font-weight: 600; letter-spacing: 1px;">
            ${isHebrew ? 'הזמנה חדשה' : 'BOOK AGAIN'}
          </a>
        </div>
      </div>
      <div style="background: #0f172a; padding: 24px; text-align: center;">
        <p style="color: rgba(255,255,255,0.4); font-size: 11px; margin: 0;">© ${new Date().getFullYear()} Pet Wash™</p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

export class JobExpiryNotificationService {
  private intervalHandle: ReturnType<typeof setInterval> | null = null;

  start(): void {
    if (this.intervalHandle) return;

    logger.info('[JobExpiryNotify] Starting expiry notification poller');
    this.intervalHandle = setInterval(() => this.pollExpiredJobs(), EXPIRY_CHECK_INTERVAL_MS);
  }

  stop(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }

  private async pollExpiredJobs(): Promise<void> {
    try {
      const expiredJobs = await db
        .select()
        .from(jobOffers)
        .where(
          and(
            eq(jobOffers.status, 'expired'),
            isNull(sql`${jobOffers.metadata}->>'expiryNotified'`)
          )
        )
        .limit(BATCH_SIZE);

      for (const job of expiredJobs) {
        await this.notifyExpiry(job);
      }
    } catch (error) {
      logger.error('[JobExpiryNotify] Poll error:', error);
    }
  }

  private async notifyExpiry(job: typeof jobOffers.$inferSelect): Promise<void> {
    const jobId = job.id;
    const customerId = job.customerId;
    const customerName = job.customerName || 'Customer';
    const platform = job.platform;
    const serviceDate = job.serviceDate
      ? new Date(job.serviceDate).toLocaleDateString('he-IL')
      : '';

    const channels: string[] = [];
    let pushSent = false;
    let emailSent = false;

    try {
      pushSent = await FCMService.sendToUser({
        userId: customerId,
        title: 'ההזמנה פגה',
        body: `ההזמנה שלך ב-${platform} לתאריך ${serviceDate} פגה. התשלום שוחרר. אנא הזמינו שוב.`,
        data: {
          type: 'JOB_EXPIRED',
          jobOfferId: jobId,
          platform,
        },
      });
      if (pushSent) channels.push('push');
      logger.info('[JobExpiryNotify] Push attempt', { jobId, customerId, sent: pushSent });
    } catch (error) {
      logger.warn('[JobExpiryNotify] Push failed', { jobId, error });
    }

    try {
      const { db: firestoreDb } = await import('../lib/firebase-admin');
      const userDoc = await firestoreDb.collection('users').doc(customerId).get();
      const userData = userDoc.data();
      const email = userData?.email;

      if (email) {
        const html = generateExpiryEmailHtml(customerName, platform, serviceDate, 'he');
        emailSent = await sendLuxuryEmail({
          to: email,
          subject: `הזמנה פגה — Pet Wash™`,
          html,
        });
        if (emailSent) channels.push('email');
        logger.info('[JobExpiryNotify] Email attempt', { jobId, email, sent: emailSent });
      }
    } catch (error) {
      logger.warn('[JobExpiryNotify] Email failed', { jobId, error });
    }

    if (channels.length === 0) {
      logger.error('[JobExpiryNotify] ALL channels failed - will retry next poll', { jobId, customerId });
      return;
    }

    try {
      const existingMeta = (job.metadata as Record<string, any>) || {};
      await db.update(jobOffers).set({
        metadata: {
          ...existingMeta,
          expiryNotified: true,
          expiryNotifiedAt: new Date().toISOString(),
          expiryChannels: channels,
        },
        updatedAt: new Date(),
      }).where(eq(jobOffers.id, jobId));

      await this.writeAuditEvent(jobId, customerId, platform);
    } catch (error) {
      logger.error('[JobExpiryNotify] Flag update failed', { jobId, error });
    }
  }

  private async writeAuditEvent(jobId: string, customerId: string, platform: string): Promise<void> {
    try {
      const { db: firestoreDb } = await import('../lib/firebase-admin');
      await firestoreDb.collection('audit_events').add({
        type: 'JOB_EXPIRY_NOTIFICATION',
        jobOfferId: jobId,
        customerId,
        platform,
        channels: ['push', 'email'],
        timestamp: new Date().toISOString(),
        action: 'customer_notified_of_expired_booking',
      });
    } catch (error) {
      logger.error('[JobExpiryNotify] Audit write failed', { jobId, error });
    }
  }
}

export const jobExpiryNotificationService = new JobExpiryNotificationService();
