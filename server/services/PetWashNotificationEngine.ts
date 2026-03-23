/**
 * PETWASH™ NOTIFICATION ENGINE
 *
 * Unified multi-channel dispatcher: email + SMS (Twilio) + push (FCM).
 *
 * Guarantees:
 *   1. Backend record written (status = 'queued') BEFORE any send attempt.
 *   2. Each channel's failure is isolated — it never breaks a sibling channel
 *      and NEVER propagates to the calling transaction.
 *   3. Log row updated to 'sent' or 'failed' per channel.
 *   4. Caller can fire-and-forget; the engine is entirely self-contained.
 *
 * Retry philosophy (v1):
 *   - Failures are recorded with reason in notification_logs.
 *   - A separate background sweeper (future) can re-queue rows where
 *     status = 'failed' and created_at < NOW() - interval '5 minutes'.
 *   - Until then, the email receipt from SendGrid is the delivery guarantee.
 *
 * Channel routing (respects user preferences when userId provided):
 *   email  → SendGrid via EmailService
 *   sms    → Twilio via TwilioSMSService
 *   push   → Firebase FCM via FCMService
 */

import { db } from '../db';
import { notificationLogs } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { twilioSMSService } from './TwilioSMSService';
import { FCMService } from './FCMService';
import { createMailService } from '../lib/sendgrid';

export type NotificationChannel = 'email' | 'sms' | 'push';

export interface EmailChannelPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface SmsChannelPayload {
  to: string;
  text: string;
}

export interface PushChannelPayload {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface NotificationJob {
  /** Internal user ID — used for lookup and notification_logs.recipient_user_id */
  userId: string;
  /** Financial event type — stored on every log row for queryability */
  eventType:
    | 'booking_confirmed'
    | 'egift_purchased'
    | 'prestige_joined'
    | 'provider_approved'
    | 'provider_registration_submitted'
    | 'payout_issued'
    | string;
  /** Human-readable key for the template slot (stored in notification_logs.template_key) */
  templateKey: string;
  /** Optional linkage to financial records */
  bookingId?: string;
  transactionId?: string;
  /** Channels to attempt. Omit a channel or leave payload undefined to skip it. */
  channels: NotificationChannel[];
  email?: EmailChannelPayload;
  sms?: SmsChannelPayload;
  push?: PushChannelPayload;
  /** Arbitrary payload stored in notification_logs for debugging */
  debugPayload?: Record<string, unknown>;
}

/**
 * Dispatch a notification across configured channels.
 * This function NEVER throws. All errors are swallowed and logged.
 * Call fire-and-forget after committing the DB transaction.
 */
export async function dispatchNotifications(job: NotificationJob): Promise<void> {
  for (const channel of job.channels) {
    const hasPayload =
      (channel === 'email' && job.email) ||
      (channel === 'sms'   && job.sms) ||
      (channel === 'push'  && job.push);

    if (!hasPayload) continue;

    let logId: number | null = null;

    try {
      // ── 1. Write backend record FIRST (status = 'queued') ──────────────────
      const [logRow] = await db.insert(notificationLogs).values({
        templateKey: job.templateKey,
        channel,
        recipientUserId: job.userId,
        recipientEmail: channel === 'email' ? job.email?.to ?? null : null,
        recipientPhone: channel === 'sms'   ? job.sms?.to   ?? null : null,
        status: 'queued',
        payload: job.debugPayload ?? {},
        bookingId: job.bookingId ?? null,
        transactionId: job.transactionId ?? null,
        eventType: job.eventType,
        createdAt: new Date(),
      }).returning({ id: notificationLogs.id });

      logId = logRow?.id ?? null;

      // ── 2. Attempt send ───────────────────────────────────────────────────
      let sent = false;
      let providerMessageId: string | null = null;

      if (channel === 'email' && job.email) {
        const sg = createMailService();
        const ok = await sg.send({
          to: job.email.to,
          subject: job.email.subject,
          html: job.email.html,
          text: job.email.text,
        });
        sent = ok;
      }

      if (channel === 'sms' && job.sms) {
        const result = await twilioSMSService.sendSMS(job.sms.to, job.sms.text, {
          userId: job.userId,
        });
        sent = result.success;
        providerMessageId = result.messageId ?? null;
      }

      if (channel === 'push' && job.push) {
        sent = await FCMService.sendToUser({
          userId: job.push.userId,
          title: job.push.title,
          body: job.push.body,
          data: job.push.data,
        });
      }

      // ── 3. Update log status ──────────────────────────────────────────────
      if (logId !== null) {
        await db.update(notificationLogs)
          .set({
            status: sent ? 'sent' : 'failed',
            sentAt: sent ? new Date() : undefined,
            failureReason: sent ? null : 'Provider returned unsuccessful',
          })
          .where(eq(notificationLogs.id, logId));
      }

      logger.info('[NotificationEngine] Channel dispatched', {
        channel,
        sent,
        eventType: job.eventType,
        userId: job.userId,
        bookingId: job.bookingId,
        transactionId: job.transactionId,
        logId,
        providerMessageId,
      });

    } catch (err: any) {
      logger.error('[NotificationEngine] Channel failed', {
        channel,
        eventType: job.eventType,
        userId: job.userId,
        error: err?.message,
        logId,
      });

      // Mark the log row as failed if it was created
      if (logId !== null) {
        try {
          await db.update(notificationLogs)
            .set({
              status: 'failed',
              failureReason: err?.message ?? 'Unknown error',
            })
            .where(eq(notificationLogs.id, logId));
        } catch {
          // Swallow — the outer error is already logged
        }
      }
    }
  }
}

/**
 * Build a plain-text SMS summary for a booking confirmation.
 */
export function buildBookingConfirmedSms(params: {
  bookingRef: string;
  serviceName: string;
  dateStr: string;
  totalAmount: string;
}): string {
  return (
    `PetWash™ - הזמנה אושרה ✅\n` +
    `מס' הזמנה: ${params.bookingRef}\n` +
    `שירות: ${params.serviceName}\n` +
    `תאריך: ${params.dateStr}\n` +
    `סה"כ לתשלום: ${params.totalAmount} ₪\n` +
    `לפרטים: https://petwash.co.il/bookings`
  );
}

/**
 * Build a plain-text SMS for eGift purchase.
 */
export function buildEgiftPurchasedSms(params: {
  giftRef: string;
  giftValue: string;
  recipientName?: string;
}): string {
  const to = params.recipientName ? ` ל-${params.recipientName}` : '';
  return (
    `PetWash™ - כרטיס מתנה נרכש 🎁\n` +
    `מס' מתנה: ${params.giftRef}\n` +
    `שווי${to}: ${params.giftValue} ₪\n` +
    `מימוש: https://petwash.co.il/egift/redeem`
  );
}

/**
 * Build a plain-text SMS for Prestige/loyalty membership join.
 */
export function buildPrestigeJoinedSms(params: {
  memberNumber: string;
  tier: string;
}): string {
  return (
    `PetWash™ Prestige 👑\n` +
    `ברוך הבא לתכנית הנאמנות!\n` +
    `מס' חבר: ${params.memberNumber}\n` +
    `רמה: ${params.tier}\n` +
    `petwash.co.il/prestige`
  );
}

/**
 * Build a plain-text SMS for provider approval.
 */
export function buildProviderApprovedSms(params: {
  providerName: string;
}): string {
  return (
    `PetWash™ - הבקשה אושרה ✅\n` +
    `שלום ${params.providerName},\n` +
    `חשבון הספק שלך אושר!\n` +
    `התחל/י: https://petwash.co.il/provider/onboarding`
  );
}

/**
 * Build a plain-text SMS for a payout notice.
 */
export function buildPayoutIssuedSms(params: {
  payoutRef: string;
  netAmount: string;
}): string {
  return (
    `PetWash™ - תשלום הועבר 💸\n` +
    `מס' תשלום: ${params.payoutRef}\n` +
    `סכום נטו: ${params.netAmount} ₪\n` +
    `פרטים: https://petwash.co.il/provider/earnings`
  );
}
